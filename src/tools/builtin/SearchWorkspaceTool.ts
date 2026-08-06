import type { IFileSystem } from '../../filesystem/IFileSystem.js';
import { FileNotFoundError } from '../../filesystem/FileSystemError.js';

export interface SearchWorkspaceOptions {
  readonly query: string;
  readonly path?: string;
  readonly caseSensitive?: boolean;
  readonly maxResults?: number;
}

/**
 * Searches for a text query across files in the workspace.
 */
export class SearchWorkspaceTool {
  readonly name = 'workspace.search';
  readonly description = 'Searches for a text query across files in the workspace.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description: 'The text pattern to search for.',
      },
      path: {
        type: 'string' as const,
        description: 'Optional root path to limit the search scope.',
      },
      caseSensitive: {
        type: 'boolean' as const,
        description: 'Whether the search should be case-sensitive. Defaults to false.',
      },
      maxResults: {
        type: 'integer' as const,
        description: 'Maximum number of results to return. Defaults to 50.',
      },
    },
    required: ['query'] as readonly string[],
  } as const;

  constructor(private readonly fileSystem: IFileSystem) {}

  handler(args: Record<string, unknown>): string {
    const options: SearchWorkspaceOptions = {
      query: String(args.query ?? ''),
      path: args.path !== undefined ? String(args.path) : undefined,
      caseSensitive: args.caseSensitive === true,
      maxResults: args.maxResults !== undefined ? Number(args.maxResults) : 50,
    };

    if (options.query.trim().length === 0) {
      return 'Search query must not be empty.';
    }

    const root = options.path ?? '/';
    if (!this.fileSystem.exists(root)) {
      throw new FileNotFoundError(root);
    }

    const results: string[] = [];
    const queue: string[] = [root];
    const query = options.caseSensitive ? options.query : options.query.toLowerCase();
    const maxResults = options.maxResults ?? 50;

    while (queue.length > 0 && results.length < maxResults) {
      const current = queue.shift()!;
      const info = this.fileSystem.stat(current);

      if (!info.isDirectory) {
        const content = this.fileSystem.readFile(current);
        const searchContent = options.caseSensitive ? content : content.toLowerCase();
        const matches = this.findMatches(searchContent, query, current);
        results.push(...matches);
        continue;
      }

      const entries = this.fileSystem.list(current);
      for (const entry of entries) {
        queue.push(entry.path);
      }
    }

    if (results.length === 0) {
      return `No matches found for "${options.query}".`;
    }

    const truncated = results.slice(0, maxResults);
    const header = `Found ${truncated.length} match(es) for "${options.query}":`;
    return `${header}\n${truncated.join('\n')}`;
  }

  private findMatches(content: string, query: string, filePath: string): string[] {
    const lines = content.split('\n');
    const matches: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(query)) {
        const lineNumber = i + 1;
        matches.push(`  ${filePath}:${lineNumber}: ${lines[i].trim()}`);
      }
    }

    return matches;
  }
}
