
import { elementEvent } from './utils.js';

const DEFAULT_SETTINGS = {
  'branchVisibility': 'allRefs',
  'maxCommits': 1000,
};

const validation = {
  'branchVisibility': ['currentBranch', 'allRefs', 'allRefsHistory'],
  'maxCommits': Number.isInteger,
};

export class SettingsContainerElement extends HTMLElement {
  constructor() {
    super();
    this.userSettings = {};
    this.repositorySettings = {};
  }
  connectedCallback() {
    const settings = this;
    this.addEventListener('change', function handleChange(event) {
      const inputElement = /** @type {HTMLInputElement} */ (this);
      const name = inputElement.getAttribute('name');
      const oldValue = settings.userSettings[name];
      const newValue = inputElement.value;
      settings.userSettings[name] = newValue;
      elementEvent(this, 'setting-change', { name, oldValue, newValue });
    });
  }
  get(name) {
    if (this.repositorySettings[name] !== undefined) {
      return this.repositorySettings[name];
    }
    if (this.userSettings[name] !== undefined) {
      return this.userSettings[name];
    }
    return DEFAULT_SETTINGS[name];
  }
  validate(name, value) {
    const validator = validation[name];
    if (validator === undefined) {
      console.warn(`Unknown setting ${name}`);
      return false;
    }
    else if (Array.isArray(validator)) {
      if (validator.includes(value)) {
        return true;
      }
      console.warn(`"${value}" is not a valid value for ${name}. Valid values: ${validator.join(', ')}`);
      return false;
    }
    else if (validator instanceof Function) {
      if (validator(value)) {
        return true;
      }
      console.warn(`"${value}" is not a valid value for ${name}.`);
      return false;
    }
  }
}

customElements.define('vg-settings', SettingsContainerElement);
