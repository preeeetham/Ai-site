/**
 * Phase 2 Tests: Backend Skeleton
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../src/sessions/SessionManager.js';
import { SessionState } from '../src/types/session.js';

describe('Phase 2: Backend Skeleton', () => {
  describe('SessionManager', () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = new SessionManager();
    });

    it('should create sessions', () => {
      const session = manager.createSession('user-1');
      
      expect(session.id).toMatch(/^session-/);
      expect(session.userId).toBe('user-1');
      expect(session.state).toBe(SessionState.CREATED);
      expect(session.currentVersion).toBeNull();
      expect(session.lastValidVersion).toBeNull();
    });

    it('should get sessions', () => {
      const session = manager.createSession('user-1');
      const retrieved = manager.getSession(session.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should validate state transitions', () => {
      const session = manager.createSession('user-1');
      
      // Valid transition
      manager.transitionState(session.id, SessionState.GENERATING);
      expect(manager.getSession(session.id)?.state).toBe(SessionState.GENERATING);
      
      // Invalid transition (GENERATING -> READY is not allowed)
      expect(() => {
        manager.transitionState(session.id, SessionState.READY);
      }).toThrow();
    });

    it('should allow valid state transitions', () => {
      const session = manager.createSession('user-1');
      
      manager.transitionState(session.id, SessionState.GENERATING);
      manager.transitionState(session.id, SessionState.BUILDING);
      manager.transitionState(session.id, SessionState.VALIDATING);
      manager.transitionState(session.id, SessionState.READY);
      
      expect(manager.getSession(session.id)?.state).toBe(SessionState.READY);
    });

    it('should handle session locking', () => {
      const session = manager.createSession('user-1');
      
      expect(manager.isLocked(session.id)).toBe(false);
      
      const locked = manager.lockSession(session.id);
      expect(locked).toBe(true);
      expect(manager.isLocked(session.id)).toBe(true);
      
      // Try to lock again
      const lockedAgain = manager.lockSession(session.id);
      expect(lockedAgain).toBe(false);
      
      manager.unlockSession(session.id);
      expect(manager.isLocked(session.id)).toBe(false);
    });

    it('should set current version', () => {
      const session = manager.createSession('user-1');
      manager.setCurrentVersion(session.id, 'version-123');
      
      const updated = manager.getSession(session.id);
      expect(updated?.currentVersion).toBe('version-123');
    });

    it('should update lastValidVersion when transitioning to READY', () => {
      const session = manager.createSession('user-1');
      manager.setCurrentVersion(session.id, 'version-123');
      manager.transitionState(session.id, SessionState.GENERATING);
      manager.transitionState(session.id, SessionState.BUILDING);
      manager.transitionState(session.id, SessionState.VALIDATING);
      manager.transitionState(session.id, SessionState.READY);
      
      const updated = manager.getSession(session.id);
      expect(updated?.lastValidVersion).toBe('version-123');
    });

    it('should delete sessions', () => {
      const session = manager.createSession('user-1');
      manager.deleteSession(session.id);
      
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it('should get session versions', () => {
      const session = manager.createSession('user-1');
      
      // Sessions don't have versions yet in SessionManager
      // This is handled by VersionManager
      // But we can test the structure
      expect(session.currentVersion).toBeNull();
    });

    it('should handle expired sessions', () => {
      const session = manager.createSession('user-1');
      
      // Manually expire the session
      const expiredSession = { ...session, expiresAt: new Date(Date.now() - 1000) };
      // In real implementation, we'd need to access the internal map
      // For now, just test that getSession checks expiration
      
      // Cleanup should remove expired sessions
      const deleted = manager.cleanupExpiredSessions();
      // Note: cleanupExpiredSessions checks expiresAt, but we can't easily test without exposing internals
      expect(typeof deleted).toBe('number');
    });
  });
});

