import type { IFileSystem } from './IFileSystem.js';
import type { FileInfo } from './FileInfo.js';
import type { DirectoryInfo } from './DirectoryInfo.js';
import type { FileSystemOptions } from './FileSystemOptions.js';
import {
  FileNotFoundError,
  FileAlreadyExistsError,
  FileSystemOperationError,
} from './FileSystemError.js';
import { normalize, dirname, basename } from './PathUtils.js';

/** The root directory path. */
const ROOT_PATH = '/';

/**
 * Internal representation of a virtual file.
 */
interface VirtualFile {
  readonly name: string;
  readonly path: string;
  content: string;
  readonly createdAt: number;
  modifiedAt: number;
}

/**
 * Internal representation of a virtual directory.
 */
interface VirtualDirectory {
  readonly name: string;
  readonly path: string;
  readonly createdAt: number;
  modifiedAt: number;
}

/**
 * A fully in-memory implementation of the {@link IFileSystem} contract.
 *
 * Simulates a file system using in-memory collections. No Node.js `fs`
 * module is used — no reading from or writing to disk. All operations
 * are synchronous.
 */
export class VirtualFileSystem implements IFileSystem {
  private readonly options: FileSystemOptions;
  private readonly files: Map<string, VirtualFile>;
  private readonly directories: Map<string, VirtualDirectory>;

  /**
   * Creates a new virtual file system.
   * @param options Optional file system configuration.
   */
  constructor(options?: FileSystemOptions) {
    this.options = options ?? {};
    this.files = new Map<string, VirtualFile>();
    this.directories = new Map<string, VirtualDirectory>();

    // The root directory always exists.
    this.directories.set(ROOT_PATH, {
      name: '',
      path: ROOT_PATH,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    });
  }

  /**
   * Returns whether a file or directory exists at the given path.
   *
   * @param path The path to check.
   * @returns `true` if the path exists, `false` otherwise.
   */
  public exists(path: string): boolean {
    const normalized = normalize(path);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  /**
   * Reads the content of a file.
   *
   * @param path The path of the file to read.
   * @returns The content of the file.
   * @throws {FileSystemError} If the file does not exist or the path
   * points to a directory.
   */
  public readFile(path: string): string {
    const normalized = normalize(path);
    const file = this.files.get(normalized);
    if (!file) {
      if (this.directories.has(normalized)) {
        throw new FileSystemOperationError(
          `Cannot read file: "${normalized}" is a directory.`,
        );
      }
      throw new FileNotFoundError(normalized);
    }
    return file.content;
  }

  /**
   * Writes content to a file, creating it if it does not exist.
   *
   * @param path The path of the file to write.
   * @param content The content to write.
   * @throws {FileSystemError} If the path points to a directory or the
   * parent directory does not exist.
   */
  public writeFile(path: string, content: string): void {
    this.assertWritable();
    const normalized = normalize(path);
    if (normalized === ROOT_PATH) {
      throw new FileSystemOperationError('Cannot write to the root directory.');
    }
    if (this.directories.has(normalized)) {
      throw new FileSystemOperationError(
        `Cannot write file: "${normalized}" is a directory.`,
      );
    }

    const parent = dirname(normalized);
    if (!this.directories.has(parent)) {
      throw new FileNotFoundError(`Parent directory not found: "${parent}"`);
    }

    const now = Date.now();
    const existing = this.files.get(normalized);
    if (existing) {
      existing.content = content;
      existing.modifiedAt = now;
    } else {
      this.files.set(normalized, {
        name: basename(normalized),
        path: normalized,
        content,
        createdAt: now,
        modifiedAt: now,
      });
    }
  }

  /**
   * Deletes a file.
   *
   * @param path The path of the file to delete.
   * @throws {FileSystemError} If the file does not exist or the path
   * points to a directory.
   */
  public delete(path: string): void {
    this.assertWritable();
    const normalized = normalize(path);
    if (this.directories.has(normalized)) {
      throw new FileSystemOperationError(
        `Cannot delete file: "${normalized}" is a directory. Use deleteDirectory instead.`,
      );
    }
    if (!this.files.has(normalized)) {
      throw new FileNotFoundError(normalized);
    }
    this.files.delete(normalized);
  }

  /**
   * Moves a file or directory from source to destination.
   *
   * @param source The current path.
   * @param destination The new path.
   * @throws {FileSystemError} If the source does not exist or the
   * destination already exists.
   */
  public move(source: string, destination: string): void {
    this.assertWritable();
    const sourcePath = normalize(source);
    const destinationPath = normalize(destination);

    if (sourcePath === destinationPath) {
      throw new FileSystemOperationError(
        `Cannot move: source and destination are the same ("${sourcePath}").`,
      );
    }
    if (!this.exists(sourcePath)) {
      throw new FileNotFoundError(sourcePath);
    }
    if (this.exists(destinationPath)) {
      throw new FileAlreadyExistsError(destinationPath);
    }

    const parent = dirname(destinationPath);
    if (!this.directories.has(parent)) {
      throw new FileNotFoundError(`Parent directory not found: "${parent}"`);
    }

    if (this.files.has(sourcePath)) {
      const file = this.files.get(sourcePath);
      if (!file) {
        throw new FileNotFoundError(sourcePath);
      }
      this.files.delete(sourcePath);
      this.files.set(destinationPath, {
        ...file,
        path: destinationPath,
        name: basename(destinationPath),
        modifiedAt: Date.now(),
      });
      return;
    }

    // Moving a directory: move the directory and all its descendants.
    const directory = this.directories.get(sourcePath);
    if (!directory) {
      throw new FileNotFoundError(sourcePath);
    }

    this.directories.delete(sourcePath);
    this.directories.set(destinationPath, {
      ...directory,
      path: destinationPath,
      name: basename(destinationPath),
      modifiedAt: Date.now(),
    });

    // Move all files and directories that are descendants of source.
    const prefix = sourcePath === ROOT_PATH ? ROOT_PATH : sourcePath + '/';
    const newPrefix = destinationPath === ROOT_PATH ? ROOT_PATH : destinationPath + '/';

    for (const [filePath, file] of Array.from(this.files.entries())) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.substring(prefix.length);
        this.files.delete(filePath);
        this.files.set(newPrefix + relative, {
          ...file,
          path: newPrefix + relative,
        });
      }
    }

    for (const [dirPath, dir] of Array.from(this.directories.entries())) {
      if (dirPath.startsWith(prefix)) {
        const relative = dirPath.substring(prefix.length);
        this.directories.delete(dirPath);
        this.directories.set(newPrefix + relative, {
          ...dir,
          path: newPrefix + relative,
        });
      }
    }
  }

  /**
   * Copies a file or directory from source to destination.
   *
   * @param source The path to copy from.
   * @param destination The path to copy to.
   * @throws {FileSystemError} If the source does not exist or the
   * destination already exists.
   */
  public copy(source: string, destination: string): void {
    this.assertWritable();
    const sourcePath = normalize(source);
    const destinationPath = normalize(destination);

    if (sourcePath === destinationPath) {
      throw new FileSystemOperationError(
        `Cannot copy: source and destination are the same ("${sourcePath}").`,
      );
    }
    if (!this.exists(sourcePath)) {
      throw new FileNotFoundError(sourcePath);
    }
    if (this.exists(destinationPath)) {
      throw new FileAlreadyExistsError(destinationPath);
    }

    const parent = dirname(destinationPath);
    if (!this.directories.has(parent)) {
      throw new FileNotFoundError(`Parent directory not found: "${parent}"`);
    }

    if (this.files.has(sourcePath)) {
      const file = this.files.get(sourcePath);
      if (!file) {
        throw new FileNotFoundError(sourcePath);
      }
      const now = Date.now();
      this.files.set(destinationPath, {
        name: basename(destinationPath),
        path: destinationPath,
        content: file.content,
        createdAt: now,
        modifiedAt: now,
      });
      return;
    }

    // Copying a directory: copy the directory and all its descendants.
    const directory = this.directories.get(sourcePath);
    if (!directory) {
      throw new FileNotFoundError(sourcePath);
    }

    const now = Date.now();
    this.directories.set(destinationPath, {
      name: basename(destinationPath),
      path: destinationPath,
      createdAt: now,
      modifiedAt: now,
    });

    const prefix = sourcePath === ROOT_PATH ? ROOT_PATH : sourcePath + '/';
    const newPrefix = destinationPath === ROOT_PATH ? ROOT_PATH : destinationPath + '/';

    for (const [filePath, file] of this.files.entries()) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.substring(prefix.length);
        this.files.set(newPrefix + relative, {
          name: file.name,
          path: newPrefix + relative,
          content: file.content,
          createdAt: now,
          modifiedAt: now,
        });
      }
    }

    for (const [dirPath, dir] of this.directories.entries()) {
      if (dirPath.startsWith(prefix)) {
        const relative = dirPath.substring(prefix.length);
        this.directories.set(newPrefix + relative, {
          name: dir.name,
          path: newPrefix + relative,
          createdAt: now,
          modifiedAt: now,
        });
      }
    }
  }

  /**
   * Creates a directory at the given path.
   *
   * @param path The path of the directory to create.
   * @throws {FileSystemError} If the directory already exists or the
   * parent directory does not exist.
   */
  public createDirectory(path: string): void {
    this.assertWritable();
    const normalized = normalize(path);
    if (normalized === ROOT_PATH) {
      throw new FileAlreadyExistsError(ROOT_PATH);
    }
    if (this.exists(normalized)) {
      throw new FileAlreadyExistsError(normalized);
    }

    const parent = dirname(normalized);
    if (!this.directories.has(parent)) {
      throw new FileNotFoundError(`Parent directory not found: "${parent}"`);
    }

    const now = Date.now();
    this.directories.set(normalized, {
      name: basename(normalized),
      path: normalized,
      createdAt: now,
      modifiedAt: now,
    });
  }

  /**
   * Deletes a directory and all of its contents.
   *
   * @param path The path of the directory to delete.
   * @throws {FileSystemError} If the directory does not exist or the
   * path points to a file.
   */
  public deleteDirectory(path: string): void {
    this.assertWritable();
    const normalized = normalize(path);
    if (normalized === ROOT_PATH) {
      throw new FileSystemOperationError('Cannot delete the root directory.');
    }
    if (this.files.has(normalized)) {
      throw new FileSystemOperationError(
        `Cannot delete directory: "${normalized}" is a file. Use delete instead.`,
      );
    }
    if (!this.directories.has(normalized)) {
      throw new FileNotFoundError(normalized);
    }

    const prefix = normalized + '/';
    for (const filePath of Array.from(this.files.keys())) {
      if (filePath.startsWith(prefix)) {
        this.files.delete(filePath);
      }
    }
    for (const dirPath of Array.from(this.directories.keys())) {
      if (dirPath.startsWith(prefix)) {
        this.directories.delete(dirPath);
      }
    }
    this.directories.delete(normalized);
  }

  /**
   * Lists the immediate children of a directory.
   *
   * @param path The path of the directory to list.
   * @returns An array of file and directory info entries.
   * @throws {FileSystemError} If the directory does not exist or the
   * path points to a file.
   */
  public list(path: string): Array<FileInfo | DirectoryInfo> {
    const normalized = normalize(path);
    if (this.files.has(normalized)) {
      throw new FileSystemOperationError(
        `Cannot list: "${normalized}" is a file, not a directory.`,
      );
    }
    if (!this.directories.has(normalized)) {
      throw new FileNotFoundError(normalized);
    }

    const prefix = normalized === ROOT_PATH ? ROOT_PATH : normalized + '/';
    const result: Array<FileInfo | DirectoryInfo> = [];

    for (const file of this.files.values()) {
      if (file.path.startsWith(prefix) && dirname(file.path) === normalized) {
        result.push(this.toFileInfo(file));
      }
    }

    for (const dir of this.directories.values()) {
      if (dir.path !== ROOT_PATH && dir.path.startsWith(prefix) && dirname(dir.path) === normalized) {
        result.push(this.toDirectoryInfo(dir));
      }
    }

    return result;
  }

  /**
   * Returns metadata for a file or directory.
   *
   * @param path The path to stat.
   * @returns The file or directory info.
   * @throws {FileSystemError} If the path does not exist.
   */
  public stat(path: string): FileInfo | DirectoryInfo {
    const normalized = normalize(path);
    const file = this.files.get(normalized);
    if (file) {
      return this.toFileInfo(file);
    }
    const dir = this.directories.get(normalized);
    if (dir) {
      return this.toDirectoryInfo(dir);
    }
    throw new FileNotFoundError(normalized);
  }

  /**
   * Returns a copy of the file system options.
   *
   * @returns The file system options.
   */
  public getOptions(): FileSystemOptions {
    return { ...this.options };
  }

  /**
   * Converts an internal virtual file to a public {@link FileInfo}.
   */
  private toFileInfo(file: VirtualFile): FileInfo {
    return {
      name: file.name,
      path: file.path,
      size: file.content.length,
      createdAt: file.createdAt,
      modifiedAt: file.modifiedAt,
      isDirectory: false,
    };
  }

  /**
   * Converts an internal virtual directory to a public {@link DirectoryInfo}.
   */
  private toDirectoryInfo(dir: VirtualDirectory): DirectoryInfo {
    const prefix = dir.path === ROOT_PATH ? ROOT_PATH : dir.path + '/';
    let size = 0;
    for (const file of this.files.values()) {
      if (file.path.startsWith(prefix)) {
        size += file.content.length;
      }
    }
    return {
      name: dir.name,
      path: dir.path,
      size,
      createdAt: dir.createdAt,
      modifiedAt: dir.modifiedAt,
      isDirectory: true,
    };
  }

  /**
   * Throws if the file system is read-only.
   */
  private assertWritable(): void {
    if (this.options.readOnly) {
      throw new FileSystemOperationError('File system is read-only.');
    }
  }
}