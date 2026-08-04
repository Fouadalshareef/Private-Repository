import type { FileInfo } from './FileInfo.js';
import type { DirectoryInfo } from './DirectoryInfo.js';

/**
 * Contract for the File System Abstraction Layer (FSAL).
 *
 * All future file operations in the project must go through this
 * interface. No direct use of Node.js `fs` APIs is allowed elsewhere.
 *
 * This version is synchronous and in-memory only.
 */
export interface IFileSystem {
  /**
   * Returns whether a file or directory exists at the given path.
   *
   * @param path The path to check.
   * @returns `true` if the path exists, `false` otherwise.
   */
  exists(path: string): boolean;

  /**
   * Reads the content of a file.
   *
   * @param path The path of the file to read.
   * @returns The content of the file.
   * @throws {FileSystemError} If the file does not exist or the path
   * points to a directory.
   */
  readFile(path: string): string;

  /**
   * Writes content to a file, creating it if it does not exist.
   *
   * @param path The path of the file to write.
   * @param content The content to write.
   * @throws {FileSystemError} If the path points to a directory or the
   * parent directory does not exist.
   */
  writeFile(path: string, content: string): void;

  /**
   * Deletes a file.
   *
   * @param path The path of the file to delete.
   * @throws {FileSystemError} If the file does not exist or the path
   * points to a directory.
   */
  delete(path: string): void;

  /**
   * Moves a file or directory from source to destination.
   *
   * @param source The current path.
   * @param destination The new path.
   * @throws {FileSystemError} If the source does not exist or the
   * destination already exists.
   */
  move(source: string, destination: string): void;

  /**
   * Copies a file or directory from source to destination.
   *
   * @param source The path to copy from.
   * @param destination The path to copy to.
   * @throws {FileSystemError} If the source does not exist or the
   * destination already exists.
   */
  copy(source: string, destination: string): void;

  /**
   * Creates a directory at the given path.
   *
   * @param path The path of the directory to create.
   * @throws {FileSystemError} If the directory already exists or the
   * parent directory does not exist.
   */
  createDirectory(path: string): void;

  /**
   * Deletes a directory and all of its contents.
   *
   * @param path The path of the directory to delete.
   * @throws {FileSystemError} If the directory does not exist or the
   * path points to a file.
   */
  deleteDirectory(path: string): void;

  /**
   * Lists the immediate children of a directory.
   *
   * @param path The path of the directory to list.
   * @returns An array of file and directory info entries.
   * @throws {FileSystemError} If the directory does not exist or the
   * path points to a file.
   */
  list(path: string): Array<FileInfo | DirectoryInfo>;

  /**
   * Returns metadata for a file or directory.
   *
   * @param path The path to stat.
   * @returns The file or directory info.
   * @throws {FileSystemError} If the path does not exist.
   */
  stat(path: string): FileInfo | DirectoryInfo;
}