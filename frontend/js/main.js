import * as git from './git-commands.js';
import { asTextContent, requestIdlePromise } from './utils.js';


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
      if (parentNode.row > endIndex) {
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


async function renderCommits(commits) {
  const commitsContainer = document.querySelector('.commits');
  const edgesContainer = document.querySelector('.edges');
  //const colors = ['#dd826f', '#8bacd2', '#bad56a', '#ae7fba', '#e8b765', '#f8ed73', '#bab6d8', '#f0cee5', '#a2d2c7'];
  //const colors = ['#68023F', '#008169', '#EF0096', '#00DCB5', '#FFCFE2', '#003C86', '#9400E6', '#009FFA', '#FF71FD', '#7CFFFA', '#6A0213', '#008607', '#F60239', '#00E307', '#FFDC3D'];
  const colors = ['#ee6677', '#228833', '#4477aa', '#ccbb44', '#66ccee', '#aa3377', '#bbbbbb'];

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
      return pathBLength - pathALength;
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
    // Node
    const node = nodeForCommitId.get(commit.id);
    const color = colors[node.path.columnIndex % colors.length];
    commitsContainer.insertAdjacentHTML('beforeend', `
    <div class="commit" style="--row: ${node.row}; --column: ${node.path.columnIndex};" data-id="${node.commit.id}">
      <div class="graph" style="color: ${color};">
        <svg>
          <circle></circle>
        </svg>
      </div>
      <div class="message">${asTextContent(node.commit.subject)}</div>
    </div>
    `.trim());
    // Edges
    const rowHeight = 32;
    const columnWidth = 32;
    const xOffset = columnWidth / 2;
    const yOffset = rowHeight / 2;
    const cornerOffset = rowHeight / 3;
    for (const [parentIndex, parentId] of commit.parents.entries()) {
      const isPrimaryParent = parentIndex === 0;
      const parentNode = nodeForCommitId.get(parentId);
      const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      const points = [];
      if (parentNode === undefined) {
        // TODO: Handle situation where parent commit has not been parsed.
        // There should be an edge drawn without a destination.
      }
      else if (node.path === parentNode.path) {
        // Edge is within the same path. Draw a simple line.
        const startX = node.path.columnIndex;
        const startY = node.row;
        points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
        const endX = parentNode.path.columnIndex;
        const endY = parentNode.row;
        points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
        edgeElement.style.stroke = colors[node.path.columnIndex % colors.length];
      }
      else if (isPrimaryParent) {
        // Edge is converging. Draw a line with a corner.
        const startX = node.path.columnIndex;
        const startY = node.row;
        points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
        const cornerX = node.path.columnIndex;
        const cornerY = parentNode.row;
        points.push(`${cornerX * columnWidth + xOffset},${cornerY * rowHeight + yOffset - cornerOffset}`);
        const endX = parentNode.path.columnIndex;
        const endY = parentNode.row;
        points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
        edgeElement.style.stroke = colors[node.path.columnIndex % colors.length];
      }
      else {
        // Edge is diverging. Draw a line with a corner.
        const startX = node.path.columnIndex;
        const startY = node.row;
        points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
        const cornerX = parentNode.path.columnIndex;
        const cornerY = node.row;
        points.push(`${cornerX * columnWidth + xOffset},${cornerY * rowHeight + yOffset + cornerOffset}`);
        const endX = parentNode.path.columnIndex;
        const endY = parentNode.row;
        points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
        edgeElement.style.stroke = colors[parentNode.path.columnIndex % colors.length];
      }
      edgesContainer.appendChild(edgeElement);
      edgeElement.setAttribute('points', [points].join(' '));
      // Gap
      const polylineLength = edgeElement.getTotalLength();
      edgeElement.setAttribute('stroke-dasharray', polylineLength);
    }
  }
}


async function woop() {
  // const commits = await git.logCustom('--date-order', '--max-count=50000');
  const commits = await git.logRaw('--date-order', '--max-count=50000');
  const maxCommits = 50000;
  renderCommits(commits.slice(0, maxCommits));
}

woop();

/*
const bar = new Commit({
  id: 'id',
  parents: 'parents',
  author: 'author',
  authorDate: 'authorDate',
  committer: 'committer',
  committerDate: 'committerDate',
});
console.log(bar);

const git = {
  log: async function() {
    //const commandArguments = ['log', '--all', '--oneline', '--reflog'];
    const commandArguments = ['log', '--all', '--pretty=raw'];
    const response = await fetch('', {
      method: 'POST',
      body: JSON.stringify(commandArguments),
    });
    const result = await response.text();
  },
};
*/
