#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { createServer } from './server.js';

async function main() {
  dotenv.config();

  const server = createServer();
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    const forceExit = setTimeout(() => process.exit(1), 3000);
    forceExit.unref();
    try {
      await server.close();
    } catch (err) {
      console.error('Error during server shutdown:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection in omnivision:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in omnivision:', error);
    shutdown();
  });

  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in omnivision server:', error);
  process.exit(1);
});
