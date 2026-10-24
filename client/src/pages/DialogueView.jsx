import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Square,
  Bot,
  User,
  Copy,
  Sparkles,
  Terminal,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';

import { useWorkspaceStore } from '../stores/workspaceStore';
import { streamDialogueExchange } from '../services/dialogueChannel';
import { uploadArtifact, indexArtifact, indexWebSource, transcribeAudioVoice } from '../services/artifactChannel';
import AudioVoiceSpeaker from '../components/AudioVoiceSpeaker';

export default function DialogueView() {
  const {
    vendor,
    variant,
    workspaceId,
    operatorId,
    dialogueHistory,
    appendDialogueTurn,
    reviseTerminalAssistantDialogue,
    syncTopologyGraph,
    setReferencedArtifacts,
    setActiveTheme,
    recordChronometerSession,
  } = useWorkspaceStore();

  const [inputBuffer, setInputBuffer] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isIngestingFile, setIsIngestingFile] = useState(false);
  const [isRecordingMic, setIsRecordingMic] = useState(false);

  const fileSelectorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const bottomMarkerRef = useRef(null);

  useEffect(() => {
    bottomMarkerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogueHistory]);

  const handleVoiceRecording = async () => {
    if (isRecordingMic) {
      mediaRecorderRef.current?.stop();
      setIsRecordingMic(false);
    } else {
      audioChunksRef.current = [];
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(audioStream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (evt) => {
          if (evt.data.size > 0) audioChunksRef.current.push(evt.data);
        };

        recorder.onstop = async () => {
          const sampleBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          setIsSynthesizing(true);
          try {
            const data = await transcribeAudioVoice(sampleBlob);
            if (data.text) {
              setInputBuffer((prev) => (prev ? `${prev} ${data.text}` : data.text));
            }
          } catch {
            toast.error('Voice transcription unsuccessful.');
          } finally {
            setIsSynthesizing(false);
          }
          audioStream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        setIsRecordingMic(true);
      } catch {
        toast.error('Unable to access audio capture hardware.');
      }
    }
  };

  const handleArtifactFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIngestingFile(true);
    const nowIso = new Date().toISOString();

    appendDialogueTurn({
      role: 'assistant',
      content: `⏳ Vectorizing artifact: **${file.name}**...`,
      timestamp: nowIso,
    });

    try {
      const uploadOutcome = await uploadArtifact(file);
      setActiveTheme(file.name.replace(/\.[^/.]+$/, ''));
      const indexOutcome = await indexArtifact(uploadOutcome.filename);
      reviseTerminalAssistantDialogue(
        `✅ **Success!** Indexed ${file.name} into ${indexOutcome.total_chunks_processed} chunks.`
      );
    } catch {
      reviseTerminalAssistantDialogue(`❌ Ingestion failed for ${file.name}.`);
    } finally {
      setIsIngestingFile(false);
      if (fileSelectorRef.current) fileSelectorRef.current.value = '';
    }
  };

  const handleDispatchPrompt = async (e) => {
    e?.preventDefault();
    const prompt = inputBuffer.trim();
    if (!prompt || isSynthesizing || isIngestingFile) return;

    setInputBuffer('');
    const now = new Date().toISOString();

    appendDialogueTurn({ role: 'user', content: prompt, timestamp: now });
    appendDialogueTurn({ role: 'assistant', content: '', timestamp: now });
    setIsSynthesizing(true);

    // URL Check
    const isUrl = /^https?:\/\/[^\s]+$/i.test(prompt);
    if (isUrl) {
      reviseTerminalAssistantDialogue('🌐 Extracting web page content...');
      try {
        const scrapeOutcome = await indexWebSource(prompt);
        try {
          const parsed = new URL(prompt);
          setActiveTheme(parsed.hostname);
        } catch {}
        reviseTerminalAssistantDialogue(
          `✅ **Success!** Scraped ${prompt} into ${scrapeOutcome.total_chunks_processed} chunks.`
        );
      } catch {
        reviseTerminalAssistantDialogue('⚠️ Failed to scrape web resource.');
      } finally {
        setIsSynthesizing(false);
      }
      return;
    }

    try {
      let accumulatedAnswer = '';
      await streamDialogueExchange({
        prompt,
        vendor,
        variant,
        workspaceId,
        operatorId,
        onFragmentReceived: (chunk) => {
          setIsSynthesizing(false);
          accumulatedAnswer += chunk;
          reviseTerminalAssistantDialogue(accumulatedAnswer);
        },
        onPacketEmitted: (packet) => {
          if (packet.nodes?.length > 0) {
            syncTopologyGraph(packet.nodes, packet.links || []);
          }
          if (packet.sources?.length > 0) {
            setReferencedArtifacts(packet.sources.map((s) => ({ name: s, type: 'pdf' })));
          }
          if (packet.topic) {
            recordChronometerSession({
              topic: packet.topic,
              sources: packet.sources,
              model: variant,
              provider: vendor,
            });
          }
        },
      });
    } catch {
      setIsSynthesizing(false);
      reviseTerminalAssistantDialogue('⚠️ Connection interrupted during streaming.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 max-w-4xl w-full mx-auto p-3 sm:p-6 relative">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto hub-scrollbar space-y-5 pr-2 mb-4 min-h-0">
        {dialogueHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-surface-900 border border-surface-800 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-slate-200">Cognitive Workspace Ready</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Ingest an academic paper, paste a documentation link, or pose a query to begin synthesis.
            </p>
          </div>
        ) : (
          dialogueHistory.map((turn) => {
            const isUser = turn.role === 'user';
            return (
              <div
                key={turn.id}
                className={`flex gap-3 sm:gap-4 max-w-[96%] sm:max-w-[85%] ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white'
                      : 'bg-surface-850 border border-surface-800 text-cyan-400'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed overflow-x-auto hub-scrollbar select-text ${
                    isUser
                      ? 'bg-cyan-950/20 text-cyan-50 border border-cyan-800/30'
                      : 'bg-surface-900/60 border border-surface-800 text-slate-200'
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeRaw = String(children).replace(/\n$/, '');

                        const copyCode = () => {
                          navigator.clipboard.writeText(codeRaw);
                          toast.success('Snippet copied!');
                        };

                        return !inline && match ? (
                          <div className="my-3 rounded-xl border border-surface-800 overflow-hidden shadow-lg bg-surface-950">
                            <div className="px-3 py-1.5 bg-surface-900 border-b border-surface-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                              <span className="flex items-center gap-1 uppercase">
                                <Terminal className="w-3 h-3 text-cyan-400" /> {match[1]}
                              </span>
                              <button
                                onClick={copyCode}
                                className="flex items-center gap-1 hover:text-white"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                            </div>
                            <SyntaxHighlighter
                              {...props}
                              children={codeRaw}
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                              className="text-xs font-mono"
                            />
                          </div>
                        ) : (
                          <code
                            {...props}
                            className="bg-surface-800 text-cyan-300 px-1 py-0.5 rounded font-mono text-[0.85em]"
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {turn.content}
                  </ReactMarkdown>

                  {!isUser && turn.content && (
                    <div className="mt-3 pt-2 border-t border-surface-800/50 flex justify-end">
                      <AudioVoiceSpeaker textualContent={turn.content} />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isSynthesizing && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-900/40 border border-surface-800 text-slate-400 text-xs w-fit ml-12 animate-pulse">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span>Formulating response...</span>
          </div>
        )}
        <div ref={bottomMarkerRef} />
      </div>

      {/* Input Control Deck */}
      <form
        onSubmit={handleDispatchPrompt}
        className="flex items-center gap-1.5 p-1.5 bg-surface-900/90 backdrop-blur-xl border border-surface-800 rounded-2xl shadow-2xl focus-within:border-cyan-500/50"
      >
        <input
          type="file"
          ref={fileSelectorRef}
          onChange={handleArtifactFile}
          className="hidden"
          accept=".pdf,.docx,.doc,.pptx,.png,.jpg,.jpeg"
        />

        <button
          type="button"
          onClick={() => fileSelectorRef.current?.click()}
          disabled={isIngestingFile || isSynthesizing}
          className="p-2.5 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-surface-800 transition-colors"
          title="Upload Document"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleVoiceRecording}
          className={`p-2.5 rounded-xl transition-colors ${
            isRecordingMic
              ? 'bg-rose-500/20 text-rose-400 animate-pulse'
              : 'text-slate-400 hover:text-cyan-400 hover:bg-surface-800'
          }`}
          title="Voice Dictation"
        >
          {isRecordingMic ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputBuffer}
          onChange={(e) => setInputBuffer(e.target.value)}
          placeholder={isRecordingMic ? 'Vocal input streaming...' : 'Direct query to Intellect Hub...'}
          className="flex-1 bg-transparent border-none text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2"
          disabled={isSynthesizing || isIngestingFile || isRecordingMic}
        />

        <button
          type="submit"
          disabled={!inputBuffer.trim() || isSynthesizing || isIngestingFile}
          className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 text-white shadow-md shadow-cyan-900/30 transition-all active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
