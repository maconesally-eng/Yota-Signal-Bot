import React, { useState, useEffect, useRef } from 'react';
import { Card, Badge } from '../components/Common';
import { fetchMarketNewsAnalysis, generateAgentInsight } from '../services/geminiService';
import { memoryService } from '../services/memoryService';
import { marketSimulator } from '../services/marketSimulator';
import { AgentMemory, Candle, LiveTrade } from '../types';
import LivePriceButton from '../components/LivePriceButton';
import { Brain, Zap, Clock, TrendingUp, Maximize2, ChevronDown, Bot, MessageSquare, Database, ArrowUpCircle, Target, Activity } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, ReferenceLine, Bar, Cell } from 'recharts';

// --- CUSTOM CANDLE SHAPE ---
const CustomCandle = (props: any) => {
  const { x, y, width, height, low, high, open, close } = props;
  const isGreen = close > open;
  const color = isGreen ? '#22c55e' : '#ef4444';
  const bodyHeight = Math.abs(open - close);
  // Scale factor for wicks (simple approximation based on pixel space)
  const yRatio = height / (high - low); 
  
  // Calculate pixel positions
  // Recharts passes 'y' as the top of the bar (the higher value of open/close)
  // We need to calculate wick positions manually or rely on data being passed correctly
  // Simplification: We use the 'payload' data
  const { payload } = props;
  
  // Need the YAxis scale to convert raw values to pixels. 
  // Custom shapes in Recharts are tricky without access to the scale function.
  // Instead, we will use a workaround: ErrorBar for wicks, Bar for body.
  return <path />; // Fallback if using Composition approach below
};

const YotaAvatar = ({ status, level, isTrading }: { status: string, level: number, isTrading: boolean }) => (
  <div className="relative group cursor-pointer">
    <div className={`
        w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
        bg-gradient-to-br from-accent-primary to-accent-secondary
        ${isTrading ? 'animate-pulse-fast shadow-[0_0_30px_rgba(139,92,246,0.8)] scale-110' : 'shadow-[0_0_15px_rgba(139,92,246,0.5)]'}
    `}>
       <Bot size={36} className={`text-white ${isTrading ? 'animate-bounce' : ''}`} />
    </div>
    
    {/* Status Indicator Dot */}
    <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-4 border-navy-800 rounded-full flex items-center justify-center text-[10px] font-bold text-navy-900 ${status === 'Scanning' ? 'bg-warning' : 'bg-success'}`}>
      {status === 'Scanning' ? '!' : '✓'}
    </div>
    
    {/* Level Badge */}
    <div className="absolute -top-2 -right-2 bg-navy-900 border border-accent-primary text-accent-primary text-[10px] font-bold px-1.5 rounded-md">
      Lvl {level}
    </div>
  </div>
);

const XPBar = ({ current, max }: { current: number, max: number }) => {
  const percentage = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">
        <span>Experience</span>
        <span>{current} / {max} XP</span>
      </div>
      <div className="h-1.5 w-full bg-navy-900 rounded-full overflow-hidden border border-border/50">
        <div 
          className="h-full bg-gradient-to-r from-accent-primary to-success transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(139,92,246,0.5)]"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const SignalBot: React.FC = () => {
  const [data, setData] = useState<{ candles: Candle[], activeTrade: LiveTrade | null, stats: any }>(marketSimulator.getData());
  const [news, setNews] = useState<{ headline: string; sentiment: string; source: string }[]>([]);
  const [agentStatus, setAgentStatus] = useState("Scanning");
  
  // Memory State
  const [memory, setMemory] = useState<AgentMemory>(memoryService.getMemory());
  const lessonsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to Market Engine
  useEffect(() => {
    const unsubscribe = marketSimulator.subscribe(() => {
      setData(marketSimulator.getData());
    });
    return unsubscribe;
  }, []);

  // Scroll to bottom of lessons
  useEffect(() => {
    if (lessonsEndRef.current) {
      lessonsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [memory.lessons]);

  // AI Logic Loop
  useEffect(() => {
    const initAI = async () => {
      const newsData = await fetchMarketNewsAnalysis("Solana");
      setNews(newsData);

      // Periodically trigger a "Learning" moment
      const learningInterval = setInterval(async () => {
        setAgentStatus("Optimizing");
        const candles = marketSimulator.getData().candles;
        if (candles.length < 2) return;
        
        const start = candles[0].close;
        const end = candles[candles.length-1].close;
        const trend = end > start ? 'UP' : end < start ? 'DOWN' : 'CHOPPY';
        
        const insight = await generateAgentInsight(trend, memory.lessons);
        const newMemory = memoryService.addLesson(insight, trend);
        const { memory: finalMem } = memoryService.addExperience(25);
        
        setMemory({...finalMem});
        setAgentStatus("Scanning");
      }, 15000); // Learn every 15 seconds for demo

      return () => clearInterval(learningInterval);
    };

    initAI();
  }, [memory.lessons]); 

  // Derived Values for Chart Scaling
  const minPrice = Math.min(...data.candles.map(c => c.low)) - 0.5;
  const maxPrice = Math.max(...data.candles.map(c => c.high)) + 0.5;

  return (
    <div className="p-4 md:p-6 space-y-6">
      
      {/* Header with Persona */}
      <div className="flex items-center gap-6 mb-2">
         <YotaAvatar status={agentStatus} level={memory.level} isTrading={!!data.activeTrade} />
         <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
               <h1 className="text-3xl font-bold text-white tracking-tight">Yota Agent <span className="text-text-muted text-lg font-mono ml-2 opacity-60">{memory.brainVersion}</span></h1>
               
               {data.activeTrade && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/50 animate-pulse">
                     <Activity size={16} /> LIVE TRADE ACTIVE
                  </span>
               )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
               <div>
                  <div className="text-[10px] text-text-muted uppercase font-bold">Total PNL</div>
                  <div className={`text-lg font-mono font-bold ${data.stats.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                     {data.stats.pnl >= 0 ? '+' : ''}${data.stats.pnl}
                  </div>
               </div>
               <div>
                  <div className="text-[10px] text-text-muted uppercase font-bold">Win Rate</div>
                  <div className="text-lg font-mono font-bold text-white">
                     {Math.round((data.stats.wins / data.stats.totalTrades) * 100)}%
                  </div>
               </div>
               <div className="hidden md:block">
                   <div className="text-[10px] text-text-muted uppercase font-bold">Status</div>
                   <div className="text-sm text-text-secondary flex items-center gap-1 mt-0.5">
                     <span className={`w-1.5 h-1.5 rounded-full ${agentStatus === 'Scanning' ? 'bg-success' : 'bg-warning animate-ping'}`}></span>
                     {agentStatus}
                   </div>
               </div>
            </div>
         </div>
      </div>

      {/* Main Chart Section */}
      <Card className="h-[550px] md:h-[700px] flex flex-col p-0 overflow-hidden border-accent-primary/20 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
         {/* Chart Toolbar */}
         <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-border bg-navy-800/50 backdrop-blur-sm z-10">
             <div className="flex items-center gap-4 w-full md:w-auto">
                 <LivePriceButton pair="SOL-PERP" />
                 <div className="h-8 w-px bg-border hidden md:block"></div>
                 <div className="hidden md:flex flex-col">
                    <span className="text-[10px] text-text-muted uppercase">Strategy</span>
                    <span className="text-xs font-bold text-white">Silver Bullet (M1)</span>
                 </div>
             </div>
             
             <div className="flex gap-2 mt-3 md:mt-0">
                 {['1m', '5m', '15m', '1H'].map(tf => (
                    <button key={tf} className={`px-3 py-1.5 rounded text-xs font-bold ${tf === '1m' ? 'bg-navy-700 text-white border border-accent-primary' : 'text-text-muted hover:text-white'}`}>
                      {tf}
                    </button>
                 ))}
             </div>
         </div>

         {/* Chart Area */}
         <div className="flex-1 relative bg-[#0a0f1a] cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.candles} margin={{ top: 20, right: 60, bottom: 5, left: 0 }}>
                <defs>
                   <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis 
                   domain={[minPrice, maxPrice]} 
                   orientation="right" 
                   stroke="#334155" 
                   tick={{fontSize: 11, fill: '#64748b'}} 
                   tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px' }} 
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ display: 'none' }}
                  formatter={(value: number, name: string) => [value.toFixed(2), name === 'close' ? 'Price' : name]}
                />
                
                {/* Wicks (High-Low) using ErrorBar logic simulated with Range Bar or custom implementation. 
                    Simplified: We use bars for Body and standard lines isn't easy in Recharts without custom shape.
                    Given constraints, we will use a Bar for the body (Open-Close) and assume wicks are too fine for this quick demo or use a Line for price trail.
                */}
                
                {/* Visualizing Candles as Bars:
                    We need to transform data: 
                    [min(open, close), max(open, close)] for Bar y-axis range? 
                    Recharts standard Bar doesn't support floating bars easily without [start, end].
                    
                    ALTERNATIVE: Use Composed Chart with a Line for "Close" to show trend, and ReferenceAreas for trades.
                    USER ASKED FOR CANDLES.
                    
                    We will implement a clean "Price Line" + "Range Area" to simulate structure, 
                    OR render custom SVG rectangles.
                */}
                <Bar 
                    dataKey="volume" 
                    yAxisId="vol" 
                    fill="#1e293b" 
                    opacity={0.3} 
                    barSize={4}
                />
                
                {/* We use a thick Line to represent the path, and customized dots to look like candles if zoomed out. 
                    Actually, let's stick to a fast Line for the 'High Frequency' look, but color it.
                */}
                <Bar 
                   dataKey="high" 
                   fill="transparent" 
                   stroke="none"
                   // This is a dummy bar to set the scale range correctly
                />

                {/* Live Trade Lines */}
                {data.activeTrade && (
                  <>
                    <ReferenceLine 
                        y={data.activeTrade.entryPrice} 
                        stroke="#3b82f6" 
                        strokeDasharray="3 3" 
                        strokeWidth={2}
                        label={{ position: 'right', value: 'ENTRY', fill: '#3b82f6', fontSize: 10 }} 
                    />
                    <ReferenceLine 
                        y={data.activeTrade.stopLoss} 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        label={{ position: 'right', value: 'STOP', fill: '#ef4444', fontSize: 10 }} 
                    />
                    <ReferenceLine 
                        y={data.activeTrade.takeProfit} 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        label={{ position: 'right', value: 'TP', fill: '#22c55e', fontSize: 10 }} 
                    />
                    {/* Fill Area between Entry and Price */}
                    <ReferenceLine segment={[{ x: data.activeTrade.entryTime, y: data.activeTrade.entryPrice }, { x: data.candles[data.candles.length-1].time, y: data.activeTrade.entryPrice }]} />
                  </>
                )}

                {/* Custom Candle Implementation via Custom Shape in Bar? 
                    For this XML output, creating a complex custom SVG shape within Recharts is risky for syntax.
                    We will fallback to a very nice "Area + Line" that looks like a high-freq algo chart.
                */}
                <ReferenceLine y={data.candles[0].open} stroke="#334155" strokeDasharray="3 3" opacity={0.5} />
                
                {/* The "Candle" Body as floating bars */}
                <Bar dataKey="close" shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    // Mock calculating candle height based on open/close within the pixel space
                    // This is hard without scale.
                    // Fallback to simple Line for robustness in this prompt response.
                    return <rect x={x} y={y} width={width} height={height} fill="transparent" />;
                }} />
                
                {/* Main Price Line */}
                <path d="" fill="transparent" /> {/* Spacer */}
              </ComposedChart>
              
              {/* Overlay SVG for actual Candles (Manual render for performance/control) */}
              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" preserveAspectRatio="none">
                 {/* 
                     Since we can't easily sync SVG coords with Recharts without refs, 
                     we will use a secondary Recharts Line with specific styling to look like a "Tick Chart"
                 */}
              </svg>
            </ResponsiveContainer>

            {/* A second chart layer just for the Line to ensure it renders */}
            <div className="absolute inset-0 pointer-events-none">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.candles} margin={{ top: 20, right: 60, bottom: 5, left: 0 }}>
                        <YAxis domain={[minPrice, maxPrice]} orientation="right" hide />
                        <XAxis dataKey="time" hide />
                        <ReferenceLine y={data.activeTrade?.entryPrice} stroke="#3b82f6" strokeDasharray="5 5" opacity={data.activeTrade ? 1 : 0} />
                        {/* The Price Line */}
                        <Cell />
                        {/* We define the line here */}
                         <ReferenceLine y={0} /> {/* dummy */}
                         {/* Actual data plotting */}
                         {data.candles.map((c, i) => {
                             // This is expensive to render manually in JSX loop for SVG. 
                             // We revert to standard LineChart but styled heavily.
                             return null;
                         })}
                    </ComposedChart>
                 </ResponsiveContainer>
            </div>
            
            {/* The Actual Visible Chart (Third time's the charm for simplified code structure) */}
            <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.candles} margin={{ top: 20, right: 60, bottom: 5, left: 0 }}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[minPrice, maxPrice]} orientation="right" hide />
                        
                        {/* High-Low Wicks (using Error Bar logic conceptually, visually represented by area) */}
                        <Bar dataKey="volume" yAxisId="right" fill="#334155" opacity={0.1} barSize={20} />
                        
                        {/* The Price Action - Using Area for "Living" feel */}
                        <ReferenceLine y={data.activeTrade?.takeProfit} stroke="#22c55e" strokeDasharray="3 3" />
                        <ReferenceLine y={data.activeTrade?.stopLoss} stroke="#ef4444" strokeDasharray="3 3" />
                        
                        {/* Custom dot to represent candles? No, standard Line is cleaner for "Live" look */}
                        <ReferenceLine />
                    </ComposedChart>
                </ResponsiveContainer>
                
                {/* Custom Rendering of "Candles" using HTML/CSS Bars for absolute speed/control */}
                <div className="absolute inset-y-0 left-0 right-[60px] top-[20px] bottom-[5px] flex items-end justify-around px-2">
                   {data.candles.map((c, i) => {
                       const range = maxPrice - minPrice;
                       const heightPct = ((c.high - c.low) / range) * 100;
                       const bottomPct = ((c.low - minPrice) / range) * 100;
                       const isGreen = c.close >= c.open;
                       const bodyTop = Math.max(c.open, c.close);
                       const bodyBottom = Math.min(c.open, c.close);
                       const bodyHeightPct = Math.max(((bodyTop - bodyBottom) / range) * 100, 0.5); // Min 0.5% height
                       const bodyBottomPct = ((bodyBottom - minPrice) / range) * 100;

                       return (
                           <div key={i} className="relative w-1.5 md:w-2.5 h-full mx-[1px] group">
                               {/* Wick */}
                               <div 
                                 className={`absolute w-[1px] left-1/2 -translate-x-1/2 ${isGreen ? 'bg-success' : 'bg-danger'}`}
                                 style={{ height: `${heightPct}%`, bottom: `${bottomPct}%`, opacity: 0.6 }}
                               ></div>
                               {/* Body */}
                               <div 
                                 className={`absolute w-full rounded-[1px] ${isGreen ? 'bg-success' : 'bg-danger'}`}
                                 style={{ height: `${bodyHeightPct}%`, bottom: `${bodyBottomPct}%` }}
                               ></div>
                               {/* Tooltip on hover */}
                               <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 bg-navy-900 text-[10px] p-1 rounded border border-border z-20 whitespace-nowrap mb-1">
                                  O:{c.open.toFixed(2)} C:{c.close.toFixed(2)}
                               </div>
                           </div>
                       );
                   })}
                   
                   {/* Current Price Line Indicator */}
                   <div 
                      className="absolute w-full border-t border-accent-primary border-dashed flex items-center justify-end opacity-50 pointer-events-none"
                      style={{ bottom: `${((data.candles[data.candles.length-1].close - minPrice) / (maxPrice - minPrice)) * 100}%` }}
                   >
                      <div className="bg-accent-primary text-white text-[10px] px-1">
                         {data.candles[data.candles.length-1].close.toFixed(2)}
                      </div>
                   </div>
                </div>
            </div>
         </div>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Signals & News */}
        <div className="space-y-6">
           {/* Active Signal Panel */}
           <Card title="Live Trading Terminal">
             {data.activeTrade ? (
                 <div className="bg-navy-800 rounded-xl border border-accent-primary/50 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-accent-primary animate-pulse"></div>
                    <div className="p-4 border-b border-border/50 flex justify-between items-center bg-accent-primary/5">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-accent-primary text-white flex items-center justify-center animate-spin-slow">
                              <Target size={18} />
                           </div>
                           <div>
                              <h4 className="font-bold text-sm text-white">EXECUTING STRATEGY</h4>
                              <span className="text-xs text-accent-primary font-mono">ID: {data.activeTrade.id.slice(-6)}</span>
                           </div>
                        </div>
                        <Badge type={data.activeTrade.direction} />
                    </div>
                    
                    <div className="p-4 grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <span className="text-xs text-text-secondary">Current PNL</span>
                          <div className={`text-2xl font-mono font-bold ${data.activeTrade.pnl > 0 ? 'text-success' : data.activeTrade.pnl < 0 ? 'text-danger' : 'text-white'}`}>
                             {data.activeTrade.pnl > 0 ? '+' : ''}{data.activeTrade.pnl.toFixed(2)}
                          </div>
                       </div>
                       <div className="space-y-1 text-right">
                          <span className="text-xs text-text-secondary">Entry Price</span>
                          <div className="text-xl font-mono text-white">{data.activeTrade.entryPrice.toFixed(2)}</div>
                       </div>
                    </div>

                    <div className="bg-navy-900 p-3 grid grid-cols-3 gap-2 text-center border-t border-border">
                         <div>
                            <span className="text-[10px] text-text-muted">TP</span>
                            <div className="text-success font-bold font-mono">{data.activeTrade.takeProfit.toFixed(2)}</div>
                         </div>
                         <div className="border-l border-r border-border">
                            <span className="text-[10px] text-text-muted">Distance</span>
                            <div className="text-white font-bold font-mono">{(Math.abs(data.activeTrade.entryPrice - data.candles[data.candles.length-1].close)).toFixed(2)}</div>
                         </div>
                         <div>
                            <span className="text-[10px] text-text-muted">SL</span>
                            <div className="text-danger font-bold font-mono">{data.activeTrade.stopLoss.toFixed(2)}</div>
                         </div>
                    </div>
                 </div>
             ) : (
                 <div className="bg-navy-800 rounded-xl border border-border p-8 text-center flex flex-col items-center justify-center min-h-[200px] opacity-70">
                    <div className="w-12 h-12 rounded-full bg-navy-700 flex items-center justify-center mb-3">
                        <Clock className="text-text-muted animate-pulse" />
                    </div>
                    <h3 className="text-white font-bold">Scanning for Setups...</h3>
                    <p className="text-sm text-text-secondary mt-2 max-w-xs">
                        Yota is analyzing order flow and volume displacement. No valid entry trigger found yet.
                    </p>
                 </div>
             )}
           </Card>
           
           {/* Market News */}
           <Card title="Market Context">
             <div className="space-y-3">
                {news.map((item, i) => (
                    <div key={i} className="p-3 bg-navy-900 rounded border border-border flex justify-between items-start gap-4">
                       <div>
                          <p className="text-sm text-white leading-tight mb-1">{item.headline}</p>
                          <span className="text-[10px] text-text-muted">{item.source}</span>
                       </div>
                       <Badge type={item.sentiment} />
                    </div>
                ))}
             </div>
           </Card>
        </div>

        {/* Right: AI Brain (The Memory Core) */}
        <div className="space-y-6">
          <Card className={`relative overflow-hidden border-accent-primary/30 h-full flex flex-col transition-colors duration-500 ${data.activeTrade ? 'bg-navy-800/80 border-accent-primary/60' : ''}`}>
             
             {/* Pulsating Brain Background */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 opacity-10 pointer-events-none">
                <Brain 
                  size={240} 
                  className={`transition-all duration-300 ${data.activeTrade ? 'text-accent-primary animate-pulse' : 'text-text-muted'}`} 
                />
             </div>
             
             {/* Neural Connection Lines (Decor) */}
             {data.activeTrade && (
                 <>
                    <div className="absolute top-10 left-0 w-full h-[1px] bg-accent-primary/20 animate-pulse"></div>
                    <div className="absolute bottom-10 left-0 w-full h-[1px] bg-accent-primary/20 animate-pulse" style={{animationDelay: '0.5s'}}></div>
                 </>
             )}

             <div className="flex items-center gap-3 mb-6 relative z-10">
               <div className={`p-2 rounded-lg transition-colors ${data.activeTrade ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/50' : 'bg-accent-primary/20 text-accent-primary'}`}>
                 <Zap size={24} className={data.activeTrade ? 'animate-bounce' : ''} />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">Neural Processing Unit</h3>
                 <div className="flex items-center gap-2 text-xs text-text-muted">
                   <Database size={12} /> {data.activeTrade ? 'Processing Real-Time Tick Data' : 'Idle - Saving Energy'}
                 </div>
               </div>
             </div>

             {/* XP Bar */}
             <div className="mb-6 relative z-10 bg-navy-900/50 p-3 rounded-lg border border-border">
                <XPBar current={memory.currentXp} max={memory.nextLevelXp} />
                <div className="flex justify-between items-center mt-2">
                   <span className="text-xs text-text-secondary">Next Evolution: <strong>v{Math.floor((memory.level + 1) / 10) + 1}.{(memory.level + 1) % 10}</strong></span>
                   <span className="text-xs text-accent-primary font-bold flex items-center gap-1">
                      <ArrowUpCircle size={12} /> Level {memory.level}
                   </span>
                </div>
             </div>
             
             {/* Knowledge Graph / Lesson Feed */}
             <div className="flex-1 relative z-10 min-h-[300px] flex flex-col">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Logic Stream</h4>
                <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-2 custom-scrollbar bg-navy-900/30 rounded-lg p-2 backdrop-blur-sm">
                   {memory.lessons.map((lesson, index) => (
                     <div key={lesson.id} className="group animate-fade-in-up" style={{animationDelay: `${index * 50}ms`}}>
                       <div className="flex gap-3">
                         <div className="flex flex-col items-center">
                           <div className={`w-2 h-2 rounded-full mt-2 ${index === memory.lessons.length - 1 ? 'bg-accent-primary animate-pulse' : 'bg-navy-600'}`}></div>
                           {index !== memory.lessons.length - 1 && <div className="w-0.5 flex-1 bg-navy-800 my-1"></div>}
                         </div>
                         <div className="flex-1 pb-4">
                           <div className="flex justify-between items-center mb-1">
                             <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                               lesson.trendContext === 'UP' ? 'border-success/30 text-success bg-success/5' :
                               lesson.trendContext === 'DOWN' ? 'border-danger/30 text-danger bg-danger/5' :
                               'border-warning/30 text-warning bg-warning/5'
                             }`}>
                               MARKET: {lesson.trendContext}
                             </span>
                             <span className="text-[10px] text-text-muted">{new Date(lesson.timestamp).toLocaleTimeString()}</span>
                           </div>
                           <p className="text-sm text-text-primary bg-navy-900 p-3 rounded-lg border border-border group-hover:border-accent-primary/30 transition-colors shadow-sm">
                             "{lesson.insight}"
                           </p>
                         </div>
                       </div>
                     </div>
                   ))}
                   <div ref={lessonsEndRef} />
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SignalBot;