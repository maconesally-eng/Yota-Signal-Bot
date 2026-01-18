import { Trade, AgentMemory, AgentLesson } from '../types';
import { memoryService } from './memoryService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface LearningEvent {
  id: string;
  tradeId: string | null;
  lesson: string;
  patternType: string | null;
  trendContext: 'UP' | 'DOWN' | 'CHOPPY' | null;
  marketContext: string | null;
  timestamp: number;
}

export interface PatternAnalysis {
  consecutiveLosses: number;
  bestTradingHours: number[];
  worstTradingHours: number[];
  strategyPerformance: Map<string, { wins: number; losses: number; pnl: number }>;
  avgHoldTime: number;
  recommendations: string[];
}

export interface TradeAnalysis {
  trade: Trade;
  patterns: string[];
  aiInsight: string | null;
  recommendations: string[];
}

class LearningService {
  private recentTrades: Trade[] = [];
  private patternCache: PatternAnalysis | null = null;
  private cacheExpiry: number = 0;

  // Analyze a trade outcome and detect patterns
  async analyzeTradeOutcome(trade: Trade): Promise<TradeAnalysis> {
    const patterns: string[] = [];
    const recommendations: string[] = [];
    let aiInsight: string | null = null;

    // Store trade for pattern detection
    this.recentTrades = [trade, ...this.recentTrades.slice(0, 49)];
    this.patternCache = null; // Invalidate cache

    // Pattern 1: Consecutive losses
    const consecutiveLosses = this.getConsecutiveLosses();
    if (consecutiveLosses >= 3) {
      patterns.push('CONSECUTIVE_LOSSES');
      recommendations.push(`${consecutiveLosses} consecutive losses detected. Consider taking a break or reducing position size.`);
    }

    // Pattern 2: Outcome vs checklist grade correlation
    if (trade.outcome === 'LOSS' && trade.checklistGrade === 'C') {
      patterns.push('LOW_GRADE_LOSS');
      recommendations.push('Low checklist grade correlated with loss. Ensure all checklist items are completed before trading.');
    }

    // Pattern 3: Time-based performance
    const hour = new Date(trade.date).getHours();
    const hourPerformance = this.getHourPerformance(hour);
    if (hourPerformance && hourPerformance.winRate < 40 && hourPerformance.trades >= 5) {
      patterns.push('WEAK_HOUR');
      recommendations.push(`Hour ${hour}:00 has ${Math.round(hourPerformance.winRate)}% win rate. Consider avoiding trades at this time.`);
    }

    // Pattern 4: Strategy-specific analysis
    const strategyPerf = this.getStrategyPerformance(trade.strategy);
    if (strategyPerf && strategyPerf.winRate < 40 && strategyPerf.trades >= 5) {
      patterns.push('WEAK_STRATEGY');
      recommendations.push(`${trade.strategy} strategy has ${Math.round(strategyPerf.winRate)}% win rate. Review and adjust criteria.`);
    }

    // Pattern 5: Risk management check
    if (trade.pnlPercent && Math.abs(trade.pnlPercent) > 10) {
      patterns.push('HIGH_RISK');
      recommendations.push('Trade exceeded 10% position impact. Consider reducing leverage or position size.');
    }

    // Add lesson to memory
    if (trade.outcome === 'WIN') {
      const lesson = `Won ${trade.pnl > 0 ? '+' : ''}${trade.pnl} on ${trade.pair} ${trade.direction} using ${trade.strategy}. ` +
        (patterns.length > 0 ? `Patterns: ${patterns.join(', ')}.` : 'Clean execution.');
      memoryService.addLesson(lesson, this.inferTrend());
      memoryService.addExperience(20); // XP for trade
    } else if (trade.outcome === 'LOSS') {
      const lesson = `Lost ${trade.pnl} on ${trade.pair} ${trade.direction}. ` +
        recommendations.slice(0, 2).join(' ');
      memoryService.addLesson(lesson, this.inferTrend());
      memoryService.addExperience(10); // Less XP for loss, but still learning
    }

    // Generate AI insight for significant trades
    if (patterns.length > 0 || Math.abs(trade.pnl) > 100) {
      aiInsight = await this.generateAIInsight(trade, patterns, recommendations);
    }

    return {
      trade,
      patterns,
      aiInsight,
      recommendations,
    };
  }

  private getConsecutiveLosses(): number {
    let count = 0;
    for (const trade of this.recentTrades) {
      if (trade.outcome === 'LOSS') count++;
      else break;
    }
    return count;
  }

  private getHourPerformance(hour: number): { trades: number; wins: number; winRate: number } | null {
    const hourTrades = this.recentTrades.filter(t => {
      const tradeHour = new Date(t.date).getHours();
      return tradeHour === hour && t.outcome !== 'BREAKEVEN';
    });

    if (hourTrades.length === 0) return null;

    const wins = hourTrades.filter(t => t.outcome === 'WIN').length;
    return {
      trades: hourTrades.length,
      wins,
      winRate: (wins / hourTrades.length) * 100,
    };
  }

  private getStrategyPerformance(strategy: string): { trades: number; wins: number; winRate: number } | null {
    const stratTrades = this.recentTrades.filter(t =>
      t.strategy === strategy && t.outcome !== 'BREAKEVEN'
    );

    if (stratTrades.length === 0) return null;

    const wins = stratTrades.filter(t => t.outcome === 'WIN').length;
    return {
      trades: stratTrades.length,
      wins,
      winRate: (wins / stratTrades.length) * 100,
    };
  }

  private inferTrend(): 'UP' | 'DOWN' | 'CHOPPY' {
    if (this.recentTrades.length < 3) return 'CHOPPY';

    const recentPnl = this.recentTrades.slice(0, 5).reduce((sum, t) => sum + t.pnl, 0);
    if (recentPnl > 200) return 'UP';
    if (recentPnl < -200) return 'DOWN';
    return 'CHOPPY';
  }

  private async generateAIInsight(
    trade: Trade,
    patterns: string[],
    recommendations: string[]
  ): Promise<string | null> {
    // Use Gemini if available, otherwise generate local insight
    try {
      const { generateAgentInsight } = await import('./geminiService');
      const memory = memoryService.getMemory();
      const trend = this.inferTrend();

      return await generateAgentInsight(trend, memory.lessons.slice(-5).map(l => l.insight));
    } catch (error) {
      // Fallback to local insight generation
      return this.generateLocalInsight(trade, patterns, recommendations);
    }
  }

  private generateLocalInsight(
    trade: Trade,
    patterns: string[],
    recommendations: string[]
  ): string {
    const insights = [
      `Analyzed ${trade.pair} ${trade.direction} trade.`,
    ];

    if (patterns.includes('CONSECUTIVE_LOSSES')) {
      insights.push('Consecutive loss pattern detected - time for a reset.');
    }

    if (patterns.includes('WEAK_STRATEGY')) {
      insights.push(`${trade.strategy} needs calibration.`);
    }

    if (trade.outcome === 'WIN') {
      insights.push('Confirming this setup for future reference.');
    }

    if (recommendations.length > 0) {
      insights.push(recommendations[0]);
    }

    return insights.join(' ');
  }

  // Get comprehensive pattern analysis
  getPatternAnalysis(): PatternAnalysis {
    if (this.patternCache && Date.now() < this.cacheExpiry) {
      return this.patternCache;
    }

    const analysis: PatternAnalysis = {
      consecutiveLosses: this.getConsecutiveLosses(),
      bestTradingHours: [],
      worstTradingHours: [],
      strategyPerformance: new Map(),
      avgHoldTime: 0,
      recommendations: [],
    };

    // Analyze hours
    const hourStats = new Map<number, { wins: number; total: number }>();
    for (let h = 0; h < 24; h++) {
      hourStats.set(h, { wins: 0, total: 0 });
    }

    for (const trade of this.recentTrades) {
      if (trade.outcome === 'BREAKEVEN') continue;
      const hour = new Date(trade.date).getHours();
      const stats = hourStats.get(hour)!;
      stats.total++;
      if (trade.outcome === 'WIN') stats.wins++;

      // Strategy performance
      const stratKey = trade.strategy;
      if (!analysis.strategyPerformance.has(stratKey)) {
        analysis.strategyPerformance.set(stratKey, { wins: 0, losses: 0, pnl: 0 });
      }
      const stratStats = analysis.strategyPerformance.get(stratKey)!;
      stratStats.pnl += trade.pnl;
      if (trade.outcome === 'WIN') stratStats.wins++;
      else stratStats.losses++;
    }

    // Find best/worst hours
    for (const [hour, stats] of hourStats) {
      if (stats.total >= 3) {
        const winRate = stats.wins / stats.total;
        if (winRate >= 0.7) analysis.bestTradingHours.push(hour);
        if (winRate <= 0.3) analysis.worstTradingHours.push(hour);
      }
    }

    // Generate recommendations
    if (analysis.consecutiveLosses >= 3) {
      analysis.recommendations.push('Take a break - consecutive losses detected');
    }
    if (analysis.worstTradingHours.length > 0) {
      analysis.recommendations.push(`Avoid trading at hours: ${analysis.worstTradingHours.join(', ')}`);
    }
    if (analysis.bestTradingHours.length > 0) {
      analysis.recommendations.push(`Focus on hours: ${analysis.bestTradingHours.join(', ')}`);
    }

    for (const [strategy, stats] of analysis.strategyPerformance) {
      const total = stats.wins + stats.losses;
      if (total >= 5) {
        const winRate = (stats.wins / total) * 100;
        if (winRate < 40) {
          analysis.recommendations.push(`Review ${strategy} strategy (${Math.round(winRate)}% win rate)`);
        }
      }
    }

    this.patternCache = analysis;
    this.cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minute cache

    return analysis;
  }

  // Fetch learning events from backend
  async fetchLearningEvents(limit = 50): Promise<LearningEvent[]> {
    try {
      const response = await fetch(`${API_BASE}/api/learning?limit=${limit}`);
      const data = await response.json();
      return data.events.map((e: any) => ({
        id: e.id,
        tradeId: e.trade_id,
        lesson: e.lesson,
        patternType: e.pattern_type,
        trendContext: e.trend_context,
        marketContext: e.market_context,
        timestamp: e.timestamp,
      }));
    } catch (error) {
      console.error('LearningService: Failed to fetch events', error);
      return [];
    }
  }

  // Calculate strategy weight based on performance
  calculateStrategyWeight(wins: number, losses: number, avgWinPnl: number, avgLossPnl: number): number {
    // Formula: weight = (wins * avgWinPnl) / (losses * avgLossPnl + 1)
    const winValue = wins * Math.abs(avgWinPnl);
    const lossValue = losses * Math.abs(avgLossPnl) + 1;
    return Math.max(0.1, Math.min(5.0, winValue / lossValue));
  }

  // Get recommended position size based on recent performance
  getRecommendedPositionMultiplier(): number {
    const consecutiveLosses = this.getConsecutiveLosses();

    // Reduce position size after consecutive losses
    if (consecutiveLosses >= 5) return 0.25;
    if (consecutiveLosses >= 3) return 0.5;
    if (consecutiveLosses >= 2) return 0.75;

    // Increase slightly after consecutive wins
    let consecutiveWins = 0;
    for (const trade of this.recentTrades) {
      if (trade.outcome === 'WIN') consecutiveWins++;
      else break;
    }

    if (consecutiveWins >= 5) return 1.25;
    if (consecutiveWins >= 3) return 1.1;

    return 1.0;
  }

  // Load recent trades from API
  async loadRecentTrades(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/trades?limit=50`);
      const data = await response.json();
      this.recentTrades = data.trades;
      this.patternCache = null; // Invalidate cache
    } catch (error) {
      console.error('LearningService: Failed to load trades', error);
    }
  }
}

// Singleton export
export const learningService = new LearningService();
