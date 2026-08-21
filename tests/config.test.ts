import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig, inferSdk } from '../src/config.js';

describe('Config Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BASE_URL;
    delete process.env.SDK;
    delete process.env.DEFAULT_MODEL;
    delete process.env.API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should infer sdk from API key prefixes', () => {
    expect(inferSdk('sk-or-v1-12345')).toBe('openai');
    expect(inferSdk('sk-ant-api03-12345')).toBe('anthropic');
    expect(inferSdk('AIzaSyD-12345')).toBe('google');
    expect(inferSdk('sk-proj-12345')).toBe('openai');
  });

  it('should infer sdk from model names', () => {
    expect(inferSdk(undefined, 'claude-3-5-sonnet-20241022')).toBe('anthropic');
    expect(inferSdk(undefined, 'gemini-1.5-flash')).toBe('google');
    expect(inferSdk(undefined, 'gpt-4o')).toBe('openai');
    expect(inferSdk(undefined, 'nvidia/nemotron-3-nano')).toBe('openai');
  });

  it('should auto-detect OpenRouter baseUrl from API_KEY prefix', () => {
    process.env.API_KEY = 'sk-or-v1-my-key';
    process.env.DEFAULT_MAX_TOKENS = '8192';

    const config = getConfig();
    expect(config.sdk).toBe('openai');
    expect(config.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(config.apiKey).toBe('sk-or-v1-my-key');
    expect(config.defaultMaxTokens).toBe(8192);
    expect(config.defaultSystemPrompt).toContain('multimodal computer vision assistant');
  });
});
