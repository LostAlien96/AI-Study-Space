import React, { useState, useRef, useEffect } from 'react';
import { Cpu, ChevronDown, Check } from 'lucide-react';

const ENGINE_REGISTRY = [
  {
    vendorId: 'google',
    vendorLabel: 'Google Gemini',
    variants: [
      { id: 'gemini-flash', label: 'Gemini 2.5 Flash', latency: 'Fast' },
      { id: 'gemini-pro', label: 'Gemini 2.5 Pro', latency: 'Deep' },
    ],
  },
  {
    vendorId: 'groq',
    vendorLabel: 'Groq Cloud',
    variants: [
      { id: 'gpt-20b', label: 'GPT OSS 20B', latency: 'Instant' },
      { id: 'gpt-oss', label: 'GPT OSS 120B', latency: 'Comprehensive' },
      { id: 'qwen3', label: 'Qwen 3.8 27B', latency: 'Balanced' },
    ],
  },
  {
    vendorId: 'mistral',
    vendorLabel: 'Mistral AI',
    variants: [
      { id: 'mistral-small', label: 'Mistral Small', latency: 'Compact' },
    ],
  },
];

export default function ModelEnginePicker({
  activeVendor,
  activeVariant,
  onSelectVendor,
  onSelectVariant,
  dropdownOrientation = 'down',
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (evt) => {
      if (containerRef.current && !containerRef.current.contains(evt.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handlePick = (vId, variantId) => {
    onSelectVendor(vId);
    onSelectVariant(variantId);
    setMenuOpen(false);
  };

  let displayLabel = 'Select Engine';
  for (const group of ENGINE_REGISTRY) {
    const match = group.variants.find((v) => v.id === activeVariant);
    if (match) {
      displayLabel = match.label;
      break;
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 bg-surface-900 hover:bg-surface-850 border border-surface-800 rounded-xl text-slate-200 text-xs font-semibold transition-all shadow-sm"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            menuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {menuOpen && (
        <div
          className={`absolute ${
            dropdownOrientation === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } right-0 w-64 bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95`}
        >
          <div className="max-h-72 overflow-y-auto hub-scrollbar space-y-3">
            {ENGINE_REGISTRY.map((group) => (
              <div key={group.vendorId} className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 font-bold">
                  {group.vendorLabel}
                </span>
                <div className="space-y-0.5">
                  {group.variants.map((variant) => {
                    const isSelected = activeVariant === variant.id;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => handlePick(group.vendorId, variant.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/10 text-cyan-400 font-semibold'
                            : 'text-slate-300 hover:bg-surface-800'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span>{variant.label}</span>
                          <span className="text-[10px] text-slate-500">{variant.latency}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
