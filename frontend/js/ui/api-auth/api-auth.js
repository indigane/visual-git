
import { loadWebComponentResources } from "../webcomponents.js";

const resources = loadWebComponentResources(import.meta.url);
const template = await resources.template;


export class APIAuthElement extends HTMLElement {
  /** @type {HTMLTemplateElement} */
  constructor({ authenticate, unauthenticate }) {
    super();
    this.appendChild(template.cloneNode(true));
    this.rateLimitRequestCountsElement = this.querySelector('.rate-limit-requests');
    this.authenticateButton = this.querySelector('.authenticate-button');
    this.unauthenticateButton = this.querySelector('.unauthenticate-button');
    this.authenticate = authenticate;
    this.unauthenticate = unauthenticate;
  }
  connectedCallback() {
    this.authenticateButton.addEventListener('click', async () => {
      await this.authenticate();
      this.classList.add('authenticated');
    });
    this.unauthenticateButton.addEventListener('click', async () => {
      await this.unauthenticate();
      this.classList.remove('authenticated');
    });
    document.addEventListener('rate-limit-updated', (/** @type {RateLimitEvent} */event) => {
      const { usedCount, totalCount } = event.detail;
      this.setRateLimitStatus(usedCount, totalCount);
    });
  }
  setRateLimitStatus(usedCount, totalCount) {
    this.rateLimitRequestCountsElement.textContent = `${usedCount}/${totalCount}`;
  }
}

customElements.define('vg-apiauth', APIAuthElement);
