/**
 * PUBLIC-SURFACE-001 — the supported package contract.
 *
 * The accepted law (PRD.md §39, ARCHITECTURE.md §49) is:
 *
 *   IMPLEMENTED + ACCEPTED + INTENDED FOR EXTERNAL AUTHORING
 *     -> MUST HAVE A SUPPORTED PUBLIC ROUTE
 *
 * These tests hold the engine to that in both directions: accepted capability
 * must be reachable, and everything else must stay out. A public API that grows
 * by accident is not a contract.
 *
 * Imports here use the PACKAGE SPECIFIER, not repository paths, because that is
 * the thing under test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as pkgFull from '@sumosizedginger/my-game-engine-1.0/full';
import * as pkgRuntime from '@sumosizedginger/my-game-engine-1.0/runtime';
import * as pkgDefault from '@sumosizedginger/my-game-engine-1.0';

// Repository-relative barrels, used ONLY as the reference the package route
// must agree with. If these two ever disagree, the package is lying.
import * as repoFull from '../src/full/index.js';
import * as geometryForge from '../src/geometry/index.js';
import * as characterForge from '../src/character/index.js';
import * as motionForge from '../src/motion/index.js';
import * as worldForge from '../src/world/index.js';

import { buildPublicSurfaceCell } from '../examples/public-surface-cell/cell.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

/** Strips comments so prose cannot be mistaken for an import. */
function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code';
  let quote = '';
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (state === 'code') {
      if (two === '//') { state = 'line'; i += 2; continue; }
      if (two === '/*') { state = 'block'; i += 2; continue; }
      if (source[i] === '"' || source[i] === "'" || source[i] === '`') {
        state = 'string'; quote = source[i];
      }
      out += source[i]; i += 1; continue;
    }
    if (state === 'string') {
      if (source[i] === '\\') { out += source.slice(i, i + 2); i += 2; continue; }
      if (source[i] === quote) state = 'code';
      out += source[i]; i += 1; continue;
    }
    if (state === 'line') {
      if (source[i] === '\n') { state = 'code'; out += '\n'; }
      i += 1; continue;
    }
    if (two === '*/') { state = 'code'; i += 2; continue; }
    i += 1;
  }
  return out;
}

const importsOf = (source) =>
  [...stripComments(source).matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// 1-4. Accepted Forge capability is reachable through engine/full
// ---------------------------------------------------------------------------

/** The deliberate public surface, per subsystem. */
const PUBLIC_FORGE_SURFACE = {
  geometry: [
    'SURFACE_TYPES', 'SURFACE_NAMES', 'CONSTRAINT_FLAGS', 'GEOMETRY_REGIONS',
    'ROOM_PARAMETER_BOUNDS', 'PILLAR_PARAMETER_BOUNDS', 'ROOM_PRESETS',
    'resolveRoomParameters', 'createRoomDefinition', 'generateProceduralRoom'
  ],
  character: [
    'HUMANOID_PARAMETER_BOUNDS', 'HUMANOID_PRESETS', 'resolveHumanoidParameters',
    'createCharacterDefinition', 'computeSemanticLandmarks', 'buildHumanoidCharacter',
    'CHARACTER_REGIONS'
  ],
  motion: [
    'MOTION_PARAMETER_BOUNDS', 'MOTION_PRESETS', 'resolveMotionParameters',
    'createMotionDefinition', 'createLocomotionEvaluator', 'solveTwoBoneIK',
    'computeGaitFootPlacement', 'commitRootMotionIntent'
  ],
  world: [
    'WORLD_PARAMETER_BOUNDS', 'createWorldRecipe', 'worldDataHash',
    'createWorldFieldCache', 'createWorldFieldQuery', 'createWorldVolumeQuery',
    'generateWorld'
  ],
  material: ['MATERIAL_PARAMETER_BOUNDS', 'MATERIAL_PRESETS', 'createMaterialDefinition']
};

for (const [subsystem, names] of Object.entries(PUBLIC_FORGE_SURFACE)) {
  test(`${subsystem} Forge public capability is reachable through the package`, () => {
    for (const name of names) {
      assert.ok(name in pkgFull,
        `${name} must be reachable from @sumosizedginger/my-game-engine-1.0/full`);
      assert.notEqual(pkgFull[name], undefined, `${name} resolved to undefined`);
    }
  });
}

test('the package route and the repository barrel are the same objects', () => {
  // Not merely equal shapes: the SAME binding. A package route that resolved to
  // a second copy of a subsystem would duplicate module state.
  for (const names of Object.values(PUBLIC_FORGE_SURFACE)) {
    for (const name of names) {
      assert.equal(pkgFull[name], repoFull[name], `${name} differs between package and barrel`);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Deliberate internal exclusions remain absent
// ---------------------------------------------------------------------------

test('deliberate exclusions are absent from the public surface', () => {
  const excluded = [
    // Renderer primitives.
    'buildBoxGeometry', 'buildCylinderGeometry', 'mergeSemanticGeometries',
    'createTerrainGeometry', 'compileMaterial', 'toBufferGeometry', 'uniqueMaterialIds',
    // Character assembly steps and deferred attachment vocabulary.
    'createHumanoidGeometry', 'createHumanoidSkeleton', 'applyHumanoidSkinning',
    'BONE_DEFINITIONS', 'BONE_NAME_TO_INDEX',
    // Internal normalization.
    'normalizeColor', 'resolveMaterialParameters',
    // Too generic for a shared namespace; public as CHARACTER_REGIONS.
    'REGIONS',
    // Node-only evaluation machinery.
    'renderCanonicalViews', 'compareCaptureReports'
  ];
  for (const name of excluded) {
    assert.equal(name in pkgFull, false, `${name} must not be public`);
  }
  // And the one that IS public under a different name really is.
  assert.equal(pkgFull.CHARACTER_REGIONS, characterForge.REGIONS);
});

test('exclusions are documented, not merely missing', () => {
  // "We forgot" and "we decided" look identical from outside the package.
  const forges = pkgFull.AUTHORING_SURFACE.forges;
  const documented = Object.values(forges).flatMap((f) => f.notExported);
  const text = documented.map((e) => `${e.name}: ${e.reason}`).join(' | ');

  for (const name of ['buildBoxGeometry', 'createTerrainGeometry', 'compileMaterial',
    'BONE_DEFINITIONS', 'createHumanoidSkeleton']) {
    assert.ok(text.includes(name), `${name} is excluded but undocumented`);
  }
  for (const entry of documented) {
    assert.ok(entry.reason && entry.reason.length > 25,
      `${entry.name} needs a real reason, not a stub`);
  }
});

// ---------------------------------------------------------------------------
// 6-7. Runtime purity and the allowlist
// ---------------------------------------------------------------------------

test('engine/runtime still exposes no authoring Forge capability', () => {
  const forgeNames = Object.values(PUBLIC_FORGE_SURFACE).flat();
  for (const name of forgeNames) {
    assert.equal(name in pkgRuntime, false,
      `engine/runtime must not carry authoring capability: ${name}`);
  }
  // A shipped game plays compiled content; it does not carry the generators.
  for (const name of ['generateWorld', 'generateProceduralRoom', 'buildHumanoidCharacter']) {
    assert.equal(name in pkgDefault, false,
      `the default package export is runtime-oriented and must not carry ${name}`);
  }
});

test('the package default export remains the runtime surface', () => {
  assert.deepEqual(Object.keys(pkgDefault).sort(), Object.keys(pkgRuntime).sort());
  assert.equal(pkgDefault.ENTRY_POINT, 'engine/runtime');
  assert.equal(pkgFull.ENTRY_POINT, 'engine/full');
});

test('engine/full is engine/runtime plus the authoring surface, with no loss', () => {
  for (const name of Object.keys(pkgRuntime)) {
    if (name === 'ENTRY_POINT') continue;
    assert.ok(name in pkgFull, `engine/full lost a runtime export: ${name}`);
  }
});

// ---------------------------------------------------------------------------
// 8-9. AUTHORING_SURFACE describes the new systems, and does not lie
// ---------------------------------------------------------------------------

test('AUTHORING_SURFACE describes every newly supported Forge', () => {
  const forges = pkgFull.AUTHORING_SURFACE.forges;
  assert.deepEqual(Object.keys(forges).sort(),
    ['character', 'geometry', 'material', 'motion', 'world']);

  for (const [key, descriptor] of Object.entries(forges)) {
    assert.ok(descriptor.subsystem, `${key} needs a subsystem name`);
    assert.ok(descriptor.specification, `${key} must name its specification`);
    assert.ok(descriptor.accepted, `${key} must state its accepted provenance`);
    assert.ok(descriptor.publicSince, `${key} must state when it became public`);
    assert.ok(descriptor.capabilities.length > 0);
    assert.ok(descriptor.conventions && descriptor.conventions.length > 40,
      `${key} conventions must actually help an agent call it`);
    assert.ok(Object.isFrozen(descriptor));
    assert.ok(Object.isFrozen(descriptor.capabilities));
  }
});

test('AUTHORING_SURFACE advertises nothing that is not exported', () => {
  // A descriptor an agent cannot trust is worse than no descriptor.
  for (const [key, descriptor] of Object.entries(pkgFull.AUTHORING_SURFACE.forges)) {
    for (const name of descriptor.capabilities) {
      assert.ok(name in pkgFull,
        `AUTHORING_SURFACE.forges.${key} advertises "${name}", which is not exported`);
    }
  }
});

test('every newly public Forge export is advertised', () => {
  // The other direction: a capability nobody can discover may as well not exist.
  const described = new Set(
    Object.values(pkgFull.AUTHORING_SURFACE.forges).flatMap((f) => f.capabilities)
  );
  for (const [subsystem, names] of Object.entries(PUBLIC_FORGE_SURFACE)) {
    for (const name of names) {
      assert.ok(described.has(name),
        `${subsystem} export "${name}" is public but undescribed; an agent cannot discover it`);
    }
  }
});

test('AUTHORING_SURFACE reads presets and bounds from live values', () => {
  // Anti-drift: these must be the real objects' keys, not a copied list.
  const forges = pkgFull.AUTHORING_SURFACE.forges;
  assert.deepEqual([...forges.geometry.presets], Object.keys(geometryForge.ROOM_PRESETS));
  assert.deepEqual([...forges.geometry.parameters], Object.keys(geometryForge.ROOM_PARAMETER_BOUNDS));
  assert.deepEqual([...forges.character.presets], Object.keys(characterForge.HUMANOID_PRESETS));
  assert.deepEqual([...forges.character.parameters], Object.keys(characterForge.HUMANOID_PARAMETER_BOUNDS));
  assert.deepEqual([...forges.motion.presets], Object.keys(motionForge.MOTION_PRESETS));
  assert.deepEqual([...forges.world.parameters], Object.keys(worldForge.WORLD_PARAMETER_BOUNDS));
  assert.ok(forges.geometry.presets.length > 0);
});

test('AUTHORING_SURFACE stays serializable and frozen', () => {
  const json = JSON.stringify(pkgFull.AUTHORING_SURFACE);
  assert.ok(json.length > 2000, 'an agent should be able to be handed this directly');
  assert.ok(Object.isFrozen(pkgFull.AUTHORING_SURFACE.forges));
  assert.ok(json.includes('Character Forge') && json.includes('World Forge'));
});

test('the laws record the public-surface contract', () => {
  const laws = pkgFull.AUTHORING_SURFACE.laws.join(' ');
  assert.match(laws, /engine\/full/);
  assert.match(laws, /deep import/i);
  assert.match(laws, /dispose/i);
});

// ---------------------------------------------------------------------------
// 10. The forcing consumer uses no deep imports — ACCEPTANCE CRITICAL
// ---------------------------------------------------------------------------

test('the forcing consumer imports only supported package routes', () => {
  const dir = 'examples/public-surface-cell';
  const files = fs.readdirSync(path.join(rootDir, dir)).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0, 'the cell must have source files');

  for (const file of files) {
    const source = fs.readFileSync(path.join(rootDir, dir, file), 'utf8');
    for (const specifier of importsOf(source)) {
      const local = specifier.startsWith('.');
      const supported = specifier === '@sumosizedginger/my-game-engine-1.0'
        || specifier === '@sumosizedginger/my-game-engine-1.0/runtime'
        || specifier === '@sumosizedginger/my-game-engine-1.0/full';

      assert.ok(local || supported,
        `${dir}/${file} imports "${specifier}", which is not a supported package route`);
      assert.ok(!/(^|\/)src\//.test(specifier),
        `${dir}/${file} deep-imports engine internals: "${specifier}"`);
      assert.ok(!specifier.includes('three'),
        `${dir}/${file} must not reach the renderer directly: "${specifier}"`);
      if (local) {
        assert.ok(!specifier.includes('..'),
          `${dir}/${file} reaches outside the example: "${specifier}"`);
      }
    }
  }
});

test('the forcing consumer actually exercises all four Forges', () => {
  // A no-deep-import test passes trivially if the consumer does nothing.
  const source = fs.readFileSync(
    path.join(rootDir, 'examples/public-surface-cell/cell.js'), 'utf8');
  const code = stripComments(source);
  for (const capability of ['generateWorld', 'generateProceduralRoom',
    'buildHumanoidCharacter', 'createLocomotionEvaluator', 'solveTwoBoneIK',
    'createWorldFieldQuery', 'commitRootMotionIntent', 'compileScene']) {
    assert.ok(code.includes(capability), `the cell must actually call ${capability}`);
  }
});

// ---------------------------------------------------------------------------
// 11. Package self-reference works in Node
// ---------------------------------------------------------------------------

test('package self-reference resolves in Node for all three entry points', () => {
  // These imports are at the top of this file; reaching here proves resolution.
  assert.equal(typeof pkgFull.buildHumanoidCharacter, 'function');
  assert.equal(typeof pkgRuntime.createRuntime, 'function');
  assert.equal(typeof pkgDefault.createEntityManager, 'function');
  assert.equal(pkgFull.ENGINE_NAME, 'My Game Engine 1.0');
});

test('the package manifest declares exactly the three supported entry points', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './full', './runtime']);
  // PUBLIC-SURFACE-001 must not have invented a forest of subpaths.
  assert.equal(manifest.exports['.'], './src/index.js');
  assert.equal(manifest.exports['./runtime'], './src/runtime/index.js');
  assert.equal(manifest.exports['./full'], './src/full/index.js');
});

// ---------------------------------------------------------------------------
// 13-16. Public-route output matches accepted behaviour
// ---------------------------------------------------------------------------

test('public-route Geometry output matches the accepted subsystem', () => {
  const viaPackage = pkgFull.generateProceduralRoom('small_chamber');
  const viaBarrel = geometryForge.generateProceduralRoom('small_chamber');
  try {
    assert.deepEqual(viaPackage.stats, viaBarrel.stats);
    assert.deepEqual(viaPackage.collision.innerBounds, viaBarrel.collision.innerBounds);
    assert.equal(viaPackage.definition.data.parameters.width,
      viaBarrel.definition.data.parameters.width);
  } finally {
    viaPackage.visual.geometry.dispose();
    viaBarrel.visual.geometry.dispose();
  }
});

test('public-route Character output matches the accepted subsystem', () => {
  const viaPackage = pkgFull.buildHumanoidCharacter('athletic');
  const viaBarrel = characterForge.buildHumanoidCharacter('athletic');
  try {
    assert.deepEqual(viaPackage.parameters, viaBarrel.parameters);
    assert.deepEqual(viaPackage.landmarks, viaBarrel.landmarks);
    assert.equal(viaPackage.bones.length, viaBarrel.bones.length);
  } finally {
    viaPackage.geometry.dispose(); viaPackage.material.dispose();
    viaBarrel.geometry.dispose(); viaBarrel.material.dispose();
  }
});

test('public-route Motion output matches the accepted subsystem', () => {
  const character = pkgFull.buildHumanoidCharacter('average');
  try {
    const a = pkgFull.createLocomotionEvaluator(character, 'natural');
    const b = motionForge.createLocomotionEvaluator(character, 'natural');
    const fa = a.update(1 / 60);
    const fb = b.update(1 / 60);
    assert.equal(fa.phase, fb.phase);
    assert.deepEqual(fa.contactStates, fb.contactStates);
    assert.deepEqual(a.getParameters(), b.getParameters());

    // The pure primitives too.
    const ik = { rootPos: { x: 0, y: 1, z: 0 }, targetPos: { x: 0, y: 0.2, z: 0.1 },
      upperLength: 0.45, lowerLength: 0.42 };
    assert.deepEqual(pkgFull.solveTwoBoneIK(ik), motionForge.solveTwoBoneIK(ik));
  } finally {
    character.geometry.dispose(); character.material.dispose();
  }
});

test('public-route World output matches the accepted subsystem', () => {
  const viaPackage = pkgFull.generateWorld({ seed: 8811, worldSize: 64 });
  const viaBarrel = worldForge.generateWorld({ seed: 8811, worldSize: 64 });
  try {
    assert.deepEqual(viaPackage.hashes, viaBarrel.hashes);
    assert.equal(viaPackage.trees.length, viaBarrel.trees.length);
    assert.equal(viaPackage.cover.length, viaBarrel.cover.length);
    assert.equal(viaPackage.fields.heightAt(3, 3), viaBarrel.fields.heightAt(3, 3));
  } finally {
    viaPackage.dispose();
    viaBarrel.dispose();
  }
});

// ---------------------------------------------------------------------------
// 17-19. Node-only boundary, renderer boundary, scene routes
// ---------------------------------------------------------------------------

test('no Node-only dependency is reachable through the public surface', () => {
  // tests/purity.test.js walks the whole module graph. This asserts the
  // package-level symptom: nothing Node-only leaked into a public name.
  for (const name of ['renderCanonicalViews', 'runBrowserEvaluation', 'ensureServer',
    'findBrowserExecutable', 'decodePng', 'compareImageBuffers']) {
    assert.equal(name in pkgFull, false, `${name} is Node-only evaluation machinery`);
  }
});

test('scene public routes are intact after the Forge additions', () => {
  for (const name of ['createSceneDefinition', 'createSceneNode', 'validateSceneDefinition',
    'compileScene', 'encodeScene', 'decodeScene', 'sceneHash']) {
    assert.ok(name in pkgFull, `scene authoring route lost: ${name}`);
  }
  assert.ok('instantiateScene' in pkgRuntime, 'scene instantiation must stay in the runtime');
  assert.equal('compileScene' in pkgRuntime, false, 'the scene compiler stays out of the runtime');
});

// ---------------------------------------------------------------------------
// API collision safety
// ---------------------------------------------------------------------------

test('no public name resolves ambiguously across subsystems', () => {
  // Several large barrels now share one namespace. A duplicate name would mean
  // one subsystem silently shadowing another.
  const sources = {
    geometry: geometryForge, character: characterForge,
    motion: motionForge, world: worldForge
  };
  const owner = new Map();
  for (const [subsystem, names] of Object.entries(PUBLIC_FORGE_SURFACE)) {
    for (const name of names) {
      assert.equal(owner.has(name), false,
        `"${name}" is claimed by both ${owner.get(name)} and ${subsystem}`);
      owner.set(name, subsystem);
    }
  }

  // Every public name resolves to the binding its own subsystem owns.
  for (const [subsystem, module] of Object.entries(sources)) {
    for (const name of PUBLIC_FORGE_SURFACE[subsystem]) {
      const internal = name === 'CHARACTER_REGIONS' ? 'REGIONS' : name;
      if (!(internal in module)) continue;
      assert.equal(pkgFull[name], module[internal],
        `${name} does not resolve to the ${subsystem} subsystem`);
    }
  }
});

test('the full export set has no duplicate or shadowed names', () => {
  const keys = Object.keys(pkgFull);
  assert.equal(new Set(keys).size, keys.length, 'duplicate export names');
  for (const key of keys) {
    assert.notEqual(pkgFull[key], undefined, `${key} exported as undefined`);
  }
});

// ---------------------------------------------------------------------------
// The forcing consumer composes, and cleans up after itself
// ---------------------------------------------------------------------------

test('the acceptance cell composes four Forges into one coherent result', () => {
  const cell = buildPublicSurfaceCell();
  try {
    const byForge = Object.fromEntries(cell.report.steps.map((s) => [s.forge, s]));
    assert.deepEqual(Object.keys(byForge).sort(),
      ['character', 'geometry', 'motion', 'scene', 'world']);

    // World: generated, and the standalone query layer agrees with it.
    assert.ok(byForge.world.trees > 0);
    assert.equal(byForge.world.standaloneQueryAgrees, true);

    // Geometry: a real room with a usable collision contract.
    assert.ok(byForge.geometry.triangles > 0);
    assert.equal(byForge.geometry.centreWalkable, true);

    // Character: landmarks reproducible from parameters alone.
    assert.ok(byForge.character.bones > 0);
    assert.equal(byForge.character.landmarksReproducible, true);

    // Motion: advanced, committed through the transform, and IK honest.
    assert.equal(byForge.motion.phaseAdvanced, true);
    assert.equal(byForge.motion.rootAdvanced, true);
    assert.ok(byForge.motion.travelledMetres > 0);
    assert.equal(byForge.motion.ikReachable, true);
    assert.equal(byForge.motion.ikRefusesOutOfReach, true,
      'an out-of-reach IK target must be reported, not silently clamped');

    // Scene: composed, and the occupant inherited the room placement.
    assert.equal(byForge.scene.nodes, 4);
    assert.notDeepEqual(byForge.scene.occupantWorld, [0, 0, 0]);

    assert.match(cell.identity, /^[0-9a-f]{16}$/);
  } finally {
    cell.dispose();
  }
});

test('the acceptance cell is deterministic', () => {
  const a = buildPublicSurfaceCell();
  const aIdentity = a.identity;
  const aScene = a.sceneArtifact.artifactHash;
  const aWorld = a.world.hashes.fields;
  a.dispose();

  const b = buildPublicSurfaceCell();
  try {
    assert.equal(b.identity, aIdentity, 'the same seed must produce the same cell');
    assert.equal(b.sceneArtifact.artifactHash, aScene);
    assert.equal(b.world.hashes.fields, aWorld);
  } finally {
    b.dispose();
  }
});

test('the acceptance cell releases the renderer resources it created', () => {
  // Forge results own Three.js resources. An API-routing tranche is no excuse
  // for leaking them.
  const cell = buildPublicSurfaceCell();
  const geometry = cell.character.geometry;
  const material = cell.character.material;
  const terrain = cell.world.terrain;
  const roomGeometry = cell.room.visual.geometry;

  let disposedCount = 0;
  for (const resource of [geometry, material, terrain, roomGeometry]) {
    const original = resource.dispose.bind(resource);
    resource.dispose = () => { disposedCount += 1; original(); };
  }

  cell.dispose();
  assert.equal(cell.disposed, true);
  assert.equal(cell.world.disposed, true);
  assert.equal(disposedCount, 4, 'every owned renderer resource must be disposed');
  assert.equal(cell.sceneInstance.disposed, true);

  // Repeated disposal is safe and does not double-release.
  cell.dispose();
  assert.equal(disposedCount, 4);
});

test('repeated create and dispose cycles do not accumulate', () => {
  const identities = [];
  for (let i = 0; i < 3; i++) {
    const cell = buildPublicSurfaceCell();
    identities.push(cell.identity);
    cell.dispose();
    assert.equal(cell.disposed, true);
  }
  assert.equal(new Set(identities).size, 1, 'each cycle must reproduce the same cell');
});
