import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBoxMesh,
  createCylinderMesh,
  extrudeProfile,
  transformMesh,
  mergeMeshIR,
  MESH_OP_DESCRIPTORS
} from '../src/geometry/mesh-ops.js';
import { validateMesh, triangleCount } from '../src/geometry/mesh.js';
import { createAnchor } from '../src/geometry/anchors.js';
import { meshHash, bytesToHex, encodeMesh } from '../src/geometry/mesh-codec.js';

const SQUARE = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

test('every generator produces a structurally valid single-part mesh', () => {
  const meshes = [
    createBoxMesh({ semanticName: 'box' }),
    createCylinderMesh({ semanticName: 'cyl' }),
    extrudeProfile({ profile: SQUARE, distance: 1, semanticName: 'ext' })
  ];
  for (const mesh of meshes) {
    const { valid, diagnostics } = validateMesh(mesh);
    assert.equal(valid, true, `${mesh.id}: ${JSON.stringify(diagnostics)}`);
    assert.equal(mesh.parts.length, 1);
  }
});

test('every generator refuses an anonymous part', () => {
  assert.throws(() => createBoxMesh({}), /semanticName/);
  assert.throws(() => createCylinderMesh({}), /semanticName/);
  assert.throws(() => extrudeProfile({ profile: SQUARE, distance: 1 }), /semanticName/);
  assert.throws(() => createBoxMesh({ semanticName: '   ' }), /semanticName/);
});

test('box geometry is 12 triangles across 24 split vertices', () => {
  const box = createBoxMesh({ semanticName: 'box' });
  assert.equal(triangleCount(box), 12);
  assert.equal(box.attributes.position.length / 3, 24);
});

test('extrusion produces side walls plus caps and respects capping flags', () => {
  const capped = extrudeProfile({ profile: SQUARE, distance: 1, semanticName: 'a' });
  const open = extrudeProfile({ profile: SQUARE, distance: 1, semanticName: 'b', capStart: false, capEnd: false });
  // 4 sides * 2 triangles = 8; each square cap adds 2.
  assert.equal(triangleCount(open), 8);
  assert.equal(triangleCount(capped), 12);
});

test('extrusion fails closed on a non-convex profile with caps requested', () => {
  const lShape = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
  assert.throws(
    () => extrudeProfile({ profile: lShape, distance: 1, semanticName: 'l' }),
    (err) => {
      assert.ok(err.message.includes('non-convex'));
      assert.equal(err.diagnostics[0].code, 'EXTRUDE_NON_CONVEX_CAP');
      return true;
    }
  );
  // The same profile is fine without caps.
  const open = extrudeProfile({ profile: lShape, distance: 1, semanticName: 'l', capStart: false, capEnd: false });
  assert.equal(validateMesh(open).valid, true);
});

test('extrusion normalizes clockwise winding and reports it', () => {
  const clockwise = [...SQUARE].reverse();
  const mesh = extrudeProfile({ profile: clockwise, distance: 1, semanticName: 'cw' });
  assert.ok(mesh.diagnostics.some((d) => d.code === 'EXTRUDE_WINDING_NORMALIZED'));
});

test('extrusion normalizes a negative distance instead of inverting normals', () => {
  const mesh = extrudeProfile({ profile: SQUARE, distance: -1, semanticName: 'neg' });
  assert.ok(mesh.diagnostics.some((d) => d.code === 'EXTRUDE_DISTANCE_NORMALIZED'));
  assert.equal(mesh.bounds.min[2], -1);
  assert.equal(mesh.bounds.max[2], 0);
  // Side normals still point outward, matching the positive-distance build.
  const positive = extrudeProfile({ profile: SQUARE, distance: 1, semanticName: 'neg' });
  for (let i = 0; i < 12; i++) {
    assert.equal(mesh.attributes.normal[i], positive.attributes.normal[i]);
  }
});

test('extrusion rejects a degenerate profile or distance', () => {
  assert.throws(() => extrudeProfile({ profile: [[0, 0], [1, 0]], distance: 1, semanticName: 'x' }), /at least 3/);
  assert.throws(() => extrudeProfile({ profile: SQUARE, distance: 0, semanticName: 'x' }), /non-zero/);
  assert.throws(() => extrudeProfile({ profile: [[0, 0], [1, 0], [NaN, 1]], distance: 1, semanticName: 'x' }), /finite/);
});

test('transformMesh is pure: the input is never mutated', () => {
  const box = createBoxMesh({ semanticName: 'box' });
  const before = bytesToHex(encodeMesh(box));
  const moved = transformMesh(box, { translation: [5, 0, 0] });
  assert.equal(bytesToHex(encodeMesh(box)), before);
  assert.notEqual(meshHash(moved), meshHash(box));
});

test('transformMesh translates geometry and re-measures bounds', () => {
  const box = createBoxMesh({ width: 2, height: 2, depth: 2, semanticName: 'box' });
  const moved = transformMesh(box, { translation: [10, 0, 0] });
  assert.deepEqual([...moved.bounds.min], [9, -1, -1]);
  assert.deepEqual([...moved.bounds.max], [11, 1, 1]);
  assert.deepEqual([...moved.parts[0].bounds.max], [11, 1, 1]);
});

test('transformMesh rotates geometry and renormalizes normals', () => {
  const box = createBoxMesh({ semanticName: 'box' });
  // 90 degrees about X.
  const q = [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)];
  const rotated = transformMesh(box, { rotation: q });
  for (let i = 0; i < rotated.attributes.normal.length; i += 3) {
    const len = Math.hypot(
      rotated.attributes.normal[i],
      rotated.attributes.normal[i + 1],
      rotated.attributes.normal[i + 2]
    );
    assert.ok(Math.abs(len - 1) < 1e-5, `normal ${i / 3} length ${len}`);
  }
  // The canonical layout's first face is +Z; a +90 degree X rotation maps it to -Y.
  assert.ok(Math.abs(rotated.attributes.normal[0]) < 1e-6);
  assert.ok(Math.abs(rotated.attributes.normal[1] + 1) < 1e-6);
  assert.ok(Math.abs(rotated.attributes.normal[2]) < 1e-6);
});

test('transformMesh keeps normals unit-length under non-uniform scale', () => {
  const box = createBoxMesh({ semanticName: 'box' });
  const squashed = transformMesh(box, { scale: [1, 0.2, 3] });
  for (let i = 0; i < squashed.attributes.normal.length; i += 3) {
    const len = Math.hypot(
      squashed.attributes.normal[i],
      squashed.attributes.normal[i + 1],
      squashed.attributes.normal[i + 2]
    );
    assert.ok(Math.abs(len - 1) < 1e-5);
  }
});

test('transformMesh carries anchors with the geometry', () => {
  const box = createBoxMesh({
    semanticName: 'box',
    anchors: [createAnchor({ name: 'tip', partId: 'box', position: [0, 0.5, 0] })]
  });
  const moved = transformMesh(box, { translation: [0, 0, -2] });
  assert.deepEqual([...moved.anchors[0].position], [0, 0.5, -2]);

  const q = [Math.sin(-Math.PI / 4), 0, 0, Math.cos(-Math.PI / 4)];
  const rotated = transformMesh(box, { rotation: q });
  // +Y maps to -Z under a -90 degree X rotation.
  assert.ok(Math.abs(rotated.anchors[0].position[1]) < 1e-6);
  assert.ok(Math.abs(rotated.anchors[0].position[2] + 0.5) < 1e-6);
});

test('mergeMeshIR concatenates parts, offsets index ranges and keeps anchors', () => {
  const a = createBoxMesh({
    semanticName: 'a',
    anchors: [createAnchor({ name: 'a.tip', partId: 'a', position: [0, 1, 0] })]
  });
  const b = transformMesh(
    createBoxMesh({ semanticName: 'b', anchors: [createAnchor({ name: 'b.tip', partId: 'b', position: [0, 1, 0] })] }),
    { translation: [3, 0, 0] }
  );
  const merged = mergeMeshIR([a, b], { id: 'merged' });

  assert.equal(validateMesh(merged).valid, true);
  assert.equal(merged.parts.length, 2);
  assert.deepEqual(merged.parts.map((p) => p.semanticName), ['a', 'b']);
  assert.equal(merged.parts[0].indexStart, 0);
  assert.equal(merged.parts[1].indexStart, a.indices.length);
  assert.equal(triangleCount(merged), triangleCount(a) + triangleCount(b));
  assert.deepEqual(merged.anchors.map((x) => x.name), ['a.tip', 'b.tip']);
  assert.deepEqual([...merged.anchors[1].position], [3, 1, 0]);
  assert.deepEqual([...merged.parts[1].bounds.center], [3, 0, 0]);
});

test('mergeMeshIR refuses duplicate part ids rather than silently colliding', () => {
  const a = createBoxMesh({ semanticName: 'same' });
  const b = createBoxMesh({ semanticName: 'same' });
  assert.throws(() => mergeMeshIR([a, b]), /duplicate part id/);
});

test('mergeMeshIR refuses duplicate anchor names', () => {
  const a = createBoxMesh({ semanticName: 'a', anchors: [createAnchor({ name: 'dup', partId: 'a', position: [0, 0, 0] })] });
  const b = createBoxMesh({ semanticName: 'b', anchors: [createAnchor({ name: 'dup', partId: 'b', position: [0, 0, 0] })] });
  assert.throws(() => mergeMeshIR([a, b]), /duplicate anchor name/);
});

test('mergeMeshIR never silently drops an input', () => {
  const good = createBoxMesh({ semanticName: 'good' });
  assert.throws(() => mergeMeshIR([good, { id: 'broken' }]), /refuses an input/);
  assert.throws(() => mergeMeshIR([]), /non-empty/);
});

test('mergeMeshIR reports attribute substitution instead of hiding it', () => {
  const withUv = createBoxMesh({ semanticName: 'a' });
  const withoutUv = {
    ...withUv,
    id: 'b',
    attributes: { ...withUv.attributes, uv: null },
    parts: [{ ...withUv.parts[0], id: 'b', semanticName: 'b' }]
  };
  const merged = mergeMeshIR([withUv, withoutUv]);
  const filled = merged.diagnostics.find((d) => d.code === 'MERGE_ATTRIBUTE_FILLED');
  assert.ok(filled, 'expected a MERGE_ATTRIBUTE_FILLED diagnostic');
  assert.equal(filled.severity, 'WARNING');
  assert.equal(filled.data.attribute, 'uv');
  assert.equal(merged.attributes.uv.length, (merged.attributes.position.length / 3) * 2);
});

test('merge is deterministic', () => {
  const build = () => mergeMeshIR([
    createBoxMesh({ semanticName: 'a' }),
    transformMesh(createCylinderMesh({ semanticName: 'b' }), { translation: [2, 0, 0] })
  ], { id: 'm' });
  assert.equal(meshHash(build()), meshHash(build()));
});

test('operation descriptors stay in step with the exported verbs', () => {
  const described = MESH_OP_DESCRIPTORS.map((d) => d.name).sort();
  assert.deepEqual(described, [
    'createBoxMesh', 'createCylinderMesh', 'extrudeProfile', 'mergeMeshIR', 'transformMesh'
  ]);
  for (const descriptor of MESH_OP_DESCRIPTORS) {
    assert.ok(descriptor.summary.length > 0);
    assert.ok(Object.keys(descriptor.params).length > 0);
    assert.equal(descriptor.returns, 'MeshIR');
  }
});
