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

import type { BrowserArtifactElement } from '../browser';
import stylesheet from './default-social-card.scss' with { type: 'css' };

export interface DefaultSocialCardInput {
  readonly image: string;
  readonly title: string;
}

function validateInput(input: unknown): asserts input is DefaultSocialCardInput {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Default social card input must be an object.');
  }

  if (!('image' in input) || typeof input.image !== 'string' || input.image === '') {
    throw new TypeError('Default social card image must be a non-empty source.');
  }

  if (!('title' in input) || typeof input.title !== 'string') {
    throw new TypeError('Default social card title must be a string.');
  }
}

export class DefaultSocialCard extends HTMLElement implements BrowserArtifactElement<DefaultSocialCardInput> {
  readonly #root: ShadowRoot;

  public constructor() {
    super();

    this.#root = this.attachShadow({
      mode: 'open',
    });
    this.#root.adoptedStyleSheets = [stylesheet];
  }

  public render(input: DefaultSocialCardInput): void {
    validateInput(input);

    const content = document.createElement('div');
    const image = document.createElement('img');
    const title = document.createElement('h1');

    image.alt = '';
    image.decoding = 'sync';
    image.fetchPriority = 'high';
    image.loading = 'eager';
    image.src = input.image;
    title.textContent = input.title;

    content.append(image, title);
    this.#root.replaceChildren(content);
  }
}

customElements.define('browser-artifact-default-social-card', DefaultSocialCard);
