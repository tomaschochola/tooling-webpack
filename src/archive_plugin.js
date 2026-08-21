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

import { TarArchive, ZipArchive } from 'archiver';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const archiveExtensions = new Map([
  ['tar', 'tar'],
  ['tar.gz', 'tar.gz'],
  ['zip', 'zip'],
]);
const archiveTimestamp = new Date('1980-01-01T00:00:00.000Z');

function assertArchiveAssetName(name) {
  const suffixIndex = typeof name === 'string' ? name.search(/[?#]/u) : -1;
  const normalizedName = suffixIndex === -1 ? name : name.slice(0, suffixIndex);

  if (
    typeof normalizedName !== 'string' ||
    normalizedName.length === 0 ||
    normalizedName.includes('\\') ||
    normalizedName.includes('\0') ||
    normalizedName.startsWith('/') ||
    /^[a-z]:\//iu.test(normalizedName) ||
    normalizedName.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Cannot archive unsafe Webpack asset name "${name}".`);
  }

  return normalizedName;
}

function createArchive(format) {
  if (format === 'zip') {
    return new ZipArchive({ zlib: { level: 9 } });
  }

  return new TarArchive({
    gzip: format === 'tar.gz',
    gzipOptions: { level: 9 },
  });
}

function compareArchiveAssets(left, right) {
  if (left.name < right.name) {
    return -1;
  }

  if (left.name > right.name) {
    return 1;
  }

  return 0;
}

function resolvePath(path, context) {
  const filesystemPath = path instanceof URL ? fileURLToPath(path) : path;

  return isAbsolute(filesystemPath) ? filesystemPath : resolve(context, filesystemPath);
}

async function replaceFile(source, destination) {
  try {
    await rename(source, destination);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') {
      throw error;
    }

    await rm(destination, { force: true });
    await rename(source, destination);
  }
}

async function sha256(path) {
  const hash = createHash('sha256');

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

function toBuffer(source) {
  if (Buffer.isBuffer(source)) {
    return source;
  }

  if (typeof source === 'string') {
    return Buffer.from(source);
  }

  return Buffer.from(source.buffer, source.byteOffset, source.byteLength);
}

export class ArchivePlugin {
  #checksum;
  #destination;
  #directory;
  #format;

  constructor({ checksum = true, destination, directory, format = 'zip' } = {}) {
    if (!archiveExtensions.has(format)) {
      throw new TypeError('Archive format must be "tar", "tar.gz", or "zip".');
    }

    for (const [name, path] of [
      ['destination', destination],
      ['directory', directory],
    ]) {
      if (path !== undefined && !(path instanceof URL) && (typeof path !== 'string' || path.length === 0)) {
        throw new TypeError(`Archive ${name} must be a non-empty path or file URL.`);
      }
    }

    if (destination !== undefined && directory !== undefined) {
      throw new TypeError('Archive destination and directory cannot be configured together.');
    }

    if (typeof checksum !== 'boolean') {
      throw new TypeError('Archive checksum must be a boolean.');
    }

    this.#checksum = checksum;
    this.#destination = destination;
    this.#directory = directory;
    this.#format = format;
  }

  apply(compiler) {
    const assetsByCompilation = new WeakMap();

    compiler.hooks.thisCompilation.tap('ArchivePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'ArchivePlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT + 1,
        },
        () => {
          const assets = new Map();

          for (const asset of compilation.getAssets()) {
            const name = assertArchiveAssetName(asset.name);
            const source = toBuffer(asset.source.source());
            const existing = assets.get(name);

            if (existing !== undefined && !existing.source.equals(source)) {
              throw new Error(`Cannot archive conflicting Webpack assets as "${name}".`);
            }

            assets.set(name, { name, source });
          }

          assetsByCompilation.set(compilation, [...assets.values()].sort(compareArchiveAssets));
        },
      );
    });

    compiler.hooks.afterEmit.tapPromise('ArchivePlugin', async (compilation) => {
      const outputPath = compiler.options.output.path;
      const assets = assetsByCompilation.get(compilation);

      if (typeof outputPath !== 'string') {
        throw new Error('ArchivePlugin requires output.path to be configured.');
      }

      if (assets === undefined) {
        throw new Error('ArchivePlugin could not collect the compiled assets.');
      }

      const extension = archiveExtensions.get(this.#format);
      let destination;

      if (this.#destination === undefined) {
        const directory = this.#directory === undefined ? resolve(compiler.context, 'dist', compiler.options.mode ?? 'none') : resolvePath(this.#directory, compiler.context);
        destination = resolve(directory, `${basename(outputPath)}.${extension}`);
      } else {
        destination = resolvePath(this.#destination, compiler.context);
      }

      const temporaryDestination = `${destination}.${randomUUID()}.tmp`;
      const checksumDestination = `${destination}.sha256`;
      const temporaryChecksumDestination = `${checksumDestination}.${randomUUID()}.tmp`;
      const archive = createArchive(this.#format);
      let archivePublished = false;

      await mkdir(dirname(destination), { recursive: true });

      const output = createWriteStream(temporaryDestination, {
        flags: 'wx',
        mode: 0o600,
      });
      archive.pipe(output);

      try {
        for (const asset of assets) {
          archive.append(asset.source, {
            date: archiveTimestamp,
            mode: 0o644,
            name: asset.name,
          });
        }

        await Promise.all([archive.finalize(), finished(output)]);
        await chmod(temporaryDestination, 0o644);

        if (this.#checksum) {
          const checksum = await sha256(temporaryDestination);

          await writeFile(temporaryChecksumDestination, `${checksum}  ${basename(destination)}\n`, { flag: 'wx', mode: 0o600 });
          await chmod(temporaryChecksumDestination, 0o644);
        }

        await replaceFile(temporaryDestination, destination);
        archivePublished = true;

        if (this.#checksum) {
          await replaceFile(temporaryChecksumDestination, checksumDestination);
        } else {
          await rm(checksumDestination, { force: true });
        }
      } catch (error) {
        archive.abort();
        output.destroy();
        await Promise.all([
          rm(temporaryDestination, { force: true }),
          rm(temporaryChecksumDestination, { force: true }),
          ...(archivePublished ? [rm(destination, { force: true }), rm(checksumDestination, { force: true })] : []),
        ]);

        throw error;
      }
    });
  }
}
