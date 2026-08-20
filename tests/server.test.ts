import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import * as llmModule from '../src/llm.js';
import * as imageModule from '../src/image.js';

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
      provider: 'openrouter',
      model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
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
    expect((response.content[0] as any).text).toBe('Analysis result: vessel identified.');
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
      provider: 'openrouter',
      model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
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
      })
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
    expect((response.content[0] as any).text).toContain('Input validation error');
  });
});
