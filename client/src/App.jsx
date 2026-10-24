import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { Toaster } from 'react-hot-toast';
import { Terminal } from 'lucide-react';

import { useWorkspaceStore } from './stores/workspaceStore';
import { useWorkspaceSynchronizer } from './hooks/useWorkspaceSynchronizer';

import ShellHeader from './components/ShellHeader';
import SidebarNav from './components/SidebarNav';
import ArtifactInspector from './components/ArtifactInspector';
import CompetencyEvaluator from './components/CompetencyEvaluator';

import DialogueView from './pages/DialogueView';
import TopologyView from './pages/TopologyView';
import ChronometerView from './pages/ChronometerView';
import TelemetryView from './pages/TelemetryView';
import PreferencesView from './pages/PreferencesView';

function ApplicationShell() {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [evaluatorOpen, setEvaluatorOpen] = useState(false);

  const {
    operatorId,
    setOperatorId,
    workspaceId,
    vendor,
    variant,
    hydrateFromBackend,
    resetStore,
  } = useWorkspaceStore();

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isGuestMode, setIsGuestMode] = useState(() => {
    return localStorage.getItem('isGuest') === 'true';
  });

  // Activate debounced synchronization engine
  useWorkspaceSynchronizer();

  useEffect(() => {
    if (userProfile?.email) {
      hydrateFromBackend(userProfile.email);
    }
  }, [userProfile?.email, hydrateFromBackend]);

  const onGoogleSuccess = (credentialResponse) => {
    const payload = jwtDecode(credentialResponse.credential);
    setUserProfile(payload);
    setIsGuestMode(false);
    localStorage.setItem('user', JSON.stringify(payload));
    localStorage.removeItem('isGuest');
    setOperatorId(payload.email);
    hydrateFromBackend(payload.email);
  };

  const handleGuestEntry = () => {
    setIsGuestMode(true);
    setUserProfile(null);
    localStorage.setItem('isGuest', 'true');
    localStorage.removeItem('user');
    setOperatorId('guest');
  };

  const handleSignOut = () => {
    setUserProfile(null);
    setIsGuestMode(false);
    resetStore();
  };

  const GOOGLE_CLIENT_ID =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '570543164189-e7g3mvf73dkbh179p9j2i56bvhj49qv2.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0B0F19',
            color: '#F8FAFC',
            border: '1px solid #1F2937',
            borderRadius: '16px',
            fontSize: '12px',
          },
        }}
      />

      {!userProfile && !isGuestMode ? (
        /* Gateway Authentication Screen */
        <div className="flex h-[100dvh] w-full bg-[#030712] items-center justify-center p-4">
          <div className="p-8 sm:p-10 rounded-3xl bg-surface-900/60 border border-surface-800 backdrop-blur-2xl max-w-sm w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-cyan-500/20">
              <Terminal className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-100">
                Intellect<span className="text-cyan-400">Hub</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Autonomous Knowledge & Synthesis Engine</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={() => console.error('Authentication Error')}
                  theme="filled_black"
                  shape="pill"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-surface-800" />
                <span className="text-[10px] font-mono uppercase text-slate-600">OR</span>
                <div className="flex-1 border-t border-surface-800" />
              </div>

              <button
                onClick={handleGuestEntry}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-850 hover:bg-surface-800 border border-surface-700/60 text-slate-300 text-xs font-semibold transition-colors shadow-sm"
              >
                Access as Guest
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Primary Authenticated Workspace Layout */
        <BrowserRouter>
          <div className="flex h-[100dvh] w-full bg-surface-950 font-sans overflow-hidden relative">
            <SidebarNav
              isOpen={sidebarVisible}
              onClose={() => setSidebarVisible(false)}
              userProfile={userProfile}
              onSignOut={handleSignOut}
              onLoginSuccess={onGoogleSuccess}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
              <ShellHeader
                onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
                onOpenArtifactInspector={() => setInspectorOpen(true)}
                onOpenEvaluator={() => setEvaluatorOpen(true)}
              />

              <main className="flex-1 overflow-hidden relative flex flex-col">
                <Routes>
                  <Route path="/" element={<Navigate to="/chat" replace />} />
                  <Route path="/chat" element={<DialogueView />} />
                  <Route path="/graph" element={<TopologyView />} />
                  <Route path="/focus" element={<ChronometerView />} />
                  <Route path="/analytics" element={<TelemetryView />} />
                  <Route path="/settings" element={<PreferencesView />} />
                </Routes>
              </main>

              {/* Artifact Inspector Drawer */}
              <ArtifactInspector
                isOpen={inspectorOpen}
                onClose={() => setInspectorOpen(false)}
              />

              {/* Competency Evaluator Modal */}
              {evaluatorOpen && (
                <CompetencyEvaluator
                  workspaceId={workspaceId}
                  operatorId={operatorId}
                  vendor={vendor}
                  variant={variant}
                  onClose={() => setEvaluatorOpen(false)}
                />
              )}
            </div>
          </div>
        </BrowserRouter>
      )}
    </GoogleOAuthProvider>
  );
}

export default ApplicationShell;
