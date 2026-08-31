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

import { extname } from 'node:path';
import sharp from 'sharp';

const outputMediaTypes = new Map([
    ['avif', 'image/avif'],
    ['jpeg', 'image/jpeg'],
    ['jpg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
]);

function assertAvifSupport() {
    const aliases = sharp.format.heif?.output?.alias;

    if (!Array.isArray(aliases) || !aliases.includes('avif')) {
        throw new Error('AVIF generation requires a Sharp runtime with libvips, libheif, and an AV1 encoder.');
    }
}

function resolveOutput(options) {
    const formats = Object.keys(options.encodeOptions ?? {});

    if (formats.length !== 1 || !outputMediaTypes.has(formats[0])) {
        throw new TypeError('Safe Sharp generation requires exactly one supported output format.');
    }

    const [format] = formats;

    return {
        encodeOptions: options.encodeOptions[format],
        format,
    };
}

function resolveResize(resize, metadata) {
    if (resize === undefined || resize.enabled === false || (typeof resize.width !== 'number' && typeof resize.height !== 'number')) {
        return undefined;
    }

    const unit = resize.unit ?? 'px';
    const options = { ...resize };

    delete options.enabled;
    delete options.unit;

    if (unit === 'percent') {
        const dimensions = metadata.autoOrient ?? metadata;

        if (typeof options.width === 'number' && typeof dimensions.width === 'number') {
            options.width = Math.ceil((dimensions.width * options.width) / 100);
        }

        if (typeof options.height === 'number' && typeof dimensions.height === 'number') {
            options.height = Math.ceil((dimensions.height * options.height) / 100);
        }
    }

    return options;
}

function resolveSvgDensity(metadata, resize) {
    if (metadata.format !== 'svg' || resize === undefined) {
        return undefined;
    }

    const dimensions = metadata.autoOrient ?? metadata;
    const scales = [];

    if (typeof resize.width === 'number' && typeof dimensions.width === 'number' && dimensions.width > 0) {
        scales.push(resize.width / dimensions.width);
    }

    if (typeof resize.height === 'number' && typeof dimensions.height === 'number' && dimensions.height > 0) {
        scales.push(resize.height / dimensions.height);
    }

    const scale = Math.min(...scales);

    if (!Number.isFinite(scale) || scale <= 1) {
        return undefined;
    }

    const density = Math.ceil((metadata.density ?? 72) * scale);

    if (density > 100_000) {
        throw new RangeError("Requested SVG dimensions exceed Sharp's maximum render density.");
    }

    return density;
}

function replaceExtension(filename, format, sizeSuffix) {
    const extension = extname(filename);
    const basename = extension.length === 0 ? filename : filename.slice(0, -extension.length);

    return `${basename}${sizeSuffix}.${format}`;
}

function inputMatchesOutput(metadata, format) {
    if (format === 'avif') {
        return metadata.mediaType === 'image/avif';
    }

    if (format === 'jpeg' || format === 'jpg') {
        return metadata.format === 'jpeg';
    }

    return metadata.format === format;
}

function canReuseInput(options, resize, input, format) {
    const rotatesPixels = typeof options.rotate === 'number' || (options.rotate === 'auto' && input.metadata.orientation !== undefined);

    return resize === undefined && !rotatesPixels && inputMatchesOutput(input.metadata, format);
}

async function inspectInput(data) {
    const metadata = await sharp(data, { animated: true }).metadata();
    const pages = metadata.pages ?? 1;
    let opaque = true;

    if (metadata.hasAlpha) {
        opaque = (await sharp(data, { animated: pages > 1 }).stats()).isOpaque;
    }

    return {
        metadata,
        opaque,
        pages,
    };
}

function validateInput(format, input) {
    if (format === 'avif') {
        assertAvifSupport();
    }

    if (input.pages > 1 && format !== 'webp') {
        throw new Error(`Animated input cannot be safely converted to ${format.toUpperCase()}; use WebP or a static source.`);
    }

    if ((format === 'jpeg' || format === 'jpg') && !input.opaque) {
        throw new Error('Transparent input cannot be safely converted to JPEG without an explicit background; use PNG, WebP, or AVIF.');
    }

    if ((input.metadata.bitsPerSample ?? 8) > 8 && format !== 'png') {
        throw new Error(`High-bit-depth input cannot be safely converted to ${format.toUpperCase()} by the generic 8-bit preset; use PNG or a custom HDR-aware generator.`);
    }
}

async function encode(pipeline, format, encodeOptions) {
    try {
        return await pipeline.toFormat(format, encodeOptions).toBuffer({ resolveWithObject: true });
    } catch (error) {
        if (format !== 'avif') {
            throw error;
        }

        throw new Error(`AVIF generation failed; verify that Sharp uses libvips and libheif with an AV1 encoder. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}

async function validateOutput(data, format, input) {
    const metadata = await sharp(data, { animated: true }).metadata();
    const mediaType = outputMediaTypes.get(format);

    if (metadata.mediaType !== mediaType) {
        throw new Error(`Sharp returned ${metadata.mediaType ?? 'an unknown media type'} instead of ${mediaType}.`);
    }

    if (input.pages > 1 && (metadata.pages ?? 1) !== input.pages) {
        throw new Error(`Sharp did not preserve all ${input.pages} animation frames in the generated WebP.`);
    }

    if (input.pages > 1 && input.metadata.loop !== undefined && metadata.loop !== input.metadata.loop) {
        throw new Error('Sharp did not preserve the animation loop count in the generated WebP.');
    }

    if (
        input.pages > 1 &&
        input.metadata.delay !== undefined &&
        (metadata.delay === undefined || metadata.delay.length !== input.metadata.delay.length || metadata.delay.some((delay, index) => delay !== input.metadata.delay[index]))
    ) {
        throw new Error('Sharp did not preserve the animation frame delays in the generated WebP.');
    }

    if (!input.opaque && format !== 'jpeg' && format !== 'jpg') {
        const outputOpaque = !metadata.hasAlpha || (await sharp(data, { animated: input.pages > 1 }).stats()).isOpaque;

        if (outputOpaque) {
            throw new Error(`Sharp did not preserve transparency in the generated ${format.toUpperCase()}.`);
        }
    }

    if ((input.metadata.bitsPerSample ?? 8) > 8 && (metadata.bitsPerSample ?? 0) < input.metadata.bitsPerSample) {
        throw new Error('Sharp did not preserve the input bit depth in the generated PNG.');
    }

    return metadata;
}

export async function safeSharpGenerate(original, options = {}) {
    const output = resolveOutput(options);
    const input = await inspectInput(original.data);

    validateInput(output.format, input);

    const resize = resolveResize(options.resize, input.metadata);
    const density = resolveSvgDensity(input.metadata, resize);
    const pipeline = sharp(original.data, {
        animated: input.pages > 1,
        ...(density === undefined ? {} : { density }),
    });

    if (typeof options.rotate === 'number') {
        pipeline.rotate(options.rotate);
    } else if (options.rotate === 'auto') {
        pipeline.rotate();
    }

    if (resize !== undefined) {
        pipeline.resize(resize);
    }

    if (output.format === 'png' && (input.metadata.bitsPerSample ?? 8) > 8) {
        pipeline.toColourspace('rgb16');
    }

    const result = await encode(pipeline, output.format, output.encodeOptions);
    const data = canReuseInput(options, resize, input, output.format) && original.data.length <= result.data.length ? original.data : result.data;
    const metadata = await validateOutput(data, output.format, input);
    const sizeSuffix = typeof options.sizeSuffix === 'function' ? options.sizeSuffix(metadata.width, metadata.height) : '';

    return {
        filename: replaceExtension(original.filename, output.format, sizeSuffix),
        data,
        warnings: [...original.warnings],
        errors: [...original.errors],
        info: {
            ...original.info,
            width: metadata.width,
            height: metadata.height,
            generated: true,
            generatedBy: ['sharp', ...(original.info?.generatedBy ?? [])],
        },
    };
}
