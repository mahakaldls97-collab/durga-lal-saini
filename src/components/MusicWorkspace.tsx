import React, { useState, useRef } from 'react';
import { 
  Music, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  BookmarkPlus, 
  RefreshCw, 
  Sliders, 
  Volume2, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { User } from 'firebase/auth';
import { saveUserCreation } from '../lib/firebase';

interface MusicWorkspaceProps {
  user: User | null;
}

export const MusicWorkspace: React.FC<MusicWorkspaceProps> = ({ user }) => {
  const [prompt, setPrompt] = useState('');
  const [durationType, setDurationType] = useState<'clip' | 'full'>('clip');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleStyles = [
    'A nostalgic lo-fi hip hop beat with rain sounds and warm Rhodes piano',
    'Epic cinematic orchestral battle soundtrack with thunderous brass and taiko drums',
    '80s cyberpunk synthwave track with driving arpeggios and neon retro bass',
    'Upbeat acoustic indie folk song with acoustic guitar, tambourine, and gentle whistling',
    'Soothing ambient deep space meditation soundscape with cosmic pads and crystal chimes',
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMusic = async () => {
    if (!prompt.trim()) {
      setError('Please provide a music prompt describing the genre, mood, and instruments.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          durationType,
          base64Image: sourceImage || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Music generation failed');
      }

      const data = await res.json();

      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        const playUrl = URL.createObjectURL(blob);
        setAudioUrl(playUrl);
      }

      setLyrics(data.lyrics || '');

      if (user) {
        await saveUserCreation({
          type: 'music',
          title: prompt.slice(0, 45) || 'Lyria Generated Music',
          prompt,
          model: data.model,
          metadata: JSON.stringify({
            durationType,
            lyrics: data.lyrics,
            date: new Date().toISOString(),
          }),
        });
      }
    } catch (err: any) {
      console.error('Music error:', err);
      setError(err.message || 'Music generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      alert('Please sign in with Google to save to Firestore.');
      return;
    }
    try {
      await saveUserCreation({
        type: 'music',
        title: prompt.slice(0, 45) || 'Lyria Music Track',
        prompt,
        model: durationType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview',
        metadata: JSON.stringify({
          lyrics,
          savedAt: new Date().toISOString(),
        }),
      });
      alert('Music track saved to your Firestore library!');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Studio Header */}
      <div className="bg-gradient-to-r from-slate-100 via-amber-50 to-slate-100 dark:from-slate-900 dark:via-amber-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-colors shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Music className="w-5 h-5" />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Lyria Music Generator Studio</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold">
            lyria-3-clip-preview • lyria-3-pro-preview
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Synthesize original audio tracks and musical compositions using Google Lyria models. Generate short 30-second clips or full-length productions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs Panel */}
        <div className="lg:col-span-6 space-y-4">
          {/* Duration Selector */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Lyria Model & Track Length
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDurationType('clip')}
                className={`p-3 rounded-xl border text-left transition ${
                  durationType === 'clip'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">Short Clip (Up to 30s)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">lyria-3-clip-preview</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Ideal for intros, teasers & jingles</div>
              </button>

              <button
                type="button"
                onClick={() => setDurationType('full')}
                className={`p-3 rounded-xl border text-left transition ${
                  durationType === 'full'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">Full-Length Track</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">lyria-3-pro-preview</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Complete production track</div>
              </button>
            </div>
          </div>

          {/* Prompt */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Music Style & Mood Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Describe tempo, instruments, atmosphere, emotions, and genre..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
            />

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Inspiration Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {sampleStyles.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(s)}
                    className="text-[10px] text-left px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 transition line-clamp-1 max-w-full"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Image */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Image Inspiration (Optional)
              </span>
              {sourceImage && (
                <button
                  onClick={() => setSourceImage(null)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {sourceImage ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-32 flex items-center justify-center bg-black">
                <img src={sourceImage} alt="Music inspiration" className="max-h-32 object-contain" />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-xl p-3 text-center cursor-pointer bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition group"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">Click to attach an image to inspire the composition</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateMusic}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-600/30 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Lyria is Composing Music Track...</span>
              </>
            ) : (
              <>
                <Music className="w-4 h-4" />
                <span>Generate Music with Lyria</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Panel */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex-1 flex flex-col items-center justify-center min-h-[380px] shadow-sm transition-colors">
            {loading ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 animate-pulse">
                  <Music className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Synthesizing Lyria Audio</h3>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Generating harmonic waveforms and timbre...</p>
                </div>
              </div>
            ) : audioUrl ? (
              <div className="w-full space-y-5">
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <Volume2 className="w-8 h-8 text-white animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white capitalize">{prompt.slice(0, 45)}</h4>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                      {durationType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'}
                    </p>
                  </div>
                  <audio src={audioUrl} controls autoPlay className="w-full mt-2" />
                </div>

                {lyrics && (
                  <div className="bg-slate-50 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Generated Lyrics / Notes
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                      {lyrics}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Ready for playback
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={audioUrl}
                      download={`lyria_track_${Date.now()}.wav`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download WAV</span>
                    </a>
                    <button
                      onClick={handleSaveToFirestore}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>Save Record</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto">
                  <Music className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Music Generated Yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select clip length or full track, describe your desired sound or genre, and click Generate.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
