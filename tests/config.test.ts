import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig } from '../src/config.js';

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

  it('should default to openai SDK when SDK is not set', () => {
    process.env.API_KEY = 'sk-test-key';
    const config = getConfig();
    expect(config.sdk).toBe('openai');
  });

  it('should use explicit SDK env variable', () => {
    process.env.API_KEY = 'sk-ant-test-key';
    process.env.SDK = 'anthropic';

    const config = getConfig();
    expect(config.sdk).toBe('anthropic');
  });

  it('should throw error for unsupported SDK env variable', () => {
    process.env.SDK = 'unsupported-sdk';
    expect(() => getConfig()).toThrow('Unsupported SDK');
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

  it('should trim empty string environment variables', () => {
    process.env.API_KEY = '  ';
    process.env.BASE_URL = '   ';
    process.env.DEFAULT_MODEL = '  ';

    const config = getConfig();
    expect(config.apiKey).toBeUndefined();
    expect(config.baseUrl).toBeUndefined();
    expect(config.defaultModel).toBeUndefined();
  });

  it('should fallback to 4096 when DEFAULT_MAX_TOKENS is invalid or non-positive', () => {
    process.env.DEFAULT_MAX_TOKENS = '-100';
    expect(getConfig().defaultMaxTokens).toBe(4096);

    process.env.DEFAULT_MAX_TOKENS = '0';
    expect(getConfig().defaultMaxTokens).toBe(4096);

    process.env.DEFAULT_MAX_TOKENS = 'invalid';
    expect(getConfig().defaultMaxTokens).toBe(4096);
  });
});
