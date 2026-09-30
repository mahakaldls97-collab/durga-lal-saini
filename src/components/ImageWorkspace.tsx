import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Sparkles, 
  Upload, 
  Download, 
  BookmarkPlus, 
  RefreshCw, 
  Sliders, 
  Wand2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  RotateCcw,
  ExternalLink 
} from 'lucide-react';
import { User } from 'firebase/auth';
import { saveUserCreation } from '../lib/firebase';

interface ImageWorkspaceProps {
  user: User | null;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({ user }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceMimeType, setSourceMimeType] = useState<string>('image/png');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isFreeTierZero, setIsFreeTierZero] = useState(false);
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

  const aspectRatios = [
    { label: 'Square (1:1)', value: '1:1', desc: 'Instagram, Avatars' },
    { label: 'Landscape (16:9)', value: '16:9', desc: 'Thumbnails, Banners' },
    { label: 'Portrait (9:16)', value: '9:16', desc: 'Mobile, Stories' },
    { label: 'Standard (4:3)', value: '4:3', desc: 'Photography' },
    { label: 'Vertical (3:4)', value: '3:4', desc: 'Posters' },
  ];

  const samplePrompts = [
    'A surreal floating island with crystal waterfalls under a nebula sky, digital art, high fidelity',
    'A cute cybernetic golden retriever wearing aviator goggles in a futuristic laboratory',
    'Macro photography of an intricate glowing lotus flower made of blown stained glass with water droplets',
    'Studio portrait of a serene astronaut with reflection of the Earth in their golden helmet visor',
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSourceMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateOrEdit = async () => {
    if (!prompt.trim()) {
      setError('Please provide a prompt describing the image you want to create or edit.');
      return;
    }

    setError(null);
    setIsQuotaExceeded(false);
    setIsFreeTierZero(false);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          base64InputImage: sourceImage || undefined,
          inputMimeType: sourceMimeType,
          aspectRatio,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 429 || errJson.isQuotaExceeded) {
          setIsQuotaExceeded(true);
          setIsFreeTierZero(Boolean(errJson.isFreeTierZeroQuota));
          setCooldownSeconds(errJson.retryDelaySeconds || 35);
          throw new Error(errJson.error || 'Gemini API quota exceeded for image generation.');
        }
        throw new Error(errJson.error || 'Image generation failed');
      }

      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setGeneratedText(data.text || null);
      } else {
        setGeneratedText(data.text || 'Generated description');
      }

      if (user && data.imageUrl) {
        await saveUserCreation({
          type: 'image',
          title: prompt.slice(0, 45) || 'Gemini Generated Image',
          prompt,
          mediaUrl: data.imageUrl,
          aspectRatio,
          model: data.modelUsed || selectedModel,
          metadata: JSON.stringify({
            edited: Boolean(sourceImage),
            timestamp: new Date().toISOString(),
          }),
        });
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      const msg = err.message || 'Image generation failed';
      if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        setIsQuotaExceeded(true);
        if (cooldownSeconds === 0) setCooldownSeconds(35);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!user) {
      alert('Please sign in with Google to save this image to your Firestore library.');
      return;
    }
    if (!generatedImage) return;

    try {
      await saveUserCreation({
        type: 'image',
        title: prompt.slice(0, 50) || 'Gemini Image',
        prompt,
        mediaUrl: generatedImage,
        aspectRatio,
        model: selectedModel,
        metadata: JSON.stringify({
          edited: Boolean(sourceImage),
          savedAt: new Date().toISOString(),
        }),
      });
      alert('Image successfully saved to your Firestore collection!');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Studio Header */}
      <div className="bg-gradient-to-r from-slate-100 via-purple-50 to-slate-100 dark:from-slate-900 dark:via-purple-950/40 dark:to-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-colors shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <Wand2 className="w-5 h-5" />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Image Creation & Editing Studio</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/30 font-semibold">
            {selectedModel}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Create photorealistic or stylized imagery from text prompts, or upload an image and prompt Gemini to transform and edit it.
        </p>
      </div>

      {/* Quota / Billing Notice Card */}
      {isQuotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-5 shadow-sm space-y-3 text-slate-800 dark:text-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  {isFreeTierZero ? 'Gemini Paid Model / Quota Notice (HTTP 429)' : 'Gemini API Rate Limit Cooldown (HTTP 429)'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {isFreeTierZero
                    ? 'Image generation models (gemini-3.1-flash-image) have a quota limit of 0 on the Free Tier and require a project with billing enabled. If you just selected or linked a key, please allow a short cooldown period.'
                    : 'The Gemini image generation rate limit has been reached for the current minute. You can retry as soon as the countdown finishes.'}
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
                onClick={handleGenerateOrEdit}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition shadow"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Generation Now</span>
              </button>
            )}

            <a
              href="https://ai.dev/rate-limit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Check Usage & Rate Limits (ai.dev)</span>
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
        {/* Left Inputs */}
        <div className="lg:col-span-6 space-y-4">
          {/* Model Selector */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Image Model</span>
              <span className="text-[10px] text-slate-400">Primary: gemini-3.1-flash-image-preview</span>
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
            >
              <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview (Recommended)</option>
              <option value="gemini-3.1-flash-lite-image">gemini-3.1-flash-lite-image (Fast Diffusion)</option>
              <option value="imagen-3.0-generate-002">imagen-3.0-generate-002 (Imagen 3 Text-to-Image)</option>
            </select>
          </div>

          {/* Reference Image */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" /> Reference or Base Photo (Optional for Editing)
              </label>
              {sourceImage && (
                <button
                  onClick={() => setSourceImage(null)}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>

            {sourceImage ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-48 flex items-center justify-center bg-black">
                <img src={sourceImage} alt="Base" className="max-h-48 object-contain" />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition group"
              >
                <ImageIcon className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-purple-500 mx-auto mb-1.5 transition" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Upload an image to edit or enhance</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Leave empty to generate brand new image from text</p>
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

          {/* Prompt */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" /> Image Description / Edit Instructions
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={
                sourceImage
                  ? 'Describe edits (e.g. Change the background into a sunset beach, add sunglasses to the subject)'
                  : 'Describe subject, style, lighting, color palette, mood, and composition...'
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
            />

            <div className="space-y-1">
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
              <Sliders className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" /> Aspect Ratio
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.value}
                  type="button"
                  onClick={() => setAspectRatio(ar.value)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    aspectRatio === ar.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold">{ar.label}</div>
                  <div className="text-[10px] text-slate-500">{ar.desc}</div>
                </button>
              ))}
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
            onClick={handleGenerateOrEdit}
            disabled={loading || cooldownSeconds > 0}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Gemini is Creating / Editing Image...</span>
              </>
            ) : cooldownSeconds > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Rate limit cooldown ({cooldownSeconds}s)</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>{sourceImage ? 'Apply Edits to Image' : 'Generate Image with Gemini'}</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-6 flex flex-col">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex-1 flex flex-col items-center justify-center min-h-[400px] shadow-sm transition-colors">
            {loading ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400 animate-pulse">
                  <ImageIcon className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Rendering with Gemini</h3>
                  <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">Applying visual diffusion model...</p>
                </div>
              </div>
            ) : generatedImage ? (
              <div className="w-full space-y-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black flex items-center justify-center max-h-[460px]">
                  <img
                    src={generatedImage}
                    alt="Generated by Gemini"
                    className="max-h-[460px] object-contain rounded-xl"
                  />
                </div>

                {generatedText && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    "{generatedText}"
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Created in {aspectRatio}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={generatedImage}
                      download={`gemini_image_${Date.now()}.png`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Image</span>
                    </a>
                    <button
                      onClick={handleSaveToFirestore}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                      <span>Save to Firestore</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Image Generated Yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Describe any scene or upload an existing image to apply edits, stylization, or object transformations.
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
