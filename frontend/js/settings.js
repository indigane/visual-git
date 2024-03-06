
import { elementEvent } from './utils.js';

const DEFAULT_SETTINGS = {
  'branchVisibility': 'currentBranch',
  'maxCommits': 50000,
};

const validation = {
  'branchVisibility': ['currentBranch', 'allRefs', 'allRefsHistory'],
  'maxCommits': Number.isInteger,
};

class SettingsContainerElement extends HTMLElement {
  constructor() {
    super();
    this.userSettings = {};
    this.repositorySettings = {};
  }
  connectedCallback() {
    this.addEventListener('change', function handleChange(event) {
      const name = event.target.getAttribute('name');
      const oldValue = this.userSettings[name];
      const newValue = event.target.value;
      this.userSettings[name] = newValue;
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
      console.warning(`Unknown setting ${name}`);
      return false;
    }
    else if (Array.isArray(validator)) {
      if (validator.includes(value)) {
        return true;
      }
      console.warning(`"${value}" is not a valid value for ${name}. Valid values: ${validator.join(', ')}`);
      return false;
    }
    else if (validator instanceof Function) {
      if (validator(value)) {
        return true;
      }
      console.warning(`"${value}" is not a valid value for ${name}.`);
      return false;
    }
  }
}

customElements.define('vg-settings', SettingsContainerElement);
