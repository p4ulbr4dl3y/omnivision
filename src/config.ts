import type { AppConfig, SupportedSdk } from './types.js';

export const SUPPORTED_SDKS = ['openai', 'anthropic', 'google'] as const;

export const DEFAULT_VISION_SYSTEM_PROMPT =
  'You are an expert multimodal computer vision assistant. Provide clear, accurate, and highly detailed analysis of the provided images. Identify and describe all visible objects, spatial relationships, text, colors, materials, structure, and context. Answer questions thoroughly and precisely.';

export function getConfig(): AppConfig {
  const apiKey = process.env.API_KEY?.trim() || undefined;
  const baseUrl = process.env.BASE_URL?.trim() || undefined;
  const defaultModel = process.env.DEFAULT_MODEL?.trim() || undefined;

  const sdkEnv = process.env.SDK?.trim().toLowerCase();
  let sdk: SupportedSdk = 'openai';

  if (sdkEnv) {
    if (!SUPPORTED_SDKS.includes(sdkEnv as SupportedSdk)) {
      throw new Error(
        `Unsupported SDK: "${sdkEnv}". Supported SDKs: ${SUPPORTED_SDKS.join(', ')}`,
      );
    }
    sdk = sdkEnv as SupportedSdk;
  }

  const rawMaxTokens = process.env.DEFAULT_MAX_TOKENS?.trim();
  const parsedMaxTokens = rawMaxTokens ? parseInt(rawMaxTokens, 10) : Number.NaN;
  const defaultMaxTokens =
    Number.isInteger(parsedMaxTokens) && parsedMaxTokens > 0 ? parsedMaxTokens : 4096;
  const defaultSystemPrompt = process.env.DEFAULT_SYSTEM_PROMPT || DEFAULT_VISION_SYSTEM_PROMPT;

  const rawMaxRetries = process.env.MAX_RETRIES?.trim();
  const parsedMaxRetries = rawMaxRetries ? parseInt(rawMaxRetries, 10) : Number.NaN;
  const maxRetries =
    Number.isInteger(parsedMaxRetries) && parsedMaxRetries >= 0 ? parsedMaxRetries : 3;

  const rawRetryDelay = process.env.RETRY_DELAY_MS?.trim();
  const parsedRetryDelay = rawRetryDelay ? parseInt(rawRetryDelay, 10) : Number.NaN;
  const retryDelayMs =
    Number.isInteger(parsedRetryDelay) && parsedRetryDelay >= 0 ? parsedRetryDelay : 1000;

  return {
    apiKey,
    baseUrl,
    defaultModel,
    sdk,
    defaultMaxTokens,
    defaultSystemPrompt,
    maxRetries,
    retryDelayMs,
  };
}
