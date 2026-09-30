import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Sparkles, 
  Compass, 
  Search, 
  MapPin, 
  Cpu, 
  Trash2, 
  BookmarkPlus, 
  ExternalLink,
  ChevronDown,
  Settings2,
  Copy,
  Check
} from 'lucide-react';
import { User } from 'firebase/auth';
import { saveUserCreation } from '../lib/firebase';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  groundingMetadata?: any;
  timestamp: string;
}

interface ChatWorkspaceProps {
  user: User | null;
  onNotification?: (msg: string) => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ user, onNotification }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'model',
      content: 'Hello! I am your multi-model Gemini assistant. You can switch between **Gemini Pro**, **Flash**, and **Flash-Lite**, or enable **Google Search** and **Google Maps** grounding for live data. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>('gemini-3.5-flash');
  const [systemRole, setSystemRole] = useState<string>('general');
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string>('');
  const [groundingMode, setGroundingMode] = useState<'none' | 'search' | 'maps'>('none');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roles = [
    { id: 'general', name: 'General Assistant', instruction: 'You are an intelligent, helpful, and concise AI assistant.' },
    { id: 'coder', name: 'Software Architect', instruction: 'You are a senior full-stack software architect. Provide clean, secure, scalable TypeScript/Python code and best practices.' },
    { id: 'researcher', name: 'Research Analyst', instruction: 'You are an investigative research analyst. Provide deep insights, fact-based comparisons, and cited evidence.' },
    { id: 'guide', name: 'Local & Travel Guide', instruction: 'You are an experienced local travel guide. Provide detailed itineraries, landmark locations, and cultural tips.' },
    { id: 'creative', name: 'Creative Director', instruction: 'You are an imaginative creative director. Brainstorm concepts, script ideas, and vibrant narratives.' },
  ];

  const currentRoleObj = roles.find((r) => r.id === systemRole);
  const activeInstruction = customSystemInstruction || currentRoleObj?.instruction || '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const activeModel = groundingMode !== 'none' ? 'gemini-3.5-flash' : model;

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          model: activeModel,
          systemInstruction: activeInstruction,
          useSearch: groundingMode === 'search',
          useMaps: groundingMode === 'maps',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to get response');
      }

      const data = await res.json();
      const modelMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'model',
        content: data.reply || 'No response generated.',
        groundingMetadata: data.groundingMetadata,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Chat submit error:', err);
      const errorMessage: Message = {
        id: `msg_err_${Date.now()}`,
        role: 'model',
        content: `⚠️ Error: ${err.message || 'Something went wrong. Please check your connection.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear chat history?')) {
      setMessages([
        {
          id: 'init-fresh',
          role: 'model',
          content: 'Chat history cleared. How can I assist you next?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      alert('Please sign in with Google to save your chat session to Firestore.');
      return;
    }
    try {
      await saveUserCreation({
        type: 'chat_export',
        title: `Chat Session (${messages.length} messages)`,
        prompt: messages[messages.length - 2]?.content || 'Gemini Conversation',
        metadata: JSON.stringify({
          model,
          groundingMode,
          role: currentRoleObj?.name,
          transcriptSnippet: messages.slice(-4).map((m) => `${m.role}: ${m.content}`).join('\n\n'),
        }),
      });
      alert('Chat session successfully saved to your Firestore library!');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-6xl mx-auto p-4 gap-3">
      {/* Top Configuration Bar */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm transition-colors">
        {/* Model Selection */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Model:
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={groundingMode !== 'none'}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="gemini-3.5-flash">gemini-3.5-flash (General / Balanced)</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tasks)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast)</option>
          </select>
        </div>

        {/* System Role Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" /> Role:
          </span>
          <select
            value={systemRole}
            onChange={(e) => setSystemRole(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Grounding Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setGroundingMode('none')}
            className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium ${
              groundingMode === 'none'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setGroundingMode('search')}
            title="Search Grounding with Google Search via gemini-3.5-flash"
            className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium flex items-center gap-1 ${
              groundingMode === 'search'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300'
            }`}
          >
            <Search className="w-3 h-3" />
            Google Search
          </button>
          <button
            type="button"
            onClick={() => setGroundingMode('maps')}
            title="Maps Grounding with Google Maps via gemini-3.5-flash"
            className={`px-2.5 py-1 rounded-lg transition text-[11px] font-medium flex items-center gap-1 ${
              groundingMode === 'maps'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300'
            }`}
          >
            <MapPin className="w-3 h-3" />
            Google Maps
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveToFirestore}
            title="Save chat to Firestore"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 font-medium transition"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700/60 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Role description banner */}
      <div className="px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-xl flex items-center justify-between text-[11px] text-indigo-800 dark:text-indigo-300 transition-colors">
        <span className="truncate">
          <strong>System Prompt:</strong> {activeInstruction}
        </span>
        {groundingMode !== 'none' && (
          <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border border-indigo-500/30 font-medium">
            {groundingMode === 'search' ? 'Google Search Grounded' : 'Google Maps Grounded'}
          </span>
        )}
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 rounded-2xl bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-4 scrollbar-thin transition-colors">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm transition ${
                  isUser
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {isUser ? 'You' : 'Gemini'}
                  </span>
                  <div className="flex items-center gap-1.5 opacity-70 text-[10px]">
                    <span>{m.timestamp}</span>
                    <button
                      onClick={() => handleCopy(m.id, m.content)}
                      className="hover:opacity-100 transition"
                      title="Copy message"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="whitespace-pre-wrap leading-relaxed break-words font-sans">
                  {m.content}
                </div>

                {/* Grounding Metadata if present */}
                {m.groundingMetadata?.webSearchQueries && (
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                      <Search className="w-3 h-3 text-blue-500" /> Search queries executed:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {m.groundingMetadata.webSearchQueries.map((q: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 text-[10px]">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {m.groundingMetadata?.groundingChunks && (
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> Grounding Sources:
                    </span>
                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                      {m.groundingMetadata.groundingChunks.slice(0, 3).map((chunk: any, i: number) => (
                        <a
                          key={i}
                          href={chunk.web?.uri || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline truncate"
                        >
                          {chunk.web?.title || chunk.web?.uri || 'Grounded source citation'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>
                {groundingMode === 'search'
                  ? 'Searching the live web...'
                  : groundingMode === 'maps'
                  ? 'Retrieving Google Maps data...'
                  : 'Gemini is thinking...'}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Form */}
      <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            groundingMode === 'maps'
              ? 'Ask for locations, places, routes (e.g. Best cafes near Tokyo station)...'
              : groundingMode === 'search'
              ? 'Ask about current events, breaking news, or search queries...'
              : `Message ${model}...`
          }
          disabled={loading}
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
