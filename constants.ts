import { ChecklistItem, Signal, Trade } from './types';

export const MOCK_SIGNALS: Signal[] = [
  {
    id: '1',
    pair: 'SOL-PERP',
    direction: 'SHORT',
    entryPrice: 147.00,
    stopLoss: 148.75,
    takeProfit: 143.50,
    strategy: 'Silver Bullet',
    confidence: 'HIGH',
    status: 'WON',
    timestamp: Date.now() - 3600000,
    pnl: 350,
    reasoning: 'Bearish Liquidity Sweep detected at $148.50 followed by strong displacement creating FVG.'
  },
  {
    id: '2',
    pair: 'BTC-PERP',
    direction: 'LONG',
    entryPrice: 64200,
    stopLoss: 63800,
    takeProfit: 65500,
    strategy: 'Order Block',
    confidence: 'MEDIUM',
    status: 'LOST',
    timestamp: Date.now() - 7200000,
    pnl: -200,
    reasoning: 'Rejection from 4H Order Block, structured break to upside.'
  },
  {
    id: '3',
    pair: 'ETH-PERP',
    direction: 'LONG',
    entryPrice: 3450,
    stopLoss: 3420,
    takeProfit: 3550,
    strategy: 'Silver Bullet',
    confidence: 'HIGH',
    status: 'WATCHING',
    timestamp: Date.now() - 120000,
    reasoning: 'Waiting for AM Session window open and liquidity sweep of $3445 low.'
  }
];

export const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: '1', label: 'Identified clear market structure', category: 'Pre-Trade', checked: false },
  { id: '2', label: 'Confirmed higher timeframe trend alignment', category: 'Pre-Trade', checked: false },
  { id: '3', label: 'Located valid supply/demand zone or OB', category: 'Pre-Trade', checked: false },
  { id: '4', label: 'Verified Fair Value Gap present', category: 'Pre-Trade', checked: false },
  { id: '5', label: 'Checked for upcoming news events', category: 'Pre-Trade', checked: false },
  { id: '6', label: 'Risk/Reward is minimum 1:2', category: 'Pre-Trade', checked: false },
  { id: '7', label: 'Waited for price to enter zone', category: 'Execution', checked: false },
  { id: '8', label: 'Confirmed entry trigger candle pattern', category: 'Execution', checked: false },
  { id: '9', label: 'Placed stop loss at correct level', category: 'Execution', checked: false },
  { id: '10', label: 'Recorded outcome in trade log', category: 'Post-Trade', checked: false },
];

// Helper to generate a date string for N days ago
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const MOCK_TRADES: Trade[] = [
  {
    id: 't1',
    pair: 'SOL-PERP',
    direction: 'LONG',
    entryPrice: 140.50,
    exitPrice: 145.00,
    leverage: 5,
    pnl: 450,
    pnlPercent: 3.2,
    outcome: 'WIN',
    strategy: 'Order Block',
    date: daysAgo(2),
    checklistGrade: 'A'
  },
  {
    id: 't2',
    pair: 'BTC-PERP',
    direction: 'SHORT',
    entryPrice: 67000,
    exitPrice: 67500,
    leverage: 10,
    pnl: -500,
    pnlPercent: -0.75,
    outcome: 'LOSS',
    strategy: 'Silver Bullet',
    date: daysAgo(5),
    checklistGrade: 'B'
  },
  {
    id: 't3',
    pair: 'ETH-PERP',
    direction: 'LONG',
    entryPrice: 3200,
    exitPrice: 3300,
    leverage: 5,
    pnl: 820,
    pnlPercent: 3.1,
    outcome: 'WIN',
    strategy: 'Silver Bullet',
    date: daysAgo(1),
    checklistGrade: 'A'
  },
  {
    id: 't4',
    pair: 'SOL-PERP',
    direction: 'SHORT',
    entryPrice: 150,
    exitPrice: 142,
    leverage: 8,
    pnl: 1240,
    pnlPercent: 5.3,
    outcome: 'WIN',
    strategy: 'Order Block',
    date: daysAgo(8),
    checklistGrade: 'A'
  },
  {
    id: 't5',
    pair: 'BTC-PERP',
    direction: 'LONG',
    entryPrice: 66000,
    exitPrice: 65800,
    leverage: 20,
    pnl: -400,
    pnlPercent: -0.3,
    outcome: 'LOSS',
    strategy: 'Silver Bullet',
    date: daysAgo(12),
    checklistGrade: 'C'
  },
  {
    id: 't6',
    pair: 'SOL-PERP',
    direction: 'LONG',
    entryPrice: 144,
    exitPrice: 144.1,
    leverage: 5,
    pnl: 15,
    pnlPercent: 0.05,
    outcome: 'BREAKEVEN',
    strategy: 'Manual',
    date: daysAgo(1),
    checklistGrade: 'B'
  },
  {
    id: 't7',
    pair: 'AVAX-PERP',
    direction: 'SHORT',
    entryPrice: 35,
    exitPrice: 32,
    leverage: 10,
    pnl: 650,
    pnlPercent: 8.5,
    outcome: 'WIN',
    strategy: 'Silver Bullet',
    date: daysAgo(8),
    checklistGrade: 'A'
  }
];
