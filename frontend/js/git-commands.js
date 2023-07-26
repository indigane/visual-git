import { Commit } from './commit.js';

export async function executeGitCommand(args) {
  const response = await fetch('', {
    method: 'POST',
    body: JSON.stringify(args),
  });
  // TODO: Error handling, before continuing
  const commandOutput = await response.text();
  return commandOutput;
}

export async function log(...args) {
  // Indent by 1 space using %w line wrap format.
  // Indenting ensures that newlines in the user content can not break the parsing.
  // 0 = no wrap, only indent.
  // 0 = no indent on first line, because otherwise empty content is not indented, which breaks parsing.
  // 1 = indent rest of lines by 1 space.
  // ' ' = extra space to account for missing indent on first line.
  const indentOn = '%w(0,0,1)' + ' ';
  const indentOff = '%w(0,0,0)';

  const singleLineFields = [
    // Fields from raw commit
    '%H', // commit
    '%T', // tree
    '%P', // parents separated by space
    '%an', // author name
    '%ae', // author email
    '%aD', // author date
    '%cn', // committer name
    '%ce', // committer email
    '%cD', // committer date
    '%e', // encoding
    // Indirect fields
    '%D', // ref names separated by `, `
    '%S', // ref name by which the commit was reached (--source)
    '%G?', // signature validation status (optional, slow)
  ].join(
    // Indent all lines by one space to prevent empty fields from breaking split by \n\n\n and \n\n
    '%n' + ' '
  );

  const formatString = [
    // Use indent for multi-line content, so that newlines do not break the parsing.
    // An extra space is added before turning off the indent format, because empty last lines are not indented.
    singleLineFields,
    '%n%n',
    indentOn + '%s' + ' ' + indentOff, // indented subject
    '%n%n',
    indentOn + '%b' + ' ' + indentOff, // indented body
    '%n%n',
    // Indirect content, stored as separate blobs
    indentOn + '%N' + ' ' + indentOff, // indented notes (optional)
    '%n%n',
  ].join('');

  const commandArguments = ['log', '--decorate=full', `--format=${formatString}`, ...args];
  const commandOutput = await executeGitCommand(commandArguments);
  const commits = parseLogCustomFormat(commandOutput);
  return commits;
}

function parseLogCustomFormat(commandOutput) {
  const result = [];
  const commits = commandOutput.split('\n\n\n');
  for (const commit of commits) {
    const [
      fields,
      subject,
      messageBody,
      notes,
    ] = commit.split('\n\n').map(function removeExtraIndent(lines) {
      return lines.replaceAll('\n' + ' ', '\n');
    });
    const [
      commitId,
      treeId,
      parentIds,
      authorName,
      authorEmail,
      authorDate,
      committerName,
      committerEmail,
      committerDate,
      encoding,
      refNames,
      sourceRef,
      signatureVerificationStatus,
    ] = fields.split('\n');
    if ( ! commitId) {
      continue;
    }
    const parents = parentIds?.split(' ');
    result.push(
      new Commit({
        id: commitId,
        parents,
        authorName,
        authorEmail,
        authorDate: new Date(authorDate),
        committerName,
        committerEmail,
        committerDate: new Date(committerDate),
        subject,
        messageBody,
        notes,
      })
    );
  }
  return result;
}
