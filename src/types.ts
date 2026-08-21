export type SupportedSdk = 'openai' | 'anthropic' | 'google';

export interface ProcessedImage {
  image: Uint8Array;
  mimeType: string;
  sourceType: 'local' | 'url' | 'base64';
}

export interface VisionAnalysisResult {
  text: string;
  sdk: SupportedSdk;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface AppConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  sdk: SupportedSdk;
  defaultMaxTokens: number;
  defaultSystemPrompt: string;
  maxRetries: number;
  retryDelayMs: number;
}
