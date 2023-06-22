import * as parsers from './parsers.js';

class GitCommand {
  constructor({args, parser} = {}) {
    this.args = args;
    this.parser = parser;
  }
  async execute() {
    const response = await fetch('', {
      method: 'POST',
      body: JSON.stringify(this.args),
    });
    const commandOutput = await response.text();
    return this.parser(commandOutput);
  }
}

const git = {
  log: new GitCommand({args: ['log', '--all', '--pretty=raw'], parser: parsers.parseLogRaw}),
};

console.log(await git.log.execute());

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
