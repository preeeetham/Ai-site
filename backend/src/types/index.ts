/**
 * Core type definitions (from Phase 1)
 */

export type VersionId = string;

export type VersionStatus = 'BUILDING' | 'VALID' | 'FAILED';

export interface Version {
  id: VersionId;
  timestamp: Date;
  files: Map<string, string>;
  status: VersionStatus;
  errorLog?: string;
}

export interface FileDiff {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
}

export interface StorageAdapter {
  save(sessionId: string, version: Version): Promise<void>;
  load(sessionId: string, versionId: VersionId): Promise<Version>;
  list(sessionId: string): Promise<Version[]>;
  delete(sessionId: string, versionId: VersionId): Promise<void>;
}

/**
 * Re-export other types
 */
export * from './ai.js';
export * from './session.js';
