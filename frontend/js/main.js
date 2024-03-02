import './settings.js';
import socket from './socket.js'
import * as git from './git-commands.js';
import { animateCommitEnter, animateEdgesTransition, animateCommitLeave, calculatePointsStringLength } from './animations.js';
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


const commitElementsByCommitId = {};
const commitContextByCommitId = {};
const commitIdByRowIndex = {};
const previousViewportRowIndices = {
  min: -1,
  max: -1,
};


const commitElementPool = {
  commitTemplate: document.querySelector('#commit-template'),
  commitsContainer: document.querySelector('.commits'),
  elementsByCommitId: {},
  index: 0,
  pool: [],
  getNext: function () {
    const { viewportMinRowIndex, viewportMaxRowIndex } = getViewportMinMaxRows();
    for (let i = 0; i < this.pool.length; i++) {
      const commitElement = this.pool[this.index % this.pool.length];
      this.index += 1;
      if (commitElement._availableForReuse) {
        return commitElement;
      }
      const isWithinViewport = isCommitInRange(commitElement._context, viewportMinRowIndex, viewportMaxRowIndex);
      if (isWithinViewport) {
        continue;
      } else {
        return commitElement;
      }
    }

    const commitElement = this.commitTemplate.content.cloneNode(true).firstElementChild;
    this.commitsContainer.appendChild(commitElement);
    this.pool.push(commitElement);
    commitElement._elems = {
      polylines: [...commitElement.querySelectorAll('polyline')],
      message: commitElement.querySelector('.message'),
    };
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
  for (const [index, polyline] of commitElement._elems.polylines.entries()) {
    const edge = context.edges[index];
    polyline.setAttribute('points', edge?.pointsString);
    polyline.setAttribute('stroke-dasharray', edge?.totalLength);
    polyline.style.stroke = edge?.strokeColor;
  }
  if (oldContext?.subject !== context.subject) {
    commitElement._elems.message.textContent = context.subject;
  }
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


document.addEventListener('scroll', requestVisibleCommitsRender);
window.addEventListener('resize', requestVisibleCommitsRender);
let visibleCommitsRenderRequested = false;
function requestVisibleCommitsRender() {
  if (visibleCommitsRenderRequested) {
    return;
  }
  visibleCommitsRenderRequested = true;
  requestAnimationFrame(renderVisibleCommits);
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
    commitElementPool.get(commitId);
  }
  previousViewportRowIndices.min = viewportMinRowIndex;
  previousViewportRowIndices.max = viewportMaxRowIndex;
  visibleCommitsRenderRequested = false;
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
  // commitsContainer.style.setProperty('--max-column', maxColumn);

  // Draw nodes and edges
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
    function renderRefs(refsToRender) {
      return refsToRender.map(renderRef).join('');
    }
    function getEdges() {
      const xOffset = columnWidth / 2;
      const yOffset = rowHeight / 2;
      const cornerOffset = rowHeight / 3;
      const edges = [];
      for (const [parentIndex, parentId] of commit.parents.entries()) {
        const isPrimaryParent = parentIndex === 0;
        const parentNode = nodeForCommitId.get(parentId);
        const points = [];
        let strokeColor = colors[0];
        if (parentNode === undefined) {
          // Parent has not been parsed yet. Draw a simple line through the bottom of the graph.
          const startX = node.path.columnIndex;
          const startY = 0;
          points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
          const endX = node.path.columnIndex;
          const endY = maxRow + 1 - node.row;
          points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
          // Duplicate the end point for animations as they require a consistent number of points to transition.
          points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
          strokeColor = colors[node.path.columnIndex % colors.length];
        }
        else if (node.path === parentNode.path) {
          // Edge is within the same path. Draw a simple line.
          const startX = node.path.columnIndex;
          const startY = 0;
          points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
          const endX = parentNode.path.columnIndex;
          const endY = parentNode.row - node.row;
          points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
          // Duplicate the end point for animations as they require a consistent number of points to transition.
          points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
          strokeColor = colors[node.path.columnIndex % colors.length];
        }
        else if (isPrimaryParent) {
          // Edge is converging. Draw a line with a corner.
          const startX = node.path.columnIndex;
          const startY = 0;
          points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
          const cornerX = node.path.columnIndex;
          const cornerY = parentNode.row - node.row;
          points.push(`${cornerX * columnWidth + xOffset},${cornerY * rowHeight + yOffset - cornerOffset}`);
          const endX = parentNode.path.columnIndex;
          const endY = parentNode.row - node.row;
          points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
          strokeColor = colors[node.path.columnIndex % colors.length];
        }
        else {
          // Edge is diverging. Draw a line with a corner.
          const startX = node.path.columnIndex;
          const startY = 0;
          points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
          const cornerX = parentNode.path.columnIndex;
          const cornerY = 0;
          points.push(`${cornerX * columnWidth + xOffset},${cornerY * rowHeight + yOffset + cornerOffset}`);
          const endX = parentNode.path.columnIndex;
          const endY = parentNode.row - node.row;
          points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
          strokeColor = colors[parentNode.path.columnIndex % colors.length];
        }
        const pointsString = [points].join(' ');
        edges.push({
          pointsString,
          totalLength: calculatePointsStringLength(pointsString),
          strokeColor,
        });
      }
      return edges;
    }
    // Node
    const node = nodeForCommitId.get(commit.id);
    const nodeRefs = refsForCommitId[commit.id] ?? [];
    const color = colors[node.path.columnIndex % colors.length];
    const edges = getEdges();
    //let commitElement = commitElementsByCommitId[commit.id];
    const newCommitContext = {
      row: node.row,
      column: node.path.columnIndex,
      color,
      commitId: commit.id,
      parentCommitRows: commit.parents.map(parentId => nodeForCommitId.get(parentId)?.row ?? maxRow),
      edges,
      subject: commit.subject,
      maxColumn,
    };
    const oldCommitContext = commitContextByCommitId[commit.id];
    const isOldCommitElementWithinViewport = isCommitInRange(oldCommitContext, viewportMinRowIndex, viewportMaxRowIndex);
    const isNewCommitElementWithinViewport = isCommitInRange(newCommitContext, viewportMinRowIndex, viewportMaxRowIndex);
    if (isOldCommitElementWithinViewport || isNewCommitElementWithinViewport) {
      const commitElement = commitElementPool.get(commit.id);
      if (oldCommitContext === undefined) {
        // New commit element
        updateCommitElement(commitElement, {...newCommitContext, transitionDuration: '0s'});
        // Animate only visible commits for performance
        if (node.row >= viewportMinRowIndex && node.row <= viewportMaxRowIndex) {
          // Half duration so that leaving elements are hidden before entering elements appear.
          const halfDuration = redrawTransitionDurationMs / 2;
          animateCommitEnter(commitElement, halfDuration);
        }
      } else {
        // Existing commit element
        // Animate only visible commits for performance
        if (isOldCommitElementWithinViewport || isNewCommitElementWithinViewport) {
          updateCommitElement(commitElement, {...newCommitContext, transitionDuration: redrawTransitionDurationMs + 'ms'}, oldCommitContext);
          animateEdgesTransition(commitElement, edges, oldCommitContext.edges, redrawTransitionDurationMs);
        }
        else {
          updateCommitElement(commitElement, {...newCommitContext, transitionDuration: '0s'}, oldCommitContext);
        }
      }
    }
    commitContextByCommitId[commit.id] = newCommitContext;
    commitIdByRowIndex[newCommitContext.row] = commit.id;
    knownCommitIdsForEnterLeaveAnimation.push(commit.id);
  }
  for (const [commitId, commitContext] of Object.entries(commitContextByCommitId)) {
    if ( ! knownCommitIdsForEnterLeaveAnimation.includes(commitId)) {
      // Animate only visible commits for performance
      const isWithinViewport = isCommitInRange(commitContext, viewportMinRowIndex, viewportMaxRowIndex);
      if (isWithinViewport) {
        const commitElement = commitElementPool.get(commitId);
        // Half duration so that leaving elements are hidden before entering elements appear.
        const halfDuration = redrawTransitionDurationMs / 2;
        animateCommitLeave(commitElement, halfDuration).then(() => commitElementPool.removeByCommitId(commitId));
      }
      else {
        //commitElement.hidden = true;
      }
      delete commitContextByCommitId[commitId];
    }
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
