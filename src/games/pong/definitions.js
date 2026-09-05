/**
 * My Game Engine 1.0 — Proof A Pong Definitions
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Source definitions for the Pong game: arena court, paddles, ball, rules.
 * Follows CONSTITUTION.md §3, ARCHITECTURE.md §5, and GAMEPLAY_FOUNDATION.md §8.
 */

export const ARENA_DEFINITION = Object.freeze({
  id: 'def_pong_arena',
  type: 'arena',
  data: {
    width: 800,
    height: 500,
    minX: -400,
    maxX: 400,
    minY: -250,
    maxY: 250,
    wallThickness: 16
  }
});

export const PLAYER_PADDLE_DEFINITION = Object.freeze({
  id: 'def_paddle_player',
  type: 'prefab',
  data: {
    role: 'player',
    halfWidth: 8,
    halfHeight: 40,
    initialX: -360,
    initialY: 0,
    speed: 360,
    color: '#38bdf8'
  }
});

export const OPPONENT_PADDLE_DEFINITION = Object.freeze({
  id: 'def_paddle_opponent',
  type: 'prefab',
  data: {
    role: 'opponent',
    halfWidth: 8,
    halfHeight: 40,
    initialX: 360,
    initialY: 0,
    speed: 280,
    color: '#f43f5e'
  }
});

export const BALL_DEFINITION = Object.freeze({
  id: 'def_ball_standard',
  type: 'prefab',
  data: {
    radius: 7,
    halfWidth: 7,
    halfHeight: 7,
    initialX: 0,
    initialY: 0,
    initialSpeed: 280,
    maxSpeed: 650,
    color: '#ffffff'
  }
});

export const MATCH_RULES_DEFINITION = Object.freeze({
  id: 'def_pong_rules',
  type: 'rules',
  data: {
    maxScore: 5,
    serveDelaySeconds: 0.8
  }
});
