/*
 * <py-icon name="check"> draws #i-check from the sprite in index.html; names starting with "s-" are status
 * icons (#s-review). Same element name and attribute as the Angular component, so markup ports unchanged.
 */
class PyIcon extends HTMLElement {
  static get observedAttributes() { return ['name']; }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const name = this.getAttribute('name') || '';
    const href = name.startsWith('s-') ? `#${name}` : `#i-${name}`;
    this.innerHTML = `<svg aria-hidden="true"><use href="${href}"></use></svg>`;
  }
}
customElements.define('py-icon', PyIcon);
