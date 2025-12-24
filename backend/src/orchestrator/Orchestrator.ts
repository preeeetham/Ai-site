/**
 * Orchestrator - Coordinates the AI generation pipeline
 */

import { AIGateway } from '../ai/AIGateway.js';
import { ContextManager } from '../context/ContextManager.js';
import { VFS } from '../vfs/VFS.js';
import { VersionManager } from '../vfs/VersionManager.js';
import { SessionManager } from '../sessions/SessionManager.js';
import type { FileSet, Package, BuildError } from '../types/ai.js';
import type { FileDiff, Version } from '../types/index.js';
import { SessionState } from '../types/session.js';

export class Orchestrator {
  private aiGateway: AIGateway;
  private contextManager: ContextManager;
  private vfs: VFS;
  private versionManager: VersionManager;
  private sessionManager: SessionManager;

  constructor(
    aiGateway: AIGateway,
    contextManager: ContextManager,
    vfs: VFS,
    versionManager: VersionManager,
    sessionManager: SessionManager
  ) {
    this.aiGateway = aiGateway;
    this.contextManager = contextManager;
    this.vfs = vfs;
    this.versionManager = versionManager;
    this.sessionManager = sessionManager;
  }

  /**
   * Execute the full pipeline: prompt → plan → generate → commit
   */
  async execute(sessionId: string, userPrompt: string): Promise<string> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      // Step 1: Add user message to history
      this.contextManager.addMessage(sessionId, 'user', userPrompt);

      // Step 2: Get current state
      const currentVersion: Version | null = session.currentVersion
        ? (this.versionManager.getVersion(session.currentVersion) || null)
        : null;

      // Step 3: Build context
      const recentChanges: FileDiff[] = []; // TODO: Compute from version diffs
      const dependencies: Package[] = currentVersion?.files.has('package.json')
        ? this.contextManager.extractDependencies(currentVersion.files.get('package.json')!)
        : [];

      let context = this.contextManager.buildContext(
        sessionId,
        currentVersion,
        recentChanges,
        dependencies
      );

      // Compress if needed
      context = this.contextManager.compressContext(context);

      // Step 4: Plan
      this.sessionManager.transitionState(sessionId, SessionState.GENERATING, 'Planning changes');
      const plan = await this.aiGateway.plan(userPrompt, context);
      
      this.contextManager.addMessage(sessionId, 'assistant', `Planning: ${plan.reasoning}`);

      // Step 5: Generate files
      const existingFiles = currentVersion?.files || new Map();
      const fileSet = await this.aiGateway.generate(plan, context, existingFiles);

      // Step 6: Commit to VFS
      this.sessionManager.transitionState(sessionId, SessionState.BUILDING, 'Committing changes');
      
      // Clear VFS and write new files
      this.vfs.clear();
      for (const [path, content] of Object.entries(fileSet)) {
        this.vfs.write(path, content);
      }

      // Create version
      const files = this.vfs.getAllFiles();
      const version = this.versionManager.createVersion(sessionId, files, 'BUILDING');
      
      this.sessionManager.setCurrentVersion(sessionId, version.id);
      this.sessionManager.transitionState(sessionId, SessionState.VALIDATING, 'Validating build');

      // Step 7: For now, mark as ready (in Phase 4, this will trigger actual build)
      this.versionManager.updateVersionStatus(version.id, 'VALID');
      this.sessionManager.transitionState(sessionId, SessionState.READY, 'Build complete');

      this.contextManager.addMessage(
        sessionId,
        'assistant',
        `Generated ${Object.keys(fileSet).length} files based on: ${plan.reasoning}`
      );

      return version.id;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sessionManager.transitionState(sessionId, SessionState.FAILED, errorMessage);
      throw error;
    }
  }

  /**
   * Fix errors in the current version
   */
  async fixErrors(sessionId: string, error: BuildError): Promise<string> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.currentVersion) {
      throw new Error('No current version to fix');
    }

    try {
      this.sessionManager.transitionState(sessionId, SessionState.FIXING, 'Fixing errors');

      const version = this.versionManager.getVersion(session.currentVersion);
      if (!version) {
        throw new Error('Version not found');
      }

      // Convert version files to FileSet
      const files: FileSet = {};
      version.files.forEach((content, path) => {
        files[path] = content;
      });

      // Build context
      const context = this.contextManager.buildContext(sessionId, version, []);

      // Fix files
      const fixedFiles = await this.aiGateway.fix(error, files, context);

      // Update VFS
      this.vfs.clear();
      for (const [path, content] of Object.entries(fixedFiles)) {
        this.vfs.write(path, content);
      }

      // Create new version
      const filesMap = this.vfs.getAllFiles();
      const newVersion = this.versionManager.createVersion(sessionId, filesMap, 'BUILDING');
      
      this.sessionManager.setCurrentVersion(sessionId, newVersion.id);
      this.sessionManager.transitionState(sessionId, SessionState.BUILDING, 'Rebuilding');

      // Mark as valid (in Phase 4, this will trigger build)
      this.versionManager.updateVersionStatus(newVersion.id, 'VALID');
      this.sessionManager.transitionState(sessionId, SessionState.READY, 'Fix complete');

      return newVersion.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sessionManager.transitionState(sessionId, SessionState.FAILED, errorMessage);
      throw error;
    }
  }
}

