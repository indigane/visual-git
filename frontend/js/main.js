import './settings.js';
import socket from './socket.js'
import * as git from './git-commands.js';
import {
  animateCommitEnter,
  animateCommitLeave,
  animateRefEnter,
  animateRefTransition,
  calculatePathStringLength,
} from './animations.js';
import { parseFullRefPath } from './parsers.js';
import { asTextContent, debounce, requestIdlePromise } from './utils.js';


class Path {
  constructor({nodes}) {
    this.nodes = nodes;
    this.columnIndex = undefined;
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
  getExtendedStartIndex() {
    // Includes space for edges connecting this path to other paths
    const firstNode = this.nodes[0];
    let startIndex = firstNode.row;
    for (const childNode of firstNode.children) {
      if (childNode.row < startIndex) {
        startIndex = childNode.row;
      }
    }
    return startIndex;
  }
  getExtendedEndIndex() {
    // Includes space for edges connecting this path to other paths
    const lastNode = this.nodes.slice(-1)[0];
    let endIndex = lastNode.row;
    for (const parentNode of lastNode.parents) {
      if (parentNode !== undefined && parentNode.row > endIndex) {
        endIndex = parentNode.row;
      }
    }
    return endIndex;
  }
  getPrimaryParentPath() {
    const lastNode = this.nodes.slice(-1)[0];
    return lastNode.parents[0]?.path;
  }
  compare(pathB) {
    // In the future this should also check branch order (main, develop, features, etc)
    const pathA = this;
    return pathB.getStartIndex() - pathA.getStartIndex();
  }
}


class Node {
  constructor({commit, path, row}) {
    this.commit = commit;
    this.path = path;
    this.row = row;
    this.children = [];
    this.parents = [];
  }
}


const commitContextByCommitId = {};
const commitIdByRowIndex = {};
const refContextByRefPath = {};
const previousViewportRowIndices = {
  min: -1,
  max: -1,
};


const commitElementPool = {
  elementsByCommitId: {},
  index: 0,
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


const commitTemplate = document.querySelector('#commit-template');
const commitsContainer = document.querySelector('.commits');
function createCommitElement() {
  const commitElement = commitTemplate.content.cloneNode(true).firstElementChild;
  commitsContainer.appendChild(commitElement);
  commitElement._elems = {
    edges: [...commitElement.querySelectorAll('.edge')],
    message: commitElement.querySelector('.message'),
    refsContainer: commitElement.querySelector('.refs'),
  };
  return commitElement;
}


function updateCommitElement(commitElement, context, oldContext) {
  // Remove `display: none;`
  commitElement.style.removeProperty('display');
  commitElement._context = context;
  commitElement.style.setProperty('--transition-duration', context.transitionDuration ?? '0s');
  commitElement.style.setProperty('--row', context.row);
  commitElement.style.setProperty('--column', context.column);
  commitElement.style.setProperty('--color', context.color);
  commitElement.style.setProperty('--max-column', context.maxColumn);
  commitElement.setAttribute('data-commit-id', context.commitId);
  for (const [index, edgeElement] of commitElement._elems.edges.entries()) {
    const edge = context.edges[index];
    if (edge) {
      edgeElement.style.removeProperty('display');
      edgeElement.setAttribute('d', edge.pathString);
      edgeElement.setAttribute('stroke-dasharray', edge.totalLength);
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


document.addEventListener('scroll', renderVisibleCommits);
window.addEventListener('resize', renderVisibleCommits);
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
      for (const fullRefPath of commitContext.refs) {
        const refHtml = refContextByRefPath[fullRefPath]?.htmlString;
        refsHtml += refHtml ?? '';
      }
      if (refsHtml !== '') {
        commitElement._elems.refsContainer.innerHTML = refsHtml;
        let svgStr = '<svg style="width: 18px; height: 18px; position: absolute; top: 0; left: 100%; overflow: visible;">';
        const refHeight = 18;
        const columnWidth = 32;
        const count = commitElement._elems.refsContainer.childElementCount;
        const endY = count / 2 * refHeight + 0.5;
        const offsetX = 30;
        const endX = commitContext.column * columnWidth + offsetX;
        for (let n = 0; n < count; n++) {
          // svgStr += `<path d="M 0 ${(n + 0.5) * 19} Q 0 ${(count / 2) * 19} 100 ${(count / 2) * 19}" stroke="#b2b2b2" fill="transparent"/>`;
          const startX = 0;
          const startY = (n + 0.5) * refHeight + 0.5;
          // Curve control points
          const point1X = endX / 4;
          const point1Y = startY;
          const point2X = offsetX / 2;
          const point2Y = endY;
          svgStr += `<path d="M ${startX} ${startY} C ${point1X} ${point1Y} ${point2X} ${point2Y} ${endX} ${endY}" stroke="#b2b2b2" fill="transparent"/>`;
        }
        commitElement._elems.refsContainer.insertAdjacentHTML('beforeend', svgStr);
      }
    }
  }
  previousViewportRowIndices.min = viewportMinRowIndex;
  previousViewportRowIndices.max = viewportMaxRowIndex;
}


async function renderCommits({ commits, refs }) {
  const commitsContainer = document.querySelector('.commits');
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
  commitsContainer.style.setProperty('--max-row', maxRow);

  // Reverse mapping for refs
  const refsForCommitId = {};
  for (const [refPath, commitId] of Object.entries(refs)) {
    if (refsForCommitId[commitId] === undefined) {
      refsForCommitId[commitId] = [];
    }
    refsForCommitId[commitId].push(refPath);
  }

  // Collect paths of nodes
  const paths = [];
  const pathForCommitId = new Map();
  const nodeForCommitId = new Map();
  const childIdsForCommitId = new Map();
  for (const [index, commit] of commits.entries()) {
    // Non-blocking iteration
    const batchSize = 1000;
    const maxWaitMs = 100;
    const isBatchSizeReached = index !== 0 && index % batchSize === 0;
    if (isBatchSizeReached) {
      await requestIdlePromise(maxWaitMs);
    }
    // Create new path if necessary
    if ( ! pathForCommitId.has(commit.id)) {
      const newPath = new Path({
        nodes: [],
      });
      paths.push(newPath);
      pathForCommitId.set(commit.id, newPath);
    }
    // Place node on a path
    const path = pathForCommitId.get(commit.id);
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
    else if (existingPath !== undefined && path.compare(existingPath) < 0) {
      // Existing path has precedence, do nothing.
    }
    else {
      // No existing path, or new path has precedence.
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
    const pathALength = pathA.getExtendedEndIndex() - pathA.getExtendedStartIndex();
    const pathBLength = pathB.getExtendedEndIndex() - pathB.getExtendedStartIndex();
    const pathAPriority = pathA.mergeCount === 0 ? pathA.getPrimaryParentPath()?.mergeCount ?? pathA.mergeCount : pathA.mergeCount;
    const pathBPriority = pathB.mergeCount === 0 ? pathB.getPrimaryParentPath()?.mergeCount ?? pathB.mergeCount : pathB.mergeCount;
    //return pathBLength - pathALength;
    if (pathBPriority - pathAPriority === 0) {
      if (pathB.mergeCount - pathA.mergeCount === 0) {
        return pathALength - pathBLength;
      }
      return pathB.mergeCount - pathA.mergeCount;
    }
    return pathBPriority - pathAPriority;
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
    function renderRef(fullRefPath) {
      const { refType, refName } = parseFullRefPath(fullRefPath);
      let refTypeClass;
      if (refType === null) {
        refTypeClass = 'special-ref';
      }
      else {
        refTypeClass = `ref-${refType}`;
      }
      return `<div class="ref ${asTextContent(refTypeClass)}">${asTextContent(refName)}</div>`;
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
        edges.push({
          pathString,
          totalLength: calculatePathStringLength(pathString),
          strokeColor,
        });
      }
      return edges;
    }
    // Refs
    const commitRefs = refsForCommitId[commit.id] ?? [];
    commitRefs.sort((a, b) => {
      // Sort refs alphabetically starting from the last character.
      // So that same refs of different remotes are next to each other.
      const { refName: refNameA } = parseFullRefPath(a);
      const { refName: refNameB } = parseFullRefPath(b);
      const reverseA = refNameA.split('').reverse().join('');
      const reverseB = refNameB.split('').reverse().join('');
      return reverseA.localeCompare(reverseB);
    });
    for (const fullRefPath of commitRefs) {
      const oldRefContext = refContextByRefPath[fullRefPath];
      const newRefContext = {
        htmlString: renderRef(fullRefPath),
        commitId: commit.id,
        previousCommitId: oldRefContext?.commitId,
      };
      refContextByRefPath[fullRefPath] = newRefContext;
      knownRefPathsForEnterLeaveAnimation.push(fullRefPath);
    }
    // Node
    const node = nodeForCommitId.get(commit.id);
    const color = colors[node.path.columnIndex % colors.length];
    const edges = getEdges();
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
        for (const fullRefPath of newCommitContext.refs) {
          const refContext = refContextByRefPath[fullRefPath];
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


function main() {
  const settings = document.querySelector('vg-settings');

  getCommitsAndRender();
  settings.addEventListener('setting-change', getCommitsAndRender);

  socket.addEventListener('message', debounce(getCommitsAndRender, 50));

  async function getCommitsAndRender() {
    const maxCommits = settings.get('maxCommits');
    const branchVisibility = settings.get('branchVisibility');
    const flags = [
      '--date-order',
      `--max-count=${maxCommits}`,
    ];
    if (branchVisibility === 'allRefs') {
      flags.push('--all');
    }
    if (branchVisibility === 'allRefsHistory') {
      flags.push('--all', '--reflog');
    }
    // const commits = await git.logCustom(...flags);
    const { commits, refs } = await git.logRaw(...flags);
    renderCommits({
      commits: commits.slice(0, maxCommits),
      refs,
    });
  }
}

main();
