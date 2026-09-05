/**
 * My Game Engine 1.0 — Character Forge: Public API
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Unified barrel export and high-level procedural character builder.
 * Follows ARCHITECTURE.md §20.2 & §22 and CHARACTER_FORGE.md.
 */

import { SkinnedMesh, MeshStandardMaterial } from 'three';
import {
  HUMANOID_PARAMETER_BOUNDS,
  HUMANOID_PRESETS,
  resolveHumanoidParameters,
  createCharacterDefinition
} from './definition.js';
import { computeSemanticLandmarks } from './landmarks.js';
import { REGIONS, createHumanoidGeometry } from './geometry.js';
import {
  BONE_DEFINITIONS,
  BONE_NAME_TO_INDEX,
  createHumanoidSkeleton
} from './skeleton.js';
import { applyHumanoidSkinning } from './skinning.js';

export {
  HUMANOID_PARAMETER_BOUNDS,
  HUMANOID_PRESETS,
  resolveHumanoidParameters,
  createCharacterDefinition,
  computeSemanticLandmarks,
  REGIONS,
  createHumanoidGeometry,
  BONE_DEFINITIONS,
  BONE_NAME_TO_INDEX,
  createHumanoidSkeleton,
  applyHumanoidSkinning
};

/**
 * Builds a complete, skinned humanoid character from a preset or custom parameters.
 *
 * @param {object|string} [input='average'] - Preset string or character definition options.
 * @param {object} [materialOptions={}] - Optional Three.js material options.
 * @returns {object} Assembled character object with mesh, skeleton, geometry, landmarks.
 */
export function buildHumanoidCharacter(input = 'average', materialOptions = {}) {
  let definition;
  if (input && input.type === 'character' && input.data) {
    definition = input;
  } else {
    definition = createCharacterDefinition({ parameters: input });
  }

  const { parameters, diagnostics } = resolveHumanoidParameters(definition.data.parameters);
  const landmarks = computeSemanticLandmarks(parameters);
  const { geometry, rawData } = createHumanoidGeometry(parameters, landmarks);
  const { skeleton, rootBone, bonesByName, bones, bonesData } = createHumanoidSkeleton(landmarks);
  const skinningResult = applyHumanoidSkinning(geometry, landmarks);

  // Build standard shaded material (soft studio clay aesthetic)
  const material = new MeshStandardMaterial({
    color: materialOptions.color || 0xd8c8b8,
    roughness: materialOptions.roughness !== undefined ? materialOptions.roughness : 0.65,
    metalness: materialOptions.metalness !== undefined ? materialOptions.metalness : 0.05,
    wireframe: materialOptions.wireframe || false
  });

  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = 'HumanoidSkinnedMesh';
  mesh.add(rootBone);
  mesh.bind(skeleton);

  return {
    id: definition.id,
    definition,
    parameters,
    landmarks,
    geometry,
    geometryData: rawData,
    skeleton,
    rootBone,
    bonesByName,
    bones,
    bonesData,
    skinning: skinningResult,
    mesh,
    material,
    diagnostics
  };
}
