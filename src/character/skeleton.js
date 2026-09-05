/**
 * My Game Engine 1.0 — Character Forge: Skeleton
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Constructs the canonical humanoid skeletal hierarchy aligned with semantic landmarks.
 * Computes deterministic rest-pose local offsets, hierarchy links, and bind matrices.
 * Follows ARCHITECTURE.md §20.2 & §22 and CHARACTER_FORGE.md.
 */

import { Bone, Skeleton, Matrix4 } from 'three';

/**
 * Canonical humanoid bone definitions.
 * Ordered such that every parent precedes its children.
 */
export const BONE_DEFINITIONS = Object.freeze([
  { index: 0, name: 'root', parent: null, landmark: 'root' },
  { index: 1, name: 'pelvis', parent: 'root', landmark: 'pelvis' },
  { index: 2, name: 'spine', parent: 'pelvis', landmark: 'spine' },
  { index: 3, name: 'chest', parent: 'spine', landmark: 'chest' },
  { index: 4, name: 'neck', parent: 'chest', landmark: 'neck' },
  { index: 5, name: 'head', parent: 'neck', landmark: 'head' },

  // Left Arm
  { index: 6, name: 'shoulder_l', parent: 'chest', landmark: 'clavicle.L' },
  { index: 7, name: 'upperarm_l', parent: 'shoulder_l', landmark: 'shoulder.L' },
  { index: 8, name: 'forearm_l', parent: 'upperarm_l', landmark: 'elbow.L' },
  { index: 9, name: 'hand_l', parent: 'forearm_l', landmark: 'wrist.L' },

  // Right Arm
  { index: 10, name: 'shoulder_r', parent: 'chest', landmark: 'clavicle.R' },
  { index: 11, name: 'upperarm_r', parent: 'shoulder_r', landmark: 'shoulder.R' },
  { index: 12, name: 'forearm_r', parent: 'upperarm_r', landmark: 'elbow.R' },
  { index: 13, name: 'hand_r', parent: 'forearm_r', landmark: 'wrist.R' },

  // Left Leg
  { index: 14, name: 'thigh_l', parent: 'pelvis', landmark: 'hip.L' },
  { index: 15, name: 'shin_l', parent: 'thigh_l', landmark: 'knee.L' },
  { index: 16, name: 'foot_l', parent: 'shin_l', landmark: 'ankle.L' },
  { index: 17, name: 'toe_l', parent: 'foot_l', landmark: 'toe.L' },

  // Right Leg
  { index: 18, name: 'thigh_r', parent: 'pelvis', landmark: 'hip.R' },
  { index: 19, name: 'shin_r', parent: 'thigh_r', landmark: 'knee.R' },
  { index: 20, name: 'foot_r', parent: 'shin_r', landmark: 'ankle.R' },
  { index: 21, name: 'toe_r', parent: 'foot_r', landmark: 'toe.R' }
]);

export const BONE_NAME_TO_INDEX = Object.freeze(
  Object.fromEntries(BONE_DEFINITIONS.map(d => [d.name, d.index]))
);

/**
 * Creates a deterministic humanoid skeleton from semantic landmarks.
 *
 * @param {object} landmarks - Semantic landmark dictionary { x, y, z }.
 * @returns {object} { skeleton, rootBone, bonesByName, bones, bonesData }
 */
export function createHumanoidSkeleton(landmarks) {
  const bones = [];
  const bonesByName = {};
  const bonesData = [];

  for (const def of BONE_DEFINITIONS) {
    const bone = new Bone();
    bone.name = def.name;

    const lm = landmarks[def.landmark];
    if (!lm) {
      throw new Error(`Missing landmark "${def.landmark}" for bone "${def.name}"`);
    }

    let parentBone = null;
    let localX = lm.x;
    let localY = lm.y;
    let localZ = lm.z;

    if (def.parent) {
      parentBone = bonesByName[def.parent];
      if (!parentBone) {
        throw new Error(`Parent bone "${def.parent}" not created yet for "${def.name}"`);
      }
      const parentDef = BONE_DEFINITIONS.find(d => d.name === def.parent);
      const parentLm = landmarks[parentDef.landmark];
      localX = lm.x - parentLm.x;
      localY = lm.y - parentLm.y;
      localZ = lm.z - parentLm.z;
      parentBone.add(bone);
    }

    bone.position.set(localX, localY, localZ);

    bones.push(bone);
    bonesByName[def.name] = bone;

    bonesData.push(Object.freeze({
      index: def.index,
      name: def.name,
      parent: def.parent,
      parentIndex: def.parent ? BONE_NAME_TO_INDEX[def.parent] : null,
      landmark: def.landmark,
      restWorldPosition: Object.freeze({ x: lm.x, y: lm.y, z: lm.z }),
      restLocalPosition: Object.freeze({ x: localX, y: localY, z: localZ })
    }));
  }

  const rootBone = bonesByName.root;
  rootBone.updateWorldMatrix(true, true);

  const skeleton = new Skeleton(bones);
  skeleton.calculateInverses();

  return {
    skeleton,
    rootBone,
    bonesByName,
    bones,
    bonesData: Object.freeze(bonesData)
  };
}
