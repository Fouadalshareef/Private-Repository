import type { IFileSystem } from '../../filesystem/IFileSystem.js';
import { FileNotFoundError, FileSystemOperationError } from '../../filesystem/FileSystemError.js';

/**
 * Rejects paths that contain traversal segments (`..`) to prevent
 * escaping the intended workspace root.
 */
export function assertNoPathTraversal(path: string): void {
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new FileSystemOperationError(`Path traversal is not allowed: "${path}"`);
    }
  }
}

/**
 * Reads the content of a file via {@link IFileSystem}.
 */
export class ReadFileTool {
  readonly name = 'fs.read_file';
  readonly description = 'Reads the complete contents of a file at the given path.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'Absolute or relative path to the file to read.',
      },
    },
    required: ['path'] as readonly string[],
  } as const;

  constructor(private readonly fileSystem: IFileSystem) {}

  handler(args: Record<string, unknown>): string {
    const path = String(args.path ?? '');
    assertNoPathTraversal(path);

    if (!this.fileSystem.exists(path)) {
      throw new FileNotFoundError(path);
    }

    return this.fileSystem.readFile(path);
  }
}

/**
 * Writes content to a file, creating it if it does not exist.
 */
export class WriteFileTool {
  readonly name = 'fs.write_file';
  readonly description = 'Writes text content to a file, creating or overwriting it.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'Absolute or relative path of the file to write.',
      },
      content: {
        type: 'string' as const,
        description: 'Text content to write to the file.',
      },
    },
    required: ['path', 'content'] as readonly string[],
  } as const;

  constructor(private readonly fileSystem: IFileSystem) {}

  handler(args: Record<string, unknown>): string {
    const path = String(args.path ?? '');
    const content = String(args.content ?? '');
    assertNoPathTraversal(path);

    this.fileSystem.writeFile(path, content);
    return `Successfully wrote ${content.length} bytes to "${path}".`;
  }
}

/**
 * Deletes a file at the given path.
 */
export class DeleteFileTool {
  readonly name = 'fs.delete_file';
  readonly description = 'Deletes a file at the given path.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'Absolute or relative path to the file to delete.',
      },
    },
    required: ['path'] as readonly string[],
  } as const;

  constructor(private readonly fileSystem: IFileSystem) {}

  handler(args: Record<string, unknown>): string {
    const path = String(args.path ?? '');
    assertNoPathTraversal(path);

    if (!this.fileSystem.exists(path)) {
      throw new FileNotFoundError(path);
    }

    this.fileSystem.delete(path);
    return `Successfully deleted file "${path}".`;
  }
}

/**
 * Lists the immediate children of a directory.
 */
export class ListDirectoryTool {
  readonly name = 'fs.list_directory';
  readonly description = 'Lists files and directories within a given directory path.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'Absolute or relative path to the directory to list.',
      },
    },
    required: ['path'] as readonly string[],
  } as const;

  constructor(private readonly fileSystem: IFileSystem) {}

  handler(args: Record<string, unknown>): string {
    const path = String(args.path ?? '');
    assertNoPathTraversal(path);

    if (!this.fileSystem.exists(path)) {
      throw new FileNotFoundError(path);
    }

    const entries = this.fileSystem.list(path);
    if (entries.length === 0) {
      return `Directory "${path}" is empty.`;
    }

    const lines = entries.map((entry) => {
      const suffix = entry.isDirectory ? '/' : '';
      return `  ${entry.name}${suffix}`;
    });
    return `Contents of "${path}":\n${lines.join('\n')}`;
  }
}
