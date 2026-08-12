import type { CodingTaskRequest, CodingTaskResult, ProposedFileChange } from './CodingTask.js';
import type { IFileSystem } from '../../filesystem/IFileSystem.js';
import type { IAIProvider } from '../../ai/IAIProvider.js';
import type { ISourceIndex } from '../../source/ISourceIndex.js';
import type { ISymbolStore } from '../../symbol/ISymbolStore.js';
import type { IReferenceEngine } from '../../reference/IReferenceEngine.js';
import type { IDiffEngine } from '../../diff/IDiffEngine.js';
import type { IPatchEngine } from '../../patch/IPatchEngine.js';
import type { IValidationEngine } from '../../validation/IValidationEngine.js';
import type { DiffResult } from '../../diff/DiffResult.js';
import type { ValidationResult } from '../../validation/ValidationTypes.js';
import type { AIMessage } from '../../ai/AIMessage.js';
import { MessageRole } from '../../ai/AIMessage.js';
import { PromptEngine } from '../../prompt/PromptEngine.js';
import { LanguageService } from '../../language/LanguageService.js';
import { DiffEngine } from '../../diff/DiffEngine.js';
import { PatchEngine } from '../../patch/PatchEngine.js';
import { ValidationEngine } from '../../validation/ValidationEngine.js';
import { CodingTaskStatus } from './CodingTask.js';

/**
 * Configuration for the Coding Task Pipeline.
 */
export interface CodingTaskPipelineConfig {
  readonly fileSystem: IFileSystem;
  readonly aiProvider: IAIProvider;
  readonly sourceIndex?: ISourceIndex;
  readonly symbolStore?: ISymbolStore;
  readonly referenceEngine?: IReferenceEngine;
  readonly languageService?: LanguageService;
  readonly promptEngine?: PromptEngine;
  readonly diffEngine?: IDiffEngine;
  readonly patchEngine?: IPatchEngine;
  readonly validationEngine?: IValidationEngine;
  readonly maxContextFiles?: number;
  readonly maxTokensPerFile?: number;
}

/**
 * A single candidate file for context building.
 */
interface FileCandidate {
  readonly path: string;
  readonly score: number;
  readonly reason: 'path' | 'symbol' | 'reference';
}

/**
 * Coding Task Pipeline.
 *
 * Orchestrates the full coding execution flow:
 *
 * 1. Validate request
 * 2. Build context from request
 * 3. Select relevant files
 * 4. Read required files
 * 5. Invoke AI
 * 6. Interpret proposed change
 * 7. Generate diff
 * 8. Validate proposal
 * 9. Apply patch
 * 10. Validate result
 * 11. Return result
 */
export class CodingTaskPipeline {
  private readonly fileSystem: IFileSystem;
  private readonly aiProvider: IAIProvider;
  private readonly sourceIndex: ISourceIndex | undefined;
  private readonly symbolStore: ISymbolStore | undefined;
  private readonly referenceEngine: IReferenceEngine | undefined;
  private readonly languageService: LanguageService;
  private readonly promptEngine: PromptEngine;
  private readonly diffEngine: IDiffEngine;
  private readonly patchEngine: IPatchEngine;
  private readonly validationEngine: IValidationEngine;
  private readonly maxContextFiles: number;
  private readonly maxTokensPerFile: number;

  constructor(config: CodingTaskPipelineConfig) {
    this.fileSystem = config.fileSystem;
    this.aiProvider = config.aiProvider;
    this.sourceIndex = config.sourceIndex;
    this.symbolStore = config.symbolStore;
    this.referenceEngine = config.referenceEngine;
    this.languageService = config.languageService ?? new LanguageService();
    this.promptEngine = config.promptEngine ?? new PromptEngine();
    this.diffEngine = config.diffEngine ?? new DiffEngine();
    this.patchEngine = config.patchEngine ?? new PatchEngine();
    this.validationEngine = config.validationEngine ?? new ValidationEngine();
    this.maxContextFiles = config.maxContextFiles ?? 5;
    this.maxTokensPerFile = config.maxTokensPerFile ?? 4000;
  }

  /**
   * Executes a coding task end-to-end.
   */
  public async execute(request: CodingTaskRequest): Promise<CodingTaskResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // 1. Validate the request.
    if (!request || typeof request.prompt !== 'string' || request.prompt.trim().length === 0) {
      return {
        status: CodingTaskStatus.INVALID_REQUEST,
        request: request?.prompt ?? '',
        modifiedFiles: Object.freeze([]),
        proposedChanges: Object.freeze([]),
        diffs: Object.freeze(new Map()),
        validationResult: undefined,
        errors: Object.freeze(['Request prompt must be a non-empty string']),
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // 2. Build context and select relevant files.
      const candidates = this.buildContext(request);
      if (candidates.length === 0) {
        return {
          status: CodingTaskStatus.CONTEXT_ERROR,
          request: request.prompt,
          modifiedFiles: Object.freeze([]),
          proposedChanges: Object.freeze([]),
          diffs: Object.freeze(new Map()),
          validationResult: undefined,
          errors: Object.freeze(['No relevant files found for the request']),
          durationMs: Date.now() - startTime,
        };
      }

      // 3. Read file contents (truncated to maxTokensPerFile).
      const fileContents = new Map<string, string>();
      for (const candidate of candidates) {
        try {
          // Resolve path against project root if it is not already absolute
          const isAbsolute = candidate.path.startsWith('/') || /^[a-zA-Z]:\\/.test(candidate.path);
          const absolutePath = isAbsolute ? candidate.path : `${request.projectPath.replace(/\/$/, '')}/${candidate.path}`;
          const content = this.fileSystem.readFile(absolutePath);
          fileContents.set(candidate.path, this.truncateContent(content));
        } catch (error) {
          errors.push(`Failed to read file "${candidate.path}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (fileContents.size === 0) {
        return {
          status: CodingTaskStatus.TOOL_ERROR,
          request: request.prompt,
          modifiedFiles: Object.freeze([]),
          proposedChanges: Object.freeze([]),
          diffs: new Map(),
          validationResult: undefined,
          errors: Object.freeze(['Could not read any relevant files']),
          durationMs: Date.now() - startTime,
        };
      }

      // 4. Generate proposal via AI.
      const proposal = await this.generateProposal(request, candidates, fileContents);
      if (!proposal) {
        return {
          status: CodingTaskStatus.AI_ERROR,
          request: request.prompt,
          modifiedFiles: Object.freeze([]),
          proposedChanges: Object.freeze([]),
          diffs: new Map(),
          validationResult: undefined,
          errors: Object.freeze(['AI provider failed to generate a proposal']),
          durationMs: Date.now() - startTime,
        };
      }

      // 5. Compute diffs and validate proposals.
      const diffs = new Map<string, DiffResult>();
      const validatedChanges: ProposedFileChange[] = [];

      for (const change of proposal.changes) {
        const oldContent = fileContents.get(change.filePath);
        if (oldContent === undefined) {
          errors.push(`File "${change.filePath}" not found in context`);
          continue;
        }

        const diff = this.diffEngine.computeDiff(oldContent, change.newContent);
        diffs.set(change.filePath, diff);

        // Validate proposal syntax.
        const language = this.languageService.detectLanguage(change.filePath);
        const syntaxValidation = this.validationEngine.validateSyntax(change.newContent, language, change.filePath);
        if (!syntaxValidation.valid) {
          return {
            status: CodingTaskStatus.VALIDATION_FAILED,
            request: request.prompt,
            modifiedFiles: Object.freeze([change.filePath]),
            proposedChanges: Object.freeze([change]),
            diffs: Object.freeze(new Map(diffs)),
            validationResult: syntaxValidation,
            errors: Object.freeze(['Proposed change failed syntax validation', ...syntaxValidation.messages.map((m) => m.message)]),
            durationMs: Date.now() - startTime,
          };
        }

        validatedChanges.push(change);
      }

      if (validatedChanges.length === 0) {
        return {
          status: CodingTaskStatus.AI_ERROR,
          request: request.prompt,
          modifiedFiles: Object.freeze([]),
          proposedChanges: Object.freeze([]),
          diffs: Object.freeze(new Map(diffs)),
          validationResult: undefined,
          errors: Object.freeze(['AI proposal did not contain valid changes']),
          durationMs: Date.now() - startTime,
        };
      }

      // 6. Apply patches.
      const modifiedFiles: string[] = [];
      for (const change of validatedChanges) {
        const oldContent = fileContents.get(change.filePath);
        if (oldContent === undefined) {
          continue;
        }

        const diff = diffs.get(change.filePath)!;
        const patchResult = this.patchEngine.applyPatch(oldContent, diff);

        if (!patchResult.success) {
          return {
            status: CodingTaskStatus.PATCH_ERROR,
            request: request.prompt,
            modifiedFiles: Object.freeze(modifiedFiles),
            proposedChanges: Object.freeze(validatedChanges),
            diffs: Object.freeze(new Map(diffs)),
            validationResult: undefined,
            errors: Object.freeze(['Patch application failed', patchResult.error ?? 'Unknown patch error']),
            durationMs: Date.now() - startTime,
          };
        }

        if (patchResult.content !== undefined) {
          const isAbsolute = change.filePath.startsWith('/') || /^[a-zA-Z]:\\/.test(change.filePath);
          const absolutePath = isAbsolute ? change.filePath : `${request.projectPath.replace(/\/$/, '')}/${change.filePath}`;
          this.fileSystem.writeFile(absolutePath, patchResult.content);
          modifiedFiles.push(change.filePath);
        }
      }

      // 7. Final validation.
      let finalValidation: ValidationResult | undefined;
      try {
        finalValidation = await this.validationEngine.validateTypeScript(request.projectPath, this.fileSystem);
        if (!finalValidation.valid) {
          return {
            status: CodingTaskStatus.VALIDATION_FAILED,
            request: request.prompt,
            modifiedFiles: Object.freeze(modifiedFiles),
            proposedChanges: Object.freeze(validatedChanges),
            diffs: Object.freeze(new Map(diffs)),
            validationResult: finalValidation,
            errors: Object.freeze(['Final validation failed after applying changes', ...finalValidation.messages.map((m) => m.message)]),
            durationMs: Date.now() - startTime,
          };
        }
      } catch (error) {
        errors.push(`Final validation error: ${error instanceof Error ? error.message : String(error)}`);
      }

      return {
        status: CodingTaskStatus.SUCCESS,
        request: request.prompt,
        modifiedFiles: Object.freeze(modifiedFiles),
        proposedChanges: Object.freeze(validatedChanges),
        diffs: Object.freeze(new Map(diffs)),
        validationResult: finalValidation,
        errors: Object.freeze(errors),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: CodingTaskStatus.EXECUTION_FAILED,
        request: request.prompt,
        modifiedFiles: Object.freeze([]),
        proposedChanges: Object.freeze([]),
        diffs: new Map(),
        validationResult: undefined,
        errors: Object.freeze([error instanceof Error ? error.message : String(error)]),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Builds context from the request by selecting relevant files.
   */
  private buildContext(request: CodingTaskRequest): FileCandidate[] {
    const candidates: FileCandidate[] = [];
    const keywords = this.extractKeywords(request.prompt);

    // Use explicit targetFilePath if provided.
    if (request.targetFilePath && this.fileSystem.exists(request.targetFilePath)) {
      candidates.push({ path: request.targetFilePath, score: 100, reason: 'path' });
    }

    // Search by file path if explicitly mentioned in the prompt.
    const explicitPath = this.extractFilePath(request.prompt);
    if (explicitPath && this.fileSystem.exists(explicitPath)) {
      candidates.push({ path: explicitPath, score: 100, reason: 'path' });
    }

    // Search SourceIndex for matching paths.
    if (this.sourceIndex) {
      try {
        const allFiles = this.sourceIndex.getAllFiles();
        for (const entry of allFiles) {
          const score = this.scorePathMatch(entry.path, keywords);
          if (score > 0) {
            candidates.push({ path: entry.path, score, reason: 'path' });
          }
        }
      } catch {
        // SourceIndex not built or empty.
      }
    }

    // Search SymbolStore for matching symbols (case-insensitive).
    if (this.symbolStore) {
      for (const keyword of keywords) {
        const symbols = this.symbolStore.getSymbolsByName(keyword);
        for (const symbol of symbols) {
          candidates.push({ path: symbol.filePath, score: 50, reason: 'symbol' });
        }
        // Also try the original-case keyword for camelCase symbol names.
        const originalCase = this.findOriginalCaseKeyword(request.prompt, keyword);
        if (originalCase && originalCase !== keyword) {
          const originalSymbols = this.symbolStore.getSymbolsByName(originalCase);
          for (const symbol of originalSymbols) {
            candidates.push({ path: symbol.filePath, score: 50, reason: 'symbol' });
          }
        }
      }
    }

    // Search ReferenceEngine for related files.
    if (this.referenceEngine) {
      const referenceMap = this.referenceEngine.buildReferenceMap([], new Map());
      for (const keyword of keywords) {
        const refs = this.referenceEngine.findReferencesToSymbol(referenceMap, keyword);
        for (const ref of refs) {
          candidates.push({ path: ref.filePath, score: 30, reason: 'reference' });
        }
      }
    }

    // Deduplicate and rank.
    const seen = new Set<string>();
    const ranked: FileCandidate[] = [];
    for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
      if (!seen.has(candidate.path)) {
        seen.add(candidate.path);
        ranked.push(candidate);
      }
    }

    return ranked.slice(0, this.maxContextFiles);
  }

  /**
   * Generates a proposal from the AI provider.
   */
  private async generateProposal(
    request: CodingTaskRequest,
    context: FileCandidate[],
    fileContents: Map<string, string>,
  ): Promise<{ changes: ProposedFileChange[] } | null> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request, context, fileContents);

    const messages: AIMessage[] = [
      { role: MessageRole.SYSTEM, content: systemPrompt },
      { role: MessageRole.USER, content: userPrompt },
    ];

    try {
      const response = await this.aiProvider.complete(messages);
      return this.parseProposal(response.content, fileContents);
    } catch {
      return null;
    }
  }

  /**
   * Builds the system prompt for the AI.
   */
  private buildSystemPrompt(): string {
    return `You are a coding assistant. Given a request and the current contents of relevant files, propose changes by returning the COMPLETE updated content for each file that needs to change.

IMPORTANT RULES:
1. Return ONLY the complete updated file content for files that need changes.
2. Wrap each file's content in a marker block like this:
   FILE: <relative/path/to/file>
   \`\`\`<language>
   <complete updated file content here>
   \`\`\`
3. If multiple files need changes, include all of them in the same response.
4. If no changes are needed, return "NO_CHANGES_NEEDED".
5. Do NOT include explanations, comments, or markdown outside the FILE blocks.
6. Preserve the existing code style and structure unless the request explicitly asks for changes.
7. Only modify what is necessary to fulfill the request.`;
  }

  /**
   * Builds the user prompt with request and file contents.
   */
  private buildUserPrompt(request: CodingTaskRequest, context: FileCandidate[], fileContents: Map<string, string>): string {
    const lines: string[] = [];

    lines.push(`REQUEST: ${request.prompt}`);
    lines.push('');

    if (context.length > 0) {
      lines.push('RELEVANT FILES:');
      for (const candidate of context) {
        lines.push(`- ${candidate.path} (relevance: ${candidate.reason})`);
      }
      lines.push('');
    }

    if (fileContents.size > 0) {
      lines.push('CURRENT FILE CONTENTS:');
      for (const [path, content] of fileContents) {
        lines.push('');
        lines.push(`FILE: ${path}`);
        lines.push('```');
        lines.push(content);
        lines.push('```');
      }
      lines.push('');
    }

    lines.push('Please provide the updated file contents according to the system prompt rules.');

    return lines.join('\n');
  }

  /**
   * Parses the AI response into proposed changes.
   */
  private parseProposal(
    content: string,
    originalContents: Map<string, string>,
  ): { changes: ProposedFileChange[] } | null {
    if (content.trim() === 'NO_CHANGES_NEEDED') {
      return { changes: [] };
    }

    const changes: ProposedFileChange[] = [];
    const fileRegex = /FILE:\s*(.+?)\n```[\w]*\n([\s\S]*?)```/g;

    let match: RegExpExecArray | null;
    while ((match = fileRegex.exec(content)) !== null) {
      const filePath = match[1].trim();
      const newContent = match[2].trim();

      if (originalContents.has(filePath)) {
        changes.push({
          filePath,
          newContent,
        });
      }
    }

    return changes.length > 0 ? { changes } : null;
  }

  /**
   * Truncates file content to the configured token limit.
   */
  private truncateContent(content: string): string {
    if (content.length <= this.maxTokensPerFile) {
      return content;
    }
    return content.slice(0, this.maxTokensPerFile);
  }

  /**
   * Extracts keywords from a prompt.
   */
  private extractKeywords(prompt: string): string[] {
    const words = prompt.toLowerCase().split(/\W+/);
    const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'as', 'by', 'at', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'add', 'create', 'new', 'function', 'أضف', 'دالة', 'ملف', 'إلى', 'من']);
    return words.filter((w) => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Finds the original-case version of a lowercase keyword in the prompt.
   */
  private findOriginalCaseKeyword(prompt: string, lowercaseKeyword: string): string | undefined {
    const regex = new RegExp(`\\b${lowercaseKeyword}\\b`, 'i');
    const match = prompt.match(regex);
    return match ? match[0] : undefined;
  }

  /**
   * Attempts to extract a file path from a prompt.
   */
  private extractFilePath(prompt: string): string | undefined {
    // Match a path with a preposition (e.g. "in src/app.ts").
    const prepositionRegex = /(?:to|in|into|at|for)\s+([A-Za-z_][A-Za-z0-9_.]*\.[A-Za-z]{1,4})/;
    const prepositionMatch = prompt.match(prepositionRegex);
    if (prepositionMatch) {
      return prepositionMatch[1];
    }

    // Fall back to matching any file path in the prompt (e.g. "fix src/app.ts").
    const pathRegex = /([A-Za-z_][A-Za-z0-9_/]*\.[A-Za-z]{1,4})/;
    const match = prompt.match(pathRegex);
    return match ? match[1] : undefined;
  }

  /**
   * Scores how well a file path matches keywords.
   */
  private scorePathMatch(filePath: string, keywords: string[]): number {
    const lower = filePath.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += 10;
      }
    }
    return score;
  }
}