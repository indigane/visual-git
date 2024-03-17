
import { elementEvent } from '../utils.js';

/**
 * @typedef {Object} Settings
 * @property {'currentBranch' | 'allRefs' | 'allRefsHistory'} commitVisibility
 * @property {number} maxCommits
 */

/** @type {Settings} */
const DEFAULT_SETTINGS = {
  'commitVisibility': 'allRefs',
  'maxCommits': 1000,
};

const validation = {
  'commitVisibility': ['currentBranch', 'allRefs', 'allRefsHistory'],
  'maxCommits': Number.isInteger,
};

export class SettingsElement extends HTMLElement {
  constructor() {
    super();
    /** @type {Partial<Settings>} */
    this.userSettings = {};
    /** @type {Partial<Settings>} */
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
  /**
   * Get the current setting value by name.
   * @template {keyof Settings} K
   * @param {K} name The setting name to get.
   * @returns {Settings[K]} The setting value.
   */
  get(name) {
    if (this.repositorySettings[name] !== undefined) {
      return /** @type {Settings[K]} */ (this.repositorySettings[name]);
    }
    if (this.userSettings[name] !== undefined) {
      return /** @type {Settings[K]} */ (this.userSettings[name]);
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

customElements.define('vg-settings', SettingsElement);
