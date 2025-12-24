/**
 * Version Manager - Manages immutable versions of projects
 */

import type { Version, VersionId, VersionStatus } from '../types/index.js';

export class VersionManager {
  private versions: Map<string, Version> = new Map(); // versionId -> Version
  private sessionVersions: Map<string, VersionId[]> = new Map(); // sessionId -> versionIds[]

  /**
   * Create a new version from files
   */
  createVersion(
    sessionId: string,
    files: Map<string, string>,
    status: VersionStatus = 'BUILDING'
  ): Version {
    const versionId = this.generateVersionId();
    const version: Version = {
      id: versionId,
      timestamp: new Date(),
      files: new Map(files), // Create a copy to ensure immutability
      status,
    };

    // Store version
    this.versions.set(versionId, version);

    // Track version for session
    if (!this.sessionVersions.has(sessionId)) {
      this.sessionVersions.set(sessionId, []);
    }
    this.sessionVersions.get(sessionId)!.push(versionId);

    return version;
  }

  /**
   * Get a version by ID
   */
  getVersion(versionId: VersionId): Version | undefined {
    return this.versions.get(versionId);
  }

  /**
   * Update version status
   * Note: We create a new version object to maintain immutability
   */
  updateVersionStatus(versionId: VersionId, status: VersionStatus, errorLog?: string): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Create new version object with updated status
    const updatedVersion: Version = {
      ...version,
      status,
      errorLog,
      timestamp: new Date(), // Update timestamp on status change
    };

    this.versions.set(versionId, updatedVersion);
  }

  /**
   * Get the last valid version for a session
   */
  getLastValidVersion(sessionId: string): Version | undefined {
    const versionIds = this.sessionVersions.get(sessionId);
    if (!versionIds || versionIds.length === 0) {
      return undefined;
    }

    // Search backwards for the last valid version
    for (let i = versionIds.length - 1; i >= 0; i--) {
      const versionId = versionIds[i];
      const version = this.versions.get(versionId);
      if (version && version.status === 'VALID') {
        return version;
      }
    }

    return undefined;
  }

  /**
   * Get all versions for a session
   */
  getSessionVersions(sessionId: string): Version[] {
    const versionIds = this.sessionVersions.get(sessionId);
    if (!versionIds) {
      return [];
    }

    return versionIds
      .map(id => this.versions.get(id))
      .filter((v): v is Version => v !== undefined)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get the latest version for a session (regardless of status)
   */
  getLatestVersion(sessionId: string): Version | undefined {
    const versionIds = this.sessionVersions.get(sessionId);
    if (!versionIds || versionIds.length === 0) {
      return undefined;
    }

    const latestId = versionIds[versionIds.length - 1];
    return this.versions.get(latestId);
  }

  /**
   * Delete old versions (garbage collection)
   * Deletes versions older than specified days
   * @returns Number of versions deleted
   */
  garbageCollect(daysToKeep: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const versionsToDelete: VersionId[] = [];

    for (const [versionId, version] of this.versions.entries()) {
      if (version.timestamp < cutoffDate) {
        versionsToDelete.push(versionId);
      }
    }

    // Delete versions
    for (const versionId of versionsToDelete) {
      this.versions.delete(versionId);
    }

    // Clean up session version lists
    for (const [sessionId, versionIds] of this.sessionVersions.entries()) {
      const filtered = versionIds.filter(id => this.versions.has(id));
      if (filtered.length === 0) {
        this.sessionVersions.delete(sessionId);
      } else {
        this.sessionVersions.set(sessionId, filtered);
      }
    }

    return versionsToDelete.length;
  }

  /**
   * Clear all versions (useful for testing)
   */
  clear(): void {
    this.versions.clear();
    this.sessionVersions.clear();
  }

  /**
   * Convert Version to serializable format (for storage)
   */
  serializeVersion(version: Version): {
    id: string;
    timestamp: string;
    files: Record<string, string>;
    status: VersionStatus;
    errorLog?: string;
  } {
    return {
      id: version.id,
      timestamp: version.timestamp.toISOString(),
      files: Object.fromEntries(version.files),
      status: version.status,
      errorLog: version.errorLog,
    };
  }

  /**
   * Deserialize version from storage format
   */
  deserializeVersion(data: {
    id: string;
    timestamp: string;
    files: Record<string, string>;
    status: VersionStatus;
    errorLog?: string;
  }): Version {
    return {
      id: data.id,
      timestamp: new Date(data.timestamp),
      files: new Map(Object.entries(data.files)),
      status: data.status,
      errorLog: data.errorLog,
    };
  }

  /**
   * Generate a unique version ID
   */
  private generateVersionId(): VersionId {
    return `v${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

