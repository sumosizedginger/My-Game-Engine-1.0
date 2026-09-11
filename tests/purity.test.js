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

/** Systems that remain unearned at any public entry point. */
const UNEARNED_SYSTEMS = [
  'Kiln', 'kiln',
  'GeometryForge', 'CharacterForge', 'MotionForge', 'MaterialForge', 'WorldForge', 'SkeletonForge'
];

/** Everything engine/runtime must never expose. */
const RUNTIME_FORBIDDEN = [...UNEARNED_SYSTEMS, 'compile', 'compileDefinition', 'createMesh', 'createBoxMesh', 'createPreviewable'];

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
  'CANONICAL_VIEWS', 'CANONICAL_VIEW_DIRECTIONS', 'solveCanonicalView', 'solveAllCanonicalViews',
  // Manifest.
  'MANIFEST_VERSION', 'createAssetPreviewManifest', 'planCanonicalCaptures',
  'encodeManifest', 'manifestHash', 'structuralManifest',
  // Discoverability.
  'AUTHORING_SURFACE'
]);

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
  'src/geometry/anchors.js'
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
