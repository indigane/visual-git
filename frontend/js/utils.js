export const dataclass = baseClass => {
  const baseFields = new baseClass();
  return class {
    constructor(fields = {}) {
      Object.assign(this, baseFields);
      Object.seal(this);
      Object.assign(this, fields);
      Object.freeze(this);
    }
  };
};
