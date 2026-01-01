/**
 * Fastify API Server
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SessionManager } from '../sessions/SessionManager.js';
import { VFS } from '../vfs/VFS.js';
import { VersionManager } from '../vfs/VersionManager.js';
import { AIGateway } from '../ai/AIGateway.js';
import { ContextManager } from '../context/ContextManager.js';
import { Orchestrator } from '../orchestrator/Orchestrator.js';
import { DockerBuildRunner } from '../build/DockerBuildRunner.js';
import { sessionRoutes } from './routes/sessions.js';
import { streamingRoutes } from './routes/streaming.js';
import { healthRoutes } from './routes/health.js';
import { previewRoutes } from '../preview/previewRoutes.js';

// Extend Fastify instance types
declare module 'fastify' {
  interface FastifyInstance {
    sessionManager: SessionManager;
    orchestrator: Orchestrator;
  }
}

export async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
  });

  // Initialize components
  const sessionManager = new SessionManager();
  fastify.decorate('sessionManager', sessionManager);

  // Initialize VFS and Version Manager
  const vfs = new VFS();
  const versionManager = new VersionManager();

  // Initialize AI Gateway
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fastify.log.warn('GEMINI_API_KEY not found in environment. AI features will not work.');
  }
  const aiGateway = apiKey ? new AIGateway(apiKey) : null as any; // Will throw error if used without key

  // Initialize Context Manager
  const contextManager = new ContextManager();

  // Initialize Build Runner (optional - requires Docker)
  let buildRunner;
  try {
    buildRunner = new DockerBuildRunner();
    fastify.log.info('Docker build runner initialized');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    fastify.log.warn(`Docker build runner not available: ${errorMsg}`);
    buildRunner = undefined;
  }

  // Initialize Orchestrator
  const orchestrator = new Orchestrator(
    aiGateway,
    contextManager,
    vfs,
    versionManager,
    sessionManager,
    buildRunner
  );
  fastify.decorate('orchestrator', orchestrator);

  // Cleanup expired sessions every hour
  setInterval(() => {
    const deleted = sessionManager.cleanupExpiredSessions();
    if (deleted > 0) {
      fastify.log.info(`Cleaned up ${deleted} expired sessions`);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(sessionRoutes);
  await fastify.register(streamingRoutes);
  await fastify.register(previewRoutes);

  // Error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
    });
  });

  return fastify;
}

