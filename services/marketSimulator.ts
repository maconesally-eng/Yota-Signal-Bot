import { Candle, LiveTrade, SignalDirection } from '../types';
import { tradeService } from './tradeService';

// Connection status for live price feed
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

type Listener = () => void;

class MarketSimulator {
  private candles: Candle[] = [];
  private currentPrice: number = 0;
  private listeners: Listener[] = [];
  private activeTrade: LiveTrade | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private connectionStatus: ConnectionStatus = 'connecting';
  private lastUpdateTime: number = 0;
  private pair: string = 'SOL-PERP';

  // Stats - Initialized from DB
  public stats = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    pnl: 0
  };

  private isInitialized = false;

  constructor() {
    this.connectWebSocket();
    this.startWatchdog();
  }

  // Initialize stats from backend
  public async initialize() {
    if (this.isInitialized) return;

    try {
      const { stats } = await tradeService.fetchStats();
      this.stats = {
        totalTrades: stats.totalTrades,
        wins: stats.wins,
        losses: stats.losses,
        pnl: stats.totalPnl
      };
      this.isInitialized = true;
      this.notify();
    } catch (error) {
      console.error("MarketSimulator: Failed to initialize stats", error);
    }
  }

  // Connect to Binance Futures WebSocket
  private connectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    this.connectionStatus = 'connecting';
    const symbol = 'solusdt'; // SOL-PERP -> solusdt

    try {
      this.ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${symbol}@aggTrade/${symbol}@kline_1s`);

      this.ws.onopen = () => {
        console.log('MarketSimulator: WebSocket connected to Binance');
        this.connectionStatus = 'connected';
        // Seed an initial placeholder candle so UI doesn't show empty
        if (this.candles.length === 0) {
          const now = Date.now();
          this.candles.push({
            time: new Date(now).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0
          });
        }
        this.notify();
      };

      this.ws.onmessage = (event) => {
        this.lastUpdateTime = Date.now();
        const msg = JSON.parse(event.data);

        if (msg.stream?.endsWith('@aggTrade')) {
          // Live price update
          const price = parseFloat(msg.data.p);
          this.currentPrice = price;
          this.updateActiveTradePnL();
          this.notify();
        } else if (msg.stream?.endsWith('@kline_1s')) {
          // Candle update from 1-second kline stream
          const k = msg.data.k;
          const candle: Candle = {
            time: new Date(k.t).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v)
          };

          // Always update current price from kline close
          if (this.currentPrice === 0) {
            this.currentPrice = candle.close;
          }

          this.updateCandle(candle, k.x); // k.x = is candle closed
          this.notify();
        }
      };

      this.ws.onerror = (error) => {
        console.error('MarketSimulator: WebSocket error', error);
        this.handleReconnect();
      };

      this.ws.onclose = () => {
        console.log('MarketSimulator: WebSocket closed');
        this.handleReconnect();
      };
    } catch (error) {
      console.error('MarketSimulator: Failed to create WebSocket', error);
      this.connectionStatus = 'disconnected';
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.connectionStatus = 'reconnecting';
    this.notify();

    // Clear active trade on disconnect - no simulated trading
    if (this.activeTrade) {
      console.warn('MarketSimulator: Closing active trade due to disconnect');
      this.activeTrade = null;
    }

    this.reconnectTimeout = window.setTimeout(() => {
      console.log('MarketSimulator: Attempting reconnect...');
      this.connectWebSocket();
    }, 3000);
  }

  // Watchdog to detect stale data
  private startWatchdog() {
    setInterval(() => {
      if (this.connectionStatus === 'connected' && Date.now() - this.lastUpdateTime > 5000) {
        console.warn('MarketSimulator: Data stale, reconnecting...');
        this.handleReconnect();
      }
    }, 2000);
  }

  // Update candle data
  private updateCandle(candle: Candle, isClosed: boolean) {
    // If this is the first real candle, replace the placeholder
    if (this.candles.length === 1 && this.candles[0].open === 0) {
      this.candles[0] = candle;
      return;
    }

    if (isClosed) {
      // Push new candle when current one closes
      this.candles.push(candle);
      if (this.candles.length > 60) this.candles.shift();
    } else {
      // Update current (last) candle in place
      if (this.candles.length > 0) {
        this.candles[this.candles.length - 1] = candle;
      } else {
        this.candles.push(candle);
      }
    }
  }

  // Update PnL for active trade based on current price
  private updateActiveTradePnL() {
    if (!this.activeTrade || this.connectionStatus !== 'connected') return;

    const t = this.activeTrade;
    const diff = this.currentPrice - t.entryPrice;
    const newPnl = t.direction === 'LONG' ? diff : -diff;

    this.activeTrade = { ...t, pnl: newPnl };

    // Check exit conditions
    this.checkTradeExit();
  }

  // Check if trade should be closed
  private async checkTradeExit() {
    if (!this.activeTrade || this.connectionStatus !== 'connected') return;

    const t = this.activeTrade;
    let closed = false;
    let outcome: 'WIN' | 'LOSS' | null = null;

    if (t.direction === 'LONG') {
      if (this.currentPrice >= t.takeProfit) { closed = true; outcome = 'WIN'; }
      if (this.currentPrice <= t.stopLoss) { closed = true; outcome = 'LOSS'; }
    } else {
      if (this.currentPrice <= t.takeProfit) { closed = true; outcome = 'WIN'; }
      if (this.currentPrice >= t.stopLoss) { closed = true; outcome = 'LOSS'; }
    }

    if (closed && outcome) {
      const finalPnl = outcome === 'WIN'
        ? Math.abs(t.takeProfit - t.entryPrice)
        : -Math.abs(t.stopLoss - t.entryPrice);

      // Close locally
      this.activeTrade = null;

      // Submit Close to Backend DB
      try {
        await tradeService.updateTrade(t.id, {
          exitPrice: this.currentPrice,
          outcome: outcome,
          pnl: parseFloat((finalPnl * 100).toFixed(2)),
          pnlPercent: parseFloat((Math.abs(finalPnl / t.entryPrice) * 100 * 5).toFixed(2))
        });

        // Re-fetch stats
        const { stats } = await tradeService.fetchStats();
        this.stats = {
          totalTrades: stats.totalTrades,
          wins: stats.wins,
          losses: stats.losses,
          pnl: stats.totalPnl
        };
      } catch (e) {
        console.error("Failed to update closed trade in DB", e);
      }
    }
  }

  // Manual trade entry (called from UI or signal)
  public async openTrade(direction: SignalDirection, stopLoss: number, takeProfit: number) {
    // HALT if not connected - no trading without live data
    if (this.connectionStatus !== 'connected' || this.currentPrice === 0) {
      console.error('MarketSimulator: Cannot open trade - not connected to live data');
      return null;
    }

    if (this.activeTrade) {
      console.warn('MarketSimulator: Already have an active trade');
      return null;
    }

    const localId = Date.now().toString();
    this.activeTrade = {
      id: localId,
      pair: this.pair,
      direction,
      entryPrice: this.currentPrice,
      takeProfit,
      stopLoss,
      status: 'OPEN',
      pnl: 0,
      entryTime: Date.now()
    };

    // Submit to Backend DB
    try {
      const dbTrade = await tradeService.submitTrade({
        pair: this.pair,
        direction,
        entryPrice: this.currentPrice,
        stopLoss,
        takeProfit,
        leverage: 5,
        strategy: 'Silver Bullet',
        outcome: 'OPEN'
      });

      if (dbTrade && this.activeTrade?.id === localId) {
        this.activeTrade = { ...this.activeTrade, id: dbTrade.id };
      }

      return this.activeTrade;
    } catch (e) {
      console.error("Failed to submit trade to DB", e);
      this.activeTrade = null;
      return null;
    }
  }

  // API
  public getData() {
    return {
      candles: this.candles.map(c => ({ ...c })),
      currentPrice: this.currentPrice,
      activeTrade: this.activeTrade ? { ...this.activeTrade } : null,
      stats: { ...this.stats },
      connectionStatus: this.connectionStatus
    };
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public subscribe(listener: Listener) {
    this.listeners.push(listener);
    if (!this.isInitialized) {
      this.initialize();
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  // =========================================================================
  // Price Feed API (for LivePriceButton and other consumers)
  // =========================================================================

  /** Get the latest price (0 if not connected) */
  public getLatestPrice(): number {
    return this.currentPrice;
  }

  /** Get the last update timestamp */
  public getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }

  /** Subscribe to price changes only (returns unsubscribe function) */
  public subscribePrice(callback: (price: number, status: ConnectionStatus) => void): () => void {
    const listener = () => {
      callback(this.currentPrice, this.connectionStatus);
    };
    this.listeners.push(listener);
    // Immediately call with current state
    callback(this.currentPrice, this.connectionStatus);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** Get current pair symbol */
  public getPair(): string {
    return this.pair;
  }
}

// Singleton
export const marketSimulator = new MarketSimulator();

// Re-export types for consumers
export type { ConnectionStatus };