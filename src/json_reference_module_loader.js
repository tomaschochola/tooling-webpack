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

const outputQueryFlags = ['asset', 'inline', 'link', 'resource', 'sheet', 'source', 'style', 'text'];

function splitSuffix(suffix) {
  const fragmentIndex = suffix.indexOf('#');
  const queryAndFragment = fragmentIndex === -1 ? suffix : suffix.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? '' : suffix.slice(fragmentIndex);

  return {
    fragment,
    query: queryAndFragment.startsWith('?') ? queryAndFragment.slice(1) : '',
  };
}

export default function jsonReferenceModuleLoader() {
  throw new Error('The JSON reference module loader must run through its pitch phase.');
}

export function pitch() {
  const { assetQueryFlag, referenceQueryFlag } = this.getOptions();
  const referenceQuery = new URLSearchParams(this.resourceQuery);

  if (!referenceQuery.has(referenceQueryFlag)) {
    throw new Error('The JSON reference module loader received an invalid internal request.');
  }

  const { fragment, query } = splitSuffix(referenceQuery.get(referenceQueryFlag));
  const assetQuery = new URLSearchParams(query);

  for (const flag of outputQueryFlags) {
    assetQuery.delete(flag);
  }

  assetQuery.set('resource', '');
  assetQuery.set(assetQueryFlag, '');

  const request = this.utils.contextify(this.context, `${this.resourcePath}?${assetQuery.toString()}${fragment}`);

  return `export { default } from ${JSON.stringify(request)};\n`;
}

export const raw = true;
