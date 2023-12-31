import * as git from './git-commands.js';
import { asTextContent, requestIdlePromise } from './utils.js';


class Path {
  constructor({nodes}) {
    this.nodes = nodes;
    this.columnIndex = undefined;
  }

  getStartIndex() {
    return this.nodes[0].row;
  }

  getEndIndex() {
    return this.nodes.slice(-1)[0].row;
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
  }
}


async function renderCommits(commits) {
  const commitsContainer = document.querySelector('.commits');
  const edgesContainer = document.querySelector('.edges');
  const colors = ['#dd826f', '#8bacd2', '#bad56a', '#ae7fba', '#e8b765', '#f8ed73', '#bab6d8', '#f0cee5', '#a2d2c7'];

  // Collect paths of nodes
  const paths = [];
  const pathForCommitId = new Map();
  const nodeForCommitId = new Map();
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
  }

  // Select columns for paths
  const columns = [];
  for (const [pathIndex, path] of paths.entries()) {
    let selectedColumnIndex = undefined;
    for (const column of columns) {
      if (column.endRowIndex <= path.getStartIndex()) {
        column.endRowIndex = path.getEndIndex();
        selectedColumnIndex = column.columnIndex;
        break;
      }
    }
    if (selectedColumnIndex === undefined) {
      const column = {
        columnIndex: columns.length,
        endRowIndex: path.getEndIndex(),
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
    commitsContainer.insertAdjacentHTML('beforeend', `
    <div class="commit" style="--row: ${node.row}; --column: ${node.path.columnIndex};" data-id="${node.commit.id}">
      <div class="graph">
        <svg>
          <circle>
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
    for (const [parentIndex, parentId] of commit.parents.entries()) {
      const isPrimaryParent = parentIndex === 0;
      const parentNode = nodeForCommitId.get(parentId);
      if (node.path === parentNode.path) {
        // Edge is within the same path. Draw a simple line.
        const color = colors[node.path.columnIndex % colors.length];
        const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        edgesContainer.appendChild(edgeElement);
        const points = [];
        const startX = node.path.columnIndex;
        const startY = node.row;
        points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
        const endX = parentNode.path.columnIndex;
        const endY = parentNode.row;
        points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
        edgeElement.setAttribute('points', [points].join(' '));
        edgeElement.style.stroke = color;
      }
      else if (isPrimaryParent) {
        // Edge is converging. Draw a line with a corner.
        const color = colors[node.path.columnIndex % colors.length];
        const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        edgesContainer.appendChild(edgeElement);
        const points = [];
        const startX = node.path.columnIndex;
        const startY = node.row;
        points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
        const cornerX = node.path.columnIndex;
        const cornerY = parentNode.row;
        points.push(`${cornerX * columnWidth + xOffset},${cornerY * rowHeight}`);
        const endX = parentNode.path.columnIndex;
        const endY = parentNode.row;
        points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
        edgeElement.setAttribute('points', [points].join(' '));
        edgeElement.style.stroke = color;
      }
      else {
        // Edge is diverging. Draw a line with a corner.
        const color = colors[parentNode.path.columnIndex % colors.length];
        const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        edgesContainer.appendChild(edgeElement);
        const points = [];
        const startX = node.path.columnIndex;
        const startY = node.row;
        points.push(`${startX * columnWidth + xOffset},${startY * rowHeight + yOffset}`);
        const cornerX = parentNode.path.columnIndex;
        const cornerY = node.row;
        points.push(`${cornerX * columnWidth + xOffset},${cornerY * rowHeight + yOffset * 2}`);
        const endX = parentNode.path.columnIndex;
        const endY = parentNode.row;
        points.push(`${endX * columnWidth + xOffset},${endY * rowHeight + yOffset}`);
        edgeElement.setAttribute('points', [points].join(' '));
        edgeElement.style.stroke = color;
      }
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
