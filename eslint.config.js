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

import { ESLintConfigBuilder, filePatterns } from '@tomaschochola/tooling-eslint';

const typescriptFiles = [...filePatterns.typescript, ...filePatterns.tsx];

export default new ESLintConfigBuilder()
    .addNodeGlobals({ files: filePatterns.scripts })
    .addGitIgnoreFile(import.meta.url)
    .addJavaScriptRecommendedRules({ files: filePatterns.scripts })
    .addTypeScriptRecommendedTypeCheckedRules({ files: typescriptFiles })
    // .addTypeScriptStrictTypeCheckedRules({ files: typescriptFiles })
    // .addTypeScriptOpinionatedTypeCheckedRules({ files: typescriptFiles })
    .enableTypeScriptProjectService({ files: typescriptFiles })
    // .addSonarJsRecommendedRules({ files: filePatterns.scripts })
    .toConfig();
