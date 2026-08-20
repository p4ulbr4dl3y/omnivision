export type SupportedProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

export interface ProcessedImage {
  image: Uint8Array;
  mimeType: string;
  sourceType: 'local' | 'url' | 'base64';
}

export interface VisionAnalysisResult {
  text: string;
  provider: string;
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
  defaultProvider: SupportedProvider;
  defaultMaxTokens: number;
  defaultSystemPrompt: string;
}
