/**
 * AI Gateway - Main interface for AI operations
 * Handles planning, generation, and error fixing
 */

import { GeminiClient } from './GeminiClient.js';
import type { Plan, FileSet, BuildError, ProjectContext } from '../types/ai.js';

export class AIGateway {
  private client: GeminiClient;

  constructor(apiKey: string) {
    this.client = new GeminiClient(apiKey);
  }

  /**
   * Plan the changes needed based on user prompt
   */
  async plan(userPrompt: string, context: ProjectContext): Promise<Plan> {
    const prompt = this.buildPlanningPrompt(userPrompt, context);

    const schema = {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['ADD', 'MODIFY', 'DELETE', 'REFACTOR', 'CREATE'],
        },
        affectedFiles: {
          type: 'array',
          items: { type: 'string' },
        },
        reasoning: { type: 'string' },
        steps: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['intent', 'affectedFiles', 'reasoning', 'steps'],
    };

    const result = await this.client.generateJSON<Plan>(prompt, schema, {
      temperature: 0.3,
    });

    // Validate result
    if (!result.intent || !result.affectedFiles || !result.reasoning) {
      throw new Error('Invalid plan response from AI');
    }

    return result;
  }

  /**
   * Generate files based on plan
   */
  async generate(plan: Plan, _context: ProjectContext, existingFiles: Map<string, string>): Promise<FileSet> {
    const prompt = this.buildGenerationPrompt(plan, existingFiles);

    const response = await this.client.generateContent(prompt, {
      temperature: 0.7,
      maxTokens: 8192,
    });

    // Parse response to extract file contents
    // Expected format: JSON with file paths as keys and content as values
    try {
      const fileSet = JSON.parse(response) as FileSet;
      return fileSet;
    } catch {
      // If not JSON, try to extract from markdown code blocks
      return this.parseFileSetFromMarkdown(response);
    }
  }

  /**
   * Fix errors in files
   */
  async fix(error: BuildError, files: FileSet, _context: ProjectContext): Promise<FileSet> {
    const prompt = this.buildFixPrompt(error, files);

    const response = await this.client.generateContent(prompt, {
      temperature: 0.5,
      maxTokens: 4096,
    });

    try {
      const fixedFiles = JSON.parse(response) as FileSet;
      return fixedFiles;
    } catch {
      return this.parseFileSetFromMarkdown(response);
    }
  }

  /**
   * Build planning prompt
   */
  private buildPlanningPrompt(userPrompt: string, context: ProjectContext): string {
    const existingFilesList = context.existingFiles.length > 0
      ? `Existing files: ${context.existingFiles.join(', ')}`
      : 'No existing files (new project)';

    return `You are a code planning AI. Analyze the user's request and create a plan.

User Request: "${userPrompt}"

${existingFilesList}

${context.recentChanges.length > 0
  ? `Recent changes:\n${context.recentChanges.map(c => `- ${c.type}: ${c.path}`).join('\n')}`
  : ''
}

Respond with JSON only:
{
  "intent": "ADD" | "MODIFY" | "DELETE" | "REFACTOR" | "CREATE",
  "affectedFiles": ["file1.ts", "file2.ts"],
  "reasoning": "Brief explanation of what needs to be done",
  "steps": ["step1", "step2"]
}`;
  }

  /**
   * Build generation prompt
   */
  private buildGenerationPrompt(
    plan: Plan,
    existingFiles: Map<string, string>
  ): string {
    const existingContent = Array.from(existingFiles.entries())
      .map(([path, content]) => `// File: ${path}\n${content}`)
      .join('\n\n---\n\n');

    return `You are a code generator. Generate the files needed to implement this plan.

Plan:
Intent: ${plan.intent}
Affected Files: ${plan.affectedFiles.join(', ')}
Reasoning: ${plan.reasoning}
Steps: ${plan.steps.join('; ')}

${existingContent ? `Existing files:\n${existingContent}\n\n` : ''}

Generate ONLY the files that need to be created or modified. Respond with JSON:
{
  "path/to/file.ts": "file content here",
  "another/file.ts": "another file content"
}

Only include files mentioned in affectedFiles. Return JSON only, no explanations.`;
  }

  /**
   * Build fix prompt
   */
  private buildFixPrompt(error: BuildError, files: FileSet): string {
    const errorContext = error.file
      ? `Error in ${error.file}${error.line ? ` at line ${error.line}` : ''}`
      : 'Build error';

    const relevantFiles = error.file
      ? { [error.file]: files[error.file] }
      : files;

    const fileContent = Object.entries(relevantFiles)
      .map(([path, content]) => `// File: ${path}\n${content}`)
      .join('\n\n---\n\n');

    return `You are a code fixer. Fix this build error.

${errorContext}
Error: ${error.message}
${error.stack ? `Stack: ${error.stack}` : ''}

Files to fix:
${fileContent}

Respond with JSON containing only the fixed files:
{
  "path/to/file.ts": "fixed file content"
}

Return JSON only, no explanations.`;
  }

  /**
   * Parse file set from markdown code blocks
   */
  private parseFileSetFromMarkdown(markdown: string): FileSet {
    const fileSet: FileSet = {};
    
    // Pattern: ```typescript:path/to/file.ts or ```path/to/file.ts
    const codeBlockRegex = /```(?:\w+)?:?([^\n]+)\n([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const path = match[1].trim();
      const content = match[2].trim();
      fileSet[path] = content;
    }

    // If no code blocks found, try to find file paths in the text
    if (Object.keys(fileSet).length === 0) {
      // Fallback: assume entire response is a single file
      // This is a simple fallback - in production, you'd want better parsing
      fileSet['index.ts'] = markdown.trim();
    }

    return fileSet;
  }
}

