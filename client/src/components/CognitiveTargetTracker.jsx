import React, { useState } from 'react';
import { Target, Plus, Trash2, Calendar, TrendingUp } from 'lucide-react';

export default function CognitiveTargetTracker({ targets, onUpdateTargets, chronometerLog }) {
  const [topicName, setTopicName] = useState('');
  const [targetHours, setTargetHours] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');

  const registerTarget = (e) => {
    e.preventDefault();
    if (!topicName.trim() || !targetHours) return;

    const freshTarget = {
      id: crypto.randomUUID(),
      topic: topicName.trim(),
      targetHours: parseFloat(targetHours),
      deadline: cutoffDate || null,
      createdAt: new Date().toISOString(),
    };

    onUpdateTargets((prev) => [...prev, freshTarget]);
    setTopicName('');
    setTargetHours('');
    setCutoffDate('');
  };

  const removeTarget = (id) => {
    onUpdateTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const computeAccumulatedHours = (topic) => {
    if (!chronometerLog) return 0;
    const matchingEntries = chronometerLog.filter((item) =>
      item.topic.toLowerCase().includes(topic.toLowerCase())
    );
    const totalMinutes = matchingEntries.reduce((sum, item) => sum + (item.duration || 0), 0);
    return totalMinutes / 60;
  };

  return (
    <div className="bg-surface-900/60 backdrop-blur-xl border border-surface-800 rounded-3xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <Target className="w-5 h-5 text-cyan-400" />
        <h2 className="text-sm sm:text-base font-bold text-slate-100">
          Cognitive Target Progression
        </h2>
      </div>

      <form onSubmit={registerTarget} className="flex flex-col sm:flex-row gap-2.5 p-3 rounded-2xl bg-surface-950/60 border border-surface-800">
        <input
          type="text"
          placeholder="Concept domain (e.g., 'Distributed Systems')"
          value={topicName}
          onChange={(e) => setTopicName(e.target.value)}
          className="flex-1 bg-surface-900 border border-surface-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-cyan-500/50"
        />
        <input
          type="number"
          step="0.5"
          placeholder="Target (Hours)"
          value={targetHours}
          onChange={(e) => setTargetHours(e.target.value)}
          className="w-full sm:w-28 bg-surface-900 border border-surface-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-cyan-500/50"
        />
        <input
          type="date"
          value={cutoffDate}
          onChange={(e) => setCutoffDate(e.target.value)}
          className="w-full sm:w-36 bg-surface-900 border border-surface-800 text-xs text-slate-400 px-3 py-2 rounded-xl focus:outline-none focus:border-cyan-500/50"
        />
        <button
          type="submit"
          disabled={!topicName.trim() || !targetHours}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="space-y-3">
        {targets && targets.length > 0 ? (
          targets.map((tgt) => {
            const loggedHours = computeAccumulatedHours(tgt.topic);
            const percentage = Math.min(100, Math.round((loggedHours / tgt.targetHours) * 100));
            const achieved = percentage >= 100;

            return (
              <div
                key={tgt.id}
                className="relative overflow-hidden p-4 rounded-2xl bg-surface-900/80 border border-surface-800 transition-all"
              >
                <div
                  className={`absolute inset-0 opacity-10 transition-all duration-700 ${
                    achieved ? 'bg-emerald-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />

                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-200">{tgt.topic}</span>
                      {achieved && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                          ACHIEVED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                        {loggedHours.toFixed(1)} / {tgt.targetHours}h
                      </span>
                      {tgt.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(tgt.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-lg font-black font-mono text-cyan-400">{percentage}%</span>
                    <button
                      onClick={() => removeTarget(tgt.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-surface-800 transition-colors"
                      title="Delete target"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-6 text-center text-xs text-slate-600 border border-dashed border-surface-800 rounded-2xl">
            No active targets registered. Formulate a learning objective above.
          </div>
        )}
      </div>
    </div>
  );
}
