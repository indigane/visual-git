import socket from './git-interface/socket.js'
import * as git from './git-interface/commands.js';
import { SettingsElement } from './ui/settings.js';
import { GraphElement } from './ui/graph.js';
import { debounce } from './utils.js';

function main() {
  /** @type {SettingsElement} */ const settings = document.querySelector('vg-settings');
  /** @type {GraphElement} */ const graph = document.querySelector('vg-graph');

  getCommitsAndRender();
  settings.addEventListener('setting-change', getCommitsAndRender);

  socket.addEventListener('message', debounce(getCommitsAndRender, 50));

  async function getCommitsAndRender() {
    const maxCommits = settings.get('maxCommits');
    const commitVisibility = settings.get('commitVisibility');
    const flags = [
      '--date-order',
      `--max-count=${maxCommits}`,
    ];
    if (commitVisibility === 'allRefs') {
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

main();
