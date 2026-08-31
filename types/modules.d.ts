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

declare module '*?source' {
    const value: string;

    export default value;
}

declare module '*&source' {
    const value: string;

    export default value;
}

declare module '*?resource' {
    const value: string;

    export default value;
}

declare module '*&resource' {
    const value: string;

    export default value;
}

declare module '*?inline' {
    const value: string;

    export default value;
}

declare module '*&inline' {
    const value: string;

    export default value;
}

declare module '*?asset' {
    const value: string;

    export default value;
}

declare module '*&asset' {
    const value: string;

    export default value;
}

declare module '*.scss' {}

declare module '*.sass' {}

declare module '*.css' {}

declare module '*.scss?link' {}

declare module '*.sass?link' {}

declare module '*.css?link' {}

declare module '*.scss?style' {}

declare module '*.sass?style' {}

declare module '*.css?style' {}

declare module '*.scss?sheet' {
    const value: CSSStyleSheet;

    export default value;
}

declare module '*.sass?sheet' {
    const value: CSSStyleSheet;

    export default value;
}

declare module '*.css?sheet' {
    const value: CSSStyleSheet;

    export default value;
}

declare module '*.scss?text' {
    const value: string;

    export default value;
}

declare module '*.sass?text' {
    const value: string;

    export default value;
}

declare module '*.css?text' {
    const value: string;

    export default value;
}

declare module '*.html' {
    const value: string;

    export default value;
}
