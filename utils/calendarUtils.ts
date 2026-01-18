import { Trade } from '../types';

export interface DayStats {
  date: string;
  dayOfMonth: number;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  bestTrade: number;
  worstTrade: number;
  trades: Trade[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export const getCalendarData = (currentDate: Date, trades: Trade[]) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);

  // Start date for the grid (Sunday before first day of month)
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // End date for the grid (Saturday after last day of month)
  const endDate = new Date(lastDay);
  if (lastDay.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
  }

  const days: DayStats[] = [];
  const iterDate = new Date(startDate);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  while (iterDate <= endDate) {
    // Use local date string for grouping (YYYY-MM-DD in local timezone)
    const iterYear = iterDate.getFullYear();
    const iterMonth = String(iterDate.getMonth() + 1).padStart(2, '0');
    const iterDay = String(iterDate.getDate()).padStart(2, '0');
    const dateStr = `${iterYear}-${iterMonth}-${iterDay}`;

    // Filter trades by matching local date
    const dayTrades = trades.filter(t => {
      // t.date is from backend, should be in YYYY-MM-DD format
      // But we need to handle both ISO strings and date-only strings
      const tradeDate = t.date.split('T')[0]; // Handle ISO format
      return tradeDate === dateStr;
    });

    // Calculate Stats
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let bestTrade = -Infinity;
    let worstTrade = Infinity;

    dayTrades.forEach(t => {
      totalPnl += t.pnl;
      if (t.pnl > 0) wins++;
      else if (t.pnl < 0) losses++;
      else breakevens++;

      if (t.pnl > bestTrade) bestTrade = t.pnl;
      if (t.pnl < worstTrade) worstTrade = t.pnl;
    });

    days.push({
      date: dateStr,
      dayOfMonth: iterDate.getDate(),
      totalPnl,
      tradeCount: dayTrades.length,
      wins,
      losses,
      breakevens,
      bestTrade: dayTrades.length ? bestTrade : 0,
      worstTrade: dayTrades.length ? worstTrade : 0,
      trades: dayTrades,
      isCurrentMonth: iterDate.getMonth() === month,
      isToday: dateStr === todayStr
    });

    iterDate.setDate(iterDate.getDate() + 1);
  }

  // Monthly Aggregates
  const monthTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const monthStats = {
    totalPnl: monthTrades.reduce((sum, t) => sum + t.pnl, 0),
    totalTrades: monthTrades.length,
    wins: monthTrades.filter(t => t.pnl > 0).length,
    losses: monthTrades.filter(t => t.pnl < 0).length,
    winRate: monthTrades.length > 0 ? Math.round((monthTrades.filter(t => t.pnl > 0).length / monthTrades.length) * 100) : 0,
    tradingDays: new Set(monthTrades.map(t => t.date)).size
  };

  return { days, monthStats };
};

export const getIntensityColor = (pnl: number): string => {
  const absPnl = Math.abs(pnl);

  if (pnl > 0) {
    // Green Scale
    if (absPnl < 100) return 'rgba(34, 197, 94, 0.1)';
    if (absPnl < 250) return 'rgba(34, 197, 94, 0.2)';
    if (absPnl < 500) return 'rgba(34, 197, 94, 0.3)';
    if (absPnl < 1000) return 'rgba(34, 197, 94, 0.4)';
    return 'rgba(34, 197, 94, 0.5)';
  } else if (pnl < 0) {
    // Red Scale
    if (absPnl < 100) return 'rgba(239, 68, 68, 0.1)';
    if (absPnl < 250) return 'rgba(239, 68, 68, 0.2)';
    if (absPnl < 500) return 'rgba(239, 68, 68, 0.3)';
    if (absPnl < 1000) return 'rgba(239, 68, 68, 0.4)';
    return 'rgba(239, 68, 68, 0.5)';
  } else {
    // Breakeven/Zero
    return 'rgba(148, 163, 184, 0.1)';
  }
};
