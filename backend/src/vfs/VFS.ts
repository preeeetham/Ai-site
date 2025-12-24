/**
 * Virtual File System - Core implementation
 * Manages in-memory file storage with versioning support
 */

import type { VersionId, FileDiff } from '../types/index.js';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_PATH_LENGTH = 4096; // Maximum path length

export class VFS {
  private files: Map<string, string> = new Map();
  private snapshots: Map<VersionId, Map<string, string>> = new Map();

  /**
   * Write content to a file path
   * Validates path and file size before writing
   */
  write(path: string, content: string): void {
    // Validate path
    this.validatePath(path);

    // Validate file size
    const contentSize = new Blob([content]).size;
    if (contentSize > MAX_FILE_SIZE) {
      throw new Error(`File size ${contentSize} exceeds maximum allowed size ${MAX_FILE_SIZE}`);
    }

    // Normalize path (remove leading/trailing slashes, handle multiple slashes)
    const normalizedPath = this.normalizePath(path);
    
    this.files.set(normalizedPath, content);
  }

  /**
   * Read content from a file path
   */
  read(path: string): string {
    const normalizedPath = this.normalizePath(path);
    
    if (!this.files.has(normalizedPath)) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    return this.files.get(normalizedPath)!;
  }

  /**
   * Check if a file exists
   */
  exists(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath);
  }

  /**
   * Delete a file
   */
  delete(path: string): void {
    const normalizedPath = this.normalizePath(path);
    this.files.delete(normalizedPath);
  }

  /**
   * List all file paths
   */
  list(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Get all files as a Map
   */
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  /**
   * Create a snapshot of the current file state
   * Uses copy-on-write: only creates a shallow copy of the Map
   */
  snapshot(): VersionId {
    const versionId = this.generateVersionId();
    
    // Copy-on-write: create a new Map with current files
    // Since Maps store references, unchanged files will share the same string content
    const snapshot = new Map(this.files);
    this.snapshots.set(versionId, snapshot);
    
    return versionId;
  }

  /**
   * Restore files from a snapshot
   */
  restore(versionId: VersionId): void {
    if (!this.snapshots.has(versionId)) {
      throw new Error(`Snapshot not found: ${versionId}`);
    }

    const snapshot = this.snapshots.get(versionId)!;
    // Restore by copying snapshot files
    this.files = new Map(snapshot);
  }

  /**
   * Compute diff between two snapshots
   */
  diff(v1: VersionId, v2: VersionId): FileDiff[] {
    const snapshot1 = this.snapshots.get(v1);
    const snapshot2 = this.snapshots.get(v2);

    if (!snapshot1) {
      throw new Error(`Snapshot not found: ${v1}`);
    }
    if (!snapshot2) {
      throw new Error(`Snapshot not found: ${v2}`);
    }

    const diffs: FileDiff[] = [];
    const allPaths = new Set([
      ...snapshot1.keys(),
      ...snapshot2.keys()
    ]);

    for (const path of allPaths) {
      const content1 = snapshot1.get(path);
      const content2 = snapshot2.get(path);

      if (content1 === undefined && content2 !== undefined) {
        // File was added
        diffs.push({
          path,
          type: 'added',
          newContent: content2
        });
      } else if (content1 !== undefined && content2 === undefined) {
        // File was deleted
        diffs.push({
          path,
          type: 'deleted',
          oldContent: content1
        });
      } else if (content1 !== content2) {
        // File was modified
        diffs.push({
          path,
          type: 'modified',
          oldContent: content1,
          newContent: content2!
        });
      }
      // If content1 === content2, file is unchanged - no diff entry
    }

    return diffs;
  }

  /**
   * Clear all files (useful for testing)
   */
  clear(): void {
    this.files.clear();
    this.snapshots.clear();
  }

  /**
   * Get snapshot data (for storage adapter)
   */
  getSnapshot(versionId: VersionId): Map<string, string> | undefined {
    return this.snapshots.get(versionId);
  }

  // Private helper methods

  /**
   * Validate file path to prevent path traversal attacks
   */
  private validatePath(path: string): void {
    if (path.length > MAX_PATH_LENGTH) {
      throw new Error(`Path length ${path.length} exceeds maximum ${MAX_PATH_LENGTH}`);
    }

    // Prevent path traversal
    if (path.includes('..')) {
      throw new Error('Path traversal detected: paths cannot contain ".."');
    }

    // Prevent absolute paths
    if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
      throw new Error('Absolute paths are not allowed');
    }

    // Prevent null bytes
    if (path.includes('\0')) {
      throw new Error('Null bytes are not allowed in paths');
    }
  }

  /**
   * Normalize path: remove leading/trailing slashes, collapse multiple slashes
   */
  private normalizePath(path: string): string {
    return path
      .split('/')
      .filter(segment => segment.length > 0)
      .join('/');
  }

  /**
   * Generate a unique version ID
   */
  private generateVersionId(): VersionId {
    return `v${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

