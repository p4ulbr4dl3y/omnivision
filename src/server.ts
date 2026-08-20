import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadImages } from './image.js';
import { runVisionAnalysis } from './llm.js';

const AnalyzeImageSchema = z.object({
  image: z.union([
    z.string().describe('Path to local image file, URL (https://...), or base64 data URI.'),
    z.array(z.string()).min(1).max(10).describe('Array of up to 10 image paths, URLs, or base64 data URIs.'),
  ]).describe('Image source(s) to analyze.'),
  prompt: z
    .string()
    .optional()
    .default('Describe this image in detail.')
    .describe('Question or instruction about the image. Defaults to detailed description.'),
});

export function createServer(): Server {
  const server = new Server(
    {
      name: 'omnivision',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'analyze_image',
          description: 'Analyze, describe, or extract information from images using vision LLM. Accepts local file path, URL, or base64.',
          inputSchema: {
            type: 'object',
            properties: {
              image: {
                oneOf: [
                  {
                    type: 'string',
                    description: 'Path to local image file, web URL, or base64 data URI.',
                  },
                  {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of image paths or URLs.',
                  },
                ],
                description: 'The image(s) to analyze.',
              },
              prompt: {
                type: 'string',
                description: 'Optional question or instruction (default: "Describe this image in detail.").',
              },
            },
            required: ['image'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'analyze_image') {
        const parsed = AnalyzeImageSchema.parse(args || {});
        const imagesInput = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
        const processedImages = await loadImages(imagesInput);
        
        const result = await runVisionAnalysis({
          prompt: parsed.prompt || 'Describe this image in detail.',
          images: processedImages,
        });

        return {
          content: [
            {
              type: 'text',
              text: result.text,
            },
          ],
          metadata: {
            provider: result.provider,
            model: result.model,
            usage: result.usage,
          },
        };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const issues = error.issues || [];
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Input validation error: ${issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error.message || String(error)}`,
          },
        ],
      };
    }
  });

  return server;
}
