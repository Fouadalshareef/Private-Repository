import type { IWorkspace } from './IWorkspace.js';
import type { WorkspaceInfo } from './WorkspaceInfo.js';
import { WorkspaceState } from './WorkspaceState.js';
import type { WorkspaceOptions } from './WorkspaceOptions.js';
import {
  WorkspaceError,
  WorkspaceCreationError,
  WorkspaceOpenError,
  WorkspaceCloseError,
  WorkspaceStateError,
} from './WorkspaceError.js';

/** The current version of the workspace. */
export const WORKSPACE_VERSION = '1.0.0';

/**
 * Parameters required to create a workspace.
 */
export interface WorkspaceCreationParams {
  /** The unique identifier of the workspace. */
  readonly id: string;

  /** The display name of the workspace. */
  readonly name: string;

  /** The root path of the workspace. */
  readonly rootPath: string;
}

/**
 * An in-memory implementation of the {@link IWorkspace} contract.
 *
 * The workspace represents the current software project being analyzed
 * or modified. This version performs no filesystem access — it exists
 * purely in memory. It is designed for future integration with the
 * Container, Bootstrap, Plugin System, and Event Bus.
 */
export class Workspace implements IWorkspace {
  private readonly options: WorkspaceOptions;
  private state: WorkspaceState;
  private info: WorkspaceInfo | undefined;

  /**
   * Creates a new workspace instance.
   *
   * @param options Optional workspace configuration.
   * @param creationParams Optional creation parameters. Required when
   * `options.autoCreate` is `true`.
   * @throws {WorkspaceCreationError} If `autoCreate` is enabled but no
   * creation parameters are provided, or if the creation parameters
   * are invalid.
   */
  constructor(options?: WorkspaceOptions, creationParams?: WorkspaceCreationParams) {
    this.options = options ?? {};
    this.state = WorkspaceState.CLOSED;
    this.info = undefined;

    if (this.options.autoCreate) {
      if (!creationParams) {
        throw new WorkspaceCreationError(
          'autoCreate is enabled but no creation parameters were provided.',
        );
      }
      this.create(creationParams.id, creationParams.name, creationParams.rootPath);
    }
  }

  /**
   * Creates the workspace. The workspace starts in the `closed` state.
   *
   * @param id The unique identifier of the workspace.
   * @param name The display name of the workspace.
   * @param rootPath The root path of the workspace.
   * @throws {WorkspaceCreationError} If the creation parameters are
   * invalid or the workspace has already been created.
   */
  public create(id: string, name: string, rootPath: string): void {
    if (this.info) {
      throw new WorkspaceCreationError(
        `Workspace "${this.info.id}" has already been created.`,
      );
    }
    if (!id || id.trim().length === 0) {
      throw new WorkspaceCreationError('Workspace id must not be empty.');
    }
    if (!name || name.trim().length === 0) {
      throw new WorkspaceCreationError('Workspace name must not be empty.');
    }
    if (!rootPath || rootPath.trim().length === 0) {
      throw new WorkspaceCreationError('Workspace rootPath must not be empty.');
    }

    this.info = {
      id,
      name,
      rootPath,
      createdAt: Date.now(),
      openedAt: undefined,
      version: WORKSPACE_VERSION,
    };
    this.state = WorkspaceState.CLOSED;
  }

  /**
   * Opens the workspace, transitioning it from `closed` to `open`.
   *
   * @throws {WorkspaceOpenError} If the workspace is not created or is
   * already open.
   * @throws {WorkspaceStateError} If the workspace is in a state that
   * does not allow opening.
   */
  public open(): void {
    if (!this.info) {
      throw new WorkspaceOpenError('Workspace has not been created.');
    }
    if (this.state === WorkspaceState.OPEN) {
      throw new WorkspaceOpenError(`Workspace "${this.info.id}" is already open.`);
    }
    if (this.state !== WorkspaceState.CLOSED) {
      throw new WorkspaceStateError(
        `Workspace "${this.info.id}" cannot be opened from state "${this.state}".`,
      );
    }

    this.state = WorkspaceState.OPEN;
    this.info = { ...this.info, openedAt: Date.now() };
  }

  /**
   * Closes the workspace, transitioning it from `open` to `closed`.
   *
   * @throws {WorkspaceCloseError} If the workspace is not created or
   * is not open.
   */
  public close(): void {
    if (!this.info) {
      throw new WorkspaceCloseError('Workspace has not been created.');
    }
    if (this.state !== WorkspaceState.OPEN) {
      throw new WorkspaceCloseError(
        `Workspace "${this.info.id}" is not open (current state: "${this.state}").`,
      );
    }

    this.state = WorkspaceState.CLOSED;
  }

  /**
   * Returns whether the workspace is currently open.
   *
   * @returns `true` if the workspace is open, `false` otherwise.
   */
  public isOpen(): boolean {
    return this.state === WorkspaceState.OPEN;
  }

  /**
   * Returns the metadata of the workspace.
   *
   * @returns A copy of the workspace information.
   * @throws {WorkspaceError} If the workspace has not been created.
   */
  public getInfo(): WorkspaceInfo {
    if (!this.info) {
      throw new WorkspaceError('Workspace has not been created.');
    }
    return { ...this.info };
  }

  /**
   * Returns the root path of the workspace.
   *
   * @returns The root path.
   * @throws {WorkspaceError} If the workspace has not been created.
   */
  public getRoot(): string {
    if (!this.info) {
      throw new WorkspaceError('Workspace has not been created.');
    }
    return this.info.rootPath;
  }

  /**
   * Returns the current lifecycle state of the workspace.
   *
   * @returns The workspace state.
   */
  public getState(): WorkspaceState {
    return this.state;
  }

  /**
   * Returns a copy of the workspace options.
   *
   * @returns The workspace options.
   */
  public getOptions(): WorkspaceOptions {
    return { ...this.options };
  }
}