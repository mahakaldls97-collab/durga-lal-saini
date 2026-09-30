/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, testConnection } from './lib/firebase';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { VideoWorkspace } from './components/VideoWorkspace';
import { ImageWorkspace } from './components/ImageWorkspace';
import { LiveVoiceWorkspace } from './components/LiveVoiceWorkspace';
import { TranscribeWorkspace } from './components/TranscribeWorkspace';
import { MusicWorkspace } from './components/MusicWorkspace';
import { CreationsGallery } from './components/CreationsGallery';

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [user, setUser] = useState<User | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);

  useEffect(() => {
    // 1. Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // 2. Validate Firestore connection on boot
    testConnection().then((connected) => {
      setIsDbConnected(connected);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      alert(`Sign in: ${err.message || 'Google Popup was closed or cancelled.'}`);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* Top App Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isDbConnected={isDbConnected}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 w-full pb-8">
        {activeTab === 'chat' && <ChatWorkspace user={user} />}
        {activeTab === 'video' && <VideoWorkspace user={user} />}
        {activeTab === 'image' && <ImageWorkspace user={user} />}
        {activeTab === 'live' && <LiveVoiceWorkspace user={user} />}
        {activeTab === 'transcribe' && <TranscribeWorkspace user={user} />}
        {activeTab === 'music' && <MusicWorkspace user={user} />}
        {activeTab === 'gallery' && (
          <CreationsGallery user={user} onSignIn={handleSignIn} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-2 transition-colors">
        <p>Creative Studio • Powered by Gemini 3.8, Veo 3, Lyria, and Firebase</p>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Firestore Enterprise</span>
          <span>•</span>
          <span>Google Workspace & AI Studio</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
