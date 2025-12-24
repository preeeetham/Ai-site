/**
 * Preview Server Routes (Stub)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SessionManager } from '../sessions/SessionManager.js';
import { SessionState } from '../types/session.js';

interface PreviewParams {
  sessionId: string;
  versionId?: string;
}

export async function previewRoutes(fastify: FastifyInstance) {
  const sessionManager = fastify.sessionManager as SessionManager;

  // GET /preview/:sessionId/:versionId - Serve specific version
  fastify.get<{ Params: PreviewParams }>(
    '/preview/:sessionId/:versionId',
    async (request: FastifyRequest<{ Params: PreviewParams }>, reply: FastifyReply) => {
      const { sessionId, versionId } = request.params;

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(get404HTML('Session not found'));
      }

      // Set cache headers for versioned previews (1 year)
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');

      // In Phase 5, this will serve actual static files
      // For now, return a stub page
      return reply
        .type('text/html')
        .send(getPreviewStubHTML(sessionId, versionId || 'unknown'));
    }
  );

  // GET /preview/:sessionId - Serve latest valid version
  fastify.get<{ Params: { sessionId: string } }>(
    '/preview/:sessionId',
    async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
      const { sessionId } = request.params;

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return reply.status(404).send(get404HTML('Session not found'));
      }

      // Check if there's a valid version
      if (!session.lastValidVersion && session.state !== SessionState.READY) {
        return reply.status(202).send(getBuildingHTML(sessionId));
      }

      const versionId = session.lastValidVersion || session.currentVersion || 'latest';

      // No cache for latest (always check for updates)
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');

      // Redirect to versioned preview
      return reply.redirect(`/preview/${sessionId}/${versionId}`);
    }
  );
}

/**
 * Generate 404 HTML
 */
function get404HTML(message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>404 - Not Found</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; }
    h1 { color: #666; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>${message}</p>
</body>
</html>
  `.trim();
}

/**
 * Generate building/loading HTML
 */
function getBuildingHTML(sessionId: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Building Preview...</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Building Preview...</h1>
  <div class="spinner"></div>
  <p>Session: ${sessionId}</p>
  <p>Your preview will be ready soon!</p>
</body>
</html>
  `.trim();
}

/**
 * Generate preview stub HTML
 */
function getPreviewStubHTML(sessionId: string, versionId: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Preview - ${sessionId}</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .info { color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Preview Stub</h1>
    <p>This is a placeholder preview page.</p>
    <div class="info">
      <p><strong>Session ID:</strong> ${sessionId}</p>
      <p><strong>Version ID:</strong> ${versionId}</p>
      <p><em>Actual preview will be available in Phase 5</em></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

