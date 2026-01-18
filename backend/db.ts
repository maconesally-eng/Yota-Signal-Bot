import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'yota.db');

// Initialize database with tables
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Trades table
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT')),
    entry_price REAL NOT NULL,
    exit_price REAL,
    stop_loss REAL,
    take_profit REAL,
    leverage INTEGER DEFAULT 1,
    pnl REAL DEFAULT 0,
    pnl_percent REAL DEFAULT 0,
    outcome TEXT CHECK(outcome IN ('WIN', 'LOSS', 'BREAKEVEN', 'OPEN')),
    strategy TEXT,
    notes TEXT,
    checklist_grade TEXT,
    source TEXT DEFAULT 'manual',
    timestamp INTEGER NOT NULL,
    closed_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  -- Signals table
  CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT')),
    entry_price REAL NOT NULL,
    stop_loss REAL,
    take_profit REAL,
    strategy TEXT,
    confidence TEXT CHECK(confidence IN ('HIGH', 'MEDIUM', 'LOW')),
    status TEXT DEFAULT 'WATCHING' CHECK(status IN ('WATCHING', 'TRIGGERED', 'WON', 'LOST', 'EXPIRED')),
    reasoning TEXT,
    pnl REAL,
    timestamp INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  -- Learning events table
  CREATE TABLE IF NOT EXISTS learning_events (
    id TEXT PRIMARY KEY,
    trade_id TEXT,
    lesson TEXT NOT NULL,
    pattern_type TEXT,
    trend_context TEXT CHECK(trend_context IN ('UP', 'DOWN', 'CHOPPY')),
    market_context TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (trade_id) REFERENCES trades(id)
  );

  -- Initialize default strategy weights (DEPRECATED - Dynamic now)
`);


// Type definitions for database operations
export interface DbTrade {
  id: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  leverage: number;
  pnl: number;
  pnl_percent: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN' | null;
  strategy: string | null;
  notes: string | null;
  checklist_grade: string | null;
  source: string;
  timestamp: number;
  closed_at: number | null;
  created_at: number;
}

export interface DbSignal {
  id: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  strategy: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  status: 'WATCHING' | 'TRIGGERED' | 'WON' | 'LOST' | 'EXPIRED';
  reasoning: string | null;
  pnl: number | null;
  timestamp: number;
  created_at: number;
}

export interface DbStrategyStats {
  strategy: string;
  trade_count: number;
  win_count: number;
  loss_count: number;
  breakeven_count: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  win_rate: number;
}

export interface DbLearningEvent {
  id: string;
  trade_id: string | null;
  lesson: string;
  pattern_type: string | null;
  trend_context: 'UP' | 'DOWN' | 'CHOPPY' | null;
  market_context: string | null;
  timestamp: number;
}

// Prepared statements for trades
const insertTrade = db.prepare(`
  INSERT INTO trades (id, pair, direction, entry_price, exit_price, stop_loss, take_profit,
    leverage, pnl, pnl_percent, outcome, strategy, notes, checklist_grade, source, timestamp, closed_at)
  VALUES (@id, @pair, @direction, @entry_price, @exit_price, @stop_loss, @take_profit,
    @leverage, @pnl, @pnl_percent, @outcome, @strategy, @notes, @checklist_grade, @source, @timestamp, @closed_at)
  ON CONFLICT(id) DO UPDATE SET
    pair=excluded.pair,
    direction=excluded.direction,
    entry_price=excluded.entry_price,
    stop_loss=excluded.stop_loss,
    take_profit=excluded.take_profit,
    leverage=excluded.leverage,
    strategy=excluded.strategy
`);


const updateTrade = db.prepare(`
  UPDATE trades SET
    exit_price = @exit_price,
    pnl = @pnl,
    pnl_percent = @pnl_percent,
    outcome = @outcome,
    notes = @notes,
    checklist_grade = @checklist_grade,
    closed_at = @closed_at
  WHERE id = @id
`);

const getTrades = db.prepare(`
  SELECT * FROM trades ORDER BY timestamp DESC LIMIT @limit OFFSET @offset
`);

const getTradeById = db.prepare(`SELECT * FROM trades WHERE id = ?`);

const getTradesByDate = db.prepare(`
  SELECT * FROM trades
  WHERE date(timestamp / 1000, 'unixepoch') = date(? / 1000, 'unixepoch')
  ORDER BY timestamp DESC
`);

const getOpenTrades = db.prepare(`
  SELECT * FROM trades WHERE outcome = 'OPEN' OR outcome IS NULL
`);

// Prepared statements for signals
const insertSignal = db.prepare(`
  INSERT INTO signals (id, pair, direction, entry_price, stop_loss, take_profit,
    strategy, confidence, status, reasoning, pnl, timestamp)
  VALUES (@id, @pair, @direction, @entry_price, @stop_loss, @take_profit,
    @strategy, @confidence, @status, @reasoning, @pnl, @timestamp)
`);

const updateSignalStatus = db.prepare(`
  UPDATE signals SET status = @status, pnl = @pnl WHERE id = @id
`);

const getRecentSignals = db.prepare(`
  SELECT * FROM signals ORDER BY timestamp DESC LIMIT @limit
`);

// Strategy stats aggregation (Dynamic)
const getStrategyStats = db.prepare(`
  SELECT 
    strategy,
    COUNT(*) as trade_count,
    SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as win_count,
    SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END) as loss_count,
    SUM(CASE WHEN outcome='BREAKEVEN' THEN 1 ELSE 0 END) as breakeven_count,
    COALESCE(SUM(pnl), 0) as total_pnl,
    COALESCE(AVG(CASE WHEN outcome='WIN' THEN pnl END), 0) as avg_win,
    COALESCE(AVG(CASE WHEN outcome='LOSS' THEN pnl END), 0) as avg_loss
  FROM trades
  WHERE outcome IN ('WIN', 'LOSS', 'BREAKEVEN')
  GROUP BY strategy
`);

// Calendar stats (Daily PnL) - uses localtime for correct local day grouping
const getDailyStats = db.prepare(`
  SELECT 
    date(timestamp / 1000, 'unixepoch', 'localtime') as date,
    COUNT(*) as trade_count,
    SUM(pnl) as total_pnl,
    SUM(CASE WHEN outcome='WIN' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome='LOSS' THEN 1 ELSE 0 END) as losses
  FROM trades
  WHERE outcome IN ('WIN', 'LOSS', 'BREAKEVEN')
  GROUP BY date(timestamp / 1000, 'unixepoch', 'localtime')
  ORDER BY date DESC
`);

// Prepared statements for learning events
const insertLearningEvent = db.prepare(`
  INSERT INTO learning_events (id, trade_id, lesson, pattern_type, trend_context, market_context, timestamp)
  VALUES (@id, @trade_id, @lesson, @pattern_type, @trend_context, @market_context, @timestamp)
`);

const getRecentLearningEvents = db.prepare(`
  SELECT * FROM learning_events ORDER BY timestamp DESC LIMIT @limit
`);

// Prepared statements for agent memory
const getAgentMemory = db.prepare(`SELECT * FROM agent_memory WHERE id = 'main'`);

const upsertAgentMemory = db.prepare(`
  INSERT INTO agent_memory (id, level, current_xp, next_level_xp, brain_version, lessons, last_synced)
  VALUES ('main', @level, @current_xp, @next_level_xp, @brain_version, @lessons, @last_synced)
  ON CONFLICT(id) DO UPDATE SET
    level = @level,
    current_xp = @current_xp,
    next_level_xp = @next_level_xp,
    brain_version = @brain_version,
    lessons = @lessons,
    last_synced = @last_synced
`);

// Stats queries
const getStats = db.prepare(`
  SELECT
    COUNT(*) as total_trades,
    SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
    SUM(CASE WHEN outcome = 'BREAKEVEN' THEN 1 ELSE 0 END) as breakeven,
    COALESCE(SUM(pnl), 0) as total_pnl,
    COALESCE(AVG(CASE WHEN outcome = 'WIN' THEN pnl END), 0) as avg_win,
    COALESCE(AVG(CASE WHEN outcome = 'LOSS' THEN pnl END), 0) as avg_loss
  FROM trades
  WHERE outcome IS NOT NULL AND outcome != 'OPEN'
`);

const getRecentStats = db.prepare(`
  SELECT
    COUNT(*) as total_trades,
    SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
    COALESCE(SUM(pnl), 0) as total_pnl
  FROM trades
  WHERE outcome IS NOT NULL AND outcome != 'OPEN'
    AND timestamp > @since
`);

// Export database operations
export const tradeDb = {
  insert: (trade: Omit<DbTrade, 'created_at'>) => insertTrade.run(trade),
  update: (trade: Partial<DbTrade> & { id: string }) => updateTrade.run(trade),
  getById: (id: string): DbTrade | undefined => getTradeById.get(id) as DbTrade | undefined,
  getAll: (limit = 100, offset = 0): DbTrade[] => getTrades.all({ limit, offset }) as DbTrade[],
  getByDate: (timestamp: number): DbTrade[] => getTradesByDate.all(timestamp) as DbTrade[],
  getOpen: (): DbTrade[] => getOpenTrades.all() as DbTrade[],
};

export const signalDb = {
  insert: (signal: Omit<DbSignal, 'created_at'>) => insertSignal.run(signal),
  updateStatus: (id: string, status: DbSignal['status'], pnl: number | null) =>
    updateSignalStatus.run({ id, status, pnl }),
  getRecent: (limit = 20): DbSignal[] => getRecentSignals.all({ limit }) as DbSignal[],
};

export const strategyDb = {
  getStats: (): DbStrategyStats[] => {
    const rows = getStrategyStats.all() as any[];
    return rows.map(row => ({
      ...row,
      win_rate: row.trade_count > 0 ? (row.win_count / row.trade_count) * 100 : 0
    }));
  },
  getDaily: () => getDailyStats.all(),
};

export const learningDb = {
  insert: (event: DbLearningEvent) => insertLearningEvent.run(event),
  getRecent: (limit = 50): DbLearningEvent[] =>
    getRecentLearningEvents.all({ limit }) as DbLearningEvent[],
};

export const memoryDb = {
  get: () => getAgentMemory.get() as {
    id: string;
    level: number;
    current_xp: number;
    next_level_xp: number;
    brain_version: string;
    lessons: string;
    last_synced: number
  } | undefined,
  upsert: (memory: {
    level: number;
    current_xp: number;
    next_level_xp: number;
    brain_version: string;
    lessons: string;
    last_synced: number
  }) => upsertAgentMemory.run(memory),
};

export const statsDb = {
  getAll: () => getStats.get() as {
    total_trades: number;
    wins: number;
    losses: number;
    breakeven: number;
    total_pnl: number;
    avg_win: number;
    avg_loss: number;
  },
  getRecent: (since: number) => getRecentStats.get({ since }) as {
    total_trades: number;
    wins: number;
    losses: number;
    total_pnl: number;
  },
};

export default db;
