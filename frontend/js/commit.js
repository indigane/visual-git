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


export class Reference {
  constructor({ fullRefPath, commitId, refType, refName, isPointedToByHEAD }) {
    this.fullRefPath = fullRefPath;
    this.commitId = commitId;
    this.refType = refType;
    this.refName = refName;
    this.isPointedToByHEAD = isPointedToByHEAD ?? false;
  }
}
