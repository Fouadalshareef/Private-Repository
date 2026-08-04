import type { ProjectTree } from './ProjectTree.js';
import type { ProjectInfo } from '../project/ProjectInfo.js';

/**
 * The Project Object Model (POM).
 *
 * Represents an in-memory object graph of a software project. This is
 * the central representation used by future systems such as Source
 * Index, Language Services, AI Engine, Refactoring, Search, Navigation,
 * and Memory.
 */
export class ProjectModel {
  /** The metadata of the project. */
  public readonly info: ProjectInfo;

  /** The tree structure of the project. */
  public readonly tree: ProjectTree;

  /**
   * Creates a new project model.
   * @param info The project metadata.
   * @param tree The project tree.
   */
  constructor(info: ProjectInfo, tree: ProjectTree) {
    this.info = info;
    this.tree = tree;
  }
}