import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CANONICAL_VIEWS,
  CANONICAL_VIEW_DIRECTIONS,
  CANONICAL_VIEW_UP,
  DEFAULT_VIEW_OPTIONS,
  DEFAULT_UP_AXIS,
  DEFAULT_FORWARD_AXIS,
  AXIS_VECTORS,
  semanticFrame,
  resolveCanonicalViewDirections,
  resolveCanonicalViewUps,
  INSPECTION_RIG,
  inspectionLightFrame,
  solveCanonicalView,
  solveAllCanonicalViews,
  boundingRadius,
  viewBasis,
  projectBounds,
  boundsCorners
} from '../src/preview/views.js';
import { createBounds, MESH_UP_AXIS, MESH_FORWARD_AXIS } from '../src/geometry/mesh.js';

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

/**
 * Asset shapes the framing solver must handle. A bounding-sphere solver fails
 * the elongated cases: it sizes the camera for a dimension that may lie along
 * the view axis and therefore contribute nothing to what is visible.
 */
const SHAPES = {
  longThin: createBounds([-0.04, -0.15, -0.5], [0.04, 0.15, 0.5]),
  cubic: createBounds([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]),
  tallThin: createBounds([-0.05, -1.2, -0.05], [0.05, 1.2, 0.05]),
  offCentre: createBounds([9.5, 4, -2.5], [10.5, 5, -1.5]),
  flatPlate: createBounds([-0.6, -0.002, -0.6], [0.6, 0.002, 0.6])
};

/** The binding axis must fill the frame up to the margin. */
const EXPECTED_FILL = 1 / DEFAULT_VIEW_OPTIONS.margin;

test('every view of every shape fills the frame on its binding axis', () => {
  for (const [label, bounds] of Object.entries(SHAPES)) {
    for (const view of CANONICAL_VIEWS) {
      for (const aspect of [1, 16 / 9, 9 / 16]) {
        const camera = solveCanonicalView(view, bounds, { aspect });
        const binding = Math.max(camera.projectedBoundsOccupancy.width, camera.projectedBoundsOccupancy.height);
        assert.ok(
          Math.abs(binding - EXPECTED_FILL) < 1e-6,
          `${label}/${view}@${aspect.toFixed(2)}: binding axis fills ${(binding * 100).toFixed(1)}%, expected ${(EXPECTED_FILL * 100).toFixed(1)}%`
        );
        assert.ok(camera.projectedBoundsOccupancy.width <= EXPECTED_FILL + 1e-6, `${label}/${view}: width overflows the frame`);
        assert.ok(camera.projectedBoundsOccupancy.height <= EXPECTED_FILL + 1e-6, `${label}/${view}: height overflows the frame`);
      }
    }
  }
});

test('a long thin object viewed ALONG its long axis is not a postage stamp', () => {
  // The regression this repair exists for. CINDER is ~0.08 x 0.31 x 0.99m; the
  // bounding-sphere solver framed its front view for the hidden 0.99m depth and
  // reduced the asset to roughly 7% of frame width.
  const front = solveCanonicalView('front', SHAPES.longThin, { aspect: 1 });
  const binding = Math.max(front.projectedBoundsOccupancy.width, front.projectedBoundsOccupancy.height);
  assert.ok(binding > 0.8, `front view fills only ${(binding * 100).toFixed(1)}%`);

  // And the distance must actually be driven by the visible cross-section, not
  // the depth: framing along the long axis must be closer than across it.
  const side = solveCanonicalView('right', SHAPES.longThin, { aspect: 1 });
  assert.ok(front.distance < side.distance,
    `front ${front.distance} should be nearer than side ${side.distance} for a long thin asset`);
});

test('a long thin object viewed PERPENDICULAR to its long axis fits its length', () => {
  const side = solveCanonicalView('right', SHAPES.longThin, { aspect: 1 });
  // The 1.0m length runs across the view here, so width is the binding axis.
  assert.ok(side.projectedBoundsOccupancy.width > side.projectedBoundsOccupancy.height);
  assert.ok(Math.abs(side.projectedBoundsOccupancy.width - EXPECTED_FILL) < 1e-6);
});

test('a roughly cubic object frames consistently from every direction', () => {
  const distances = CANONICAL_VIEWS.map((v) => solveCanonicalView(v, SHAPES.cubic, { aspect: 1 }).distance);
  const min = Math.min(...distances);
  const max = Math.max(...distances);
  // A cube's projection varies with the three-quarter diagonal, but no view
  // should be wildly further out than another.
  assert.ok(max / min < 1.8, `cube distances range ${min} to ${max}`);
});

test('a tall thin object is framed by its height, not its footprint', () => {
  const front = solveCanonicalView('front', SHAPES.tallThin, { aspect: 1 });
  assert.ok(front.projectedBoundsOccupancy.height > front.projectedBoundsOccupancy.width);
  assert.ok(Math.abs(front.projectedBoundsOccupancy.height - EXPECTED_FILL) < 1e-6);
  // Viewed from above, the tall axis is the hidden one and must not drive framing.
  const top = solveCanonicalView('top', SHAPES.tallThin, { aspect: 1 });
  assert.ok(top.distance < front.distance, 'top view should not inherit the tall axis distance');
});

test('framing works for non-origin-centred bounds', () => {
  for (const view of CANONICAL_VIEWS) {
    const camera = solveCanonicalView(view, SHAPES.offCentre, { aspect: 1 });
    assert.deepEqual([...camera.target], [...SHAPES.offCentre.center]);
    const binding = Math.max(camera.projectedBoundsOccupancy.width, camera.projectedBoundsOccupancy.height);
    assert.ok(Math.abs(binding - EXPECTED_FILL) < 1e-6, `${view} on off-centre bounds`);
  }
});

test('a narrow viewport pulls the camera back rather than cropping', () => {
  const square = solveCanonicalView('front', SHAPES.cubic, { aspect: 1 });
  const tall = solveCanonicalView('front', SHAPES.cubic, { aspect: 9 / 21 });
  assert.ok(tall.distance > square.distance);
});

test('near and far bracket the asset for every shape and view', () => {
  for (const [label, bounds] of Object.entries(SHAPES)) {
    for (const view of CANONICAL_VIEWS) {
      const camera = solveCanonicalView(view, bounds, { aspect: 1 });
      assert.ok(camera.near > 0, `${label}/${view} near must be positive`);
      assert.ok(camera.near < camera.far, `${label}/${view} near must precede far`);
      // Every corner must sit inside the depth range.
      const basis = viewBasis(view);
      const projected = projectBounds(bounds, basis);
      assert.ok(camera.near <= camera.distance - projected.maxDepth + 1e-9,
        `${label}/${view} near plane clips the closest geometry`);
      assert.ok(camera.far >= camera.distance - projected.minDepth - 1e-9,
        `${label}/${view} far plane clips the furthest geometry`);
    }
  }
});

test('framing is deterministic across repeated solves', () => {
  for (const [, bounds] of Object.entries(SHAPES)) {
    for (const view of CANONICAL_VIEWS) {
      const a = solveCanonicalView(view, bounds, { aspect: 1.337 });
      const b = solveCanonicalView(view, bounds, { aspect: 1.337 });
      assert.deepEqual([...a.position], [...b.position]);
      assert.equal(a.distance, b.distance);
      assert.equal(a.projectedBoundsOccupancy.width, b.projectedBoundsOccupancy.width);
    }
  }
});

test('framing carries no asset-specific constants', () => {
  // Scan CODE, not prose. Comments may legitimately record which asset exposed
  // a defect; what must never exist is a branch or constant that special-cases
  // one. Strip comments, then look for asset names in what remains.
  const source = fs.readFileSync(new URL('../src/preview/views.js', import.meta.url), 'utf8');
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .toLowerCase();
  for (const forbidden of ['cinder', 'weapon', 'rifle', 'barrel', 'subterra', 'sumo']) {
    assert.equal(code.includes(forbidden), false, `the solver must not special-case "${forbidden}"`);
  }
});

test('a degenerate flat asset still solves a finite camera', () => {
  for (const view of CANONICAL_VIEWS) {
    const camera = solveCanonicalView(view, SHAPES.flatPlate, { aspect: 1 });
    assert.ok(Number.isFinite(camera.distance) && camera.distance > 0, `${view} distance`);
    assert.ok(Number.isFinite(camera.near) && camera.near > 0, `${view} near`);
  }
  // A fully collapsed asset must not divide by zero or park the camera inside it.
  const point = createBounds([1, 1, 1], [1, 1, 1]);
  for (const view of CANONICAL_VIEWS) {
    const camera = solveCanonicalView(view, point, { aspect: 1 });
    assert.ok(Number.isFinite(camera.distance) && camera.distance > 0, `${view} on a degenerate point`);
  }
});

test('projected bounds measure the visible cross-section, not the bounding sphere', () => {
  const basis = viewBasis('front');
  const projected = projectBounds(SHAPES.longThin, basis);
  // Front view of the 0.08 x 0.30 x 1.0 box sees the small cross-section.
  assert.ok(Math.abs(projected.halfWidth - 0.04) < 1e-6);
  assert.ok(Math.abs(projected.halfHeight - 0.15) < 1e-6);
  // The 1.0m length is depth, not visible extent.
  assert.ok(Math.abs(projected.maxDepth - 0.5) < 1e-6);
  assert.ok(boundingRadius(SHAPES.longThin) > projected.halfWidth * 5,
    'the bounding sphere is much larger than the visible cross-section, which is the whole problem');
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

// ---------------------------------------------------------------------------
// ASSET-RELATIVE CANONICAL VIEWS
//
// These view names used to be world-space constants, with `front` pinned to
// +Z. The engine declares `forwardAxis: '-Z'`, so the capture labelled `front`
// observed the asset's REAR. A manifest that states one forward axis while
// labelling the opposite observation "front" is false evidence.
// ---------------------------------------------------------------------------

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

/** Valid up/forward pairs spanning several distinct orientations. */
const ORIENTATIONS = [
  { upAxis: '+Y', forwardAxis: '-Z' },
  { upAxis: '+Y', forwardAxis: '+Z' },
  { upAxis: '+Z', forwardAxis: '+X' },
  { upAxis: '+Z', forwardAxis: '-Y' },
  { upAxis: '-Y', forwardAxis: '+X' },
  { upAxis: '+X', forwardAxis: '+Y' }
];

test('view solver defaults match the MeshIR axis conventions', () => {
  // views.js keeps zero imports on purpose, so the constants are duplicated.
  // This is the tripwire that stops them drifting apart.
  assert.equal(DEFAULT_UP_AXIS, MESH_UP_AXIS);
  assert.equal(DEFAULT_FORWARD_AXIS, MESH_FORWARD_AXIS);
  assert.equal(DEFAULT_VIEW_OPTIONS.upAxis, MESH_UP_AXIS);
  assert.equal(DEFAULT_VIEW_OPTIONS.forwardAxis, MESH_FORWARD_AXIS);
});

test('front looks at the face the asset declares it faces', () => {
  for (const { upAxis, forwardAxis } of ORIENTATIONS) {
    const dirs = resolveCanonicalViewDirections(upAxis, forwardAxis);
    assert.deepEqual([...dirs.front], [...AXIS_VECTORS[forwardAxis]],
      `${upAxis}/${forwardAxis}: the front camera must sit on the asset's forward side`);
  }
});

test('front and back are exactly opposed for every orientation', () => {
  for (const { upAxis, forwardAxis } of ORIENTATIONS) {
    const dirs = resolveCanonicalViewDirections(upAxis, forwardAxis);
    assert.equal(dot3(dirs.front, dirs.back), -1,
      `${upAxis}/${forwardAxis}: front and back must be opposite`);
    assert.equal(dot3(dirs.left, dirs.right), -1,
      `${upAxis}/${forwardAxis}: left and right must be opposite`);
  }
});

test('left and right follow right-handed asset handedness', () => {
  for (const { upAxis, forwardAxis } of ORIENTATIONS) {
    const dirs = resolveCanonicalViewDirections(upAxis, forwardAxis);
    const frame = semanticFrame(upAxis, forwardAxis);
    // right = forward x up is the convention the engine already declares: an
    // asset facing -Z with +Y up has its own right along +X.
    assert.deepEqual(frame.right, cross3(AXIS_VECTORS[forwardAxis], AXIS_VECTORS[upAxis]));
    assert.deepEqual([...dirs.right], frame.right);
    assert.deepEqual([...dirs.left], frame.right.map((n) => -n));
    assert.equal(dot3(frame.forward, frame.up), 0);
    assert.equal(dot3(frame.forward, frame.right), 0);
    assert.equal(dot3(frame.up, frame.right), 0);
  }
});

test('top looks down the declared up axis, and its up hint is the forward axis', () => {
  for (const { upAxis, forwardAxis } of ORIENTATIONS) {
    const dirs = resolveCanonicalViewDirections(upAxis, forwardAxis);
    const ups = resolveCanonicalViewUps(upAxis, forwardAxis);
    assert.deepEqual([...dirs.top], [...AXIS_VECTORS[upAxis]]);
    // The asset's up cannot also be the top view's up hint: the basis would
    // degenerate. Forward is used, so a plan view points the asset upward.
    assert.deepEqual([...ups.top], [...AXIS_VECTORS[forwardAxis]]);
    assert.equal(dot3(ups.top, dirs.top), 0, 'top up hint must be perpendicular to the view direction');
  }
});

test('threeQuarter is derived from the same semantic basis, not a world constant', () => {
  for (const { upAxis, forwardAxis } of ORIENTATIONS) {
    const dirs = resolveCanonicalViewDirections(upAxis, forwardAxis);
    const frame = semanticFrame(upAxis, forwardAxis);
    const expected = [0, 1, 2].map((i) =>
      (frame.forward[i] + frame.right[i] + frame.up[i]) / Math.sqrt(3));
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(dirs.threeQuarter[i] - expected[i]) < 1e-12,
        `${upAxis}/${forwardAxis}: threeQuarter must be forward+right+up normalised`);
    }
    assert.ok(dot3(dirs.threeQuarter, frame.forward) > 0.5,
      'threeQuarter must be a FRONT three-quarter');
  }
});

test('every canonical view basis stays orthonormal for every orientation', () => {
  for (const { upAxis, forwardAxis } of ORIENTATIONS) {
    for (const view of CANONICAL_VIEWS) {
      const { xAxis, yAxis, zAxis } = viewBasis(view, { upAxis, forwardAxis });
      for (const axis of [xAxis, yAxis, zAxis]) {
        assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-12, `${view} basis axis not unit`);
      }
      assert.ok(Math.abs(dot3(xAxis, yAxis)) < 1e-12);
      assert.ok(Math.abs(dot3(yAxis, zAxis)) < 1e-12);
      assert.ok(Math.abs(dot3(xAxis, zAxis)) < 1e-12);
    }
  }
});

test('an up axis parallel to the forward axis is refused', () => {
  assert.throws(() => semanticFrame('+Y', '+Y'), /parallel/);
  assert.throws(() => semanticFrame('+Y', '-Y'), /parallel/);
  assert.throws(() => semanticFrame('+Q', '-Z'), /Unknown upAxis/);
  assert.throws(() => semanticFrame('+Y', 'forward'), /Unknown forwardAxis/);
});

test('the solved camera carries the axes it was resolved against', () => {
  const camera = solveCanonicalView('front', UNIT_BOUNDS, { upAxis: '+Z', forwardAxis: '+X' });
  assert.equal(camera.upAxis, '+Z');
  assert.equal(camera.forwardAxis, '+X');
  // Camera sits on the +X side, because that is where the asset faces.
  assert.ok(camera.position[0] > 0);
  assert.ok(Math.abs(camera.position[1]) < 1e-12);
});

test('the inspection rig is camera-relative, so every view is lit comparably', () => {
  // The defect: fixed world lights meant a view facing the key returned bright
  // evidence and a view facing away returned dark evidence, for one asset.
  const perView = CANONICAL_VIEWS.map((view) => {
    const camera = solveCanonicalView(view, UNIT_BOUNDS, { aspect: 1 });
    const frame = inspectionLightFrame(camera);
    const toCamera = [
      camera.position[0] - camera.target[0],
      camera.position[1] - camera.target[1],
      camera.position[2] - camera.target[2]
    ];
    const length = Math.hypot(...toCamera);
    const unitToCamera = toCamera.map((n) => n / length);
    const key = frame.lights.find((l) => l.name === 'key');
    return { view, version: frame.version, keyTowardCamera: dot3(key.direction, unitToCamera) };
  });

  for (const entry of perView) {
    assert.equal(entry.version, INSPECTION_RIG.version);
    // The key sits on the camera side for EVERY view, by the same amount. That
    // constancy is what makes canonical captures comparable as evidence.
    assert.ok(Math.abs(entry.keyTowardCamera - perView[0].keyTowardCamera) < 1e-9,
      `${entry.view}: key/camera relationship must not vary between canonical views`);
    assert.ok(entry.keyTowardCamera > 0.4, `${entry.view}: key must be on the camera side`);
  }
});

test('inspection rig directions are unit length and deterministic', () => {
  const camera = solveCanonicalView('threeQuarter', UNIT_BOUNDS, { aspect: 16 / 9 });
  const a = inspectionLightFrame(camera);
  const b = inspectionLightFrame(camera);
  assert.deepEqual(a, b);
  assert.equal(a.lights.length, INSPECTION_RIG.lights.length);
  for (const light of a.lights) {
    assert.ok(Math.abs(Math.hypot(...light.direction) - 1) < 1e-12, `${light.name} direction must be unit`);
    assert.ok(Number.isFinite(light.intensity) && light.intensity > 0);
  }
});

test('CINDER front observes the muzzle and back observes the stock', () => {
  // The concrete acceptance the audit named. CINDER declares forwardAxis -Z and
  // its muzzle sits at the most negative Z, so the `front` camera must be on
  // the negative-Z side of the asset.
  const bounds = createBounds([-0.052, -0.274, -0.509], [0.052, 0.146, 0.558]);
  const options = { aspect: 1.5, upAxis: '+Y', forwardAxis: '-Z' };
  const front = solveCanonicalView('front', bounds, options);
  const back = solveCanonicalView('back', bounds, options);

  assert.ok(front.position[2] < bounds.center[2], 'front camera must sit forward of the asset (-Z)');
  assert.ok(back.position[2] > bounds.center[2], 'back camera must sit behind the asset (+Z)');
  assert.ok(front.position[2] < back.position[2]);
});
