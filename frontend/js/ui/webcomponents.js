/**
 * Loads a stylesheet based on the web component module url and places it in the document stylesheets.
 *
 * @param {string} webComponentModuleUrl - `import.meta.url` of the web component module.
 * @example
 * const stylesheet = adoptWebComponentStyleSheet(import.meta.url);
 */
export function adoptWebComponentStyleSheet(webComponentModuleUrl) {
  const urlObject = new URL(webComponentModuleUrl);
  const basePathname = urlObject.pathname.slice(0, urlObject.pathname.lastIndexOf('.'));
  urlObject.pathname = `${basePathname}.css`;
  return adoptStyleSheet(urlObject.href);
}


/**
 * Loads an HTML template based on the web component module url and returns it as a `DocumentFragment`.
 *
 * @param {string} webComponentModuleUrl - `import.meta.url` of the web component module.
 * @returns {Promise<NodeListOf<HTMLTemplateElement>>} A promise that resolves to the list of templates found in the HTML file.
 * @example
 * const templates = await loadWebComponentTemplate(import.meta.url);
 */
export function loadWebComponentTemplates(webComponentModuleUrl) {
  const urlObject = new URL(webComponentModuleUrl);
  const basePathname = urlObject.pathname.slice(0, urlObject.pathname.lastIndexOf('.'));
  urlObject.pathname = `${basePathname}.html`;
  const documentFragmentPromise = loadHTML(urlObject.href);
  return documentFragmentPromise.then((documentFragment) => documentFragment.querySelectorAll('template'));
}


/** @returns {Promise<CSSStyleSheet | null>} */
async function adoptStyleSheet(url) {
  const linkElement = document.createElement('link');
  linkElement.rel = 'stylesheet';
  linkElement.href = url;
  const styleSheetPromise = new Promise((resolve, reject) => {
    linkElement.addEventListener('load', () => resolve(linkElement.sheet));
    linkElement.addEventListener('error', reject);
  });
  document.head.appendChild(linkElement);
  return styleSheetPromise;
}


/** @returns {Promise<DocumentFragment>} */
async function loadHTML(url) {
  const response = await fetch(url);
  const text = await response.text();
  const documentFragment = document.createRange().createContextualFragment(text);
  return documentFragment;
}
