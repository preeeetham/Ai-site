/**
 * Local Storage Adapter - Saves versions to local filesystem
 * For development and testing purposes
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { StorageAdapter, Version, VersionId } from '../types/index.js';
import { VersionManager } from '../vfs/VersionManager.js';

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;
  private versionManager: VersionManager;

  constructor(baseDir: string = './storage') {
    this.baseDir = path.resolve(baseDir);
    this.versionManager = new VersionManager();
  }

  /**
   * Save a version to disk
   */
  async save(sessionId: string, version: Version): Promise<void> {
    const sessionDir = this.getSessionDir(sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Serialize version
    const serialized = this.versionManager.serializeVersion(version);
    const versionFile = path.join(sessionDir, `${version.id}.json`);

    // Write to file
    await fs.writeFile(versionFile, JSON.stringify(serialized, null, 2), 'utf-8');

    // Update session index
    await this.updateSessionIndex(sessionId, version.id);
  }

  /**
   * Load a version from disk
   */
  async load(sessionId: string, versionId: VersionId): Promise<Version> {
    const sessionDir = this.getSessionDir(sessionId);
    const versionFile = path.join(sessionDir, `${versionId}.json`);

    try {
      const data = await fs.readFile(versionFile, 'utf-8');
      const serialized = JSON.parse(data);
      return this.versionManager.deserializeVersion(serialized);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Version not found: ${versionId}`);
      }
      throw error;
    }
  }

  /**
   * List all versions for a session
   */
  async list(sessionId: string): Promise<Version[]> {
    const sessionDir = this.getSessionDir(sessionId);
    const indexPath = path.join(sessionDir, 'index.json');

    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data) as { versionIds: VersionId[] };

      const versions: Version[] = [];
      for (const versionId of index.versionIds) {
        try {
          const version = await this.load(sessionId, versionId);
          versions.push(version);
        } catch (error) {
          // Skip if version file is missing
          console.warn(`Warning: Version ${versionId} not found, skipping`);
        }
      }

      return versions;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Index doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a version from disk
   */
  async delete(sessionId: string, versionId: VersionId): Promise<void> {
    const sessionDir = this.getSessionDir(sessionId);
    const versionFile = path.join(sessionDir, `${versionId}.json`);

    try {
      await fs.unlink(versionFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, that's fine
    }

    // Update session index
    await this.removeFromSessionIndex(sessionId, versionId);
  }

  /**
   * Get the directory path for a session
   */
  private getSessionDir(sessionId: string): string {
    // Sanitize sessionId to prevent path traversal
    const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, sanitized);
  }

  /**
   * Update the session index with a new version ID
   */
  private async updateSessionIndex(sessionId: string, versionId: VersionId): Promise<void> {
    const sessionDir = this.getSessionDir(sessionId);
    const indexPath = path.join(sessionDir, 'index.json');

    let index: { versionIds: VersionId[] };
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(data);
    } catch (error) {
      // Index doesn't exist, create new one
      index = { versionIds: [] };
    }

    // Add versionId if not already present
    if (!index.versionIds.includes(versionId)) {
      index.versionIds.push(versionId);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    }
  }

  /**
   * Remove versionId from session index
   */
  private async removeFromSessionIndex(sessionId: string, versionId: VersionId): Promise<void> {
    const sessionDir = this.getSessionDir(sessionId);
    const indexPath = path.join(sessionDir, 'index.json');

    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data) as { versionIds: VersionId[] };

      index.versionIds = index.versionIds.filter(id => id !== versionId);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      // Index doesn't exist, nothing to do
    }
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }
}

