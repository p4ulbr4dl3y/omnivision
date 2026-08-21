import type { AppConfig, SupportedSdk } from './types.js';

export const SUPPORTED_SDKS = ['openai', 'anthropic', 'google'] as const;

export const DEFAULT_MODELS: Record<SupportedSdk, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-flash',
};

export const DEFAULT_VISION_SYSTEM_PROMPT =
  'You are an expert multimodal computer vision assistant. Provide clear, accurate, and highly detailed analysis of the provided images. Identify and describe all visible objects, spatial relationships, text, colors, materials, structure, and context. Answer questions thoroughly and precisely.';

export function inferSdk(apiKey?: string, model?: string): SupportedSdk {
  if (apiKey?.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey?.startsWith('AIza')) return 'google';

  if (model) {
    const lower = model.toLowerCase();
    if (lower.startsWith('claude')) return 'anthropic';
    if (lower.startsWith('gemini')) return 'google';
  }

  return 'openai';
}

export function getConfig(): AppConfig {
  const apiKey = process.env.API_KEY;
  let baseUrl = process.env.BASE_URL;
  const defaultModel = process.env.DEFAULT_MODEL;

  const sdkEnv = process.env.SDK?.toLowerCase();
  const sdk =
    sdkEnv && SUPPORTED_SDKS.includes(sdkEnv as SupportedSdk)
      ? (sdkEnv as SupportedSdk)
      : inferSdk(apiKey, defaultModel);

  if (!baseUrl && apiKey?.startsWith('sk-or-')) {
    baseUrl = 'https://openrouter.ai/api/v1';
  }

  const rawMaxTokens = process.env.DEFAULT_MAX_TOKENS;
  const defaultMaxTokens =
    rawMaxTokens && !Number.isNaN(Number(rawMaxTokens)) ? parseInt(rawMaxTokens, 10) : 4096;
  const defaultSystemPrompt = process.env.DEFAULT_SYSTEM_PROMPT || DEFAULT_VISION_SYSTEM_PROMPT;

  return {
    apiKey,
    baseUrl,
    defaultModel,
    sdk,
    defaultMaxTokens,
    defaultSystemPrompt,
  };
}
