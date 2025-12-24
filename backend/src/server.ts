/**
 * Main server entry point
 */

import 'dotenv/config';
import { createServer } from './api/server.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const server = await createServer();

    // Start server
    await server.listen({ port: PORT, host: HOST });

    console.log(`🚀 Server listening on http://${HOST}:${PORT}`);
    console.log(`📡 Health check: http://${HOST}:${PORT}/api/v1/health`);
    console.log(`📝 API endpoints:`);
    console.log(`   POST   /api/v1/sessions`);
    console.log(`   GET    /api/v1/sessions/:id`);
    console.log(`   POST   /api/v1/sessions/:id/prompt`);
    console.log(`   DELETE /api/v1/sessions/:id`);
    console.log(`   GET    /api/v1/sessions/:id/stream`);
    console.log(`   GET    /preview/:sessionId`);
    console.log(`   GET    /preview/:sessionId/:versionId`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

start();

