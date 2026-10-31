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
