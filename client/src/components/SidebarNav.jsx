import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Network,
  Clock,
  BarChart2,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LogOut,
  X,
  Compass,
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useWorkspaceStore } from '../stores/workspaceStore';

export default function SidebarNav({ isOpen, onClose, userProfile, onSignOut, onLoginSuccess }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const {
    workspaceSummaries,
    workspaceId,
    switchWorkspace,
    spawnNewWorkspace,
  } = useWorkspaceStore();

  const primaryNavigationRoutes = [
    { destination: '/chat', label: 'Dialogue Space', icon: MessageSquare },
    { destination: '/graph', label: 'Neural Topology', icon: Network },
    { destination: '/focus', label: 'Deep Work Chrono', icon: Clock },
    { destination: '/analytics', label: 'Cognitive Telemetry', icon: BarChart2 },
    { destination: '/settings', label: 'Preferences', icon: Settings },
  ];

  const handleWorkspaceSelect = (targetId) => {
    switchWorkspace(targetId);
    navigate('/chat');
    if (window.innerWidth < 768) onClose();
  };

  const handleSpawnFreshWorkspace = () => {
    spawnNewWorkspace();
    navigate('/chat');
    if (window.innerWidth < 768) onClose();
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-surface-900 border-r border-surface-800/80 flex flex-col transition-all duration-300 md:static ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${collapsed ? 'w-20' : 'w-72'}`}
    >
      {/* Top Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-surface-800/80 shrink-0">
        <div className={`flex items-center gap-2.5 ${collapsed ? 'hidden' : 'flex'}`}>
          <Compass className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-sm tracking-wide text-slate-200">Navigation Hub</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 ml-auto"
          aria-label="Toggle sidebar expansion"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* New Workspace Trigger */}
      <div className="p-3 shrink-0">
        <button
          onClick={handleSpawnFreshWorkspace}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-900/20 active:scale-98 transition-all"
          title="Initialize Fresh Cognitive Workspace"
        >
          <Plus className="w-4 h-4" />
          <span className={collapsed ? 'hidden' : 'inline'}>New Session</span>
        </button>
      </div>

      {/* Nav Links */}
      <nav className="px-3 py-2 space-y-1 shrink-0 border-b border-surface-800/50">
        {primaryNavigationRoutes.map((route) => {
          const Icon = route.icon;
          return (
            <NavLink
              key={route.destination}
              to={route.destination}
              onClick={() => {
                if (window.innerWidth < 768) onClose();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:bg-surface-850 hover:text-slate-200'
                } ${collapsed ? 'justify-center' : 'justify-start'}`
              }
              title={route.label}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className={collapsed ? 'hidden' : 'inline'}>{route.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Recent Workspaces List */}
      <div className="flex-1 overflow-y-auto hub-scrollbar p-3 space-y-1">
        <div
          className={`text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 mb-2 font-bold ${
            collapsed ? 'hidden' : 'block'
          }`}
        >
          Recent Workspaces
        </div>

        {workspaceSummaries && workspaceSummaries.length > 0 ? (
          workspaceSummaries.map((summary) => {
            const isCurrent = summary.sessionId === workspaceId;
            return (
              <button
                key={summary.sessionId}
                onClick={() => handleWorkspaceSelect(summary.sessionId)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                  isCurrent
                    ? 'bg-surface-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:bg-surface-850 hover:text-slate-200'
                } ${collapsed ? 'justify-center' : 'justify-start'}`}
                title={summary.topic}
              >
                <FolderKanban className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className={`truncate ${collapsed ? 'hidden' : 'inline'}`}>
                  {summary.topic || 'Untitled Workspace'}
                </span>
              </button>
            );
          })
        ) : (
          <div className={`p-4 text-center text-xs text-slate-600 ${collapsed ? 'hidden' : 'block'}`}>
            No stored sessions
          </div>
        )}
      </div>

      {/* User Auth Profile Footer */}
      <div className="p-3 border-t border-surface-800/80 bg-surface-950/40 shrink-0">
        {userProfile ? (
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={userProfile.picture}
                alt="Operator Avatar"
                className="w-8 h-8 rounded-full border border-surface-700 shrink-0"
              />
              <div className={`flex flex-col min-w-0 ${collapsed ? 'hidden' : 'block'}`}>
                <span className="text-xs font-semibold text-slate-200 truncate">{userProfile.name}</span>
                <span className="text-[10px] text-slate-500 truncate">{userProfile.email}</span>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className={`p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${
                collapsed ? 'hidden' : 'block'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className={`flex flex-col items-center ${collapsed ? 'hidden' : 'flex'}`}>
            <span className="text-[11px] text-slate-500 mb-2">Cloud sync inactive</span>
            <GoogleLogin
              onSuccess={onLoginSuccess}
              onError={() => console.error('Authentication rejected')}
              theme="filled_black"
              shape="pill"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
