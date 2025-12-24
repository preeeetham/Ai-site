/**
 * Phase 3 Tests: AI Gateway
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../src/context/ContextManager.js';
import type { Version } from '../types/index.js';

describe('Phase 3: AI Gateway', () => {
  describe('ContextManager', () => {
    let manager: ContextManager;

    beforeEach(() => {
      manager = new ContextManager();
    });

    it('should build context from version', () => {
      const version: Version = {
        id: 'v1',
        timestamp: new Date(),
        files: new Map([
          ['index.ts', 'content'],
          ['package.json', '{"name": "test"}'],
        ]),
        status: 'VALID',
      };

      const context = manager.buildContext('session-1', version, []);

      expect(context.existingFiles).toContain('index.ts');
      expect(context.existingFiles).toContain('package.json');
      expect(context.conversationHistory).toEqual([]);
      expect(context.recentChanges).toEqual([]);
    });

    it('should prioritize changed files', () => {
      const version: Version = {
        id: 'v1',
        timestamp: new Date(),
        files: new Map([
          ['changed.ts', 'content'],
          ['unchanged.ts', 'content'],
          ['also-changed.ts', 'content'],
        ]),
        status: 'VALID',
      };

      const recentChanges = [
        { path: 'changed.ts', type: 'modified' as const, newContent: 'new' },
        { path: 'also-changed.ts', type: 'modified' as const, newContent: 'new' },
      ];

      const context = manager.buildContext('session-1', version, recentChanges);

      // Changed files should come first
      expect(context.existingFiles[0]).toBe('changed.ts');
      expect(context.existingFiles[1]).toBe('also-changed.ts');
    });

    it('should manage conversation history', () => {
      manager.addMessage('session-1', 'user', 'Hello');
      manager.addMessage('session-1', 'assistant', 'Hi there!');
      manager.addMessage('session-1', 'user', 'Build a todo app');

      const history = manager.getConversationHistory('session-1');
      expect(history.length).toBe(3);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[2].content).toBe('Build a todo app');
    });

    it('should limit conversation history length', () => {
      // Add more than maxHistoryLength (5) messages
      for (let i = 0; i < 10; i++) {
        manager.addMessage('session-1', 'user', `Message ${i}`);
      }

      const history = manager.getConversationHistory('session-1');
      expect(history.length).toBe(5); // Should be limited
      expect(history[0].content).toBe('Message 5'); // Oldest kept
      expect(history[4].content).toBe('Message 9'); // Newest
    });

    it('should extract dependencies from package.json', () => {
      const packageJson = JSON.stringify({
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0',
        },
        devDependencies: {
          'typescript': '^5.0.0',
        },
      });

      const deps = manager.extractDependencies(packageJson);
      expect(deps.length).toBe(3);
      expect(deps.find(d => d.name === 'react')).toBeDefined();
      expect(deps.find(d => d.name === 'typescript')).toBeDefined();
    });

    it('should handle invalid package.json gracefully', () => {
      const deps = manager.extractDependencies('invalid json');
      expect(deps).toEqual([]);
    });

    it('should compress context', () => {
      const version: Version = {
        id: 'v1',
        timestamp: new Date(),
        files: new Map(
          Array.from({ length: 50 }, (_, i) => [`file${i}.ts`, 'content'])
        ),
        status: 'VALID',
      };

      const context = manager.buildContext('session-1', version, []);
      const compressed = manager.compressContext(context, 20);

      expect(compressed.existingFiles.length).toBe(20);
      expect(context.existingFiles.length).toBe(50);
    });

    it('should clear conversation history', () => {
      manager.addMessage('session-1', 'user', 'Hello');
      manager.clearHistory('session-1');

      const history = manager.getConversationHistory('session-1');
      expect(history).toEqual([]);
    });
  });

  describe('AIGateway (mocked)', () => {
    // Note: Full AI Gateway testing requires API key and actual API calls
    // These would be integration tests
    it('should be importable', async () => {
      // Just verify the module can be imported
      const module = await import('../src/ai/AIGateway.js');
      expect(module.AIGateway).toBeDefined();
    });
  });
});

