import {
  animateCommitEnter,
  animateCommitLeave,
  animateRefEnter,
  animateRefTransition,
  calculatePathStringLength,
} from './animations.js';
import Commit from '../models/commit.js';
import Reference from '../models/reference.js';
import { parseBranchNamesFromSubject } from '../git-interface/parsers.js';
import { asTextContent, requestIdlePromise, splitOnce } from '../utils.js';


class Path {
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
  getStartIndex() {
    return this.nodes[0].row;
  }
  getEndIndex() {
    return this.nodes.slice(-1)[0].row;
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
    const lastNode = this.nodes.slice(-1)[0];
    let endIndex = lastNode.row;
    const primaryParentNode = lastNode.parents[0];
    if (primaryParentNode !== undefined && primaryParentNode.row > endIndex) {
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
    const lastNode = this.nodes.slice(-1)[0];
    if (lastNode.parents.length === 0) {
      return true;
    }
    return false;
  }
  getPrimaryParentPath() {
    const lastNode = this.nodes.slice(-1)[0];
    return lastNode.parents[0]?.path;
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
      return this.getPrimaryParentPath()?.mergeCount ?? this.mergeCount;
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


class Node {
  /** @type {Commit} */ commit;
  /** @type {Path} */ path;
  /** @type {Node[]} */ children;
  /** @type {Node[]} */ parents;
  constructor({commit, path, row}) {
    this.commit = commit;
    this.path = path;
    this.row = row;
    this.children = [];
    this.parents = [];
  }
}


/** @type {Object.<string, CommitContext>} */ const commitContextByCommitId = {};
/** @type {Object.<number, string>} */ const commitIdByRowIndex = {};
/** @type {Object.<string, ReferenceContext>} */ const refContextByRefPath = {};
const previousViewportRowIndices = {
  min: -1,
  max: -1,
};


const commitElementPool = {
  elementsByCommitId: {},
  index: 0,
  /** @type {CommitElement[]} */
  pool: [],
  getNext: function () {
    const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
    for (let i = 0; i < this.pool.length; i++) {
      const commitElement = this.pool[this.index % this.pool.length];
      this.index += 1;
      if (commitElement._boundCommitId === undefined) {
        return commitElement;
      }
      const isWithinViewport = isCommitInRange(commitElement._context, viewportMinRowIndex, viewportMaxRowIndex);
      if (isWithinViewport) {
        // Do not reuse visible commit elements.
        continue;
      } else {
        return commitElement;
      }
    }
    // Pool is out of available elements.
    const commitElement = createCommitElement();
    this.pool.push(commitElement);
    return commitElement;
  },
  removeByCommitId: function (commitId) {
    const commitElement = this.elementsByCommitId[commitId];
    if (commitElement === undefined) {
      return;
    }
    this.remove(commitElement);
  },
  remove: function (commitElement) {
    delete this.elementsByCommitId[commitElement._boundCommitId];
    commitElement.style.display = 'none';
    commitElement._boundCommitId = undefined;
  },
  get: function (commitId) {
    const commitContext = commitContextByCommitId[commitId];
    if (this.elementsByCommitId[commitId] !== undefined) {
      return this.elementsByCommitId[commitId];
    }
    const commitElement = this.getNext();
    if (commitContext !== undefined) {
      updateCommitElement(commitElement, commitContext);
    }
    // Delete previous reference so that there are no stale references.
    delete this.elementsByCommitId[commitElement._boundCommitId];
    this.elementsByCommitId[commitId] = commitElement;
    commitElement._boundCommitId = commitId;
    return commitElement;
  },
};

/**
 * Context data for rendering a CommitElement.
 * @typedef {Object} CommitContext
 * @property {number} row The row index.
 * @property {number} column The column index.
 * @property {string} color The CSS color of the node and edges.
 * @property {string} commitId The ID of the commit.
 * @property {string[]} childCommitIds The IDs of the child commits.
 * @property {number[]} parentCommitRows The row indices of the parent commits.
 * @property {EdgeContext[]} edges The context for the edges.
 * @property {string} subject The subject of the commit.
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
 */

/**
 * Context data for rendering a Reference.
 * @typedef {Object} ReferenceContext
 * @property {Reference} ref - The reference object.
 * @property {string} htmlString - The HTML string representation of the reference.
 * @property {string} [previousCommitId] - The commit ID of a previous ref, if available.
 */

/**
 * @typedef {HTMLElement & {
 *   _elems: {
 *     edges: (SVGElement | null)[]
 *     message: Element | null
 *     refsContainer: Element | null
 *   }
 *   _boundCommitId: string
 *   _context: CommitContext
 * }} CommitElement
 */

/** @type {HTMLTemplateElement} */
const commitTemplate = document.querySelector('#commit-template');
const commitsContainer = document.querySelector('.commits');
function createCommitElement() {
  const clonedFragment = /** @type {DocumentFragment} */ (commitTemplate.content.cloneNode(true));
  const commitElement = /** @type {CommitElement} */ (clonedFragment.firstElementChild);
  commitsContainer.appendChild(commitElement);
  commitElement._elems = {
    edges: /** @type {SVGElement[]} */([...commitElement.querySelectorAll('.edge')]),
    message: commitElement.querySelector('.message'),
    refsContainer: commitElement.querySelector('.refs'),
  };
  return commitElement;
}


/**
 * @param {CommitElement} commitElement
 * @param {CommitContext} context
 * @param {CommitContext} [oldContext]
 */
function updateCommitElement(commitElement, context, oldContext) {
  // Remove `display: none;` because new and reused commit elements are initially hidden.
  commitElement.style.removeProperty('display');
  commitElement._context = context;
  commitElement.style.setProperty('--transition-duration', context.transitionDuration ?? '0s');
  commitElement.style.setProperty('--row', context.row.toString());
  commitElement.style.setProperty('--column', context.column.toString());
  commitElement.style.setProperty('--color', context.color);
  commitElement.style.setProperty('--max-column', context.maxColumn.toString());
  commitElement.setAttribute('data-commit-id', context.commitId);
  for (const [index, edgeElement] of commitElement._elems.edges.entries()) {
    const edge = context.edges[index];
    if (edge) {
      edgeElement.style.removeProperty('display');
      edgeElement.setAttribute('d', edge.pathString);
      edgeElement.setAttribute('stroke-dasharray', edge.totalLength.toString());
      edgeElement.style.stroke = edge.strokeColor;
    }
    else {
      edgeElement.style.display = 'none';
    }
  }
  if (oldContext?.subject !== context.subject) {
    commitElement._elems.message.textContent = context.subject;
  }
  commitElement._elems.refsContainer.replaceChildren();
}


function getViewportMinMaxRows() {
  const columnWidth = 32;
  const rowHeight = 32;
  const topOffset = 5;
  const bottomOffset = 5;
  const viewportMinRowIndex = Math.floor(document.documentElement.scrollTop / rowHeight) - topOffset;
  const viewportMaxRowIndex = Math.ceil((document.documentElement.scrollTop + window.innerHeight) / rowHeight) + bottomOffset;
  return { viewportMinRowIndex, viewportMaxRowIndex };
}


function isCommitInRange(commitContext, minRow, maxRow) {
  if (commitContext === undefined) {
    return false;
  }
  if (commitContext.row >= minRow && commitContext.row <= maxRow) {
    return true;
  }
  // If the commit is above the viewport, it may have an edge hanging downwards that is in range.
  if (commitContext.row < minRow) {
    for (const parentCommitRow of commitContext.parentCommitRows) {
      if (parentCommitRow >= minRow) {
        // The edge from commit to parent is visible in the viewport.
        return true;
      }
    }
  }
  return false;
}


function renderVisibleCommits() {
  const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
  for (let rowIndex = viewportMinRowIndex; rowIndex <= viewportMaxRowIndex; rowIndex++) {
    if (rowIndex >= previousViewportRowIndices.min && rowIndex <= previousViewportRowIndices.max) {
      // The previous viewport already made this row visible.
      continue;
    }
    const commitId = commitIdByRowIndex[rowIndex];
    if (commitId === undefined) {
      continue;
    }
    const commitElement = commitElementPool.get(commitId);
    const commitContext = commitContextByCommitId[commitId];
    if (commitContext !== undefined) {
      // Render any commit that points to this commit as their parent,
      // because those nodes have an edge hanging downwards that needs
      // to be rendered as it connects to this node.
      for (const childCommitId of commitContext.childCommitIds) {
        commitElementPool.get(childCommitId);
      }
      // Refs
      let refsHtml = '';
      for (const ref of commitContext.refs) {
        const refContext = refContextByRefPath[ref.fullRefPath];
        if (refContext === undefined) {
          continue;
        }
        const refHtml = refContext.htmlString;
        refsHtml += refHtml;
      }
      if (refsHtml !== '') {
        commitElement._elems.refsContainer.innerHTML = refsHtml;
      }
    }
  }
  previousViewportRowIndices.min = viewportMinRowIndex;
  previousViewportRowIndices.max = viewportMaxRowIndex;
}


export class GraphElement extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    document.addEventListener('scroll', renderVisibleCommits);
    window.addEventListener('resize', renderVisibleCommits);
  }
  /** @param {{ commits: Commit[], refs: Object.<string, Reference> }} args */
  async renderCommits({ commits, refs }) {
    /** @type {HTMLElement} */
    const commitsContainer = this.querySelector('.commits');
    //const colors = ['#dd826f', '#8bacd2', '#bad56a', '#ae7fba', '#e8b765', '#f8ed73', '#bab6d8', '#f0cee5', '#a2d2c7'];
    //const colors = ['#68023F', '#008169', '#EF0096', '#00DCB5', '#FFCFE2', '#003C86', '#9400E6', '#009FFA', '#FF71FD', '#7CFFFA', '#6A0213', '#008607', '#F60239', '#00E307', '#FFDC3D'];
    const colors = ['#ee6677', '#228833', '#4477aa', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb'];
    const columnWidth = 32;
    const rowHeight = 32;
    const redrawTransitionDurationMs = 1000;
    const maxRow = commits.length - 1;
    const knownCommitIdsForEnterLeaveAnimation = [];
    const knownRefPathsForEnterLeaveAnimation = [];
    const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
    previousViewportRowIndices.min = viewportMinRowIndex;
    previousViewportRowIndices.max = viewportMaxRowIndex;

    commitsContainer.style.setProperty('--column-width', columnWidth + 'px');
    commitsContainer.style.setProperty('--row-height', rowHeight + 'px');
    commitsContainer.style.setProperty('--max-row', maxRow.toString());

    // Reverse mapping for refs
    /** @type {Object.<string, Reference[]>} */
    const refsByCommitId = {};
    const priorityPathIds = [];
    const namePriorities = [
      /^(.+\/)?(master|main|trunk|default)$/i,
      /^(.+\/)?(develop|development)$/i,
    ];
    for (const ref of Object.values(refs)) {
      if (refsByCommitId[ref.commitId] === undefined) {
        refsByCommitId[ref.commitId] = [];
      }
      refsByCommitId[ref.commitId].push(ref);
      for (const [index, namePriorityRegex] of namePriorities.entries()) {
        if (namePriorityRegex?.test(ref.refName)) {
          priorityPathIds.push(ref.commitId);
          // These are used to split paths. To avoid splitting for example
          // main multiple times, remove it after the first occurrence.
          namePriorities.splice(index, 1);
        }
      }
    }

    // Collect paths of nodes
    /** @type {Path[]} */ const paths = [];
    /** @type {Map<string, Path>} */ const pathForCommitId = new Map();
    /** @type {Map<string, Node>} */ const nodeForCommitId = new Map();
    /** @type {Map<string, string[]>} */ const childIdsForCommitId = new Map();
    function createPath(commitId) {
      const path = new Path({
        nodes: [],
      });
      paths.push(path);
      pathForCommitId.set(commitId, path);
      return path;
    }
    function getOrCreatePathForCommitId(commitId) {
      const path = pathForCommitId.get(commitId);
      if (path !== undefined) {
        return path;
      }
      return createPath(commitId);
    }
    for (const [index, commit] of commits.entries()) {
      // Non-blocking iteration
      const batchSize = 1000;
      const maxWaitMs = 100;
      const isBatchSizeReached = index !== 0 && index % batchSize === 0;
      if (isBatchSizeReached) {
        await requestIdlePromise(maxWaitMs);
      }
      // Place node on a path
      let path;
      const shouldCreateNewPath = priorityPathIds.includes(commit.id);
      if (shouldCreateNewPath) {
        path = createPath(commit.id);
        path.priorityForNodes = 1;
      } else {
        path = getOrCreatePathForCommitId(commit.id);
      }
      const node = new Node({
        commit,
        path,
        row: index,
      });
      path.nodes.push(node);
      nodeForCommitId.set(commit.id, node);
      // Tentatively place primary parent on the same path, based on path precedence
      const primaryParentId = commit.parents[0];
      const existingPath = pathForCommitId.get(primaryParentId);
      if (primaryParentId === undefined) {
        // No parents, do nothing.
      }
      else if (existingPath !== undefined && path.compareForNodeInsertion(existingPath) < 0) {
        // Existing path for parent node has precedence, do nothing.
      }
      else {
        // No existing path for parent node, or our path has precedence.
        pathForCommitId.set(primaryParentId, path);
      }
      // Keep track of child ids for node relationships
      for (const parentId of commit.parents) {
        if ( ! childIdsForCommitId.has(parentId)) {
          childIdsForCommitId.set(parentId, []);
        }
        childIdsForCommitId.get(parentId).push(commit.id);
      }
      // Update node relationships
      for (const childId of childIdsForCommitId.get(commit.id) ?? []) {
        const childNode = nodeForCommitId.get(childId);
        if (childNode === undefined) {
          continue;
        }
        node.children.push(childNode);
        for (const [parentIndex, parentId] of childNode.commit.parents.entries() ?? []) {
          const parentNode = nodeForCommitId.get(parentId);
          if (parentNode !== undefined) {
            childNode.parents[parentIndex] = parentNode;
          }
        }
      }
      // Add path name candidates from refs
      const refs = refsByCommitId[commit.id] ?? [];
      for (const ref of refs) {
        path.nameCandidatesFromRefs.push(ref.refName);
      }
      // Add path name candidates from commit subject lines
      const { mergeSourceBranchName, mergeTargetBranchName } = parseBranchNamesFromSubject(commit.subject);
      if (mergeTargetBranchName !== undefined) {
        // Current commit is a merge commit. Use the merge target branch name as a candidate.
        path.nameCandidatesFromCommitSubjectLines.push(mergeTargetBranchName);
      }
      if (mergeSourceBranchName !== undefined) {
        // Current commit is a merge commit. Use the merge source branch name as a candidate for the secondary parent's path.
        const secondaryParentCommitId = commit.parents[1];
        const secondaryParentPath = getOrCreatePathForCommitId(secondaryParentCommitId);
        secondaryParentPath.nameCandidatesFromCommitSubjectLines.push(mergeSourceBranchName);
      }
    }

    // Sort paths
    for (const path of paths) {
      path.mergeCount = 0;
      for (const node of path.nodes) {
        if (node.parents.length > 1) {
          path.mergeCount += 1;
        }
      }
    }
    paths.sort((pathA, pathB) => {
      // Prioritize paths with known name priority
      const pathANamePriority = pathA.getPathNamePriority();
      const pathBNamePriority = pathB.getPathNamePriority();
      if (pathBNamePriority - pathANamePriority !== 0) {
        return pathBNamePriority - pathANamePriority;
      }
      // Prioritize paths that have parents with high merge count
      const pathAMergeCountPriority = pathA.getMergeCountPriority();
      const pathBMergeCountPriority = pathB.getMergeCountPriority();
      if (pathBMergeCountPriority - pathAMergeCountPriority !== 0) {
        return pathBMergeCountPriority - pathAMergeCountPriority;
      }
      // Prioritize high merge count
      if (pathB.mergeCount - pathA.mergeCount !== 0) {
        return pathB.mergeCount - pathA.mergeCount;
      }
      // Prioritize shorter paths, considering open paths to always be longer than closed paths.
      const pathAIsOpen = pathA.getIsOpenPath();
      const pathBIsOpen = pathB.getIsOpenPath();
      if (pathAIsOpen && ! pathBIsOpen) {
        return 1;
      }
      if ( ! pathAIsOpen && pathBIsOpen) {
        return -1;
      }
      const pathALength = pathA.getExtendedEndIndex() - pathA.getExtendedStartIndex();
      const pathBLength = pathB.getExtendedEndIndex() - pathB.getExtendedStartIndex();
      return pathALength - pathBLength;
    });

    // Select columns for paths
    const columns = [];
    for (const [pathIndex, path] of paths.entries()) {
      const pathStart = path.getExtendedStartIndex();
      const pathEnd = path.getExtendedEndIndex();
      const minColumnIndex = path.getPrimaryParentPath()?.columnIndex ?? 0;
      let selectedColumnIndex = undefined;
      for (const column of columns) {
        if (column.columnIndex < minColumnIndex) {
          continue;
        }
        let isOverlappingOccupiedRange = false;
        for (const {start, end} of column.occupiedRanges) {
          if (pathStart < end && pathEnd > start) {
            isOverlappingOccupiedRange = true;
            break;
          }
        }
        if (isOverlappingOccupiedRange) {
          continue;
        }
        else {
          column.occupiedRanges.push({start: pathStart, end: pathEnd});
          selectedColumnIndex = column.columnIndex;
          break;
        }
      }
      if (selectedColumnIndex === undefined) {
        const column = {
          columnIndex: columns.length,
          occupiedRanges: [{start: pathStart, end: pathEnd}],
        };
        columns.push(column);
        selectedColumnIndex = column.columnIndex;
      }
      path.columnIndex = selectedColumnIndex;
    }
    // Update max column
    const maxColumn = columns.length;

    // Draw nodes and edges
    const deferredAnimations = [];
    for (const [index, commit] of commits.entries()) {
      // Non-blocking iteration
      const batchSize = 1000;
      const maxWaitMs = 100;
      const isBatchSizeReached = index !== 0 && index % batchSize === 0;
      if (isBatchSizeReached) {
        await requestIdlePromise(maxWaitMs);
      }
      function renderRef(ref) {
        const rightArrow = '\u2192';
        let refName = asTextContent(ref.refName);
        let refTitle = refName;
        let refTypeClass;
        let remotePart = '';
        let iconPart = '';
        if (ref.refType === null) {
          refTypeClass = 'special-ref';
        } else {
          refTypeClass = `ref-${ref.refType}`;
        }
        if (ref.refName === 'HEAD') {
          refName = `YOU ARE HERE ${rightArrow}`;
          refTitle = '';
        } else if (ref.refType === 'stash') {
          refName = 'Your latest stash';
          refTitle = '';
        } else if (ref.refType === 'remotes') {
          let remoteName;
          // TODO: Remotes can have slashes, although you should probably be slapped if you do that.
          [remoteName, refName] = splitOnce(ref.refName, '/');
          refName = asTextContent(refName);
          remotePart = `<span class="ref-part-remote">(${asTextContent(remoteName)})</span>`;
          iconPart = `<svg-icon src="img/icon-share.svg" title="Remote branch"></svg-icon>`;
        }
        else if (ref.refType === 'tags') {
          iconPart = '<svg-icon src="img/icon-tag.svg" title="Tag"></svg-icon>';
        }
        else if (ref.refType === 'heads') {
          iconPart = '<svg-icon src="img/icon-branching.svg" title="Local branch"></svg-icon>';
        }
        return `<div class="ref ${asTextContent(refTypeClass)}" title="${refTitle}">${remotePart}${iconPart}<span class="ref-part-name">${refName}</span></div>`;
      }
      function getEdges() {
        const xOffset = columnWidth / 2;
        const yOffset = rowHeight / 2;
        const cornerOffset = rowHeight / 3;
        const edges = [];
        for (const [parentIndex, parentId] of commit.parents.entries()) {
          const isPrimaryParent = parentIndex === 0;
          const parentNode = nodeForCommitId.get(parentId);
          const pathCommands = [];
          let strokeColor = colors[0];
          if (parentNode === undefined) {
            // Parent has not been parsed yet. Draw a simple line through the bottom of the graph.
            const startX = node.path.columnIndex;
            const startY = 0;
            pathCommands.push(`M ${startX * columnWidth + xOffset} ${startY * rowHeight + yOffset}`);
            const endX = node.path.columnIndex;
            const endY = maxRow + 1 - node.row;
            pathCommands.push(`L ${endX * columnWidth + xOffset} ${endY * rowHeight + yOffset}`);
            // Duplicate the end point for animations as they require a consistent number of points to transition.
            pathCommands.push(`L ${endX * columnWidth + xOffset} ${endY * rowHeight + yOffset}`);
            strokeColor = colors[node.path.columnIndex % colors.length];
          }
          else if (node.path === parentNode.path) {
            // Edge is within the same path. Draw a simple line.
            const startX = node.path.columnIndex;
            const startY = 0;
            pathCommands.push(`M ${startX * columnWidth + xOffset} ${startY * rowHeight + yOffset}`);
            const endX = parentNode.path.columnIndex;
            const endY = parentNode.row - node.row;
            pathCommands.push(`L ${endX * columnWidth + xOffset} ${endY * rowHeight + yOffset}`);
            // Duplicate the end point for animations as they require a consistent number of points to transition.
            pathCommands.push(`L ${endX * columnWidth + xOffset} ${endY * rowHeight + yOffset}`);
            strokeColor = colors[node.path.columnIndex % colors.length];
          }
          else if (isPrimaryParent) {
            // Edge is converging. Draw a line with a corner.
            const startX = node.path.columnIndex;
            const startY = 0;
            pathCommands.push(`M ${startX * columnWidth + xOffset} ${startY * rowHeight + yOffset}`);
            const cornerX = node.path.columnIndex;
            const cornerY = parentNode.row - node.row;
            pathCommands.push(`L ${cornerX * columnWidth + xOffset} ${cornerY * rowHeight + yOffset - cornerOffset}`);
            const endX = parentNode.path.columnIndex;
            const endY = parentNode.row - node.row;
            pathCommands.push(`L ${endX * columnWidth + xOffset} ${endY * rowHeight + yOffset}`);
            strokeColor = colors[node.path.columnIndex % colors.length];
          }
          else {
            // Edge is diverging. Draw a line with a corner.
            const startX = node.path.columnIndex;
            const startY = 0;
            pathCommands.push(`M ${startX * columnWidth + xOffset} ${startY * rowHeight + yOffset}`);
            const cornerX = parentNode.path.columnIndex;
            const cornerY = 0;
            pathCommands.push(`L ${cornerX * columnWidth + xOffset} ${cornerY * rowHeight + yOffset + cornerOffset}`);
            const endX = parentNode.path.columnIndex;
            const endY = parentNode.row - node.row;
            pathCommands.push(`L ${endX * columnWidth + xOffset} ${endY * rowHeight + yOffset}`);
            strokeColor = colors[parentNode.path.columnIndex % colors.length];
          }
          const pathString = pathCommands.join(' ');
          /** @type {EdgeContext} */
          const edgeContext = {
            pathString,
            totalLength: calculatePathStringLength(pathString),
            strokeColor,
          };
          edges.push(edgeContext);
        }
        return edges;
      }
      // Refs
      const commitRefs = refsByCommitId[commit.id] ?? [];
      commitRefs.sort((a, b) => {
        let refTypeA = a.refType;
        let refTypeB = b.refType;
        if (a.isPointedToByHEAD && b.refType === 'HEAD') {
          return 1;
        }
        if (b.isPointedToByHEAD && a.refType === 'HEAD') {
          return -1;
        }
        if (a.isPointedToByHEAD) {
          refTypeA = 'HEAD';
        }
        if (b.isPointedToByHEAD) {
          refTypeB = 'HEAD';
        }
        const refTypeOrder = {
          'HEAD': 0,
          'tags': 1,
          'heads': 2,
          'remotes': 3,
        };
        const refTypeOrderOther = 4;
        const refTypeOrderResult = (refTypeOrder[refTypeB] ?? refTypeOrderOther) - (refTypeOrder[refTypeA] ?? refTypeOrderOther);
        if (refTypeOrderResult !== 0) {
          return refTypeOrderResult;
        }
        return a.refName.localeCompare(b.refName);
      });
      for (const ref of commitRefs) {
        const oldRefContext = refContextByRefPath[ref.fullRefPath];
        /** @type {ReferenceContext} */
        const newRefContext = {
          ref,
          htmlString: renderRef(ref),
          previousCommitId: oldRefContext?.ref.commitId,
        };
        refContextByRefPath[ref.fullRefPath] = newRefContext;
        knownRefPathsForEnterLeaveAnimation.push(ref.fullRefPath);
      }
      // Node
      const node = nodeForCommitId.get(commit.id);
      const color = colors[node.path.columnIndex % colors.length];
      const edges = getEdges();
      /** @type {CommitContext} */
      const newCommitContext = {
        row: node.row,
        column: node.path.columnIndex,
        color,
        commitId: commit.id,
        childCommitIds: node.children.map(childNode => childNode.commit.id),
        parentCommitRows: commit.parents.map(parentId => nodeForCommitId.get(parentId)?.row ?? maxRow),
        edges,
        subject: commit.subject,
        maxColumn,
        refs: commitRefs,
      };
      const oldCommitContext = commitContextByCommitId[commit.id];
      const isOldCommitElementWithinViewport = isCommitInRange(oldCommitContext, viewportMinRowIndex, viewportMaxRowIndex);
      const isNewCommitElementWithinViewport = isCommitInRange(newCommitContext, viewportMinRowIndex, viewportMaxRowIndex);
      if (isOldCommitElementWithinViewport || isNewCommitElementWithinViewport) {
        deferredAnimations.push(() => {
          const commitElement = commitElementPool.get(commit.id);
          if (oldCommitContext === undefined) {
            // New commit element
            updateCommitElement(commitElement, {...newCommitContext, transitionDuration: '0s'});
            // Half duration so that leaving elements are hidden before entering elements appear.
            const halfDuration = redrawTransitionDurationMs / 2;
            animateCommitEnter(commitElement, halfDuration);
          } else {
            // Existing commit element
            updateCommitElement(commitElement, {...newCommitContext, transitionDuration: redrawTransitionDurationMs + 'ms'}, oldCommitContext);
          }
          // Refs
          // TODO: Check if context.refs has changed?
          for (const ref of newCommitContext.refs) {
            const refContext = refContextByRefPath[ref.fullRefPath];
            if (refContext === undefined) {
              continue;
            }
            const refOldCommitContext = refContext.previousCommitId && commitContextByCommitId[refContext.previousCommitId];
            if (refOldCommitContext === undefined) {
              animateRefEnter(commitElement, refContext, redrawTransitionDurationMs);
            } else {
              animateRefTransition(commitElement, refContext, newCommitContext, refOldCommitContext, redrawTransitionDurationMs);
            }
          }
        });
      }
      commitContextByCommitId[commit.id] = newCommitContext;
      commitIdByRowIndex[newCommitContext.row] = commit.id;
      knownCommitIdsForEnterLeaveAnimation.push(commit.id);
    }
    for (const [commitId, commitContext] of Object.entries(commitContextByCommitId)) {
      const isCommitGone = knownCommitIdsForEnterLeaveAnimation.includes(commitId) === false;
      if (isCommitGone) {
        const isWithinViewport = isCommitInRange(commitContext, viewportMinRowIndex, viewportMaxRowIndex);
        if (isWithinViewport) {
          deferredAnimations.push(() => {
            const commitElement = commitElementPool.get(commitId);
            // Half duration so that leaving elements are hidden before entering elements appear.
            const halfDuration = redrawTransitionDurationMs / 2;
            animateCommitLeave(commitElement, halfDuration).then(() => commitElementPool.removeByCommitId(commitId));
          });
        }
        else {
          commitElementPool.removeByCommitId(commitId);
        }
        delete commitContextByCommitId[commitId];
      }
    }
    // For now all animations are deferred until the end of graph construction.
    // An optimization is possible:
    // - Move knownCommitIdsForEnterLeaveAnimation to the first-pass for loop.
    // - Move leave animations to be as close as possible to the other animations.
    // - Block graph construction from progressing until the animation has finished.
    // Batch boundaries must also be taken into account. The added complexity may not be worth it.
    for (const deferredAnimation of deferredAnimations) {
      deferredAnimation();
    }
  }
}

customElements.define('vg-graph', GraphElement);
