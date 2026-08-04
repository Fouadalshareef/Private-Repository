import type { ISourceIndex } from './ISourceIndex.js';
import type { ProjectModel } from '../model/ProjectModel.js';
import type { SourceIndexEntry } from './SourceIndexEntry.js';
import type { SourceIndexResult } from './SourceIndexResult.js';
import type { SourceIndexOptions } from './SourceIndexOptions.js';
import type { ProjectNode } from '../model/ProjectNode.js';
import { ProjectFileNode } from '../model/ProjectFileNode.js';
import { ProjectNodeType } from '../model/ProjectNodeType.js';
import {
  SourceIndexNotBuiltError,
  SourceFileNotFoundError,
} from './SourceIndexError.js';

/**
 * An in-memory source index built from a {@link ProjectModel}.
 *
 * The index does NOT parse source code — it indexes files and their
 * structural metadata only. Symbols are placeholders reserved for
 * future parsing.
 */
export class SourceIndex implements ISourceIndex {
  private entries: Map<string, SourceIndexEntry> | undefined;

  /**
   * Builds the index from a project model.
   *
   * @param model The project model to index.
   * @param options Optional index options.
   * @returns The result of the build.
   * @throws {SourceIndexError} If the model is invalid.
   */
  public build(model: ProjectModel, options?: SourceIndexOptions): SourceIndexResult {
    const includeExtensionless = options?.includeExtensionless ?? true;
    const entries = new Map<string, SourceIndexEntry>();
    const builtAt = Date.now();

    model.tree.walk((node: ProjectNode) => {
      if (node.type !== ProjectNodeType.FILE) {
        return;
      }
      const fileNode = node as ProjectFileNode;
      if (!includeExtensionless && fileNode.extension === '') {
        return;
      }
      entries.set(fileNode.path, {
        path: fileNode.path,
        name: fileNode.name,
        extension: fileNode.extension,
        size: fileNode.size,
        parsed: false,
      });
    });

    this.entries = entries;

    return {
      indexedFiles: entries.size,
      builtAt,
      entries,
    };
  }

  /**
   * Returns the index entry for the given file path.
   *
   * @param path The path of the file.
   * @returns The index entry.
   * @throws {SourceIndexError} If the index has not been built or the
   * file is not found.
   */
  public getFile(path: string): SourceIndexEntry {
    this.assertBuilt();
    const entry = this.entries!.get(path);
    if (!entry) {
      throw new SourceFileNotFoundError(path);
    }
    return { ...entry };
  }

  /**
   * Returns all index entries.
   *
   * @returns An array of all index entries.
   * @throws {SourceIndexError} If the index has not been built.
   */
  public getAllFiles(): readonly SourceIndexEntry[] {
    this.assertBuilt();
    return Array.from(this.entries!.values()).map((entry) => ({ ...entry }));
  }

  /**
   * Returns all index entries matching the given extension.
   *
   * @param extension The extension to match (including leading dot).
   * @returns An array of matching entries.
   * @throws {SourceIndexError} If the index has not been built.
   */
  public findFilesByExtension(extension: string): readonly SourceIndexEntry[] {
    this.assertBuilt();
    return Array.from(this.entries!.values())
      .filter((entry) => entry.extension === extension)
      .map((entry) => ({ ...entry }));
  }

  /**
   * Returns whether the index contains an entry for the given path.
   *
   * @param path The path to check.
   * @returns `true` if the index contains the entry, `false` otherwise.
   */
  public contains(path: string): boolean {
    if (!this.entries) {
      return false;
    }
    return this.entries.has(path);
  }

  /**
   * Returns the number of indexed files.
   *
   * @returns The number of indexed files.
   * @throws {SourceIndexError} If the index has not been built.
   */
  public size(): number {
    this.assertBuilt();
    return this.entries!.size;
  }

  /**
   * Clears the index.
   */
  public clear(): void {
    this.entries = undefined;
  }

  /**
   * Throws if the index has not been built.
   */
  private assertBuilt(): void {
    if (!this.entries) {
      throw new SourceIndexNotBuiltError('Source index has not been built yet.');
    }
  }
}