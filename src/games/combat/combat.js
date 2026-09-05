/**
 * My Game Engine 1.0 — Proof B2: Authoritative Combat Hit Resolution
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Implements the single authoritative hit query contract between the
 * attacker's attack volume and the target's hurtbox volume.
 * Provides visual fist coherence inspection for diagnostic validation.
 * Follows B2 work order and GAMEPLAY_FOUNDATION.md.
 */

import { Vector3 } from 'three';

/**
 * Tests whether an authoritative attack volume intersects a target hurtbox volume.
 *
 * @param {object} attackVolume - From getAuthoritativeAttackVolume().
 * @param {object} targetTransform - { position: { x, y, z }, rotationY?: number }
 * @param {number} [targetRadius=0.45] - Hurtbox radius.
 * @param {number} [targetHeight=1.85] - Hurtbox height.
 * @returns {{ hit: boolean, distance?: number, contactPoint?: { x: number, y: number, z: number } }}
 */
export function testAttackHit(attackVolume, targetTransform, targetRadius = 0.45, targetHeight = 1.85) {
  if (!attackVolume || !attackVolume.active || !attackVolume.center) {
    return { hit: false };
  }

  const targetPos = targetTransform.position;
  const dx = attackVolume.center.x - targetPos.x;
  const dz = attackVolume.center.z - targetPos.z;
  const distSq = dx * dx + dz * dz;

  const maxDist = attackVolume.radius + targetRadius;
  if (distSq > maxDist * maxDist) {
    return { hit: false };
  }

  // Vertical overlap check
  const targetMinY = targetPos.y || 0;
  const targetMaxY = targetMinY + targetHeight;

  if (attackVolume.minY > targetMaxY || attackVolume.maxY < targetMinY) {
    return { hit: false };
  }

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-4 ? dx / dist : 0;
  const nz = dist > 1e-4 ? dz / dist : 1;

  return {
    hit: true,
    distance: dist,
    contactPoint: {
      x: targetPos.x + nx * targetRadius,
      y: (Math.max(attackVolume.minY, targetMinY) + Math.min(attackVolume.maxY, targetMaxY)) / 2,
      z: targetPos.z + nz * targetRadius
    }
  };
}

const _tempFistVec = new Vector3();

/**
 * Diagnostic inspection metric measuring visual coherence between the
 * rendered striking hand bone and the authoritative attack volume center.
 *
 * @param {object} character - SkinnedMesh character.
 * @param {object} attackVolume - Authoritative attack volume.
 * @returns {{ coherent: boolean, distance: number, fistPos: { x: number, y: number, z: number }, centerPos: { x: number, y: number, z: number } }|null}
 */
export function sampleFistCoherence(character, attackVolume) {
  if (!character || !character.bonesByName?.hand_r || !attackVolume?.active || !attackVolume.center) {
    return null;
  }

  character.bonesByName.hand_r.getWorldPosition(_tempFistVec);

  const dx = _tempFistVec.x - attackVolume.center.x;
  const dy = _tempFistVec.y - attackVolume.center.y;
  const dz = _tempFistVec.z - attackVolume.center.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // During active strike, the hand bone must reside comfortably within the attack volume radius
  const coherent = distance <= attackVolume.radius;

  return {
    coherent,
    distance,
    fistPos: { x: _tempFistVec.x, y: _tempFistVec.y, z: _tempFistVec.z },
    centerPos: { ...attackVolume.center }
  };
}
