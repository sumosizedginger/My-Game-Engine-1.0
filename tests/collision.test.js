import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAABB, createCollisionSystem } from '../src/runtime/collision.js';

test('collision: checkAABB accurately identifies overlapping and separated boxes', () => {
  const box1 = { x: 0, y: 0, halfWidth: 10, halfHeight: 10 };
  const box2 = { x: 15, y: 5, halfWidth: 10, halfHeight: 10 };
  const box3 = { x: 25, y: 0, halfWidth: 10, halfHeight: 10 };

  // box1 and box2 overlap (distance X is 15 <= 20)
  assert.equal(checkAABB(box1, box2), true);

  // box1 and box3 do not overlap (distance X is 25 > 20)
  assert.equal(checkAABB(box1, box3), false);
});

test('collision: clampPaddleToBounds constrains kinematic paddle to arena', () => {
  const collision = createCollisionSystem();
  const arena = { minY: -250, maxY: 250 };
  const paddleHalfHeight = 40;

  const transform = { position: { x: -360, y: 290, z: 0 } };
  collision.clampPaddleToBounds(transform, paddleHalfHeight, arena);

  // Max allowed Y = 250 - 40 = 210
  assert.equal(transform.position.y, 210);

  // Min allowed Y = -250 + 40 = -210
  transform.position.y = -300;
  collision.clampPaddleToBounds(transform, paddleHalfHeight, arena);
  assert.equal(transform.position.y, -210);
});

test('collision: resolveArenaWalls bounces ball Y velocity and clamps position', () => {
  const collision = createCollisionSystem();
  const arena = { minY: -250, maxY: 250 };
  const ballRadius = 7;

  // Moving upward into top wall
  const ball = {
    position: { x: 50, y: 245, z: 0 },
    velocity: { x: 100, y: 200, z: 0 }
  };

  const bounced = collision.resolveArenaWalls(ball, ballRadius, arena);
  assert.equal(bounced, true);
  assert.equal(ball.position.y, 243); // 250 - 7
  assert.equal(ball.velocity.y, -200); // inverted
});

test('collision: resolvePaddleCollision reflects ball X and computes deflection', () => {
  const collision = createCollisionSystem();
  const ballBox = { halfWidth: 7, halfHeight: 7 };
  const paddleBox = { halfWidth: 8, halfHeight: 40 };

  // Player paddle at (-360, 0)
  const paddleTransform = { position: { x: -360, y: 0, z: 0 } };
  // Ball moving left towards player paddle, hitting above center (+20Y)
  const ballTransform = {
    position: { x: -350, y: 20, z: 0 },
    velocity: { x: -250, y: 0, z: 0 }
  };

  const result = collision.resolvePaddleCollision(ballTransform, ballBox, paddleTransform, paddleBox, 'left');
  assert.ok(result);
  assert.equal(result.collided, true);
  assert.equal(result.side, 'left');
  // Ball should now be placed outside paddle and traveling right (positive X)
  assert.ok(ballTransform.position.x >= -360 + 8 + 7);
  assert.ok(ballTransform.velocity.x > 0);
  // Ball should have acquired positive Y velocity because it hit above paddle center
  assert.ok(ballTransform.velocity.y > 0);
});

test('collision: checkGoal identifies ball passing left or right boundaries', () => {
  const collision = createCollisionSystem();
  const arena = { minX: -400, maxX: 400 };

  assert.equal(collision.checkGoal({ position: { x: -405 } }, arena), 'left');
  assert.equal(collision.checkGoal({ position: { x: 410 } }, arena), 'right');
  assert.equal(collision.checkGoal({ position: { x: 0 } }, arena), null);
});
