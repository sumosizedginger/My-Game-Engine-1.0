import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRuntime,
  createEntityManager,
  createTransformManager,
  createInputSystem,
  checkAABB
} from '../src/runtime/index.js';
import { compileDefinition } from '../src/full/index.js';
import {
  createSequenceGame,
  createSequenceInput,
  hazardPose,
  xzBox
} from '../src/games/sequence/game.js';
import {
  ARENA_DEFINITION,
  PLAYER_DEFINITION,
  COLLECTIBLE_DEFINITIONS,
  HAZARD_DEFINITIONS,
  EXIT_DEFINITION
} from '../src/games/sequence/definitions.js';

function startPlaying(game) {
  game.simulateActionValue('MoveX', 0.2);
  game.step();
  game.input.clear();
}

function collectOrder(game, order) {
  const relic = game.getState().collectibles.find((item) => item.order === order);
  game.transformManager.teleport(game.playerHandle, relic.position);
  game.step();
}

test('sequence game: constructs through public runtime and compile surfaces', () => {
  const runtime = createRuntime({ game: 'sequence-probe' });
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);
  const input = createInputSystem({ actions: ['MoveX', 'Reset'], keyboardBindings: {} });
  const arena = compileDefinition(ARENA_DEFINITION);
  const player = compileDefinition(PLAYER_DEFINITION);

  runtime.instantiate(arena);
  runtime.instantiate(player);
  const handle = entities.spawn({ role: player.data.role });
  transforms.setTransform(handle, {
    position: { x: player.data.initialX, y: player.data.initialY, z: player.data.initialZ },
    ownership: 'KINEMATIC'
  });

  assert.equal(runtime.entryPoint, 'engine/runtime');
  assert.equal(typeof arena.hash, 'string');
  assert.equal(arena.data.halfWidth, 8);
  assert.equal(entities.isValid(handle), true);
  assert.equal(input.captureSnapshot().getActionValue('MoveX'), 0);

  const game = createSequenceGame({ env: 'test' });
  const snap = game.getState();
  assert.equal(snap.status, 'READY');
  assert.equal(snap.collected, 0);
  assert.equal(snap.expected, 1);
  assert.equal(snap.exitActive, false);
  assert.equal(snap.collectibles.length, 5);
  assert.equal(snap.hazards.length, 2);
  assert.equal(snap.player.position.x, 0);
  assert.equal(snap.player.position.z, 0);
  assert.equal(snap.objective, 'Collect relic 1');
  assert.equal(typeof snap.artifacts.arena, 'string');
  assert.equal(COLLECTIBLE_DEFINITIONS.length, 5);
  assert.equal(HAZARD_DEFINITIONS.length, 2);
  assert.equal(EXIT_DEFINITION.data.role, 'exit');
  game.dispose();
});

test('sequence game: player movement and arena containment', () => {
  const game = createSequenceGame({ env: 'test' });
  const origin = game.getState().player.position.x;
  game.simulateActionValue('MoveX', 1);
  game.step();
  const moved = game.getState();
  assert.equal(moved.status, 'PLAYING');
  assert.ok(moved.player.position.x > origin, 'player should move +X');

  game.input.clear();
  game.transformManager.teleport(game.playerHandle, { x: 7.4, y: 0.45, z: 7.4 });
  game.simulateActionValue('MoveX', 1);
  game.simulateActionValue('MoveZ', 1);
  for (let i = 0; i < 30; i++) game.step();
  const clamped = game.getState().player.position;
  assert.ok(clamped.x <= 8 - 0.45 + 1e-9, `x leaked arena: ${clamped.x}`);
  assert.ok(clamped.z <= 8 - 0.45 + 1e-9, `z leaked arena: ${clamped.z}`);
  assert.ok(clamped.x >= -8 + 0.45 - 1e-9);
  assert.ok(clamped.z >= -8 + 0.45 - 1e-9);
  game.dispose();
});

test('sequence game: keyboard and controller semantic input move the player', () => {
  const keyboard = createSequenceGame({ env: 'test' });
  keyboard.input.handleKeyDown({ code: 'KeyD' });
  keyboard.step();
  assert.ok(keyboard.getState().player.position.x > 0, 'KeyD should move +X');
  keyboard.dispose();

  const pad = createSequenceGame({ env: 'test' });
  pad.input.setGamepad({
    connected: true,
    axes: [0.8, 0],
    buttons: []
  });
  pad.step();
  assert.ok(pad.getState().player.position.x > 0, 'left stick right should move +X');
  pad.dispose();

  const dpad = createSequenceGame({ env: 'test' });
  dpad.input.setGamepad({
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 15, value: i === 15 ? 1 : 0 }))
  });
  dpad.step();
  assert.ok(dpad.getState().player.position.x > 0, 'D-pad right should move +X');
  dpad.dispose();

  const input = createSequenceInput();
  input.setGamepad({
    connected: true,
    axes: [-0.8, 0.8],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  });
  const snapshot = input.captureSnapshot();
  assert.ok(snapshot.getActionValue('MoveX') < 0);
  assert.ok(snapshot.getActionValue('MoveZ') > 0);
  assert.equal(snapshot.isActionActive('Reset'), false);
});

test('sequence game: wrong collectible order is rejected and does not remove the relic', () => {
  const game = createSequenceGame({ env: 'test' });
  startPlaying(game);
  collectOrder(game, 3);
  const snap = game.getState();
  assert.equal(snap.collected, 0);
  assert.equal(snap.expected, 1);
  assert.equal(snap.exitActive, false);
  assert.ok(snap.rejected > 0);
  assert.equal(snap.collectibles[2].collected, false);
  assert.equal(snap.status, 'PLAYING');
  game.dispose();
});

test('sequence game: correct order advances and collected relics cannot double-count', () => {
  const game = createSequenceGame({ env: 'test' });
  startPlaying(game);
  collectOrder(game, 1);
  let snap = game.getState();
  assert.equal(snap.collected, 1);
  assert.equal(snap.expected, 2);
  assert.equal(snap.collectibles[0].collected, true);
  assert.equal(snap.objective, 'Collect relic 2');

  collectOrder(game, 1);
  snap = game.getState();
  assert.equal(snap.collected, 1);
  assert.equal(snap.expected, 2);

  collectOrder(game, 2);
  collectOrder(game, 3);
  collectOrder(game, 4);
  collectOrder(game, 5);
  snap = game.getState();
  assert.equal(snap.collected, 5);
  assert.equal(snap.exitActive, true);
  assert.equal(snap.objective, 'Enter the exit');
  assert.ok(snap.collectibles.every((item) => item.collected));
  game.dispose();
});

test('sequence game: moving hazards are deterministic from reset', () => {
  const a = createSequenceGame({ env: 'test' });
  const b = createSequenceGame({ env: 'test' });
  for (let i = 0; i < 90; i++) {
    a.step();
    b.step();
  }
  const sa = a.getState();
  const sb = b.getState();
  assert.deepEqual(sa.hazards, sb.hazards);
  assert.equal(sa.hazardTicks, 90);
  assert.ok(Math.hypot(sa.hazards[0].position.x - 0, sa.hazards[0].position.z - 3) > 0.2);
  assert.ok(Math.hypot(sa.hazards[1].position.x + 4, sa.hazards[1].position.z - 0) > 0.2);

  const predicted = hazardPose(sa.hazardTicks, HAZARD_DEFINITIONS[0].data);
  assert.ok(Math.abs(sa.hazards[0].position.x - predicted.x) < 1e-9);
  assert.ok(Math.abs(sa.hazards[0].position.z - predicted.z) < 1e-9);

  a.reset();
  const resetSnap = a.getState();
  const origin = hazardPose(0, HAZARD_DEFINITIONS[0].data);
  assert.equal(resetSnap.hazardTicks, 0);
  assert.equal(resetSnap.hazards[0].position.x, origin.x);
  assert.equal(resetSnap.hazards[0].position.z, origin.z);
  a.dispose();
  b.dispose();
});

test('sequence game: hazard collision resets the attempt', () => {
  const game = createSequenceGame({ env: 'test' });
  startPlaying(game);
  collectOrder(game, 1);
  assert.equal(game.getState().collected, 1);

  const hazard = game.getState().hazards[0];
  game.transformManager.teleport(game.playerHandle, hazard.position);
  game.step();
  const snap = game.getState();
  assert.equal(snap.status, 'READY');
  assert.equal(snap.collected, 0);
  assert.equal(snap.expected, 1);
  assert.equal(snap.exitActive, false);
  assert.equal(snap.time, 0);
  assert.equal(snap.player.position.x, 0);
  assert.equal(snap.player.position.z, 0);
  assert.equal(snap.objective, 'Collect relic 1');
  assert.ok(snap.collectibles.every((item) => item.collected === false));
  game.dispose();
});

test('sequence game: inactive exit does not complete; active exit does', () => {
  const game = createSequenceGame({ env: 'test' });
  startPlaying(game);
  const exitPos = game.getState().exit.position;
  game.transformManager.teleport(game.playerHandle, exitPos);
  game.step();
  let snap = game.getState();
  assert.equal(snap.status, 'PLAYING');
  assert.equal(snap.exitActive, false);
  assert.ok(snap.inactiveExitContacts > 0);

  game.reset();
  startPlaying(game);
  for (const order of [1, 2, 3, 4, 5]) collectOrder(game, order);
  assert.equal(game.getState().exitActive, true);
  game.transformManager.teleport(game.playerHandle, game.getState().exit.position);
  game.step();
  snap = game.getState();
  assert.equal(snap.status, 'COMPLETE');
  assert.equal(snap.objective, 'Complete');
  assert.equal(snap.collected, 5);

  const frozenTime = snap.time;
  const frozenPlayer = { ...snap.player.position };
  game.simulateActionValue('MoveX', 1);
  game.step();
  const still = game.getState();
  assert.equal(still.status, 'COMPLETE');
  assert.equal(still.time, frozenTime);
  assert.deepEqual(still.player.position, frozenPlayer);
  game.dispose();
});

test('sequence game: reset restores initial gameplay truth', () => {
  const game = createSequenceGame({ env: 'test' });
  startPlaying(game);
  collectOrder(game, 1);
  collectOrder(game, 2);
  game.simulateActionValue('MoveZ', -1);
  for (let i = 0; i < 20; i++) game.step();
  assert.equal(game.getState().collected, 2);
  assert.ok(game.getState().time > 0);

  game.simulateAction('Reset', true);
  game.step();
  const snap = game.getState();
  assert.equal(snap.status, 'READY');
  assert.equal(snap.collected, 0);
  assert.equal(snap.expected, 1);
  assert.equal(snap.exitActive, false);
  assert.equal(snap.time, 0);
  assert.equal(snap.playTicks, 0);
  assert.equal(snap.hazardTicks, 0);
  assert.equal(snap.player.position.x, PLAYER_DEFINITION.data.initialX);
  assert.equal(snap.player.position.z, PLAYER_DEFINITION.data.initialZ);
  assert.equal(snap.objective, 'Collect relic 1');
  assert.ok(snap.collectibles.every((item) => item.collected === false));
  game.dispose();
});

test('sequence game: public AABB overlap and lifecycle disposal', () => {
  const overlapping = checkAABB(
    xzBox({ x: 0, z: 0 }, 0.45),
    xzBox({ x: 0.2, z: 0 }, 0.35)
  );
  const separated = checkAABB(
    xzBox({ x: 0, z: 0 }, 0.45),
    xzBox({ x: 6, z: 6 }, 0.35)
  );
  assert.equal(overlapping, true);
  assert.equal(separated, false);

  const game = createSequenceGame({ env: 'test' });
  const liveCount = game.entityManager.count();
  assert.ok(liveCount >= 9);
  game.dispose();
  assert.equal(game.entityManager.count(), 0);
  assert.throws(() => game.step(), /SEQUENCE_GAME_DISPOSED/);
  game.dispose();
});
