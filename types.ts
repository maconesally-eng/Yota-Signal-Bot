export type SignalDirection = 'LONG' | 'SHORT';
export type SignalStatus = 'WATCHING' | 'TRIGGERED' | 'WON' | 'LOST' | 'EXPIRED';
export type StrategyType = 'Silver Bullet' | 'Order Block' | 'Manual';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type TrendContext = 'UP' | 'DOWN' | 'CHOPPY';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveTrade {
  id: string;
  pair: string;
  direction: SignalDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED';
  pnl: number;
  entryTime: number;
}

export interface Signal {
  id: string;
  pair: string;
  direction: SignalDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  strategy: StrategyType;
  confidence: ConfidenceLevel;
  status: SignalStatus;
  timestamp: number; // Date.now()
  pnl?: number;
  reasoning?: string;
}

export interface Trade {
  id: string;
  pair: string;
  direction: SignalDirection;
  entryPrice: number;
  exitPrice: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  strategy: StrategyType;
  date: string;
  notes?: string;
  checklistGrade?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: 'Pre-Trade' | 'Execution' | 'Post-Trade';
  checked: boolean;
}

// --- MEMORY TYPES ---
export interface AgentLesson {
  id: string;
  timestamp: number;
  trendContext: TrendContext;
  insight: string;
}

export interface AgentMemory {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  brainVersion: string; // e.g. "v2.4"
  lessons: AgentLesson[];
}

// --- API TYPES ---
export interface WebhookTradePayload {
  secret: string;
  type: 'TRADE_OPEN' | 'TRADE_CLOSE' | 'TRADE_UPDATE';
  trade: {
    id: string;
    pair: string;
    direction: SignalDirection;
    entryPrice: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
    pnl?: number;
    pnlPercent?: number;
    outcome?: TradeOutcome;
    strategy?: StrategyType;
    timestamp?: number;
  };
}

export interface WebhookSignalPayload {
  secret: string;
  type: 'SIGNAL_NEW' | 'SIGNAL_UPDATE';
  signal: {
    id: string;
    pair: string;
    direction: SignalDirection;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    strategy?: StrategyType;
    confidence?: ConfidenceLevel;
    status?: SignalStatus;
    reasoning?: string;
    pnl?: number;
  };
}

// --- STATS TYPES ---
export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalPnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgRiskReward: number;
}

export interface StrategyWeight {
  strategy: StrategyType;
  weight: number;
  winCount: number;
  lossCount: number;
  totalPnl: number;
  avgWinPnl: number;
  avgLossPnl: number;
  lastUpdated: number;
}

// --- LEARNING TYPES ---
export interface LearningEvent {
  id: string;
  tradeId: string | null;
  lesson: string;
  patternType: string | null;
  trendContext: TrendContext | null;
  marketContext: string | null;
  timestamp: number;
}

export interface PatternDetection {
  type: 'CONSECUTIVE_LOSSES' | 'LOW_GRADE_LOSS' | 'WEAK_HOUR' | 'WEAK_STRATEGY' | 'HIGH_RISK' | 'TIME_PERFORMANCE' | 'STRATEGY_PERFORMANCE';
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  recommendation: string;
}

// --- NEWS TYPES ---
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  relevantPairs: string[];
}

export interface MarketContext {
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentScore: number; // -100 to 100
  topNews: NewsItem[];
  lastUpdated: number;
}

// --- SSE EVENT TYPES ---
export type SSEEventType =
  | 'connected'
  | 'init'
  | 'trade_open'
  | 'trade_close'
  | 'trade_update'
  | 'signal_new'
  | 'signal_update'
  | 'stats_update'
  | 'learning_update'
  | 'memory_sync'
  | 'heartbeat';

export interface SSEMessage<T = unknown> {
  event: SSEEventType;
  data: T;
}

// --- SYNC TYPES ---
export interface SyncStatus {
  lastSync: number;
  inProgress: boolean;
  connected: boolean;
}

export interface CloudMemory {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  brainVersion: string;
  lessons: AgentLesson[];
  lastSynced: number;
}
