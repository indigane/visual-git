import { Commit } from './commit.js';
import { splitOnce } from './utils.js';


export const customLogFormatString = (() => {
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
    '', //'%G?', // signature validation status (optional, slow)
  ].join(
    // Indent all lines by one space to prevent empty fields from breaking split by \n\n\n and \n\n
    '%n' + ' '
  );

  const formatString = [
    // Use indent for multi-line content, so that newlines do not break the parsing.
    // An extra space is added before turning off the indent format, because the last line is not indented if empty.
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

  return formatString;
})();


export function parseLogCustomFormat(commandOutput) {
  const commits = [];
  const commitChunks = commandOutput.split('\n\n\n');
  for (const commit of commitChunks) {
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
    commits.push(
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
  return commits;
}


// Example of a minimal person line is `n <> 0 +0000`.
// Empty name is not allowed by git.
// Multiple `<` and `>` are not allowed by git.
const LOG_RAW_PERSON_REGEX = /^(?<name>.+) <(?<email>.*)> (?<timestamp>.+) (?<time_offset>.+)$/;

export function parseLogRaw(commandOutput) {
  const commits = [];
  // Git log in raw format is headers and message separated by two newlines.
  // Each commit is also separated by two newlines.
  const commitParts = commandOutput.split('\n\n');
  // Iterate commit parts in pairs of two.
  for (let i = 0; i < commitParts.length; i += 2) {
    const headers = commitParts[i];
    const message = commitParts[i + 1];
    const {
      id,
      parents,
      authorName,
      authorEmail,
      authorDate,
      committerName,
      committerEmail,
      committerDate,
    } = parseLogRawHeaders(headers);
    const {
      subject,
      messageBody,
    } = parseLogRawMessage(message);
    commits.push(
      new Commit({
        id,
        parents,
        authorName,
        authorEmail,
        authorDate,
        committerName,
        committerEmail,
        committerDate,
        subject,
        messageBody,
      })
    );
  }
  return commits;
}

function parseLogRawHeaders(headerChunk) {
  const headers = {
    id: undefined,
    parents: [],
    authorName: undefined,
    authorEmail: undefined,
    authorDate: undefined,
    committerName: undefined,
    committerEmail: undefined,
    committerDate: undefined,
  };
  const headerLines = headerChunk.split('\n');
  for (const line of headerLines) {
    const [headerName, headerValue] = splitOnce(line, ' ');
    if (headerName === 'commit') {
      headers.id = headerValue;
    }
    else if (headerName === 'parent') {
      headers.parents.push(headerValue);
    }
    else if (headerName === 'author') {
      const { name, email, timestamp, _timeOffset } = LOG_RAW_PERSON_REGEX.exec(headerValue).groups;
      headers.authorName = name;
      headers.authorEmail = email;
      headers.authorDate = new Date(timestamp * 1000);
    }
    else if (headerName === 'committer') {
      const { name, email, timestamp, _timeOffset } = LOG_RAW_PERSON_REGEX.exec(headerValue).groups;
      headers.committerName = name;
      headers.committerEmail = email;
      headers.committerDate = new Date(timestamp * 1000);
    }
  }
  return headers;
}

function parseLogRawMessage(messageChunk) {
  // Each line in raw message is indented by four spaces.
  const message = (
    messageChunk
    // Remove indent from the first line.
    .slice(4)
    // Remove indent from rest of the lines.
    .replaceAll('\n    ', '\n')
  );
  // Split at the first `\n\n` which git considers to be the separator between the subject and body.
  const [subject, messageBody] = splitOnce(message, '\n\n');
  return { subject, messageBody };
}
