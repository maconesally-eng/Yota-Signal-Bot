import React, { useState, useEffect, useMemo } from 'react';
import { Card, Badge } from '../components/Common';
import PNLCalendar from '../components/PNLCalendar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Trophy, Activity, Target, Wifi, WifiOff } from 'lucide-react';
import { tradeService, TradeServiceData } from '../services/tradeService';
import { Trade } from '../types';

const COLORS = ['#22c55e', '#ef4444'];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<TradeServiceData>(tradeService.getData());

  useEffect(() => {
    // Subscribe to real-time updates from tradeService
    const unsubscribe = tradeService.subscribe(() => {
      setData(tradeService.getData());
    });

    // Fetch initial data
    tradeService.fetchStats();
    tradeService.fetchTrades(100);
    tradeService.fetchSignals(10);

    return unsubscribe;
  }, []);

  // Compute PNL data from trades for the chart
  const pnlData = useMemo(() => {
    if (data.trades.length === 0) {
      return [{ date: 'Start', value: 0 }];
    }

    // Sort trades by date and compute cumulative PNL
    const sortedTrades = [...data.trades]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let cumulative = 0;
    const chartData = sortedTrades.map((trade, index) => {
      cumulative += trade.pnl;
      return {
        date: String(index + 1),
        value: Math.round(cumulative * 100) / 100,
      };
    });

    // Ensure we have at least a few data points for the chart
    if (chartData.length === 1) {
      return [{ date: '0', value: 0 }, ...chartData];
    }

    return chartData;
  }, [data.trades]);

  // Compute win/loss ratio for pie chart
  const winRateData = useMemo(() => {
    const { stats } = data;
    if (stats.totalTrades === 0) {
      return [
        { name: 'Wins', value: 50 },
        { name: 'Losses', value: 50 },
      ];
    }
    return [
      { name: 'Wins', value: stats.winRate },
      { name: 'Losses', value: 100 - stats.winRate },
    ];
  }, [data.stats]);

  // Convert trades to format expected by PNLCalendar
  const calendarTrades: Trade[] = useMemo(() => {
    return data.trades.map(trade => ({
      id: trade.id,
      pair: trade.pair,
      direction: trade.direction as 'LONG' | 'SHORT',
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || 0,
      leverage: trade.leverage || 1,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent || 0,
      outcome: trade.outcome as 'WIN' | 'LOSS' | 'BREAKEVEN',
      strategy: trade.strategy as 'Silver Bullet' | 'Order Block' | 'Manual',
      date: trade.date,
      notes: trade.notes,
      checklistGrade: trade.checklistGrade,
    }));
  }, [data.trades]);

  const { stats, signals, connected } = data;

  // Format PNL display
  const formatPnl = (pnl: number) => {
    const prefix = pnl >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate recent change percentage (mock for now based on last trade)
  const recentChange = useMemo(() => {
    if (data.trades.length === 0) return 0;
    const recentPnl = data.trades.slice(0, 5).reduce((sum, t) => sum + t.pnl, 0);
    const totalPnl = stats.totalPnl;
    if (totalPnl === 0) return 0;
    return (recentPnl / Math.abs(totalPnl)) * 100;
  }, [data.trades, stats.totalPnl]);

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Connection Status */}
      <div className="flex justify-end">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
          connected ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
        }`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'Live' : 'Disconnected'}
        </div>
      </div>

      {/* Row 1 Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-secondary text-sm">All Time PNL</p>
              <h2 className={`text-3xl font-bold mt-1 ${stats.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatPnl(stats.totalPnl)}
              </h2>
              <p className={`text-xs mt-2 flex items-center ${recentChange >= 0 ? 'text-success' : 'text-danger'}`}>
                {recentChange >= 0 ? '+' : ''}{recentChange.toFixed(1)}%
                {recentChange >= 0 ? <ArrowUpRight size={12} className="ml-1" /> : <ArrowDownRight size={12} className="ml-1" />}
              </p>
            </div>
            <div className={`p-3 rounded-xl transition-colors ${
              stats.totalPnl >= 0
                ? 'bg-success/10 text-success group-hover:bg-success/20'
                : 'bg-danger/10 text-danger group-hover:bg-danger/20'
            }`}>
              <Activity size={24} />
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-secondary text-sm">Win Rate</p>
              <h2 className="text-3xl font-bold text-accent-primary mt-1">{stats.winRate}%</h2>
              <p className="text-xs text-text-muted mt-2">
                {stats.wins}W / {stats.losses}L ({stats.totalTrades} trades)
              </p>
            </div>
            <div className="p-3 bg-accent-primary/10 rounded-xl text-accent-primary group-hover:bg-accent-primary/20 transition-colors">
              <Trophy size={24} />
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-secondary text-sm">Total Signals</p>
              <h2 className="text-3xl font-bold text-white mt-1">{signals.length + stats.totalTrades}</h2>
              <p className="text-xs text-success mt-2 flex items-center">
                +{Math.min(signals.length, 10)} recent
              </p>
            </div>
            <div className="p-3 bg-navy-800 rounded-xl text-white border border-border group-hover:border-accent-primary transition-colors">
              <Activity size={24} />
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-secondary text-sm">Avg Risk/Reward</p>
              <h2 className="text-3xl font-bold text-warning mt-1">1:{stats.avgRiskReward.toFixed(1)}</h2>
              <p className="text-xs text-text-muted mt-2">
                PF: {stats.profitFactor.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-warning/10 rounded-xl text-warning group-hover:bg-warning/20 transition-colors">
              <Target size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 h-[300px] md:h-96" title="PNL Growth">
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={pnlData}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'PNL']}
              />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorPnl)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="h-[300px] md:h-96" title="Win/Loss Ratio">
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={winRateData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {winRateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success"></div>
              <span className="text-sm text-text-secondary">Wins ({stats.winRate}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-danger"></div>
              <span className="text-sm text-text-secondary">Losses ({100 - stats.winRate}%)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3 PNL Calendar */}
      <div className="w-full">
        <PNLCalendar trades={calendarTrades} />
      </div>

      {/* Row 4 Recent Activity */}
      <div className="grid grid-cols-1 gap-6">
        <Card title="Recent Signals">
          {signals.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              No signals yet. Connect your trading bot to start receiving signals.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Pair</th>
                    <th className="pb-3 font-medium">Direction</th>
                    <th className="pb-3 font-medium">Strategy</th>
                    <th className="pb-3 font-medium">Confidence</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.slice(0, 10).map((signal) => (
                    <tr key={signal.id} className="border-b border-border/50 hover:bg-navy-800/50 transition-colors">
                      <td className="py-4 text-text-secondary">
                        {Math.floor((Date.now() - signal.timestamp) / 60000)} mins ago
                      </td>
                      <td className="py-4 font-mono">{signal.pair}</td>
                      <td className="py-4"><Badge type={signal.direction} /></td>
                      <td className="py-4 text-sm">
                        <span className="bg-accent-primary/10 text-accent-primary px-2 py-1 rounded-full">
                          {signal.strategy}
                        </span>
                      </td>
                      <td className="py-4"><Badge type={signal.confidence} /></td>
                      <td className="py-4">
                        <span className={`text-sm ${
                          signal.status === 'WON' ? 'text-success' :
                          signal.status === 'LOST' ? 'text-danger' : 'text-warning'
                        }`}>
                          {signal.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
