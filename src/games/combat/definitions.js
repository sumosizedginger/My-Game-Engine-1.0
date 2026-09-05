/**
 * My Game Engine 1.0 — Proof B2 Combat Room: Definitions
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Defines machine-readable parameters, timing bounds, and combat contracts.
 * Follows GAMEPLAY_FOUNDATION.md and B2 work order.
 */

export const COMBAT_CONFIG = Object.freeze({
  player: Object.freeze({
    maxHp: 100,
    speed: 3.2,                 // Meters per second traversal
    collisionRadius: 0.40,
    turnRate: 10.0,              // Radians per second
    attackDamage: 25,
    attackCooldown: 0.45         // Seconds between attacks
  }),
  enemy: Object.freeze({
    maxHp: 100,
    speed: 2.0,                 // Slower brute traversal
    collisionRadius: 0.45,
    turnRate: 6.0,
    aggroRadius: 9.0,           // Distance to trigger chase
    attackRadius: 1.40,         // Distance to trigger enemy strike
    attackDamage: 15,
    attackCooldown: 1.20,
    recoilDuration: 0.25        // Seconds in hurt state
  }),
  attackTiming: Object.freeze({
    windupDuration: 0.10,       // 0.00s -> 0.10s: arm draws back, anticipation
    activeDuration: 0.12,       // 0.10s -> 0.22s: active strike window (hit enabled)
    recoveryDuration: 0.13,     // 0.22s -> 0.35s: arm follows through and returns
    totalDuration: 0.35
  }),
  attackVolume: Object.freeze({
    forwardOffset: 0.70,        // Meters forward from attacker origin
    radius: 0.80,               // Radius of spherical/cylindrical hit volume
    minY: 0.30,                 // Lower vertical limit
    maxY: 1.70                  // Upper vertical limit
  })
});

export const COMBAT_STATES = Object.freeze({
  READY: 'READY',
  ENGAGED: 'ENGAGED',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT'
});

export const ENEMY_AI_STATES = Object.freeze({
  IDLE: 'IDLE',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  HURT: 'HURT',
  DEAD: 'DEAD'
});
