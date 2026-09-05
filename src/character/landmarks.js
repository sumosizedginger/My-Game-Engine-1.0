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

  // Leg proportions (thigh, shin, foot)
  const thighL = legL * 0.525;
  const shinL = legL * 0.495;
  const hipY = footH + legL * 0.98;
  const headScale = params.headScale || 1.0;
  const headHeight = 0.13 * H * headScale;
  const headApexY = H;
  const headCenterY = H - headHeight * 0.50;

  // Torso vertical space between pelvic girdle and jaw
  const torsoH = Math.max(0.30, (H - headHeight) - hipY);
  const waistY = hipY + torsoH * 0.28;
  const chestY = hipY + torsoH * 0.58;
  const shoulderY = hipY + torsoH * 0.77;
  const neckBaseY = hipY + torsoH * 0.89;

  // Lateral extents
  const shoulderHalf = params.shoulderWidth * 0.5;
  const hipHalf = params.pelvisWidth * 0.65;

  // Arm proportions (clavicle, upper arm, forearm, hand)
  const armL = params.armLength;
  const upperArmL = armL * 0.45;
  const forearmL = armL * 0.40;
  const handL = armL * 0.15;
  const footLength = 0.14 * H;

  // Natural upright standing knee with subtle anatomical 1.2cm forward micro-bend
  const kneeY = hipY - thighL;
  const kneeZ = 0.012;

  const landmarks = {
    // 1. Axial spine chain (anatomical S-curve: sacral kyphosis -> lumbar lordosis -> thoracic kyphosis -> cervical lordosis)
    root: Object.freeze({ x: 0, y: 0, z: 0 }),
    pelvis: Object.freeze({ x: 0, y: hipY, z: -0.020 }),
    spine: Object.freeze({ x: 0, y: waistY, z: 0.008 }),
    chest: Object.freeze({ x: 0, y: chestY, z: 0.010 }),
    neck: Object.freeze({ x: 0, y: neckBaseY, z: -0.010 }),
    head: Object.freeze({ x: 0, y: headCenterY, z: 0.005 }),
    headApex: Object.freeze({ x: 0, y: headApexY, z: -0.010 }),

    // 2. Left Upper Limb (shoulder joint nested within acromial width)
    'clavicle.L': Object.freeze({ x: shoulderHalf * 0.35, y: neckBaseY - 0.015, z: 0.005 }),
    'shoulder.L': Object.freeze({ x: shoulderHalf * 0.86, y: shoulderY, z: 0.002 }),
    'elbow.L': Object.freeze({ x: shoulderHalf * 0.82, y: shoulderY - upperArmL, z: -0.015 }),
    'wrist.L': Object.freeze({ x: shoulderHalf * 0.78, y: shoulderY - upperArmL - forearmL, z: 0 }),
    'hand.L': Object.freeze({ x: shoulderHalf * 0.76, y: shoulderY - upperArmL - forearmL - handL, z: 0 }),

    // 3. Right Upper Limb (mirrored X)
    'clavicle.R': Object.freeze({ x: -shoulderHalf * 0.35, y: neckBaseY - 0.015, z: 0.005 }),
    'shoulder.R': Object.freeze({ x: -shoulderHalf * 0.86, y: shoulderY, z: 0.002 }),
    'elbow.R': Object.freeze({ x: -(shoulderHalf * 0.82), y: shoulderY - upperArmL, z: -0.015 }),
    'wrist.R': Object.freeze({ x: -(shoulderHalf * 0.78), y: shoulderY - upperArmL - forearmL, z: 0 }),
    'hand.R': Object.freeze({ x: -(shoulderHalf * 0.76), y: shoulderY - upperArmL - forearmL - handL, z: 0 }),

    // 4. Left Lower Limb
    'hip.L': Object.freeze({ x: hipHalf, y: hipY, z: -0.015 }),
    'knee.L': Object.freeze({ x: hipHalf, y: kneeY, z: kneeZ }),
    'ankle.L': Object.freeze({ x: hipHalf, y: footH, z: 0 }),
    'heel.L': Object.freeze({ x: hipHalf, y: 0, z: -footLength * 0.30 }),
    'toe.L': Object.freeze({ x: hipHalf, y: 0, z: footLength * 0.70 }),

    // 5. Right Lower Limb (mirrored X)
    'hip.R': Object.freeze({ x: -hipHalf, y: hipY, z: -0.015 }),
    'knee.R': Object.freeze({ x: -hipHalf, y: kneeY, z: kneeZ }),
    'ankle.R': Object.freeze({ x: -hipHalf, y: footH, z: 0 }),
    'heel.R': Object.freeze({ x: -hipHalf, y: 0, z: -footLength * 0.30 }),
    'toe.R': Object.freeze({ x: -hipHalf, y: 0, z: footLength * 0.70 })
  };

  return Object.freeze(landmarks);
}
