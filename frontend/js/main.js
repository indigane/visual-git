import * as git from './git-commands.js';
import { EMPTY_INDENT_LEVEL } from './commit.js';
import { asTextContent, requestIdlePromise } from './utils.js';


async function renderCommits(commits) {
  const commitsContainer = document.querySelector('.commits');
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
}

async function woop() {
  const commits = await git.log('--date-order', '--max-count=50000');
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
