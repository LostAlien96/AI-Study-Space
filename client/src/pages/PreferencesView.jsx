import React, { useState } from 'react';
import { Settings, Cpu, Moon, Sun, Trash2, ShieldAlert } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import toast from 'react-hot-toast';

export default function PreferencesView() {
  const { vendor, variant, setVendor, setVariant, resetStore } = useWorkspaceStore();
  const [inferenceTemperature, setInferenceTemperature] = useState(0.3);

  const handleWipeCache = () => {
    if (window.confirm('Wipe all local cognitive workspace caches and state?')) {
      resetStore();
      toast.success('Local cache purged.');
    }
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto hub-scrollbar p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 pb-12">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-cyan-400" /> System Preferences
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure local inference parameters, synthesis temperature, and workspace storage.
          </p>
        </div>

        {/* Model Defaults Card */}
        <div className="p-6 rounded-3xl bg-surface-900/60 border border-surface-800 space-y-5">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200">Default Model Engine</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                Default Provider
              </label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full bg-surface-950 border border-surface-800 text-xs text-slate-200 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50"
              >
                <option value="groq">Groq Cloud (Ultra Low Latency)</option>
                <option value="google">Google Gemini (Deep Reasoning)</option>
                <option value="mistral">Mistral AI (Concise Logic)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                Sampling Temperature ({inferenceTemperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={inferenceTemperature}
                onChange={(e) => setInferenceTemperature(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 mt-2"
              />
            </div>
          </div>
        </div>

        {/* Appearance Mode */}
        <div className="p-6 rounded-3xl bg-surface-900/60 border border-surface-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">Visual Theme</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-surface-950 border border-cyan-500/50 text-cyan-400 text-xs font-bold shadow-lg shadow-cyan-950/40">
              <Moon className="w-4 h-4" /> Dark Synth (Default)
            </button>
            <button
              onClick={() => toast('High-contrast neon theme active')}
              className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-surface-950 border border-surface-800 text-slate-500 text-xs font-bold hover:text-slate-300"
            >
              <Sun className="w-4 h-4" /> Cyber Light
            </button>
          </div>
        </div>

        {/* Storage Maintenance */}
        <div className="p-6 rounded-3xl bg-surface-900/60 border border-rose-950/40 space-y-4">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            <h2 className="text-sm font-bold">Storage Operations</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Flush browser indexed storage, clear uncommitted vector states, and reset workspace identity tokens.
          </p>
          <button
            onClick={handleWipeCache}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Purge Local Cache
          </button>
        </div>
      </div>
    </div>
  );
}
