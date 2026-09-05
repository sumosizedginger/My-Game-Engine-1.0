/**
 * My Game Engine 1.0 — Proof B2: Arena Combat Game Coordinator
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Coordinates fixed-step combat gameplay, single-writer transform authority,
 * deterministic enemy AI, and single authoritative hit resolution.
 * Driven by the accepted SimulationClock (does NOT create a second clock).
 * Follows GAMEPLAY_FOUNDATION.md and B2 work order.
 */

import { createSimulationClock } from '../../runtime/clock.js';
import { createEntityManager } from '../../runtime/entities.js';
import { createInputSystem } from '../../runtime/input.js';
import { buildHumanoidCharacter } from '../../character/index.js';
import { createLocomotionEvaluator } from '../../motion/index.js';
import { generateProceduralRoom } from '../../geometry/index.js';
import { compileMaterial, MATERIAL_PRESETS } from '../../material/index.js';
import { COMBAT_CONFIG, COMBAT_STATES, ENEMY_AI_STATES } from './definitions.js';
import { getAuthoritativeAttackVolume, applyProceduralAttackPose, getAttackPhase } from './attack-motion.js';
import { testAttackHit, sampleFistCoherence } from './combat.js';
import { updateEnemyAI } from './ai.js';

export class ArenaCombatGame {
  /**
   * Initializes the B2 Combat Room Game.
   *
   * @param {object} [options={}]
   * @param {object} [options.clock] - Accepted SimulationClock instance.
   * @param {object} [options.input] - Accepted InputSystem instance.
   * @param {object} [options.room] - Pre-generated room artifact.
   */
  constructor(options = {}) {
    // 1. Simulation clock (uses existing engine clock, does NOT create a competing loop)
    this.clock = options.clock || createSimulationClock({ tickRate: 60 });
    this.entityManager = options.entityManager || createEntityManager();

    // 2. Action Input System
    const combatActions = ['MoveForward', 'MoveBackward', 'MoveLeft', 'MoveRight', 'Attack', 'Reset'];
    this.input = options.input || createInputSystem({ actions: combatActions });
    this._configureDefaultInputBindings();

    // 3. Room & Arena Environment (Geometry + Collision derived together)
    this.room = options.room || generateProceduralRoom('combat_arena');

    // 4. Game & Combat State
    this.state = COMBAT_STATES.READY;
    this.diagnostics = [];

    this.combatStats = {
      playerHitsLanded: 0,
      enemyHitsLanded: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      lastAttackVolume: null,
      lastHitPoint: null,
      lastFistCoherence: null
    };

    // 5. Entities & Characters
    this._initEntities();

    this.diagnostics.push({
      severity: 'INFO',
      code: 'B2_GAME_INIT',
      subsystem: 'combat',
      message: 'Arena Combat Game initialized with room, characters, and single hit authority'
    });
  }

  _configureDefaultInputBindings() {
    this.input.bindKey('KeyW', 'MoveForward');
    this.input.bindKey('KeyS', 'MoveBackward');
    this.input.bindKey('KeyA', 'MoveLeft');
    this.input.bindKey('KeyD', 'MoveRight');
    this.input.bindKey('ArrowUp', 'MoveForward');
    this.input.bindKey('ArrowDown', 'MoveBackward');
    this.input.bindKey('ArrowLeft', 'MoveLeft');
    this.input.bindKey('ArrowRight', 'MoveRight');
    this.input.bindKey('Space', 'Attack');
    this.input.bindKey('KeyJ', 'Attack');
    this.input.bindKey('KeyR', 'Reset');

    if (typeof this.input.bindGamepadButton === 'function') {
      this.input.bindGamepadButton(0, 'Attack');       // Button South / A / Cross
      this.input.bindGamepadButton(3, 'Reset');        // Button North / Y / Triangle
      this.input.bindGamepadButton(8, 'Reset');        // Back / View / Select
      this.input.bindGamepadButton(12, 'MoveForward'); // D-pad Up
      this.input.bindGamepadButton(13, 'MoveBackward');// D-pad Down
      this.input.bindGamepadButton(14, 'MoveLeft');    // D-pad Left
      this.input.bindGamepadButton(15, 'MoveRight');   // D-pad Right
    }

    if (typeof this.input.bindGamepadAxis === 'function') {
      // Left Stick X (axis 0): negative -> MoveLeft, positive -> MoveRight
      this.input.bindGamepadAxis(0, 'MoveLeft', 'MoveRight', { deadzone: 0.25 });
      // Left Stick Y (axis 1): negative -> MoveForward, positive -> MoveBackward
      this.input.bindGamepadAxis(1, 'MoveForward', 'MoveBackward', { deadzone: 0.25 });
    }
  }

  _initEntities() {
    // Entity Handles
    this.playerHandle = this.entityManager.spawn('player');
    this.enemyHandle = this.entityManager.spawn('enemy');

    // Material compilation from Material Forge
    const playerMat = compileMaterial(MATERIAL_PRESETS.playerClay);
    const enemyMat = compileMaterial(MATERIAL_PRESETS.enemyClay);

    // Character synthesis from Character Forge
    const playerChar = buildHumanoidCharacter('athletic', { color: playerMat.color.getHex() });
    playerChar.mesh.material = playerMat;

    const enemyChar = buildHumanoidCharacter('heavy', { color: enemyMat.color.getHex() });
    enemyChar.mesh.material = enemyMat;

    // Motion Forge Locomotion Evaluators
    const playerEvaluator = createLocomotionEvaluator(playerChar, 'natural');
    const enemyEvaluator = createLocomotionEvaluator(enemyChar, 'stroll');

    // Player State Record
    this.player = {
      handle: this.playerHandle,
      hp: COMBAT_CONFIG.player.maxHp,
      maxHp: COMBAT_CONFIG.player.maxHp,
      transform: {
        position: { x: 0, y: 0, z: -4.5 },
        rotationY: 0 // Faces +Z toward enemy
      },
      velocity: { x: 0, z: 0 },
      speed: 0,
      attackTimer: -1,
      attackHasHit: false,
      cooldownTimer: 0,
      character: playerChar,
      evaluator: playerEvaluator
    };

    // Enemy State Record
    this.enemy = {
      handle: this.enemyHandle,
      hp: COMBAT_CONFIG.enemy.maxHp,
      maxHp: COMBAT_CONFIG.enemy.maxHp,
      transform: {
        position: { x: 0, y: 0, z: 4.5 },
        rotationY: Math.PI // Faces -Z toward player
      },
      velocity: { x: 0, z: 0 },
      speed: 0,
      aiState: ENEMY_AI_STATES.IDLE,
      attackTimer: 0,
      attackHasHit: false,
      cooldownTimer: 0,
      recoilTimer: 0,
      character: enemyChar,
      evaluator: enemyEvaluator
    };

    // Initial scene placement
    this._syncMeshTransforms();
  }

  /**
   * Resets the combat room to the pristine initial state.
   */
  reset() {
    this.state = COMBAT_STATES.READY;
    this.player.hp = this.player.maxHp;
    this.player.transform.position.x = 0;
    this.player.transform.position.y = 0;
    this.player.transform.position.z = -4.5;
    this.player.transform.rotationY = 0;
    this.player.velocity.x = 0;
    this.player.velocity.z = 0;
    this.player.speed = 0;
    this.player.attackTimer = -1;
    this.player.attackHasHit = false;
    this.player.cooldownTimer = 0;

    this.enemy.hp = this.enemy.maxHp;
    this.enemy.transform.position.x = 0;
    this.enemy.transform.position.y = 0;
    this.enemy.transform.position.z = 4.5;
    this.enemy.transform.rotationY = Math.PI;
    this.enemy.velocity.x = 0;
    this.enemy.velocity.z = 0;
    this.enemy.speed = 0;
    this.enemy.aiState = ENEMY_AI_STATES.IDLE;
    this.enemy.attackTimer = 0;
    this.enemy.attackHasHit = false;
    this.enemy.cooldownTimer = 0;
    this.enemy.recoilTimer = 0;

    this.combatStats.playerHitsLanded = 0;
    this.combatStats.enemyHitsLanded = 0;
    this.combatStats.totalDamageDealt = 0;
    this.combatStats.totalDamageTaken = 0;
    this.combatStats.lastAttackVolume = null;
    this.combatStats.lastHitPoint = null;

    this._syncMeshTransforms();

    this.diagnostics.push({
      severity: 'INFO',
      code: 'B2_GAME_RESET',
      subsystem: 'combat',
      message: 'Combat room reset to initial ready state'
    });
  }

  /**
   * Fixed simulation update step (driven by clock).
   *
   * @param {number} dt - Delta time in seconds (typically fixed ~0.0166s).
   */
  update(dt) {
    const inputSnapshot = this.input.captureSnapshot ? this.input.captureSnapshot() : this.input;

    // 0. Check Reset action
    if (inputSnapshot.isActionActive('Reset')) {
      this.reset();
      return;
    }

    // 1. Gather Player Movement & Combat Intent
    const pCfg = COMBAT_CONFIG.player;
    this.player.cooldownTimer = Math.max(0, this.player.cooldownTimer - dt);

    let moveX = 0;
    let moveZ = 0;
    if (this.state !== COMBAT_STATES.VICTORY && this.state !== COMBAT_STATES.DEFEAT) {
      if (inputSnapshot.isActionActive('MoveRight')) moveX += 1;
      if (inputSnapshot.isActionActive('MoveLeft')) moveX -= 1;
      if (inputSnapshot.isActionActive('MoveForward')) moveZ += 1;
      if (inputSnapshot.isActionActive('MoveBackward')) moveZ -= 1;
    }

    const moveLen = Math.hypot(moveX, moveZ);
    let targetSpeed = 0;
    if (moveLen > 0.001) {
      moveX /= moveLen;
      moveZ /= moveLen;
      targetSpeed = pCfg.speed;
      this.player.transform.rotationY = Math.atan2(moveX, moveZ);
      if (this.state === COMBAT_STATES.READY) {
        this.state = COMBAT_STATES.ENGAGED;
      }
    }

    // Attack Action Intent
    const wantsAttack = inputSnapshot.isActionActive('Attack') &&
      this.player.attackTimer < 0 &&
      this.player.cooldownTimer <= 0 &&
      this.state !== COMBAT_STATES.VICTORY &&
      this.state !== COMBAT_STATES.DEFEAT;

    if (wantsAttack) {
      this.player.attackTimer = 0;
      this.player.attackHasHit = false;
      if (this.state === COMBAT_STATES.READY) {
        this.state = COMBAT_STATES.ENGAGED;
      }
    }

    // If attacking, player slows to plant feet for strike
    if (this.player.attackTimer >= 0) {
      targetSpeed *= 0.15;
    }

    this.player.velocity.x = moveX * targetSpeed;
    this.player.velocity.z = moveZ * targetSpeed;
    this.player.speed = targetSpeed;

    // 2. Gather Enemy AI Intent
    const aiUpdate = updateEnemyAI(this.enemy, this.player.transform, dt);
    this.enemy.aiState = aiUpdate.state;
    this.enemy.attackTimer = aiUpdate.attackTimer;
    this.enemy.cooldownTimer = aiUpdate.cooldownTimer;
    this.enemy.recoilTimer = aiUpdate.recoilTimer;
    this.enemy.velocity.x = aiUpdate.intent.moveX;
    this.enemy.velocity.z = aiUpdate.intent.moveZ;
    this.enemy.speed = aiUpdate.intent.speed;
    this.enemy.transform.rotationY = aiUpdate.intent.rotationY;

    if (aiUpdate.intent.wantsAttack) {
      this.enemy.attackHasHit = false;
    }

    // 3. SINGLE-WRITER TRANSFORM AUTHORITY (Integrate + Resolve Room Collision)
    // Player
    const candPlayerX = this.player.transform.position.x + this.player.velocity.x * dt;
    const candPlayerZ = this.player.transform.position.z + this.player.velocity.z * dt;
    const resPlayer = this.room.collision.resolvePosition(candPlayerX, candPlayerZ, pCfg.collisionRadius);
    this.player.transform.position.x = resPlayer.x;
    this.player.transform.position.z = resPlayer.z;

    // Enemy
    const candEnemyX = this.enemy.transform.position.x + this.enemy.velocity.x * dt;
    const candEnemyZ = this.enemy.transform.position.z + this.enemy.velocity.z * dt;
    const resEnemy = this.room.collision.resolvePosition(candEnemyX, candEnemyZ, COMBAT_CONFIG.enemy.collisionRadius);

    // Entity-to-entity pushback to prevent clipping
    const cdx = resEnemy.x - this.player.transform.position.x;
    const cdz = resEnemy.z - this.player.transform.position.z;
    const cDist = Math.hypot(cdx, cdz) || 0.001;
    const minCharDist = pCfg.collisionRadius + COMBAT_CONFIG.enemy.collisionRadius;
    if (cDist < minCharDist) {
      const push = (minCharDist - cDist) * 0.5;
      this.enemy.transform.position.x = resEnemy.x + (cdx / cDist) * push;
      this.enemy.transform.position.z = resEnemy.z + (cdz / cDist) * push;
    } else {
      this.enemy.transform.position.x = resEnemy.x;
      this.enemy.transform.position.z = resEnemy.z;
    }

    // 4. AUTHORITATIVE COMBAT HIT EVALUATION
    // 4a. Player Attack
    if (this.player.attackTimer >= 0) {
      this.player.attackTimer += dt;
      const attackVolume = getAuthoritativeAttackVolume(this.player.transform, this.player.attackTimer);
      this.combatStats.lastAttackVolume = attackVolume;

      // Sample fist coherence diagnostic metric
      this.combatStats.lastFistCoherence = sampleFistCoherence(this.player.character, attackVolume);

      // Evaluate damage strictly during active strike window
      if (attackVolume.active && !this.player.attackHasHit && this.enemy.hp > 0) {
        const hitResult = testAttackHit(attackVolume, this.enemy.transform, COMBAT_CONFIG.enemy.collisionRadius);
        if (hitResult.hit) {
          this.player.attackHasHit = true;
          this.enemy.hp = Math.max(0, this.enemy.hp - pCfg.attackDamage);
          this.combatStats.playerHitsLanded++;
          this.combatStats.totalDamageDealt += pCfg.attackDamage;
          this.combatStats.lastHitPoint = hitResult.contactPoint;

          this.enemy.aiState = ENEMY_AI_STATES.HURT;
          this.enemy.recoilTimer = COMBAT_CONFIG.enemy.recoilDuration;

          this.diagnostics.push({
            severity: 'INFO',
            code: 'B2_HIT_CONFIRMED',
            subsystem: 'combat',
            message: `Player strike hit enemy for ${pCfg.attackDamage} damage. Enemy HP: ${this.enemy.hp}`
          });

          if (this.enemy.hp <= 0) {
            this.enemy.aiState = ENEMY_AI_STATES.DEAD;
            this.state = COMBAT_STATES.VICTORY;
            this.diagnostics.push({
              severity: 'INFO',
              code: 'B2_VICTORY',
              subsystem: 'combat',
              message: 'Enemy defeated. Victory state achieved.'
            });
          }
        }
      }

      if (this.player.attackTimer >= COMBAT_CONFIG.attackTiming.totalDuration) {
        this.player.attackTimer = -1;
        this.player.cooldownTimer = pCfg.attackCooldown;
        this.combatStats.lastAttackVolume = null;
      }
    }

    // 4b. Enemy Attack
    if (this.enemy.aiState === ENEMY_AI_STATES.ATTACK) {
      const eVolume = getAuthoritativeAttackVolume(this.enemy.transform, this.enemy.attackTimer);
      if (eVolume.active && !this.enemy.attackHasHit && this.player.hp > 0) {
        const hitResult = testAttackHit(eVolume, this.player.transform, pCfg.collisionRadius);
        if (hitResult.hit) {
          this.enemy.attackHasHit = true;
          this.player.hp = Math.max(0, this.player.hp - COMBAT_CONFIG.enemy.attackDamage);
          this.combatStats.enemyHitsLanded++;
          this.combatStats.totalDamageTaken += COMBAT_CONFIG.enemy.attackDamage;

          if (this.player.hp <= 0) {
            this.state = COMBAT_STATES.DEFEAT;
          }
        }
      }
    }

    // 5. ANIMATION & PROCEDURAL MOTION SYNCHRONIZATION
    this._updateProceduralAnimations(dt);

    // 6. Mesh World Transforms committed from authoritative state
    this._syncMeshTransforms();
  }

  _updateProceduralAnimations(dt) {
    // Player: Locomotion when traversing, procedural attack pose layered when attacking
    if (this.player.speed > 0.05) {
      this.player.evaluator.update(dt);
    }
    if (this.player.attackTimer >= 0) {
      applyProceduralAttackPose(this.player.character, this.player.attackTimer);
    }

    // Enemy: Locomotion when traversing, procedural attack pose when attacking
    if (this.enemy.speed > 0.05 && this.enemy.aiState !== ENEMY_AI_STATES.DEAD) {
      this.enemy.evaluator.update(dt);
    }
    if (this.enemy.aiState === ENEMY_AI_STATES.ATTACK) {
      applyProceduralAttackPose(this.enemy.character, this.enemy.attackTimer);
    }

    // Death collapse: if enemy dead, tilt body to floor
    if (this.enemy.aiState === ENEMY_AI_STATES.DEAD && this.enemy.character.rootBone) {
      this.enemy.character.rootBone.rotation.x = -Math.PI / 2;
      this.enemy.character.rootBone.position.y = 0.20;
    }
  }

  _syncMeshTransforms() {
    if (this.player.character?.mesh) {
      this.player.character.mesh.position.set(
        this.player.transform.position.x,
        0,
        this.player.transform.position.z
      );
      this.player.character.mesh.rotation.y = this.player.transform.rotationY;
    }

    if (this.enemy.character?.mesh) {
      this.enemy.character.mesh.position.set(
        this.enemy.transform.position.x,
        0,
        this.enemy.transform.position.z
      );
      this.enemy.character.mesh.rotation.y = this.enemy.transform.rotationY;
    }
  }

  /**
   * Programmatic attack trigger for automated evaluation fixtures.
   */
  triggerAttack() {
    if (this.player.attackTimer < 0) {
      this.player.attackTimer = 0;
      this.player.attackHasHit = false;
      if (this.state === COMBAT_STATES.READY) {
        this.state = COMBAT_STATES.ENGAGED;
      }
    }
  }

  /**
   * Returns serializable, inspectable state for telemetry and evaluation.
   */
  getStateSnapshot() {
    return {
      state: this.state,
      player: {
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        position: { ...this.player.transform.position },
        rotationY: this.player.transform.rotationY,
        speed: this.player.speed,
        isAttacking: this.player.attackTimer >= 0,
        attackPhase: getAttackPhase(this.player.attackTimer).phase
      },
      enemy: {
        hp: this.enemy.hp,
        maxHp: this.enemy.maxHp,
        position: { ...this.enemy.transform.position },
        rotationY: this.enemy.transform.rotationY,
        speed: this.enemy.speed,
        aiState: this.enemy.aiState
      },
      combatStats: { ...this.combatStats },
      roomStats: this.room.stats
    };
  }
}
