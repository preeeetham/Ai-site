/**
 * AI Gateway type definitions
 */

export interface Plan {
  intent: 'ADD' | 'MODIFY' | 'DELETE' | 'REFACTOR' | 'CREATE';
  affectedFiles: string[];
  reasoning: string;
  steps: string[];
}

export interface FileSet {
  [path: string]: string;
}

export interface ProjectContext {
  existingFiles: string[];
  recentChanges: Array<{ path: string; type: 'added' | 'modified' | 'deleted'; oldContent?: string; newContent?: string }>;
  conversationHistory: Message[];
  dependencies: Package[];
}

// FileDiff is exported from types/index.ts to avoid duplication

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Package {
  name: string;
  version: string;
}

export interface BuildError {
  category: string;
  message: string;
  file?: string;
  line?: number;
  stack?: string;
}

export interface ChangeIntent {
  type: 'ADD' | 'MODIFY' | 'DELETE' | 'REFACTOR';
  affectedFiles: string[];
  reasoning: string;
}

