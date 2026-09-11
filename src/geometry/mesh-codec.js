/**
 * My Game Engine 1.0 — MeshIR Canonical Codec
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Deterministic artifact identity belongs to the canonical encoder, not to the
 * raw IEEE-754 intermediates produced during generation. This module defines
 * the one authoritative byte ordering for a MeshIR and derives its hash from
 * those bytes.
 *
 * Contract:
 *   same MeshIR -> same bytes -> same hash
 *
 * This is a separate contract from DefinitionHash in src/full/compiler.js,
 * which is a JSON string walk and cannot meaningfully hash typed arrays.
 *
 * No float quantization is performed. If cross-runtime divergence is ever
 * demonstrated, a quantization policy must be explicit, versioned, tested and
 * documented — never silent.
 *
 * This module must never import 'three'.
 *
 * See `Next step.md` sections 7.3 and Decision 8.
 */

import { OPTIONAL_ATTRIBUTES, normalizeZero, allFinite } from './mesh.js';

/** Canonical encoding format version. Bump on any layout change. */
export const MESH_CODEC_VERSION = 1;

/** Magic prefix identifying a canonical MeshIR byte stream. */
export const MESH_CODEC_MAGIC = 'MGE1MIR\0';

const TYPE_FLOAT32 = 1;
const TYPE_UINT16 = 2;

/**
 * Serializes a JSON-compatible value with object keys sorted at every depth.
 *
 * Array order is preserved. Numbers use the ECMAScript Number::toString
 * algorithm, which is specification-pinned and therefore stable across
 * conforming engines. Negative zero is normalized.
 *
 * @param {*} value
 * @returns {string}
 */
export function canonicalJsonString(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RangeError(`Canonical encoding rejects non-finite number: ${value}`);
    }
    return JSON.stringify(normalizeZero(value));
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonString).join(',')}]`;
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString(value[k])}`).join(',')}}`;
}

/**
 * Extracts the metadata header that accompanies the binary attribute blocks.
 * Typed array payloads are excluded; they are encoded as raw bytes.
 *
 * @param {object} mesh
 * @returns {object} Plain JSON-compatible header.
 */
export function meshHeader(mesh) {
  return {
    version: mesh.version,
    id: mesh.id,
    units: mesh.units,
    upAxis: mesh.upAxis,
    forwardAxis: mesh.forwardAxis,
    bounds: boundsToPlain(mesh.bounds),
    parts: mesh.parts.map((part) => ({
      id: part.id,
      semanticName: part.semanticName,
      indexStart: part.indexStart,
      indexCount: part.indexCount,
      regionId: part.regionId,
      surfaceId: part.surfaceId,
      materialId: part.materialId,
      bounds: boundsToPlain(part.bounds)
    })),
    anchors: mesh.anchors.map((anchor) => ({
      name: anchor.name,
      partId: anchor.partId,
      position: anchor.position.map(normalizeZero),
      orientation: anchor.orientation === null ? null : anchor.orientation.map(normalizeZero)
    }))
  };
}

/**
 * Converts a bounds record to a plain JSON-compatible object.
 *
 * @param {object|null} bounds
 * @returns {object|null}
 */
function boundsToPlain(bounds) {
  if (!bounds) return null;
  return {
    min: bounds.min.map(normalizeZero),
    max: bounds.max.map(normalizeZero),
    center: bounds.center.map(normalizeZero),
    dimensions: bounds.dimensions.map(normalizeZero)
  };
}

/**
 * Encodes a MeshIR into canonical bytes.
 *
 * Layout (little-endian throughout, no alignment padding):
 *   magic            8 bytes
 *   codecVersion     uint32
 *   headerLength     uint32
 *   headerBytes      UTF-8 canonical JSON
 *   for each attribute in [position, ...OPTIONAL_ATTRIBUTES]:
 *     present        uint8
 *     [typeCode      uint8]
 *     [elementCount  uint32]
 *     [payload       raw little-endian elements]
 *   indexCount       uint32
 *   indexPayload     raw little-endian uint32
 *
 * @param {object} mesh
 * @returns {Uint8Array}
 */
export function encodeMesh(mesh) {
  const headerBytes = new TextEncoder().encode(canonicalJsonString(meshHeader(mesh)));

  const attributeOrder = ['position', ...OPTIONAL_ATTRIBUTES];
  const blocks = [];
  for (const name of attributeOrder) {
    const attr = mesh.attributes[name];
    if (attr === null || attr === undefined) {
      blocks.push({ name, present: false });
      continue;
    }
    if (!allFinite(attr)) {
      throw new RangeError(`Canonical encoding rejects non-finite values in attribute "${name}"`);
    }
    const isFloat = attr instanceof Float32Array;
    blocks.push({
      name,
      present: true,
      typeCode: isFloat ? TYPE_FLOAT32 : TYPE_UINT16,
      bytesPerElement: isFloat ? 4 : 2,
      data: attr
    });
  }

  let byteLength = MESH_CODEC_MAGIC.length + 4 + 4 + headerBytes.length;
  for (const block of blocks) {
    byteLength += 1;
    if (block.present) byteLength += 1 + 4 + block.data.length * block.bytesPerElement;
  }
  byteLength += 4 + mesh.indices.length * 4;

  const out = new Uint8Array(byteLength);
  const view = new DataView(out.buffer);
  let offset = 0;

  for (let i = 0; i < MESH_CODEC_MAGIC.length; i++) {
    out[offset++] = MESH_CODEC_MAGIC.charCodeAt(i);
  }
  view.setUint32(offset, MESH_CODEC_VERSION, true); offset += 4;
  view.setUint32(offset, headerBytes.length, true); offset += 4;
  out.set(headerBytes, offset); offset += headerBytes.length;

  for (const block of blocks) {
    out[offset++] = block.present ? 1 : 0;
    if (!block.present) continue;
    out[offset++] = block.typeCode;
    view.setUint32(offset, block.data.length, true); offset += 4;
    if (block.typeCode === TYPE_FLOAT32) {
      for (let i = 0; i < block.data.length; i++) {
        view.setFloat32(offset, normalizeZero(block.data[i]), true);
        offset += 4;
      }
    } else {
      for (let i = 0; i < block.data.length; i++) {
        view.setUint16(offset, block.data[i], true);
        offset += 2;
      }
    }
  }

  view.setUint32(offset, mesh.indices.length, true); offset += 4;
  for (let i = 0; i < mesh.indices.length; i++) {
    view.setUint32(offset, mesh.indices[i], true);
    offset += 4;
  }

  return out;
}

/**
 * Deterministic non-cryptographic hash over a byte sequence.
 *
 * Two-lane FNV-1a with a final avalanche, matching the spirit of the existing
 * DefinitionHash: synchronous, dependency-free and reproducible. This is a
 * content fingerprint, NOT a security primitive and NOT SHA-256.
 *
 * @param {Uint8Array} bytes
 * @returns {string} Hex fingerprint.
 */
export function hashBytes(bytes) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 = Math.imul(h1 ^ b, 16777619);
    h2 = Math.imul(h2 ^ (b + 0x9e), 2246822519);
  }
  h1 ^= bytes.length;
  h2 ^= bytes.length;
  h1 = Math.imul(h1 ^ (h1 >>> 15), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 15), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hi = (h2 >>> 0).toString(16).padStart(8, '0');
  const lo = (h1 >>> 0).toString(16).padStart(8, '0');
  return `${hi}${lo}`;
}

/**
 * Computes the canonical MeshIR hash.
 *
 * @param {object} mesh
 * @returns {string} Hex fingerprint of the canonical encoding.
 */
export function meshHash(mesh) {
  return hashBytes(encodeMesh(mesh));
}

/**
 * Converts bytes to a lowercase hex string, for byte-range diffing when a
 * determinism probe reports divergence.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}
