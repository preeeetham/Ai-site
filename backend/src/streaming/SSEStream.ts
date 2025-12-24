/**
 * Server-Sent Events (SSE) Streaming Layer
 * Manages real-time event streaming to clients
 */

import type { StreamEvent } from '../types/session.js';

export class SSEStream {
  private clients: Map<string, Set<Response>> = new Map();

  /**
   * Add a client to receive events for a session
   */
  addClient(sessionId: string, response: Response): void {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }

    this.clients.get(sessionId)!.add(response);

    // Remove client when connection closes
    response.body?.pipeTo(new WritableStream()).catch(() => {
      this.removeClient(sessionId, response);
    });
  }

  /**
   * Remove a client
   */
  removeClient(sessionId: string, response: Response): void {
    const clients = this.clients.get(sessionId);
    if (clients) {
      clients.delete(response);
      if (clients.size === 0) {
        this.clients.delete(sessionId);
      }
    }
  }

  /**
   * Send an event to all clients for a session
   */
  async sendEvent(sessionId: string, event: StreamEvent): Promise<void> {
    const clients = this.clients.get(sessionId);
    if (!clients || clients.size === 0) {
      return;
    }

    const message = this.formatSSEMessage(event);
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    const clientsToRemove: Response[] = [];

    for (const client of clients) {
      try {
        // In a real Fastify implementation, we'd use a different approach
        // This is a simplified version for the structure
        await this.writeToStream(client, data);
      } catch (error) {
        // Client disconnected
        clientsToRemove.push(client);
      }
    }

    // Remove disconnected clients
    for (const client of clientsToRemove) {
      this.removeClient(sessionId, client);
    }
  }

  /**
   * Send status update
   */
  async sendStatus(sessionId: string, status: string): Promise<void> {
    await this.sendEvent(sessionId, {
      type: 'status',
      data: { status },
      timestamp: new Date(),
    });
  }

  /**
   * Send progress update
   */
  async sendProgress(sessionId: string, progress: number, message?: string): Promise<void> {
    await this.sendEvent(sessionId, {
      type: 'progress',
      data: { progress, message },
      timestamp: new Date(),
    });
  }

  /**
   * Send error
   */
  async sendError(sessionId: string, error: string): Promise<void> {
    await this.sendEvent(sessionId, {
      type: 'error',
      data: { error },
      timestamp: new Date(),
    });
  }

  /**
   * Send completion event
   */
  async sendDone(sessionId: string, data: unknown): Promise<void> {
    await this.sendEvent(sessionId, {
      type: 'done',
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Format event as SSE message
   */
  private formatSSEMessage(event: StreamEvent): string {
    const lines: string[] = [];
    
    // Event type
    lines.push(`event: ${event.type}`);
    
    // Data (JSON encoded)
    lines.push(`data: ${JSON.stringify(event.data)}`);
    
    // Timestamp
    lines.push(`id: ${event.timestamp.getTime()}`);
    
    // Empty line to mark end of event
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Write data to a response stream
   * Note: This is a placeholder - actual implementation depends on Fastify's SSE plugin
   */
  private async writeToStream(_response: Response, _data: Uint8Array): Promise<void> {
    // In Fastify, we'd use response.raw.write() or an SSE plugin
    // This is just for structure
    throw new Error('Not implemented - use Fastify SSE plugin');
  }

  /**
   * Get number of active clients for a session
   */
  getClientCount(sessionId: string): number {
    return this.clients.get(sessionId)?.size ?? 0;
  }
}

