import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAnchor,
  transformAnchor,
  rotateVectorByQuaternion,
  multiplyQuaternions,
  identityTransform
} from '../src/geometry/anchors.js';

test('anchors require a name and a finite position', () => {
  assert.throws(() => createAnchor({ position: [0, 0, 0] }), /string name/);
  assert.throws(() => createAnchor({ name: 'a', position: [0, 0] }), /finite/);
  assert.throws(() => createAnchor({ name: 'a', position: [0, NaN, 0] }), /finite/);
});

test('anchor orientation is optional but validated when present', () => {
  const plain = createAnchor({ name: 'weapon.muzzle', position: [0, 0, -1] });
  assert.equal(plain.orientation, null);
  assert.throws(
    () => createAnchor({ name: 'a', position: [0, 0, 0], orientation: [0, 0, 1] }),
    /quaternion/
  );
  const oriented = createAnchor({ name: 'a', position: [0, 0, 0], orientation: [0, 0, 0, 1] });
  assert.deepEqual([...oriented.orientation], [0, 0, 0, 1]);
});

test('anchors are generic engine vocabulary, not character landmarks', () => {
  // The same contract serves every asset kind. This is the seam that will let
  // character.hand.R meet weapon.grip.R without weapon-specific architecture.
  const names = [
    'weapon.grip.R', 'weapon.muzzle', 'weapon.magazineSocket',
    'door.hinge', 'vehicle.wheel.FL', 'character.hand.R', 'character.eyeLine'
  ];
  for (const name of names) {
    const anchor = createAnchor({ name, position: [0, 0, 0] });
    assert.equal(anchor.name, name);
  }
});

test('anchors module imports nothing: no Character Forge, no renderer', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../src/geometry/anchors.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(imports, [], `anchors must stay dependency-free, found: ${imports.join(', ')}`);
  // The dependency direction is one-way: Character Forge may later map its
  // humanoid landmarks onto this contract, never the reverse.
  assert.equal(/from\s+['"][^'"]*character/.test(source), false);
});

test('quaternion vector rotation matches known results', () => {
  // 90 degrees about Y maps +Z to +X.
  const q = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)];
  const [x, y, z] = rotateVectorByQuaternion([0, 0, 1], q);
  assert.ok(Math.abs(x - 1) < 1e-9);
  assert.ok(Math.abs(y) < 1e-9);
  assert.ok(Math.abs(z) < 1e-9);
});

test('quaternion multiplication composes rotations', () => {
  const half = [Math.sin(Math.PI / 8), 0, 0, Math.cos(Math.PI / 8)];
  const full = multiplyQuaternions(half, half);
  const expected = [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)];
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(full[i] - expected[i]) < 1e-9, `component ${i}`);
  }
});

test('transformAnchor applies scale, then rotation, then translation', () => {
  const anchor = createAnchor({ name: 'a', position: [1, 0, 0] });
  const q = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)]; // +90 about Y: +X -> -Z
  const out = transformAnchor(anchor, { scale: [2, 1, 1], rotation: q, translation: [0, 5, 0] });
  assert.ok(Math.abs(out.position[0]) < 1e-9);
  assert.ok(Math.abs(out.position[1] - 5) < 1e-9);
  assert.ok(Math.abs(out.position[2] + 2) < 1e-9);
});

test('transformAnchor composes orientation but never invents one', () => {
  const q = [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)];

  const withoutOrientation = transformAnchor(
    createAnchor({ name: 'a', position: [0, 0, 0] }),
    { rotation: q }
  );
  assert.equal(withoutOrientation.orientation, null);

  const withOrientation = transformAnchor(
    createAnchor({ name: 'b', position: [0, 0, 0], orientation: [0, 0, 0, 1] }),
    { rotation: q }
  );
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(withOrientation.orientation[i] - q[i]) < 1e-9);
  }
});

test('the identity transform leaves an anchor unchanged', () => {
  const anchor = createAnchor({ name: 'a', position: [0.25, -3, 7], partId: 'p' });
  const out = transformAnchor(anchor, identityTransform());
  assert.deepEqual([...out.position], [...anchor.position]);
  assert.equal(out.partId, 'p');
});

test('transformAnchor preserves owning part identity', () => {
  const anchor = createAnchor({ name: 'weapon.grip.R', position: [0, 0, 0], partId: 'grip' });
  assert.equal(transformAnchor(anchor, { translation: [1, 2, 3] }).partId, 'grip');
});
