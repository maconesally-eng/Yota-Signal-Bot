import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../components/Common';
import { INITIAL_CHECKLIST } from '../constants';
import { ClipboardList, Save, Upload, X, Filter, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { tradeService, TradeServiceData } from '../services/tradeService';
import { learningService } from '../services/learningService';
import { Trade, SignalDirection } from '../types';

const TradeLog: React.FC = () => {
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterDate = searchParams.get('date');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Connect to trade service for real-time data
  const [tradeData, setTradeData] = useState<TradeServiceData>(tradeService.getData());

  useEffect(() => {
    const unsubscribe = tradeService.subscribe(() => {
      setTradeData(tradeService.getData());
    });

    // Fetch trades
    if (filterDate) {
      tradeService.fetchTradesByDate(filterDate);
    } else {
      tradeService.fetchTrades(50);
    }

    return unsubscribe;
  }, [filterDate]);

  const [formData, setFormData] = useState({
    pair: 'SOL-PERP',
    entry: '',
    exit: '',
    direction: 'LONG' as SignalDirection,
    size: '',
    leverage: 5,
    notes: '',
  });

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const clearFilter = () => {
    setSearchParams({});
  };

  const clearForm = () => {
    setFormData({
      pair: 'SOL-PERP',
      entry: '',
      exit: '',
      direction: 'LONG',
      size: '',
      leverage: 5,
      notes: '',
    });
    setChecklist(INITIAL_CHECKLIST.map(item => ({ ...item, checked: false })));
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  // Filter trades by date if needed
  const filteredTrades = filterDate
    ? tradeData.trades.filter(t => t.date === filterDate)
    : tradeData.trades;

  const checkedCount = checklist.filter(i => i.checked).length;
  const grade = checkedCount > 8 ? 'A' : checkedCount > 6 ? 'B' : 'C';

  // Handle trade submission
  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.entry || !formData.exit) {
      setSubmitError('Entry and Exit prices are required');
      return;
    }

    const entryPrice = parseFloat(formData.entry);
    const exitPrice = parseFloat(formData.exit);

    if (isNaN(entryPrice) || isNaN(exitPrice)) {
      setSubmitError('Invalid price values');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Calculate PNL
      const priceDiff = formData.direction === 'LONG'
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;
      const pnlPercent = (priceDiff / entryPrice) * 100 * formData.leverage;
      const estimatedSize = formData.size ? parseFloat(formData.size) : 100;
      const pnl = (estimatedSize * pnlPercent) / 100;

      // Determine outcome
      let outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
      if (pnl > 0) outcome = 'WIN';
      else if (pnl < 0) outcome = 'LOSS';
      else outcome = 'BREAKEVEN';

      const trade = {
        pair: formData.pair,
        direction: formData.direction,
        entryPrice,
        exitPrice,
        leverage: formData.leverage,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
        outcome,
        strategy: 'Manual' as const,
        notes: formData.notes || undefined,
        checklistGrade: grade,
      };

      // Submit to backend
      const result = await tradeService.submitTrade(trade);

      if (result) {
        setSubmitSuccess(true);

        // Analyze the trade for learning
        const fullTrade: Trade = {
          id: result.id,
          pair: result.pair,
          direction: result.direction as SignalDirection,
          entryPrice: result.entryPrice,
          exitPrice: result.exitPrice || exitPrice,
          leverage: result.leverage || formData.leverage,
          pnl: result.pnl,
          pnlPercent: result.pnlPercent || pnlPercent,
          outcome: result.outcome as 'WIN' | 'LOSS' | 'BREAKEVEN',
          strategy: result.strategy as 'Silver Bullet' | 'Order Block' | 'Manual',
          date: result.date,
          notes: result.notes,
          checklistGrade: result.checklistGrade,
        };

        await learningService.analyzeTradeOutcome(fullTrade);

        // Clear form after successful submission
        setTimeout(() => {
          clearForm();
        }, 2000);
      } else {
        setSubmitError('Failed to save trade. Please try again.');
      }
    } catch (error) {
      console.error('Trade submission error:', error);
      setSubmitError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Log Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Log New Trade">
            {submitSuccess && (
              <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
                Trade saved successfully! Learning engine analyzing...
              </div>
            )}

            {submitError && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Pair</label>
                <select
                  value={formData.pair}
                  onChange={(e) => setFormData({ ...formData, pair: e.target.value })}
                  className="w-full bg-navy-900 border border-border rounded p-2 text-white focus:border-accent-primary outline-none"
                >
                  <option>SOL-PERP</option>
                  <option>BTC-PERP</option>
                  <option>ETH-PERP</option>
                  <option>AVAX-PERP</option>
                  <option>MATIC-PERP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Direction</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, direction: 'LONG' })}
                    className={`flex-1 py-2 rounded font-bold transition-all ${formData.direction === 'LONG' ? 'bg-success text-navy-900' : 'bg-navy-900 text-text-muted'}`}
                  >LONG</button>
                  <button
                    onClick={() => setFormData({ ...formData, direction: 'SHORT' })}
                    className={`flex-1 py-2 rounded font-bold transition-all ${formData.direction === 'SHORT' ? 'bg-danger text-white' : 'bg-navy-900 text-text-muted'}`}
                  >SHORT</button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">Entry Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.entry}
                  onChange={(e) => setFormData({ ...formData, entry: e.target.value })}
                  className="w-full bg-navy-900 border border-border rounded p-2 text-white focus:border-accent-primary outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Exit Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exit}
                  onChange={(e) => setFormData({ ...formData, exit: e.target.value })}
                  className="w-full bg-navy-900 border border-border rounded p-2 text-white focus:border-accent-primary outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">Position Size ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="w-full bg-navy-900 border border-border rounded p-2 text-white focus:border-accent-primary outline-none"
                  placeholder="100.00"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Leverage</label>
                <select
                  value={formData.leverage}
                  onChange={(e) => setFormData({ ...formData, leverage: parseInt(e.target.value) })}
                  className="w-full bg-navy-900 border border-border rounded p-2 text-white focus:border-accent-primary outline-none"
                >
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="3">3x</option>
                  <option value="5">5x</option>
                  <option value="10">10x</option>
                  <option value="20">20x</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-text-secondary mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-navy-900 border border-border rounded p-2 text-white focus:border-accent-primary outline-none h-24"
                  placeholder="Why did you take this trade?"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={clearForm}>Clear</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save Trade
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Trade History</h3>
              {filterDate && (
                <div className="flex items-center gap-2 bg-accent-primary/20 text-accent-primary px-3 py-1 rounded-full text-sm">
                  <Filter size={14} />
                  <span>Filtered: {new Date(filterDate).toLocaleDateString()}</span>
                  <button onClick={clearFilter} className="hover:text-white ml-1">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {filteredTrades.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                No trades found. Submit your first trade above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-text-muted border-b border-border">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Pair</th>
                      <th className="pb-2">Entry</th>
                      <th className="pb-2">Exit</th>
                      <th className="pb-2">PNL</th>
                      <th className="pb-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map(trade => (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-navy-800/50 transition-colors">
                        <td className="py-3 text-text-secondary">{trade.date}</td>
                        <td className="py-3 font-mono">{trade.pair} <Badge type={trade.direction} /></td>
                        <td className="py-3">${trade.entryPrice}</td>
                        <td className="py-3">${trade.exitPrice || '-'}</td>
                        <td className={`py-3 font-bold ${trade.pnl > 0 ? 'text-success' : trade.pnl < 0 ? 'text-danger' : 'text-text-muted'}`}>
                          {trade.pnl > 0 ? '+' : ''}{trade.pnl} ({trade.pnlPercent}%)
                        </td>
                        <td className="py-3">
                          <span className={`font-bold px-2 py-1 rounded bg-navy-900 ${
                            trade.checklistGrade === 'A' ? 'text-success' : trade.checklistGrade === 'B' ? 'text-warning' : 'text-danger'
                          }`}>{trade.checklistGrade || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar: Checklist */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex items-center gap-2"><ClipboardList className="text-accent-primary" /> Checklist</h3>
              <div className={`text-2xl font-bold ${grade === 'A' ? 'text-success' : grade === 'B' ? 'text-accent-primary' : 'text-warning'}`}>
                Grade: {grade}
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {['Pre-Trade', 'Execution', 'Post-Trade'].map(cat => (
                <div key={cat}>
                  <h4 className="text-xs uppercase text-text-muted font-bold tracking-wider mb-2 border-b border-border pb-1">{cat}</h4>
                  <div className="space-y-2">
                    {checklist.filter(i => i.category === cat).map(item => (
                      <label key={item.id} className="flex items-start gap-3 cursor-pointer group hover:bg-navy-800 p-1 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleCheck(item.id)}
                          className="mt-1 w-4 h-4 rounded border-border bg-navy-900 checked:bg-accent-primary appearance-none border checked:border-transparent relative after:content-[''] after:absolute after:left-[5px] after:top-[1px] after:w-[5px] after:h-[10px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:hidden checked:after:block"
                        />
                        <span className={`text-sm group-hover:text-white transition-colors ${item.checked ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-text-muted text-center mb-2">Import CSV from Binance/Bybit</p>
              <Button variant="secondary" className="w-full text-sm">
                <Upload size={14} /> Import Trades
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TradeLog;
