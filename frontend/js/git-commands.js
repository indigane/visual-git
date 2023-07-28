import * as parsers from './parsers.js';


export async function executeGitCommand(args) {
  const response = await fetch('', {
    method: 'POST',
    body: JSON.stringify(args),
  });
  // TODO: Error handling, before continuing
  const commandOutput = await response.text();
  return commandOutput;
}


export async function logCustom(...args) {
  const commandArguments = ['log', '--decorate=full', `--format=${parsers.customLogFormatString}`, ...args];
  const commandOutput = await executeGitCommand(commandArguments);
  const commits = parsers.parseLogCustomFormat(commandOutput);
  return commits;
}


export async function logRaw(...args) {
  const commandArguments = ['log', '--pretty=raw', ...args];
  const commandOutput = await executeGitCommand(commandArguments);
  const commits = parsers.parseLogRaw(commandOutput);
  return commits;
}
