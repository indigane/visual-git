export default class Commit {
  /** @type {string} The commit ID. */ id;
  /** @type {string[]} The parent commit IDs. */ parents;
  /** @type {string} The name of the author. */ authorName;
  /** @type {string} The email of the author. */ authorEmail;
  /** @type {Date} The date when the author made the commit. */ authorDate;
  /** @type {string} The name of the committer. */ committerName;
  /** @type {string} The email of the committer. */ committerEmail;
  /** @type {Date} The date when the committer committed the commit. */ committerDate;
  /** @type {string} The commit subject. Separated from the commit body by two newlines. */ subject;
  /** @type {string} The body of the commit message. Separated from the subject by two newlines. */ messageBody;
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
   * @param {string} [props.subject] The commit subject. Separated from the commit body by two newlines.
   * @param {string} [props.messageBody] The body of the commit message. Separated from the subject by two newlines.
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
