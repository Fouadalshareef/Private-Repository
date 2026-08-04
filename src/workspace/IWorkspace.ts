import type { WorkspaceInfo } from './WorkspaceInfo.js';
import type { WorkspaceState } from './WorkspaceState.js';

/**
 * Contract for a workspace.
 *
 * The workspace represents the current software project being analyzed
 * or modified. This version is purely in-memory — no filesystem access
 * is performed. It is designed for future integration with the
 * Container, Bootstrap, Plugin System, and Event Bus.
 */
export interface IWorkspace {
  /**
   * Creates the workspace. The workspace starts in the `closed` state.
   *
   * @param id The unique identifier of the workspace.
   * @param name The display name of the workspace.
   * @param rootPath The root path of the workspace.
   * @throws {WorkspaceError} If the creation parameters are invalid or
   * the workspace has already been created.
   */
  create(id: string, name: string, rootPath: string): void;

  /**
   * Opens the workspace, transitioning it from `closed` to `open`.
   *
   * @throws {WorkspaceError} If the workspace is not created, is
   * already open, or is in a state that does not allow opening.
   */
  open(): void;

  /**
   * Closes the workspace, transitioning it from `open` to `closed`.
   *
   * @throws {WorkspaceError} If the workspace is not created or is
   * not open.
   */
  close(): void;

  /**
   * Returns whether the workspace is currently open.
   *
   * @returns `true` if the workspace is open, `false` otherwise.
   */
  isOpen(): boolean;

  /**
   * Returns the metadata of the workspace.
   *
   * @returns The workspace information.
   * @throws {WorkspaceError} If the workspace has not been created.
   */
  getInfo(): WorkspaceInfo;

  /**
   * Returns the root path of the workspace.
   *
   * @returns The root path.
   * @throws {WorkspaceError} If the workspace has not been created.
   */
  getRoot(): string;

  /**
   * Returns the current lifecycle state of the workspace.
   *
   * @returns The workspace state.
   */
  getState(): WorkspaceState;
}