import { dataclass } from './utils.js';

export const Commit = dataclass(class {
  id;
  parents;
  authorName;
  authorEmail;
  authorDate;
  committerName;
  committerEmail;
  committerDate;
  subject;
  messageBody;
  notes;
});

export const EMPTY_INDENT_LEVEL = Symbol.for('EMPTY_INDENT_LEVEL');
