import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Sparkles, 
  Upload, 
  Play, 
  Download, 
  BookmarkPlus, 
  Layers, 
  RefreshCw, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Clock,
  RotateCcw,
  X
} from 'lucide-react';
import { User } from 'firebase/auth';
import { saveUserCreation } from '../lib/firebase';

interface VideoWorkspaceProps {
  user: User | null;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ user }) => {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [selectedModel, setSelectedModel] = useState<string>('veo-3.1-fast-generate-preview');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/png');
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const samplePrompts = [
    'A cinematic drone flight over a vibrant neon cyberpunk Tokyo street in soft rain',
    'A majestic golden eagle soaring above snow-capped Himalayan mountain peaks at sunrise',
    'A cute robotic red panda exploring an enchanted glowing mystical forest with fireflies',
    'Futuristic hyperloop train speeding across an ocean sunset bridge, 4k cinematic',
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && mode === 'text') {
      setError('Please provide a prompt describing the video.');
      return;
    }

    if (mode === 'image' && !imagePreview) {
      setError('Please upload a source image to animate.');
      return;
    }

    setError(null);
    setIsQuotaExceeded(false);
    setGenerating(true);
    setStatusMessage(`Submitting request to Veo 3 (${selectedModel})...`);

    try {
      const startRes = await fetch('/api/gemini/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim() || 'Cinematic smooth camera pan with vivid lighting and motion',
          aspectRatio,
          base64Image: mode === 'image' ? imagePreview : undefined,
          imageMimeType: mode === 'image' ? imageMimeType : undefined,
          model: selectedModel,
        }),
      });

      if (!startRes.ok) {
        const errJson = await startRes.json().catch(() => ({}));
        if (startRes.status === 429 || errJson.isQuotaExceeded) {
          setIsQuotaExceeded(true);
          setCooldownSeconds(45); // Start a 45-second cooldown
          throw new Error(errJson.error || 'Gemini API quota exceeded for video generation.');
        }
        throw new Error(errJson.error || `Server responded with status ${startRes.status}`);
      }

      const { operationName } = await startRes.json();
      if (!operationName) throw new Error('No operation ID returned from Veo 3');

      const messagesList = [
        'Veo 3 is rendering keyframes and lighting...',
        'Synthesizing temporal camera trajectories...',
        'Enhancing high-definition motion coherence...',
        'Encoding 1080p cinematic output...',
        'Finalizing video stream and metadata...',
      ];

      let isDone = false;
      let attempts = 0;
      const maxAttempts = 60;

      while (!isDone && attempts < maxAttempts) {
        attempts++;
        const msgIdx = Math.min(attempts % messagesList.length, messagesList.length - 1);
        setStatusMessage(messagesList[msgIdx]);

        await new Promise((resolve) => setTimeout(resolve, 5000));

        const statusRes = await fetch('/api/gemini/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName }),
        });

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.error) {
            throw new Error(statusData.error.message || 'Error occurred during generation');
          }
          if (statusData.done) {
            isDone = true;
            break;
          }
        }
      }

      if (!isDone) {
        throw new Error('Video generation timed out. Please try again.');
      }

      setStatusMessage('Downloading rendered video from Veo...');
      const downloadRes = await fetch('/api/gemini/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });

      if (!downloadRes.ok) {
        const errData = await downloadRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download generated video');
      }

      const blob = await downloadRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      setVideoBlobUrl(blobUrl);
      setStatusMessage('Video generated successfully!');

      if (user) {
        await saveUserCreation({
          type: 'video',
          title: prompt.slice(0, 40) || 'Veo 3 Video',
          prompt,
          aspectRatio,
          model: selectedModel,
          metadata: JSON.stringify({ mode, timestamp: new Date().toISOString() }),
        });
      }
    } catch (err: any) {
      console.error('Video error:', err);
      const msg = err.message || 'Video generation failed';
      if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        setIsQuotaExceeded(true);
        if (cooldownSeconds === 0) setCooldownSeconds(45);
      }
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      alert('Please sign in with Google to save to Firestore.');
      return;
    }
    try {
      await saveUserCreation({
        type: 'video',
        title: prompt.slice(0, 50) || 'Veo 3 Generated Video',
        prompt,
        aspectRatio,
        model: selectedModel,
        metadata: JSON.stringify({ mode, date: new Date().toISOString() }),
      });
      alert('Video metadata saved to your Firestore collection!');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-100 via-indigo-50 to-slate-100 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-colors shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
              <Video className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Veo 3 Video Studio</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-semibold">
              {selectedModel}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate high-definition cinematic videos from text prompts or animate uploaded photos with Veo 3.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-950 rounded-2xl border border-slate-300 dark:border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              mode === 'text'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Text to Video
          </button>
          <button
            onClick={() => setMode('image')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              mode === 'image'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Image to Video
          </button>
        </div>
      </div>

      {/* Quota Exceeded Special Banner */}
      {isQuotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-5 shadow-sm space-y-3 text-slate-800 dark:text-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Gemini API Rate Limit / Quota Cooldown (HTTP 429)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Video generation models like <strong>Veo 3</strong> require heavy GPU compute and enforce strict requests-per-minute (RPM) and daily quotas on the attached Gemini API key.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsQuotaExceeded(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-200 dark:border-amber-800/60 text-xs">
            {cooldownSeconds > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-medium">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                Cooldown: {cooldownSeconds}s remaining before next attempt
              </span>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition shadow"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Generation Now</span>
              </button>
            )}

            <a
              href="https://ai.dev/rate-limit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Monitor Rate Limits (ai.dev)</span>
            </a>

            <a
              href="https://ai.google.dev/gemini-api/docs/rate-limits"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:underline"
            >
              <span>Learn about Gemini API quotas</span>
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Panel */}
        <div className="lg:col-span-6 space-y-4">
          {/* Model Selection */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Veo Model Selection</span>
              <span className="text-[10px] text-slate-400">Primary: veo-3.1-fast-generate-preview</span>
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="veo-3.1-fast-generate-preview">veo-3.1-fast-generate-preview (Fastest Preview)</option>
              <option value="veo-3.1-lite-generate-preview">veo-3.1-lite-generate-preview (Standard Lite)</option>
              <option value="veo-3.1-generate-preview">veo-3.1-generate-preview (High Quality)</option>
            </select>
          </div>

          {mode === 'image' && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Upload Source Photo to Animate
                </label>
                {imagePreview && (
                  <button
                    onClick={() => setImagePreview(null)}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                )}
              </div>

              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-56 flex items-center justify-center bg-black">
                  <img src={imagePreview} alt="Source" className="max-h-56 object-contain" />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition group"
                >
                  <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 mx-auto mb-2 transition" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Click or drag & drop photo here</p>
                  <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, WebP supported</p>
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
          )}

          {/* Prompt Input */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Video Motion & Scene Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={
                mode === 'image'
                  ? 'Describe motion (e.g., Camera slowly zooms into the subject as light sparkles)'
                  : 'Describe scene, lighting, action, atmosphere, and cinematic style...'
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sample Prompts:</span>
              <div className="flex flex-wrap gap-1.5">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="text-[10px] text-left px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 transition line-clamp-1 max-w-full"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> Aspect Ratio (Veo Constraint)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                  aspectRatio === '16:9'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="w-12 h-7 rounded border border-current flex items-center justify-center text-[10px] font-mono">
                  16:9
                </div>
                <span className="text-xs font-semibold">Landscape (16:9)</span>
                <span className="text-[10px] text-slate-500">YouTube, Desktop</span>
              </button>

              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                  aspectRatio === '9:16'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="w-7 h-12 rounded border border-current flex items-center justify-center text-[10px] font-mono">
                  9:16
                </div>
                <span className="text-xs font-semibold">Portrait (9:16)</span>
                <span className="text-[10px] text-slate-500">TikTok, Reels, Shorts</span>
              </button>
            </div>
          </div>

          {error && !isQuotaExceeded && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || cooldownSeconds > 0}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Veo 3 Is Rendering Video...</span>
              </>
            ) : cooldownSeconds > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Rate limit cooldown ({cooldownSeconds}s)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Video with Veo 3</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Panel */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex-1 flex flex-col items-center justify-center min-h-[400px] shadow-sm transition-colors">
            {generating ? (
              <div className="text-center space-y-4 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 animate-pulse">
                  <Video className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Veo 3 Generating Video</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1 font-mono">{statusMessage}</p>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full w-2/3 animate-pulse" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Veo video synthesis typically takes 1 to 2 minutes. Feel free to explore other tabs while it renders.
                </p>
              </div>
            ) : videoBlobUrl ? (
              <div className="w-full space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black aspect-video flex items-center justify-center">
                  <video
                    src={videoBlobUrl}
                    controls
                    autoPlay
                    loop
                    className={`max-h-[420px] w-full ${aspectRatio === '9:16' ? 'max-w-[260px]' : 'w-full'} object-contain`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Rendered successfully in {aspectRatio}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={videoBlobUrl}
                      download={`veo3_video_${Date.now()}.mp4`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download MP4</span>
                    </a>
                    <button
                      onClick={handleSaveToFirestore}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>Save Record</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto">
                  <Video className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Video Generated Yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter a prompt or upload an image and click "Generate Video with Veo 3" to create cinema-grade video.
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
