import Commit from '../models/commit.js';
import Reference from '../models/reference.js';


/**
 * Context data for rendering a CommitElement.
 * @typedef {Object} CommitContext
 * @property {Commit} commit The commit object.
 * @property {number} row The row index.
 * @property {number} column The column index.
 * @property {string} color The CSS color of the node and edges.
 * @property {string[]} childCommitIds The IDs of the child commits.
 * @property {number[]} parentCommitRows The row indices of the parent commits.
 * @property {EdgeContext[]} edges The context for the edges.
 * @property {number} maxColumn The maximum column index.
 * @property {Reference[]} refs The references pointing to this commit.
 * @property {string} [transitionDuration] The duration of transition animation as CSS duration string.
 */


/**
 * Context data for rendering an edge of a CommitElement.
 * @typedef {Object} EdgeContext
 * @property {string} pathString The path string (`d`).
 * @property {number} totalLength The total length of the path.
 * @property {string} strokeColor The CSS color of the stroke.
 * @property {boolean} isIndeterminate True if the path has no end and does not go off-screen.
 */


/**
 * Context data for rendering a Reference.
 * @typedef {Object} ReferenceContext
 * @property {Reference} ref - The reference object.
 * @property {string} htmlString - The HTML string representation of the reference.
 * @property {string} [previousCommitId] - The commit ID of a previous ref, if available.
 */

/**
 * @typedef {object} OccupiedRange
 * @property {number} start - The starting row, inclusive.
 * @property {number} end - The ending row, inclusive.
 */

/**
 * Used for column selection and occupancy for Nodes and Paths.
 * @typedef {object} Column
 * @property {number} columnIndex - The index of the column.
 * @property {Array<OccupiedRange>} occupiedRanges - An array storing ranges occupied within this column. The exact structure of array elements depends on usage.
 */


export class Path {
  constructor({nodes}) {
    /** @type {Node[]} */
    this.nodes = nodes;
    this.columnIndex = undefined;
    this.mergeCount = 0;
    this.priorityForNodes = 0;
    this.nameCandidatesFromRefs = [];
    this.nameCandidatesFromCommitSubjectLines = [];
  }
  getId() {
    return this.nodes[0].commit.id;
  }
  getLastNode() {
    return this.nodes.slice(-1)[0];
  }
  getStartIndex() {
    return this.nodes[0].row;
  }
  getEndIndex() {
    return this.getLastNode().row;
  }
  /** Get the start index of the path, including the connecting node of the parent path(s) if any */
  getExtendedStartIndex() {
    const firstNode = this.nodes[0];
    let startIndex = firstNode.row;
    for (const childNode of firstNode.children) {
      if (childNode.row < startIndex) {
        startIndex = childNode.row;
      }
    }
    return startIndex;
  }
  /** Get the end index of the path, including the connecting node of the parent path(s) if any */
  getExtendedEndIndex() {
    const lastNode = this.getLastNode();
    let endIndex = lastNode.row;
    const primaryParentNode = lastNode.parents[0];
    if (primaryParentNode === undefined) {
      // Give indeterminate edges some space for clarity
      endIndex += 2;
    }
    else if (primaryParentNode.row > endIndex) {
      endIndex = primaryParentNode.row;
    }
    return endIndex;
  }
  /** Return true if the path start or end is not connected to any other path */
  getIsOpenPath() {
    const firstNode = this.nodes[0];
    if (firstNode.children.length === 0) {
      return true;
    }
    const lastNode = this.getLastNode();
    if (lastNode.parents.length === 0) {
      return true;
    }
    return false;
  }
  getPrimaryParentPath() {
    const lastNode = this.getLastNode();
    return lastNode.parents[0]?.path;
  }
  getAncestorCount() {
    let ancestorPath = this.getPrimaryParentPath();
    let ancestorCount = 0;
    while(ancestorPath) {
      ancestorCount += 1;
      ancestorPath = ancestorPath.getPrimaryParentPath();
    }
    return ancestorCount;
  }
  _getInferredName() {
    const namePriorities = [
      /^(.+\/)?(master|main|trunk|default)$/i,
      /^(.+\/)?(hotfix\/.+)$/i,
      /^(.+\/)?(develop|development)$/i,
    ];
    for (const namePriorityRegex of namePriorities) {
      for (const nameCandidate of this.nameCandidatesFromRefs) {
        if (namePriorityRegex.test(nameCandidate)) {
          return nameCandidate;
        }
      }
      for (const nameCandidate of this.nameCandidatesFromCommitSubjectLines) {
        if (namePriorityRegex.test(nameCandidate)) {
          return nameCandidate;
        }
      }
    }
    if (this.nameCandidatesFromRefs.length > 0) {
      return this.nameCandidatesFromRefs[0];
    }
    if (this.nameCandidatesFromCommitSubjectLines.length > 0) {
      return this.nameCandidatesFromCommitSubjectLines[0];
    }
    return undefined;
  }
  getInferredName() {
    if (this._inferredName !== undefined) {
      return this._inferredName;
    }
    this._inferredName = this._getInferredName();
    return this._inferredName;
  }
  _getPathNamePriority(pathName) {
    const namePriorities = [
      /^(.+\/)?(master|main|trunk|default)$/i,
      /^(.+\/)?(hotfix\/.+)$/i,
      /^(.+\/)?(develop|development)$/i,
    ];
    if (pathName === undefined) {
      pathName = this.getInferredName();
    }
    let priorityIndex;
    for (priorityIndex = 0; priorityIndex < namePriorities.length; priorityIndex++) {
      const namePriorityRegex = namePriorities[priorityIndex];
      if (namePriorityRegex?.test(pathName)) {
        break;
      }
    }
    const priority = namePriorities.length - priorityIndex;
    if (priority === 0) {
      return this.getPrimaryParentPath()?.getPathNamePriority() ?? priority;
    }
    return priority;
  }
  getPathNamePriority() {
    if (this._namePriority !== undefined) {
      return this._namePriority;
    }
    this._namePriority = this._getPathNamePriority();
    return this._namePriority;
  }
  getMergeCountPriority() {
    if (this.mergeCount === 0) {
      return this.getPrimaryParentPath()?.getMergeCountPriority() ?? this.mergeCount;
    }
    return this.mergeCount;
  }
  compareForNodeInsertion(pathB) {
    const pathA = this;
    if (pathA.priorityForNodes === pathB.priorityForNodes) {
      return pathB.getStartIndex() - pathA.getStartIndex();
    }
    return pathA.priorityForNodes - pathB.priorityForNodes;
  }
}


export class Node {
  /** @type {Commit} */ commit;
  /** @type {Path} */ path;
  /** @type {Node[]} */ children;
  /** @type {Node[]} */ parents;
  constructor({commit, path, row, isPlaceholder = false}) {
    this.commit = commit;
    this.path = path;
    this.row = row;
    this.children = [];
    this.parents = [];
    this.isPlaceholder = isPlaceholder;
  }
  getPreviousNodeInPath() {
    const thisIndex = this.path.nodes.indexOf(this);
    return this.path.nodes[thisIndex - 1] ?? null;
  }
  getNextNodeInPath() {
    const thisIndex = this.path.nodes.indexOf(this);
    return this.path.nodes[thisIndex + 1] ?? null;
  }
}
