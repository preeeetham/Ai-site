/**
 * Context Manager - Manages project context for AI requests
 * Handles file selection, conversation history, and context compression
 */

import type { ProjectContext, Message, Package } from '../types/ai.js';
import type { Version } from '../types/index.js';
import type { FileDiff } from '../types/index.js';

export class ContextManager {
  private conversationHistory: Map<string, Message[]> = new Map();
  private readonly maxHistoryLength = 5;

  /**
   * Build context for a session
   */
  buildContext(
    sessionId: string,
    currentVersion: Version | null,
    recentChanges: FileDiff[],
    dependencies?: Package[]
  ): ProjectContext {
    const existingFiles = currentVersion
      ? Array.from(currentVersion.files.keys())
      : [];

    const conversationHistory = this.getConversationHistory(sessionId);
    const recentChangesList = recentChanges.slice(0, 3); // Last 3 changes

    return {
      existingFiles: this.prioritizeFiles(existingFiles, recentChangesList),
      recentChanges: recentChangesList,
      conversationHistory: conversationHistory.slice(-this.maxHistoryLength), // Last 5 messages
      dependencies: dependencies || [],
    };
  }

  /**
   * Add message to conversation history
   */
  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }

    const history = this.conversationHistory.get(sessionId)!;
    history.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Keep only last maxHistoryLength messages
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string): Message[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Clear conversation history for a session
   */
  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Prioritize files - changed files first, then by importance
   */
  private prioritizeFiles(files: string[], recentChanges: FileDiff[]): string[] {
    const changedPaths = new Set(recentChanges.map(c => c.path));
    
    // Split into changed and unchanged
    const changed = files.filter(f => changedPaths.has(f));
    const unchanged = files.filter(f => !changedPaths.has(f));

    // Sort unchanged by importance (index files, config files first)
    unchanged.sort((a, b) => {
      const aScore = this.getFileImportanceScore(a);
      const bScore = this.getFileImportanceScore(b);
      return bScore - aScore;
    });

    return [...changed, ...unchanged];
  }

  /**
   * Get file importance score for sorting
   */
  private getFileImportanceScore(path: string): number {
    let score = 0;

    // Index/entry files are most important
    if (path.includes('index.') || path.includes('main.') || path.includes('app.')) {
      score += 10;
    }

    // Config files are important
    if (path.includes('package.json') || path.includes('tsconfig.json') || path.includes('vite.config')) {
      score += 8;
    }

    // Component files
    if (path.match(/\.(tsx|jsx)$/)) {
      score += 5;
    }

    // TypeScript files
    if (path.match(/\.ts$/)) {
      score += 3;
    }

    // Shorter paths (likely root-level files) are more important
    const depth = (path.match(/\//g) || []).length;
    score -= depth;

    return score;
  }

  /**
   * Compress context to fit token limits
   * (Simplified - in production, use actual token counting)
   */
  compressContext(context: ProjectContext, maxFiles: number = 20): ProjectContext {
    return {
      ...context,
      existingFiles: context.existingFiles.slice(0, maxFiles),
      recentChanges: context.recentChanges.slice(0, 3),
      conversationHistory: context.conversationHistory.slice(-this.maxHistoryLength),
    };
  }

  /**
   * Extract dependencies from package.json content
   */
  extractDependencies(packageJsonContent: string): Package[] {
    try {
      const pkg = JSON.parse(packageJsonContent);
      const deps: Package[] = [];

      if (pkg.dependencies) {
        Object.entries(pkg.dependencies).forEach(([name, version]) => {
          deps.push({ name, version: String(version) });
        });
      }

      if (pkg.devDependencies) {
        Object.entries(pkg.devDependencies).forEach(([name, version]) => {
          deps.push({ name, version: String(version) });
        });
      }

      return deps;
    } catch {
      return [];
    }
  }
}

