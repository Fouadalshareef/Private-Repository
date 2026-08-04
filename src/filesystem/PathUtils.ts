/**
 * Path manipulation utilities.
 *
 * Implemented manually — no dependency on the Node.js `path` module.
 * All paths use forward slashes (`/`) as the separator.
 */

/** The path separator used by the file system abstraction. */
export const PATH_SEPARATOR = '/';

/**
 * Normalizes a path by:
 * - Replacing backslashes with forward slashes.
 * - Collapsing duplicate separators.
 * - Resolving `.` segments.
 * - Removing trailing separators (except for the root).
 *
 * @param path The path to normalize.
 * @returns The normalized path.
 */
export function normalize(path: string): string {
  if (!path) {
    return '';
  }

  const isRoot = path === '/' || path === '\\';
  if (isRoot) {
    return PATH_SEPARATOR;
  }

  const withForwardSlashes = path.replace(/\\/g, PATH_SEPARATOR);
  const segments = withForwardSlashes.split(PATH_SEPARATOR);
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  const joined = resolved.join(PATH_SEPARATOR);
  const startsWithSeparator = withForwardSlashes.startsWith(PATH_SEPARATOR);

  if (startsWithSeparator) {
    return PATH_SEPARATOR + joined;
  }

  return joined;
}

/**
 * Joins multiple path segments into a single normalized path.
 *
 * @param segments The path segments to join.
 * @returns The joined and normalized path.
 */
export function join(...segments: string[]): string {
  const filtered = segments.filter((segment) => segment.length > 0);
  if (filtered.length === 0) {
    return '';
  }
  return normalize(filtered.join(PATH_SEPARATOR));
}

/**
 * Returns the directory portion of a path.
 *
 * @param path The path.
 * @returns The directory portion, or `''` if there is no directory.
 */
export function dirname(path: string): string {
  const normalized = normalize(path);
  if (normalized === '' || normalized === PATH_SEPARATOR) {
    return normalized;
  }

  const lastSeparatorIndex = normalized.lastIndexOf(PATH_SEPARATOR);
  if (lastSeparatorIndex === -1) {
    return '';
  }
  if (lastSeparatorIndex === 0) {
    return PATH_SEPARATOR;
  }

  return normalized.substring(0, lastSeparatorIndex);
}

/**
 * Returns the final segment of a path (the file or directory name).
 *
 * @param path The path.
 * @returns The basename, or `''` if the path is empty or the root.
 */
export function basename(path: string): string {
  const normalized = normalize(path);
  if (normalized === '' || normalized === PATH_SEPARATOR) {
    return '';
  }

  const lastSeparatorIndex = normalized.lastIndexOf(PATH_SEPARATOR);
  if (lastSeparatorIndex === -1) {
    return normalized;
  }

  return normalized.substring(lastSeparatorIndex + 1);
}

/**
 * Returns the extension of a file path, including the leading dot.
 * Returns `''` if the file has no extension.
 *
 * @param path The path.
 * @returns The extension (e.g., `.ts`), or `''`.
 */
export function extname(path: string): string {
  const name = basename(path);
  if (name === '') {
    return '';
  }

  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return '';
  }

  return name.substring(lastDotIndex);
}