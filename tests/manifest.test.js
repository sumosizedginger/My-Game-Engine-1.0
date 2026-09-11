import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANIFEST_VERSION,
  createAssetPreviewManifest,
  planCanonicalCaptures,
  encodeManifest,
  manifestHash,
  structuralManifest,
  structuralManifestHash
} from '../src/preview/manifest.js';
import { createPreviewable } from '../src/preview/previewable.js';
import { createBoxMesh, createCylinderMesh, mergeMeshIR, transformMesh } from '../src/geometry/mesh-ops.js';
import { createMaterialDefinition } from '../src/material/index.js';
import { createAnchor } from '../src/geometry/anchors.js';
import { CANONICAL_VIEWS } from '../src/preview/views.js';

function build() {
  const mesh = mergeMeshIR([
    createBoxMesh({
      semanticName: 'receiver',
      materialId: 'm.steel',
      anchors: [createAnchor({ name: 'weapon.grip.R', partId: 'receiver', position: [0, -0.2, 0] })]
    }),
    transformMesh(
      createCylinderMesh({ semanticName: 'barrel', materialId: 'm.steel' }),
      { translation: [0, 0, -1] }
    )
  ], { id: 'manifest-fixture' });

  return createPreviewable({
    mesh,
    materials: [createMaterialDefinition({ id: 'm.steel', parameters: { color: 0x555555, metalness: 0.9 } })],
    type: 'weapon',
    generationMs: null
  });
}

test('the manifest carries source identity, scene conventions and bounds', () => {
  const p = build();
  const m = createAssetPreviewManifest(p);
  assert.equal(m.manifestVersion, MANIFEST_VERSION);
  assert.equal(m.source.definitionId, 'manifest-fixture');
  assert.match(m.source.meshHash, /^[0-9a-f]{16}$/);
  assert.deepEqual(m.scene, { units: 'm', upAxis: '+Y', forwardAxis: '-Z' });
  assert.equal(m.bounds.dimensions.length, 3);
  p.dispose();
});

test('every part appears with a semantic name, bounds, triangle count and material', () => {
  const p = build();
  const m = createAssetPreviewManifest(p);
  assert.equal(m.parts.length, 2);
  for (const part of m.parts) {
    assert.ok(part.semanticName && part.semanticName.length > 0);
    assert.equal(part.bounds.dimensions.length, 3);
    assert.ok(part.triangleCount > 0);
    assert.equal(part.materialId, 'm.steel');
  }
  assert.deepEqual(m.parts.map((x) => x.semanticName), ['receiver', 'barrel']);
  p.dispose();
});

test('per-part measurements are distinct, not copies of the asset bounds', () => {
  // This is the evidence an authoring agent actually uses: "the barrel is
  // 1.0m long" beats "the asset is 2.1m long".
  const p = build();
  const m = createAssetPreviewManifest(p);
  const [receiver, barrel] = m.parts;
  assert.notDeepEqual(receiver.bounds.center, barrel.bounds.center);
  assert.notDeepEqual(receiver.bounds.dimensions, m.bounds.dimensions);
  p.dispose();
});

test('anchors appear with positions and owning parts', () => {
  const p = build();
  const m = createAssetPreviewManifest(p);
  assert.equal(m.anchors.length, 1);
  assert.equal(m.anchors[0].name, 'weapon.grip.R');
  assert.equal(m.anchors[0].partId, 'receiver');
  assert.equal(m.anchors[0].orientation, null);
  p.dispose();
});

test('capture planning uses the canonical view solver', () => {
  const p = build();
  const planned = planCanonicalCaptures(p);
  assert.deepEqual(planned.map((c) => c.name), [...CANONICAL_VIEWS]);
  for (const camera of planned) {
    assert.deepEqual([...camera.target], [...p.bounds.center]);
  }
  p.dispose();
});

test('captures record camera pose and environment metadata', () => {
  const p = build();
  const captures = planCanonicalCaptures(p).map((c) => ({
    name: c.name,
    cameraPosition: c.position,
    cameraTarget: c.target,
    up: c.up,
    fovDeg: c.fovDeg,
    viewport: { width: 960, height: 640 },
    environment: { engineRevision: 'abc123', rendererBackend: 'test', dpr: 1 },
    imagePath: `x/${c.name}.png`,
    imageHash: 'deadbeefdeadbeef'
  }));
  const m = createAssetPreviewManifest(p, { captures });
  assert.equal(m.captures.length, 6);
  assert.equal(m.captures[0].environment.rendererBackend, 'test');
  assert.equal(m.captures[0].cameraPosition.length, 3);
  assert.equal(m.captures[0].fovDeg, 35);
  p.dispose();
});

test('manifest encoding is byte identical across repeated builds', () => {
  const a = encodeManifest(createAssetPreviewManifest(build()));
  const b = encodeManifest(createAssetPreviewManifest(build()));
  assert.equal(a, b);
  assert.equal(manifestHash(createAssetPreviewManifest(build())), manifestHash(createAssetPreviewManifest(build())));
});

test('manifest encoding sorts keys so key insertion order cannot change bytes', () => {
  const m = createAssetPreviewManifest(build());
  const reordered = JSON.parse(JSON.stringify(m));
  const shuffled = Object.fromEntries(Object.entries(reordered).reverse());
  assert.equal(encodeManifest(m), encodeManifest(shuffled));
});

test('performance is omitted when nothing was measured, never fabricated', () => {
  const p = build();
  assert.equal('performance' in createAssetPreviewManifest(p), false);
  const withPerf = createAssetPreviewManifest(p, { performance: { generationMs: 4.2 } });
  assert.equal(withPerf.performance.generationMs, 4.2);
  p.dispose();
});

/**
 * Builds a manifest for one previewable at a given viewport, the way the
 * browser route does: captures planned from the MEASURED surface aspect.
 *
 * @param {number} width
 * @param {number} height
 * @returns {object}
 */
function manifestAtViewport(width, height) {
  const p = build();
  const captures = planCanonicalCaptures(p, { aspect: width / height }).map((c) => ({
    name: c.name,
    cameraPosition: c.position,
    cameraTarget: c.target,
    up: c.up,
    fovDeg: c.fovDeg,
    aspect: c.aspect,
    projectedBoundsOccupancy: c.projectedBoundsOccupancy,
    viewport: { width, height },
    environment: { rendererBackend: 'vendor-specific', dpr: width > 1000 ? 2 : 1 },
    imagePath: `x/${c.name}.png`,
    imageHash: `hash-${width}`
  }));
  const manifest = createAssetPreviewManifest(p, { captures });
  p.dispose();
  return manifest;
}

test('portable structural identity is independent of viewport and aspect', () => {
  // THE CONTRACT THIS TRANCHE REPAIRS.
  //
  // The camera solve fits the asset to the viewport aspect, so camera pose,
  // aspect, viewport and projectedBoundsOccupancy all move when a browser
  // window is resized. They previously survived into the "structural" manifest,
  // which meant the same asset from the same source produced a different
  // structural hash at a different window size. A UI viewport is not asset
  // identity.
  const wide = manifestAtViewport(1680, 1180);
  const standard = manifestAtViewport(960, 640);
  const tall = manifestAtViewport(540, 1260);

  const bytes = [wide, standard, tall].map((m) => encodeManifest(structuralManifest(m)));
  assert.equal(bytes[0], bytes[1], 'structural bytes must not depend on viewport');
  assert.equal(bytes[1], bytes[2], 'structural bytes must not depend on aspect');

  const hashes = [wide, standard, tall].map((m) => structuralManifestHash(m));
  assert.equal(new Set(hashes).size, 1, `structural hash differed across viewports: ${hashes.join(', ')}`);
});

test('the observation manifest legitimately differs by viewport without changing asset identity', () => {
  const standard = manifestAtViewport(960, 640);
  const tall = manifestAtViewport(540, 1260);

  // The observation genuinely differs...
  assert.notEqual(manifestHash(standard), manifestHash(tall));
  const sideA = standard.captures.find((c) => c.name === 'right');
  const sideB = tall.captures.find((c) => c.name === 'right');
  assert.notDeepEqual(sideA.cameraPosition, sideB.cameraPosition,
    'a narrow viewport must pull the camera back for a wide asset');
  assert.notDeepEqual(sideA.viewport, sideB.viewport);
  assert.notEqual(sideA.aspect, sideB.aspect);

  // ...while the asset is the same asset.
  assert.equal(structuralManifestHash(standard), structuralManifestHash(tall));
});

test('structuralManifest excludes every capture-dependent field', () => {
  const m = manifestAtViewport(960, 640);
  const s = structuralManifest(m);

  assert.equal('captures' in s, false, 'captures are an observation, not identity');
  assert.equal('performance' in s, false, 'measured timings are machine speed, not identity');

  // What remains is portable asset evidence.
  for (const field of ['manifestVersion', 'source', 'scene', 'bounds', 'geometry', 'parts', 'anchors', 'materials', 'diagnostics']) {
    assert.ok(field in s, `structural manifest must retain ${field}`);
  }
  // And it is not hollowed out: part-level measurement is the point.
  assert.ok(s.parts.length > 0);
  assert.ok(s.parts[0].bounds.dimensions.some((d) => d > 0));
});

test('manifestHash is not redefined: it hashes whatever manifest it is given', () => {
  const m = manifestAtViewport(960, 640);
  assert.equal(manifestHash(m), manifestHash(m));
  assert.notEqual(manifestHash(m), structuralManifestHash(m),
    'the full observation and the portable identity are different hashes');
  assert.equal(structuralManifestHash(m), manifestHash(structuralManifest(m)));
});

test('diagnostics are carried into the manifest', () => {
  const mesh = createBoxMesh({ semanticName: 'plain' });
  const p = createPreviewable({ mesh, materials: [] });
  const m = createAssetPreviewManifest(p);
  assert.ok(m.diagnostics.some((d) => d.code === 'PREVIEW_DEFAULT_MATERIAL'));
  assert.ok(m.diagnostics.every((d) => d.severity && d.code && d.subsystem));
  p.dispose();
});
