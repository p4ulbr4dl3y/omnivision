import * as aiModule from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getModel, runVisionAnalysis } from '../src/llm.js';

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

  it('should throw error when API_KEY is missing and BASE_URL is not provided', () => {
    expect(() => getModel()).toThrow('Missing API_KEY');
  });

  it('should allow missing API_KEY when BASE_URL is provided', () => {
    process.env.BASE_URL = 'http://localhost:11434/v1';
    const result = getModel();
    expect(result.sdk).toBe('openai');
    expect(result.model).toBeDefined();
  });

  it('should initialize OpenRouter from API_KEY as openai sdk with custom baseUrl', () => {
    process.env.API_KEY = 'sk-or-universal-key';
    const result = getModel();
    expect(result.sdk).toBe('openai');
    expect(result.model).toBeDefined();
  });

  it('should initialize Anthropic and Google SDKs correctly', () => {
    process.env.API_KEY = 'sk-ant-test-key';
    process.env.SDK = 'anthropic';
    const anthropicResult = getModel();
    expect(anthropicResult.sdk).toBe('anthropic');
    expect(anthropicResult.modelName).toBe('claude-3-5-sonnet-20241022');

    process.env.API_KEY = 'AIzaSyTestKey';
    process.env.SDK = 'google';
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
});
