import type { ISourceIndex } from './ISourceIndex.js';
import type { ProjectModel } from '../model/ProjectModel.js';
import type { SourceIndexEntry } from './SourceIndexEntry.js';
import type { SourceIndexResult } from './SourceIndexResult.js';
import type { SourceIndexOptions } from './SourceIndexOptions.js';
import type { ProjectNode } from '../model/ProjectNode.js';
import { ProjectFileNode } from '../model/ProjectFileNode.js';
import { ProjectNodeType } from '../model/ProjectNodeType.js';
import { LanguageType } from '../language/LanguageType.js';
import {
  SourceIndexNotBuiltError,
  SourceFileNotFoundError,
} from './SourceIndexError.js';

/**
 * A deterministic extension-to-language hint mapping used to derive a
 * basic language hint for each indexed file. This is a structural hint
 * only — it performs no content analysis.
 */
const EXTENSION_LANGUAGE_HINTS: Readonly<Record<string, LanguageType>> = {
  '.ts': LanguageType.TYPESCRIPT,
  '.tsx': LanguageType.TYPESCRIPT,
  '.js': LanguageType.JAVASCRIPT,
  '.jsx': LanguageType.JAVASCRIPT,
  '.mjs': LanguageType.JAVASCRIPT,
  '.cjs': LanguageType.JAVASCRIPT,
  '.py': LanguageType.PYTHON,
  '.html': LanguageType.HTML,
  '.htm': LanguageType.HTML,
  '.css': LanguageType.CSS,
  '.json': LanguageType.JSON,
};

/**
 * An in-memory source index built from a {@link ProjectModel}.
 *
 * The index does NOT parse source code — it indexes files and their
 * structural metadata only. Symbols are placeholders reserved for
 * future parsing.
 */
export class SourceIndex implements ISourceIndex {
  private entries: Map<string, SourceIndexEntry> | undefined;
  private byId: Map<string, string> | undefined;

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
    const byId = new Map<string, string>();
    const builtAt = Date.now();
    const projectId = model.info.projectId;

    model.tree.walk((node: ProjectNode) => {
      if (node.type !== ProjectNodeType.FILE) {
        return;
      }
      const fileNode = node as ProjectFileNode;
      if (!includeExtensionless && fileNode.extension === '') {
        return;
      }
      const entry: SourceIndexEntry = Object.freeze({
        id: fileNode.id,
        projectId,
        path: fileNode.path,
        relativePath: fileNode.path,
        name: fileNode.name,
        extension: fileNode.extension,
        languageHint: this.detectLanguageHint(fileNode.extension),
        size: fileNode.size,
        createdAt: fileNode.createdAt,
        modifiedAt: fileNode.modifiedAt,
        parsed: false,
      });
      entries.set(fileNode.path, entry);
      byId.set(entry.id, fileNode.path);
    });

    this.entries = entries;
    this.byId = byId;

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
   * Returns the index entry for the given source id.
   *
   * @param id The stable source id.
   * @returns The index entry.
   * @throws {SourceIndexError} If the index has not been built or the
   * source is not found.
   */
  public getById(id: string): SourceIndexEntry {
    this.assertBuilt();
    const path = this.byId!.get(id);
    if (path === undefined) {
      throw new SourceFileNotFoundError(id);
    }
    return { ...this.entries!.get(path)! };
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
   * Returns all index entries matching the given language hint.
   *
   * @param language The language type to match.
   * @returns An array of matching entries.
   * @throws {SourceIndexError} If the index has not been built.
   */
  public findByLanguage(language: LanguageType): readonly SourceIndexEntry[] {
    this.assertBuilt();
    return Array.from(this.entries!.values())
      .filter((entry) => entry.languageHint === language)
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
    this.byId = undefined;
  }

  /**
   * Derives a deterministic language hint from a file extension.
   */
  private detectLanguageHint(extension: string): LanguageType {
    return EXTENSION_LANGUAGE_HINTS[extension] ?? LanguageType.UNKNOWN;
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
