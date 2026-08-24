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

const robotsMetaPattern = /<meta\b(?=[^>]*\sname\s*=\s*(?:"robots"|'robots'|robots(?=[\s/>])))[^>]*>/gi;

function escapeHtmlAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function applyRobotsMeta(html, content, filename) {
  const meta = `<meta name="robots" content="${escapeHtmlAttribute(content)}" />`;

  let found = false;

  const updatedHtml = html.replace(robotsMetaPattern, () => {
    if (found) {
      return '';
    }

    found = true;

    return meta;
  });

  if (found) {
    return updatedHtml;
  }

  if (!/<\/head\s*>/i.test(updatedHtml)) {
    throw new Error(`Unable to inject robots metadata into "${filename}": missing </head>.`);
  }

  return updatedHtml.replace(/<\/head\s*>/i, `${meta}</head>`);
}

export class RobotsPlugin {
  #metaContent;
  #robotsText;

  constructor({
    indexable = false,
    metaContent = indexable ? 'index, follow' : 'noindex, nofollow, nosnippet, noimageindex',
    robotsText = 'User-agent: *\nAllow: /\n',
  } = {}) {
    if (typeof indexable !== 'boolean') {
      throw new TypeError('Robots indexability must be a boolean.');
    }

    this.#metaContent = metaContent;
    this.#robotsText = robotsText;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap('RobotsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RobotsPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        () => {
          for (const asset of compilation.getAssets()) {
            if (!/\.html?$/i.test(asset.name)) {
              continue;
            }

            const html = asset.source.source().toString();
            const updatedHtml = applyRobotsMeta(html, this.#metaContent, asset.name);

            compilation.updateAsset(asset.name, new compiler.webpack.sources.RawSource(updatedHtml));
          }

          const robotsSource = new compiler.webpack.sources.RawSource(this.#robotsText);

          if (compilation.getAsset('robots.txt') === undefined) {
            compilation.emitAsset('robots.txt', robotsSource);

            return;
          }

          compilation.updateAsset('robots.txt', robotsSource);
        },
      );
    });
  }
}
