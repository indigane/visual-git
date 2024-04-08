customElements.define('svg-icon', class extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = await fetch(this.getAttribute('src')).then(r => r.text());
  }
});
