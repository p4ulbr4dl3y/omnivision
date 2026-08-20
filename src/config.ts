import dotenv from 'dotenv';
import type { AppConfig, SupportedProvider } from './types.js';

dotenv.config();

export const DEFAULT_VISION_SYSTEM_PROMPT =
  'You are an expert multimodal computer vision assistant. Provide clear, accurate, and highly detailed analysis of the provided images. Identify and describe all visible objects, spatial relationships, text, colors, materials, structure, and context. Answer questions thoroughly and precisely.';

export function inferProvider(apiKey?: string, model?: string, baseUrl?: string): SupportedProvider {
  if (apiKey?.startsWith('sk-or-')) return 'openrouter';
  if (apiKey?.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey?.startsWith('AIza')) return 'google';

  if (model) {
    const lower = model.toLowerCase();
    if (lower.includes('/')) return 'openrouter';
    if (lower.startsWith('claude')) return 'anthropic';
    if (lower.startsWith('gemini')) return 'google';
    if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3')) return 'openai';
    if (lower.startsWith('llava') || lower.startsWith('llama')) return 'ollama';
  }

  if (apiKey?.startsWith('sk-')) return 'openai';
  if (baseUrl) return 'custom';

  return 'openrouter';
}

export function getConfig(): AppConfig {
  const apiKey = process.env.API_KEY;
  const baseUrl = process.env.BASE_URL;
  const defaultModel = process.env.DEFAULT_MODEL;
  const provider = (process.env.PROVIDER?.toLowerCase() as SupportedProvider) || inferProvider(apiKey, defaultModel, baseUrl);

  const rawMaxTokens = process.env.DEFAULT_MAX_TOKENS;
  const defaultMaxTokens = rawMaxTokens && !isNaN(Number(rawMaxTokens)) ? parseInt(rawMaxTokens, 10) : 4096;
  const defaultSystemPrompt = process.env.DEFAULT_SYSTEM_PROMPT || DEFAULT_VISION_SYSTEM_PROMPT;

  return {
    apiKey,
    baseUrl,
    defaultModel,
    defaultProvider: provider,
    defaultMaxTokens,
    defaultSystemPrompt,
  };
}

export const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  openrouter: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-flash',
  ollama: 'llava',
  custom: 'default',
};
