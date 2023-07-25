import * as git from './git-commands.js';
import { asTextContent, requestIdlePromise } from './utils.js';


async function renderCommits(commits) {
  const latestCommitsByIndentLevel = [];
  const batchSize = 100;
  for (const [index, commit] of commits.entries()) {
    const isBatchSizeReached = index !== 0 && index % batchSize === 0;
    if (isBatchSizeReached) {
      await requestIdlePromise(100);
    }
    document.body.insertAdjacentHTML('beforeend', `
    <div class="commit">
      <div class="message">${asTextContent(commit.subject)}</div>
    </div>
    `);
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
