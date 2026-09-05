/**
 * My Game Engine 1.0 — Material Forge: Three.js Compiler Seam
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Compiles declarative, serializable MaterialDefinitions into Three.js materials.
 * Preserves strict separation: definitions are source; Three.js materials are runtime products.
 * Follows ARCHITECTURE.md §24 and MATERIAL_FORGE.md.
 */

import { MeshStandardMaterial, Color } from 'three';
import { createMaterialDefinition } from './definition.js';

/**
 * Compiles a MaterialDefinition into a Three.js MeshStandardMaterial.
 *
 * @param {object} materialInput - MaterialDefinition or raw options.
 * @returns {MeshStandardMaterial}
 */
export function compileMaterial(materialInput) {
  let definition = materialInput;
  if (!definition || definition.type !== 'material' || !definition.data) {
    definition = createMaterialDefinition(materialInput || {});
  }

  const { parameters } = definition.data;

  const material = new MeshStandardMaterial({
    color: new Color(parameters.color),
    roughness: parameters.roughness,
    metalness: parameters.metalness,
    emissive: new Color(parameters.emissive),
    emissiveIntensity: parameters.emissiveIntensity,
    wireframe: parameters.wireframe
  });

  material.name = definition.id;
  material.userData = {
    definitionId: definition.id,
    definitionType: definition.type,
    parameters: { ...parameters }
  };

  return material;
}
