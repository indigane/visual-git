import { dataclass } from './utils.js';

export const Commit = dataclass(class {
  id;
  parents;
  author;
  authorDate;
  committer;
  committerDate;
});
