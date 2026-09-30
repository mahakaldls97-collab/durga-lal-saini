import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, GenerateVideosOperation, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to parse and humanize Google GenAI errors (especially 429 RESOURCE_EXHAUSTED)
function parseGenAiError(error: any): { 
  message: string; 
  isQuotaExceeded: boolean; 
  isFreeTierZeroQuota: boolean;
  retryDelaySeconds?: number;
  statusCode: number; 
  details?: any; 
  helpUrl: string;
} {
  const rawMsg = error?.message || String(error);
  let parsedJson: any = null;

  try {
    const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedJson = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // not valid JSON
  }

  const errData = parsedJson?.error || parsedJson || {};
  const code = errData.code || error?.status || error?.statusCode || 500;
  const status = errData.status || '';
  const isQuota = code === 429 || status === 'RESOURCE_EXHAUSTED' || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.toLowerCase().includes('quota');
  const isFreeTierZero = rawMsg.includes('limit: 0') || rawMsg.includes('FreeTier');

  // Extract retry delay if available
  let retrySeconds = 35;
  const delayMatch = rawMsg.match(/retry in ([0-9.]+)s/i) || rawMsg.match(/"retryDelay":\s*"([0-9]+)s"/i);
  if (delayMatch && delayMatch[1]) {
    retrySeconds = Math.ceil(parseFloat(delayMatch[1]));
  }

  let cleanMsg = errData.message || rawMsg;
  cleanMsg = cleanMsg.replace(/^ApiError:\s*/, '').trim();

  if (isQuota) {
    if (isFreeTierZero) {
      cleanMsg = 'Free tier quota for media generation models is 0. This model requires an API key with billing enabled in Google Cloud / AI Studio. If you recently enabled billing or switched keys, please wait a moment for the cooldown.';
    } else {
      cleanMsg = `You have reached your Gemini API rate limit for this model. Please wait ${retrySeconds} seconds before trying again.`;
    }
  }

  return {
    message: cleanMsg,
    isQuotaExceeded: isQuota,
    isFreeTierZeroQuota: isFreeTierZero,
    retryDelaySeconds: retrySeconds,
    statusCode: isQuota ? 429 : (typeof code === 'number' ? code : 500),
    details: errData.details,
    helpUrl: 'https://ai.google.dev/gemini-api/docs/rate-limits',
  };
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// 1. Multi-turn Chat & Search/Maps Grounding
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { 
      messages = [], 
      model = 'gemini-3.5-flash', 
      systemInstruction = '', 
      useSearch = false, 
      useMaps = false 
    } = req.body;

    const tools: any[] = [];
    if (useSearch) {
      tools.push({ googleSearch: {} });
    } else if (useMaps) {
      tools.push({ googleMaps: {} });
    }

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        tools: tools.length > 0 ? tools : undefined,
      },
    });

    const reply = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;

    res.json({ reply, groundingMetadata });
  } catch (error: any) {
    console.error('Chat error:', error);
    const formatted = parseGenAiError(error);
    res.status(formatted.statusCode).json({ 
      error: formatted.message,
      isQuotaExceeded: formatted.isQuotaExceeded,
      isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
      retryDelaySeconds: formatted.retryDelaySeconds,
      helpUrl: formatted.helpUrl,
    });
  }
});

// 2. Audio Transcription (gemini-3.5-transcribe)
app.post('/api/gemini/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 is required' });
      return;
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: cleanBase64,
            },
          },
          { text: 'Transcribe this audio recording into clean, accurate text. Include timestamps or speaker indicators if applicable.' },
        ],
      },
    });

    res.json({ transcription: response.text || '' });
  } catch (error: any) {
    console.error('Transcription error:', error);
    const formatted = parseGenAiError(error);
    res.status(formatted.statusCode).json({ 
      error: formatted.message,
      isQuotaExceeded: formatted.isQuotaExceeded,
      isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
      retryDelaySeconds: formatted.retryDelaySeconds,
      helpUrl: formatted.helpUrl,
    });
  }
});

// 3. Create & Edit Images (gemini-3.1-flash-image-preview with Imagen fallback)
app.post('/api/gemini/generate-image', async (req: Request, res: Response) => {
  const { 
    prompt, 
    base64InputImage, 
    inputMimeType = 'image/png', 
    aspectRatio = '1:1',
    model = 'gemini-3.1-flash-image-preview'
  } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Model cascade to try if quota hit
  const modelsToTry = [
    model || 'gemini-3.1-flash-image-preview',
    'gemini-3.1-flash-lite-image',
    'gemini-3.1-flash-image',
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const targetModel of modelsToTry) {
    try {
      const parts: any[] = [];
      if (base64InputImage) {
        const cleanImg = base64InputImage.replace(/^data:image\/[^;]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: inputMimeType || 'image/png',
            data: cleanImg,
          },
        });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: { parts },
        config: {
          // @ts-ignore
          imageConfig: {
            aspectRatio: aspectRatio || '1:1',
          },
        },
      });

      let imageUrl = '';
      let textOutput = '';

      const candidateParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of candidateParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      if (imageUrl) {
        res.json({ imageUrl, text: textOutput, prompt, modelUsed: targetModel });
        return;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Image generation with ${targetModel} failed:`, err?.message);
      const parsed = parseGenAiError(err);
      if (parsed.isFreeTierZeroQuota) {
        // If FreeTier limit: 0, no other nano banana model will succeed on free tier
        break;
      }
    }
  }

  // If text-to-image without input image, try Imagen 3.0 as secondary option
  if (!base64InputImage) {
    try {
      const validAspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      const targetAspect = validAspectRatios.includes(aspectRatio) ? aspectRatio : '1:1';
      const imagenRes = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: targetAspect as any,
        },
      });

      const imageBytes = imagenRes.generatedImages?.[0]?.image?.imageBytes;
      if (imageBytes) {
        res.json({
          imageUrl: `data:image/png;base64,${imageBytes}`,
          prompt,
          modelUsed: 'imagen-3.0-generate-002',
        });
        return;
      }
    } catch (imagenErr: any) {
      console.warn('Imagen 3.0 fallback also failed:', imagenErr?.message);
    }
  }

  console.error('All image generation attempts failed:', lastError);
  const formatted = parseGenAiError(lastError);
  res.status(formatted.statusCode).json({ 
    error: formatted.message,
    isQuotaExceeded: formatted.isQuotaExceeded,
    isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
    retryDelaySeconds: formatted.retryDelaySeconds,
    helpUrl: formatted.helpUrl,
  });
});

// 4. Video Generation (veo-3.1-fast-generate-preview with fallback support)
app.post('/api/gemini/generate-video', async (req: Request, res: Response) => {
  const { 
    prompt, 
    aspectRatio = '16:9', 
    base64Image, 
    imageMimeType = 'image/png',
    model = 'veo-3.1-fast-generate-preview' 
  } = req.body;

  const config: any = {
    numberOfVideos: 1,
    resolution: '720p',
    aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
  };

  const modelsToTry = [
    model || 'veo-3.1-fast-generate-preview',
    'veo-3.1-lite-generate-preview',
    'veo-3.1-generate-preview',
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const targetModel of modelsToTry) {
    try {
      let operation;
      if (base64Image) {
        const cleanImg = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
        operation = await ai.models.generateVideos({
          model: targetModel,
          prompt: prompt || 'Animate this image smoothly with cinematic motion',
          image: {
            imageBytes: cleanImg,
            mimeType: imageMimeType || 'image/png',
          },
          config,
        });
      } else {
        if (!prompt) {
          res.status(400).json({ error: 'Prompt is required for text-to-video' });
          return;
        }
        operation = await ai.models.generateVideos({
          model: targetModel,
          prompt,
          config,
        });
      }

      if (operation?.name) {
        res.json({ operationName: operation.name, modelUsed: targetModel });
        return;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Video generation failed with model ${targetModel}:`, err?.message);
      const formatted = parseGenAiError(err);
      if (formatted.isFreeTierZeroQuota) {
        break;
      }
    }
  }

  console.error('All video generation attempts failed:', lastError);
  const formatted = parseGenAiError(lastError);
  res.status(formatted.statusCode).json({ 
    error: formatted.message,
    isQuotaExceeded: formatted.isQuotaExceeded,
    isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
    retryDelaySeconds: formatted.retryDelaySeconds,
    helpUrl: formatted.helpUrl,
  });
});

// 5. Video Status Polling
app.post('/api/gemini/video-status', async (req: Request, res: Response) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      res.status(400).json({ error: 'operationName is required' });
      return;
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    res.json({
      done: updated.done || false,
      error: updated.error || null,
      hasVideo: Boolean(updated.response?.generatedVideos?.[0]?.video?.uri),
    });
  } catch (error: any) {
    console.error('Video status error:', error);
    const formatted = parseGenAiError(error);
    res.status(formatted.statusCode).json({ 
      error: formatted.message,
      isQuotaExceeded: formatted.isQuotaExceeded,
      isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
      retryDelaySeconds: formatted.retryDelaySeconds,
      helpUrl: formatted.helpUrl,
    });
  }
});

// 6. Video Download
app.post('/api/gemini/video-download', async (req: Request, res: Response) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      res.status(400).json({ error: 'operationName is required' });
      return;
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      res.status(404).json({ error: 'Video URI not available or generation in progress' });
      return;
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!videoRes.ok) {
      res.status(videoRes.status).json({ error: 'Failed to download video from storage' });
      return;
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error('Video download error:', error);
    const formatted = parseGenAiError(error);
    res.status(formatted.statusCode).json({ 
      error: formatted.message,
      isQuotaExceeded: formatted.isQuotaExceeded,
      isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
      retryDelaySeconds: formatted.retryDelaySeconds,
      helpUrl: formatted.helpUrl,
    });
  }
});

// 7. Music Generation (lyria-3-clip-preview & lyria-3-pro-preview)
app.post('/api/gemini/generate-music', async (req: Request, res: Response) => {
  try {
    const { prompt, durationType = 'clip', base64Image, imageMimeType = 'image/jpeg' } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const modelName = durationType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    let contents: any;
    if (base64Image) {
      const cleanImg = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
      contents = {
        parts: [
          { text: prompt },
          { inlineData: { data: cleanImg, mimeType: imageMimeType } },
        ],
      };
    } else {
      contents = prompt;
    }

    const stream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      // @ts-ignore
      config: {
        responseModalities: [Modality.AUDIO],
      },
    });

    let audioBase64 = '';
    let lyrics = '';
    let mimeType = 'audio/wav';

    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    res.json({
      audioBase64,
      mimeType,
      lyrics,
      prompt,
      model: modelName,
    });
  } catch (error: any) {
    console.error('Music generation error:', error);
    const formatted = parseGenAiError(error);
    res.status(formatted.statusCode).json({ 
      error: formatted.message,
      isQuotaExceeded: formatted.isQuotaExceeded,
      isFreeTierZeroQuota: formatted.isFreeTierZeroQuota,
      retryDelaySeconds: formatted.retryDelaySeconds,
      helpUrl: formatted.helpUrl,
    });
  }
});

// WebSocket Server for Live Voice Conversations (gemini-3.8-live)
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Live Voice client connected');
  try {
    const session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
        systemInstruction: 'You are an intelligent, friendly AI studio voice companion. Speak concisely, clearly, and naturally.',
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ status: 'session_closed' }));
          }
        },
      },
    });

    clientWs.on('message', (data: Buffer | string) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text) {
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: parsed.text }],
              },
            ],
            turnComplete: true,
          });
        }
      } catch (err) {
        console.error('Error sending input to Live session:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Live Voice client disconnected');
      try {
        session.close();
      } catch (err) {
        // ignore close error
      }
    });
  } catch (err: any) {
    console.error('Failed to initialize Live API session:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      const formatted = parseGenAiError(err);
      clientWs.send(JSON.stringify({ error: formatted.message, isQuotaExceeded: formatted.isQuotaExceeded }));
      clientWs.close();
    }
  }
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/live-api') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Vite Middleware for dev & static serve for production
const isProd = process.env.NODE_ENV === 'production';
if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Creative Studio full-stack server running on http://0.0.0.0:${PORT}`);
});
