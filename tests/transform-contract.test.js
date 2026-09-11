import test from 'node:test';
import assert from 'node:assert/strict';

import { createBoxMesh, transformMesh, mergeMeshIR, validateTransform } from '../src/geometry/mesh-ops.js';
import { createMesh, createPart, validateMesh } from '../src/geometry/mesh.js';
import { createAnchor } from '../src/geometry/anchors.js';
import { meshHash } from '../src/geometry/mesh-codec.js';

const box = () => createBoxMesh({ semanticName: 'box' });

/**
 * Transform validation.
 *
 * A transform that cannot be applied correctly must be refused, not applied
 * approximately. Silent mirroring or a silently-scaling quaternion produces
 * geometry that looks plausible and measures wrong, which is the failure mode
 * the whole manifest exists to prevent.
 */

test('a valid transform passes through unchanged', () => {
  const t = { translation: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [1, 2, 0.5] };
  assert.deepEqual(validateTransform(t), t);
  assert.equal(validateMesh(transformMesh(box(), t)).valid, true);
});

test('zero scale is refused: it collapses geometry and destroys normals', () => {
  for (const scale of [[0, 1, 1], [1, 0, 1], [1, 1, 0], [0, 0, 0]]) {
    assert.throws(() => transformMesh(box(), { scale }), /non-zero/, `scale ${JSON.stringify(scale)}`);
  }
});

test('negative scale is refused rather than silently mirroring', () => {
  for (const scale of [[-1, 1, 1], [1, -1, 1], [1, 1, -1], [-1, -1, -1]]) {
    assert.throws(
      () => transformMesh(box(), { scale }),
      (err) => {
        assert.match(err.message, /Mirroring/);
        assert.match(err.message, /winding/);
        return true;
      },
      `scale ${JSON.stringify(scale)}`
    );
  }
});

test('a non-finite or malformed scale is refused', () => {
  for (const scale of [[NaN, 1, 1], [Infinity, 1, 1], [1, 1], [1, 1, 1, 1], 'big', null, [1, '2', 3]]) {
    assert.throws(() => transformMesh(box(), { scale }), TypeError, `scale ${JSON.stringify(scale)}`);
  }
});

test('a malformed translation is refused', () => {
  for (const translation of [[NaN, 0, 0], [0, Infinity, 0], [0, 0], [0, 0, 0, 0], 'over there', null, {}]) {
    assert.throws(() => transformMesh(box(), { translation }), TypeError, `translation ${JSON.stringify(translation)}`);
  }
});

test('a malformed quaternion is refused', () => {
  for (const rotation of [[0, 0, 1], [0, 0, 0, 1, 0], [NaN, 0, 0, 1], 'spin', null, {}]) {
    assert.throws(() => transformMesh(box(), { rotation }), TypeError, `rotation ${JSON.stringify(rotation)}`);
  }
});

test('a non-unit quaternion is refused, because it would scale while rotating', () => {
  for (const rotation of [[0, 0, 0, 2], [0, 0, 0, 0.5], [1, 1, 1, 1], [0, 0, 0, 0]]) {
    assert.throws(
      () => transformMesh(box(), { rotation }),
      (err) => {
        assert.match(err.message, /unit quaternion/);
        return true;
      },
      `rotation ${JSON.stringify(rotation)}`
    );
  }
});

test('a quaternion within floating-point tolerance of unit length is accepted', () => {
  const almost = [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
  assert.doesNotThrow(() => transformMesh(box(), { rotation: almost }));
});

test('a refused transform leaves the input untouched', () => {
  const original = box();
  const before = meshHash(original);
  for (const bad of [{ scale: [-1, 1, 1] }, { scale: [0, 1, 1] }, { rotation: [0, 0, 0, 3] }]) {
    assert.throws(() => transformMesh(original, bad));
  }
  assert.equal(meshHash(original), before);
});

/**
 * Merge coordinate conventions.
 */

/**
 * Builds a minimal mesh declaring specific coordinate conventions.
 *
 * @param {object} conventions
 * @returns {object}
 */
function meshWithConventions({ id, units = 'm', upAxis = '+Y', forwardAxis = '-Z' }) {
  return createMesh({
    id,
    attributes: {
      position: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0]),
      normal: null, uv: null, regionId: null, surfaceId: null
    },
    indices: Uint32Array.from([0, 1, 2]),
    parts: [createPart({ id, semanticName: id, indexStart: 0, indexCount: 3 })],
    units,
    upAxis,
    forwardAxis
  });
}

test('merge accepts inputs whose conventions agree', () => {
  const merged = mergeMeshIR([
    meshWithConventions({ id: 'a' }),
    meshWithConventions({ id: 'b' })
  ], { id: 'ok' });
  assert.equal(merged.units, 'm');
  assert.equal(merged.upAxis, '+Y');
  assert.equal(merged.forwardAxis, '-Z');
});

test('merge refuses mismatched units rather than inheriting the first', () => {
  assert.throws(
    () => mergeMeshIR([
      meshWithConventions({ id: 'metres' }),
      meshWithConventions({ id: 'centimetres', units: 'cm' })
    ]),
    (err) => {
      assert.match(err.message, /mismatched units/);
      assert.match(err.message, /"m"/);
      assert.match(err.message, /"cm"/);
      return true;
    }
  );
});

test('merge refuses a mismatched up axis', () => {
  assert.throws(
    () => mergeMeshIR([
      meshWithConventions({ id: 'yup' }),
      meshWithConventions({ id: 'zup', upAxis: '+Z' })
    ]),
    /mismatched upAxis/
  );
});

test('merge refuses a mismatched forward axis', () => {
  assert.throws(
    () => mergeMeshIR([
      meshWithConventions({ id: 'negz' }),
      meshWithConventions({ id: 'posz', forwardAxis: '+Z' })
    ]),
    /mismatched forwardAxis/
  );
});

test('merge checks every input, not only the second', () => {
  assert.throws(
    () => mergeMeshIR([
      meshWithConventions({ id: 'a' }),
      meshWithConventions({ id: 'b' }),
      meshWithConventions({ id: 'c', units: 'in' })
    ]),
    /mismatched units/
  );
});

test('anchors and parts survive a chain of valid transforms and a merge', () => {
  const a = transformMesh(
    createBoxMesh({
      semanticName: 'a',
      anchors: [createAnchor({ name: 'a.tip', partId: 'a', position: [0, 0.5, 0] })]
    }),
    { translation: [1, 0, 0], scale: [2, 2, 2] }
  );
  const b = transformMesh(
    createBoxMesh({
      semanticName: 'b',
      anchors: [createAnchor({ name: 'b.tip', partId: 'b', position: [0, 0.5, 0] })]
    }),
    { rotation: [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)] }
  );
  const merged = mergeMeshIR([a, b], { id: 'chain' });

  assert.equal(validateMesh(merged).valid, true);
  assert.deepEqual([...merged.anchors[0].position], [1, 1, 0]);
  assert.equal(merged.anchors[1].partId, 'b');
  assert.equal(merged.parts.length, 2);
});
