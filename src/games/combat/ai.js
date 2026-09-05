/**
 * My Game Engine 1.0 — Proof B2: Deterministic Enemy AI
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Minimal deterministic finite state machine (IDLE, CHASE, ATTACK, HURT, DEAD).
 * Computes movement and combat intent for single-writer transform authority.
 * Follows B2 work order and GAMEPLAY_FOUNDATION.md.
 */

import { COMBAT_CONFIG, ENEMY_AI_STATES } from './definitions.js';

/**
 * Updates deterministic enemy AI state and computes movement/attack intent.
 *
 * @param {object} enemy - Enemy state record.
 * @param {object} playerTransform - Player world transform.
 * @param {number} dt - Fixed delta time.
 * @returns {{ intent: { moveX: number, moveZ: number, speed: number, rotationY: number, wantsAttack: boolean }, state: string }}
 */
export function updateEnemyAI(enemy, playerTransform, dt) {
  const config = COMBAT_CONFIG.enemy;
  const timing = COMBAT_CONFIG.attackTiming;

  let state = enemy.aiState || enemy.state || ENEMY_AI_STATES.IDLE;
  let attackTimer = enemy.attackTimer || 0;
  let cooldownTimer = Math.max(0, (enemy.cooldownTimer || 0) - dt);
  let recoilTimer = Math.max(0, (enemy.recoilTimer || 0) - dt);

  // 1. Dead state is terminal
  if (enemy.hp <= 0 || state === ENEMY_AI_STATES.DEAD) {
    return {
      state: ENEMY_AI_STATES.DEAD,
      intent: { moveX: 0, moveZ: 0, speed: 0, rotationY: enemy.transform.rotationY, wantsAttack: false },
      attackTimer: 0,
      cooldownTimer: 0,
      recoilTimer: 0
    };
  }

  // Distance and direction to player
  const ePos = enemy.transform.position;
  const pPos = playerTransform.position;
  const dx = pPos.x - ePos.x;
  const dz = pPos.z - ePos.z;
  const distSq = dx * dx + dz * dz;
  const dist = Math.sqrt(distSq) || 0.001;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const targetRotationY = Math.atan2(dirX, dirZ);

  let moveX = 0;
  let moveZ = 0;
  let speed = 0;
  let wantsAttack = false;

  // 2. Hurt state (flinches backward briefly)
  if (state === ENEMY_AI_STATES.HURT) {
    if (recoilTimer <= 0) {
      state = ENEMY_AI_STATES.CHASE;
      moveX = dirX * config.speed;
      moveZ = dirZ * config.speed;
      speed = config.speed;
    } else {
      // Gentle recoil pushback away from player
      moveX = -dirX * 0.8;
      moveZ = -dirZ * 0.8;
      speed = 0.8;
    }
  }
  // 3. Attack state
  else if (state === ENEMY_AI_STATES.ATTACK) {
    attackTimer += dt;
    if (attackTimer >= timing.totalDuration) {
      state = ENEMY_AI_STATES.CHASE;
      attackTimer = 0;
      cooldownTimer = config.attackCooldown;
      moveX = dirX * config.speed;
      moveZ = dirZ * config.speed;
      speed = config.speed;
    }
    // While striking, enemy plants feet and does not translate
    speed = 0;
  }
  // 4. Chase state
  else if (state === ENEMY_AI_STATES.CHASE) {
    if (dist <= config.attackRadius && cooldownTimer <= 0) {
      state = ENEMY_AI_STATES.ATTACK;
      attackTimer = 0;
      wantsAttack = true;
    } else if (dist > config.aggroRadius) {
      state = ENEMY_AI_STATES.IDLE;
    } else {
      // Approach player
      moveX = dirX * config.speed;
      moveZ = dirZ * config.speed;
      speed = config.speed;
    }
  }
  // 5. Idle state
  else if (state === ENEMY_AI_STATES.IDLE) {
    if (dist <= config.aggroRadius) {
      state = ENEMY_AI_STATES.CHASE;
      moveX = dirX * config.speed;
      moveZ = dirZ * config.speed;
      speed = config.speed;
    }
  }

  return {
    state,
    intent: {
      moveX,
      moveZ,
      speed,
      rotationY: targetRotationY,
      wantsAttack
    },
    attackTimer,
    cooldownTimer,
    recoilTimer
  };
}
