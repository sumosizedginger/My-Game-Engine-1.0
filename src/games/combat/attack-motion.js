/**
 * My Game Engine 1.0 — Proof B2: Procedural Attack Motion Channel
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Procedural melee strike layered over accepted locomotion pose.
 * Defines windup -> active -> recovery timing used synchronously by both
 * skeletal pose deformation and the authoritative combat hit volume.
 * Follows B2 work order and GAMEPLAY_FOUNDATION.md.
 */

import { COMBAT_CONFIG } from './definitions.js';

const { windupDuration, activeDuration, recoveryDuration, totalDuration } = COMBAT_CONFIG.attackTiming;
const activeStartTime = windupDuration;
const activeEndTime = windupDuration + activeDuration;

/**
 * Evaluates the attack phase and progress.
 *
 * @param {number} timer - Current attack elapsed time in seconds.
 * @returns {{ phase: 'windup'|'active'|'recovery'|'complete', progress: number, isActive: boolean }}
 */
export function getAttackPhase(timer) {
  if (timer < 0) {
    return { phase: 'complete', progress: 0, isActive: false };
  }
  if (timer < activeStartTime) {
    const progress = Math.min(1, timer / windupDuration);
    return { phase: 'windup', progress, isActive: false };
  }
  if (timer < activeEndTime) {
    const progress = Math.min(1, (timer - activeStartTime) / activeDuration);
    return { phase: 'active', progress, isActive: true };
  }
  if (timer < totalDuration) {
    const progress = Math.min(1, (timer - activeEndTime) / recoveryDuration);
    return { phase: 'recovery', progress, isActive: false };
  }
  return { phase: 'complete', progress: 1, isActive: false };
}

/**
 * Computes the single authoritative attack volume from attacker world transform and timing.
 *
 * @param {object} transform - { position: { x, y, z }, rotationY: number }
 * @param {number} timer - Current attack elapsed time in seconds.
 * @returns {{ active: boolean, center?: { x: number, y: number, z: number }, radius?: number, minY?: number, maxY?: number }}
 */
export function getAuthoritativeAttackVolume(transform, timer) {
  const { isActive, phase, progress } = getAttackPhase(timer);
  if (!isActive) {
    return { active: false, phase };
  }

  const { forwardOffset, radius, minY, maxY } = COMBAT_CONFIG.attackVolume;
  const rotY = transform.rotationY || 0;

  // Center shifts slightly forward as punch reaches apex during active phase
  const reachScale = 0.85 + 0.15 * Math.sin(progress * Math.PI);
  const actualOffset = forwardOffset * reachScale;

  const centerX = transform.position.x + Math.sin(rotY) * actualOffset;
  const centerZ = transform.position.z + Math.cos(rotY) * actualOffset;
  const centerY = (minY + maxY) / 2;

  return {
    active: true,
    phase,
    progress,
    center: { x: centerX, y: centerY, z: centerZ },
    radius,
    minY,
    maxY
  };
}

/**
 * Layers procedural strike articulation onto the upper body bones of a character.
 * Lower body bones (pelvis, thighs, shins, feet) remain controlled by locomotion/grounding.
 *
 * @param {object} character - SkinnedMesh character object.
 * @param {number} timer - Current attack elapsed time in seconds.
 */
export function applyProceduralAttackPose(character, timer) {
  if (!character || !character.bonesByName) return;
  const { phase, progress } = getAttackPhase(timer);
  if (phase === 'complete') return;

  const bones = character.bonesByName;

  let shoulderPitch = 0;
  let upperarmPitch = 0;
  let upperarmYaw = 0;
  let upperarmRoll = 0;
  let forearmFlex = -0.30;
  let torsoLean = 0;

  if (phase === 'windup') {
    // Smoothstep C1 windup anticipation: arm draws backward, elbow flexes tightly
    const s = progress * progress * (3 - 2 * progress);
    shoulderPitch = 0.10 * s;
    upperarmPitch = 0.45 * s;      // Pitches backward (+X)
    upperarmYaw = -0.20 * s;
    upperarmRoll = 0.15 * s;
    forearmFlex = -(0.30 + 0.85 * s); // Tight elbow bend ~65 deg
    torsoLean = -0.05 * s;         // Lean back slightly
  } else if (phase === 'active') {
    // Powerful forward punch thrust
    const s = progress * progress * (3 - 2 * progress);
    shoulderPitch = -0.15 * s;
    upperarmPitch = 0.45 * (1 - s) + (-0.80) * s; // Explosive punch forward (-X)
    upperarmYaw = -0.20 * (1 - s) + (0.10) * s;
    upperarmRoll = 0.15 * (1 - s);
    forearmFlex = -1.15 * (1 - s) + (-0.18) * s;  // Elbow extends to punch
    torsoLean = -0.05 * (1 - s) + 0.10 * s;       // Athletic forward torso commitment
  } else if (phase === 'recovery') {
    // Follow-through and return to neutral stance
    const s = progress * progress * (3 - 2 * progress);
    shoulderPitch = -0.15 * (1 - s);
    upperarmPitch = -0.80 * (1 - s);
    upperarmYaw = 0.10 * (1 - s);
    upperarmRoll = 0;
    forearmFlex = -0.18 * (1 - s) + (-0.30) * s;
    torsoLean = 0.10 * (1 - s);
  }

  // Apply to Right Arm (dominant striking limb)
  if (bones.shoulder_r) {
    bones.shoulder_r.rotation.x = shoulderPitch;
  }
  if (bones.upperarm_r) {
    bones.upperarm_r.rotation.x = upperarmPitch;
    bones.upperarm_r.rotation.y = upperarmYaw;
    bones.upperarm_r.rotation.z = upperarmRoll;
  }
  if (bones.forearm_r) {
    bones.forearm_r.rotation.x = forearmFlex;
  }

  // Subtle thoracic torso follow-through
  if (bones.spine) {
    bones.spine.rotation.x = torsoLean * 0.5;
  }
  if (bones.chest) {
    bones.chest.rotation.x = torsoLean * 0.5;
  }
}
