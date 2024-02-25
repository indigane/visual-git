import './settings.js';
import socket from './socket.js'
import * as git from './git-commands.js';
import { parseFullRefPath } from './parsers.js';
import { animate, asTextContent, debounce, requestIdlePromise } from './utils.js';


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


async function renderCommits({ commits, refs }) {
  const commitsContainer = document.querySelector('.commits');
  //const colors = ['#dd826f', '#8bacd2', '#bad56a', '#ae7fba', '#e8b765', '#f8ed73', '#bab6d8', '#f0cee5', '#a2d2c7'];
  //const colors = ['#68023F', '#008169', '#EF0096', '#00DCB5', '#FFCFE2', '#003C86', '#9400E6', '#009FFA', '#FF71FD', '#7CFFFA', '#6A0213', '#008607', '#F60239', '#00E307', '#FFDC3D'];
  const colors = ['#ee6677', '#228833', '#4477aa', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb'];
  const maxRow = commits.length - 1;
  const commitElementsToKeep = [];

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
  commitsContainer.style.setProperty('--max-column', maxColumn);

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
      const rowHeight = 32;
      const columnWidth = 32;
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
        edges.push({
          pointsString: [points].join(' '),
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
    let commitElement = commitElementsByCommitId[commit.id];
    if (commitElement === undefined) {
      commitsContainer.insertAdjacentHTML('beforeend', `
      <div class="commit" style="--row: ${node.row}; --column: ${node.path.columnIndex};" data-commit-id="${node.commit.id}">
        <div class="graph" style="color: ${color};">
          <svg>
            <circle></circle>
            ${edges.map(edge =>
              `<polyline class="edge" points="${edge.pointsString}" style="stroke: ${edge.strokeColor};" />`
            ).join('')}
          </svg>
        </div>
        <div class="message">${renderRefs(nodeRefs)} ${asTextContent(node.commit.subject)}</div>
      </div>
      `.trim());
      commitElement = commitsContainer.lastElementChild;
      commitElementsByCommitId[commit.id] = commitElement;
      for (const edgeElement of commitElement.querySelectorAll('.edge')) {
        // Setting stroke-dasharray to polylineLength allows a gap using stroke-dashoffset.
        const polylineLength = edgeElement.getTotalLength();
        edgeElement.setAttribute('stroke-dasharray', polylineLength);
      }
      animate(commitElement,
        [
          {opacity: '0'},
          {opacity: '1'},
        ],
        {delay: 500, duration: 500, fill: 'backwards'},
      );
      animate(commitElement.querySelector('circle'),
        [
          {r: '0'},
          {r: 'calc(var(--size) / 10)'},
        ],
        {delay: 500, duration: 500, fill: 'backwards'},
      );
      for (const edgeElement of commitElement.querySelectorAll('polyline')) {
        animate(edgeElement,
          [
            {strokeWidth: '0'},
            {strokeWidth: '2px'},
          ],
          {delay: 500, duration: 500, fill: 'backwards'},
        );
      }
    }
    else {
      commitElement.style.setProperty('--row', node.row);
      commitElement.style.setProperty('--column', node.path.columnIndex);
      commitElement.querySelector('.graph').style.color = color;
      // Edge animation
      const edgeElements = commitElement.querySelectorAll('.edge');
      for (const [index, edge] of edges.entries()) {
        const edgeElement = edgeElements[index];
        const oldPointsString = edgeElement.getAttribute('points');
        const oldPolylineLength = edgeElement.getAttribute('stroke-dasharray');
        edgeElement.setAttribute('points', edge.pointsString);
        const polylineLength = edgeElement.getTotalLength();
        edgeElement.setAttribute('stroke-dasharray', polylineLength);
        edgeElement.style.stroke = edge.strokeColor;
        edgeElement.replaceChildren();
        edgeElement.insertAdjacentHTML('beforeend', `<animate attributeName="points" values="${oldPointsString};${edge.pointsString}" dur="1s" repeatCount="1" keySplines="0.42 0.0 0.58 1.0" calcMode="spline">`);
        edgeElement.insertAdjacentHTML('beforeend', `<animate attributeName="stroke-dasharray" values="${oldPolylineLength};${polylineLength}" dur="1s" repeatCount="1" keySplines="0.42 0.0 0.58 1.0" calcMode="spline">`);
      }
      commitElement.querySelector('svg').setCurrentTime(0);
    }
    commitElementsToKeep.push(commitElement);
  }
  for (const [commitId, commitElement] of Object.entries(commitElementsByCommitId)) {
    if ( ! commitElementsToKeep.includes(commitElement)) {
      animate(commitElement,
        [
          {opacity: '1'},
          {opacity: '0'},
        ],
        {duration: 500},
      ).finished.then(() => commitElement.remove());
      animate(commitElement.querySelector('circle'),
        [
          {r: 'calc(var(--size) / 10)'},
          {r: '0'},
        ],
        {duration: 500},
      );
      for (const edgeElement of commitElement.querySelectorAll('polyline')) {
        animate(edgeElement,
          [
            {strokeWidth: '2px'},
            {strokeWidth: '0'},
          ],
          {duration: 500},
        );
      }
      delete commitElementsByCommitId[commitId];
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
