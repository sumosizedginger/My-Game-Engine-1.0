/**
 * My Game Engine 1.0 — Material Forge: Public API
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Public entry point for procedural material synthesis and compilation.
 * Follows ARCHITECTURE.md §24 and MATERIAL_FORGE.md.
 */

export {
  MATERIAL_PARAMETER_BOUNDS,
  normalizeColor,
  resolveMaterialParameters,
  createMaterialDefinition
} from './definition.js';

export {
  MATERIAL_PRESETS
} from './palettes.js';

export {
  compileMaterial
} from './compiler.js';
