import test from 'node:test';
import assert from 'node:assert/strict';

import { createPongGame } from '../src/games/pong/game.js';

test('pong game: boots with valid initial state and entities', () => {
  const game = createPongGame({ env: 'test' });
  const snapshot = game.getState();

  assert.equal(snapshot.status, 'SERVE');
  assert.equal(snapshot.scores.player1, 0);
  assert.equal(snapshot.scores.player2, 0);
  assert.equal(snapshot.scores.max, 5);

  assert.ok(snapshot.entities.player);
  assert.ok(snapshot.entities.opponent);
  assert.ok(snapshot.entities.ball);

  // Initial player paddle position
  assert.equal(snapshot.entities.player.position.x, -360);
  assert.equal(snapshot.entities.player.position.y, 0);

  // Initial ball position
  assert.equal(snapshot.entities.ball.position.x, 0);
  assert.equal(snapshot.entities.ball.position.y, 0);
});

test('pong game: advances from SERVE to PLAYING and responds to action inputs', () => {
  const game = createPongGame({ env: 'test' });

  // 1. Initial state is SERVE
  assert.equal(game.getState().status, 'SERVE');

  // 2. Simulate MoveUp action -> triggers serve launch and moves paddle upward
  game.simulateAction('MoveUp', true);
  game.stepOnce(20); // 20ms step

  const s1 = game.getState();
  assert.equal(s1.status, 'PLAYING');
  assert.ok(s1.entities.player.position.y > 0, 'Player paddle should move up');
  assert.ok(s1.entities.ball.velocity.x !== 0, 'Ball should have acquired velocity');

  // 3. Release MoveUp and simulate MoveDown
  game.simulateAction('MoveUp', false);
  game.simulateAction('MoveDown', true);

  const prevY = game.getState().entities.player.position.y;
  for (let i = 0; i < 5; i++) {
    game.stepOnce(16.67);
  }
  const nextY = game.getState().entities.player.position.y;
  assert.ok(nextY < prevY, 'Player paddle should move down under MoveDown action');
});

test('pong game: declarative score rule executes and resets to SERVE on point', () => {
  const game = createPongGame({ env: 'test' });

  // Transition to PLAYING
  game.simulateAction('MoveUp', true);
  game.stepOnce(20);
  game.simulateAction('MoveUp', false);

  // Position ball moving right past arena boundary (+400)
  game.transformManager.teleport(game.getState().entities.ball.handle, { x: 395, y: 0, z: 0 });
  game.transformManager.setVelocity(game.getState().entities.ball.handle, { x: 500, y: 0, z: 0 });

  // Step simulation -> ball crosses +400 -> Player 1 scores point
  game.stepOnce(30);

  const state = game.getState();
  assert.equal(state.scores.player1, 1, 'Player 1 should have scored 1 point');
  assert.equal(state.status, 'SERVE', 'Game should reset to SERVE state after point');
  assert.equal(state.entities.ball.position.x, 0, 'Ball should return to center on serve');
});

test('pong game: reaching winning score triggers GAME_OVER rule', () => {
  const game = createPongGame({ env: 'test' });

  // Set score to 4 (max is 5)
  game.state.setVar('score.player1', 4);

  // Launch and score 5th point
  game.simulateAction('MoveUp', true);
  game.stepOnce(20);
  game.simulateAction('MoveUp', false);

  game.transformManager.teleport(game.getState().entities.ball.handle, { x: 395, y: 0, z: 0 });
  game.transformManager.setVelocity(game.getState().entities.ball.handle, { x: 500, y: 0, z: 0 });

  game.stepOnce(30);

  const finalState = game.getState();
  assert.equal(finalState.scores.player1, 5);
  assert.equal(finalState.status, 'GAME_OVER');
  assert.equal(finalState.scores.winner, 'Player 1');
});

test('pong game: pause action toggles state and freezes simulation', () => {
  const game = createPongGame({ env: 'test' });

  // Start play
  game.simulateAction('MoveUp', true);
  game.stepOnce(20);
  game.simulateAction('MoveUp', false);

  assert.equal(game.getState().status, 'PLAYING');

  // Trigger Pause
  game.simulateAction('Pause', true);
  game.stepOnce(16.67);
  game.simulateAction('Pause', false);

  assert.equal(game.getState().status, 'PAUSED');

  // Step while paused -> ball position must not change
  const ballPos = { ...game.getState().entities.ball.position };
  game.stepOnce(50);
  assert.deepEqual(game.getState().entities.ball.position, ballPos, 'Ball should remain frozen while paused');

  // Unpause
  game.simulateAction('Pause', true);
  game.stepOnce(16.67);
  game.simulateAction('Pause', false);

  assert.equal(game.getState().status, 'PLAYING');
});
