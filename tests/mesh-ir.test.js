import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MESH_IR_VERSION,
  createMesh,
  createPart,
  validateMesh,
  enforceValidMesh,
  computeRangeBounds,
  createBounds,
  normalizeZero,
  triangleCount,
  vertexCount
} from '../src/geometry/mesh.js';
import { createAnchor } from '../src/geometry/anchors.js';

/**
 * Minimal two-triangle quad used as a structural fixture.
 */
function quadMesh(overrides = {}) {
  return createMesh({
    id: 'quad',
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
      normal: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uv: Float32Array.from([0, 0, 1, 0, 1, 1, 0, 1]),
      regionId: Uint16Array.from([3, 3, 3, 3]),
      surfaceId: Uint16Array.from([7, 7, 7, 7])
    },
    indices: Uint32Array.from([0, 1, 2, 0, 2, 3]),
    parts: [createPart({ id: 'face', semanticName: 'face', indexStart: 0, indexCount: 6 })],
    ...overrides
  });
}

test('MeshIR carries version, conventions and computed bounds', () => {
  const mesh = quadMesh();
  assert.equal(mesh.version, MESH_IR_VERSION);
  assert.equal(mesh.units, 'm');
  assert.equal(mesh.upAxis, '+Y');
  assert.equal(mesh.forwardAxis, '-Z');
  assert.equal(triangleCount(mesh), 2);
  assert.equal(vertexCount(mesh), 4);
  assert.deepEqual([...mesh.bounds.min], [0, 0, 0]);
  assert.deepEqual([...mesh.bounds.max], [1, 1, 0]);
  assert.deepEqual([...mesh.bounds.dimensions], [1, 1, 0]);
  assert.deepEqual([...mesh.bounds.center], [0.5, 0.5, 0]);
});

test('MeshIR validates a well-formed mesh', () => {
  const { valid, diagnostics } = validateMesh(quadMesh());
  assert.equal(valid, true, JSON.stringify(diagnostics));
  assert.equal(diagnostics.length, 0);
});

test('MeshIR refuses a part with no semanticName', () => {
  const mesh = quadMesh({
    parts: [createPart({ id: 'face', semanticName: '', indexStart: 0, indexCount: 6 })]
  });
  const { valid, diagnostics } = validateMesh(mesh);
  assert.equal(valid, false);
  assert.ok(diagnostics.some((d) => d.code === 'MESH_PART_UNNAMED'));
});

test('MeshIR refuses parts that do not exactly partition the index buffer', () => {
  const gapped = quadMesh({
    parts: [createPart({ id: 'face', semanticName: 'face', indexStart: 0, indexCount: 3 })]
  });
  const { valid, diagnostics } = validateMesh(gapped);
  assert.equal(valid, false);
  assert.ok(diagnostics.some((d) => d.code === 'MESH_PART_COVERAGE'));

  const overlapping = quadMesh({
    parts: [
      createPart({ id: 'a', semanticName: 'a', indexStart: 0, indexCount: 6 }),
      createPart({ id: 'b', semanticName: 'b', indexStart: 3, indexCount: 3 })
    ]
  });
  assert.ok(validateMesh(overlapping).diagnostics.some((d) => d.code === 'MESH_PART_PARTITION'));
});

test('MeshIR refuses duplicate part ids', () => {
  const mesh = quadMesh({
    parts: [
      createPart({ id: 'same', semanticName: 'a', indexStart: 0, indexCount: 3 }),
      createPart({ id: 'same', semanticName: 'b', indexStart: 3, indexCount: 3 })
    ]
  });
  assert.ok(validateMesh(mesh).diagnostics.some((d) => d.code === 'MESH_PART_DUPLICATE'));
});

test('MeshIR refuses an index that exceeds the vertex count', () => {
  const mesh = quadMesh({ indices: Uint32Array.from([0, 1, 2, 0, 2, 99]) });
  assert.ok(validateMesh(mesh).diagnostics.some((d) => d.code === 'MESH_INDEX_RANGE'));
});

test('MeshIR refuses non-finite positions', () => {
  const mesh = quadMesh({
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, NaN, 1, 0, 0, 1, 0]),
      normal: null, uv: null, regionId: null, surfaceId: null
    }
  });
  assert.ok(validateMesh(mesh).diagnostics.some((d) => d.code === 'MESH_NON_FINITE'));
});

test('MeshIR refuses an anchor referencing an unknown part', () => {
  const mesh = quadMesh({
    anchors: [createAnchor({ name: 'a.b', position: [0, 0, 0], partId: 'nope' })]
  });
  assert.ok(validateMesh(mesh).diagnostics.some((d) => d.code === 'ANCHOR_PART'));
});

test('MeshIR refuses duplicate anchor names', () => {
  const mesh = quadMesh({
    anchors: [
      createAnchor({ name: 'dup', position: [0, 0, 0] }),
      createAnchor({ name: 'dup', position: [1, 0, 0] })
    ]
  });
  assert.ok(validateMesh(mesh).diagnostics.some((d) => d.code === 'ANCHOR_DUPLICATE'));
});

test('enforceValidMesh fails closed and attaches diagnostics', () => {
  const mesh = quadMesh({
    parts: [createPart({ id: 'face', semanticName: '', indexStart: 0, indexCount: 6 })]
  });
  assert.throws(() => enforceValidMesh(mesh), (err) => {
    assert.ok(Array.isArray(err.diagnostics));
    assert.ok(err.message.includes('MESH_PART_UNNAMED'));
    return true;
  });
});

test('part bounds are measured through the index range, not the vertex slice', () => {
  // Two triangles sharing a vertex buffer but occupying different space.
  const positions = Float32Array.from([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    10, 0, 0, 11, 0, 0, 10, 1, 0
  ]);
  const indices = Uint32Array.from([0, 1, 2, 3, 4, 5]);
  const near = computeRangeBounds(positions, indices, 0, 3);
  const far = computeRangeBounds(positions, indices, 3, 3);
  assert.deepEqual([...near.max], [1, 1, 0]);
  assert.deepEqual([...far.min], [10, 0, 0]);
  assert.deepEqual([...far.max], [11, 1, 0]);
});

test('bounds normalize negative zero so encoding stays deterministic', () => {
  const bounds = createBounds([-0, -0, -0], [0, 0, 0]);
  assert.ok(Object.is(bounds.min[0], 0));
  assert.ok(Object.is(bounds.center[1], 0));
  assert.ok(Object.is(normalizeZero(-0), 0));
});

test('createMesh fills missing part bounds from the index range', () => {
  const mesh = quadMesh();
  assert.ok(mesh.parts[0].bounds);
  assert.deepEqual([...mesh.parts[0].bounds.max], [1, 1, 0]);
});
