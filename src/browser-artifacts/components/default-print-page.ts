/**
 * @file
 * @author Tomáš Chochola <tomaschochola@tomaschochola.cz>
 * @copyright © 2026 Tomáš Chochola <tomaschochola@tomaschochola.cz>
 *
 * @license CC-BY-ND-4.0
 *
 * @see {@link https://creativecommons.org/licenses/by-nd/4.0/} License
 * @see {@link https://github.com/tomaschochola} GitHub Profile
 * @see {@link https://github.com/sponsors/tomaschochola} GitHub Sponsors
 */

import stylesheet from './default-print-page.scss' with { type: 'css' };

export class DefaultPrintPage extends HTMLElement {
  public constructor() {
    super();

    const root = this.attachShadow({
      mode: 'open',
    });
    const main = document.createElement('main');
    const slot = document.createElement('slot');

    main.append(slot);
    root.adoptedStyleSheets = [stylesheet];
    root.replaceChildren(main);
  }
}

customElements.define('browser-artifact-default-print-page', DefaultPrintPage);
