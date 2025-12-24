/**
 * Session API Routes
 */

import type { FastifyInstance } from 'fastify';
import { SessionManager } from '../../sessions/SessionManager.js';
import { SessionState, type CreateSessionRequest, type SendPromptRequest } from '../../types/session.js';
import type { Orchestrator } from '../../orchestrator/Orchestrator.js';

interface SessionParams {
  id: string;
}

export async function sessionRoutes(fastify: FastifyInstance) {
  const sessionManager = fastify.sessionManager as SessionManager;
  const orchestrator = fastify.orchestrator as Orchestrator;

  // POST /api/v1/sessions - Create session
  fastify.post<{ Body: CreateSessionRequest }>('/api/v1/sessions', async (request, reply) => {
    const { userId = 'anonymous', metadata } = request.body;
    
    const session = sessionManager.createSession(userId, metadata);
    
    return reply.status(201).send({
      id: session.id,
      userId: session.userId,
      state: session.state,
      currentVersion: session.currentVersion,
      lastValidVersion: session.lastValidVersion,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  // GET /api/v1/sessions/:id - Get session status
  fastify.get<{ Params: SessionParams }>('/api/v1/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    
    const session = sessionManager.getSession(id);
    
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return reply.send({
      id: session.id,
      userId: session.userId,
      state: session.state,
      currentVersion: session.currentVersion,
      lastValidVersion: session.lastValidVersion,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  // POST /api/v1/sessions/:id/prompt - Send user prompt
  fastify.post<{ Params: SessionParams; Body: SendPromptRequest }>(
    '/api/v1/sessions/:id/prompt',
    async (request, reply) => {
      const { id } = request.params;
      const { prompt } = request.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return reply.status(400).send({ error: 'Prompt is required' });
      }

      const session = sessionManager.getSession(id);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Check if session is locked (already building)
      if (sessionManager.isLocked(id)) {
        return reply.status(409).send({ error: 'Session is currently processing a build' });
      }

      // Lock session
      sessionManager.lockSession(id);

      try {
        // Execute orchestrator pipeline
        const versionId = await orchestrator.execute(id, prompt);

        return reply.send({
          message: 'Prompt processed successfully',
          sessionId: id,
          versionId,
          state: sessionManager.getSession(id)?.state || SessionState.READY,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Error processing prompt for session ${id}: ${errorMessage}`);
        
        return reply.status(500).send({
          error: 'Failed to process prompt',
          message: errorMessage,
        });
      } finally {
        // Unlock session
        sessionManager.unlockSession(id);
      }
    }
  );

  // DELETE /api/v1/sessions/:id - Delete session
  fastify.delete<{ Params: SessionParams }>('/api/v1/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    
    const session = sessionManager.getSession(id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    sessionManager.deleteSession(id);
    
    return reply.status(204).send();
  });
}
