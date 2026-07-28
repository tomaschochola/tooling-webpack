export * from "./browser-artifacts/browser.ts";
export class RobotsPlugin {
    constructor({ indexable, metaContent, robotsFilename, robotsText, }?: {
        indexable?: boolean | undefined;
        metaContent?: string | undefined;
        robotsFilename?: string | undefined;
        robotsText?: string | undefined;
    });
    apply(compiler: any): void;
    #private;
}
export class WebpackConfigBuilder {
    constructor({ env, argv }?: {
        env?: {} | undefined;
        argv?: {} | undefined;
    });
    get webpackBuild(): any;
    get webpackWatch(): any;
    get webpackServe(): any;
    get webpackMode(): any;
    get isProductionMode(): boolean;
    get nodeEnv(): any;
    get appEnv(): any;
    get appName(): any;
    get appVersion(): any;
    enableCssExperiment(): this;
    disableCssExperiment(): this;
    enableHtmlExperiment(): this;
    disableHtmlExperiment(): this;
    enableTypeScriptExperiment(): this;
    disableTypeScriptExperiment(): this;
    setPublicPath(publicPath: any): this;
    setEcmaVersion(ecmaVersion: any): this;
    setOutputPath(path?: URL): this;
    setDevServerPort(port: any): this;
    setDevServerServer(server: any): this;
    addAssetQueryRules(): this;
    addBabelLoader({ exclude, ...options }?: {
        exclude?: RegExp[] | undefined;
    }): this;
    addStyleLoaders(): this;
    addHtmlLoader(options?: {}): this;
    addCopyPlugin(patternsOrOptions: any): this;
    addPublicCopyPlugin(): this;
    addCopyFrom(from: any): this;
    addHtmlPlugin(options?: {}): this;
    addRobotsPlugin(options?: {}): this;
    addGzipCompressionPlugin(options?: {}): this;
    addBrotliCompressionPlugin(options?: {}): this;
    addEnvironmentPlugin(options: any): this;
    addDefinePlugin(options?: {}): this;
    setEntries(entries?: {}): this;
    addEntries(entries?: {}): this;
    addTerserMinimizer(configuration?: {}): this;
    addCssMinimizer(options?: {}): this;
    addHtmlMinimizer(options?: {}): this;
    addJsonMinimizer(options?: {}): this;
    addImageMinimizer(options?: {}): this;
    addTypeScriptLoader({ exclude, compilerOptions, ...options }?: {
        exclude?: RegExp[] | undefined;
        compilerOptions?: {} | undefined;
    }): this;
    addWorkboxServiceWorkerPlugin(options?: {}): this;
    addIgnoredWarnings(warnings: any): this;
    toConfig(): {
        output: {
            filename: string;
            chunkFilename: string;
            assetModuleFilename: string;
            clean: boolean;
            publicPath: string;
        };
        devServer: {
            headers: {
                'Cache-Control': string;
            };
            host: string;
            port: number;
            historyApiFallback: {
                disableDotRule: boolean;
            };
            hot: boolean;
            liveReload: boolean;
        };
        experiments: {
            futureDefaults: boolean;
            css: boolean;
            typescript: boolean;
            html: boolean;
        };
        resolve: {
            extensions: string[];
        };
        plugins: never[];
        module: {
            rules: never[];
        };
        optimization: {
            minimizer: never[];
            removeAvailableModules: boolean;
        };
        target: string;
        devtool: string;
    };
    #private;
}
export { browserArtifactDefaults, generateBrowserArtifacts } from "./browser-artifacts/node.js";
