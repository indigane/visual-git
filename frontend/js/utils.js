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


export function splitOnce(inputString, separator) {
  const firstIndexOfSeparator = inputString.indexOf(separator);
  if (firstIndexOfSeparator === -1) {
    return [inputString, ''];
  }
  return [
    inputString.slice(0, firstIndexOfSeparator),
    inputString.slice(firstIndexOfSeparator + separator.length),
  ];
}


export function debounce(func, waitMilliseconds) {
  let timeout;
  return function debouncedFunc(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, waitMilliseconds);
  };
}


export function elementEvent(element, eventName, eventData) {
  element.dispatchEvent(
    new CustomEvent(eventName, {
      detail: eventData,
      bubbles: true,
      cancelable: true,
      composed: true,
    })
  );
}


export function documentEvent(eventName, eventData) {
  elementEvent(
    document.documentElement,
    eventName,
    eventData,
  );
}
