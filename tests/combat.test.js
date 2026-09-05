/**
 * My Game Engine 1.0 — Proof B2 Combat Room Unit Tests
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ArenaCombatGame,
  COMBAT_CONFIG,
  COMBAT_STATES,
  ENEMY_AI_STATES,
  getAttackPhase,
  getAuthoritativeAttackVolume,
  applyProceduralAttackPose,
  testAttackHit,
  sampleFistCoherence,
  updateEnemyAI
} from '../src/games/combat/index.js';

test('Combat Room — Single Authoritative Hit Contract', async (t) => {
  await t.test('testAttackHit returns hit: true when attack volume intersects hurtbox', () => {
    const attackVolume = {
      active: true,
      center: { x: 0, y: 1.0, z: 0.5 },
      radius: 0.8,
      minY: 0.3,
      maxY: 1.7
    };

    const targetTransform = {
      position: { x: 0, y: 0, z: 1.0 },
      rotationY: Math.PI
    };

    const result = testAttackHit(attackVolume, targetTransform, 0.45, 1.85);
    assert.equal(result.hit, true);
    assert.ok(result.contactPoint, 'produces valid contact point');
    assert.ok(typeof result.contactPoint.x === 'number');
    assert.ok(typeof result.contactPoint.y === 'number');
    assert.ok(typeof result.contactPoint.z === 'number');
  });

  await t.test('testAttackHit returns hit: false when target is outside volume radius', () => {
    const attackVolume = {
      active: true,
      center: { x: 0, y: 1.0, z: 0.5 },
      radius: 0.8,
      minY: 0.3,
      maxY: 1.7
    };

    const targetFar = {
      position: { x: 0, y: 0, z: 5.0 }
    };

    const result = testAttackHit(attackVolume, targetFar, 0.45, 1.85);
    assert.equal(result.hit, false);
  });

  await t.test('testAttackHit returns hit: false when attack volume is inactive', () => {
    const attackVolume = {
      active: false,
      phase: 'windup'
    };

    const targetNear = {
      position: { x: 0, y: 0, z: 0.5 }
    };

    const result = testAttackHit(attackVolume, targetNear, 0.45, 1.85);
    assert.equal(result.hit, false);
  });
});

test('Combat Room — Attack Motion Channel & Timing', async (t) => {
  await t.test('getAttackPhase transitions strictly: windup -> active -> recovery -> complete', () => {
    const { windupDuration, activeDuration, recoveryDuration, totalDuration } = COMBAT_CONFIG.attackTiming;

    // 1. Windup
    const p1 = getAttackPhase(0.02);
    assert.equal(p1.phase, 'windup');
    assert.equal(p1.isActive, false);

    // 2. Active strike window
    const p2 = getAttackPhase(windupDuration + 0.02);
    assert.equal(p2.phase, 'active');
    assert.equal(p2.isActive, true);

    // 3. Recovery follow-through
    const p3 = getAttackPhase(windupDuration + activeDuration + 0.02);
    assert.equal(p3.phase, 'recovery');
    assert.equal(p3.isActive, false);

    // 4. Complete
    const p4 = getAttackPhase(totalDuration + 0.05);
    assert.equal(p4.phase, 'complete');
    assert.equal(p4.isActive, false);
  });

  await t.test('getAuthoritativeAttackVolume is active ONLY during the active strike window', () => {
    const transform = { position: { x: 0, y: 0, z: 0 }, rotationY: 0 };
    const { windupDuration, activeDuration } = COMBAT_CONFIG.attackTiming;

    // During windup: inactive
    const volWindup = getAuthoritativeAttackVolume(transform, windupDuration * 0.5);
    assert.equal(volWindup.active, false);

    // During active: active with center offset forward (+Z)
    const volActive = getAuthoritativeAttackVolume(transform, windupDuration + activeDuration * 0.5);
    assert.equal(volActive.active, true);
    assert.ok(volActive.center.z > 0, 'center is in front of character');
    assert.equal(volActive.radius, COMBAT_CONFIG.attackVolume.radius);

    // After total duration: inactive
    const volDone = getAuthoritativeAttackVolume(transform, 1.0);
    assert.equal(volDone.active, false);
  });
});

test('Combat Room — Fist Coherence Diagnostic Inspection', async (t) => {
  await t.test('sampleFistCoherence inspects distance without gating hit queries', () => {
    const game = new ArenaCombatGame();
    const transform = { position: { x: 0, y: 0, z: 0 }, rotationY: 0 };
    const attackVol = getAuthoritativeAttackVolume(transform, 0.15); // active window

    const coherence = sampleFistCoherence(game.player.character, attackVol);
    assert.ok(coherence, 'returns coherence metric record');
    assert.ok(typeof coherence.coherent === 'boolean');
    assert.ok(typeof coherence.distance === 'number');
    assert.ok(coherence.fistPos);
    assert.ok(coherence.centerPos);
  });
});

test('Combat Room — Deterministic Enemy AI State Machine', async (t) => {
  await t.test('transitions from IDLE to CHASE when player is within aggro radius', () => {
    const enemy = {
      hp: 100,
      state: ENEMY_AI_STATES.IDLE,
      transform: { position: { x: 0, y: 0, z: 4.0 }, rotationY: Math.PI },
      attackTimer: 0,
      cooldownTimer: 0,
      recoilTimer: 0
    };

    const playerTransform = { position: { x: 0, y: 0, z: 0 } }; // Dist = 4.0m <= aggroRadius (9.0m)
    const update = updateEnemyAI(enemy, playerTransform, 0.016);

    assert.equal(update.state, ENEMY_AI_STATES.CHASE);
    assert.ok(update.intent.speed > 0);
  });

  await t.test('transitions from CHASE to ATTACK when in melee range', () => {
    const enemy = {
      hp: 100,
      state: ENEMY_AI_STATES.CHASE,
      transform: { position: { x: 0, y: 0, z: 1.0 }, rotationY: Math.PI },
      attackTimer: 0,
      cooldownTimer: 0,
      recoilTimer: 0
    };

    const playerTransform = { position: { x: 0, y: 0, z: 0 } }; // Dist = 1.0m <= attackRadius (1.4m)
    const update = updateEnemyAI(enemy, playerTransform, 0.016);

    assert.equal(update.state, ENEMY_AI_STATES.ATTACK);
    assert.equal(update.intent.wantsAttack, true);
    assert.equal(update.intent.speed, 0, 'plants feet while striking');
  });

  await t.test('transitions to DEAD when hp reaches 0', () => {
    const enemy = {
      hp: 0,
      state: ENEMY_AI_STATES.HURT,
      transform: { position: { x: 0, y: 0, z: 1.0 }, rotationY: Math.PI }
    };

    const playerTransform = { position: { x: 0, y: 0, z: 0 } };
    const update = updateEnemyAI(enemy, playerTransform, 0.016);

    assert.equal(update.state, ENEMY_AI_STATES.DEAD);
    assert.equal(update.intent.speed, 0);
  });
});

test('Combat Room — ArenaCombatGame Coordinator & Lifecycle', async (t) => {
  await t.test('initializes with single transform authority, characters, and room', () => {
    const game = new ArenaCombatGame();

    assert.equal(game.state, COMBAT_STATES.READY);
    assert.ok(game.player.character.mesh, 'player has character mesh');
    assert.ok(game.enemy.character.mesh, 'enemy has character mesh');
    assert.ok(game.room.visual.geometry, 'room has visual geometry');
    assert.ok(game.room.collision, 'room has collision representation');
    assert.equal(game.player.hp, 100);
    assert.equal(game.enemy.hp, 100);
  });

  await t.test('advances simulation, resolves collision, deals damage, and achieves victory', () => {
    const game = new ArenaCombatGame();

    // 1. Move player forward into melee range
    game.player.transform.position.z = 3.6;
    game.enemy.transform.position.z = 4.5; // Dist = 0.9m

    // 2. Trigger player strike
    game.triggerAttack();
    assert.equal(game.state, COMBAT_STATES.ENGAGED);
    assert.equal(game.player.attackTimer, 0);

    // Step through the active strike window (windup 0.10s -> active 0.12s)
    for (let i = 0; i < 15; i++) {
      game.update(0.016);
    }

    assert.equal(game.combatStats.playerHitsLanded, 1, 'player landed 1 hit');
    assert.equal(game.combatStats.totalDamageDealt, COMBAT_CONFIG.player.attackDamage);
    assert.equal(game.enemy.hp, 100 - COMBAT_CONFIG.player.attackDamage);
    assert.equal(game.enemy.aiState, ENEMY_AI_STATES.HURT);

    // 3. Repeat strikes to defeat enemy and confirm VICTORY state
    for (let round = 0; round < 4; round++) {
      game.player.attackTimer = -1;
      game.player.cooldownTimer = 0;
      game.triggerAttack();
      for (let i = 0; i < 15; i++) {
        game.update(0.016);
      }
    }

    assert.equal(game.enemy.hp, 0);
    assert.equal(game.state, COMBAT_STATES.VICTORY);
    assert.equal(game.enemy.aiState, ENEMY_AI_STATES.DEAD);

    // 4. Test reset returns to pristine state
    game.reset();
    assert.equal(game.state, COMBAT_STATES.READY);
    assert.equal(game.player.hp, 100);
    assert.equal(game.enemy.hp, 100);
    assert.equal(game.combatStats.playerHitsLanded, 0);
    assert.equal(game.player.transform.position.z, -4.5);
  });

  await t.test('player moves forward through real input/action simulation and authoritative integration', () => {
    const game = new ArenaCombatGame();
    const startZ = game.player.transform.position.z;

    // Simulate real MoveForward action through accepted InputSystem
    game.input.simulateAction('MoveForward', true);

    // Step fixed simulation ticks
    for (let i = 0; i < 60; i++) {
      game.update(0.016);
    }

    // Release action
    game.input.simulateAction('MoveForward', false);

    // Step a couple ticks to resolve release
    for (let i = 0; i < 5; i++) {
      game.update(0.016);
    }

    const endZ = game.player.transform.position.z;
    const deltaZ = endZ - startZ;

    assert.ok(deltaZ > 1.5, `Player world transform must advance forward through input path (deltaZ: ${deltaZ})`);
    assert.equal(game.player.velocity.z, 0, 'Velocity returns to zero after releasing action');
  });
});
