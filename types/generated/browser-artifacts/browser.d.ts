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
export declare const browserArtifactRuntimeKey = "@tomaschochola/tooling-webpack/browser-artifacts";
export interface BrowserArtifactSize {
    readonly height: number;
    readonly width: number;
}
export interface BrowserArtifactPdfMargin {
    readonly bottom?: number | string;
    readonly left?: number | string;
    readonly right?: number | string;
    readonly top?: number | string;
}
export type BrowserArtifactPdfFormat = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'Ledger' | 'Legal' | 'Letter' | 'Tabloid';
export interface BrowserArtifactPdfOptions {
    readonly displayHeaderFooter?: boolean;
    readonly footerTemplate?: string;
    readonly format?: BrowserArtifactPdfFormat;
    readonly headerTemplate?: string;
    readonly height?: number | string;
    readonly landscape?: boolean;
    readonly margin?: BrowserArtifactPdfMargin;
    readonly media?: 'print' | 'screen';
    readonly outline?: boolean;
    readonly pageRanges?: string;
    readonly preferCSSPageSize?: boolean;
    readonly printBackground?: boolean;
    readonly scale?: number;
    readonly tagged?: boolean;
    readonly width?: number | string;
}
export interface BrowserArtifactPngOptions {
    readonly transparent?: boolean;
}
export interface BrowserArtifactElement<Input> extends HTMLElement {
    render(input: Input): Promise<void> | void;
}
export interface BrowserArtifactRenderContext {
    readonly root: HTMLElement;
    readonly mount: <Input>(element: BrowserArtifactElement<Input>, input: Input) => Promise<void>;
}
type BrowserArtifactRender = (context: BrowserArtifactRenderContext) => Promise<void> | void;
export interface BrowserArtifactDefinitions {
    readonly pdf: (output: string, viewport: BrowserArtifactSize, render: BrowserArtifactRender, options?: BrowserArtifactPdfOptions) => void;
    readonly png: (output: string, size: BrowserArtifactSize, render: BrowserArtifactRender, options?: BrowserArtifactPngOptions) => void;
}
export declare function defineBrowserArtifacts(definition: (artifacts: BrowserArtifactDefinitions) => void): void;
export {};
