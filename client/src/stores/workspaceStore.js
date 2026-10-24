import { create } from 'zustand';
import gateway from '../services/gateway';

const readStorage = (storageKey, fallbackValue) => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

const sanitizeOperatorId = (rawId) => {
  if (!rawId) return 'guest';
  if (typeof rawId === 'string') return rawId.replace(/^"|"$/g, '');
  if (rawId.email) return rawId.email;
  return String(rawId);
};

export const useWorkspaceStore = create((set, get) => ({
  // Identity & Inference Configuration
  vendor: 'groq',
  variant: 'gpt-20b',
  workspaceId: crypto.randomUUID(),
  operatorId: sanitizeOperatorId(readStorage('user_email', 'guest')),
  isHydrated: false,
  isSwitchingWorkspace: false,

  setVendor: (vendor) => set({ vendor }),
  setVariant: (variant) => set({ variant }),
  setOperatorId: (rawId) => {
    const clean = sanitizeOperatorId(rawId);
    localStorage.setItem('user_email', JSON.stringify(clean));
    set({ operatorId: clean });
  },

  // Workspaces Catalog & Dialogue
  workspaceSummaries: [],
  dialogueHistory: readStorage('chatHistory', []),
  activeTheme: readStorage('currentTopic', ''),
  referencedArtifacts: readStorage('activeSources', []),

  // Knowledge Topology
  conceptTopology: readStorage('graphData', { nodes: [], links: [] }),

  // Telemetry & Goals
  consecutiveDaysStreak: readStorage('currentStreak', 0),
  completedWorkspacesCount: readStorage('sessionsCompleted', 0),
  weeklyEffortMetrics: readStorage('studyData', [
    { day: 'Sun', hours: 0 },
    { day: 'Mon', hours: 0 },
    { day: 'Tue', hours: 0 },
    { day: 'Wed', hours: 0 },
    { day: 'Thu', hours: 0 },
    { day: 'Fri', hours: 0 },
    { day: 'Sat', hours: 0 },
  ]),
  chronometerLog: readStorage('studyHistory', []),
  cognitiveTargets: readStorage('studyGoals', []),

  // Deep Focus Chronometer State
  chronometerIntervalDuration: 25 * 60,
  chronometerSecondsRemaining: 25 * 60,
  isChronometerTicking: false,

  setChronometerTicking: (isTicking) => set({ isChronometerTicking: isTicking }),
  setChronometerSeconds: (seconds) => set({ chronometerSecondsRemaining: seconds }),
  reconfigureChronometerDuration: (minutes) => {
    const totalSecs = minutes * 60;
    set({
      chronometerIntervalDuration: totalSecs,
      chronometerSecondsRemaining: totalSecs,
      isChronometerTicking: false,
    });
  },

  setCognitiveTargets: (updater) => {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.cognitiveTargets) : updater;
      localStorage.setItem('studyGoals', JSON.stringify(next));
      return { cognitiveTargets: next };
    });
  },

  appendDialogueTurn: (turn) => {
    set((state) => {
      const nextHistory = [
        ...state.dialogueHistory,
        { id: crypto.randomUUID(), ...turn },
      ];
      let nextTheme = state.activeTheme;
      if (!nextTheme && turn.role === 'user') {
        nextTheme = turn.content.substring(0, 60);
      }
      return { dialogueHistory: nextHistory, activeTheme: nextTheme };
    });
  },

  reviseTerminalAssistantDialogue: (updatedText) => {
    set((state) => {
      const cloned = [...state.dialogueHistory];
      for (let i = cloned.length - 1; i >= 0; i--) {
        if (cloned[i].role === 'assistant') {
          cloned[i] = { ...cloned[i], content: updatedText };
          break;
        }
      }
      return { dialogueHistory: cloned };
    });
  },

  syncTopologyGraph: (freshNodes, freshLinks) => {
    if (!freshNodes || freshNodes.length === 0) return;
    set((state) => {
      const currentNodes = [...state.conceptTopology.nodes];
      const currentLinks = [...state.conceptTopology.links];

      freshNodes.forEach((node) => {
        const found = currentNodes.findIndex((n) => n.id === node.id);
        if (found >= 0) {
          currentNodes[found] = { ...currentNodes[found], val: currentNodes[found].val + 2 };
        } else {
          currentNodes.push({
            id: node.id,
            name: node.name || node.id,
            val: node.val || 5,
            color: node.color || '#06B6D4',
          });
        }
      });

      freshLinks.forEach((link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        const exists = currentLinks.some((l) => {
          const lSource = typeof l.source === 'object' ? l.source.id : l.source;
          const lTarget = typeof l.target === 'object' ? l.target.id : l.target;
          return (lSource === sourceId && lTarget === targetId) || (lSource === targetId && lTarget === sourceId);
        });

        if (!exists) {
          currentLinks.push({ source: sourceId, target: targetId, name: link.name || 'Connected to' });
        }
      });

      return { conceptTopology: { nodes: currentNodes, links: currentLinks } };
    });
  },

  setReferencedArtifacts: (artifacts) => set({ referencedArtifacts: artifacts }),
  setActiveTheme: (theme) => set({ activeTheme: theme }),

  recordChronometerSession: (sessionData) => {
    set((state) => {
      const prev = state.chronometerLog;
      if (prev.length > 0 && prev[0].topic === sessionData.topic && Date.now() - prev[0].timestamp < 60000) {
        return state;
      }
      const entry = {
        id: crypto.randomUUID(),
        topic: sessionData.topic,
        docs: sessionData.sources?.join(', ') || 'General Knowledge',
        model: sessionData.model,
        provider: sessionData.provider,
        duration: sessionData.duration || 0,
        date: new Date().toLocaleString(),
        timestamp: Date.now(),
      };
      return { chronometerLog: [entry, ...prev] };
    });
  },

  spawnNewWorkspace: () => {
    set({
      workspaceId: crypto.randomUUID(),
      dialogueHistory: [],
      activeTheme: '',
      referencedArtifacts: [],
      conceptTopology: { nodes: [], links: [] },
    });
  },

  hydrateFromBackend: async (operatorEmail) => {
    const cleanId = sanitizeOperatorId(operatorEmail);
    if (cleanId === 'guest') {
      get().resetStore();
      return;
    }

    set({ isHydrated: false });

    try {
      // 1. Tier 1 summaries
      const summaryResp = await gateway.get(`/api/sessions/metadata/${cleanId}`);
      if (summaryResp.data && summaryResp.data.data) {
        set({ workspaceSummaries: summaryResp.data.data });

        // 2. Load most recent workspace
        if (summaryResp.data.data.length > 0) {
          const latestId = summaryResp.data.data[0].sessionId;
          await get().switchWorkspace(latestId);
        }
      }

      // 3. Analytics
      const telemetryResp = await gateway.get(`/api/analytics/${cleanId}`);
      if (telemetryResp.data) {
        const t = telemetryResp.data;
        set({
          weeklyEffortMetrics: t.studyData || get().weeklyEffortMetrics,
          chronometerLog: t.studyHistory || [],
          cognitiveTargets: t.goals || [],
          consecutiveDaysStreak: t.currentStreak ?? 0,
          completedWorkspacesCount: t.sessionsCompleted ?? 0,
        });
      }
    } catch (err) {
      console.error('Hydration failed:', err);
    } finally {
      set({ isHydrated: true });
    }
  },

  switchWorkspace: async (targetId) => {
    set({ isSwitchingWorkspace: true });
    try {
      const operator = get().operatorId;
      const resp = await gateway.get(`/api/sessions/${targetId}`, {
        params: { user_email: operator },
      });

      if (resp.data && resp.data.data) {
        const item = resp.data.data;
        const rawTopo = item.knowledgeGraph || {};
        set({
          workspaceId: item.sessionId,
          activeTheme: item.topic || '',
          dialogueHistory: item.chatTranscript || [],
          conceptTopology: {
            nodes: rawTopo.nodes || [],
            links: rawTopo.links || rawTopo.edges || [],
          },
        });
      }
    } catch (err) {
      console.error('Workspace transition error:', err);
    } finally {
      set({ isSwitchingWorkspace: false });
    }
  },

  refreshSummariesOnly: async () => {
    const operator = get().operatorId;
    if (!operator || operator === 'guest') return;
    try {
      const resp = await gateway.get(`/api/sessions/metadata/${operator}`);
      if (resp.data && resp.data.data) {
        set({ workspaceSummaries: resp.data.data });
      }
    } catch (err) {
      console.error('Summaries sync failed:', err);
    }
  },

  resetStore: () => {
    set({
      isHydrated: false,
      operatorId: 'guest',
      dialogueHistory: [],
      activeTheme: '',
      referencedArtifacts: [],
      conceptTopology: { nodes: [], links: [] },
      workspaceSummaries: [],
      weeklyEffortMetrics: [
        { day: 'Sun', hours: 0 },
        { day: 'Mon', hours: 0 },
        { day: 'Tue', hours: 0 },
        { day: 'Wed', hours: 0 },
        { day: 'Thu', hours: 0 },
        { day: 'Fri', hours: 0 },
        { day: 'Sat', hours: 0 },
      ],
      chronometerLog: [],
      cognitiveTargets: [],
      consecutiveDaysStreak: 0,
      completedWorkspacesCount: 0,
    });
    localStorage.clear();
  },
}));
