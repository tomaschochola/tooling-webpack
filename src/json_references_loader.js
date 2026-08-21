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

function assertPlainObject(value, name) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }

  return value;
}

export function normalizeJsonReferences(references) {
  if (!Array.isArray(references) || references.length === 0) {
    throw new TypeError('JSON references must be a non-empty array.');
  }

  const paths = new Set();

  return references.map((reference, referenceIndex) => {
    assertPlainObject(reference, `JSON reference at index ${referenceIndex}`);

    if (!Array.isArray(reference.path) || reference.path.length === 0 || reference.path.some((segment) => typeof segment !== 'string' || segment.length === 0)) {
      throw new TypeError(`JSON reference path at index ${referenceIndex} must be a non-empty array of non-empty strings.`);
    }

    if (reference.required !== undefined && typeof reference.required !== 'boolean') {
      throw new TypeError(`JSON reference required option at index ${referenceIndex} must be a boolean.`);
    }

    const path = [...reference.path];
    const pathIdentity = JSON.stringify(path);

    if (paths.has(pathIdentity)) {
      throw new TypeError(`JSON reference path at index ${referenceIndex} is duplicated.`);
    }

    paths.add(pathIdentity);

    return {
      path,
      required: reference.required ?? true,
    };
  });
}

function formatPath(segments) {
  return segments.reduce((path, segment) => (/^(?:0|[1-9]\d*)$/u.test(segment) ? `${path}[${segment}]` : `${path}.${segment}`), '$');
}

function collectLocations(value, path, required, referencePath, locations, segments = []) {
  if (path.length === 0) {
    return;
  }

  if (typeof value !== 'object' || value === null) {
    if (required) {
      throw new TypeError(`JSON reference ${referencePath} cannot traverse ${formatPath(segments)}.`);
    }

    return;
  }

  const [segment, ...remainingPath] = path;
  let keys = [];

  if (segment === '*') {
    keys = Object.keys(value);
  } else if (Object.hasOwn(value, segment)) {
    keys = [segment];
  }

  if (keys.length === 0) {
    if (required) {
      throw new TypeError(`JSON reference ${referencePath} does not match ${formatPath([...segments, segment])}.`);
    }

    return;
  }

  for (const key of keys) {
    if (remainingPath.length === 0) {
      locations.push({
        container: value,
        key,
        path: formatPath([...segments, key]),
      });
    } else {
      collectLocations(value[key], remainingPath, required, referencePath, locations, [...segments, key]);
    }
  }
}

function splitReference(reference) {
  const fragmentIndex = reference.indexOf('#');
  const pathAndQuery = fragmentIndex === -1 ? reference : reference.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? '' : reference.slice(fragmentIndex);
  const queryIndex = pathAndQuery.indexOf('?');

  return {
    fragment,
    path: queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex),
    query: queryIndex === -1 ? '' : pathAndQuery.slice(queryIndex),
  };
}

function isExternalReference(reference) {
  return reference.startsWith('#') || reference.startsWith('//') || /^data:/iu.test(reference) || /^https?:/iu.test(reference);
}

function assertLocalReference(reference, path) {
  if (reference.length === 0) {
    throw new TypeError(`JSON reference ${path} must not be empty.`);
  }

  if (/^[a-z][a-z0-9+.-]*:/iu.test(reference)) {
    throw new TypeError(`JSON reference ${path} uses an unsupported URL scheme.`);
  }
}

function decodeLocalPath(path, referencePath) {
  try {
    return decodeURI(path);
  } catch {
    throw new TypeError(`JSON reference ${referencePath} contains invalid URL encoding.`);
  }
}

function detectFormatting(source) {
  const indentation = /(?:\r?\n)([\t ]+)"/u.exec(source)?.[1];

  return {
    finalNewline: /\r?\n$/u.test(source),
    indentation,
    newline: source.includes('\r\n') ? '\r\n' : '\n',
  };
}

function serializeJson(value, source) {
  const { finalNewline, indentation, newline } = detectFormatting(source);
  let serialized = JSON.stringify(value, null, indentation);

  if (newline !== '\n') {
    serialized = serialized.replaceAll('\n', newline);
  }

  return finalNewline ? `${serialized}${newline}` : serialized;
}

function claimLocation(location, visitedLocations) {
  let visitedKeys = visitedLocations.get(location.container);

  if (visitedKeys === undefined) {
    visitedKeys = new Set();
    visitedLocations.set(location.container, visitedKeys);
  }

  if (visitedKeys.has(location.key)) {
    throw new TypeError(`JSON reference paths overlap at ${location.path}.`);
  }

  visitedKeys.add(location.key);
}

function getImportModuleOptions(loaderContext) {
  const publicPath = loaderContext._compiler.root.options.output.publicPath;

  return {
    publicPath: typeof publicPath === 'string' && publicPath !== 'auto' ? publicPath : getAutomaticPublicPath(loaderContext),
  };
}

function getAutomaticPublicPath(loaderContext) {
  const filename = loaderContext._module?.generatorOptions?.filename ?? loaderContext._compiler.root.options.output.assetModuleFilename;

  if (typeof filename !== 'string') {
    throw new TypeError('Automatic public path requires a string JSON asset filename.');
  }

  const segments = filename.split('/').slice(0, -1);

  if (filename.startsWith('/') || segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..' || segment.includes('[') || segment.includes(']'))) {
    throw new TypeError('Automatic public path requires a JSON asset filename with a static relative directory.');
  }

  return '../'.repeat(segments.length);
}

async function replaceLocation(loaderContext, location, referenceQueryFlag, resolveReference) {
  const reference = location.container[location.key];

  if (typeof reference !== 'string') {
    throw new TypeError(`JSON reference ${location.path} must be a string.`);
  }

  if (isExternalReference(reference)) {
    return;
  }

  assertLocalReference(reference, location.path);

  const { fragment, path: requestPath, query } = splitReference(reference);

  if (requestPath.length === 0) {
    throw new TypeError(`JSON reference ${location.path} must include a local path.`);
  }

  const resolvedPath = await resolveReference(loaderContext.context, decodeLocalPath(requestPath, location.path));
  const suffix = `${query}${fragment}`;
  const request = `${resolvedPath}?${referenceQueryFlag}=${encodeURIComponent(suffix)}`;
  const importedModule = await loaderContext.importModule(request, getImportModuleOptions(loaderContext));
  const emittedReference = importedModule?.default ?? importedModule;

  if (typeof emittedReference !== 'string') {
    throw new TypeError(`JSON reference ${location.path} did not resolve to an emitted asset URL.`);
  }

  location.container[location.key] = emittedReference;
}

async function replaceReferences(loaderContext, document, references, referenceQueryFlag, resolveReference) {
  const visitedLocations = new WeakMap();

  for (const { path, required } of references) {
    const referencePath = formatPath(path);
    const locations = [];

    collectLocations(document, path, required, referencePath, locations);

    for (const location of locations) {
      claimLocation(location, visitedLocations);
      await replaceLocation(loaderContext, location, referenceQueryFlag, resolveReference);
    }
  }
}

export default async function jsonReferencesLoader(source) {
  const { referenceQueryFlag, references, resolve: resolveOptions = {} } = this.getOptions();

  assertPlainObject(resolveOptions, 'JSON reference resolve option');

  const normalizedReferences = normalizeJsonReferences(references);
  const sourceText = source.toString();
  const document = JSON.parse(sourceText);

  if (typeof document !== 'object' || document === null) {
    throw new TypeError('JSON reference source must contain an object or array.');
  }

  const resolveReference = this.getResolve({
    ...resolveOptions,
    dependencyType: 'url',
    preferRelative: true,
  });

  await replaceReferences(this, document, normalizedReferences, referenceQueryFlag, resolveReference);

  return serializeJson(document, sourceText);
}
