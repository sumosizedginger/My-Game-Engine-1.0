import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as runtimeModule from '../src/runtime/index.js';
import * as fullModule from '../src/full/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * POLICY REWRITE — AI-ASSET-FOUNDATION-001.
 *
 * This file previously asserted that engine/full exported NO Forge or compiler
 * system, as a guard against premature surface growth. That policy has been
 * deliberately superseded: section 7.7 of the work order earns a minimal
 * authoring surface, because CINDER MK-I may not deep-import private
 * implementation.
 *
 * The old test would have stayed green while its intent died, since it matched
 * exact names the new exports do not use. Rather than naming around it, the
 * policy is restated as an EXPLICIT ALLOWLIST: adding a public export now
 * requires editing this list on purpose.
 *
 * engine/runtime purity is unchanged and still absolute.
 */

/**
 * POLICY EXTENSION — PUBLIC-SURFACE-001.
 *
 * Geometry room generation, Character Forge, Motion Forge and World Forge are
 * now reachable through engine/full. They were implemented and accepted long
 * before; only the ROUTE is new. The allowlist below grew deliberately, and the
 * exclusion tests grew with it.
 *
 * Two separate guards, because they protect different things.
 */

/** Systems with no implementation at all. Absent everywhere, by definition. */
const UNEARNED_SYSTEMS = ['Kiln', 'kiln', 'SkeletonForge'];

/**
 * Namespace-object names the public surface deliberately does NOT use.
 *
 * The Forges ARE public now, as flat named exports. These names stay free so a
 * future change cannot quietly add a second way to reach the same capability:
 * two routes to one thing is two contracts, and they drift.
 */
const FORBIDDEN_NAMESPACE_NAMES = [
  'GeometryForge', 'CharacterForge', 'MotionForge', 'MaterialForge', 'WorldForge'
];

/** Everything engine/runtime must never expose. */
const RUNTIME_FORBIDDEN = [
  ...UNEARNED_SYSTEMS,
  ...FORBIDDEN_NAMESPACE_NAMES,
  'compile', 'compileDefinition', 'createMesh', 'createBoxMesh', 'createPreviewable',
  // Scene AUTHORING and COMPILATION belong to engine/full. An exported game
  // instantiates compiled scenes; it does not carry the scene compiler.
  'compileScene', 'createSceneDefinition', 'createSceneNode',
  'validateSceneDefinition', 'encodeScene', 'decodeScene',
  // Forge GENERATION belongs to engine/full too. A shipped game plays compiled
  // content; it does not carry the generators that produced it. PUBLIC-SURFACE-001
  // widened engine/full, not engine/runtime.
  'generateProceduralRoom', 'createRoomDefinition', 'ROOM_PRESETS',
  'buildHumanoidCharacter', 'createCharacterDefinition', 'HUMANOID_PRESETS',
  'createLocomotionEvaluator', 'createMotionDefinition', 'MOTION_PRESETS',
  'generateWorld', 'createWorldRecipe', 'createWorldFieldQuery',
  'createMaterialDefinition', 'MATERIAL_PRESETS'
];

/**
 * The complete authoring surface engine/full is permitted to add on top of the
 * runtime re-export. Earned by AI-ASSET-FOUNDATION-001. Widening this list is a
 * deliberate act requiring human authorization.
 */
const ALLOWED_FULL_ADDITIONS = new Set([
  // Definition seam (pre-existing).
  'compileDefinition', 'createEngineFull',
  // MeshIR.
  'MESH_IR_VERSION', 'MESH_UNITS', 'MESH_UP_AXIS', 'MESH_FORWARD_AXIS',
  'createMesh', 'createPart', 'validateMesh', 'enforceValidMesh',
  'meshBounds', 'triangleCount', 'vertexCount',
  // Canonical artifact identity.
  'MESH_CODEC_VERSION', 'encodeMesh', 'meshHash',
  // Modeling verbs.
  'createBoxMesh', 'createCylinderMesh', 'extrudeProfile', 'transformMesh', 'mergeMeshIR',
  // Generic semantics.
  'createAnchor', 'identityTransform',
  // Material Forge definitions.
  'createMaterialDefinition', 'MATERIAL_PRESETS',
  // Preview.
  'createPreviewable', 'previewArtifact', 'createPreviewLab',
  'PREVIEW_BUDGET_DEFAULTS', 'evaluatePreviewBudget', 'enforcePreviewBudget',
  // Canonical views: solver only.
  'CANONICAL_VIEWS', 'CANONICAL_VIEW_DIRECTIONS', 'CANONICAL_VIEW_UP', 'AXIS_VECTORS',
  'semanticFrame', 'resolveCanonicalViewDirections', 'resolveCanonicalViewUps',
  'solveCanonicalView', 'solveAllCanonicalViews',
  // Versioned inspection illumination contract.
  'INSPECTION_RIG', 'inspectionLightFrame',
  // Manifest.
  'MANIFEST_VERSION', 'createAssetPreviewManifest', 'planCanonicalCaptures',
  'encodeManifest', 'manifestHash', 'structuralManifest', 'structuralManifestHash',
  // Discoverability.
  'AUTHORING_SURFACE',
  // Scene composition authoring, earned by SCENE-COMPOSITION-001. The runtime
  // half (instantiateScene, liveSceneInstanceCount) is a runtime export and is
  // therefore not listed here.
  'SCENE_DEFINITION_VERSION', 'SCENE_UNITS', 'SCENE_UP_AXIS', 'SCENE_FORWARD_AXIS',
  'SCENE_MAX_NODES', 'IDENTITY_TRANSFORM', 'createLocalTransform',
  'createSceneNode', 'createSceneDefinition',
  'validateSceneDefinition', 'enforceValidSceneDefinition',
  'SCENE_CODEC_VERSION', 'SCENE_CODEC_MAGIC', 'encodeScene', 'decodeScene', 'sceneHash',
  'SCENE_ARTIFACT_VERSION', 'compileScene',
  'identityMatrix', 'matrixFromTRS', 'multiplyMatrices', 'transformPoint',
  'translationOf', 'hasShear',

  // ---- PUBLIC-SURFACE-001: accepted Forge capability -------------------
  // Geometry Forge: room generation and its semantic vocabulary.
  'SURFACE_TYPES', 'SURFACE_NAMES', 'CONSTRAINT_FLAGS', 'GEOMETRY_REGIONS',
  'ROOM_PARAMETER_BOUNDS', 'PILLAR_PARAMETER_BOUNDS', 'ROOM_PRESETS',
  'resolveRoomParameters', 'createRoomDefinition', 'generateProceduralRoom',
  // Character Forge. CHARACTER_REGIONS is the package name for the
  // subsystem's internal `REGIONS`, which is too generic for a shared namespace.
  'HUMANOID_PARAMETER_BOUNDS', 'HUMANOID_PRESETS', 'resolveHumanoidParameters',
  'createCharacterDefinition', 'computeSemanticLandmarks', 'buildHumanoidCharacter',
  'CHARACTER_REGIONS',
  // Motion Forge.
  'MOTION_PARAMETER_BOUNDS', 'MOTION_PRESETS', 'resolveMotionParameters',
  'createMotionDefinition', 'createLocomotionEvaluator', 'solveTwoBoneIK',
  'computeGaitFootPlacement', 'commitRootMotionIntent',
  // World Forge.
  'WORLD_PARAMETER_BOUNDS', 'createWorldRecipe', 'worldDataHash',
  'createWorldFieldCache', 'createWorldFieldQuery', 'createWorldVolumeQuery',
  'generateWorld',
  // Material Forge: bounds discovery, matching every other Forge.
  'MATERIAL_PARAMETER_BOUNDS'
]);

/**
 * Capability that stays INTERNAL after PUBLIC-SURFACE-001, with the reason.
 *
 * Listed rather than merely absent, because "we forgot" and "we decided" look
 * identical from outside. Each is asserted absent below.
 */
const DELIBERATE_EXCLUSIONS = {
  // Renderer primitives. A Forge result may CARRY renderer output; handing
  // authors the builders would freeze presentation into the public contract.
  buildBoxGeometry: 'renderer primitive',
  buildCylinderGeometry: 'renderer primitive',
  mergeSemanticGeometries: 'renderer primitive',
  createTerrainGeometry: 'renderer primitive; generateWorld already returns the terrain',
  compileMaterial: 'returns a Three.js material; same class as toBufferGeometry',
  // Character assembly steps that buildHumanoidCharacter composes.
  createHumanoidGeometry: 'assembly step',
  createHumanoidSkeleton: 'assembly step',
  applyHumanoidSkinning: 'assembly step',
  // Deferred, not rejected.
  BONE_DEFINITIONS: 'deferred; a built character exposes bonesByName',
  BONE_NAME_TO_INDEX: 'deferred; a built character exposes bonesByName',
  // Internal normalization createMaterialDefinition already performs.
  normalizeColor: 'internal normalization',
  resolveMaterialParameters: 'internal normalization',
  // The overly generic internal name. CHARACTER_REGIONS is the public one.
  REGIONS: 'too generic for a shared namespace; exported as CHARACTER_REGIONS'
};

/**
 * Modules forming the engine-owned authoring geometry layer. These must be
 * renderer-independent.
 *
 * NOTE the deliberate narrowness: there is NO repository-wide rule that only
 * src/render may import Three.js. Character Forge, Motion Forge and the game
 * renderers legitimately do, and are not part of this tranche.
 * See `Next step.md` Decision 6.
 */
const RENDERER_INDEPENDENT_MODULES = [
  'src/geometry/mesh.js',
  'src/geometry/mesh-ops.js',
  'src/geometry/mesh-codec.js',
  'src/geometry/anchors.js',
  // SCENE-COMPOSITION-001: a scene is engine data, never a renderer scene
  // graph. If any of these ever import Three.js, the claim that rendering
  // CONSUMES a scene rather than owning one has quietly become false.
  'src/scene/definition.js',
  'src/scene/validation.js',
  'src/scene/codec.js',
  'src/scene/compiler.js',
  'src/scene/instance.js',
  'src/scene/affine.js',
  'src/scene/index.js'
];

/** Node-only specifiers that must never be reachable from engine/full. */
const NODE_ONLY_SPECIFIERS = ['puppeteer-core', 'node:fs', 'node:path', 'node:child_process', 'node:url'];

/**
 * Reads a repository source file.
 *
 * @param {string} relativePath
 * @returns {string}
 */
function readSource(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

/**
 * Extracts every module specifier imported or re-exported by a source file.
 *
 * @param {string} source
 * @returns {Array<string>}
 */
function moduleSpecifiers(source) {
  return [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Walks the local module graph reachable from an entry file.
 *
 * @param {string} entryRelativePath
 * @returns {{files: Set<string>, externals: Set<string>}}
 */
function reachableGraph(entryRelativePath) {
  const files = new Set();
  const externals = new Set();
  const queue = [entryRelativePath];

  while (queue.length > 0) {
    const current = queue.pop();
    if (files.has(current)) continue;
    files.add(current);

    const source = readSource(current);
    for (const specifier of moduleSpecifiers(source)) {
      if (specifier.startsWith('.')) {
        const resolved = path
          .relative(rootDir, path.resolve(path.dirname(path.join(rootDir, current)), specifier))
          .replace(/\\/g, '/');
        queue.push(resolved);
      } else {
        externals.add(specifier);
      }
    }
  }

  return { files, externals };
}

test('runtime purity: engine/runtime exports no compiler, Forge or authoring system', () => {
  for (const name of RUNTIME_FORBIDDEN) {
    assert.equal(
      name in runtimeModule,
      false,
      `engine/runtime must not export: ${name}`
    );
  }
});

test('runtime purity: runtime source does not import from full engine', () => {
  const runtimeSource = readSource('src/runtime/index.js');
  assert.equal(runtimeSource.includes('../full'), false, 'src/runtime must not import from src/full');
  assert.equal(runtimeSource.includes('Kiln'), false, 'src/runtime source must not mention Kiln');
});

test('full purity: unearned systems are still absent from engine/full', () => {
  for (const name of UNEARNED_SYSTEMS) {
    assert.equal(
      name in fullModule,
      false,
      `engine/full must not export unearned system: ${name}`
    );
  }
});

test('full purity: the Forges are flat named exports, not namespace objects', () => {
  // PUBLIC-SURFACE-001 made these systems public. It deliberately did NOT
  // introduce namespace objects, so these names must stay free.
  for (const name of FORBIDDEN_NAMESPACE_NAMES) {
    assert.equal(fullModule[name], undefined,
      `engine/full must not add a "${name}" namespace: the surface is flat named exports`);
    assert.equal(runtimeModule[name], undefined);
  }
});

test('full purity: deliberate exclusions stay excluded, with recorded reasons', () => {
  for (const [name, reason] of Object.entries(DELIBERATE_EXCLUSIONS)) {
    assert.equal(name in fullModule, false,
      `engine/full must not export ${name} (${reason})`);
  }
});

test('full purity: every engine/full export is runtime-derived or explicitly allowlisted', () => {
  const runtimeNames = new Set(Object.keys(runtimeModule));
  const unexpected = Object.keys(fullModule).filter(
    (name) => !runtimeNames.has(name) && !ALLOWED_FULL_ADDITIONS.has(name)
  );
  assert.deepEqual(
    unexpected,
    [],
    'engine/full grew a public export that was never authorized. ' +
    'Add it to ALLOWED_FULL_ADDITIONS deliberately, or remove it. ' +
    `Unexpected: ${unexpected.join(', ')}`
  );
});

test('full purity: the allowlist does not carry names that no longer exist', () => {
  const actual = new Set(Object.keys(fullModule));
  const stale = [...ALLOWED_FULL_ADDITIONS].filter((name) => !actual.has(name));
  assert.deepEqual(stale, [], `allowlist is stale, these are no longer exported: ${stale.join(', ')}`);
});

test('full purity: the renderer adapter is NOT public', () => {
  // Decision 10. Authors work in MeshIR and Previewable, not BufferGeometry.
  assert.equal('toBufferGeometry' in fullModule, false);
  assert.equal('uniqueMaterialIds' in fullModule, false);
  const notExported = fullModule.AUTHORING_SURFACE.notExported.map((x) => x.name);
  assert.ok(notExported.includes('toBufferGeometry'), 'the exclusion must be documented for agents');
});

test('full purity: Node-only evaluation machinery is NOT public', () => {
  // Decision 9.
  assert.equal('renderCanonicalViews' in fullModule, false);
  assert.equal('runBrowserEvaluation' in fullModule, false);
  assert.equal('probeCinderDeterminism' in fullModule, false);
});

test('full purity: no module reachable from engine/full imports Node-only machinery', () => {
  const { externals, files } = reachableGraph('src/full/index.js');
  for (const specifier of NODE_ONLY_SPECIFIERS) {
    assert.equal(
      externals.has(specifier),
      false,
      `engine/full reaches "${specifier}" through its module graph; ` +
      'importing the authoring surface must not drag Node machinery into a browser bundle. ' +
      `Reachable files: ${files.size}`
    );
  }
  assert.equal(externals.has('three'), true, 'the preview surface legitimately depends on three');
});

test('authoring layer purity: the MeshIR modules are renderer-independent', () => {
  // Decision 6, deliberately narrow.
  for (const relativePath of RENDERER_INDEPENDENT_MODULES) {
    const specifiers = moduleSpecifiers(readSource(relativePath));
    assert.equal(
      specifiers.includes('three'),
      false,
      `${relativePath} must not import three; conversion happens only at the designated adapter boundary`
    );
  }
});

test('authoring layer purity: exactly one designated adapter performs the conversion', () => {
  const adapter = readSource('src/render/mesh-adapter.js');
  assert.ok(moduleSpecifiers(adapter).includes('three'), 'the adapter is the module allowed to import three');
  assert.match(adapter, /export function toBufferGeometry/);
});

test('authoring layer purity: existing Three.js use elsewhere is untouched by this rule', () => {
  // Guard against over-reach. These modules legitimately import three and are
  // NOT part of this tranche; a future contributor must not "tidy" them into
  // the adapter rule.
  for (const relativePath of ['src/character/index.js', 'src/world/index.js', 'src/browser/b1-viewer.js']) {
    assert.ok(
      moduleSpecifiers(readSource(relativePath)).includes('three'),
      `${relativePath} is expected to keep importing three`
    );
  }
});

test('full engine re-exports runtime capability without duplication', () => {
  assert.equal(fullModule.createRuntime, runtimeModule.createRuntime);
  assert.equal(fullModule.instantiate, runtimeModule.instantiate);
  assert.equal(fullModule.createDiagnostic, runtimeModule.createDiagnostic);
  assert.equal(fullModule.ENGINE_NAME, runtimeModule.ENGINE_NAME);
  assert.equal(fullModule.CANONICAL_REPOSITORY, runtimeModule.CANONICAL_REPOSITORY);

  assert.equal(runtimeModule.ENTRY_POINT, 'engine/runtime');
  assert.equal(fullModule.ENTRY_POINT, 'engine/full');
});
