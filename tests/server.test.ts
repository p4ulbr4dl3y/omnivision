import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as imageModule from '../src/image.js';
import * as llmModule from '../src/llm.js';
import { createServer } from '../src/server.js';

describe('MCP Server Integration', () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    server = createServer();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    vi.restoreAllMocks();
  });

  it('should list only analyze_image tool with image and prompt schema', async () => {
    const response = await client.listTools();
    expect(response.tools).toHaveLength(1);
    expect(response.tools[0].name).toBe('analyze_image');
    expect(response.tools[0].inputSchema.required).toEqual(['image']);
    expect(response.tools[0].inputSchema.properties).toHaveProperty('image');
    expect(response.tools[0].inputSchema.properties).toHaveProperty('prompt');
  });

  it('should execute analyze_image tool with prompt and image', async () => {
    vi.spyOn(imageModule, 'loadImages').mockResolvedValueOnce([
      {
        image: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
        sourceType: 'local',
      },
    ]);

    vi.spyOn(llmModule, 'runVisionAnalysis').mockResolvedValueOnce({
      text: 'Analysis result: vessel identified.',
      sdk: 'openai',
      model: 'gpt-4o',
      usage: { totalTokens: 50 },
    });

    const response = await client.callTool({
      name: 'analyze_image',
      arguments: {
        image: '/fake/path/vessel.png',
        prompt: 'What is in this picture?',
      },
    });

    expect(response.isError).toBeFalsy();
    const firstContent = response.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toBe('Analysis result: vessel identified.');
    }
  });

  it('should execute analyze_image tool with multiple images', async () => {
    vi.spyOn(imageModule, 'loadImages').mockResolvedValueOnce([
      {
        image: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
        sourceType: 'local',
      },
      {
        image: new Uint8Array([4, 5, 6]),
        mimeType: 'image/jpeg',
        sourceType: 'local',
      },
    ]);

    vi.spyOn(llmModule, 'runVisionAnalysis').mockResolvedValueOnce({
      text: 'Comparing two images.',
      sdk: 'openai',
      model: 'gpt-4o',
    });

    const response = await client.callTool({
      name: 'analyze_image',
      arguments: {
        image: ['/fake/img1.png', '/fake/img2.jpg'],
        prompt: 'Compare these two images',
      },
    });

    expect(response.isError).toBeFalsy();
    const firstContent = response.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toBe('Comparing two images.');
    }
  });

  it('should execute analyze_image tool without prompt (using default prompt)', async () => {
    vi.spyOn(imageModule, 'loadImages').mockResolvedValueOnce([
      {
        image: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
        sourceType: 'local',
      },
    ]);

    const runSpy = vi.spyOn(llmModule, 'runVisionAnalysis').mockResolvedValueOnce({
      text: 'Detailed description of the image.',
      sdk: 'openai',
      model: 'gpt-4o',
    });

    const response = await client.callTool({
      name: 'analyze_image',
      arguments: {
        image: '/fake/path/vessel.png',
      },
    });

    expect(response.isError).toBeFalsy();
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Describe this image in detail.',
      }),
    );
  });

  it('should return error format when image parameter is missing', async () => {
    const response = await client.callTool({
      name: 'analyze_image',
      arguments: {
        prompt: 'Hello without image',
      },
    });

    expect(response.isError).toBe(true);
    const firstContent = response.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toContain('Input validation error');
    }
  });

  it('should throw McpError when tool is unknown', async () => {
    await expect(
      client.callTool({
        name: 'unknown_tool',
        arguments: {},
      }),
    ).rejects.toThrow('Unknown tool');
  });
});
