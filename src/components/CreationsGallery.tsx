import React, { useState, useEffect } from 'react';
import { 
  FolderHeart, 
  Video, 
  Image as ImageIcon, 
  Music, 
  FileAudio, 
  MessageSquare, 
  Trash2, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  LogIn, 
  Copy, 
  Check 
} from 'lucide-react';
import { User } from 'firebase/auth';
import { getUserCreations, deleteUserCreation, UserCreationItem } from '../lib/firebase';

interface CreationsGalleryProps {
  user: User | null;
  onSignIn: () => void;
}

export const CreationsGallery: React.FC<CreationsGalleryProps> = ({ user, onSignIn }) => {
  const [creations, setCreations] = useState<UserCreationItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCreations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await getUserCreations(user.uid);
      setCreations(items);
    } catch (err) {
      console.error('Failed to load creations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadCreations();
    } else {
      setCreations([]);
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this creation from your Firestore library?')) return;
    try {
      await deleteUserCreation(id);
      setCreations((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete creation:', err);
    }
  };

  const filteredItems = creations.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
      case 'music': return <Music className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
      case 'transcription': return <FileAudio className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
      default: return <MessageSquare className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl mt-8 shadow-sm transition-colors">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center mx-auto">
          <FolderHeart className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Your Firestore Saved Creations Library</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Sign in with your Google account to synchronize, save, and manage your Veo videos, Gemini images, Lyria music, transcripts, and chat sessions.
        </p>
        <button
          onClick={onSignIn}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 hover:opacity-95 transition"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30">
              <FolderHeart className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Saved Library (Firestore)</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Persistent cloud storage for your generated AI assets, synchronized across devices.
          </p>
        </div>

        <button
          onClick={loadCreations}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'all', label: 'All Items' },
          { id: 'video', label: 'Veo Videos' },
          { id: 'image', label: 'Images' },
          { id: 'music', label: 'Lyria Music' },
          { id: 'transcription', label: 'Transcriptions' },
          { id: 'chat_export', label: 'Chat Sessions' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
              filter === tab.id
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading saved items from Firestore...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center text-slate-400 dark:text-slate-500 space-y-2 shadow-sm transition-colors">
          <FolderHeart className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No creations found in this category</p>
          <p className="text-xs text-slate-500">
            Generate videos, images, music, or transcripts and click "Save" to build your library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-400 dark:hover:border-slate-700 transition shadow-sm space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {getIcon(item.type)}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {item.type}
                    </span>
                  </div>
                  {item.model && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-800 font-semibold">
                      {item.model}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</h4>

                {item.prompt && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 italic">
                    "{item.prompt}"
                  </p>
                )}

                {item.mediaUrl && item.type === 'image' && (
                  <div className="mt-2 rounded-xl overflow-hidden max-h-48 border border-slate-200 dark:border-slate-800 bg-black flex items-center justify-center">
                    <img src={item.mediaUrl} alt={item.title} className="max-h-48 object-contain" />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">ID: {item.id.slice(0, 10)}...</span>
                <button
                  onClick={() => handleDelete(item.id)}
                  title="Delete from Firestore"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
