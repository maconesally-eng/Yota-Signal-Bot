import { Trade, Signal, SignalDirection } from '../types';

// API base URL - can be configured via environment variable
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  strategy: string;
  weight: number;
  winCount: number;
  lossCount: number;
  totalPnl: number;
  avgWinPnl: number;
  avgLossPnl: number;
}

export interface TradeServiceData {
  trades: Trade[];
  signals: Signal[];
  stats: TradeStats;
  strategyWeights: StrategyWeight[];
  connected: boolean;
}

type Listener = () => void;

class TradeService {
  private eventSource: EventSource | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  private data: TradeServiceData = {
    trades: [],
    signals: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      totalPnl: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      avgRiskReward: 0,
    },
    strategyWeights: [],
    connected: false,
  };

  constructor() {
    // Auto-connect on instantiation
    this.connect();
  }

  // Connect to SSE stream
  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource(`${API_BASE}/api/stream`);

      this.eventSource.onopen = () => {
        console.log('TradeService: SSE connected');
        this.data.connected = true;
        this.reconnectAttempts = 0;
        this.notify();
      };

      this.eventSource.onerror = (error) => {
        console.error('TradeService: SSE error', error);
        this.data.connected = false;
        this.notify();
        this.handleReconnect();
      };

      // Handle initial data
      this.eventSource.addEventListener('init', (event) => {
        const initData = JSON.parse(event.data);
        this.data.trades = initData.trades || [];
        this.data.signals = initData.signals || [];
        this.data.stats = initData.stats || this.data.stats;
        this.notify();
      });

      // Handle connected event
      this.eventSource.addEventListener('connected', () => {
        this.data.connected = true;
        this.notify();
      });

      // Handle trade events
      this.eventSource.addEventListener('trade_open', (event) => {
        const trade = JSON.parse(event.data);
        this.data.trades = [trade, ...this.data.trades.slice(0, 99)];
        this.notify();
      });

      this.eventSource.addEventListener('trade_close', (event) => {
        const trade = JSON.parse(event.data);
        const existingIndex = this.data.trades.findIndex(t => t.id === trade.id);
        if (existingIndex >= 0) {
          this.data.trades[existingIndex] = trade;
        } else {
          this.data.trades = [trade, ...this.data.trades.slice(0, 99)];
        }
        this.notify();
      });

      this.eventSource.addEventListener('trade_update', (event) => {
        const trade = JSON.parse(event.data);
        const existingIndex = this.data.trades.findIndex(t => t.id === trade.id);
        if (existingIndex >= 0) {
          this.data.trades[existingIndex] = trade;
          this.notify();
        }
      });

      // Handle signal events
      this.eventSource.addEventListener('signal_new', (event) => {
        const signal = JSON.parse(event.data);
        this.data.signals = [signal, ...this.data.signals.slice(0, 49)];
        this.notify();
      });

      this.eventSource.addEventListener('signal_update', (event) => {
        const update = JSON.parse(event.data);
        const existingIndex = this.data.signals.findIndex(s => s.id === update.id);
        if (existingIndex >= 0) {
          this.data.signals[existingIndex] = {
            ...this.data.signals[existingIndex],
            status: update.status,
            pnl: update.pnl,
          };
          this.notify();
        }
      });

      // Handle stats update
      this.eventSource.addEventListener('stats_update', (event) => {
        const stats = JSON.parse(event.data);
        this.data.stats = stats;
        this.notify();
      });

      // Handle heartbeat (keeps connection alive)
      this.eventSource.addEventListener('heartbeat', () => {
        // Just to confirm connection is alive
      });

    } catch (error) {
      console.error('TradeService: Failed to connect', error);
      this.data.connected = false;
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('TradeService: Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`TradeService: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.data.connected = false;
    this.notify();
  }

  // Subscribe to data changes (same pattern as marketSimulator)
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Get current data
  getData(): TradeServiceData {
    return { ...this.data };
  }

  // ==========================================================================
  // API Methods
  // ==========================================================================

  async fetchTrades(limit = 100, offset = 0): Promise<Trade[]> {
    try {
      const response = await fetch(`${API_BASE}/api/trades?limit=${limit}&offset=${offset}`);
      const data = await response.json();
      this.data.trades = data.trades;
      this.notify();
      return data.trades;
    } catch (error) {
      console.error('TradeService: Failed to fetch trades', error);
      return [];
    }
  }

  async fetchTradesByDate(date: string): Promise<Trade[]> {
    try {
      const response = await fetch(`${API_BASE}/api/trades?date=${date}`);
      const data = await response.json();
      return data.trades;
    } catch (error) {
      console.error('TradeService: Failed to fetch trades by date', error);
      return [];
    }
  }

  async fetchStats(): Promise<{ stats: TradeStats; strategyWeights: StrategyWeight[] }> {
    try {
      const response = await fetch(`${API_BASE}/api/stats`);
      const data = await response.json();
      this.data.stats = data.stats;
      this.data.strategyWeights = data.strategyWeights;
      this.notify();
      return data;
    } catch (error) {
      console.error('TradeService: Failed to fetch stats', error);
      return { stats: this.data.stats, strategyWeights: this.data.strategyWeights };
    }
  }

  async fetchSignals(limit = 20): Promise<Signal[]> {
    try {
      const response = await fetch(`${API_BASE}/api/signals?limit=${limit}`);
      const data = await response.json();
      this.data.signals = data.signals;
      this.notify();
      return data.signals;
    } catch (error) {
      console.error('TradeService: Failed to fetch signals', error);
      return [];
    }
  }

  async submitTrade(trade: {
    pair: string;
    direction: SignalDirection;
    entryPrice: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
    pnl?: number;
    pnlPercent?: number;
    outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
    strategy?: string;
    notes?: string;
    checklistGrade?: string;
  }): Promise<Trade | null> {
    try {
      const response = await fetch(`${API_BASE}/api/trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trade),
      });

      if (!response.ok) {
        throw new Error('Failed to submit trade');
      }

      const data = await response.json();
      // The SSE will handle updating the local state
      return data.trade;
    } catch (error) {
      console.error('TradeService: Failed to submit trade', error);
      return null;
    }
  }

  async updateTrade(
    id: string,
    updates: Partial<{
      exitPrice: number;
      pnl: number;
      pnlPercent: number;
      outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
      notes: string;
      checklistGrade: string;
    }>
  ): Promise<Trade | null> {
    try {
      const response = await fetch(`${API_BASE}/api/trades/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update trade');
      }

      const data = await response.json();
      return data.trade;
    } catch (error) {
      console.error('TradeService: Failed to update trade', error);
      return null;
    }
  }
}

// Singleton export (same pattern as marketSimulator)
export const tradeService = new TradeService();
