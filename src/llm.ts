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

  const isLocalEndpoint =
    baseUrl?.includes('localhost') ||
    baseUrl?.includes('127.0.0.1') ||
    baseUrl?.includes('0.0.0.0');

  if (!apiKey && !isLocalEndpoint) {
    throw new Error('Missing API_KEY in environment variables.');
  }

  const effectiveApiKey = apiKey ?? (isLocalEndpoint ? 'local' : '');

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
    abortSignal: AbortSignal.timeout(60000),
  });

  return {
    text: result.text,
    sdk,
    model: modelName,
    usage: {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
    },
  };
}
