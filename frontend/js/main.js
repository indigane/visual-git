import * as git from './git-commands.js';
import { EMPTY_INDENT_LEVEL } from './commit.js';
import { asTextContent, requestIdlePromise } from './utils.js';


async function renderCommits(commits) {
  const latestCommitsByIndentLevel = [];
  const batchSize = 100;
  for (const [index, commit] of commits.entries()) {
    const isBatchSizeReached = index !== 0 && index % batchSize === 0;
    if (isBatchSizeReached) {
      await requestIdlePromise(100);
    }
    const indentLevel = updateIndentLevels(commit);
    document.body.insertAdjacentHTML('beforeend', `
    <div class="commit" style="--indent-level: ${indentLevel};">
      <div class="message">${asTextContent(commit.subject)}</div>
    </div>
    `);
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
      const positionInParents = latestCommit.parents.indexOf(commit.id);
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
  const commits = await git.log('--date-order');
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
