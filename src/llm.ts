import { generateText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getConfig, DEFAULT_MODELS, inferProvider } from './config.js';
import type { ProcessedImage, VisionAnalysisResult } from './types.js';

export function getModel(): { model: LanguageModel; provider: string; modelName: string } {
  const config = getConfig();
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl;
  const provider = config.defaultProvider;
  const modelName = config.defaultModel || DEFAULT_MODELS[provider] || 'gpt-4o';

  if (!apiKey && provider !== 'ollama') {
    throw new Error('Missing API_KEY in environment variables.');
  }

  let model: LanguageModel;

  switch (provider) {
    case 'openrouter': {
      const client = createOpenAI({
        apiKey: apiKey!,
        baseURL: baseUrl || 'https://openrouter.ai/api/v1',
      });
      model = client(modelName);
      break;
    }

    case 'openai': {
      const client = createOpenAI({
        apiKey: apiKey!,
        baseURL: baseUrl,
      });
      model = client(modelName);
      break;
    }

    case 'anthropic': {
      const client = createAnthropic({
        apiKey: apiKey!,
        baseURL: baseUrl,
      });
      model = client(modelName);
      break;
    }

    case 'google': {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey!,
        baseURL: baseUrl,
      });
      model = client(modelName);
      break;
    }

    case 'ollama': {
      const client = createOpenAI({
        apiKey: 'ollama',
        baseURL: baseUrl || 'http://localhost:11434/v1',
      });
      model = client(modelName);
      break;
    }

    case 'custom': {
      if (!baseUrl) {
        throw new Error('BASE_URL is required for custom provider.');
      }
      const client = createOpenAI({
        apiKey: apiKey || 'custom',
        baseURL: baseUrl,
      });
      model = client(modelName);
      break;
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return { model, provider, modelName };
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
  const { model, provider, modelName } = getModel();

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
        content: [
          { type: 'text' as const, text: prompt },
          ...fileParts,
        ],
      },
    ],
    maxOutputTokens: config.defaultMaxTokens,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(60000),
  });

  return {
    text: result.text,
    provider,
    model: modelName,
    usage: {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
    },
  };
}
