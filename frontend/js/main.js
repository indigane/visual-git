import * as git from './git-commands.js';
import { EMPTY_INDENT_LEVEL } from './commit.js';
import { asTextContent, requestIdlePromise } from './utils.js';


async function renderCommits(commits) {
  const commitsContainer = document.querySelector('.commits');
  const edgesContainer = document.querySelector('.edges');
  const edgeColors = ['#dd826f', '#8bacd2', '#bad56a', '#ae7fba', '#e8b765', '#f8ed73', '#bab6d8', '#f0cee5', '#a2d2c7'];
  const openEdges = [];
  const latestCommitsByIndentLevel = [];
  const maxCommits = 50000;
  const batchSize = 1000;
  for (const [index, commit] of commits.slice(0, maxCommits).entries()) {
    const isBatchSizeReached = index !== 0 && index % batchSize === 0;
    if (isBatchSizeReached) {
      updateMaxIndent();
      await requestIdlePromise(100);
    }
    const indentLevel = updateIndentLevels(commit);
    commitsContainer.insertAdjacentHTML('beforeend', `
    <div class="commit" style="--index: ${index}; --indent-level: ${indentLevel};" data-id="${commit.id}">
      <div class="graph">
        <svg>
          <circle>
        </svg>
      </div>
      <div class="message">${asTextContent(commit.subject)}</div>
    </div>
    `.trim());
    updateEdges(commit, index, indentLevel);
  }
  updateMaxIndent();

  function updateMaxIndent() {
    const maxIndent = latestCommitsByIndentLevel.length;
    commitsContainer.style.setProperty('--max-indent', maxIndent);
  }

  function updateIndentLevels(commit) {
    let resultIndentLevel = null;
    let firstEmptyIndentLevel = null;
    // We keep track of the latest rendered commit in each indent level,
    // so that we can render parents of that commit in the same indent level.
    for (const [indentLevel, latestCommit] of latestCommitsByIndentLevel.entries()) {
      if (latestCommit === EMPTY_INDENT_LEVEL) {
        // Keep track of the first empty indent level in case we need to render the commit in it.
        if (firstEmptyIndentLevel === null) {
          firstEmptyIndentLevel = indentLevel;
        }
        continue;
      }
      const positionInParents = latestCommit.parents?.indexOf(commit.id) ?? -1;
      const isPrimaryParent = positionInParents === 0;
      //const isSecondaryParent = positionInParents >= 1;
      // We will render the commit in the first indent level where the commit is the primary parent.
      if (isPrimaryParent && resultIndentLevel === null) {
        resultIndentLevel = indentLevel;
      }
      // For any other indent levels where the commit is the primary parent, if it is also the only parent,
      // we can set that indent level as empty to free it up for commits next in the iteration.
      else if (isPrimaryParent && latestCommit.parents.length === 1) {
        latestCommitsByIndentLevel[indentLevel] = EMPTY_INDENT_LEVEL;
      }
    }
    // If the commit was not found to be a parent of any already rendered commits,
    // then render it in the first empty indent level.
    if (resultIndentLevel === null) {
      if (firstEmptyIndentLevel === null) {
        firstEmptyIndentLevel = latestCommitsByIndentLevel.length;
      }
      resultIndentLevel = firstEmptyIndentLevel;
    }
    latestCommitsByIndentLevel[resultIndentLevel] = commit;
    return resultIndentLevel;
  }

  function updateEdges(commit, rowIndex, indentLevel) {
    const rowSize = 32;
    const indentSize = 32;
    const xOffset = indentSize / 2;
    const yOffset = rowSize / 2;
    updateOpenEdges();
    if (commit.parents) {
      for (const [parentIndex, parentId] of commit.parents.entries()) {
        const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        edgeElement._parentId = parentId;
        edgeElement._startPosition = [indentLevel, rowIndex];
        edgeElement._parentIndex = parentIndex;
        edgeElement._startColor = edgeColors[indentLevel % edgeColors.length];
        edgesContainer.appendChild(edgeElement);
        openEdges.unshift(edgeElement);
      }
    }
    updateOpenEdges();
    function updateOpenEdges() {
      for (const [edgeIndex, edgeElement] of openEdges.entries()) {
        const [startX, startY] = edgeElement._startPosition;
        const points = [];
        // Start point
        points.push(`${startX * indentSize + xOffset},${startY * rowSize + yOffset}`);
        const isEdgeEndCommit = edgeElement._parentId === commit.id;
        const isPrimaryParent = edgeElement._parentIndex === 0;
        let edgeOuterIndent = indentLevel;
        if (isEdgeEndCommit || isPrimaryParent) {
          edgeOuterIndent -= indentLevel;
        }
        // Corner on the same-ish row as start point
        points.push(`${(startX + edgeOuterIndent + edgeElement._parentIndex) * indentSize + xOffset},${startY * rowSize + yOffset + yOffset}`);
        // Corner on the same-ish row as end point
        points.push(`${(startX + edgeOuterIndent + edgeElement._parentIndex) * indentSize + xOffset},${(startY + (rowIndex - startY)) * rowSize + yOffset - yOffset}`);
        if (isEdgeEndCommit) {
          // End point
          const [endX, endY] = [indentLevel, rowIndex];
          points.push(`${endX * indentSize + xOffset},${endY * rowSize + yOffset}`);
          openEdges.splice(edgeIndex, 1);
        }
        edgeElement.setAttribute('points', [points].join(' '));
        edgeElement.style.stroke = isPrimaryParent ? edgeElement._startColor : edgeColors[indentLevel % edgeColors.length];
      }
    }
  }
}

async function woop() {
  // const commits = await git.logCustom('--date-order', '--max-count=50000');
  const commits = await git.logRaw('--date-order', '--max-count=50000');
  renderCommits(commits);
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
