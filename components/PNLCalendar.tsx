import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowRight, Calendar as CalendarIcon } from 'lucide-react';
import { Trade } from '../types';
import { getCalendarData, getIntensityColor, DayStats } from '../utils/calendarUtils';
import { useNavigate } from 'react-router-dom';

interface PNLCalendarProps {
  trades: Trade[];
  className?: string;
}

const PNLCalendar: React.FC<PNLCalendarProps> = ({ trades, className = '' }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const { days, monthStats } = useMemo(() => getCalendarData(currentDate, trades), [currentDate, trades]);

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const handleDayClick = (dateStr: string, hasTrades: boolean) => {
    if (hasTrades) {
      navigate(`/log?date=${dateStr}`);
    }
  };

  return (
    <div className={`bg-navy-700 border border-border rounded-xl p-6 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrevMonth}
            className="p-2 rounded-full bg-navy-800 border border-border hover:border-accent-primary hover:text-accent-primary transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-white min-w-[180px] text-center">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button 
            onClick={handleNextMonth}
            className="p-2 rounded-full bg-navy-800 border border-border hover:border-accent-primary hover:text-accent-primary transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-6 bg-navy-800/50 px-4 py-2 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Total:</span>
            <span className={`font-bold ${monthStats.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
              {monthStats.totalPnl >= 0 ? '+' : ''}${monthStats.totalPnl.toLocaleString()}
            </span>
          </div>
          <div className="text-sm text-text-muted hidden sm:block">|</div>
          <div className="text-sm text-text-secondary">
            Wins: <span className="text-white font-bold">{monthStats.wins}</span>
          </div>
          <div className="text-sm text-text-secondary">
            Losses: <span className="text-white font-bold">{monthStats.losses}</span>
          </div>
          <div className="text-sm text-text-secondary">
            Win Rate: <span className="text-accent-primary font-bold">{monthStats.winRate}%</span>
          </div>
        </div>
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-text-muted uppercase py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {days.map((day, index) => (
          <DayCell 
            key={day.date} 
            day={day} 
            index={index} 
            onClick={() => handleDayClick(day.date, day.tradeCount > 0)}
          />
        ))}
      </div>

      {/* Footer Stats */}
      <div className="mt-6 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex flex-col">
          <div className="text-text-secondary mb-1">Monthly PNL</div>
          <div className={`text-2xl font-bold ${monthStats.totalPnl >= 0 ? 'text-success' : 'text-danger'} flex items-center gap-2`}>
            {monthStats.totalPnl >= 0 ? '+' : ''}${monthStats.totalPnl.toLocaleString()}
            {monthStats.totalPnl > 0 && <TrendingUp size={20} />}
            {monthStats.totalPnl < 0 && <TrendingDown size={20} />}
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-6 border-l border-r border-border px-4">
          <div className="text-center">
            <div className="text-white font-bold text-lg">{monthStats.tradingDays}</div>
            <div className="text-xs text-text-muted">Active Days</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-lg">{monthStats.totalTrades}</div>
            <div className="text-xs text-text-muted">Total Trades</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-lg">
              {monthStats.tradingDays ? (monthStats.totalTrades / monthStats.tradingDays).toFixed(1) : 0}
            </div>
            <div className="text-xs text-text-muted">Avg/Day</div>
          </div>
        </div>

        <div className="flex flex-col justify-center items-end text-right">
          <div className="flex gap-2 mb-1">
            <span className="text-text-muted">Best Day:</span>
            <span className="text-success font-bold">Jan 8 (+$650)</span> {/* Mocked for now, logic can be added to utils */}
          </div>
          <div className="flex gap-2">
            <span className="text-text-muted">Worst Day:</span>
            <span className="text-danger font-bold">Jan 12 (-$280)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DayCell: React.FC<{ day: DayStats, index: number, onClick: () => void }> = ({ day, index, onClick }) => {
  const hasTrades = day.tradeCount > 0;
  
  // Base background styles
  const getBackgroundStyle = () => {
    if (!day.isCurrentMonth) return 'bg-navy-900 opacity-60 pointer-events-none';
    if (!hasTrades) return 'bg-[#1e293b] hover:bg-navy-800';
    return ''; // Will be handled by style prop for heatmap
  };

  // Border accents
  const getBorderClass = () => {
    if (!hasTrades) return '';
    if (day.totalPnl > 0) return 'border-l-[3px] border-success';
    if (day.totalPnl < 0) return 'border-l-[3px] border-danger';
    return 'border-l-[3px] border-text-muted'; // Breakeven
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative group rounded-lg p-2 min-h-[80px] transition-all duration-200
        flex flex-col justify-between
        ${getBackgroundStyle()}
        ${getBorderClass()}
        ${hasTrades ? 'cursor-pointer hover:scale-[1.03] hover:shadow-lg z-0 hover:z-10' : ''}
        ${day.isToday ? 'ring-2 ring-accent-primary shadow-[0_0_10px_rgba(139,92,246,0.3)]' : ''}
      `}
      style={{
        backgroundColor: hasTrades && day.isCurrentMonth ? getIntensityColor(day.totalPnl) : undefined,
        animation: `fadeIn 0.3s ease-out forwards`,
        animationDelay: `${index * 10}ms`
      }}
    >
      {/* Day Number */}
      <div className={`text-sm font-medium ${
        !day.isCurrentMonth ? 'text-navy-700' :
        hasTrades ? 'text-white' : 'text-text-muted'
      }`}>
        {day.dayOfMonth}
      </div>

      {/* PNL Content */}
      {hasTrades && day.isCurrentMonth && (
        <>
          <div className="flex-1 flex items-center justify-center">
            <span className={`text-sm md:text-base font-bold ${
              day.totalPnl > 0 ? 'text-success' : 
              day.totalPnl < 0 ? 'text-danger' : 'text-text-secondary'
            }`}>
              {day.totalPnl > 0 ? '+' : ''}${Math.abs(day.totalPnl)}
            </span>
          </div>
          
          <div className="text-[10px] text-text-muted text-center">
            {day.tradeCount} trade{day.tradeCount > 1 ? 's' : ''}
          </div>

          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-navy-900 border border-border rounded-lg shadow-xl p-3 z-50 animate-fade-in pointer-events-none">
            <div className="text-xs text-text-secondary border-b border-border pb-1 mb-2">
              {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-text-muted">Total PNL</span>
              <span className={`text-sm font-bold ${day.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                {day.totalPnl >= 0 ? '+' : ''}${day.totalPnl}
              </span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-text-muted">Trades</span>
              <span className="text-xs text-white">{day.tradeCount}</span>
            </div>
             <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-text-muted">Best Trade</span>
              <span className="text-xs text-success font-bold">+${day.bestTrade}</span>
            </div>
            <div className="flex justify-center text-[10px] text-accent-primary items-center gap-1 mt-1 pt-1 border-t border-border/50">
              Click to view details <ArrowRight size={10} />
            </div>
          </div>
        </>
      )}

      {!hasTrades && day.isCurrentMonth && (
        <div className="flex-1 flex items-center justify-center text-text-muted/20 text-xl select-none">
           —
        </div>
      )}
    </div>
  );
};

export default PNLCalendar;
