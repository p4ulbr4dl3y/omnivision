import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadImages } from './image.js';
import { runVisionAnalysis } from './llm.js';

const DEFAULT_PROMPT = 'Describe this image in detail.';

const AnalyzeImageSchema = z.object({
  image: z
    .union([
      z.string().describe('Path to local image file, URL (https://...), or base64 data URI.'),
      z
        .array(z.string())
        .min(1)
        .max(10)
        .describe('Array of up to 10 image paths, URLs, or base64 data URIs.'),
    ])
    .describe('Image source(s) to analyze.'),
  prompt: z
    .string()
    .optional()
    .describe(`Question or instruction about the image. Defaults to "${DEFAULT_PROMPT}".`),
});

const toolInputSchema = z.toJSONSchema(AnalyzeImageSchema) as Record<string, unknown>;
delete toolInputSchema.$schema;

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
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'analyze_image',
          description:
            'Analyze, describe, or extract information from images using vision LLM. Accepts local file path, URL, or base64.',
          inputSchema: toolInputSchema,
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
          prompt: parsed.prompt ?? DEFAULT_PROMPT,
          images: processedImages,
        });

        return {
          content: [
            {
              type: 'text',
              text: result.text,
            },
          ],
        };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      if (error instanceof z.ZodError) {
        const issues = error.issues || [];
        const formattedIssues = issues
          .map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
          .join(', ');
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Input validation error: ${formattedIssues}`,
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });

  return server;
}
