/**
 * My Game Engine 1.0 — Proof B2: Combat Room Public API
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Public barrel export for the B2 Procedural Combat Room game.
 * Follows B2 work order and GAMEPLAY_FOUNDATION.md.
 */

export {
  COMBAT_CONFIG,
  COMBAT_STATES,
  ENEMY_AI_STATES
} from './definitions.js';

export {
  getAttackPhase,
  getAuthoritativeAttackVolume,
  applyProceduralAttackPose
} from './attack-motion.js';

export {
  testAttackHit,
  sampleFistCoherence
} from './combat.js';

export {
  updateEnemyAI
} from './ai.js';

export {
  ArenaCombatGame
} from './arena-game.js';

export {
  createCombatRenderer
} from './renderer.js';
