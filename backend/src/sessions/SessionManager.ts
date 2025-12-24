/**
 * Session Manager - Manages session lifecycle and state transitions
 * Implements a state machine for session states
 */

import type { Session } from '../types/session.js';
import { SessionState } from '../types/session.js';

// Valid state transitions
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  [SessionState.CREATED]: [SessionState.GENERATING, SessionState.FAILED],
  [SessionState.GENERATING]: [SessionState.BUILDING, SessionState.FAILED],
  [SessionState.BUILDING]: [SessionState.VALIDATING, SessionState.FAILED],
  [SessionState.VALIDATING]: [SessionState.READY, SessionState.FAILED],
  [SessionState.READY]: [SessionState.GENERATING, SessionState.BUILDING, SessionState.FIXING],
  [SessionState.FAILED]: [SessionState.FIXING, SessionState.GENERATING],
  [SessionState.FIXING]: [SessionState.BUILDING, SessionState.FAILED],
};

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionLocks: Map<string, boolean> = new Map(); // Prevent concurrent builds

  /**
   * Create a new session
   */
  createSession(userId: string = 'anonymous', metadata?: Record<string, unknown>): Session {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const session: Session = {
      id: sessionId,
      userId,
      state: SessionState.CREATED,
      currentVersion: null,
      lastValidVersion: null,
      createdAt: now,
      expiresAt,
      metadata,
    };

    this.sessions.set(sessionId, session);
    this.sessionLocks.set(sessionId, false);

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    // Check if session has expired
    if (session && session.expiresAt < new Date()) {
      this.deleteSession(sessionId);
      return undefined;
    }

    return session;
  }

  /**
   * Update session state with validation
   */
  transitionState(sessionId: string, newState: SessionState, log: string = ''): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Validate transition
    const validNextStates = VALID_TRANSITIONS[session.state];
    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition from ${session.state} to ${newState}. Valid transitions: ${validNextStates.join(', ')}`
      );
    }

    // Log transition (in a real system, this would go to a log store)
    if (log) {
      console.log(`[Session ${sessionId}] ${session.state} -> ${newState}: ${log}`);
    }

    // Update state
    session.state = newState;

    // If transitioning to READY, update lastValidVersion
    if (newState === SessionState.READY && session.currentVersion) {
      session.lastValidVersion = session.currentVersion;
    }
  }

  /**
   * Set current version for a session
   */
  setCurrentVersion(sessionId: string, versionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.currentVersion = versionId;
  }

  /**
   * Lock a session (prevent concurrent builds)
   */
  lockSession(sessionId: string): boolean {
    const isLocked = this.sessionLocks.get(sessionId);
    if (isLocked) {
      return false; // Already locked
    }

    this.sessionLocks.set(sessionId, true);
    return true;
  }

  /**
   * Unlock a session
   */
  unlockSession(sessionId: string): void {
    this.sessionLocks.set(sessionId, false);
  }

  /**
   * Check if session is locked
   */
  isLocked(sessionId: string): boolean {
    return this.sessionLocks.get(sessionId) ?? false;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.sessionLocks.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = new Date();
    let deleted = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.deleteSession(sessionId);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get all sessions (for admin/debugging)
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

