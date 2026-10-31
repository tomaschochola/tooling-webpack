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
