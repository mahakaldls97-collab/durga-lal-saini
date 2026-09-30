import React from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Video, 
  Image as ImageIcon, 
  Mic2, 
  FileAudio, 
  Music, 
  FolderHeart, 
  LogIn, 
  LogOut, 
  Sun,
  Moon,
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isDbConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onSignIn,
  onSignOut,
  isDbConnected,
}) => {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { id: 'chat', label: 'Gemini Chat', icon: MessageSquare, badge: 'Pro/Flash' },
    { id: 'video', label: 'Veo Video', icon: Video, badge: 'Veo 3' },
    { id: 'image', label: 'Image Studio', icon: ImageIcon, badge: 'Gen & Edit' },
    { id: 'live', label: 'Live Voice', icon: Mic2, badge: '3.8 Live' },
    { id: 'transcribe', label: 'Transcribe', icon: FileAudio, badge: 'Speech-to-Text' },
    { id: 'music', label: 'Lyria Music', icon: Music, badge: 'Lyria' },
    { id: 'gallery', label: 'Saved Library', icon: FolderHeart, badge: 'Firestore' },
  ];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('chat')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 dark:from-white dark:via-indigo-100 dark:to-indigo-300 bg-clip-text text-transparent">
                  Creative Studio
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30">
                  Full AI Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Veo 3 • Live API • Lyria • Maps & Search Grounding</p>
            </div>
          </div>

          {/* Right Controls: Theme Toggle, Database Indicator & User Auth */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all flex items-center justify-center"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Database indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-[11px]">Firestore {isDbConnected ? 'Connected' : 'Connecting'}</span>
            </div>

            {user ? (
              <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 rounded-full pl-1.5 pr-3 py-1">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-indigo-500" 
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                    {user.displayName || 'Google User'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  title="Sign Out"
                  className="p-1 rounded-full text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 hover:opacity-95 transition active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
              </button>
            )}
          </div>
        </div>

        {/* Feature Tabs Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none border-t border-slate-200/80 dark:border-slate-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
