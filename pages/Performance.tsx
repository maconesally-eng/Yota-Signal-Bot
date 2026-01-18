import React from 'react';
import { Card } from '../components/Common';
import PNLCalendar from '../components/PNLCalendar';
import { MOCK_TRADES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const equityData = [
  { date: 'Jan 1', equity: 10000 },
  { date: 'Jan 8', equity: 11200 },
  { date: 'Jan 15', equity: 10800 },
  { date: 'Jan 22', equity: 12400 },
  { date: 'Jan 29', equity: 13250 },
];

const Performance: React.FC = () => {
  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div>
         <h1 className="text-2xl font-bold text-white mb-2">Performance Analytics</h1>
         <p className="text-text-secondary">Detailed breakdown of your trading performance.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
         {[
           { label: 'Net PNL', value: '+$3,250', color: 'text-success' },
           { label: 'Win Rate', value: '81%', color: 'text-accent-primary' },
           { label: 'Profit Factor', value: '2.45', color: 'text-white' },
           { label: 'Avg Win', value: '$450', color: 'text-success' },
           { label: 'Avg Loss', value: '$180', color: 'text-danger' },
           { label: 'Max Drawdown', value: '-8.5%', color: 'text-warning' },
         ].map((stat, i) => (
           <Card key={i} className="p-4 flex flex-col items-center text-center">
             <span className="text-xs text-text-muted uppercase tracking-wider mb-1">{stat.label}</span>
             <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
           </Card>
         ))}
      </div>

      {/* Calendar Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
          Monthly PNL Calendar
        </h2>
        <PNLCalendar trades={MOCK_TRADES} className="h-full" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card title="Equity Curve">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={2} fill="url(#colorEquity)" />
              </AreaChart>
            </ResponsiveContainer>
         </Card>

         <Card title="Performance by Time of Day">
           <div className="h-[300px] flex items-center justify-center text-text-muted">
             Heatmap visualization coming soon
           </div>
         </Card>
      </div>
    </div>
  );
};

export default Performance;
