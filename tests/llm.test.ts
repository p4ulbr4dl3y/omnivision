import * as aiModule from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getModel, isRetryableError, runVisionAnalysis } from '../src/llm.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

describe('LLM Module', () => {
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
    vi.clearAllMocks();
  });

  it('should throw error when DEFAULT_MODEL is missing', () => {
    process.env.API_KEY = 'sk-test-key';
    expect(() => getModel()).toThrow('Missing DEFAULT_MODEL');
  });

  it('should throw error when API_KEY is missing and BASE_URL is not provided', () => {
    process.env.DEFAULT_MODEL = 'gpt-4o';
    expect(() => getModel()).toThrow('Missing API_KEY');
  });

  it('should allow missing API_KEY when BASE_URL and DEFAULT_MODEL are provided', () => {
    process.env.BASE_URL = 'http://localhost:11434/v1';
    process.env.DEFAULT_MODEL = 'llava';
    const result = getModel();
    expect(result.sdk).toBe('openai');
    expect(result.modelName).toBe('llava');
    expect(result.model).toBeDefined();
  });

  it('should initialize Anthropic and Google SDKs correctly with explicit model', () => {
    process.env.API_KEY = 'sk-ant-test-key';
    process.env.SDK = 'anthropic';
    process.env.DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
    const anthropicResult = getModel();
    expect(anthropicResult.sdk).toBe('anthropic');
    expect(anthropicResult.modelName).toBe('claude-3-5-sonnet-20241022');

    process.env.API_KEY = 'AIzaSyTestKey';
    process.env.SDK = 'google';
    process.env.DEFAULT_MODEL = 'gemini-1.5-flash';
    const googleResult = getModel();
    expect(googleResult.sdk).toBe('google');
    expect(googleResult.modelName).toBe('gemini-1.5-flash');
  });

  it('should throw error when images array is empty', async () => {
    await expect(
      runVisionAnalysis({
        prompt: 'test',
        images: [],
      }),
    ).rejects.toThrow('At least one image is required');
  });

  it('should call generateText and format result', async () => {
    process.env.API_KEY = 'sk-proj-mock-key';
    process.env.DEFAULT_MODEL = 'gpt-4o';

    vi.mocked(aiModule.generateText).mockResolvedValueOnce({
      text: 'A photo of a blue sailboat on clear water.',
      usage: {
        inputTokens: 120,
        outputTokens: 15,
        totalTokens: 135,
      },
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const fakeImage = {
      image: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      sourceType: 'local' as const,
    };

    const res = await runVisionAnalysis({
      prompt: 'Describe the vessel in this image',
      images: [fakeImage],
    });

    expect(res.text).toBe('A photo of a blue sailboat on clear water.');
    expect(res.sdk).toBe('openai');
    expect(res.model).toBe('gpt-4o');
    expect(res.usage?.totalTokens).toBe(135);
    expect(aiModule.generateText).toHaveBeenCalledTimes(1);
  });

  it('should correctly classify retryable and non-retryable errors', () => {
    expect(isRetryableError(new Error('Invalid JSON response'))).toBe(true);
    expect(isRetryableError(new Error('Unexpected token < in JSON at position 0'))).toBe(true);
    expect(isRetryableError(new Error('Rate limit reached'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    expect(isRetryableError({ status: 429, message: 'Too Many Requests' })).toBe(true);
    expect(isRetryableError({ status: 503, message: 'Service Unavailable' })).toBe(true);

    expect(isRetryableError(new Error('Authentication failed'))).toBe(false);
    expect(isRetryableError({ status: 401, message: 'Unauthorized' })).toBe(false);
    expect(isRetryableError({ status: 404, message: 'Not Found' })).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });

  it('should retry on retryable error and succeed on subsequent attempt', async () => {
    process.env.API_KEY = 'sk-proj-mock-key';
    process.env.DEFAULT_MODEL = 'gpt-4o';
    process.env.RETRY_DELAY_MS = '10';

    vi.mocked(aiModule.generateText)
      .mockRejectedValueOnce(new Error('Invalid JSON response'))
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce({
        text: 'Successfully analyzed after retries.',
        usage: { totalTokens: 50 },
      } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>);

    const fakeImage = {
      image: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      sourceType: 'local' as const,
    };

    const res = await runVisionAnalysis({
      prompt: 'Describe image',
      images: [fakeImage],
    });

    expect(res.text).toBe('Successfully analyzed after retries.');
    expect(aiModule.generateText).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable errors', async () => {
    process.env.API_KEY = 'sk-proj-mock-key';
    process.env.DEFAULT_MODEL = 'gpt-4o';
    process.env.RETRY_DELAY_MS = '10';

    vi.mocked(aiModule.generateText).mockRejectedValueOnce(
      Object.assign(new Error('Invalid API key provided'), { status: 401 }),
    );

    const fakeImage = {
      image: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      sourceType: 'local' as const,
    };

    await expect(
      runVisionAnalysis({
        prompt: 'Describe image',
        images: [fakeImage],
      }),
    ).rejects.toThrow('Invalid API key provided');

    expect(aiModule.generateText).toHaveBeenCalledTimes(1);
  });

  it('should exhaust retries and throw last error if failures continue', async () => {
    process.env.API_KEY = 'sk-proj-mock-key';
    process.env.DEFAULT_MODEL = 'gpt-4o';
    process.env.MAX_RETRIES = '2';
    process.env.RETRY_DELAY_MS = '10';

    vi.mocked(aiModule.generateText)
      .mockRejectedValueOnce(new Error('Invalid JSON response'))
      .mockRejectedValueOnce(new Error('Invalid JSON response'))
      .mockRejectedValueOnce(new Error('Invalid JSON response'));

    const fakeImage = {
      image: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      sourceType: 'local' as const,
    };

    await expect(
      runVisionAnalysis({
        prompt: 'Describe image',
        images: [fakeImage],
      }),
    ).rejects.toThrow('Invalid JSON response');

    expect(aiModule.generateText).toHaveBeenCalledTimes(3);
  });
});
