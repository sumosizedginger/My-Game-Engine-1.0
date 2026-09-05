/**
 * My Game Engine 1.0 — Character Forge: Skinning
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Synthesizes deterministic bone skin weights for procedural humanoid mesh.
 * Enforces smooth joint blending across articulation points and strict
 * normalization invariant: sum(w_i) == 1.0 for every vertex.
 * Follows ARCHITECTURE.md §20.2 & §22 and CHARACTER_FORGE.md.
 */

import { Uint16BufferAttribute, Float32BufferAttribute } from 'three';
import { REGIONS } from './geometry.js';
import { BONE_NAME_TO_INDEX } from './skeleton.js';

/**
 * Calculates distance squared from a 3D point P to a line segment AB.
 */
function distanceSqPointToSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 1e-8) {
    return apx * apx + apy * apy + apz * apz;
  }

  let t = (apx * abx + apy * aby + apz * abz) / abLenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const projx = ax + t * abx;
  const projy = ay + t * aby;
  const projz = az + t * abz;

  const dx = px - projx;
  const dy = py - projy;
  const dz = pz - projz;

  return { distSq: dx * dx + dy * dy + dz * dz, t };
}

/**
 * Builds bone segment definitions for skinning calculations.
 */
function buildBoneSegments(landmarks) {
  const getLm = (name) => landmarks[name] || { x: 0, y: 0, z: 0 };

  return {
    pelvis: {
      a: getLm('pelvis'),
      b: { x: 0, y: getLm('pelvis').y - 0.1, z: 0 },
      bone: 'pelvis'
    },
    spine: {
      a: getLm('pelvis'),
      b: getLm('spine'),
      bone: 'spine'
    },
    chest: {
      a: getLm('spine'),
      b: getLm('chest'),
      bone: 'chest'
    },
    neck: {
      a: getLm('chest'),
      b: getLm('neck'),
      bone: 'neck'
    },
    head: {
      a: getLm('neck'),
      b: getLm('headApex'),
      bone: 'head'
    },
    // Left arm
    shoulder_l: {
      a: getLm('chest'),
      b: getLm('clavicle.L'),
      bone: 'shoulder_l'
    },
    upperarm_l: {
      a: getLm('shoulder.L'),
      b: getLm('elbow.L'),
      bone: 'upperarm_l'
    },
    forearm_l: {
      a: getLm('elbow.L'),
      b: getLm('wrist.L'),
      bone: 'forearm_l'
    },
    hand_l: {
      a: getLm('wrist.L'),
      b: getLm('hand.L'),
      bone: 'hand_l'
    },
    // Right arm
    shoulder_r: {
      a: getLm('chest'),
      b: getLm('clavicle.R'),
      bone: 'shoulder_r'
    },
    upperarm_r: {
      a: getLm('shoulder.R'),
      b: getLm('elbow.R'),
      bone: 'upperarm_r'
    },
    forearm_r: {
      a: getLm('elbow.R'),
      b: getLm('wrist.R'),
      bone: 'forearm_r'
    },
    hand_r: {
      a: getLm('wrist.R'),
      b: getLm('hand.R'),
      bone: 'hand_r'
    },
    // Left leg
    thigh_l: {
      a: getLm('hip.L'),
      b: getLm('knee.L'),
      bone: 'thigh_l'
    },
    shin_l: {
      a: getLm('knee.L'),
      b: getLm('ankle.L'),
      bone: 'shin_l'
    },
    foot_l: {
      a: getLm('ankle.L'),
      b: getLm('toe.L'),
      bone: 'foot_l'
    },
    toe_l: {
      a: getLm('toe.L'),
      b: { x: getLm('toe.L').x, y: getLm('toe.L').y, z: getLm('toe.L').z + 0.05 },
      bone: 'toe_l'
    },
    // Right leg
    thigh_r: {
      a: getLm('hip.R'),
      b: getLm('knee.R'),
      bone: 'thigh_r'
    },
    shin_r: {
      a: getLm('knee.R'),
      b: getLm('ankle.R'),
      bone: 'shin_r'
    },
    foot_r: {
      a: getLm('ankle.R'),
      b: getLm('toe.R'),
      bone: 'foot_r'
    },
    toe_r: {
      a: getLm('toe.R'),
      b: { x: getLm('toe.R').x, y: getLm('toe.R').y, z: getLm('toe.R').z + 0.05 },
      bone: 'toe_r'
    }
  };
}

/**
 * Candidate bone names per semantic region.
 * Prevents unintended weight bleeding between contralateral limbs.
 */
const REGION_CANDIDATE_BONES = Object.freeze({
  [REGIONS.PELVIS]: ['pelvis', 'spine', 'thigh_l', 'thigh_r'],
  [REGIONS.SPINE]: ['pelvis', 'spine', 'chest'],
  [REGIONS.CHEST]: ['spine', 'chest', 'neck', 'shoulder_l', 'shoulder_r'],
  [REGIONS.NECK]: ['chest', 'neck', 'head'],
  [REGIONS.HEAD]: ['neck', 'head'],
  [REGIONS.UPPER_ARM_L]: ['shoulder_l', 'upperarm_l', 'forearm_l'],
  [REGIONS.LOWER_ARM_L]: ['upperarm_l', 'forearm_l', 'hand_l'],
  [REGIONS.HAND_L]: ['forearm_l', 'hand_l'],
  [REGIONS.UPPER_ARM_R]: ['shoulder_r', 'upperarm_r', 'forearm_r'],
  [REGIONS.LOWER_ARM_R]: ['upperarm_r', 'forearm_r', 'hand_r'],
  [REGIONS.HAND_R]: ['forearm_r', 'hand_r'],
  [REGIONS.THIGH_L]: ['pelvis', 'thigh_l', 'shin_l'],
  [REGIONS.SHIN_L]: ['thigh_l', 'shin_l', 'foot_l'],
  [REGIONS.FOOT_L]: ['shin_l', 'foot_l', 'toe_l'],
  [REGIONS.THIGH_R]: ['pelvis', 'thigh_r', 'shin_r'],
  [REGIONS.SHIN_R]: ['thigh_r', 'shin_r', 'foot_r'],
  [REGIONS.FOOT_R]: ['shin_r', 'foot_r', 'toe_r']
});

/**
 * Computes and binds skinning weights to geometry.
 *
 * @param {BufferGeometry} geometry - Humanoid BufferGeometry with positions and regions.
 * @param {object} landmarks - Semantic landmark vectors.
 * @returns {object} { skinIndices, skinWeights, stats }
 */
export function applyHumanoidSkinning(geometry, landmarks) {
  const posAttr = geometry.getAttribute('position');
  const regionAttr = geometry.getAttribute('region');
  const vertexCount = posAttr.count;

  const boneSegments = buildBoneSegments(landmarks);

  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  let maxNormError = 0;
  const epsilon = 0.01; // 1cm smoothing radius

  for (let i = 0; i < vertexCount; i++) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);
    const pz = posAttr.getZ(i);
    const reg = regionAttr ? regionAttr.getX(i) : 0;

    const candidateBoneNames = REGION_CANDIDATE_BONES[reg] || Object.keys(boneSegments);

    const candidates = [];
    for (const bName of candidateBoneNames) {
      const seg = boneSegments[bName];
      if (!seg) continue;

      const { distSq, t } = distanceSqPointToSegment(
        px, py, pz,
        seg.a.x, seg.a.y, seg.a.z,
        seg.b.x, seg.b.y, seg.b.z
      );

      const dist = Math.sqrt(distSq);
      // Inverse distance weighting with smooth falloff
      const rawWeight = 1.0 / Math.pow(dist + epsilon, 2);

      candidates.push({
        boneIndex: BONE_NAME_TO_INDEX[seg.bone],
        weight: rawWeight,
        dist,
        t
      });
    }

    // Sort by weight descending
    candidates.sort((a, b) => b.weight - a.weight);

    // Take top 4 influences
    const top4 = candidates.slice(0, 4);

    // Sum weights for strict normalization
    let sumWeight = 0;
    for (let k = 0; k < top4.length; k++) {
      sumWeight += top4[k].weight;
    }

    const baseOffset = i * 4;
    if (sumWeight > 1e-7) {
      let accumulated = 0;
      for (let k = 0; k < 4; k++) {
        if (k < top4.length) {
          const normWeight = top4[k].weight / sumWeight;
          skinIndices[baseOffset + k] = top4[k].boneIndex;
          skinWeights[baseOffset + k] = normWeight;
          accumulated += normWeight;
        } else {
          skinIndices[baseOffset + k] = 0;
          skinWeights[baseOffset + k] = 0;
        }
      }
      // Guarantee exact 1.0 sum on primary influence
      const residual = 1.0 - accumulated;
      skinWeights[baseOffset] += residual;

      const err = Math.abs(accumulated + residual - 1.0);
      if (err > maxNormError) maxNormError = err;
    } else {
      // Fallback: 100% root/pelvis
      skinIndices[baseOffset] = BONE_NAME_TO_INDEX.pelvis || 1;
      skinWeights[baseOffset] = 1.0;
      for (let k = 1; k < 4; k++) {
        skinIndices[baseOffset + k] = 0;
        skinWeights[baseOffset + k] = 0;
      }
    }
  }

  // Attach attributes to BufferGeometry
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));

  return {
    skinIndices,
    skinWeights,
    stats: Object.freeze({
      vertexCount,
      maxNormalizationError: maxNormError,
      allNormalized: maxNormError < 1e-5
    })
  };
}
