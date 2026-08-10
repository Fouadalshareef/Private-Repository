import type { LanguageType } from '../language/LanguageType.js';

/**
 * An entry in the source index representing a single source file.
 *
 * This entry is a placeholder index record — it describes the file
 * without parsing its contents. Identity is stable and deterministic:
 * it is derived from the owning project and the file's project-relative
 * path, so the same `projectId + relativePath` always yields the same
 * source id regardless of traversal or execution order.
 */
export interface SourceIndexEntry {
  /** The stable, deterministic identifier of the source file. */
  readonly id: string;

  /** The identifier of the project this source file belongs to. */
  readonly projectId: string;

  /** The path of the source file relative to the project root. */
  readonly path: string;

  /** The path of the source file relative to the project root. */
  readonly relativePath: string;

  /** The name of the source file. */
  readonly name: string;

  /** The extension of the source file (including leading dot). */
  readonly extension: string;

  /** The detected language hint for the source file. */
  readonly languageHint: LanguageType;

  /** The size of the file in bytes. */
  readonly size: number;

  /** The timestamp when the file was created. */
  readonly createdAt: number;

  /** The timestamp when the file was last modified. */
  readonly modifiedAt: number;

  /** Whether the file has been parsed (always `false` until parsing is implemented). */
  readonly parsed: boolean;
}
