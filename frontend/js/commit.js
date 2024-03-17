export class Commit {
  /** @type {string} The commit ID. */ id;
  /** @type {string[]} The parent commit IDs. */ parents;
  /** @type {string} The name of the author. */ authorName;
  /** @type {string} The email of the author. */ authorEmail;
  /** @type {Date} The date when the author made the commit. */ authorDate;
  /** @type {string} The name of the committer. */ committerName;
  /** @type {string} The email of the committer. */ committerEmail;
  /** @type {Date} The date when the committer committed the commit. */ committerDate;
  /** @type {string} The commit subject. */ subject;
  /** @type {string} The body of the commit message. */ messageBody;
  /** @type {string} Notes attached to the commit. */ notes;
  /**
   * @param {object} props Commit properties.
   * @param {string} props.id The commit ID.
   * @param {string[]} props.parents The parent commit IDs.
   * @param {string} [props.authorName] The name of the author.
   * @param {string} [props.authorEmail] The email of the author.
   * @param {Date} [props.authorDate] The date when the author made the commit.
   * @param {string} [props.committerName] The name of the committer.
   * @param {string} [props.committerEmail] The email of the committer.
   * @param {Date} [props.committerDate] The date when the committer committed the commit.
   * @param {string} [props.subject] The commit subject.
   * @param {string} [props.messageBody] The body of the commit message.
   * @param {string} [props.notes] Notes attached to the commit.
   */
  constructor({ ...props }) {
    this.id = props.id;
    this.parents = props.parents;
    this.authorName = props.authorName;
    this.authorEmail = props.authorEmail;
    this.authorDate = props.authorDate;
    this.committerName = props.committerName;
    this.committerEmail = props.committerEmail;
    this.committerDate = props.committerDate;
    this.subject = props.subject;
    this.messageBody = props.messageBody;
    this.notes = props.notes;
    Object.freeze(this);
  }
}


export class Reference {
  /** @type {string} The path to the reference relative to .git directory. */ fullRefPath;
  /** @type {string} The commit ID the reference points to. */ commitId;
  /** @type {string} The type of the reference. The basic types are `heads`, `tags` and `remotes`. Derived from the path: `refs/(type)/(name)`. */ refType;
  /** @type {string} The name part of the reference. Derived from the path: `refs/(type)/(name)`. */ refName;
  /** @type {boolean} Whether the HEAD reference is a symbolic reference pointing to this reference. Optional. Default: `false`. */ isPointedToByHEAD;
  /** @type {boolean} Whether the reference itself is symbolic. Meaning the reference points to another reference instead of directly to a commit ID. Optional. Default: `false`. */ isSymbolic;
  /**
   * @param {object} props Reference properties
   * @param {string} props.fullRefPath The path to the reference relative to .git directory.
   * @param {string} props.commitId The commit ID the reference points to.
   * @param {string} props.refType The type of the reference. The basic types are `heads`, `tags` and `remotes`. Derived from the path: `refs/(type)/(name)`.
   * @param {string} props.refName The name part of the reference. Derived from the path: `refs/(type)/(name)`.
   * @param {boolean} [props.isPointedToByHEAD] Whether the HEAD reference is a symbolic reference pointing to this reference. Optional. Default: `false`.
   * @param {boolean} [props.isSymbolic] Whether the reference itself is symbolic. Meaning the reference points to another reference instead of directly to a commit ID. Optional. Default: `false`.
   */
  constructor({ ...props }) {
    this.fullRefPath = props.fullRefPath;
    this.commitId = props.commitId;
    this.refType = props.refType;
    this.refName = props.refName;
    this.isPointedToByHEAD = props.isPointedToByHEAD ?? false;
    this.isSymbolic = props.isSymbolic ?? false;
  }
}
