/**
 * Integration Test - Tests all 3 phases working together
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VFS } from '../src/vfs/VFS.js';
import { VersionManager } from '../src/vfs/VersionManager.js';
import { SessionManager } from '../src/sessions/SessionManager.js';
import { ContextManager } from '../src/context/ContextManager.js';
import { Orchestrator } from '../src/orchestrator/Orchestrator.js';
import { SessionState } from '../src/types/session.js';

// Mock AIGateway for integration test (without API calls)
class MockAIGateway {
  async plan() {
    return {
      intent: 'CREATE',
      affectedFiles: ['index.html', 'index.ts', 'package.json'],
      reasoning: 'Creating a simple todo app',
      steps: ['Create HTML structure', 'Add TypeScript logic', 'Add dependencies'],
    };
  }

  async generate() {
    return {
      'index.html': '<html><body><h1>Todo App</h1></body></html>',
      'index.ts': 'console.log("Todo app");',
      'package.json': JSON.stringify({ name: 'todo-app', version: '1.0.0' }),
    };
  }

  async fix() {
    return {
      'index.ts': 'console.log("Fixed todo app");',
    };
  }
}

describe('Integration Test: All Phases', () => {
  let vfs: VFS;
  let versionManager: VersionManager;
  let sessionManager: SessionManager;
  let contextManager: ContextManager;
  let orchestrator: Orchestrator;

  beforeAll(() => {
    vfs = new VFS();
    versionManager = new VersionManager();
    sessionManager = new SessionManager();
    contextManager = new ContextManager();
    
    const mockAI = new MockAIGateway() as any;
    orchestrator = new Orchestrator(
      mockAI,
      contextManager,
      vfs,
      versionManager,
      sessionManager
    );
  });

  it('should create a session and process a prompt', async () => {
    // Phase 2: Create session
    const session = sessionManager.createSession('test-user');
    expect(session.state).toBe(SessionState.CREATED);

    // Phase 3: Process prompt through orchestrator
    const versionId = await orchestrator.execute(session.id, 'build a todo app');

    // Verify session state
    const updatedSession = sessionManager.getSession(session.id);
    expect(updatedSession?.state).toBe(SessionState.READY);
    expect(updatedSession?.currentVersion).toBe(versionId);

    // Verify version was created
    const version = versionManager.getVersion(versionId);
    expect(version).toBeDefined();
    expect(version?.files.size).toBeGreaterThan(0);
    expect(version?.status).toBe('VALID');

    // Verify files in VFS
    const files = vfs.list();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('index.html');
    expect(files).toContain('index.ts');
  });

  it('should maintain conversation history', async () => {
    const session = sessionManager.createSession('test-user-2');
    
    await orchestrator.execute(session.id, 'build a todo app');
    
    const history = contextManager.getConversationHistory(session.id);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe('build a todo app');
  });

  it('should handle session state transitions correctly', async () => {
    const session = sessionManager.createSession('test-user-3');
    
    const initialState = sessionManager.getSession(session.id)?.state;
    expect(initialState).toBe(SessionState.CREATED);

    await orchestrator.execute(session.id, 'create a counter app');

    const finalState = sessionManager.getSession(session.id)?.state;
    expect(finalState).toBe(SessionState.READY);
  });

  it('should create multiple versions for a session', async () => {
    const session = sessionManager.createSession('test-user-4');
    
    const v1 = await orchestrator.execute(session.id, 'build a todo app');
    const v2 = await orchestrator.execute(session.id, 'add a counter feature');

    expect(v1).not.toBe(v2);
    
    const sessionVersions = versionManager.getSessionVersions(session.id);
    expect(sessionVersions.length).toBe(2);
  });

  it('should track last valid version', async () => {
    const session = sessionManager.createSession('test-user-5');
    
    await orchestrator.execute(session.id, 'build a todo app');
    
    const updatedSession = sessionManager.getSession(session.id);
    expect(updatedSession?.lastValidVersion).toBe(updatedSession?.currentVersion);
  });

  it('should handle session locking during processing', async () => {
    const session = sessionManager.createSession('test-user-6');
    
    // Lock should prevent concurrent processing
    const locked = sessionManager.lockSession(session.id);
    expect(locked).toBe(true);
    expect(sessionManager.isLocked(session.id)).toBe(true);

    // In real scenario, this would prevent another request
    sessionManager.unlockSession(session.id);
    expect(sessionManager.isLocked(session.id)).toBe(false);
  });

  afterAll(() => {
    // Cleanup if needed
  });
});

