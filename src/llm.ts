import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type LanguageModel } from 'ai';
import { DEFAULT_MODELS, getConfig } from './config.js';
import type { AppConfig, ProcessedImage, SupportedSdk, VisionAnalysisResult } from './types.js';

export function getModel(config: AppConfig = getConfig()): {
  model: LanguageModel;
  sdk: SupportedSdk;
  modelName: string;
} {
  const { apiKey, baseUrl, sdk, defaultModel } = config;
  const modelName = defaultModel || DEFAULT_MODELS[sdk];

  if (!modelName) {
    throw new Error(`No default model configured for SDK: ${sdk}. Set DEFAULT_MODEL.`);
  }

  // If no apiKey provided, require at least baseUrl (e.g. local / custom inference server)
  if (!apiKey && !baseUrl) {
    throw new Error('Missing API_KEY in environment variables.');
  }

  const effectiveApiKey = apiKey ?? 'not-needed';

  let model: LanguageModel;

  switch (sdk) {
    case 'anthropic':
      model = createAnthropic({ apiKey: effectiveApiKey, baseURL: baseUrl })(modelName);
      break;
    case 'google':
      model = createGoogleGenerativeAI({ apiKey: effectiveApiKey, baseURL: baseUrl })(modelName);
      break;
    case 'openai':
      model = createOpenAI({ apiKey: effectiveApiKey, baseURL: baseUrl })(modelName);
      break;
  }

  return { model, sdk, modelName };
}

export async function runVisionAnalysis(options: {
  prompt: string;
  images: ProcessedImage[];
}): Promise<VisionAnalysisResult> {
  const { prompt, images } = options;

  if (!images || images.length === 0) {
    throw new Error('At least one image is required for vision analysis.');
  }

  const config = getConfig();
  const { model, sdk, modelName } = getModel(config);

  const fileParts = images.map((img) => ({
    type: 'file' as const,
    data: img.image,
    mediaType: img.mimeType,
  }));

  const rawTimeout = process.env.REQUEST_TIMEOUT_MS?.trim();
  const parsedTimeout = rawTimeout ? parseInt(rawTimeout, 10) : Number.NaN;
  const timeoutMs = Number.isInteger(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 120000;

  const result = await generateText({
    model,
    system: config.defaultSystemPrompt,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text' as const, text: prompt }, ...fileParts],
      },
    ],
    maxOutputTokens: config.defaultMaxTokens,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(timeoutMs),
  });

  const usage = result.usage as
    | {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      }
    | undefined;

  return {
    text: result.text,
    sdk,
    model: modelName,
    usage: {
      inputTokens: usage?.inputTokens ?? usage?.promptTokens,
      outputTokens: usage?.outputTokens ?? usage?.completionTokens,
      totalTokens: usage?.totalTokens,
    },
  };
}
