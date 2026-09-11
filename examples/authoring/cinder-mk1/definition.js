/**
 * CINDER MK-I — Definition
 *
 * A fictional hard-surface hero weapon, authored entirely through My Game
 * Engine 1.0's public authoring surface. No DCC, no imported mesh, no
 * pre-generated geometry.
 *
 * CINDER is a forcing consumer for AI-ASSET-FOUNDATION-001, not engine content
 * and not a new Proof. It lives outside src/ deliberately: it exercises the
 * public package export exactly as an external consumer would.
 *
 * Conventions: metres, +Y up, -Z forward. The muzzle points toward -Z.
 */

import { createMaterialDefinition } from '@sumosizedginger/my-game-engine-1.0/full';

/**
 * Geometric parameters. Every dimension is metres.
 * Kept as data so an authoring agent can revise numbers rather than code.
 */
export const CINDER_PARAMETERS = Object.freeze({
  receiver: Object.freeze({ length: 0.30, width: 0.056, height: 0.092, rearZ: 0.25 }),
  barrel: Object.freeze({ length: 0.37, radius: 0.0115, segments: 24 }),
  muzzleBrake: Object.freeze({ length: 0.052, radius: 0.017, segments: 24 }),
  handguard: Object.freeze({ length: 0.28, width: 0.062, height: 0.068 }),
  stock: Object.freeze({ length: 0.27, width: 0.048, height: 0.086 }),
  grip: Object.freeze({ length: 0.115, width: 0.034, depth: 0.046, rakeDeg: 17 }),
  magazine: Object.freeze({ length: 0.155, width: 0.026, depth: 0.072, rakeDeg: 8 }),
  optic: Object.freeze({ bodyLength: 0.092, bodyWidth: 0.036, bodyHeight: 0.026, tubeRadius: 0.019, tubeSegments: 24 }),
  rail: Object.freeze({ teeth: 6, toothLength: 0.011, gap: 0.0075, width: 0.021, height: 0.005 }),
  chargingHandle: Object.freeze({ length: 0.064, width: 0.013, height: 0.012 })
});

/**
 * Four material families, matching the work order's observation that a strong
 * hard-surface asset needs few material families rather than many.
 *
 * Authored through Material Forge. CINDER does not construct renderer
 * materials itself.
 *
 * @returns {Array<object>} MaterialDefinitions.
 */
export function createCinderMaterials() {
  return [
    createMaterialDefinition({
      id: 'cinder.steel',
      name: 'CINDER gunmetal',
      parameters: { color: 0x4a4f57, roughness: 0.34, metalness: 0.92 }
    }),
    createMaterialDefinition({
      id: 'cinder.polymer',
      name: 'CINDER polymer',
      parameters: { color: 0x23262b, roughness: 0.78, metalness: 0.04 }
    }),
    createMaterialDefinition({
      id: 'cinder.grip',
      name: 'CINDER grip rubber',
      parameters: { color: 0x16181c, roughness: 0.94, metalness: 0.02 }
    }),
    createMaterialDefinition({
      id: 'cinder.optic',
      name: 'CINDER optic glass',
      parameters: { color: 0x2c4a5e, roughness: 0.16, metalness: 0.55, emissive: 0x0d2733, emissiveIntensity: 0.6 }
    })
  ];
}

/**
 * Rounded rectangular profile in the XY plane, counter-clockwise.
 *
 * Corners are chamfered rather than filleted: with no bevel operation
 * available in this tranche, chamfer corners are generated directly into the
 * profile, which is correct rather than approximated.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} chamfer
 * @returns {Array<number[]>} Convex profile.
 */
export function chamferedRectProfile(width, height, chamfer) {
  const hw = width / 2;
  const hh = height / 2;
  const c = Math.min(chamfer, hw * 0.9, hh * 0.9);
  return [
    [-hw + c, -hh], [hw - c, -hh],
    [hw, -hh + c], [hw, hh - c],
    [hw - c, hh], [-hw + c, hh],
    [-hw, hh - c], [-hw, -hh + c]
  ];
}

/**
 * Trapezoidal profile, used for the magazine and stock where the silhouette
 * should taper.
 *
 * @param {number} topWidth
 * @param {number} bottomWidth
 * @param {number} height
 * @returns {Array<number[]>} Convex profile.
 */
export function taperedProfile(topWidth, bottomWidth, height) {
  const ht = topWidth / 2;
  const hb = bottomWidth / 2;
  const hh = height / 2;
  return [[-hb, -hh], [hb, -hh], [ht, hh], [-ht, hh]];
}
