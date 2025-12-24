/**
 * Streaming API Routes (SSE)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface SessionParams {
  id: string;
}

export async function streamingRoutes(fastify: FastifyInstance) {
  // GET /api/v1/sessions/:id/stream - SSE stream for session events
  fastify.get<{ Params: SessionParams }>(
    '/api/v1/sessions/:id/stream',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      // Set SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

      // Send initial connection event
      reply.raw.write(': connected\n\n');

      // Keep connection alive with heartbeats
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(': heartbeat\n\n');
        } catch (error) {
          clearInterval(heartbeat);
        }
      }, 30000); // Every 30 seconds

      // Store the connection in the stream manager
      // In a full implementation, we'd use fastify.sseStream.addClient(id, reply.raw)
      
      // Cleanup on close
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        reply.raw.end();
      });

      // Keep the connection open
      return reply;
    }
  );
}

