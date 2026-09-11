import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBoxGeometry, buildCylinderGeometry } from '../src/geometry/primitives.js';
import { createBoxMesh, createCylinderMesh } from '../src/geometry/mesh-ops.js';
import { toBufferGeometry } from '../src/render/mesh-adapter.js';

/**
 * Conformance evidence pinning the new MeshIR path against the accepted legacy
 * Geometry Forge primitives.
 *
 * This exists so an eventual migration is evidence-based rather than a leap of
 * faith. The legacy implementation is NOT migrated in this tranche: both paths
 * run side by side and the accepted proofs keep using the legacy one.
 */

/**
 * Compares a named float attribute between two BufferGeometries.
 *
 * @param {object} legacy
 * @param {object} candidate
 * @param {string} name
 * @param {number} [epsilon=0]
 */
function assertAttributeMatches(legacy, candidate, name, epsilon = 0) {
  const a = legacy.getAttribute(name);
  const b = candidate.getAttribute(name);
  assert.ok(a, `legacy geometry missing ${name}`);
  assert.ok(b, `MeshIR geometry missing ${name}`);
  assert.equal(b.count, a.count, `${name} count`);
  assert.equal(b.itemSize, a.itemSize, `${name} itemSize`);
  for (let i = 0; i < a.array.length; i++) {
    if (epsilon === 0) {
      assert.equal(b.array[i], a.array[i], `${name}[${i}]`);
    } else {
      assert.ok(Math.abs(b.array[i] - a.array[i]) <= epsilon, `${name}[${i}] ${b.array[i]} vs ${a.array[i]}`);
    }
  }
}

test('MeshIR box is numerically equivalent to the accepted legacy box', () => {
  const params = { width: 1.4, height: 0.6, depth: 2.2, origin: { x: 0.3, y: -0.2, z: 1.1 }, regionId: 4, surfaceId: 2 };
  const legacy = buildBoxGeometry(params);
  const candidate = toBufferGeometry(createBoxMesh({ ...params, semanticName: 'box' }));

  assertAttributeMatches(legacy, candidate, 'position');
  assertAttributeMatches(legacy, candidate, 'normal');
  assertAttributeMatches(legacy, candidate, 'uv');
  assertAttributeMatches(legacy, candidate, 'regionId');
  assertAttributeMatches(legacy, candidate, 'surfaceId');

  assert.equal(candidate.index.count, legacy.index.count, 'index count');
  for (let i = 0; i < legacy.index.array.length; i++) {
    assert.equal(candidate.index.array[i], legacy.index.array[i], `index[${i}]`);
  }

  legacy.dispose();
  candidate.dispose();
});

test('MeshIR box matches the legacy default parameters too', () => {
  const legacy = buildBoxGeometry({});
  const candidate = toBufferGeometry(createBoxMesh({ semanticName: 'box', regionId: 0, surfaceId: 0 }));
  assertAttributeMatches(legacy, candidate, 'position');
  assertAttributeMatches(legacy, candidate, 'normal');
  assertAttributeMatches(legacy, candidate, 'uv');
  legacy.dispose();
  candidate.dispose();
});

test('MeshIR cylinder is numerically equivalent to the accepted legacy cylinder', () => {
  const params = {
    radiusTop: 0.2, radiusBottom: 0.35, height: 1.7,
    radialSegments: 16, origin: { x: -0.4, y: 0.9, z: 0.2 },
    regionId: 6, surfaceId: 3
  };

  for (const cappedBottom of [false, true]) {
    const legacy = buildCylinderGeometry({ ...params, cappedBottom });
    const candidate = toBufferGeometry(createCylinderMesh({ ...params, cappedBottom, semanticName: 'cyl' }));

    assertAttributeMatches(legacy, candidate, 'position');
    assertAttributeMatches(legacy, candidate, 'normal');
    assertAttributeMatches(legacy, candidate, 'uv');
    assertAttributeMatches(legacy, candidate, 'regionId');
    assertAttributeMatches(legacy, candidate, 'surfaceId');

    assert.equal(candidate.index.count, legacy.index.count, `index count (cappedBottom=${cappedBottom})`);
    for (let i = 0; i < legacy.index.array.length; i++) {
      assert.equal(candidate.index.array[i], legacy.index.array[i], `index[${i}] cappedBottom=${cappedBottom}`);
    }

    legacy.dispose();
    candidate.dispose();
  }
});

test('the adapter widens Uint16 semantic ids to Float32 render attributes', () => {
  const mesh = createBoxMesh({ semanticName: 'box', regionId: 9, surfaceId: 4 });
  assert.ok(mesh.attributes.regionId instanceof Uint16Array, 'authoring IR keeps integer identity');
  const geometry = toBufferGeometry(mesh);
  assert.ok(geometry.getAttribute('regionId').array instanceof Float32Array, 'render attribute is widened');
  assert.equal(geometry.getAttribute('regionId').array[0], 9);
  assert.equal(geometry.getAttribute('surfaceId').array[0], 4);
  geometry.dispose();
});

test('the adapter emits one geometry group per part, carrying part identity', () => {
  const mesh = createBoxMesh({ semanticName: 'receiver', materialId: 'cinder.steel' });
  const geometry = toBufferGeometry(mesh);
  assert.equal(geometry.groups.length, 1);
  assert.equal(geometry.groups[0].start, 0);
  assert.equal(geometry.groups[0].count, mesh.indices.length);
  assert.equal(geometry.userData.parts[0].semanticName, 'receiver');
  assert.equal(geometry.userData.materialOrder[0], 'cinder.steel');
  geometry.dispose();
});
