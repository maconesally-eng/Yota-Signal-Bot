import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Activity, AlertTriangle, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';

interface LivePriceButtonProps {
  pair?: string; // e.g. "SOL-PERP"
}

type Source = 'binance' | 'bybit' | 'pyth';
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'disconnected';

interface MarketStats {
  high: string;
  low: string;
  volume: string;
  change: string;
  changePercent: string;
  funding: string;
}

const LivePriceButton: React.FC<LivePriceButtonProps> = ({ pair = 'SOL-PERP' }) => {
  // State
  const [price, setPrice] = useState<number>(0);
  const [prevPrice, setPrevPrice] = useState<number>(0);
  const [stats, setStats] = useState<MarketStats>({
    high: '0.00', low: '0.00', volume: '0M', change: '0.00', changePercent: '0.00', funding: '0.0045%'
  });
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [source, setSource] = useState<Source>('binance');
  const [flash, setFlash] = useState<'green' | 'red' | null>(null);
  const [latency, setLatency] = useState<number>(0);
  
  // Refs for connection management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const failCountRef = useRef<number>(0);

  // Symbol mapping
  const getSymbols = (p: string) => {
    const base = p.split('-')[0];
    return {
      binance: `${base.toLowerCase()}usdt`,
      bybit: `${base.toUpperCase()}USDT`
    };
  };

  const connectBinance = (symbol: string) => {
    if (wsRef.current) wsRef.current.close();
    
    // Connect to combined stream: aggTrade for speed, ticker for stats
    const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${symbol}@aggTrade/${symbol}@ticker`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setSource('binance');
      failCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      lastUpdateRef.current = Date.now();
      
      if (msg.stream.endsWith('@aggTrade')) {
        const p = parseFloat(msg.data.p);
        const tradeTime = msg.data.T;
        setLatency(Math.max(0, Date.now() - tradeTime));
        
        setPrice(prev => {
          if (p > prev) handleFlash('green');
          if (p < prev) handleFlash('red');
          setPrevPrice(prev);
          return p;
        });
      } else if (msg.stream.endsWith('@ticker')) {
        setStats({
          high: parseFloat(msg.data.h).toFixed(2),
          low: parseFloat(msg.data.l).toFixed(2),
          volume: (parseFloat(msg.data.v) / 1000000).toFixed(1) + 'M',
          change: parseFloat(msg.data.p).toFixed(2),
          changePercent: parseFloat(msg.data.P).toFixed(2),
          funding: '0.0045%' // Mock funding as it's separate stream
        });
      }
    };

    ws.onerror = () => handleFailover(symbol);
    ws.onclose = () => handleReconnect(symbol);
  };

  const connectBybit = (symbol: string) => {
    if (wsRef.current) wsRef.current.close();
    
    const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setSource('bybit');
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [`tickers.${symbol}`]
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.topic === `tickers.${symbol}` && msg.data) {
        lastUpdateRef.current = Date.now();
        const data = msg.data;
        
        if (data.lastPrice) {
          const p = parseFloat(data.lastPrice);
          setPrice(prev => {
            if (p > prev) handleFlash('green');
            if (p < prev) handleFlash('red');
            setPrevPrice(prev);
            return p;
          });
        }
        
        if (data.highPrice24h) {
           setStats(prev => ({
             ...prev,
             high: parseFloat(data.highPrice24h).toFixed(2),
             low: parseFloat(data.lowPrice24h).toFixed(2),
             changePercent: (parseFloat(data.price24hPcnt) * 100).toFixed(2)
           }));
        }
      }
    };

    ws.onerror = () => setStatus('disconnected'); // If backup fails
    ws.onclose = () => handleReconnect(symbol);
  };

  const handleFlash = (type: 'green' | 'red') => {
    setFlash(type);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlash(null), 150);
  };

  const handleFailover = (symbol: string) => {
    failCountRef.current++;
    if (failCountRef.current > 3 && source === 'binance') {
      console.warn("Binance failing, switching to Bybit");
      connectBybit(getSymbols(pair).bybit);
    } else {
      setStatus('reconnecting');
      reconnectTimeoutRef.current = window.setTimeout(() => connectBinance(symbol), 2000);
    }
  };

  const handleReconnect = (symbol: string) => {
    if (status !== 'disconnected') {
      setStatus('reconnecting');
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (source === 'binance') connectBinance(symbol);
        else connectBybit(getSymbols(pair).bybit);
      }, 3000);
    }
  };

  // Initial Connection
  useEffect(() => {
    const symbols = getSymbols(pair);
    connectBinance(symbols.binance);

    // Watchdog for stale data
    const watchdog = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 5000 && status === 'connected') {
        setStatus('stale');
      }
    }, 1000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      clearInterval(watchdog);
    };
  }, [pair]);

  const isUp = price >= prevPrice;
  const isPositive = parseFloat(stats.changePercent) >= 0;

  return (
    <div className="relative group z-30">
      {/* Main Button Container */}
      <div 
        className={`
          inline-flex items-center justify-between
          bg-gradient-to-r from-[#1e293b] to-[#111827]
          border border-gray-700 
          rounded-[12px] /* Explicitly requested radius */
          py-3 px-5 min-w-[240px]
          shadow-[0_4px_12px_rgba(0,0,0,0.3)]
          cursor-default transition-all duration-200
          hover:shadow-[0_6px_16px_rgba(0,0,0,0.4)] hover:border-gray-600
          ${flash === 'green' ? 'animate-price-green' : ''}
          ${flash === 'red' ? 'animate-price-red' : ''}
        `}
      >
        {/* Left Section: Dot & Label */}
        <div className="flex flex-col mr-4">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="relative flex h-2.5 w-2.5">
              {status === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                status === 'connected' ? 'bg-success' : 
                status === 'reconnecting' ? 'bg-warning animate-pulse' : 
                status === 'stale' ? 'bg-warning' : 'bg-danger'
              }`}></span>
            </div>
            <span className="text-sm font-medium text-text-secondary">{pair}</span>
          </div>
          <span className="text-[10px] text-text-muted pl-4.5 flex items-center gap-1">
            via {source.charAt(0).toUpperCase() + source.slice(1)}
            {latency > 0 && ` • ${latency}ms`}
          </span>
        </div>

        {/* Right Section: Price & Change */}
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight transition-colors duration-150 ${
            flash === 'green' ? 'text-success' : flash === 'red' ? 'text-danger' : 'text-white'
          }`}>
            ${price.toFixed(2)}
          </div>

          <div className="flex flex-col items-end leading-none">
            {isUp ? 
              <ArrowUp size={18} className="text-success transition-transform duration-300" /> : 
              <ArrowDown size={18} className="text-danger transition-transform duration-300" />
            }
            <span className={`text-xs font-bold mt-1 ${isPositive ? 'text-success' : 'text-danger'}`}>
              {isPositive ? '+' : ''}{stats.changePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Tooltip on Hover */}
      <div className="absolute top-full left-0 mt-2 w-72 bg-[#0d1421] border border-border rounded-lg shadow-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
           <h4 className="text-white font-bold text-sm">Market Statistics</h4>
           <div className="flex gap-1">
              <span className={`h-2 w-2 rounded-full ${source === 'binance' ? 'bg-success' : 'bg-navy-600'}`}></span>
              <span className={`h-2 w-2 rounded-full ${source === 'bybit' ? 'bg-success' : 'bg-navy-600'}`}></span>
           </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
             <span className="text-text-muted">24h High</span>
             <span className="text-white font-mono">${stats.high}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-text-muted">24h Low</span>
             <span className="text-white font-mono">${stats.low}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-text-muted">24h Change</span>
             <span className={`${parseFloat(stats.change) >= 0 ? 'text-success' : 'text-danger'} font-mono`}>
               {stats.change} ({stats.changePercent}%)
             </span>
          </div>
          <div className="flex justify-between">
             <span className="text-text-muted">24h Volume</span>
             <span className="text-white font-mono">${stats.volume}</span>
          </div>
           <div className="flex justify-between">
             <span className="text-text-muted">Funding Rate</span>
             <span className="text-warning font-mono">{stats.funding}</span>
          </div>
          
          <div className="pt-2 mt-2 border-t border-border flex justify-between items-center text-[10px] text-text-muted">
             <div className="flex items-center gap-1">
               {status === 'connected' ? <Wifi size={10} className="text-success" /> : <WifiOff size={10} className="text-danger" />}
               {status.charAt(0).toUpperCase() + status.slice(1)}
             </div>
             <div className="flex items-center gap-1">
               <Server size={10} /> {source.charAt(0).toUpperCase() + source.slice(1)} Futures
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePriceButton;
