/**
 * My Game Engine 1.0 — Minimal PNG Decoder and Image Comparison
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * EVALUATION TOOLING. Node-only.
 *
 * Visual evidence must be compared as PIXELS. Comparing compressed file sizes
 * says nothing about what an image looks like: two completely different renders
 * can encode to near-identical byte counts, and two visually identical renders
 * routinely differ in size. Perceptual equivalence cannot be claimed from a
 * deflate stream length.
 *
 * Decoding uses node:zlib, so no dependency is added. Scope is deliberately
 * narrow: 8-bit non-interlaced truecolour PNGs, which is what the capture path
 * produces. Anything else fails loudly rather than being guessed at.
 */

import zlib from 'node:zlib';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Supported colour types: 2 = truecolour RGB, 6 = truecolour + alpha. */
const CHANNELS_BY_COLOR_TYPE = { 2: 3, 6: 4 };

/**
 * Paeth predictor, per the PNG specification.
 *
 * @param {number} a - Left.
 * @param {number} b - Above.
 * @param {number} c - Upper left.
 * @returns {number}
 */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodes a PNG buffer into raw RGBA pixels.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {{width: number, height: number, channels: number, data: Uint8Array}} RGBA data.
 */
export function decodePng(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a PNG: signature mismatch');
    }
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;

    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      interlace = bytes[dataStart + 12];
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataStart + length + 4; // skip CRC
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}; the capture path produces 8-bit images`);
  }
  if (interlace !== 0) {
    throw new Error('Unsupported interlaced PNG; the capture path produces non-interlaced images');
  }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) {
    throw new Error(`Unsupported PNG colour type ${colorType}; expected 2 (RGB) or 6 (RGBA)`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const previous = new Uint8Array(stride);

  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawOffset++];
    for (let x = 0; x < stride; x++) {
      const value = raw[rawOffset + x];
      const left = x >= channels ? line[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;

      let restored;
      switch (filter) {
        case 0: restored = value; break;
        case 1: restored = value + left; break;
        case 2: restored = value + up; break;
        case 3: restored = value + ((left + up) >> 1); break;
        case 4: restored = value + paeth(left, up, upLeft); break;
        default: throw new Error(`Unsupported PNG filter type ${filter} on row ${y}`);
      }
      line[x] = restored & 0xff;
    }
    rawOffset += stride;

    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      out[dst] = line[src];
      out[dst + 1] = line[src + 1];
      out[dst + 2] = line[src + 2];
      out[dst + 3] = channels === 4 ? line[src + 3] : 255;
    }

    previous.set(line);
  }

  return { width, height, channels, data: out };
}

/**
 * Default comparison thresholds.
 *
 * `perChannelTolerance` is the per-channel value below which a pixel counts as
 * unchanged; it absorbs the sub-unit rasterizer and compositor noise that makes
 * two renders of the same scene differ without being visually different.
 *
 * `maxDifferingFraction` is the share of pixels allowed to exceed that.
 */
export const IMAGE_COMPARISON_DEFAULTS = Object.freeze({
  perChannelTolerance: 8,
  maxDifferingFraction: 0.005,
  maxRmse: 3.0
});

/**
 * Compares two decoded images pixel by pixel.
 *
 * Dimensions must match exactly: two images of different sizes are not
 * comparable evidence, and resampling one to fit would invent pixels.
 *
 * @param {Buffer|Uint8Array} bufferA - PNG bytes.
 * @param {Buffer|Uint8Array} bufferB - PNG bytes.
 * @param {object} [thresholds=IMAGE_COMPARISON_DEFAULTS]
 * @returns {object} Numeric difference metrics and a pass flag.
 */
export function compareImageBuffers(bufferA, bufferB, thresholds = IMAGE_COMPARISON_DEFAULTS) {
  const a = decodePng(bufferA);
  const b = decodePng(bufferB);

  if (a.width !== b.width || a.height !== b.height) {
    return {
      comparable: false,
      reason: 'DIMENSION_MISMATCH',
      a: { width: a.width, height: a.height },
      b: { width: b.width, height: b.height },
      withinThreshold: false
    };
  }

  const pixelCount = a.width * a.height;
  let differingPixels = 0;
  let maxChannelDelta = 0;
  let sumAbsDelta = 0;
  let sumSquaredDelta = 0;

  for (let i = 0; i < pixelCount; i++) {
    const base = i * 4;
    let worst = 0;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(a.data[base + c] - b.data[base + c]);
      if (delta > worst) worst = delta;
      sumAbsDelta += delta;
      sumSquaredDelta += delta * delta;
    }
    if (worst > maxChannelDelta) maxChannelDelta = worst;
    if (worst > thresholds.perChannelTolerance) differingPixels += 1;
  }

  const samples = pixelCount * 4;
  const differingFraction = pixelCount === 0 ? 0 : differingPixels / pixelCount;
  const meanAbsDelta = samples === 0 ? 0 : sumAbsDelta / samples;
  const rmse = samples === 0 ? 0 : Math.sqrt(sumSquaredDelta / samples);

  return {
    comparable: true,
    width: a.width,
    height: a.height,
    pixelCount,
    differingPixels,
    differingFraction,
    maxChannelDelta,
    meanAbsDelta,
    rmse,
    thresholds: { ...thresholds },
    withinThreshold:
      differingFraction <= thresholds.maxDifferingFraction &&
      rmse <= thresholds.maxRmse
  };
}
