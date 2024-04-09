const cachedIcons = {};

customElements.define('svg-icon', class extends HTMLElement {
  async connectedCallback() {
    const url = this.getAttribute('src');
    if (url in cachedIcons) {
      this.innerHTML = cachedIcons[url];
    } else {
      const iconSvg = await fetch(url).then(r => r.text());
      cachedIcons[url] = iconSvg;
      this.innerHTML = iconSvg;
    }
  }
});
