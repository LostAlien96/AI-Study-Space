import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Clock,
  Target,
  Flame,
  FileText,
  Bot,
  Calendar,
  Timer,
  BarChart2,
  BookOpen,
  Brain,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import CognitiveTargetTracker from '../components/CognitiveTargetTracker';
import gateway from '../services/gateway';
import toast from 'react-hot-toast';

const ORDERED_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CustomTelemetryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const hours = payload[0].value || 0;
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className="bg-surface-900 border border-surface-700 rounded-xl px-3 py-2 shadow-2xl">
      <span className="text-[10px] font-mono uppercase text-slate-400 block">{label}</span>
      <span className="text-sm font-bold text-slate-100">
        {h > 0 ? `${h}h ` : ''}
        {m}m ({hours.toFixed(1)} hrs)
      </span>
    </div>
  );
}

export default function TelemetryView() {
  const {
    weeklyEffortMetrics,
    consecutiveDaysStreak,
    completedWorkspacesCount,
    chronometerLog,
    operatorId,
    cognitiveTargets,
    setCognitiveTargets,
  } = useWorkspaceStore();

  const [reviewDeckItems, setReviewDeckItems] = useState([]);
  const [fetchingDeck, setFetchingDeck] = useState(false);
  const [openCardId, setOpenCardId] = useState(null);
  const [selectedChoices, setSelectedChoices] = useState({});
  const [evaluatedDeckMap, setEvaluatedDeckMap] = useState({});

  const loadReviewDeck = async () => {
    if (!operatorId || operatorId === 'guest') return;
    setFetchingDeck(true);
    try {
      const resp = await gateway.get(`/api/exam/idk/${encodeURIComponent(operatorId)}`);
      if (resp.data && resp.data.questions) {
        setReviewDeckItems(resp.data.questions);
      }
    } catch (err) {
      console.error('Failed to retrieve review deck:', err);
    } finally {
      setFetchingDeck(false);
    }
  };

  useEffect(() => {
    loadReviewDeck();
  }, [operatorId]);

  const testChoice = async (item) => {
    const choice = selectedChoices[item.id];
    if (!choice) return;

    const isCorrect = choice === item.correct_answer;
    setEvaluatedDeckMap((prev) => ({ ...prev, [item.id]: true }));

    if (isCorrect) {
      toast.success('Concept mastered! Retired from review deck.', { icon: '✨' });
      try {
        await gateway.post('/api/exam/idk/resolve', {
          user_email: operatorId,
          question: item.question,
        });
        setTimeout(() => {
          setReviewDeckItems((prev) => prev.filter((q) => q.id !== item.id));
        }, 1200);
      } catch (err) {
        console.error(err);
      }
    } else {
      toast.error('Incorrect. Inspect explanation below.');
    }
  };

  const chartEffortData = useMemo(() => {
    if (!weeklyEffortMetrics || weeklyEffortMetrics.length === 0) {
      return ORDERED_DAYS.map((d) => ({ day: d, hours: 0 }));
    }
    return weeklyEffortMetrics.map((d) => ({
      day: d.day,
      hours: typeof d.hours === 'number' ? d.hours : 0,
    }));
  }, [weeklyEffortMetrics]);

  const totalWeeklyHours = useMemo(
    () => chartEffortData.reduce((sum, item) => sum + (item.hours || 0), 0),
    [chartEffortData]
  );

  const todayIndex = new Date().getDay();

  return (
    <div className="flex-1 w-full h-full overflow-y-auto hub-scrollbar p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <BarChart2 className="w-6 h-6 text-cyan-400" /> Cognitive Telemetry
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Longitudinal synthesis metrics, study consistency, and retention tracking.
          </p>
        </div>

        {/* Metric Triad */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800 flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                Hours (Current Cycle)
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-100">
                {totalWeeklyHours.toFixed(1)}h
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800 flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                Workspaces Concluded
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-100">
                {completedWorkspacesCount ?? 0}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800 flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                Consecutive Streak
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-100">
                {consecutiveDaysStreak ?? 0} Days
              </span>
            </div>
          </div>
        </div>

        {/* Cognitive Target Tracker */}
        <CognitiveTargetTracker
          targets={cognitiveTargets}
          onUpdateTargets={setCognitiveTargets}
          chronometerLog={chronometerLog}
        />

        {/* Effort Chart */}
        <div className="p-5 sm:p-6 rounded-3xl bg-surface-900/40 border border-surface-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs sm:text-sm font-bold text-slate-200">Weekly Effort Curve</h2>
            <span className="text-xs font-mono text-cyan-400">{totalWeeklyHours.toFixed(1)} hrs total</span>
          </div>

          <div className="w-full h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartEffortData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#1F2937" strokeOpacity={0.4} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                <Tooltip content={<CustomTelemetryTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartEffortData.map((item, idx) => {
                    const isToday = idx === todayIndex;
                    return (
                      <Cell
                        key={`cell-${idx}`}
                        fill={isToday ? '#06B6D4' : 'rgba(6, 182, 212, 0.3)'}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spaced Repetition Review Deck */}
        {operatorId && operatorId !== 'guest' && (
          <div className="p-5 sm:p-6 rounded-3xl bg-surface-900/40 border border-surface-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                  Spaced Repetition Review Deck
                </h3>
              </div>
              {reviewDeckItems.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold animate-pulse">
                  {reviewDeckItems.length} PENDING REVIEW
                </span>
              )}
            </div>

            {fetchingDeck ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading deck cards...</span>
              </div>
            ) : reviewDeckItems.length > 0 ? (
              <div className="space-y-2.5">
                {reviewDeckItems.map((card) => {
                  const isOpen = openCardId === card.id;
                  const picked = selectedChoices[card.id];
                  const evaluated = evaluatedDeckMap[card.id];

                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-surface-800 bg-surface-950/40 overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setOpenCardId(isOpen ? null : card.id)}
                        className="w-full p-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 pr-3">
                          <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold text-slate-200 truncate">{card.question}</span>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </button>

                      {isOpen && (
                        <div className="p-4 border-t border-surface-800/60 space-y-3 pt-3">
                          <div className="grid grid-cols-1 gap-2">
                            {card.options.map((opt, oIdx) => {
                              const isSel = picked === opt;
                              const isCorr = opt === card.correct_answer;
                              let borderSt = 'border-surface-800 hover:border-surface-700';
                              if (isSel && !evaluated) borderSt = 'border-cyan-500 bg-cyan-500/10 text-cyan-300';
                              if (evaluated) {
                                if (isCorr) borderSt = 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
                                else if (isSel) borderSt = 'border-rose-500 bg-rose-500/10 text-rose-300';
                              }

                              return (
                                <button
                                  key={oIdx}
                                  disabled={evaluated}
                                  onClick={() => setSelectedChoices((prev) => ({ ...prev, [card.id]: opt }))}
                                  className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${borderSt}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            {evaluated ? (
                              <p className="text-[11px] text-slate-400 font-mono bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-800/30">
                                {card.explanation}
                              </p>
                            ) : (
                              <button
                                onClick={() => testChoice(card)}
                                disabled={!picked}
                                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all ml-auto"
                              >
                                Test Answer
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                No active items in the spaced repetition review deck.
              </p>
            )}
          </div>
        )}

        {/* Chronometer Log */}
        <div className="p-5 sm:p-6 rounded-3xl bg-surface-900/40 border border-surface-800">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-200">Chronometer Log History</h3>
          </div>

          {chronometerLog && chronometerLog.length > 0 ? (
            <div className="divide-y divide-surface-800/40">
              {chronometerLog.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-200">{log.topic}</span>
                    <span className="text-[10px] text-slate-500 block">{log.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.model && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-mono">
                        {log.model}
                      </span>
                    )}
                    {log.duration != null && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-mono">
                        {log.duration} min
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No chronometer sessions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
