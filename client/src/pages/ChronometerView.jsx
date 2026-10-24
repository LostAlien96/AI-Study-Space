import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain,
  FolderOpen,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import toast from 'react-hot-toast';

export default function ChronometerView() {
  const navigate = useNavigate();
  const {
    chronometerIntervalDuration,
    chronometerSecondsRemaining,
    isChronometerTicking,
    setChronometerTicking,
    setChronometerSeconds,
    reconfigureChronometerDuration,
    workspaceSummaries,
    switchWorkspace,
    activeTheme,
  } = useWorkspaceStore();

  const [inRecoveryBreak, setInRecoveryBreak] = useState(false);

  const durationBasis = inRecoveryBreak ? 5 * 60 : chronometerIntervalDuration;
  const progressRatio = durationBasis > 0 ? ((durationBasis - chronometerSecondsRemaining) / durationBasis) * 100 : 0;
  const circumference = 2 * Math.PI * 125;
  const strokeOffset = circumference - (progressRatio / 100) * circumference;

  useEffect(() => {
    let tickTimer = null;
    if (isChronometerTicking && chronometerSecondsRemaining > 0) {
      tickTimer = setInterval(() => {
        setChronometerSeconds(chronometerSecondsRemaining - 1);
      }, 1000);
    } else if (isChronometerTicking && chronometerSecondsRemaining === 0) {
      setChronometerTicking(false);

      if (inRecoveryBreak) {
        toast.success('Recovery period concluded. Re-engaging focus interval.');
        setInRecoveryBreak(false);
        reconfigureChronometerDuration(chronometerIntervalDuration / 60);
      } else {
        toast.success('Deep focus interval completed! 5-minute recovery initiated.', {
          icon: '☕',
        });
        setInRecoveryBreak(true);
        reconfigureChronometerDuration(5);
      }
    }
    return () => clearInterval(tickTimer);
  }, [isChronometerTicking, chronometerSecondsRemaining, inRecoveryBreak, chronometerIntervalDuration]);

  const formatDigits = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleReset = () => {
    setChronometerTicking(false);
    setInRecoveryBreak(false);
    reconfigureChronometerDuration(chronometerIntervalDuration / 60);
    toast('Chronometer reset', { icon: '🔄' });
  };

  const aggregatedVaultArtifacts = (workspaceSummaries || []).flatMap((ws) =>
    (ws.documents || []).map((doc) => ({
      ...doc,
      sessionId: ws.sessionId,
      topic: ws.topic,
    }))
  );

  return (
    <div className="flex-1 w-full h-full overflow-y-auto hub-scrollbar p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 pb-12">
        {/* Title Deck */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-center gap-2.5">
              {inRecoveryBreak ? (
                <>
                  <Coffee className="w-6 h-6 text-emerald-400" /> Cognitive Recovery
                </>
              ) : (
                <>
                  <Brain className="w-6 h-6 text-cyan-400" /> Deep Work Chronometer
                </>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {inRecoveryBreak ? 'Step back. Synapses consolidating.' : 'Eliminate interruption vectors. Execute.'}
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex bg-surface-900 border border-surface-800 p-1 rounded-full">
            {[25, 50, 90].map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  setInRecoveryBreak(false);
                  reconfigureChronometerDuration(mins);
                }}
                disabled={isChronometerTicking}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-40 ${
                  chronometerIntervalDuration / 60 === mins && !inRecoveryBreak
                    ? 'bg-surface-800 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* Circular Chronometer Card */}
        <div className="p-8 rounded-3xl bg-surface-900/40 border border-surface-800 backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
            <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 280 280">
              <circle
                cx="140"
                cy="140"
                r="125"
                stroke="#1F2937"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="140"
                cy="140"
                r="125"
                stroke={inRecoveryBreak ? '#10B981' : '#06B6D4'}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-slate-100">
                {formatDigits(chronometerSecondsRemaining)}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-2">
                {inRecoveryBreak ? 'RECOVERY MODE' : 'FOCUS INTERVAL'}
              </span>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-6 mt-6">
            <button
              onClick={handleReset}
              className="p-3.5 rounded-full bg-surface-900 hover:bg-surface-800 border border-surface-800 text-slate-400 hover:text-white transition-all active:scale-95"
              title="Reset"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => setChronometerTicking(!isChronometerTicking)}
              className={`p-4 rounded-full transition-all active:scale-95 shadow-lg ${
                isChronometerTicking
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-cyan-900/30'
              }`}
            >
              {isChronometerTicking ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Global Vault Grid */}
        <div className="p-5 rounded-3xl bg-surface-900/40 border border-surface-800">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200">Cross-Workspace Vault</h3>
          </div>

          {aggregatedVaultArtifacts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {aggregatedVaultArtifacts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    switchWorkspace(item.sessionId);
                    navigate('/chat');
                  }}
                  className="p-3 rounded-xl bg-surface-950/40 border border-surface-800 hover:border-cyan-500/40 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300">
                      {item.fileName}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate block mt-1">
                    Workspace: {item.topic}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">No cross-workspace artifacts registered.</p>
          )}
        </div>
      </div>
    </div>
  );
}
