import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  Radio, 
  Activity, 
  Send, 
  PhoneOff, 
  Info,
  AlertCircle
} from 'lucide-react';
import { User } from 'firebase/auth';

interface LiveVoiceWorkspaceProps {
  user: User | null;
}

export const LiveVoiceWorkspace: React.FC<LiveVoiceWorkspaceProps> = ({ user }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [statusText, setStatusText] = useState('Ready to connect to Gemini 3.8 Live API');
  const [transcript, setTranscript] = useState<{ sender: 'user' | 'gemini'; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const floatTo16BitPCMBase64 = (input: Float32Array): string => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(output.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playAudioChunk = async (base64Data: string) => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();

      setIsTalking(true);
      source.onended = () => {
        setIsTalking(false);
      };
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  const startLiveSession = async () => {
    setError(null);
    setStatusText('Requesting microphone access and initializing session...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live-api`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatusText('Live Voice session connected! Speak naturally into your microphone.');

        const micSource = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMicMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const base64PCM = floatTo16BitPCMBase64(inputData);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ audio: base64PCM }));
          }
        };

        micSource.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            playAudioChunk(msg.audio);
          }
          if (msg.interrupted) {
            setIsTalking(false);
          }
          if (msg.error) {
            setError(msg.error);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('Live WS error:', e);
        setError('Failed to connect to Live API WebSocket. Ensure the server is running.');
        stopLiveSession();
      };

      ws.onclose = () => {
        setIsConnected(false);
        setStatusText('Live session disconnected.');
      };
    } catch (err: any) {
      console.error('Session setup error:', err);
      setError(err.message || 'Microphone access denied or connection failed.');
      setStatusText('Session failed to start');
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsConnected(false);
    setIsTalking(false);
    setStatusText('Session ended');
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const handleSendTextCompanion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ text: textInput.trim() }));
    setTranscript((prev) => [...prev, { sender: 'user', text: textInput.trim() }]);
    setTextInput('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Studio Header */}
      <div className="bg-gradient-to-r from-slate-100 via-rose-50 to-slate-100 dark:from-slate-900 dark:via-rose-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-colors shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Gemini 3.8 Live Voice Studio</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold">
            gemini-3.8-live
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Experience real-time low-latency voice conversations. Talk through your microphone and receive natural spoken responses streamed directly from Gemini Live.
        </p>
      </div>

      {/* Main Live Voice Visualizer Card */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden shadow-sm transition-colors">
        {/* Glow backdrop */}
        <div className={`absolute -inset-10 opacity-30 blur-3xl pointer-events-none transition-all duration-700 ${
          isTalking ? 'bg-rose-500/40' : isConnected ? 'bg-indigo-500/30' : 'bg-transparent'
        }`} />

        {/* Dynamic Voice Sphere */}
        <div className="relative">
          <div className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
            isTalking 
              ? 'bg-gradient-to-tr from-rose-500 to-pink-500 shadow-rose-500/50 scale-110' 
              : isConnected 
              ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-indigo-500/40 animate-pulse' 
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
          }`}>
            {isTalking ? (
              <Volume2 className="w-16 h-16 text-white animate-bounce" />
            ) : isConnected ? (
              <Activity className="w-16 h-16 text-white animate-pulse" />
            ) : (
              <MicOff className="w-14 h-14 text-slate-400 dark:text-slate-600" />
            )}
          </div>

          {isTalking && (
            <>
              <div className="absolute -inset-4 rounded-full border-2 border-rose-400/40 animate-ping pointer-events-none" />
              <div className="absolute -inset-8 rounded-full border border-pink-400/20 animate-pulse pointer-events-none" />
            </>
          )}
        </div>

        {/* Status indicator */}
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${
              isTalking 
                ? 'bg-rose-500 animate-ping' 
                : isConnected 
                ? 'bg-emerald-500 animate-pulse' 
                : 'bg-slate-400 dark:bg-slate-500'
            }`} />
            <span className="text-slate-700 dark:text-slate-200">
              {isTalking ? 'Gemini is speaking...' : isConnected ? 'Listening to your microphone' : 'Session Inactive'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{statusText}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
          {!isConnected ? (
            <button
              onClick={startLiveSession}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-rose-600/30 hover:opacity-95 transition active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>Start Real-Time Voice Conversation</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 border transition ${
                  isMicMuted 
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300' 
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
              </button>

              <button
                onClick={stopLiveSession}
                className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition active:scale-95"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Conversation</span>
              </button>
            </>
          )}
        </div>

        {isConnected && (
          <form onSubmit={handleSendTextCompanion} className="w-full max-w-md flex items-center gap-2 mt-4 relative z-10">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type a prompt directly to Live API..."
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-rose-500 transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>

      <div className="bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2 shadow-sm transition-colors">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-300">
          <Info className="w-4 h-4 text-rose-500 dark:text-rose-400" /> Live API Architecture:
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
          <li><strong>Audio Ingestion:</strong> Continuous 16kHz PCM streaming from your browser microphone to the backend WebSocket server.</li>
          <li><strong>Audio Playback:</strong> Model speaks with natural human prosody using 24kHz PCM stream processed by Web Audio API.</li>
          <li><strong>Interruption Support:</strong> If you start speaking while Gemini is talking, the model automatically halts speech and listens.</li>
        </ul>
      </div>
    </div>
  );
};
