/**
 * My Game Engine 1.0 — Character Forge: Semantic Landmarks
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Computes deterministic 3D semantic landmark anchors in character space.
 * Landmarks provide stable definition-space points for skeleton generation,
 * limb targeting, and skinning without brittle vertex index dependencies.
 * Follows ARCHITECTURE.md §20.2 & §22 and CHARACTER_FORGE.md.
 */

/**
 * Computes semantic landmarks from resolved humanoid parameters.
 *
 * @param {object} params - Resolved humanoid parameters.
 * @returns {object} Dictionary of landmark vectors { x, y, z }.
 */
export function computeSemanticLandmarks(params) {
  const H = params.height;

  // Vertical layout proportions
  const footH = 0.05 * H;
  const legL = params.legLength;
  const hipY = footH + legL * 0.95;
  const waistY = hipY + (H - hipY) * 0.22;
  const chestY = hipY + (H - hipY) * 0.52;
  const shoulderY = hipY + (H - hipY) * 0.72;
  const neckBaseY = shoulderY + 0.02;
  const headScale = params.headScale || 1.0;
  const headHeight = 0.13 * H * headScale;
  const headApexY = H;
  const headCenterY = H - headHeight * 0.50;
  const neckTopY = H - headHeight * 0.75;

  // Lateral extents
  const shoulderHalf = params.shoulderWidth * 0.5;
  const hipHalf = params.pelvisWidth * 0.55;

  // Arm proportions (clavicle, upper arm, forearm, hand)
  const armL = params.armLength;
  const upperArmL = armL * 0.45;
  const forearmL = armL * 0.40;
  const handL = armL * 0.15;

  // Leg proportions (thigh, shin, foot)
  const thighL = (hipY - footH) * 0.53;
  const shinL = (hipY - footH) * 0.47;
  const footLength = 0.14 * H;

  const landmarks = {
    // 1. Axial spine chain
    root: Object.freeze({ x: 0, y: 0, z: 0 }),
    pelvis: Object.freeze({ x: 0, y: hipY, z: 0 }),
    spine: Object.freeze({ x: 0, y: waistY, z: -0.005 }),
    chest: Object.freeze({ x: 0, y: chestY, z: 0.005 }),
    neck: Object.freeze({ x: 0, y: neckBaseY, z: 0 }),
    head: Object.freeze({ x: 0, y: headCenterY, z: 0.01 }),
    headApex: Object.freeze({ x: 0, y: headApexY, z: 0 }),

    // 2. Left Upper Limb
    'clavicle.L': Object.freeze({ x: shoulderHalf * 0.35, y: shoulderY - 0.01, z: 0.01 }),
    'shoulder.L': Object.freeze({ x: shoulderHalf, y: shoulderY, z: 0 }),
    'elbow.L': Object.freeze({ x: shoulderHalf + 0.03, y: shoulderY - upperArmL, z: -0.015 }),
    'wrist.L': Object.freeze({ x: shoulderHalf + 0.035, y: shoulderY - upperArmL - forearmL, z: 0 }),
    'hand.L': Object.freeze({ x: shoulderHalf + 0.04, y: shoulderY - upperArmL - forearmL - handL, z: 0 }),

    // 3. Right Upper Limb (mirrored X)
    'clavicle.R': Object.freeze({ x: -shoulderHalf * 0.35, y: shoulderY - 0.01, z: 0.01 }),
    'shoulder.R': Object.freeze({ x: -shoulderHalf, y: shoulderY, z: 0 }),
    'elbow.R': Object.freeze({ x: -(shoulderHalf + 0.03), y: shoulderY - upperArmL, z: -0.015 }),
    'wrist.R': Object.freeze({ x: -(shoulderHalf + 0.035), y: shoulderY - upperArmL - forearmL, z: 0 }),
    'hand.R': Object.freeze({ x: -(shoulderHalf + 0.04), y: shoulderY - upperArmL - forearmL - handL, z: 0 }),

    // 4. Left Lower Limb
    'hip.L': Object.freeze({ x: hipHalf, y: hipY, z: 0 }),
    'knee.L': Object.freeze({ x: hipHalf, y: hipY - thighL, z: 0.012 }), // slight forward knee angle
    'ankle.L': Object.freeze({ x: hipHalf, y: footH, z: 0 }),
    'heel.L': Object.freeze({ x: hipHalf, y: 0, z: -footLength * 0.30 }),
    'toe.L': Object.freeze({ x: hipHalf, y: 0, z: footLength * 0.70 }),

    // 5. Right Lower Limb (mirrored X)
    'hip.R': Object.freeze({ x: -hipHalf, y: hipY, z: 0 }),
    'knee.R': Object.freeze({ x: -hipHalf, y: hipY - thighL, z: 0.012 }),
    'ankle.R': Object.freeze({ x: -hipHalf, y: footH, z: 0 }),
    'heel.R': Object.freeze({ x: -hipHalf, y: 0, z: -footLength * 0.30 }),
    'toe.R': Object.freeze({ x: -hipHalf, y: 0, z: footLength * 0.70 })
  };

  return Object.freeze(landmarks);
}
