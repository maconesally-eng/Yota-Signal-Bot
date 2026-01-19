import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Wifi, WifiOff, Server } from 'lucide-react';
import { marketSimulator, ConnectionStatus } from '../services/marketSimulator';

interface LivePriceButtonProps {
  pair?: string; // e.g. "SOL-PERP"
}

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
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [flash, setFlash] = useState<'green' | 'red' | null>(null);
  const [latency, setLatency] = useState<number>(0);

  // Stats (simplified - no longer fetching separately)
  const [stats] = useState<MarketStats>({
    high: '0.00', low: '0.00', volume: '0M', change: '0.00', changePercent: '0.00', funding: '0.0045%'
  });

  // Flash timeout ref
  const flashTimeoutRef = useRef<number | null>(null);

  const handleFlash = (type: 'green' | 'red') => {
    setFlash(type);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlash(null), 150);
  };

  // Subscribe to shared price feed from marketSimulator
  useEffect(() => {
    const unsubscribe = marketSimulator.subscribePrice((newPrice, connectionStatus) => {
      setStatus(connectionStatus);

      if (newPrice === 0) return;

      // Calculate latency from last update
      const lastUpdate = marketSimulator.getLastUpdateTime();
      if (lastUpdate > 0) {
        setLatency(Math.max(0, Date.now() - lastUpdate));
      }

      setPrice(prev => {
        if (newPrice > prev) handleFlash('green');
        if (newPrice < prev) handleFlash('red');
        setPrevPrice(prev);
        return newPrice;
      });
    });

    return () => {
      unsubscribe();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [pair]);

  const isUp = price >= prevPrice;
  const isPositive = price > 0;

  return (
    <div className="relative group z-30">
      {/* Main Button Container */}
      <div
        className={`
          inline-flex items-center justify-between
          bg-gradient-to-r from-[#1e293b] to-[#111827]
          border border-gray-700 
          rounded-[12px]
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
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status === 'connected' ? 'bg-success' :
                  status === 'reconnecting' ? 'bg-warning animate-pulse' :
                    status === 'connecting' ? 'bg-warning' : 'bg-danger'
                }`}></span>
            </div>
            <span className="text-sm font-medium text-text-secondary">{pair}</span>
          </div>
          <span className="text-[10px] text-text-muted pl-4.5 flex items-center gap-1">
            via Binance
            {latency > 0 && status === 'connected' && ` • ${latency}ms`}
          </span>
        </div>

        {/* Right Section: Price & Change */}
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight transition-colors duration-150 ${flash === 'green' ? 'text-success' : flash === 'red' ? 'text-danger' : 'text-white'
            }`}>
            ${price.toFixed(2)}
          </div>

          <div className="flex flex-col items-end leading-none">
            {isUp ?
              <ArrowUp size={18} className="text-success transition-transform duration-300" /> :
              <ArrowDown size={18} className="text-danger transition-transform duration-300" />
            }
          </div>
        </div>
      </div>

      {/* Expanded Tooltip on Hover */}
      <div className="absolute top-full left-0 mt-2 w-72 bg-[#0d1421] border border-border rounded-lg shadow-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
          <h4 className="text-white font-bold text-sm">Connection Status</h4>
          <div className="flex gap-1">
            <span className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-success' : 'bg-danger'}`}></span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Status</span>
            <span className={`${status === 'connected' ? 'text-success' : 'text-warning'} font-mono`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Source</span>
            <span className="text-white font-mono">Binance Futures</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Latency</span>
            <span className="text-white font-mono">{latency}ms</span>
          </div>

          <div className="pt-2 mt-2 border-t border-border flex justify-between items-center text-[10px] text-text-muted">
            <div className="flex items-center gap-1">
              {status === 'connected' ? <Wifi size={10} className="text-success" /> : <WifiOff size={10} className="text-danger" />}
              Shared Feed
            </div>
            <div className="flex items-center gap-1">
              <Server size={10} /> marketSimulator
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePriceButton;
