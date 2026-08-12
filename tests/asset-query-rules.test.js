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

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import webpack from 'webpack';
import { WebpackConfigBuilder } from '../src/index.js';

const execute = promisify(execFile);
const loaderDirectory = fileURLToPath(new URL('../node_modules/', import.meta.url));

async function compileSource(root, outputName, configure, mode = 'development', { allowErrors = false, runBundle = true, target = 'node' } = {}) {
  const outputPath = join(root, outputName);

  const builder = configure(
    new WebpackConfigBuilder({
      argv: {
        mode,
      },
    }),
  )
    .setEntries({
      index: join(root, 'index.js'),
    })
    .setOutputPath(outputPath);

  const base = builder.toConfig();

  const compiler = webpack({
    ...base,
    context: process.cwd(),
    devtool: false,
    mode,
    resolveLoader: {
      modules: [loaderDirectory, 'node_modules'],
    },
    target,
    output: {
      ...base.output,
      filename: 'bundle.cjs',
      path: outputPath,
    },
  });

  let statistics;

  try {
    statistics = await new Promise((resolvePromise, rejectPromise) => {
      compiler.run((error, result) => {
        if (error !== null && error !== undefined) {
          rejectPromise(error);

          return;
        }

        if (result === undefined) {
          rejectPromise(new Error('Webpack completed without build statistics.'));

          return;
        }

        resolvePromise(result);
      });
    });
  } finally {
    await new Promise((resolvePromise, rejectPromise) => {
      compiler.close((error) => {
        if (error !== null && error !== undefined) {
          rejectPromise(error);

          return;
        }

        resolvePromise();
      });
    });
  }

  if (!allowErrors) {
    assert.equal(
      statistics.hasErrors(),
      false,
      statistics.toString({
        all: false,
        errorDetails: true,
        errors: true,
      }),
    );
  }

  return {
    ...(runBundle && !statistics.hasErrors() ? await execute(process.execPath, [join(outputPath, 'bundle.cjs')]) : { stderr: '', stdout: '' }),
    outputPath,
    statistics,
  };
}

test('extracts compiled SCSS for default and link exports', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-link-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

  for (const [outputName, request] of [
    ['default', './style.scss'],
    ['link', './style.scss?link'],
  ]) {
    await writeFile(join(root, 'index.js'), `import '${request}';\n`);

    const { outputPath, stderr, stdout } = await compileSource(root, outputName, (builder) => builder.addStyleLoaders(), 'development', {
      runBundle: false,
      target: 'web',
    });

    assert.equal(stderr, '');
    assert.equal(stdout, '');
    assert.equal((await readdir(outputPath)).filter((filename) => filename.endsWith('.css')).length, 1);
  }
});

test('injects compiled SCSS as a style element', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-style-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), ["import './style.scss?style';", ''].join('\n'));
  await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

  const { outputPath, stderr, stdout } = await compileSource(root, 'style', (builder) => builder.addStyleLoaders(), 'development', {
    runBundle: false,
    target: 'web',
  });
  const bundle = await readFile(join(outputPath, 'bundle.cjs'), 'utf8');

  assert.equal(stderr, '');
  assert.equal(stdout, '');
  assert.match(bundle, /document\.createElement\('style'\)/u);
  assert.match(bundle, /\.example \{\\n {2}color: red;/u);
  assert.doesNotMatch(bundle, /\$color/u);
});

test('exports compiled SCSS as text', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-text-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import cssText from './style.scss?text'; process.stdout.write(cssText);\n");
  await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

  const { stderr, stdout } = await compileSource(root, 'text', (builder) => builder.addStyleLoaders());

  assert.equal(stderr, '');
  assert.match(stdout, /\.example\s*\{\s*color:\s*red;/u);
  assert.doesNotMatch(stdout, /\$color/u);
});

test('exports compiled SCSS as a constructable stylesheet', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-sheet-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), ["import sheet from './style.scss?sheet';", 'process.stdout.write(`${typeof sheet.replaceSync}\n${sheet.cssText}`);', ''].join('\n'));
  await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

  const { stderr, stdout } = await compileSource(root, 'sheet', (builder) => builder.addStyleLoaders());

  assert.equal(stderr, '');
  assert.match(stdout, /^function\n/u);
  assert.match(stdout, /\.example\s*\{\s*color:\s*red;/u);
  assert.doesNotMatch(stdout, /\$color/u);
});

test('exports stylesheet source through the generic asset query', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-queries-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  const source = '$color: red;\n\n.example {\n  color: $color;\n}\n';

  await writeFile(join(root, 'index.js'), "import source from './style.scss?source'; process.stdout.write(source);\n");
  await writeFile(join(root, 'style.scss'), source);

  const { stderr, stdout } = await compileSource(root, 'source', (builder) => builder.addAssetQueryRules().addStyleLoaders());

  assert.equal(stderr, '');
  assert.equal(stdout, source);
});

test('rejects the unsupported raw stylesheet query', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-stylesheet-raw-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import './style.scss?raw';\n");
  await writeFile(join(root, 'style.scss'), '$color: red;\n\n.example {\n  color: $color;\n}\n');

  const { statistics } = await compileSource(root, 'raw', (builder) => builder.addAssetQueryRules().addStyleLoaders(), 'development', {
    allowErrors: true,
    runBundle: false,
  });

  assert.equal(statistics.hasErrors(), true);
});

test('imports HTML through html-loader without a resource query', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-html-loader-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import htmlSource from './page.html'; process.stdout.write(htmlSource);\n");
  await writeFile(join(root, 'page.html'), '<h1>Example</h1>\n');

  const { stderr, stdout } = await compileSource(root, 'html', (builder) => builder.addHtmlLoader());

  assert.equal(stderr, '');
  assert.equal(stdout, '<h1>Example</h1>\n');
});

test('does not process PHP through html-loader', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-php-loader-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import './page.php';\n");
  await writeFile(join(root, 'page.php'), '<h1>Example</h1>\n');

  const { statistics } = await compileSource(root, 'php', (builder) => builder.addHtmlLoader(), 'development', {
    allowErrors: true,
    runBundle: false,
  });

  assert.equal(statistics.hasErrors(), true);
});

test('exports template HTML through the source asset query unchanged', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-template-source-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  const source = '<section data-ref="example">\n  <img src="./image.svg" />\n</section>\n';

  await writeFile(join(root, 'index.js'), "import templateSource from './page.template.html?source'; process.stdout.write(templateSource);\n");
  await writeFile(join(root, 'page.template.html'), source);
  await writeFile(join(root, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg" />\n');

  const { stderr, stdout } = await compileSource(root, 'template', (builder) => builder.addAssetQueryRules().addHtmlLoader());

  assert.equal(stderr, '');
  assert.equal(stdout, source);
});

test('does not retain the template query contract', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-template-query-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  await writeFile(join(root, 'index.js'), "import './page.template.html?template';\n");
  await writeFile(join(root, 'page.template.html'), '<section>Example</section>\n');

  const { statistics } = await compileSource(root, 'template', (builder) => builder.addAssetQueryRules().addHtmlLoader(), 'development', {
    allowErrors: true,
    runBundle: false,
  });

  assert.equal(statistics.hasErrors(), true);
});

test('optimizes inline SVG without rasterizing it', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'tooling-webpack-svg-minimizer-'));

  context.after(async () => {
    await rm(root, {
      force: true,
      recursive: true,
    });
  });

  const source = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">',
    '  <!-- This comment and whitespace are intentionally removable. -->',
    '  <rect width="100" height="100" fill="#ff0000" />',
    '</svg>',
    '',
  ].join('\n');

  await writeFile(join(root, 'index.js'), "import image from './image.svg?inline'; process.stdout.write(image);\n");
  await writeFile(join(root, 'image.svg'), source);

  const { stderr, stdout } = await compileSource(root, 'svg-minimizer', (builder) => builder.addAssetQueryRules().addImageMinimizer(), 'production');

  assert.equal(stderr, '');
  assert.match(stdout, /^data:image\/svg\+xml;base64,/u);

  const optimized = Buffer.from(stdout.slice(stdout.indexOf(',') + 1), 'base64').toString();

  assert.match(optimized, /^<svg\b/u);
  assert.doesNotMatch(optimized, /intentionally removable/u);
  assert.ok(Buffer.byteLength(optimized) < Buffer.byteLength(source));
});
