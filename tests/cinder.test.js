import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCinder } from '../examples/authoring/cinder-mk1/build.js';
import { CINDER_PARAMETERS, REGION, SURFACE } from '../examples/authoring/cinder-mk1/definition.js';
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

/**
 * Removes comments so a source scan reads CODE rather than prose.
 *
 * The import-specifier scan below previously ran over raw source and matched
 * the words `from "a plated assembly"` inside an explanatory comment, failing
 * the build for an import that does not exist. A source-policy test that can
 * be broken by writing an English sentence is not enforcing the policy.
 *
 * String literals are tracked so a quote inside code is never mistaken for a
 * comment delimiter. Regex literals are not tracked; neither CINDER file
 * contains one, and the `no raw vertex data` test keeps scanning full source.
 *
 * @param {string} source
 * @returns {string} Source with comments removed.
 */
function stripComments(source) {
  let out = '';
  let state = 'code';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") state = 'single';
      else if (c === '"') state = 'double';
      else if (c === '`') state = 'template';
      out += c; i += 1; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
      i += 1; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; i += 2; } else { i += 1; }
      continue;
    }
    if (c === '\\') { out += c + (d ?? ''); i += 2; continue; }
    if ((state === 'single' && c === "'") ||
        (state === 'double' && c === '"') ||
        (state === 'template' && c === '`')) {
      state = 'code';
    }
    out += c; i += 1;
  }
  return out;
}

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
  // Assemblies are matched by NAMESPACE rather than by one exact part name.
  // The asset now decomposes each assembly into several named pieces
  // (`receiver.lower.core`, `receiver.upper.deck`, ...), so requiring a single
  // part literally called `receiver` would force the decomposition to stay
  // coarse. Requiring the namespace is the stronger check: it proves both that
  // the assembly exists and that its parts are hierarchically named.
  const names = buildCinder().meshIR.parts.map((p) => p.semanticName);
  for (const assembly of ['receiver', 'barrel', 'handguard', 'stock', 'magazine', 'optic', 'grip', 'muzzle']) {
    assert.ok(
      names.some((n) => n === assembly || n.startsWith(`${assembly}.`)),
      `missing assembly: ${assembly}`
    );
  }
  assert.ok(names.includes('optic.body'), 'the optic must still name its body part');
});

test('CINDER part names form a consistent hierarchy', () => {
  const names = buildCinder().meshIR.parts.map((p) => p.semanticName);
  for (const name of names) {
    assert.match(name, /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/,
      `"${name}" is not a dotted lowerCamel namespace path`);
  }
  // Repeated detail must be indexed with a stable fixed width, or manifests
  // and diffs sort `.10` before `.2`.
  const indexed = names.filter((n) => /\.\d+$/.test(n));
  assert.ok(indexed.length > 20, 'the asset should carry repeated indexed detail');
  for (const name of indexed) {
    assert.match(name, /\.\d{2}$/, `"${name}" must use a two-digit index`);
  }
});

test('CINDER parts carry semantic region and surface identity', () => {
  const { meshIR } = buildCinder();
  const regions = new Set(Object.values(REGION));
  const surfaces = new Set(Object.values(SURFACE));
  const seenRegions = new Set();
  const seenSurfaces = new Set();

  const { regionId, surfaceId } = meshIR.attributes;
  assert.ok(regionId, 'regionId attribute must be present');
  assert.ok(surfaceId, 'surfaceId attribute must be present');

  for (const part of meshIR.parts) {
    const vertex = meshIR.indices[part.indexStart];
    const region = regionId[vertex];
    const surface = surfaceId[vertex];
    assert.ok(regions.has(region), `${part.semanticName} has unknown regionId ${region}`);
    assert.ok(surfaces.has(surface), `${part.semanticName} has unknown surfaceId ${surface}`);
    seenRegions.add(region);
    seenSurfaces.add(surface);
  }

  assert.ok(seenRegions.size >= 8, `expected most regions used, saw ${seenRegions.size}`);
  assert.ok(seenSurfaces.size >= 6, `expected most surfaces used, saw ${seenSurfaces.size}`);
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
  // The exact family count is ART and may change freely. What the pipeline
  // requires is that there are several distinct families, that they all come
  // from Material Forge, that they stay inside the preview budget, and that
  // every part references one that exists.
  assert.ok(materials.length >= 4, `expected several material families, got ${materials.length}`);
  assert.ok(materials.length <= PREVIEW_BUDGET_DEFAULTS.maxMaterials,
    `${materials.length} families exceeds the preview budget`);
  assert.equal(new Set(materials.map((m) => m.id)).size, materials.length, 'material ids must be unique');
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
  assert.equal(new Set(names).size, names.length, 'anchor names must be unique');
  for (const expected of ['weapon.muzzle', 'weapon.grip.primary', 'weapon.grip.support', 'weapon.magazineSocket', 'weapon.opticSocket', 'weapon.sightLine', 'weapon.stock.buttPlate', 'weapon.chargingHandle']) {
    assert.ok(names.includes(expected), `missing anchor: ${expected}`);
  }
  // Anchors survived transform and merge with their owning part intact.
  const muzzle = meshIR.anchors.find((a) => a.name === 'weapon.muzzle');
  assert.equal(muzzle.partId, 'muzzle.crown');
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
    const code = stripComments(source);
    const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.ok(imports.length > 0, `${file} should declare at least one import`);
    for (const specifier of imports) {
      const isPublicPackage = specifier === '@sumosizedginger/my-game-engine-1.0/full';
      const isLocal = specifier.startsWith('./');
      assert.ok(isPublicPackage || isLocal,
        `${file} imports "${specifier}"; CINDER may only use the public package export or its own local files`);
    }
    assert.equal(code.includes('../../src/'), false, `${file} must not deep-import engine internals`);
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
  // Every assembly group must itself be frozen, or "parameters are data" is
  // true only at the top level and an agent can still mutate a nested group.
  for (const [group, value] of Object.entries(CINDER_PARAMETERS)) {
    assert.ok(Object.isFrozen(value), `CINDER_PARAMETERS.${group} must be frozen`);
    for (const [key, number] of Object.entries(value)) {
      assert.ok(Number.isFinite(number), `CINDER_PARAMETERS.${group}.${key} must be a finite number`);
    }
  }
  assert.ok(CINDER_PARAMETERS.barrel.radius > 0);
  assert.ok(CINDER_PARAMETERS.lower.width > 0);
  assert.ok(CINDER_PARAMETERS.datum.receiverRearZ > CINDER_PARAMETERS.datum.receiverFrontZ);
});

test('CINDER reports its generation time', () => {
  const { generationMs, meshIR } = buildCinder();
  assert.ok(Number.isFinite(generationMs));
  assert.ok(generationMs >= 0);
  assert.ok(triangleCount(meshIR) > 0);
});
