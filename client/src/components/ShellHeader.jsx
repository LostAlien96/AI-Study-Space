import React from 'react';
import { Menu, Sparkles, FolderOpen, Brain, Terminal } from 'lucide-react';
import ModelEnginePicker from './ModelEnginePicker';
import { useWorkspaceStore } from '../stores/workspaceStore';

export default function ShellHeader({ onToggleSidebar, onOpenArtifactInspector, onOpenEvaluator }) {
  const { vendor, variant, setVendor, setVariant, referencedArtifacts } = useWorkspaceStore();

  return (
    <header className="h-16 px-4 md:px-6 border-b border-surface-800/80 bg-surface-950/70 backdrop-blur-xl flex items-center justify-between shrink-0 z-30">
      {/* Left: Mobile Toggle & Branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white bg-surface-900 border border-surface-800 transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Intellect<span className="text-cyan-400">Hub</span>
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2 ml-4 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-[11px] font-mono text-cyan-400">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>NEURAL PIPELINE ACTIVE</span>
        </div>
      </div>

      {/* Right: Quick Actions & Model Picker */}
      <div className="flex items-center gap-2 sm:gap-3">
        {referencedArtifacts.length > 0 && (
          <button
            onClick={onOpenEvaluator}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all shadow-sm"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Evaluate</span>
          </button>
        )}

        <button
          onClick={onOpenArtifactInspector}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-surface-900 hover:bg-surface-850 border border-surface-800 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          title="Inspect Materials Vault"
        >
          <FolderOpen className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Vault</span>
          {referencedArtifacts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
              {referencedArtifacts.length}
            </span>
          )}
        </button>

        <div className="w-[140px] sm:w-[190px]">
          <ModelEnginePicker
            activeVendor={vendor}
            activeVariant={variant}
            onSelectVendor={setVendor}
            onSelectVariant={setVariant}
          />
        </div>
      </div>
    </header>
  );
}
