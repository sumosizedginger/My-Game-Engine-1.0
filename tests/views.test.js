import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CANONICAL_VIEWS,
  CANONICAL_VIEW_DIRECTIONS,
  CANONICAL_VIEW_UP,
  solveCanonicalView,
  solveAllCanonicalViews,
  boundingRadius
} from '../src/preview/views.js';
import { createBounds } from '../src/geometry/mesh.js';

const UNIT_BOUNDS = createBounds([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]);

test('six canonical views exist in a stable order', () => {
  assert.deepEqual([...CANONICAL_VIEWS], ['front', 'back', 'left', 'right', 'top', 'threeQuarter']);
});

test('every canonical view has a unit direction and an up vector', () => {
  for (const view of CANONICAL_VIEWS) {
    const dir = CANONICAL_VIEW_DIRECTIONS[view];
    const up = CANONICAL_VIEW_UP[view];
    assert.ok(dir, `${view} direction`);
    assert.ok(up, `${view} up`);
    assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-9, `${view} direction is unit length`);
    // Up must not be parallel to the view direction or the basis degenerates.
    const dot = dir[0] * up[0] + dir[1] * up[1] + dir[2] * up[2];
    assert.ok(Math.abs(Math.abs(dot) - 1) > 1e-9, `${view} up is not parallel to direction`);
  }
});

test('the solver is deterministic for identical inputs', () => {
  const a = solveCanonicalView('threeQuarter', UNIT_BOUNDS, { aspect: 16 / 9 });
  const b = solveCanonicalView('threeQuarter', UNIT_BOUNDS, { aspect: 16 / 9 });
  assert.deepEqual([...a.position], [...b.position]);
  assert.equal(a.distance, b.distance);
});

test('framing is normalized: the asset fits regardless of aspect ratio', () => {
  const square = solveCanonicalView('front', UNIT_BOUNDS, { aspect: 1 });
  const wide = solveCanonicalView('front', UNIT_BOUNDS, { aspect: 21 / 9 });
  const tall = solveCanonicalView('front', UNIT_BOUNDS, { aspect: 9 / 21 });

  const radius = boundingRadius(UNIT_BOUNDS);
  for (const camera of [square, wide, tall]) {
    const fovV = (camera.fovDeg * Math.PI) / 180;
    const halfHeight = Math.tan(fovV / 2) * camera.distance;
    const halfWidth = halfHeight * camera.aspect;
    assert.ok(halfHeight >= radius, `vertical fit for aspect ${camera.aspect}`);
    assert.ok(halfWidth >= radius, `horizontal fit for aspect ${camera.aspect}`);
  }
  // A narrow viewport must pull the camera back, not crop the asset.
  assert.ok(tall.distance > square.distance);
});

test('the camera always looks at the asset centre, not the origin', () => {
  const offset = createBounds([9.5, 4, -2.5], [10.5, 5, -1.5]);
  for (const view of CANONICAL_VIEWS) {
    const camera = solveCanonicalView(view, offset);
    assert.deepEqual([...camera.target], [...offset.center]);
  }
});

test('camera distance scales with asset size', () => {
  const small = solveCanonicalView('front', createBounds([0, 0, 0], [0.1, 0.1, 0.1]));
  const large = solveCanonicalView('front', createBounds([0, 0, 0], [10, 10, 10]));
  assert.ok(large.distance > small.distance * 50);
});

test('near and far planes bracket the asset', () => {
  const camera = solveCanonicalView('threeQuarter', UNIT_BOUNDS);
  assert.ok(camera.near > 0);
  assert.ok(camera.near < camera.distance);
  assert.ok(camera.far > camera.distance + boundingRadius(UNIT_BOUNDS));
});

test('a degenerate flat asset still solves a usable camera', () => {
  const flat = createBounds([0, 0, 0], [1, 0, 1]);
  const camera = solveCanonicalView('top', flat);
  assert.ok(Number.isFinite(camera.distance));
  assert.ok(camera.distance > 0);
});

test('an unknown view name is refused', () => {
  assert.throws(() => solveCanonicalView('isometric', UNIT_BOUNDS), /Unknown canonical view/);
});

test('solveAllCanonicalViews returns every view in canonical order', () => {
  const all = solveAllCanonicalViews(UNIT_BOUNDS);
  assert.deepEqual(all.map((c) => c.name), [...CANONICAL_VIEWS]);
});

test('the view solver is pure: no renderer, no Node dependency', () => {
  const source = fs.readFileSync(new URL('../src/preview/views.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.deepEqual(imports, [], `view solver must stay dependency-free, found: ${imports.join(', ')}`);
});

test('Preview Lab and the capture driver both resolve framing through this solver', () => {
  // The shared-solver rule is what makes human and AI evidence comparable. If a
  // second framing implementation ever appears, this test is the tripwire.
  const lab = fs.readFileSync(new URL('../src/preview/lab.js', import.meta.url), 'utf8');
  const capture = fs.readFileSync(new URL('../src/eval/canonical-capture.js', import.meta.url), 'utf8');
  assert.match(lab, /from '\.\/views\.js'/);
  assert.match(capture, /from '\.\.\/preview\/views\.js'/);
});
