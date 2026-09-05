import test from 'node:test';
import assert from 'node:assert/strict';

import * as fullModule from '../src/full/index.js';
import {
  createEngineFull,
  Kiln,
  instantiate,
  createRuntime,
  ENGINE_NAME,
  ENTRY_POINT
} from '../src/full/index.js';

test('full engine module exports Kiln and runtime items', () => {
  assert.equal(ENTRY_POINT, 'engine/full');
  assert.equal(typeof Kiln.compile, 'function');
  assert.equal(typeof createEngineFull, 'function');
  assert.equal(typeof createRuntime, 'function');
  assert.equal(typeof instantiate, 'function');
  assert.equal(ENGINE_NAME, 'My Game Engine 1.0');
});

test('Kiln.compile produces compiled artifact from definition', () => {
  const definition = {
    id: 'def_tree_01',
    type: 'vegetation',
    data: { height: 12 }
  };

  const artifact = Kiln.compile(definition, { lod: 0 });

  assert.equal(artifact.id, 'def_tree_01');
  assert.equal(artifact.type, 'vegetation');
  assert.deepEqual(artifact.data, { height: 12 });
  assert.deepEqual(artifact.options, { lod: 0 });
  assert.equal(typeof artifact.compiledAt, 'number');
});

test('Kiln.compile throws on invalid definition', () => {
  assert.throws(() => Kiln.compile(null), /Invalid definition/);
  assert.throws(() => Kiln.compile({}), /Invalid definition: definition must have an id/);
});

test('Definition -> Kiln.compile -> instantiate pipeline functions end-to-end', () => {
  const definition = {
    id: 'hero_character_def',
    type: 'character',
    data: { baseScale: 1.0 }
  };

  const artifact = Kiln.compile(definition);
  const runtime = createRuntime();
  const instance = runtime.instantiate(artifact, { spawnPoint: [0, 0, 0] });

  assert.equal(instance.artifactId, definition.id);
  assert.equal(instance.type, 'character');
  assert.deepEqual(instance.data, { baseScale: 1.0 });
  assert.deepEqual(instance.context.spawnPoint, [0, 0, 0]);
});

test('createEngineFull boots runtime in full mode with Kiln attached', () => {
  const engine = createEngineFull();

  assert.equal(engine.entryPoint, 'engine/full');
  assert.equal(engine.kiln, Kiln);
  assert.equal(engine.isRunning(), true);
  assert.equal(typeof engine.instantiate, 'function');
});
