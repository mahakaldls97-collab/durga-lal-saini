import React, { useState, useRef } from 'react';
import { 
  FileAudio, 
  Mic, 
  Square, 
  Upload, 
  Copy, 
  Check, 
  Download, 
  BookmarkPlus, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  Trash2 
} from 'lucide-react';
import { User } from 'firebase/auth';
import { saveUserCreation } from '../lib/firebase';

interface TranscribeWorkspaceProps {
  user: User | null;
}

export const TranscribeWorkspace: React.FC<TranscribeWorkspaceProps> = ({ user }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const playUrl = URL.createObjectURL(audioBlob);
        setAudioPlaybackUrl(playUrl);
        setAudioMimeType('audio/webm');

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setAudioBase64(base64);
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic error:', err);
      setError('Microphone access denied or audio device not found.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioMimeType(file.type || 'audio/mp3');
    setAudioPlaybackUrl(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onload = (event) => {
      setAudioBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleTranscribe = async () => {
    if (!audioBase64) {
      setError('Please record or upload an audio file first.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioMimeType,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Audio transcription failed');
      }

      const data = await res.json();
      setTranscription(data.transcription || '');

      if (user && data.transcription) {
        await saveUserCreation({
          type: 'transcription',
          title: `Transcription: ${data.transcription.slice(0, 35)}...`,
          prompt: 'Microphone / Audio input',
          metadata: JSON.stringify({
            duration: recordingDuration,
            textSnippet: data.transcription,
            date: new Date().toISOString(),
          }),
        });
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(err.message || 'Transcription failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${Date.now()}.txt`;
    a.click();
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      alert('Please sign in with Google to save to Firestore.');
      return;
    }
    if (!transcription) return;

    try {
      await saveUserCreation({
        type: 'transcription',
        title: `Transcript: ${transcription.slice(0, 40)}`,
        prompt: 'Audio Speech-to-Text',
        metadata: JSON.stringify({
          transcript: transcription,
          savedAt: new Date().toISOString(),
        }),
      });
      alert('Transcription saved to Firestore library!');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Studio Header */}
      <div className="bg-gradient-to-r from-slate-100 via-emerald-50 to-slate-100 dark:from-slate-900 dark:via-emerald-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-colors shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <FileAudio className="w-5 h-5" />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Audio Transcription Studio</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
            gemini-3.5-transcribe
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Record with your microphone or upload any audio file. The specialized gemini-3.5-transcribe model outputs clean, verbatim text.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Input Panel: Record or Upload */}
        <div className="space-y-4">
          {/* Mic Recorder Card */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-sm transition-colors">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-500 shadow-xl shadow-red-500/40 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              <Mic className={`w-10 h-10 ${isRecording ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            </div>

            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isRecording ? `Recording... (${formatTimer(recordingDuration)})` : 'Microphone Voice Input'}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRecording ? 'Click stop when finished speaking' : 'Click the button below to start talking'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition active:scale-95"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 flex items-center gap-2 transition active:scale-95 animate-pulse"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop Recording</span>
                </button>
              )}
            </div>
          </div>

          {/* Or File Upload Card */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> Or Upload Pre-Recorded Audio
              </span>
              <span className="text-[10px] text-slate-500">MP3, WAV, WEBM, M4A</span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition"
            >
              <FileAudio className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Click to choose an audio file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Audio Preview if available */}
          {audioPlaybackUrl && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm transition-colors">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Audio Preview Ready</span>
                <button
                  onClick={() => {
                    setAudioPlaybackUrl(null);
                    setAudioBase64(null);
                  }}
                  className="text-red-500 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Trash2 className="w-3 h-3" /> Clear Audio
                </button>
              </div>
              <audio src={audioPlaybackUrl} controls className="w-full h-10 rounded-lg" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Transcribe Button */}
          <button
            type="button"
            onClick={handleTranscribe}
            disabled={loading || !audioBase64}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Transcribing with gemini-3.5-transcribe...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Transcribe Audio Recording</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Panel */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col justify-between min-h-[380px] shadow-sm transition-colors">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Transcribed Text
              </span>
              {transcription && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 transition"
                    title="Copy text"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 transition"
                    title="Download TXT"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>TXT</span>
                  </button>
                  <button
                    onClick={handleSaveToFirestore}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 transition"
                    title="Save to Firestore"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-500 dark:text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Processing audio with gemini-3.5-transcribe model...</p>
              </div>
            ) : transcription ? (
              <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                {transcription}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <FileAudio className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Transcription will appear here</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-600">
                  Speak into the mic or upload an audio file to start transcribing.
                </p>
              </div>
            )}
          </div>

          {transcription && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>{transcription.split(/\s+/).filter(Boolean).length} words</span>
              <span>{transcription.length} characters</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
