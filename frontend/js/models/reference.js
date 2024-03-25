export default class Reference {
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
