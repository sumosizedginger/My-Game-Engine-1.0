import test from 'node:test';
import assert from 'node:assert/strict';

import { createMesh, createPart } from '../src/geometry/mesh.js';
import { createAnchor } from '../src/geometry/anchors.js';
import {
  MESH_CODEC_VERSION,
  MESH_CODEC_MAGIC,
  encodeMesh,
  meshHash,
  hashBytes,
  bytesToHex,
  canonicalJsonString,
  meshHeader
} from '../src/geometry/mesh-codec.js';
import { createBoxMesh } from '../src/geometry/mesh-ops.js';

function fixture(overrides = {}) {
  return createMesh({
    id: 'codec-fixture',
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0]),
      normal: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uv: Float32Array.from([0, 0, 1, 0, 1, 1]),
      regionId: Uint16Array.from([2, 2, 2]),
      surfaceId: Uint16Array.from([5, 5, 5])
    },
    indices: Uint32Array.from([0, 1, 2]),
    parts: [createPart({ id: 'tri', semanticName: 'tri', indexStart: 0, indexCount: 3, materialId: 'm1' })],
    anchors: [createAnchor({ name: 'test.anchor', position: [0.5, 0.25, 0], partId: 'tri' })],
    ...overrides
  });
}

test('codec emits a versioned magic prefix', () => {
  const bytes = encodeMesh(fixture());
  const magic = String.fromCharCode(...bytes.slice(0, MESH_CODEC_MAGIC.length));
  assert.equal(magic, MESH_CODEC_MAGIC);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(MESH_CODEC_MAGIC.length, true), MESH_CODEC_VERSION);
});

test('same MeshIR produces the same bytes and the same hash', () => {
  const a = encodeMesh(fixture());
  const b = encodeMesh(fixture());
  assert.deepEqual([...a], [...b]);
  assert.equal(meshHash(fixture()), meshHash(fixture()));
});

test('repeated encoding of the very same object is stable', () => {
  const mesh = fixture();
  const runs = new Set();
  for (let i = 0; i < 5; i++) runs.add(bytesToHex(encodeMesh(mesh)));
  assert.equal(runs.size, 1);
});

test('a changed position changes the hash', () => {
  const base = meshHash(fixture());
  const moved = meshHash(fixture({
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1.0001, 0]),
      normal: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uv: Float32Array.from([0, 0, 1, 0, 1, 1]),
      regionId: Uint16Array.from([2, 2, 2]),
      surfaceId: Uint16Array.from([5, 5, 5])
    }
  }));
  assert.notEqual(base, moved);
});

test('a changed semanticName changes the hash: part identity is part of identity', () => {
  const base = meshHash(fixture());
  const renamed = meshHash(fixture({
    parts: [createPart({ id: 'tri', semanticName: 'renamed', indexStart: 0, indexCount: 3, materialId: 'm1' })]
  }));
  assert.notEqual(base, renamed);
});

test('a changed anchor changes the hash', () => {
  const base = meshHash(fixture());
  const moved = meshHash(fixture({
    anchors: [createAnchor({ name: 'test.anchor', position: [0.6, 0.25, 0], partId: 'tri' })]
  }));
  assert.notEqual(base, moved);
});

test('canonical JSON sorts keys at every depth', () => {
  const a = canonicalJsonString({ b: 1, a: { d: 2, c: 3 } });
  const b = canonicalJsonString({ a: { c: 3, d: 2 }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"c":3,"d":2},"b":1}');
});

test('canonical JSON preserves array order', () => {
  assert.equal(canonicalJsonString([3, 1, 2]), '[3,1,2]');
});

test('canonical JSON normalizes negative zero', () => {
  assert.equal(canonicalJsonString(-0), '0');
  assert.equal(canonicalJsonString({ v: -0 }), '{"v":0}');
});

test('canonical JSON rejects non-finite numbers rather than emitting null', () => {
  assert.throws(() => canonicalJsonString(NaN), RangeError);
  assert.throws(() => canonicalJsonString(Infinity), RangeError);
});

test('encoding rejects non-finite attribute values', () => {
  const mesh = fixture({
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, 1, Infinity, 0]),
      normal: null, uv: null, regionId: null, surfaceId: null
    }
  });
  assert.throws(() => encodeMesh(mesh), RangeError);
});

test('absent optional attributes are encoded as explicitly absent, not as empty', () => {
  const withAll = encodeMesh(fixture());
  const withoutUv = encodeMesh(fixture({
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0]),
      normal: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uv: null,
      regionId: Uint16Array.from([2, 2, 2]),
      surfaceId: Uint16Array.from([5, 5, 5])
    }
  }));
  assert.notEqual(bytesToHex(withAll), bytesToHex(withoutUv));
  assert.ok(withoutUv.length < withAll.length);
});

test('header excludes typed array payloads', () => {
  const header = meshHeader(fixture());
  assert.equal(header.attributes, undefined);
  assert.equal(header.indices, undefined);
  assert.equal(header.parts[0].semanticName, 'tri');
});

test('hashBytes is stable and length-sensitive', () => {
  const a = Uint8Array.from([1, 2, 3]);
  const b = Uint8Array.from([1, 2, 3]);
  const c = Uint8Array.from([1, 2, 3, 0]);
  assert.equal(hashBytes(a), hashBytes(b));
  assert.notEqual(hashBytes(a), hashBytes(c));
  assert.match(hashBytes(a), /^[0-9a-f]{16}$/);
});

test('two structurally identical boxes built independently hash identically', () => {
  const a = createBoxMesh({ width: 0.4, height: 0.2, depth: 1.2, semanticName: 'receiver' });
  const b = createBoxMesh({ width: 0.4, height: 0.2, depth: 1.2, semanticName: 'receiver' });
  assert.equal(meshHash(a), meshHash(b));
});
