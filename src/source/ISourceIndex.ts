import type { ProjectModel } from '../model/ProjectModel.js';
import type { SourceIndexEntry } from './SourceIndexEntry.js';
import type { SourceIndexResult } from './SourceIndexResult.js';
import type { SourceIndexOptions } from './SourceIndexOptions.js';
import type { LanguageType } from '../language/LanguageType.js';

/**
 * Contract for the Source Index.
 *
 * The Source Index builds an in-memory lookup index over the
 * {@link ProjectModel}. It does NOT parse source code — it indexes
 * files and their structural metadata only.
 */
export interface ISourceIndex {
  /**
   * Builds the index from a project model.
   *
   * @param model The project model to index.
   * @param options Optional index options.
   * @returns The result of the build.
   * @throws {SourceIndexError} If the model is invalid.
   */
  build(model: ProjectModel, options?: SourceIndexOptions): SourceIndexResult;

  /**
   * Returns the index entry for the given file path.
   *
   * @param path The path of the file.
   * @returns The index entry.
   * @throws {SourceIndexError} If the index has not been built or the
   * file is not found.
   */
  getFile(path: string): SourceIndexEntry;

  /**
   * Returns the index entry for the given source id.
   *
   * @param id The stable source id.
   * @returns The index entry.
   * @throws {SourceIndexError} If the index has not been built or the
   * source is not found.
   */
  getById(id: string): SourceIndexEntry;

  /**
   * Returns all index entries.
   *
   * @returns An array of all index entries.
   * @throws {SourceIndexError} If the index has not been built.
   */
  getAllFiles(): readonly SourceIndexEntry[];

  /**
   * Returns all index entries matching the given extension.
   *
   * @param extension The extension to match (including leading dot).
   * @returns An array of matching entries.
   * @throws {SourceIndexError} If the index has not been built.
   */
  findFilesByExtension(extension: string): readonly SourceIndexEntry[];

  /**
   * Returns all index entries matching the given language hint.
   *
   * @param language The language type to match.
   * @returns An array of matching entries.
   * @throws {SourceIndexError} If the index has not been built.
   */
  findByLanguage(language: LanguageType): readonly SourceIndexEntry[];

  /**
   * Returns whether the index contains an entry for the given path.
   *
   * @param path The path to check.
   * @returns `true` if the index contains the entry, `false` otherwise.
   */
  contains(path: string): boolean;

  /**
   * Returns the number of indexed files.
   *
   * @returns The number of indexed files.
   * @throws {SourceIndexError} If the index has not been built.
   */
  size(): number;

  /**
   * Clears the index.
   */
  clear(): void;
}
