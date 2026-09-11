import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANIFEST_VERSION,
  createAssetPreviewManifest,
  planCanonicalCaptures,
  encodeManifest,
  manifestHash,
  structuralManifest
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

test('structuralManifest strips volatile capture environment for cross-machine comparison', () => {
  const p = build();
  const captures = planCanonicalCaptures(p).map((c) => ({
    name: c.name,
    cameraPosition: c.position,
    cameraTarget: c.target,
    up: c.up,
    fovDeg: c.fovDeg,
    viewport: { width: 960, height: 640 },
    environment: { rendererBackend: 'vendor-specific', dpr: 2 },
    imageHash: 'aaaa'
  }));
  const m = createAssetPreviewManifest(p, { captures });
  const s = structuralManifest(m);
  assert.equal(s.captures[0].environment, undefined);
  assert.equal(s.captures[0].imageHash, undefined);
  // Camera pose survives: it is asset identity, not machine identity.
  assert.deepEqual(s.captures[0].cameraPosition, m.captures[0].cameraPosition);
  p.dispose();
});

test('diagnostics are carried into the manifest', () => {
  const mesh = createBoxMesh({ semanticName: 'plain' });
  const p = createPreviewable({ mesh, materials: [] });
  const m = createAssetPreviewManifest(p);
  assert.ok(m.diagnostics.some((d) => d.code === 'PREVIEW_DEFAULT_MATERIAL'));
  assert.ok(m.diagnostics.every((d) => d.severity && d.code && d.subsystem));
  p.dispose();
});
