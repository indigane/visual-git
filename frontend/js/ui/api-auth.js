export class APIAuthElement extends HTMLElement {
  /** @type {HTMLTemplateElement} */
  template = document.querySelector('#api-auth-template');
  constructor({ authenticate, unauthenticate, readMoreUrl }) {
    super();
    this.appendChild(this.template.content.cloneNode(true));
    this.rateLimitRequestCountsElement = this.querySelector('.rate-limit-requests');
    this.authenticateButton = this.querySelector('.authenticate-button');
    this.unauthenticateButton = this.querySelector('.unauthenticate-button');
    this.querySelector('.read-more-link').setAttribute('href', readMoreUrl);
    this.authenticate = authenticate;
    this.unauthenticate = unauthenticate;
  }
  connectedCallback() {
    this.authenticateButton.addEventListener('click', async function handleAuthenticate() {
      await this.authenticate();
      this.classList.add('authenticated');
    });
    this.unauthenticateButton.addEventListener('click', async function handleUnauthenticate() {
      await this.unauthenticate();
      this.classList.remove('authenticated');
    });
  }
  setRateLimitStatus(usedCount, totalCount) {
    this.rateLimitRequestCountsElement.textContent = `${usedCount}/${totalCount}`;
  }
}

customElements.define('vg-apiauth', APIAuthElement);
