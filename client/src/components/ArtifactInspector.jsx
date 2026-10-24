import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Globe,
  Image as ImageIcon,
  Presentation,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Download,
  FolderOpen,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import gateway from '../services/gateway';

export default function ArtifactInspector({ isOpen, onClose }) {
  const { referencedArtifacts, activeTheme, dialogueHistory } = useWorkspaceStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [activeItem, setActiveItem] = useState(null);
  const [extractedString, setExtractedString] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    const handleEsc = (evt) => {
      if (evt.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setActiveItem(null);
      setExtractedString('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeItem && ['docx', 'doc', 'pptx', 'ppt'].includes(activeItem.type)) {
      setIsExtracting(true);
      setExtractedString('');
      gateway
        .get(`/files/text/${encodeURIComponent(activeItem.name)}`)
        .then((res) => {
          setExtractedString(res.data?.text || 'No readable textual content discovered.');
          setIsExtracting(false);
        })
        .catch(() => {
          setExtractedString('Unable to extract artifact textual stream.');
          setIsExtracting(false);
        });
    }
  }, [activeItem]);

  const compiledArtifacts = useMemo(() => {
    const registry = [];
    const dedupSet = new Set();

    referencedArtifacts.forEach((art) => {
      const label = typeof art === 'string' ? art : art.name || 'Artifact';
      const kind = typeof art === 'string' ? (label.startsWith('http') ? 'url' : 'pdf') : art.type || 'pdf';

      if (!dedupSet.has(label)) {
        dedupSet.add(label);
        registry.push({ name: label, type: kind });
      }
    });

    dialogueHistory.forEach((turn) => {
      if (turn.role === 'assistant' && turn.content) {
        const fileRegex = /✅.*?(?:Success!?\s*)(.+?)\s+(?:processed|has been processed)/i;
        const match = turn.content.match(fileRegex);
        if (match) {
          const rawName = match[1].replace(/\*\*/g, '').trim();
          if (!dedupSet.has(rawName)) {
            dedupSet.add(rawName);
            const ext = rawName.split('.').pop()?.toLowerCase();
            let kind = 'pdf';
            if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) kind = 'image';
            else if (['pptx', 'ppt'].includes(ext)) kind = 'pptx';
            else if (['docx', 'doc'].includes(ext)) kind = 'docx';
            registry.push({ name: rawName, type: kind, timestamp: turn.timestamp });
          }
        }
      }
    });

    return registry;
  }, [referencedArtifacts, dialogueHistory]);

  const filteredArtifacts = useMemo(() => {
    if (!filterQuery.trim()) return compiledArtifacts;
    return compiledArtifacts.filter((item) =>
      item.name.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [compiledArtifacts, filterQuery]);

  const resolveKindBadge = (type) => {
    const styleMap = {
      url: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      image: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      pptx: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      ppt: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      docx: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      doc: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      pdf: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return styleMap[type] || 'bg-surface-800 text-slate-400 border-surface-700';
  };

  const getMediaUrl = (item) => {
    if (!item) return '';
    if (item.type === 'url') return item.name;
    const base = gateway.defaults.baseURL;
    return `${base}/files/view/${encodeURIComponent(item.name)}`;
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[600px] bg-surface-950 border-l border-surface-800 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {activeItem ? (
          /* Detail View */
          <div className="flex-1 flex flex-col h-full min-h-0">
            <div className="px-5 py-4 border-b border-surface-800 bg-surface-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-100 truncate" title={activeItem.name}>
                    {activeItem.name}
                  </h3>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase ${resolveKindBadge(activeItem.type)}`}>
                    {activeItem.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getMediaUrl(activeItem)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-surface-800 rounded-lg text-xs flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-surface-900/30 overflow-auto">
              {activeItem.type === 'pdf' ? (
                <iframe
                  src={getMediaUrl(activeItem)}
                  className="w-full h-full border-none"
                  title="PDF Inspector"
                />
              ) : activeItem.type === 'image' ? (
                <div className="flex items-center justify-center p-6 h-full">
                  <img
                    src={getMediaUrl(activeItem)}
                    alt={activeItem.name}
                    className="max-w-full max-h-full object-contain rounded-xl border border-surface-800 shadow-xl"
                  />
                </div>
              ) : activeItem.type === 'url' ? (
                <iframe
                  src={getMediaUrl(activeItem)}
                  className="w-full h-full border-none"
                  title="URL Content"
                />
              ) : (
                <div className="p-6 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                  {isExtracting ? 'Synthesizing content stream...' : extractedString}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Catalog View */
          <>
            <div className="p-5 border-b border-surface-800 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 tracking-tight">Artifact Repository</h2>
                    <p className="text-[11px] text-slate-500">{activeTheme || 'Primary Workspace'}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {compiledArtifacts.length > 2 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search ingested artifacts..."
                    className="w-full pl-9 pr-3 py-2 bg-surface-900 border border-surface-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto hub-scrollbar p-4 space-y-2">
              {filteredArtifacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500">
                  <FolderOpen className="w-10 h-10 mb-2 opacity-30 text-cyan-400" />
                  <p className="text-xs font-semibold text-slate-400">Vault Empty</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Upload documents or feed URLs in the dialogue channel to vectorize content.
                  </p>
                </div>
              ) : (
                filteredArtifacts.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    onClick={() => setActiveItem(item)}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-900/60 hover:bg-surface-850 border border-surface-800 hover:border-cyan-500/30 cursor-pointer transition-all active:scale-98"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{item.name}</p>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold uppercase ${resolveKindBadge(item.type)}`}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
