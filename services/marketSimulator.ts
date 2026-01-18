import { Candle, LiveTrade, SignalDirection } from '../types';

// Configuration for the simulation speed/volatility
const CONFIG = {
  TICK_RATE: 200, // Update every 200ms
  CANDLE_PERIOD: 2000, // New candle every 2 seconds (Fast trading)
  VOLATILITY: 0.15,
  START_PRICE: 144.50
};

type Listener = () => void;

class MarketSimulator {
  private candles: Candle[] = [];
  private currentPrice: number = CONFIG.START_PRICE;
  private listeners: Listener[] = [];
  private activeTrade: LiveTrade | null = null;
  private intervalId: any = null;
  
  // Stats
  public stats = {
    totalTrades: 124,
    wins: 84,
    losses: 40,
    pnl: 3250
  };

  constructor() {
    this.generateInitialHistory();
    this.startLoop();
  }

  private generateInitialHistory() {
    let price = CONFIG.START_PRICE;
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      const open = price;
      const close = price + (Math.random() - 0.5) * 0.4;
      const high = Math.max(open, close) + Math.random() * 0.1;
      const low = Math.min(open, close) - Math.random() * 0.1;
      
      this.candles.push({
        time: new Date(now - (50 - i) * 1000).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'}),
        open, high, low, close,
        volume: Math.floor(Math.random() * 1000)
      });
      price = close;
    }
    this.currentPrice = price;
  }

  private startLoop() {
    let lastCandleTime = Date.now();
    
    this.intervalId = setInterval(() => {
      const now = Date.now();
      
      // 1. Move Price (Random Walk with momentum)
      const change = (Math.random() - 0.5) * CONFIG.VOLATILITY;
      this.currentPrice += change;

      // 2. Manage Candle
      const lastCandleIndex = this.candles.length - 1;
      const lastCandle = this.candles[lastCandleIndex];
      
      // If time to close candle
      if (now - lastCandleTime > CONFIG.CANDLE_PERIOD) {
        lastCandleTime = now;
        this.candles.push({
          time: new Date(now).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'}),
          open: this.currentPrice,
          high: this.currentPrice,
          low: this.currentPrice,
          close: this.currentPrice,
          volume: 0
        });
        if (this.candles.length > 60) this.candles.shift(); // Keep array small
      } else {
        // Update current candle IMMUTABLY (Replace object instead of mutating property)
        // This prevents "Cannot assign to read only property" errors
        this.candles[lastCandleIndex] = {
            ...lastCandle,
            close: this.currentPrice,
            high: Math.max(lastCandle.high, this.currentPrice),
            low: Math.min(lastCandle.low, this.currentPrice),
            volume: lastCandle.volume + Math.random() * 10
        };
      }

      // 3. Trade Logic (Auto-Trade)
      this.processTrades();

      // 4. Notify UI
      this.notify();
    }, CONFIG.TICK_RATE);
  }

  private processTrades() {
    // If no trade, maybe open one?
    if (!this.activeTrade) {
      // Simple random entry logic for demo visual
      if (Math.random() > 0.95) { 
        const direction: SignalDirection = Math.random() > 0.5 ? 'LONG' : 'SHORT';
        const tpDist = 1.5;
        const slDist = 0.8;
        
        this.activeTrade = {
          id: Date.now().toString(),
          pair: 'SOL-PERP',
          direction,
          entryPrice: this.currentPrice,
          takeProfit: direction === 'LONG' ? this.currentPrice + tpDist : this.currentPrice - tpDist,
          stopLoss: direction === 'LONG' ? this.currentPrice - slDist : this.currentPrice + slDist,
          status: 'OPEN',
          pnl: 0,
          entryTime: Date.now()
        };
      }
    } else {
      // Manage existing trade immutably
      const t = this.activeTrade;
      const diff = this.currentPrice - t.entryPrice;
      const newPnl = t.direction === 'LONG' ? diff : -diff;

      // Update active trade with new PNL (create new object)
      this.activeTrade = { ...t, pnl: newPnl };

      // Check Exit
      let closed = false;
      let outcome: 'WIN' | 'LOSS' | null = null;
      const currentTrade = this.activeTrade;

      if (currentTrade.direction === 'LONG') {
        if (this.currentPrice >= currentTrade.takeProfit) { closed = true; outcome = 'WIN'; }
        if (this.currentPrice <= currentTrade.stopLoss) { closed = true; outcome = 'LOSS'; }
      } else {
        if (this.currentPrice <= currentTrade.takeProfit) { closed = true; outcome = 'WIN'; }
        if (this.currentPrice >= currentTrade.stopLoss) { closed = true; outcome = 'LOSS'; }
      }

      if (closed) {
        // Update stats IMMUTABLY
        this.stats = {
            ...this.stats,
            totalTrades: this.stats.totalTrades + 1
        };

        if (outcome === 'WIN') {
          this.stats = {
              ...this.stats,
              wins: this.stats.wins + 1,
              pnl: this.stats.pnl + Math.abs(currentTrade.pnl) * 100
          };
        } else {
          this.stats = {
              ...this.stats,
              losses: this.stats.losses + 1,
              pnl: this.stats.pnl - Math.abs(currentTrade.pnl) * 100
          };
        }
        this.activeTrade = null; // Close it
      }
    }
  }

  // API
  public getData() {
    return {
      // Return a deep copy of candles to prevent React from freezing the simulator's internal state
      candles: this.candles.map(c => ({...c})),
      currentPrice: this.currentPrice,
      activeTrade: this.activeTrade ? {...this.activeTrade} : null,
      stats: {...this.stats}
    };
  }

  public subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

// Singleton
export const marketSimulator = new MarketSimulator();