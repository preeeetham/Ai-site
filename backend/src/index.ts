/**
 * Main entry point for Phase 1 - Virtual File System
 * Example usage and testing
 */

import { VFS } from './vfs/VFS.js';
import { VersionManager } from './vfs/VersionManager.js';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';

// Example usage
async function main() {
  console.log('Phase 1 - Virtual File System Demo\n');

  // Initialize VFS
  const vfs = new VFS();

  // Create some files
  vfs.write('src/index.ts', 'console.log("Hello World");');
  vfs.write('package.json', JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2));
  vfs.write('README.md', '# Test Project\n\nThis is a test project.');

  console.log('Created 3 files');
  console.log('Files:', vfs.list());

  // Create a snapshot
  const versionId1 = vfs.snapshot();
  console.log(`\nCreated snapshot: ${versionId1}`);

  // Modify a file
  vfs.write('src/index.ts', 'console.log("Hello, Phase 1!");');
  vfs.write('src/utils.ts', 'export function helper() {}');

  // Create another snapshot
  const versionId2 = vfs.snapshot();
  console.log(`Created snapshot: ${versionId2}`);

  // Compute diff
  const diffs = vfs.diff(versionId1, versionId2);
  console.log('\nDiff between versions:');
  diffs.forEach(diff => {
    console.log(`- ${diff.type}: ${diff.path}`);
  });

  // Restore to first version
  vfs.restore(versionId1);
  console.log('\nRestored to version 1');
  console.log('Files:', vfs.list());
  console.log('Content of index.ts:', vfs.read('src/index.ts'));

  // Test VersionManager
  console.log('\n--- Version Manager Test ---');
  const versionManager = new VersionManager();
  
  const files = vfs.getAllFiles();
  const version = versionManager.createVersion('session-123', files, 'VALID');
  console.log(`Created version: ${version.id} with status: ${version.status}`);

  // Test Storage Adapter
  console.log('\n--- Storage Adapter Test ---');
  const storage = new LocalStorageAdapter('./storage');
  await storage.initialize();
  
  await storage.save('session-123', version);
  console.log('Saved version to storage');

  const loaded = await storage.load('session-123', version.id);
  console.log(`Loaded version: ${loaded.id} with ${loaded.files.size} files`);

  const allVersions = await storage.list('session-123');
  console.log(`Total versions in session: ${allVersions.length}`);
}

// Run if this file is executed directly
if (import.meta.url.endsWith(process.argv[1] || 'index.ts')) {
  main().catch(console.error);
}

