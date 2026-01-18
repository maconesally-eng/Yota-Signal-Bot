import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import {
  tradeDb,
  signalDb,
  strategyDb,
  learningDb,
  memoryDb,
  statsDb,
  DbTrade,
  DbSignal,
  DbStrategyStats,
} from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'yota-dev-secret';

// Middleware
app.use(cors());
app.use(express.json());

// SSE clients for real-time updates
const sseClients = new Set<Response>();

// Broadcast to all SSE clients
function broadcast(event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    client.write(message);
  });
}

// =============================================================================
// SSE ENDPOINT - Real-time updates
// =============================================================================
app.get('/api/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`);

  // Add client to set
  sseClients.add(res);
  console.log(`SSE client connected. Total clients: ${sseClients.size}`);

  // Send current stats on connection
  const stats = statsDb.getAll();
  const recentTrades = tradeDb.getAll(10, 0);
  const recentSignals = signalDb.getRecent(10);

  res.write(`event: init\ndata: ${JSON.stringify({
    stats: formatStats(stats),
    trades: recentTrades.map(formatTrade),
    signals: recentSignals.map(formatSignal),
  })}\n\n`);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`SSE client disconnected. Total clients: ${sseClients.size}`);
  });
});

// =============================================================================
// WEBHOOK ENDPOINTS - Receive trades from cloud bot
// =============================================================================

interface WebhookPayload {
  secret: string;
  type: 'TRADE_OPEN' | 'TRADE_CLOSE' | 'TRADE_UPDATE' | 'SIGNAL_NEW' | 'SIGNAL_UPDATE';
  trade?: {
    id: string;
    pair: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
    pnl?: number;
    pnlPercent?: number;
    outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
    strategy?: string;
    timestamp?: number;
  };
  signal?: {
    id: string;
    pair: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    strategy?: string;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    status?: 'WATCHING' | 'TRIGGERED' | 'WON' | 'LOST' | 'EXPIRED';
    reasoning?: string;
    pnl?: number;
  };
}

app.post('/api/webhook/trade', (req: Request, res: Response) => {
  const payload = req.body as WebhookPayload;

  // Validate webhook secret
  if (payload.secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  if (!payload.trade) {
    return res.status(400).json({ error: 'Missing trade data' });
  }

  const trade = payload.trade;
  const now = Date.now();

  try {
    if (payload.type === 'TRADE_OPEN') {
      const dbTrade: Omit<DbTrade, 'created_at'> = {
        id: trade.id || randomUUID(),
        pair: trade.pair,
        direction: trade.direction,
        entry_price: trade.entryPrice,
        exit_price: null,
        stop_loss: trade.stopLoss || null,
        take_profit: trade.takeProfit || null,
        leverage: trade.leverage || 1,
        pnl: 0,
        pnl_percent: 0,
        outcome: 'OPEN',
        strategy: trade.strategy || 'Manual',
        notes: null,
        checklist_grade: null,
        source: 'webhook',
        timestamp: trade.timestamp || now,
        closed_at: null,
      };

      tradeDb.insert(dbTrade);
      broadcast('trade_open', formatTrade(dbTrade as DbTrade));
      console.log(`Trade opened: ${dbTrade.id} - ${dbTrade.pair} ${dbTrade.direction}`);

    } else if (payload.type === 'TRADE_CLOSE') {
      const existingTrade = tradeDb.getById(trade.id);

      if (existingTrade) {
        // Compute PnL if not provided
        const exitPrice = trade.exitPrice ?? existingTrade.exit_price ?? existingTrade.entry_price;
        const pnl = trade.pnl ?? (exitPrice - existingTrade.entry_price) * (existingTrade.direction === 'LONG' ? 1 : -1) * (existingTrade.leverage || 1);
        const pnlPercent = trade.pnlPercent ?? ((pnl / existingTrade.entry_price) * 100);

        // Determine outcome if not provided
        let outcome = trade.outcome;
        if (!outcome) {
          if (pnl > 0) outcome = 'WIN';
          else if (pnl < 0) outcome = 'LOSS';
          else outcome = 'BREAKEVEN';
        }

        // Update existing trade
        tradeDb.update({
          id: trade.id,
          exit_price: exitPrice,
          pnl,
          pnl_percent: pnlPercent,
          outcome,
          closed_at: now,
        });

        // Update strategy weights (Removed - dynamic)

        const updatedTrade = tradeDb.getById(trade.id);
        broadcast('trade_close', formatTrade(updatedTrade!));
        broadcast('stats_update', formatStats(statsDb.getAll()));

        // Trigger learning analysis
        analyzeTrade(updatedTrade!);

      } else {
        // Insert as closed trade (for cases where we didn't track the open)
        // Compute PnL if not provided
        const exitPrice = trade.exitPrice ?? trade.entryPrice;
        const pnl = trade.pnl ?? (exitPrice - trade.entryPrice) * (trade.direction === 'LONG' ? 1 : -1) * (trade.leverage || 1);
        const pnlPercent = trade.pnlPercent ?? ((pnl / trade.entryPrice) * 100);

        let outcome = trade.outcome;
        if (!outcome) {
          if (pnl > 0) outcome = 'WIN';
          else if (pnl < 0) outcome = 'LOSS';
          else outcome = 'BREAKEVEN';
        }

        const dbTrade: Omit<DbTrade, 'created_at'> = {
          id: trade.id || randomUUID(),
          pair: trade.pair,
          direction: trade.direction,
          entry_price: trade.entryPrice,
          exit_price: exitPrice,
          stop_loss: trade.stopLoss || null,
          take_profit: trade.takeProfit || null,
          leverage: trade.leverage || 1,
          pnl,
          pnl_percent: pnlPercent,
          outcome,
          strategy: trade.strategy || 'Manual',
          notes: null,
          checklist_grade: null,
          source: 'webhook',
          timestamp: trade.timestamp || now,
          closed_at: now,
        };

        tradeDb.insert(dbTrade);
        // updateStrategyWeight(dbTrade.strategy || 'Manual', dbTrade.outcome!, dbTrade.pnl);

        broadcast('trade_close', formatTrade(dbTrade as DbTrade));
        broadcast('stats_update', formatStats(statsDb.getAll()));

        analyzeTrade(dbTrade as DbTrade);
      }

      console.log(`Trade closed: ${trade.id} - ${trade.outcome} - PNL: ${trade.pnl}`);

    } else if (payload.type === 'TRADE_UPDATE') {
      tradeDb.update({
        id: trade.id,
        pnl: trade.pnl || 0,
        pnl_percent: trade.pnlPercent || 0,
      });

      const updatedTrade = tradeDb.getById(trade.id);
      if (updatedTrade) {
        broadcast('trade_update', formatTrade(updatedTrade));
      }
    }

    res.json({ success: true, timestamp: now });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/webhook/signal', (req: Request, res: Response) => {
  const payload = req.body as WebhookPayload;

  if (payload.secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  if (!payload.signal) {
    return res.status(400).json({ error: 'Missing signal data' });
  }

  const signal = payload.signal;
  const now = Date.now();

  try {
    if (payload.type === 'SIGNAL_NEW') {
      const dbSignal: Omit<DbSignal, 'created_at'> = {
        id: signal.id || randomUUID(),
        pair: signal.pair,
        direction: signal.direction,
        entry_price: signal.entryPrice,
        stop_loss: signal.stopLoss || null,
        take_profit: signal.takeProfit || null,
        strategy: signal.strategy || 'Manual',
        confidence: signal.confidence || 'MEDIUM',
        status: signal.status || 'WATCHING',
        reasoning: signal.reasoning || null,
        pnl: null,
        timestamp: now,
      };

      signalDb.insert(dbSignal);
      broadcast('signal_new', formatSignal(dbSignal as DbSignal));
      console.log(`Signal created: ${dbSignal.id} - ${dbSignal.pair} ${dbSignal.direction}`);

    } else if (payload.type === 'SIGNAL_UPDATE') {
      signalDb.updateStatus(signal.id, signal.status || 'WATCHING', signal.pnl || null);
      broadcast('signal_update', { id: signal.id, status: signal.status, pnl: signal.pnl });
    }

    res.json({ success: true, timestamp: now });

  } catch (error) {
    console.error('Signal webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// REST API ENDPOINTS
// =============================================================================

// Get all trades with pagination
app.get('/api/trades', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  const date = req.query.date as string;

  let trades: DbTrade[];
  if (date) {
    const timestamp = new Date(date).getTime();
    trades = tradeDb.getByDate(timestamp);
  } else {
    trades = tradeDb.getAll(limit, offset);
  }

  res.json({ trades: trades.map(formatTrade) });
});

// Get single trade
app.get('/api/trades/:id', (req: Request, res: Response) => {
  const trade = tradeDb.getById(req.params.id as string);
  if (!trade) {
    return res.status(404).json({ error: 'Trade not found' });
  }
  res.json({ trade: formatTrade(trade) });
});

// Create trade manually
app.post('/api/trades', (req: Request, res: Response) => {
  const trade = req.body;
  const now = Date.now();

  const dbTrade: Omit<DbTrade, 'created_at'> = {
    id: trade.id || randomUUID(),
    pair: trade.pair,
    direction: trade.direction,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice || null,
    stop_loss: trade.stopLoss || null,
    take_profit: trade.takeProfit || null,
    leverage: trade.leverage || 1,
    pnl: trade.pnl || 0,
    pnl_percent: trade.pnlPercent || 0,
    outcome: trade.outcome || (trade.exitPrice ? 'BREAKEVEN' : 'OPEN'),
    strategy: trade.strategy || 'Manual',
    notes: trade.notes || null,
    checklist_grade: trade.checklistGrade || null,
    source: 'manual',
    timestamp: trade.timestamp || now,
    closed_at: trade.exitPrice ? now : null,
  };

  try {
    tradeDb.insert(dbTrade);

    // If trade is closed, analyze
    if (dbTrade.outcome && dbTrade.outcome !== 'OPEN') {
      analyzeTrade(dbTrade as DbTrade);
    }

    broadcast(dbTrade.outcome === 'OPEN' ? 'trade_open' : 'trade_close', formatTrade(dbTrade as DbTrade));
    broadcast('stats_update', formatStats(statsDb.getAll()));

    res.status(201).json({ trade: formatTrade(dbTrade as DbTrade) });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Update trade
app.patch('/api/trades/:id', (req: Request, res: Response) => {
  const existingTrade = tradeDb.getById(req.params.id as string);
  if (!existingTrade) {
    return res.status(404).json({ error: 'Trade not found' });
  }

  const updates = req.body;
  tradeDb.update({
    id: req.params.id as string,
    exit_price: updates.exitPrice ?? existingTrade.exit_price,
    pnl: updates.pnl ?? existingTrade.pnl,
    pnl_percent: updates.pnlPercent ?? existingTrade.pnl_percent,
    outcome: updates.outcome ?? existingTrade.outcome,
    notes: updates.notes ?? existingTrade.notes,
    checklist_grade: updates.checklistGrade ?? existingTrade.checklist_grade,
    closed_at: updates.outcome && updates.outcome !== 'OPEN' ? Date.now() : existingTrade.closed_at,
  });

  const updatedTrade = tradeDb.getById(req.params.id as string);
  broadcast('trade_update', formatTrade(updatedTrade!));
  broadcast('stats_update', formatStats(statsDb.getAll()));

  res.json({ trade: formatTrade(updatedTrade!) });
});

// Get signals
app.get('/api/signals', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const signals = signalDb.getRecent(limit);
  res.json({ signals: signals.map(formatSignal) });
});

// Get stats
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = statsDb.getAll();
  const strategyStats = strategyDb.getStats();
  res.json({
    stats: formatStats(stats),
    strategyWeights: strategyStats.map(formatStrategyStats),
  });
});

// Get strategy stats
app.get('/api/strategies', (req: Request, res: Response) => {
  const stats = strategyDb.getStats();
  res.json({ strategies: stats.map(formatStrategyStats) });
});

// Get calendar (daily) stats
app.get('/api/calendar', (req: Request, res: Response) => {
  const daily = strategyDb.getDaily();
  res.json({ calendar: daily });
});

// Get learning events
app.get('/api/learning', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const events = learningDb.getRecent(limit);
  res.json({ events });
});

// =============================================================================
// MEMORY SYNC ENDPOINTS
// =============================================================================

app.get('/api/memory', (req: Request, res: Response) => {
  const memory = memoryDb.get();
  if (!memory) {
    return res.json({
      memory: {
        level: 1,
        currentXp: 0,
        nextLevelXp: 100,
        brainVersion: 'v1.0',
        lessons: [],
      }
    });
  }

  res.json({
    memory: {
      level: memory.level,
      currentXp: memory.current_xp,
      nextLevelXp: memory.next_level_xp,
      brainVersion: memory.brain_version,
      lessons: JSON.parse(memory.lessons || '[]'),
    }
  });
});

app.post('/api/memory/sync', (req: Request, res: Response) => {
  const { memory } = req.body;

  if (!memory) {
    return res.status(400).json({ error: 'Missing memory data' });
  }

  // Get existing cloud memory
  const cloudMemory = memoryDb.get();

  // Merge strategy: keep higher level, combine lessons
  const mergedLevel = Math.max(memory.level, cloudMemory?.level || 1);
  const mergedXp = memory.level > (cloudMemory?.level || 1) ? memory.currentXp : (cloudMemory?.current_xp || 0);
  const mergedNextLevelXp = memory.level > (cloudMemory?.level || 1) ? memory.nextLevelXp : (cloudMemory?.next_level_xp || 100);

  // Merge lessons (dedupe by id)
  const existingLessons = JSON.parse(cloudMemory?.lessons || '[]');
  const newLessons = memory.lessons || [];
  const allLessons = [...existingLessons];
  const existingIds = new Set(existingLessons.map((l: { id: string }) => l.id));

  for (const lesson of newLessons) {
    if (!existingIds.has(lesson.id)) {
      allLessons.push(lesson);
    }
  }

  // Keep only last 50 lessons
  const trimmedLessons = allLessons.slice(-50);

  memoryDb.upsert({
    level: mergedLevel,
    current_xp: mergedXp,
    next_level_xp: mergedNextLevelXp,
    brain_version: memory.brainVersion || 'v1.0',
    lessons: JSON.stringify(trimmedLessons),
    last_synced: Date.now(),
  });

  const updatedMemory = memoryDb.get()!;
  broadcast('memory_sync', {
    level: updatedMemory.level,
    currentXp: updatedMemory.current_xp,
    nextLevelXp: updatedMemory.next_level_xp,
    brainVersion: updatedMemory.brain_version,
    lessons: JSON.parse(updatedMemory.lessons),
  });

  res.json({
    success: true,
    memory: {
      level: updatedMemory.level,
      currentXp: updatedMemory.current_xp,
      nextLevelXp: updatedMemory.next_level_xp,
      brainVersion: updatedMemory.brain_version,
      lessons: JSON.parse(updatedMemory.lessons),
    }
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTrade(trade: DbTrade) {
  return {
    id: trade.id,
    pair: trade.pair,
    direction: trade.direction,
    entryPrice: trade.entry_price,
    exitPrice: trade.exit_price,
    stopLoss: trade.stop_loss,
    takeProfit: trade.take_profit,
    leverage: trade.leverage,
    pnl: trade.pnl,
    pnlPercent: trade.pnl_percent,
    outcome: trade.outcome,
    strategy: trade.strategy,
    notes: trade.notes,
    checklistGrade: trade.checklist_grade,
    source: trade.source,
    timestamp: trade.timestamp,
    closedAt: trade.closed_at,
    date: new Date(trade.timestamp).toISOString().split('T')[0],
  };
}

function formatSignal(signal: DbSignal) {
  return {
    id: signal.id,
    pair: signal.pair,
    direction: signal.direction,
    entryPrice: signal.entry_price,
    stopLoss: signal.stop_loss,
    takeProfit: signal.take_profit,
    strategy: signal.strategy,
    confidence: signal.confidence,
    status: signal.status,
    reasoning: signal.reasoning,
    pnl: signal.pnl,
    timestamp: signal.timestamp,
  };
}

function formatStats(stats: {
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
}) {
  const winRate = stats.total_trades > 0
    ? Math.round((stats.wins / stats.total_trades) * 100)
    : 0;

  const profitFactor = stats.avg_loss !== 0
    ? Math.abs(stats.avg_win * stats.wins) / Math.abs(stats.avg_loss * stats.losses) || 0
    : 0;

  const avgRiskReward = stats.avg_loss !== 0
    ? Math.abs(stats.avg_win / stats.avg_loss) || 0
    : 0;

  return {
    totalTrades: stats.total_trades,
    wins: stats.wins,
    losses: stats.losses,
    breakeven: stats.breakeven,
    totalPnl: stats.total_pnl,
    winRate,
    avgWin: stats.avg_win,
    avgLoss: stats.avg_loss,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgRiskReward: Math.round(avgRiskReward * 10) / 10,
  };
}

function formatStrategyStats(stats: DbStrategyStats) {
  // Calculate weight dynamically to match frontend expectation
  const winValue = stats.win_count * Math.abs(stats.avg_win);
  const lossValue = stats.loss_count * Math.abs(stats.avg_loss) + 1;
  const weight = Math.max(0.1, Math.min(5.0, winValue / lossValue));

  return {
    strategy: stats.strategy,
    weight: Number(weight.toFixed(2)),
    winCount: stats.win_count,
    lossCount: stats.loss_count,
    totalPnl: stats.total_pnl,
    avgWinPnl: stats.avg_win,
    avgLossPnl: stats.avg_loss,
    lastUpdated: Date.now(), // Dynamic, so always fresh
  };
}

// function updateStrategyWeight removed (Dynamic calculation)

function analyzeTrade(trade: DbTrade) {
  const patterns: string[] = [];
  const now = Date.now();

  // Get recent trades for pattern detection
  const recentTrades = tradeDb.getAll(10, 0);

  // Pattern 1: Consecutive losses detection
  let consecutiveLosses = 0;
  for (const t of recentTrades) {
    if (t.outcome === 'LOSS') consecutiveLosses++;
    else break;
  }
  if (consecutiveLosses >= 3) {
    patterns.push('CONSECUTIVE_LOSSES');
    learningDb.insert({
      id: randomUUID(),
      trade_id: trade.id,
      lesson: `Detected ${consecutiveLosses} consecutive losses. Consider reducing position size.`,
      pattern_type: 'CONSECUTIVE_LOSSES',
      trend_context: 'CHOPPY',
      market_context: null,
      timestamp: now,
    });
  }

  // Pattern 2: Time of day analysis
  const hour = new Date(trade.timestamp).getHours();
  if (trade.outcome === 'WIN') {
    learningDb.insert({
      id: randomUUID(),
      trade_id: trade.id,
      lesson: `Winning trade at ${hour}:00. Consider this as a favorable trading hour.`,
      pattern_type: 'TIME_PERFORMANCE',
      trend_context: null,
      market_context: `Hour: ${hour}`,
      timestamp: now,
    });
  }

  // Pattern 3: Strategy performance
  const allStrategies = strategyDb.getStats();
  const stratStats = allStrategies.find(s => s.strategy === (trade.strategy || 'Manual'));

  if (stratStats) {
    // Calculate implied weight/profit factor
    const winValue = stratStats.win_count * Math.abs(stratStats.avg_win);
    const lossValue = stratStats.loss_count * Math.abs(stratStats.avg_loss) + 1;
    const profitFactor = winValue / lossValue;

    if (profitFactor > 2.0) {
      learningDb.insert({
        id: randomUUID(),
        trade_id: trade.id,
        lesson: `${trade.strategy} strategy performing well (PF: ${profitFactor.toFixed(2)}). Prioritize this setup.`,
        pattern_type: 'STRATEGY_PERFORMANCE',
        trend_context: null,
        market_context: null,
        timestamp: now,
      });
    } else if (profitFactor < 0.5) {
      learningDb.insert({
        id: randomUUID(),
        trade_id: trade.id,
        lesson: `${trade.strategy} strategy underperforming (PF: ${profitFactor.toFixed(2)}). Review and adjust.`,
        pattern_type: 'STRATEGY_PERFORMANCE',
        trend_context: null,
        market_context: null,
        timestamp: now,
      });
    }
  }

  // Broadcast learning update
  if (patterns.length > 0) {
    broadcast('learning_update', {
      tradeId: trade.id,
      patterns,
      timestamp: now,
    });
  }
}

// =============================================================================
// SERVER START
// =============================================================================

app.listen(PORT, () => {
  console.log(`Yota Backend running on http://localhost:${PORT}`);
  console.log(`SSE stream available at http://localhost:${PORT}/api/stream`);
  console.log(`Webhook endpoints:`);
  console.log(`  POST /api/webhook/trade`);
  console.log(`  POST /api/webhook/signal`);
});

export default app;
