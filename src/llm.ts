import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type LanguageModel } from 'ai';
import { getConfig } from './config.js';
import type { AppConfig, ProcessedImage, SupportedSdk, VisionAnalysisResult } from './types.js';

export function getModel(config: AppConfig = getConfig()): {
  model: LanguageModel;
  sdk: SupportedSdk;
  modelName: string;
} {
  const { apiKey, baseUrl, sdk, defaultModel } = config;

  if (!defaultModel) {
    throw new Error('Missing DEFAULT_MODEL in environment variables.');
  }

  // If no apiKey provided, require at least baseUrl (e.g. local / custom inference server)
  if (!apiKey && !baseUrl) {
    throw new Error('Missing API_KEY in environment variables.');
  }

  const modelName = defaultModel;

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

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const status =
    (error as { status?: number; statusCode?: number })?.status ??
    (error as { statusCode?: number })?.statusCode;

  if (typeof status === 'number') {
    if (status === 429 || status >= 500) return true;
    if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  }

  const retryablePatterns = [
    /invalid json response/i,
    /unexpected token/i,
    /rate limit/i,
    /too many requests/i,
    /overloaded/i,
    /timeout/i,
    /timed out/i,
    /econnreset/i,
    /etimedout/i,
    /econnrefused/i,
    /fetch failed/i,
    /bad gateway/i,
    /service unavailable/i,
    /gateway timeout/i,
    /502/i,
    /503/i,
    /504/i,
    /524/i,
    /internal server error/i,
  ];

  return retryablePatterns.some((pattern) => pattern.test(msg));
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

  const maxRetries = config.maxRetries ?? 3;
  const retryDelayMs = config.retryDelayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxRetries && isRetryableError(error);
      if (shouldRetry) {
        const delay = Math.min(
          retryDelayMs * 2 ** attempt + Math.floor(Math.random() * 200),
          15000,
        );
        console.error(
          `[omnivision] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${
            error instanceof Error ? error.message : String(error)
          }. Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
