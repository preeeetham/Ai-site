/**
 * Phase 1 Tests: Virtual File System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VFS } from '../src/vfs/VFS.js';
import { VersionManager } from '../src/vfs/VersionManager.js';
import { LocalStorageAdapter } from '../src/storage/LocalStorageAdapter.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Phase 1: Virtual File System', () => {
  describe('VFS', () => {
    let vfs: VFS;

    beforeEach(() => {
      vfs = new VFS();
    });

    it('should write and read files', () => {
      vfs.write('test.txt', 'Hello World');
      expect(vfs.read('test.txt')).toBe('Hello World');
    });

    it('should handle multiple files', () => {
      vfs.write('file1.txt', 'Content 1');
      vfs.write('file2.txt', 'Content 2');
      vfs.write('src/index.ts', 'console.log("test");');

      expect(vfs.read('file1.txt')).toBe('Content 1');
      expect(vfs.read('file2.txt')).toBe('Content 2');
      expect(vfs.read('src/index.ts')).toBe('console.log("test");');
    });

    it('should prevent path traversal attacks', () => {
      expect(() => vfs.write('../etc/passwd', 'hack')).toThrow();
      expect(() => vfs.write('../../etc/passwd', 'hack')).toThrow();
      expect(() => vfs.write('..', 'hack')).toThrow();
    });

    it('should prevent absolute paths', () => {
      expect(() => vfs.write('/etc/passwd', 'hack')).toThrow();
      expect(() => vfs.write('C:\\Windows\\System32', 'hack')).toThrow();
    });

    it('should create and restore snapshots', () => {
      vfs.write('file1.txt', 'Version 1');
      vfs.write('file2.txt', 'Version 1');
      
      const versionId1 = vfs.snapshot();
      
      vfs.write('file1.txt', 'Version 2');
      vfs.write('file3.txt', 'New file');
      
      const versionId2 = vfs.snapshot();
      
      // Restore to version 1
      vfs.restore(versionId1);
      expect(vfs.read('file1.txt')).toBe('Version 1');
      expect(vfs.read('file2.txt')).toBe('Version 1');
      expect(() => vfs.read('file3.txt')).toThrow(); // Should not exist
      
      // Restore to version 2
      vfs.restore(versionId2);
      expect(vfs.read('file1.txt')).toBe('Version 2');
      expect(vfs.read('file3.txt')).toBe('New file');
    });

    it('should compute diffs between versions', () => {
      vfs.write('file1.txt', 'Original');
      vfs.write('file2.txt', 'Original');
      const v1 = vfs.snapshot();
      
      vfs.write('file1.txt', 'Modified');
      vfs.write('file3.txt', 'New');
      vfs.delete('file2.txt');
      const v2 = vfs.snapshot();
      
      const diffs = vfs.diff(v1, v2);
      
      expect(diffs.length).toBe(3);
      expect(diffs.find(d => d.path === 'file1.txt' && d.type === 'modified')).toBeDefined();
      expect(diffs.find(d => d.path === 'file3.txt' && d.type === 'added')).toBeDefined();
      expect(diffs.find(d => d.path === 'file2.txt' && d.type === 'deleted')).toBeDefined();
    });

    it('should list all files', () => {
      vfs.write('a.txt', 'A');
      vfs.write('b.txt', 'B');
      vfs.write('src/c.txt', 'C');
      
      const files = vfs.list();
      expect(files).toContain('a.txt');
      expect(files).toContain('b.txt');
      expect(files).toContain('src/c.txt');
      expect(files.length).toBe(3);
    });

    it('should enforce file size limits', () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      expect(() => vfs.write('large.txt', largeContent)).toThrow();
    });
  });

  describe('VersionManager', () => {
    let manager: VersionManager;

    beforeEach(() => {
      manager = new VersionManager();
    });

    it('should create versions', () => {
      const files = new Map([
        ['file1.txt', 'Content 1'],
        ['file2.txt', 'Content 2'],
      ]);

      const version = manager.createVersion('session-1', files, 'VALID');
      
      expect(version.id).toMatch(/^v\d+-/);
      expect(version.files.size).toBe(2);
      expect(version.status).toBe('VALID');
      expect(version.timestamp).toBeInstanceOf(Date);
    });

    it('should get versions', () => {
      const files = new Map([['test.txt', 'content']]);
      const version = manager.createVersion('session-1', files, 'VALID');
      
      const retrieved = manager.getVersion(version.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(version.id);
    });

    it('should update version status', () => {
      const files = new Map([['test.txt', 'content']]);
      const version = manager.createVersion('session-1', files, 'BUILDING');
      
      manager.updateVersionStatus(version.id, 'VALID');
      
      const updated = manager.getVersion(version.id);
      expect(updated?.status).toBe('VALID');
    });

    it('should get last valid version', () => {
      const files1 = new Map([['v1.txt', 'v1']]);
      const v1 = manager.createVersion('session-1', files1, 'VALID');
      
      const files2 = new Map([['v2.txt', 'v2']]);
      const v2 = manager.createVersion('session-1', files2, 'FAILED');
      
      const files3 = new Map([['v3.txt', 'v3']]);
      const v3 = manager.createVersion('session-1', files3, 'VALID');
      
      const lastValid = manager.getLastValidVersion('session-1');
      expect(lastValid?.id).toBe(v3.id);
    });

    it('should serialize and deserialize versions', () => {
      const files = new Map([
        ['file1.txt', 'Content 1'],
        ['file2.txt', 'Content 2'],
      ]);
      const version = manager.createVersion('session-1', files, 'VALID');
      
      const serialized = manager.serializeVersion(version);
      const deserialized = manager.deserializeVersion(serialized);
      
      expect(deserialized.id).toBe(version.id);
      expect(deserialized.status).toBe(version.status);
      expect(deserialized.files.size).toBe(2);
      expect(deserialized.files.get('file1.txt')).toBe('Content 1');
    });
  });

  describe('LocalStorageAdapter', () => {
    const storageDir = path.join(process.cwd(), 'test-storage');
    let adapter: LocalStorageAdapter;

    beforeEach(async () => {
      // Clean up test storage
      try {
        await fs.rm(storageDir, { recursive: true, force: true });
      } catch {}
      
      adapter = new LocalStorageAdapter(storageDir);
      await adapter.initialize();
    });

    afterEach(async () => {
      // Clean up
      try {
        await fs.rm(storageDir, { recursive: true, force: true });
      } catch {}
    });

    it('should save and load versions', async () => {
      const files = new Map([
        ['test.txt', 'Test content'],
        ['src/index.ts', 'console.log("hello");'],
      ]);

      const versionManager = new VersionManager();
      const version = versionManager.createVersion('session-1', files, 'VALID');

      await adapter.save('session-1', version);
      const loaded = await adapter.load('session-1', version.id);

      expect(loaded.id).toBe(version.id);
      expect(loaded.files.size).toBe(2);
      expect(loaded.files.get('test.txt')).toBe('Test content');
      expect(loaded.status).toBe('VALID');
    });

    it('should list all versions for a session', async () => {
      const versionManager = new VersionManager();
      
      const v1 = versionManager.createVersion('session-1', new Map([['v1.txt', 'v1']]), 'VALID');
      const v2 = versionManager.createVersion('session-1', new Map([['v2.txt', 'v2']]), 'VALID');

      await adapter.save('session-1', v1);
      await adapter.save('session-1', v2);

      const versions = await adapter.list('session-1');
      expect(versions.length).toBe(2);
      expect(versions.map(v => v.id)).toContain(v1.id);
      expect(versions.map(v => v.id)).toContain(v2.id);
    });

    it('should handle missing versions', async () => {
      await expect(adapter.load('session-1', 'non-existent')).rejects.toThrow();
    });
  });
});

