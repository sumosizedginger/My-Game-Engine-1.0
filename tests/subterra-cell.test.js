/**
 * SUBTERRA CELL — forcing-consumer contracts for SCENE-COMPOSITION-001.
 *
 * The cell exists to put a real constructed environment through the scene
 * system. These tests check the things that would make the scene model a lie
 * if they failed: that the consumer needs no private access, that composition
 * actually composes, and that the definition carries no geometry.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildSubterraCell,
  buildSubterraCellDefinition,
  SUBTERRA_CELL_ID
} from '../examples/scenes/subterra-cell/scene.js';
import {
  compileScene,
  validateSceneDefinition,
  encodeScene,
  sceneHash,
  instantiateScene
} from '../src/scene/index.js';
import { createEntityManager } from '../src/runtime/entities.js';
import { createTransformManager } from '../src/runtime/transforms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const CELL_DIR = 'examples/scenes/subterra-cell';

const readCellSource = (file) => fs.readFileSync(path.join(rootDir, CELL_DIR, file), 'utf8');

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
// Requirement 20: the forcing consumer uses supported public routes only.
// ---------------------------------------------------------------------------

test('the SUBTERRA cell imports only the public package surface', () => {
  // If the cell needs a private path, the public API is incomplete and the
  // tranche has not actually delivered a usable scene system.
  const files = fs.readdirSync(path.join(rootDir, CELL_DIR)).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0, 'the cell must have source files');

  for (const file of files) {
    for (const specifier of importsOf(readCellSource(file))) {
      const local = specifier.startsWith('.');
      const publicPackage = specifier === '@sumosizedginger/my-game-engine-1.0'
        || specifier.startsWith('@sumosizedginger/my-game-engine-1.0/');
      assert.ok(local || publicPackage,
        `${CELL_DIR}/${file} imports "${specifier}", which is neither a sibling file nor the public package`);
      assert.ok(!specifier.includes('/src/'),
        `${CELL_DIR}/${file} deep-imports engine internals: "${specifier}"`);
      if (local) {
        assert.ok(!specifier.includes('..'),
          `${CELL_DIR}/${file} reaches outside the example: "${specifier}"`);
      }
    }
  }
});

test('the cell never reaches for the renderer adapter or private modules', () => {
  for (const file of fs.readdirSync(path.join(rootDir, CELL_DIR)).filter((f) => f.endsWith('.js'))) {
    const source = stripComments(readCellSource(file));
    for (const forbidden of ['toBufferGeometry', 'BufferGeometry', 'from \'three\'', 'scene-presentation']) {
      assert.ok(!source.includes(forbidden),
        `${CELL_DIR}/${file} must not use ${forbidden}: authoring happens in engine data, not renderer types`);
    }
  }
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

test('the cell definition is structurally valid', () => {
  const result = validateSceneDefinition(buildSubterraCellDefinition());
  assert.equal(result.valid, true,
    result.diagnostics.map((d) => `${d.code}: ${d.message}`).join(' | '));
});

test('the cell has real, semantically plausible hierarchy', () => {
  const artifact = compileScene(buildSubterraCellDefinition());

  assert.equal(artifact.id, SUBTERRA_CELL_ID);
  assert.equal(artifact.roots.length, 1, 'a room is one rooted thing');
  assert.equal(artifact.roots[0], 'cell');
  assert.ok(artifact.nodeCount >= 25, `expected a substantial cell, got ${artifact.nodeCount} nodes`);
  assert.ok(artifact.maxDepth >= 3, `expected nested assemblies, got depth ${artifact.maxDepth}`);

  // Assemblies exist because the space is built that way, not to pad a count:
  // each grouping node must actually have more than one child.
  for (const group of ['architecture', 'doorway', 'lighting', 'services', 'structure', 'props']) {
    const node = artifact.nodes.find((n) => n.pid === group);
    assert.ok(node, `${group} must exist`);
    assert.ok(node.children.length >= 2, `${group} should group several nodes, has ${node.children.length}`);
  }

  // The door leaf is three levels down: cell -> doorway -> leaf.
  const leaf = artifact.nodes.find((n) => n.pid === 'doorway.leaf');
  assert.equal(leaf.parent, 'doorway');
  assert.equal(leaf.depth, 2);
});

test('an assembly carries its children: the doorway composes into world space', () => {
  const artifact = compileScene(buildSubterraCellDefinition());
  const world = (pid) => artifact.nodes.find((n) => n.pid === pid).world;
  const local = (pid) => artifact.nodes.find((n) => n.pid === pid).local;

  const doorway = world('doorway');
  const post = world('doorway.frame.left');

  // The post is authored at x = -0.78 in the DOORWAY's frame and inherits the
  // doorway's y and z. If composition were skipped, the post would sit at the
  // origin instead.
  assert.equal(local('doorway.frame.left').translation[0], -0.78);
  assert.ok(Math.abs(post.translation[0] - (doorway.translation[0] - 0.78)) < 1e-9);
  assert.ok(Math.abs(post.translation[1] - doorway.translation[1]) < 1e-9);
  assert.ok(Math.abs(post.translation[2] - doorway.translation[2]) < 1e-9);
  assert.notEqual(post.translation[1], 0, 'the doorway is raised, so its children must be too');
});

test('a rotated assembly rotates its children', () => {
  // The console is yawed a quarter turn; its screen is tilted within the
  // console. The screen's world rotation must be neither of those alone.
  const artifact = compileScene(buildSubterraCellDefinition());
  const consoleWorld = artifact.nodes.find((n) => n.pid === 'props.console').world;
  const screen = artifact.nodes.find((n) => n.pid === 'props.console.screen');

  assert.notDeepEqual([...screen.local.rotation], [0, 0, 0, 1], 'the screen is tilted locally');
  assert.notDeepEqual([...screen.world.rotation], [...screen.local.rotation],
    'the world rotation must include the console yaw');
  assert.notDeepEqual([...screen.world.rotation], [...consoleWorld.rotation],
    'the world rotation must include the screen tilt');

  // The screen is offset in the console's own frame, so the yaw moves it in
  // world space along an axis its local offset never mentions.
  assert.equal(screen.local.translation[0], 0);
  assert.ok(Math.abs(screen.world.translation[0] - consoleWorld.translation[0]) > 0.05,
    'a yawed parent must displace a child that is offset only in local z');
});

test('one asset is placed many times: the scene composes, it does not copy geometry', () => {
  const { definition, assets } = buildSubterraCell();
  const artifact = compileScene(definition);

  const uses = new Map();
  for (const node of artifact.nodes) {
    if (!node.asset) continue;
    uses.set(node.asset, (uses.get(node.asset) ?? 0) + 1);
  }

  const reused = [...uses.entries()].filter(([, count]) => count > 1);
  assert.ok(reused.length >= 3,
    `expected several reused assets, got ${JSON.stringify([...uses.entries()])}`);
  // The wall panel in particular is placed twice, once turned around.
  assert.equal(uses.get('wall.panel'), 2);

  // Every referenced key resolves, and no asset is built that nothing uses.
  for (const [key] of uses) {
    assert.ok(assets.has(key), `asset library is missing "${key}"`);
  }
  for (const key of assets.keys()) {
    assert.ok(uses.has(key), `asset "${key}" is built but never placed`);
  }
});

test('the definition carries no geometry and no renderer types', () => {
  // The property that makes a scene portable: it is data about arrangement.
  const definition = buildSubterraCellDefinition();
  const text = encodeScene(definition);

  assert.ok(!text.includes('position'), 'scene text must not carry vertex attributes');
  assert.ok(!text.includes('indices'), 'scene text must not carry index buffers');
  assert.ok(!text.includes('normal'), 'scene text must not carry normals');
  assert.ok(text.length < 20000, `scene text should be small arrangement data, got ${text.length} bytes`);

  for (const node of definition.nodes) {
    assert.ok(node.asset === null || typeof node.asset === 'string',
      `${node.pid} asset must be an opaque key`);
  }
});

test('the cell has stable identity across rebuilds', () => {
  const a = buildSubterraCellDefinition();
  const b = buildSubterraCellDefinition();
  assert.equal(sceneHash(a), sceneHash(b));
  assert.equal(compileScene(a).artifactHash, compileScene(b).artifactHash);
});

test('the cell instantiates, unloads and reloads with stable authored identity', () => {
  // Modelled on how streaming will actually work: the runtime world persists
  // while a cell is unloaded and brought back. Sharing the entity manager is
  // what makes the handle comparison meaningful - two fresh pools would both
  // restart their allocation and produce equal handle values by coincidence.
  const artifact = compileScene(buildSubterraCellDefinition());
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);
  const managers = { entityManager: entities, transformManager: transforms };

  const first = instantiateScene(artifact, managers);
  assert.equal(first.size, artifact.nodeCount);
  assert.equal(entities.count(), artifact.nodeCount);
  const firstHandles = artifact.order.map((pid) => first.handleFor(pid));

  first.dispose();
  assert.equal(entities.count(), 0, 'unloading a cell must release its entities');

  const second = instantiateScene(artifact, managers);
  assert.equal(second.size, artifact.nodeCount);
  for (const [i, pid] of artifact.order.entries()) {
    assert.equal(second.pidFor(second.handleFor(pid)), pid,
      `${pid} keeps its authored identity across the cycle`);
    assert.notDeepEqual(second.handleFor(pid), firstHandles[i],
      `${pid} must get a fresh runtime handle after a reload`);
    assert.equal(entities.isValid(firstHandles[i]), false,
      `${pid}'s old handle must be permanently stale`);
  }
  assert.equal(second.sourceHash, artifact.sourceHash);
  second.dispose();
});

test('the asset library is engine-generated geometry with semantic parts', () => {
  const { assets, materials } = buildSubterraCell();
  assert.ok(assets.size >= 10, `expected a real kit of parts, got ${assets.size}`);
  assert.ok(materials.length >= 5);

  for (const [key, mesh] of assets) {
    assert.ok(mesh.parts.length >= 1, `${key} must have parts`);
    assert.ok(mesh.indices.length > 0, `${key} must have geometry`);
    for (const part of mesh.parts) {
      assert.ok(part.semanticName && part.semanticName.length > 0,
        `${key} has an anonymous part`);
      assert.ok(part.materialId, `${key} part ${part.semanticName} has no material`);
    }
  }

  // Every material a part references must actually be defined.
  const defined = new Set(materials.map((m) => m.id));
  for (const [key, mesh] of assets) {
    for (const part of mesh.parts) {
      assert.ok(defined.has(part.materialId),
        `${key} part ${part.semanticName} references undefined material ${part.materialId}`);
    }
  }
});
