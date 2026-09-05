/**
 * My Game Engine 1.0 — Geometry Forge: Public API
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Public entry point for procedural geometry synthesis and room generation.
 * Follows ARCHITECTURE.md §20 & §21 and GEOMETRY_FORGE.md.
 */

export {
  SURFACE_TYPES,
  SURFACE_NAMES,
  CONSTRAINT_FLAGS,
  GEOMETRY_REGIONS
} from './semantics.js';

export {
  ROOM_PARAMETER_BOUNDS,
  PILLAR_PARAMETER_BOUNDS,
  ROOM_PRESETS,
  resolveRoomParameters,
  createRoomDefinition
} from './definition.js';

export {
  buildBoxGeometry,
  buildCylinderGeometry,
  mergeSemanticGeometries
} from './primitives.js';

export {
  generateProceduralRoom
} from './room.js';
