import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as runtimeModule from '../src/runtime/index.js';
import * as fullModule from '../src/full/index.js';
import {
  createEngineFull,
  instantiate,
  createRuntime,
  compileDefinition,
  ENGINE_NAME,
  ENTRY_POINT
} from '../src/full/index.js';
import { createPongGame } from '../src/games/pong/game.js';
import {
  ARENA_DEFINITION,
  PLAYER_PADDLE_DEFINITION,
  OPPONENT_PADDLE_DEFINITION,
  BALL_DEFINITION,
  MATCH_RULES_DEFINITION
} from '../src/games/pong/definitions.js';

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

function compileProbe(data) {
  return compileDefinition({ id: 'probe', type: 'probe', data });
}

function attemptMutate(fn) {
  try {
    fn();
  } catch {
    // Frozen assignment may throw in strict mode; content must still be unchanged.
  }
}

test('compileDefinition hashes nested JSON content, not only id and type', () => {
  assert.notEqual(compileProbe({ width: 12 }).hash, compileProbe({ width: 14 }).hash);
  assert.notEqual(
    compileProbe({ vehicle: { speed: 10 } }).hash,
    compileProbe({ vehicle: { speed: 20 } }).hash
  );
  assert.notEqual(
    compileProbe({ vehicle: { name: 'a' } }).hash,
    compileProbe({ vehicle: { name: 'b' } }).hash
  );
  assert.notEqual(
    compileProbe({ vehicle: { active: true } }).hash,
    compileProbe({ vehicle: { active: false } }).hash
  );
  assert.notEqual(
    compileProbe({ vehicle: { extra: null } }).hash,
    compileProbe({ vehicle: { extra: 0 } }).hash
  );
  assert.notEqual(
    compileProbe({ vehicle: { nested: { v: 1 } } }).hash,
    compileProbe({ vehicle: { nested: { v: 2 } } }).hash
  );
  assert.notEqual(
    compileProbe({ vehicle: { speed: 10 } }).hash,
    compileProbe({ vehicle: { speed: 10, mass: 1 } }).hash
  );
  assert.notEqual(
    compileProbe({ vehicle: { speed: 10, mass: 1 } }).hash,
    compileProbe({ vehicle: { speed: 10 } }).hash
  );
  assert.notEqual(compileProbe({ points: [1, 2] }).hash, compileProbe({ points: [1, 3] }).hash);
  assert.notEqual(compileProbe({ points: [{ v: 1 }] }).hash, compileProbe({ points: [{ v: 2 }] }).hash);
  assert.notEqual(compileProbe({ points: [1, 2] }).hash, compileProbe({ points: [2, 1] }).hash);
  assert.notEqual(
    compileProbe({ items: [{ a: 1 }, { b: 2 }] }).hash,
    compileProbe({ items: [{ b: 2 }, { a: 1 }] }).hash
  );
});

test('compileDefinition hash is stable across object key insertion order and compiledAt', async () => {
  const rootA = compileDefinition({ id: 'probe', type: 'probe', data: { b: 2, a: 1 } });
  const rootB = compileDefinition({ data: { a: 1, b: 2 }, type: 'probe', id: 'probe' });
  assert.equal(rootA.hash, rootB.hash);

  const nestedA = compileProbe({ vehicle: { mass: 1, speed: 10 } });
  const nestedB = compileProbe({ vehicle: { speed: 10, mass: 1 } });
  assert.equal(nestedA.hash, nestedB.hash);

  const deepA = compileProbe({ a: { b: { d: 4, c: 3 } } });
  const deepB = compileProbe({ a: { b: { c: 3, d: 4 } } });
  assert.equal(deepA.hash, deepB.hash);

  const first = compileProbe({ width: 12 });
  await new Promise(resolve => setTimeout(resolve, 20));
  const second = compileProbe({ width: 12 });
  assert.equal(first.hash, second.hash);
  assert.notEqual(first.compiledAt, second.compiledAt);

  assert.notEqual(
    compileDefinition({ id: 'probe-a', type: 'probe', data: { width: 12 } }).hash,
    compileDefinition({ id: 'probe-b', type: 'probe', data: { width: 12 } }).hash
  );
  assert.notEqual(
    compileDefinition({ id: 'probe', type: 'alpha', data: { width: 12 } }).hash,
    compileDefinition({ id: 'probe', type: 'beta', data: { width: 12 } }).hash
  );
});

test('all JSON object keys survive cloning, hashing and deep freezing', () => {
  const source = JSON.parse('{"nested":{"__proto__":{"speed":10},"constructor":{"v":1},"toString":"text","10":10,"2":2}}');
  const artifact = compileProbe(source);
  assert.deepEqual(artifact.data, source);
  assert.equal(Object.hasOwn(artifact.data.nested, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(artifact.data.nested), Object.prototype);
  assert.equal(Object.isFrozen(artifact.data.nested.__proto__), true);
  source.nested.__proto__.speed = 99;
  attemptMutate(() => { artifact.data.nested.__proto__.speed = 20; });
  assert.equal(artifact.data.nested.__proto__.speed, 10);
  const original = JSON.parse('{"nested":{"2":2,"10":10,"toString":"text","constructor":{"v":1},"__proto__":{"speed":10}}}');
  assert.equal(compileProbe(original).hash, artifact.hash);
  original.nested.__proto__.speed = 20;
  assert.notEqual(compileProbe(original).hash, artifact.hash);
});

test('mixed nested arrays and objects remain isolated, frozen and fingerprint-coherent', () => {
  const source = { items: [{ child: { values: [null, false, 'quoted"\\\n', -2.5, { x: 4 }] } }] };
  const original = JSON.parse(JSON.stringify(source));
  const artifact = compileProbe(source);
  function checkFrozen(value) {
    if (value === null || typeof value !== 'object') return;
    assert.equal(Object.isFrozen(value), true);
    Object.values(value).forEach(checkFrozen);
  }
  checkFrozen(artifact.data);
  source.items[0].child.values[4].x = 9;
  source.items[0].child.values.push(10);
  source.items.push({ extra: true });
  attemptMutate(() => { artifact.data.items[0].child.values[4].x = 99; });
  attemptMutate(() => { artifact.data.items[0].child.values.reverse(); });
  attemptMutate(() => { artifact.data.items.pop(); });
  assert.deepEqual(artifact.data, original);
  assert.equal(artifact.hash, compileProbe(original).hash);
});

test('compileDefinition treats omitted data and empty object data as the same payload', () => {
  const omitted = compileDefinition({ id: 'x', type: 'probe' });
  const empty = compileDefinition({ id: 'x', type: 'probe', data: {} });
  assert.equal(omitted.hash, empty.hash);
  assert.deepEqual(omitted.data, {});
  assert.deepEqual(empty.data, {});
  assert.equal(Object.isFrozen(omitted.data), true);
  assert.equal(Object.isFrozen(empty.data), true);
});

test('compileDefinition deep-copies and recursively freezes JSON-compatible nested data', () => {
  const vehicle = { speed: 10 };
  const points = [1, 2, 3];
  const artifact = compileDefinition({
    id: 'vehicle',
    type: 'probe',
    data: { vehicle, points }
  });

  assert.equal(Object.isFrozen(artifact), true);
  assert.equal(Object.isFrozen(artifact.data), true);
  assert.equal(Object.isFrozen(artifact.data.vehicle), true);
  assert.equal(Object.isFrozen(artifact.data.points), true);

  attemptMutate(() => { artifact.data.vehicle.speed = 20; });
  attemptMutate(() => { artifact.data.points.push(4); });
  assert.equal(artifact.data.vehicle.speed, 10);
  assert.deepEqual(artifact.data.points, [1, 2, 3]);

  vehicle.speed = 99;
  points.push(4);
  assert.equal(artifact.data.vehicle.speed, 10);
  assert.deepEqual(artifact.data.points, [1, 2, 3]);
  assert.notEqual(artifact.data.vehicle, vehicle);
  assert.notEqual(artifact.data.points, points);

  const fresh = compileDefinition({
    id: 'vehicle',
    type: 'probe',
    data: { vehicle: { speed: 10 }, points: [1, 2, 3] }
  });
  assert.equal(artifact.hash, fresh.hash);
  assert.deepEqual(artifact.data, fresh.data);
});

test('Proof A definitions still compile, instantiate, and play after content-identity repair', () => {
  const engine = createEngineFull();
  const definitions = [
    ARENA_DEFINITION,
    PLAYER_PADDLE_DEFINITION,
    OPPONENT_PADDLE_DEFINITION,
    BALL_DEFINITION,
    MATCH_RULES_DEFINITION
  ];
  const hashes = {};
  for (const definition of definitions) {
    const artifact = compileDefinition(definition);
    assert.equal(artifact.id, definition.id);
    assert.equal(artifact.type, definition.type);
    assert.deepEqual(artifact.data, definition.data);
    assert.equal(typeof artifact.hash, 'string');
    assert.match(artifact.hash, /^[0-9a-f]+$/);
    const instance = engine.instantiate(artifact);
    assert.equal(instance.artifactId, definition.id);
    hashes[definition.id] = artifact.hash;
  }

  const game = createPongGame({ env: 'test' });
  const initial = game.getState();
  assert.equal(initial.status, 'SERVE');
  game.simulateAction('MoveUp', true);
  game.stepOnce(20);
  const afterMove = game.getState();
  assert.equal(afterMove.status, 'PLAYING');
  assert.ok(afterMove.entities.player.position.y > initial.entities.player.position.y);
  game.transformManager.teleport(afterMove.entities.ball.handle, { x: 395, y: 0, z: 0 });
  game.transformManager.setVelocity(afterMove.entities.ball.handle, { x: 500, y: 0, z: 0 });
  game.stepOnce(30);
  const afterScore = game.getState();
  assert.equal(afterScore.scores.player1, 1);
  assert.equal(afterScore.status, 'SERVE');

  // Hashes must differ across the five distinct Proof A definitions.
  assert.equal(new Set(Object.values(hashes)).size, 5);
});

test('compileDefinition remains a full/authoring export and is absent from runtime', () => {
  assert.equal(typeof fullModule.compileDefinition, 'function');
  assert.equal('compileDefinition' in runtimeModule, false);
  const runtimeSource = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'runtime', 'index.js'),
    'utf8'
  );
  assert.equal(runtimeSource.includes('compileDefinition'), false);
  assert.equal(runtimeSource.includes('../full'), false);
});
