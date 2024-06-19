import * as git from './git-interface/commands.js';
import * as github from './github-interface/github.js';
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
    const maxCommits = settings.get('maxCommits');
    const commitVisibility = settings.get('commitVisibility');
    const flags = [
      '--date-order',
      `--max-count=${maxCommits}`,
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
      commits: commits.slice(0, maxCommits),
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

  getCommitsAndRender();
  settings.addEventListener('setting-change', getCommitsAndRender);

  async function getCommitsAndRender() {
    const maxCommits = settings.get('maxCommits');
    const commitVisibility = settings.get('commitVisibility');
    const { commits, refs } = await github.getCommitsAndRefs({ repositoryOwner, repositoryName });
    graph.renderCommits({
      commits: commits.slice(0, maxCommits),
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
