/**
 * Health check route
 */

import type { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  // GET /api/v1/health - Health check
  fastify.get('/api/v1/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    });
  });
}

