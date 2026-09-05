/**
 * My Game Engine 1.0 — Geometry Forge: Semantics
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Defines machine-readable semantic surface types, region identifiers,
 * and constraint flags for procedural geometry.
 * Follows ARCHITECTURE.md §20.1 & §21 and GEOMETRY_FORGE.md.
 */

export const SURFACE_TYPES = Object.freeze({
  FLOOR: 1,
  WALL: 2,
  PILLAR: 3,
  OBSTACLE: 4,
  CEILING: 5
});

export const SURFACE_NAMES = Object.freeze({
  [SURFACE_TYPES.FLOOR]: 'floor',
  [SURFACE_TYPES.WALL]: 'wall',
  [SURFACE_TYPES.PILLAR]: 'pillar',
  [SURFACE_TYPES.OBSTACLE]: 'obstacle',
  [SURFACE_TYPES.CEILING]: 'ceiling'
});

export const CONSTRAINT_FLAGS = Object.freeze({
  NONE: 0,
  WALKABLE: 1 << 0,     // Surface can be walked on (e.g. floor)
  SOLID: 1 << 1,        // Impassable physical barrier
  PERIMETER: 1 << 2,    // Enclosing room boundary
  CLIMBABLE: 1 << 3,
  DESTRUCTIBLE: 1 << 4
});

export const GEOMETRY_REGIONS = Object.freeze({
  ARENA_FLOOR: 10,
  ARENA_WALL_NORTH: 20,
  ARENA_WALL_SOUTH: 21,
  ARENA_WALL_EAST: 22,
  ARENA_WALL_WEST: 23,
  ARENA_PILLAR_1: 30,
  ARENA_PILLAR_2: 31,
  ARENA_FEATURE: 40
});
