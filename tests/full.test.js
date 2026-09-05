import test from 'node:test';
import assert from 'node:assert/strict';

import * as fullModule from '../src/full/index.js';
import {
  createEngineFull,
  instantiate,
  createRuntime,
  ENGINE_NAME,
  ENTRY_POINT
} from '../src/full/index.js';

test('full engine module exports entryPoint and runtime items', () => {
  assert.equal(ENTRY_POINT, 'engine/full');
  assert.equal(typeof createEngineFull, 'function');
  assert.equal(typeof createRuntime, 'function');
  assert.equal(typeof instantiate, 'function');
  assert.equal(ENGINE_NAME, 'My Game Engine 1.0');
});

test('createEngineFull boots runtime in full mode without premature placeholder stubs', () => {
  const engine = createEngineFull();

  assert.equal(engine.entryPoint, 'engine/full');
  assert.equal(engine.isRunning(), true);
  assert.equal(typeof engine.instantiate, 'function');
  assert.equal('kiln' in engine, false, 'createEngineFull must not attach unearned kiln stub');
});

test('full engine can instantiate pre-compiled artifacts via inherited runtime capability', () => {
  const engine = createEngineFull();
  const artifact = {
    id: 'test_artifact_01',
    type: 'character',
    data: { scale: 1.0 }
  };

  const instance = engine.instantiate(artifact, { spawnPoint: [0, 0, 0] });
  assert.equal(instance.artifactId, artifact.id);
  assert.equal(instance.type, 'character');
  assert.deepEqual(instance.data, { scale: 1.0 });
  assert.deepEqual(instance.context.spawnPoint, [0, 0, 0]);
});
