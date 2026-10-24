import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import gateway from '../services/gateway';

export function useWorkspaceSynchronizer() {
  const store = useWorkspaceStore();
  const debounceHandleRef = useRef(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(store.dialogueHistory));
    localStorage.setItem('currentTopic', JSON.stringify(store.activeTheme));
    localStorage.setItem('activeSources', JSON.stringify(store.referencedArtifacts));
    localStorage.setItem('graphData', JSON.stringify(store.conceptTopology));
    localStorage.setItem('studyData', JSON.stringify(store.weeklyEffortMetrics));
    localStorage.setItem('studyHistory', JSON.stringify(store.chronometerLog));
    localStorage.setItem('studyGoals', JSON.stringify(store.cognitiveTargets));
    localStorage.setItem('currentStreak', JSON.stringify(store.consecutiveDaysStreak));
    localStorage.setItem('sessionsCompleted', JSON.stringify(store.completedWorkspacesCount));
  }, [
    store.dialogueHistory,
    store.activeTheme,
    store.referencedArtifacts,
    store.conceptTopology,
    store.weeklyEffortMetrics,
    store.chronometerLog,
    store.cognitiveTargets,
    store.consecutiveDaysStreak,
    store.completedWorkspacesCount,
  ]);

  // Debounced cloud persistence
  useEffect(() => {
    if (store.operatorId === 'guest' || !store.isHydrated || store.isSwitchingWorkspace) {
      return;
    }

    if (debounceHandleRef.current) {
      clearTimeout(debounceHandleRef.current);
    }

    debounceHandleRef.current = setTimeout(async () => {
      try {
        const payload = {
          sessionId: store.workspaceId,
          userEmail: store.operatorId,
          topic: store.activeTheme || 'Autonomous Synthesis Workspace',
          durationMinutes: 0,
          documents: store.referencedArtifacts.map((art) => ({
            fileName: typeof art === 'string' ? art : art.name || 'Artifact',
          })),
          chatTranscript: store.dialogueHistory,
          knowledgeGraph: {
            nodes: store.conceptTopology.nodes,
            edges: store.conceptTopology.links.map((edge) => ({
              source: typeof edge.source === 'object' ? edge.source.id : edge.source,
              target: typeof edge.target === 'object' ? edge.target.id : edge.target,
              name: edge.name || 'Related',
            })),
          },
        };

        await gateway.post('/api/sessions/save', payload);
        store.refreshSummariesOnly();

        await gateway.post(`/api/analytics/${store.operatorId}`, {
          studyData: store.weeklyEffortMetrics,
          studyHistory: store.chronometerLog,
          currentStreak: store.consecutiveDaysStreak,
          sessionsCompleted: store.completedWorkspacesCount,
          goals: store.cognitiveTargets,
        });
      } catch (err) {
        console.error('Cloud synchronization failure:', err);
      }
    }, 2500);

    return () => clearTimeout(debounceHandleRef.current);
  }, [
    store.dialogueHistory,
    store.conceptTopology,
    store.activeTheme,
    store.referencedArtifacts,
    store.weeklyEffortMetrics,
    store.chronometerLog,
    store.cognitiveTargets,
    store.consecutiveDaysStreak,
    store.completedWorkspacesCount,
    store.isHydrated,
    store.isSwitchingWorkspace,
    store.workspaceId,
    store.operatorId,
  ]);
}
