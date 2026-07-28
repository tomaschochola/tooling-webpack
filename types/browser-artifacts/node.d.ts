export function generateBrowserArtifacts({ allowNetwork, entries, outputDirectory, projectDirectory, template, temporaryDirectory, timeout, }: {
    allowNetwork?: boolean | undefined;
    entries: any;
    outputDirectory: any;
    projectDirectory?: string | undefined;
    template?: string | undefined;
    temporaryDirectory?: string | undefined;
    timeout?: number | undefined;
}): Promise<void>;
export const browserArtifactDefaults: Readonly<{
    entries: readonly string[];
    script: string;
    stylesheet: string;
    template: string;
}>;
