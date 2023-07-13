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


export function requestIdlePromise(timeout = null) {
  return new Promise((resolve, _reject) => {
    requestIdleCallback(resolve, {timeout});
  });
}


export function asTextContent(input) {
  const tempElement = document.createElement('span');
  tempElement.textContent = input;
  return tempElement.innerHTML;
}
