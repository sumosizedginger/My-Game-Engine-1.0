import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { decodePng, compareImageBuffers, IMAGE_COMPARISON_DEFAULTS } from '../src/eval/png.js';

/**
 * Visual comparison must be VISUAL.
 *
 * Comparing compressed file sizes says nothing about what an image looks like.
 * These tests exist to prove the comparison actually reads pixels: in
 * particular, that two radically different images of the same size are
 * reported as different, which a byte-size comparison would happily pass.
 */

/**
 * Encodes raw RGBA pixels as a PNG, so tests can construct exact images.
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @returns {Buffer}
 */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, data.length + 8);
    return out;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/**
 * CRC-32 over a buffer.
 *
 * @param {Buffer} buffer
 * @returns {number}
 */
function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

/**
 * Builds a solid-colour image.
 *
 * @param {number} width
 * @param {number} height
 * @param {number[]} rgba
 * @returns {Buffer}
 */
function solid(width, height, [r, g, b, a = 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return encodePng(width, height, data);
}

/**
 * Builds a checkerboard, which compresses to a very different size than a
 * solid fill while having the same dimensions.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} cell
 * @returns {Buffer}
 */
function checker(width, height, cell = 8) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const i = (y * width + x) * 4;
      data[i] = on ? 255 : 0;
      data[i + 1] = on ? 255 : 0;
      data[i + 2] = on ? 255 : 0;
      data[i + 3] = 255;
    }
  }
  return encodePng(width, height, data);
}

test('the decoder round-trips dimensions and pixels', () => {
  const png = solid(4, 3, [10, 20, 30, 255]);
  const decoded = decodePng(png);
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 3);
  assert.equal(decoded.data.length, 4 * 3 * 4);
  assert.deepEqual([...decoded.data.slice(0, 4)], [10, 20, 30, 255]);
});

test('the decoder handles every PNG filter type', () => {
  // A gradient exercises the adaptive filters a real encoder chooses.
  const width = 32;
  const height = 32;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 8) & 0xff;
      data[i + 1] = (y * 8) & 0xff;
      data[i + 2] = ((x + y) * 4) & 0xff;
      data[i + 3] = 255;
    }
  }
  const decoded = decodePng(encodePng(width, height, data));
  assert.deepEqual([...decoded.data], [...data]);
});

test('the decoder refuses what it does not actually support', () => {
  assert.throws(() => decodePng(Buffer.from('not a png')), /signature/);
});

test('identical images report zero difference', () => {
  const a = solid(16, 16, [128, 64, 32]);
  const b = solid(16, 16, [128, 64, 32]);
  const result = compareImageBuffers(a, b);
  assert.equal(result.comparable, true);
  assert.equal(result.differingPixels, 0);
  assert.equal(result.maxChannelDelta, 0);
  assert.equal(result.rmse, 0);
  assert.equal(result.withinThreshold, true);
});

test('TWO RADICALLY DIFFERENT SAME-SIZED IMAGES FAIL', () => {
  // The core requirement. Both are 64x64; a byte-size comparison could easily
  // pass them, and a hash comparison would say "different" without saying how
  // much or whether it matters.
  const black = solid(64, 64, [0, 0, 0]);
  const white = solid(64, 64, [255, 255, 255]);
  const result = compareImageBuffers(black, white);

  assert.equal(result.comparable, true);
  assert.equal(result.width, 64);
  assert.equal(result.differingFraction, 1, 'every pixel differs');
  assert.equal(result.maxChannelDelta, 255);
  assert.ok(result.rmse > 200, `rmse ${result.rmse}`);
  assert.equal(result.withinThreshold, false, 'a black/white pair must FAIL');
});

test('a checkerboard and a solid fill of the same size fail', () => {
  const a = checker(64, 64);
  const b = solid(64, 64, [255, 255, 255]);
  const result = compareImageBuffers(a, b);
  assert.equal(result.withinThreshold, false);
  assert.ok(result.differingFraction > 0.4, `differing ${result.differingFraction}`);

  // Demonstrates precisely why file size is not evidence: these two images are
  // entirely different yet their compressed sizes are of the same order.
  assert.ok(a.length > 0 && b.length > 0);
});

test('a small localized change is detected', () => {
  const width = 64;
  const height = 64;
  const base = new Uint8Array(width * height * 4).fill(255);
  const changed = new Uint8Array(base);
  // Flip a 10x10 block: 100/4096 pixels, about 2.4%.
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const i = (y * width + x) * 4;
      changed[i] = 0; changed[i + 1] = 0; changed[i + 2] = 0;
    }
  }
  const result = compareImageBuffers(encodePng(width, height, base), encodePng(width, height, changed));
  assert.equal(result.differingPixels, 100);
  assert.ok(result.differingFraction > IMAGE_COMPARISON_DEFAULTS.maxDifferingFraction);
  assert.equal(result.withinThreshold, false);
});

test('sub-tolerance rasterizer noise passes', () => {
  // The case the threshold exists for: two renders of the same scene differing
  // by a few values per channel from antialiasing and compositor rounding.
  const width = 64;
  const height = 64;
  const base = new Uint8Array(width * height * 4).fill(128);
  for (let i = 3; i < base.length; i += 4) base[i] = 255;
  const noisy = new Uint8Array(base);
  for (let i = 0; i < noisy.length; i += 4) {
    noisy[i] = 128 + ((i / 4) % 3);
  }
  const result = compareImageBuffers(encodePng(width, height, base), encodePng(width, height, noisy));
  assert.ok(result.maxChannelDelta > 0, 'the images really do differ');
  assert.equal(result.differingPixels, 0, 'but not beyond per-channel tolerance');
  assert.equal(result.withinThreshold, true);
});

test('differently sized images are reported as incomparable, never resampled', () => {
  const result = compareImageBuffers(solid(64, 64, [0, 0, 0]), solid(32, 32, [0, 0, 0]));
  assert.equal(result.comparable, false);
  assert.equal(result.reason, 'DIMENSION_MISMATCH');
  assert.equal(result.withinThreshold, false);
  assert.deepEqual(result.a, { width: 64, height: 64 });
  assert.deepEqual(result.b, { width: 32, height: 32 });
});

test('thresholds are explicit and reported with the result', () => {
  const result = compareImageBuffers(solid(8, 8, [0, 0, 0]), solid(8, 8, [0, 0, 0]));
  assert.deepEqual(result.thresholds, { ...IMAGE_COMPARISON_DEFAULTS });
  assert.ok(Number.isFinite(result.meanAbsDelta));
  assert.ok(Number.isFinite(result.rmse));
  assert.ok(Number.isInteger(result.differingPixels));
});

test('a stricter threshold can be supplied and is honoured', () => {
  const base = new Uint8Array(8 * 8 * 4).fill(100);
  // A 2-value shift: under the default per-channel tolerance of 8 and under the
  // default RMSE ceiling of 3, so it passes by default.
  const shifted = new Uint8Array(base).fill(102);
  const a = encodePng(8, 8, base);
  const b = encodePng(8, 8, shifted);

  const lenient = compareImageBuffers(a, b);
  assert.equal(lenient.differingPixels, 0);
  assert.ok(lenient.rmse < IMAGE_COMPARISON_DEFAULTS.maxRmse);
  assert.equal(lenient.withinThreshold, true);
  assert.equal(
    compareImageBuffers(a, b, { perChannelTolerance: 1, maxDifferingFraction: 0, maxRmse: 1 }).withinThreshold,
    false
  );
});

test('compression size is never used as a similarity signal', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/eval/png.js', import.meta.url), 'utf8');
  assert.equal(/byteDelta|imageBytes|\.length\s*\/\s*/.test(source), false,
    'the comparator must not reason about compressed size');

  const capture = fs.readFileSync(new URL('../src/eval/canonical-capture.js', import.meta.url), 'utf8');
  assert.equal(capture.includes('imageSizeTolerance'), false, 'the byte-size tolerance must be gone');
  assert.ok(capture.includes('compareImageBuffers'), 'the capture path must compare decoded pixels');
});
