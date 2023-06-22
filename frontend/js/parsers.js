import { Commit } from './commit.js'

export function parseLogRaw(commandOutput) {
  /*
  The raw git log format is headers and message body separated by \n\n,
  and each commit separated by \n\n. The headers follow `key value` pattern.
  In the message body each line, even empty lines, are prefixed by four spaces.
  For example:
  <commit one headers>
  \n\n
  <commit one message>
  \n\n
  <commit two headers>
  \n\n
  <commit two message>
  */
  return new Commit({
    id: 'id',
    parents: 'parents',
    author: 'author',
    authorDate: 'authorDate',
    committer: 'committer',
    committerDate: 'committerDate',
  });
}
