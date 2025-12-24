/**
 * Session type definitions for Phase 2
 */

export enum SessionState {
  CREATED = 'CREATED',
  GENERATING = 'GENERATING',
  BUILDING = 'BUILDING',
  VALIDATING = 'VALIDATING',
  READY = 'READY',
  FAILED = 'FAILED',
  FIXING = 'FIXING',
}

export interface Session {
  id: string;
  userId: string;
  state: SessionState;
  currentVersion: string | null;
  lastValidVersion: string | null;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface StreamEvent {
  type: 'status' | 'error' | 'progress' | 'done';
  data: unknown;
  timestamp: Date;
}

export interface CreateSessionRequest {
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendPromptRequest {
  prompt: string;
}

export interface SessionResponse {
  id: string;
  userId: string;
  state: SessionState;
  currentVersion: string | null;
  lastValidVersion: string | null;
  createdAt: string;
  expiresAt: string;
}

