import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, inferProvider } from '../src/config.js';

describe('Config Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BASE_URL;
    delete process.env.PROVIDER;
    delete process.env.DEFAULT_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should infer provider from API key prefixes', () => {
    expect(inferProvider('sk-or-v1-12345')).toBe('openrouter');
    expect(inferProvider('sk-ant-api03-12345')).toBe('anthropic');
    expect(inferProvider('AIzaSyD-12345')).toBe('google');
    expect(inferProvider('sk-proj-12345')).toBe('openai');
  });

  it('should infer provider from model names', () => {
    expect(inferProvider(undefined, 'nvidia/nemotron-3-nano')).toBe('openrouter');
    expect(inferProvider(undefined, 'claude-3-5-sonnet-20241022')).toBe('anthropic');
    expect(inferProvider(undefined, 'gemini-1.5-flash')).toBe('google');
    expect(inferProvider(undefined, 'gpt-4o')).toBe('openai');
    expect(inferProvider(undefined, 'llava:latest')).toBe('ollama');
  });

  it('should auto-detect OpenRouter from API_KEY prefix', () => {
    process.env.API_KEY = 'sk-or-v1-my-key';
    process.env.DEFAULT_MAX_TOKENS = '8192';

    const config = getConfig();
    expect(config.defaultProvider).toBe('openrouter');
    expect(config.apiKey).toBe('sk-or-v1-my-key');
    expect(config.defaultMaxTokens).toBe(8192);
    expect(config.defaultSystemPrompt).toContain('multimodal computer vision assistant');
  });
});
