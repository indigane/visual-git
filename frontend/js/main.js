import * as git from './git-interface/commands.js';
import { GithubProvider } from './github-interface/github.js';
import { SettingsElement } from './ui/settings.js';
import { GraphElement } from './ui/graph.js';
import { debounce } from './utils.js';

function setUpLocal() {
  /** @type {SettingsElement} */ const settings = document.querySelector('vg-settings');
  /** @type {GraphElement} */ const graph = document.querySelector('vg-graph');

  getCommitsAndRender();
  settings.addEventListener('setting-change', getCommitsAndRender);

  /** @type {WebSocket} */
  const socket = new globalThis.ReconnectingWebSocket(`ws://${window.location.host}`);
  socket.addEventListener('message', debounce(getCommitsAndRender, 50));

  async function getCommitsAndRender() {
    const commitPageSize = settings.get('local__commitPageSize');
    const commitVisibility = settings.get('commitVisibility');
    const flags = [
      '--date-order',
      `--max-count=${commitPageSize}`,
    ];
    if (commitVisibility === 'allRefs') {
      // NOTE: --exclude=*dependabot*
      flags.push('--all');
    }
    if (commitVisibility === 'allRefsHistory') {
      flags.push('--all', '--reflog');
    }
    // const commits = await git.logCustom(...flags);
    const { commits, refs } = await git.logRaw(...flags);
    graph.renderCommits({
      commits: commits.slice(0, commitPageSize),
      refs,
    });
  }
}

function setUpGithub() {
  const githubPath = (
    window.location.pathname.includes('github.com')
    ? window.location.pathname.split('github.com/').pop()
    : window.location.hash.split('github.com/').pop()
  );
  const [repositoryOwner, repositoryName, ...remainingPath] = githubPath.split('/');

  /** @type {SettingsElement} */ const settings = document.querySelector('vg-settings');
  /** @type {GraphElement} */ const graph = document.querySelector('vg-graph');

  // TODO: Remove this when settings are implemented properly
  /** @type {HTMLElement} */ const currentBranchInput = settings.querySelector('[name="commitVisibility"][value="currentBranch"]');
  currentBranchInput.click();

  getCommitsAndRender();
  settings.addEventListener('setting-change', getCommitsAndRender);

  async function getCommitsAndRender() {
    const commitPageSize = settings.get('github__commitPageSize');
    const commitVisibility = settings.get('commitVisibility');
    const options = {
      commitPageSize,
      commitVisibility,
    };
    const github = new GithubProvider({ repositoryOwner, repositoryName, options });
    const { commits, refs } = await github.getWithNext();
    graph.renderCommits({
      commits: commits,
      refs,
    });
  }
}

function main() {
  if (window.location.pathname.includes('github.com') || window.location.hash.includes('github.com')) {
    setUpGithub();
  }
  else {
    setUpLocal();
  }
}

main();
