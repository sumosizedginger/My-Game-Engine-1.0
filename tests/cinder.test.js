import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCinder } from '../examples/authoring/cinder-mk1/build.js';
import { CINDER_PARAMETERS } from '../examples/authoring/cinder-mk1/definition.js';
import { validateMesh, triangleCount } from '../src/geometry/mesh.js';
import { meshHash, encodeMesh, bytesToHex } from '../src/geometry/mesh-codec.js';
import { createPreviewable } from '../src/preview/previewable.js';
import {
  createAssetPreviewManifest,
  planCanonicalCaptures,
  encodeManifest
} from '../src/preview/manifest.js';
import { PREVIEW_BUDGET_DEFAULTS } from '../src/preview/budget.js';

/**
 * CINDER MK-I pipeline acceptance.
 *
 * These assertions gate AI-ASSET-FOUNDATION-001. They deliberately measure the
 * PIPELINE, not the art: triangle counts and silhouettes are the human's
 * judgement and may change freely without reopening the architecture.
 */

const MINIMUM_PARTS = 6;

test('CINDER is structurally valid', () => {
  const { meshIR } = buildCinder();
  const { valid, diagnostics } = validateMesh(meshIR);
  assert.equal(valid, true, JSON.stringify(diagnostics));
});

test('CINDER has at least six semantically named parts', () => {
  const { meshIR } = buildCinder();
  assert.ok(meshIR.parts.length >= MINIMUM_PARTS, `expected >= ${MINIMUM_PARTS} parts, got ${meshIR.parts.length}`);
  for (const part of meshIR.parts) {
    assert.ok(part.semanticName && part.semanticName.trim().length > 0, `part ${part.id} is unnamed`);
    assert.equal(/^part_\d+$/.test(part.semanticName), false, `part name "${part.semanticName}" is anonymous`);
  }
  const names = meshIR.parts.map((p) => p.semanticName);
  assert.equal(new Set(names).size, names.length, 'part names must be unique');
});

test('CINDER covers the expected weapon decomposition', () => {
  const names = buildCinder().meshIR.parts.map((p) => p.semanticName);
  for (const expected of ['receiver', 'barrel', 'handguard', 'stock', 'magazine', 'optic.body']) {
    assert.ok(names.includes(expected), `missing part: ${expected}`);
  }
});

test('every CINDER part appears in the manifest with name, bounds, triangles and material', () => {
  const result = buildCinder();
  const previewable = createPreviewable({
    mesh: result.meshIR,
    materials: result.materials,
    type: 'weapon',
    generationMs: result.generationMs
  });
  const manifest = createAssetPreviewManifest(previewable);

  assert.equal(manifest.parts.length, result.meshIR.parts.length);
  for (const part of manifest.parts) {
    assert.ok(part.semanticName.length > 0);
    assert.equal(part.bounds.dimensions.length, 3);
    assert.ok(part.bounds.dimensions.some((d) => d > 0), `${part.semanticName} has zero extent`);
    assert.ok(part.triangleCount > 0);
    assert.ok(part.materialId, `${part.semanticName} has no material identity`);
  }
  previewable.dispose();
});

test('CINDER surface appearance comes from Material Forge', () => {
  const { materials, meshIR } = buildCinder();
  assert.equal(materials.length, 4, 'four material families');
  for (const definition of materials) {
    assert.equal(definition.type, 'material');
    assert.ok(definition.data.parameters);
  }
  const materialIds = new Set(materials.map((m) => m.id));
  for (const part of meshIR.parts) {
    assert.ok(materialIds.has(part.materialId), `${part.semanticName} references unknown material ${part.materialId}`);
  }
});

test('CINDER carries the semantic anchors a weapon needs', () => {
  const { meshIR } = buildCinder();
  const names = meshIR.anchors.map((a) => a.name);
  for (const expected of ['weapon.muzzle', 'weapon.grip.R', 'weapon.grip.L', 'weapon.magazineSocket', 'weapon.opticSocket']) {
    assert.ok(names.includes(expected), `missing anchor: ${expected}`);
  }
  // Anchors survived transform and merge with their owning part intact.
  const muzzle = meshIR.anchors.find((a) => a.name === 'weapon.muzzle');
  assert.equal(muzzle.partId, 'muzzleBrake');
  assert.ok(muzzle.position[2] < -0.4, 'muzzle should sit forward along -Z');
  for (const anchor of meshIR.anchors) {
    assert.ok(meshIR.parts.some((p) => p.id === anchor.partId), `${anchor.name} references a missing part`);
  }
});

test('CINDER geometry is plausible for a rifle in metres', () => {
  const { meshIR } = buildCinder();
  const [w, h, l] = meshIR.bounds.dimensions;
  assert.ok(l > 0.7 && l < 1.4, `length ${l}m`);
  assert.ok(h > 0.15 && h < 0.5, `height ${h}m`);
  assert.ok(w > 0.03 && w < 0.2, `width ${w}m`);
  assert.equal(meshIR.units, 'm');
});

test('CINDER MeshIR encoding and hash are deterministic', () => {
  const a = buildCinder().meshIR;
  const b = buildCinder().meshIR;
  assert.equal(meshHash(a), meshHash(b));
  assert.equal(bytesToHex(encodeMesh(a)), bytesToHex(encodeMesh(b)));
});

test('CINDER canonical manifest is byte identical across repeated clean builds', () => {
  const encode = () => {
    const result = buildCinder();
    const previewable = createPreviewable({
      mesh: result.meshIR,
      materials: result.materials,
      type: 'weapon'
    });
    const captures = planCanonicalCaptures(previewable, { aspect: 960 / 640 }).map((c) => ({
      name: c.name,
      cameraPosition: c.position,
      cameraTarget: c.target,
      up: c.up,
      fovDeg: c.fovDeg,
      viewport: { width: 960, height: 640 }
    }));
    const json = encodeManifest(createAssetPreviewManifest(previewable, { captures }));
    previewable.dispose();
    return json;
  };
  assert.equal(encode(), encode());
});

test('CINDER produces no BLOCKING diagnostics', () => {
  const result = buildCinder();
  const previewable = createPreviewable({
    mesh: result.meshIR,
    materials: result.materials,
    type: 'weapon'
  });
  const blocking = previewable.diagnostics.filter((d) => d.severity === 'ERROR' || d.severity === 'FATAL');
  assert.deepEqual(blocking, [], JSON.stringify(blocking));
  previewable.dispose();
});

test('CINDER stays within the declared preview safety budget', () => {
  const result = buildCinder();
  const previewable = createPreviewable({
    mesh: result.meshIR,
    materials: result.materials,
    type: 'weapon',
    generationMs: result.generationMs
  });
  assert.equal(previewable.budgetReport.withinBudget, true);
  assert.ok(previewable.stats.triangles <= PREVIEW_BUDGET_DEFAULTS.maxTriangles);
  assert.ok(previewable.stats.parts <= PREVIEW_BUDGET_DEFAULTS.maxParts);
  assert.ok(previewable.stats.materials <= PREVIEW_BUDGET_DEFAULTS.maxMaterials);
  previewable.dispose();
});

test('CINDER disposes and recreates cleanly', () => {
  for (let i = 0; i < 3; i++) {
    const result = buildCinder();
    const previewable = createPreviewable({
      mesh: result.meshIR,
      materials: result.materials,
      type: 'weapon'
    });
    assert.equal(previewable.disposed, false);
    previewable.dispose();
    assert.equal(previewable.disposed, true);
    previewable.dispose();
    assert.equal(previewable.disposed, true);
  }
});

test('CINDER embeds no pre-generated geometry: every vertex comes from an engine verb', async () => {
  const fs = await import('node:fs');
  for (const file of ['build.js', 'definition.js']) {
    const source = fs.readFileSync(new URL(`../examples/authoring/cinder-mk1/${file}`, import.meta.url), 'utf8');
    assert.equal(/Float32Array|Uint32Array|Uint16Array/.test(source), false,
      `${file} must not embed raw vertex data`);
    assert.equal(/\.glb|\.gltf|\.obj|\.fbx/.test(source), false,
      `${file} must not reference an imported asset file`);
  }
});

test('CINDER authors through the public package export, not private deep imports', async () => {
  const fs = await import('node:fs');
  for (const file of ['build.js', 'definition.js']) {
    const source = fs.readFileSync(new URL(`../examples/authoring/cinder-mk1/${file}`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const specifier of imports) {
      const isPublicPackage = specifier === '@sumosizedginger/my-game-engine-1.0/full';
      const isLocal = specifier.startsWith('./');
      assert.ok(isPublicPackage || isLocal,
        `${file} imports "${specifier}"; CINDER may only use the public package export or its own local files`);
    }
    assert.equal(source.includes('../../src/'), false, `${file} must not deep-import engine internals`);
  }
});

test('CINDER does not touch the renderer: authoring output is pure data', async () => {
  const fs = await import('node:fs');
  for (const file of ['build.js', 'definition.js']) {
    const source = fs.readFileSync(new URL(`../examples/authoring/cinder-mk1/${file}`, import.meta.url), 'utf8');
    assert.equal(/from\s+['"]three['"]/.test(source), false, `${file} must not import three`);
    assert.equal(/BufferGeometry|THREE\./.test(source), false, `${file} must not reference renderer types`);
  }
  const { meshIR, materials } = buildCinder();
  assert.equal(meshIR.attributes.position.constructor.name, 'Float32Array');
  assert.equal('object3D' in meshIR, false, 'authoring output must carry no renderer object');
  assert.ok(Array.isArray(materials));
});

test('CINDER parameters stay data, so an agent can revise numbers rather than code', () => {
  assert.ok(Object.isFrozen(CINDER_PARAMETERS));
  assert.ok(CINDER_PARAMETERS.barrel.length > 0);
  assert.ok(CINDER_PARAMETERS.receiver.width > 0);
});

test('CINDER reports its generation time', () => {
  const { generationMs, meshIR } = buildCinder();
  assert.ok(Number.isFinite(generationMs));
  assert.ok(generationMs >= 0);
  assert.ok(triangleCount(meshIR) > 0);
});
