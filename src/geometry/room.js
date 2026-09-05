/**
 * My Game Engine 1.0 — Geometry Forge: Procedural Room Generator
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Generates an enclosed combat arena from a RoomDefinition, producing:
 * 1. Semantic visual BufferGeometry (floor, perimeter walls, pillars).
 * 2. Authoritative gameplay collision representation derived from the EXACT same definition.
 * Follows ARCHITECTURE.md §20.1 & §21 and GEOMETRY_FORGE.md.
 */

import { buildBoxGeometry, buildCylinderGeometry, mergeSemanticGeometries } from './primitives.js';
import { SURFACE_TYPES, CONSTRAINT_FLAGS, GEOMETRY_REGIONS } from './semantics.js';
import { createRoomDefinition } from './definition.js';

/**
 * Generates a complete procedural combat room artifact.
 *
 * @param {object|string} [roomInput='combat_arena'] - RoomDefinition or preset name.
 * @returns {object} { definition, visual, collision, semantics, stats }
 */
export function generateProceduralRoom(roomInput = 'combat_arena') {
  const definition = (roomInput && roomInput.type === 'geometry_room')
    ? roomInput
    : createRoomDefinition(typeof roomInput === 'string' ? { preset: roomInput } : roomInput);

  const { width, depth, wallHeight, wallThickness, floorThickness, pillars } = definition.data.parameters;

  // -------------------------------------------------------------
  // 1. VISUAL GEOMETRY GENERATION
  // -------------------------------------------------------------
  const parts = [];

  // Floor slab: top surface sits precisely at Y = 0.000m
  const floorGeom = buildBoxGeometry({
    width,
    height: floorThickness,
    depth,
    origin: { x: 0, y: -floorThickness / 2, z: 0 },
    regionId: GEOMETRY_REGIONS.ARENA_FLOOR,
    surfaceId: SURFACE_TYPES.FLOOR
  });
  parts.push(floorGeom);

  // Perimeter Walls (enclosing 4 boundary walls)
  // North Wall (+Z)
  const northWallGeom = buildBoxGeometry({
    width,
    height: wallHeight,
    depth: wallThickness,
    origin: { x: 0, y: wallHeight / 2, z: depth / 2 - wallThickness / 2 },
    regionId: GEOMETRY_REGIONS.ARENA_WALL_NORTH,
    surfaceId: SURFACE_TYPES.WALL
  });
  parts.push(northWallGeom);

  // South Wall (-Z)
  const southWallGeom = buildBoxGeometry({
    width,
    height: wallHeight,
    depth: wallThickness,
    origin: { x: 0, y: wallHeight / 2, z: -depth / 2 + wallThickness / 2 },
    regionId: GEOMETRY_REGIONS.ARENA_WALL_SOUTH,
    surfaceId: SURFACE_TYPES.WALL
  });
  parts.push(southWallGeom);

  // East Wall (+X, spans between north and south walls)
  const innerDepth = depth - 2 * wallThickness;
  const eastWallGeom = buildBoxGeometry({
    width: wallThickness,
    height: wallHeight,
    depth: innerDepth,
    origin: { x: width / 2 - wallThickness / 2, y: wallHeight / 2, z: 0 },
    regionId: GEOMETRY_REGIONS.ARENA_WALL_EAST,
    surfaceId: SURFACE_TYPES.WALL
  });
  parts.push(eastWallGeom);

  // West Wall (-X, spans between north and south walls)
  const westWallGeom = buildBoxGeometry({
    width: wallThickness,
    height: wallHeight,
    depth: innerDepth,
    origin: { x: -width / 2 + wallThickness / 2, y: wallHeight / 2, z: 0 },
    regionId: GEOMETRY_REGIONS.ARENA_WALL_WEST,
    surfaceId: SURFACE_TYPES.WALL
  });
  parts.push(westWallGeom);

  // Pillars (interior cylindrical stone obstacles)
  const pillarGeometries = [];
  pillars.forEach((p, idx) => {
    const pGeom = buildCylinderGeometry({
      radiusTop: p.radius,
      radiusBottom: p.radius,
      height: p.height,
      radialSegments: 20,
      origin: { x: p.x, y: 0, z: p.z },
      regionId: idx === 0 ? GEOMETRY_REGIONS.ARENA_PILLAR_1 : GEOMETRY_REGIONS.ARENA_PILLAR_2,
      surfaceId: SURFACE_TYPES.PILLAR
    });
    parts.push(pGeom);
    pillarGeometries.push({ id: p.id, geometry: pGeom });
  });

  // Master merged geometry with semantic attributes preserved
  const mergedGeometry = mergeSemanticGeometries(parts);

  // -------------------------------------------------------------
  // 2. GAMEPLAY COLLISION REPRESENTATION (Derived from SAME definition)
  // -------------------------------------------------------------
  const innerBounds = {
    minX: -width / 2 + wallThickness,
    maxX: width / 2 - wallThickness,
    minZ: -depth / 2 + wallThickness,
    maxZ: depth / 2 - wallThickness
  };

  const collisionPillars = pillars.map((p) => ({
    id: p.id,
    x: p.x,
    z: p.z,
    radius: p.radius,
    height: p.height
  }));

  /**
   * Resolves a circle against arena boundary walls and obstacles.
   *
   * @param {number} x - Candidate X position.
   * @param {number} z - Candidate Z position.
   * @param {number} [radius=0.4] - Entity collision radius.
   * @returns {{ x: number, z: number, collided: boolean }}
   */
  function resolvePosition(x, z, radius = 0.4) {
    let resolvedX = x;
    let resolvedZ = z;
    let collided = false;

    // 1. Enclosing wall clamping
    const minX = innerBounds.minX + radius;
    const maxX = innerBounds.maxX - radius;
    const minZ = innerBounds.minZ + radius;
    const maxZ = innerBounds.maxZ - radius;

    if (resolvedX < minX) { resolvedX = minX; collided = true; }
    if (resolvedX > maxX) { resolvedX = maxX; collided = true; }
    if (resolvedZ < minZ) { resolvedZ = minZ; collided = true; }
    if (resolvedZ > maxZ) { resolvedZ = maxZ; collided = true; }

    // 2. Pillar circle-to-circle collision pushback
    for (const pillar of collisionPillars) {
      const dx = resolvedX - pillar.x;
      const dz = resolvedZ - pillar.z;
      const distSq = dx * dx + dz * dz;
      const minDist = pillar.radius + radius;

      if (distSq < minDist * minDist) {
        collided = true;
        const dist = Math.sqrt(distSq);
        const nx = dist > 1e-4 ? dx / dist : 1.0;
        const nz = dist > 1e-4 ? dz / dist : 0.0;
        resolvedX = pillar.x + nx * minDist;
        resolvedZ = pillar.z + nz * minDist;
      }
    }

    return { x: resolvedX, z: resolvedZ, collided };
  }

  function isWalkable(x, z, radius = 0.4) {
    if (x < innerBounds.minX + radius || x > innerBounds.maxX - radius) return false;
    if (z < innerBounds.minZ + radius || z > innerBounds.maxZ - radius) return false;

    for (const pillar of collisionPillars) {
      const dx = x - pillar.x;
      const dz = z - pillar.z;
      const minDist = pillar.radius + radius;
      if (dx * dx + dz * dz < minDist * minDist) return false;
    }
    return true;
  }

  const stats = {
    vertexCount: mergedGeometry.getAttribute('position').count,
    triangleCount: mergedGeometry.getIndex().count / 3,
    partCount: parts.length,
    pillarCount: collisionPillars.length,
    arenaArea: (innerBounds.maxX - innerBounds.minX) * (innerBounds.maxZ - innerBounds.minZ)
  };

  return {
    definition,
    visual: {
      geometry: mergedGeometry,
      parts: {
        floor: floorGeom,
        northWall: northWallGeom,
        southWall: southWallGeom,
        eastWall: eastWallGeom,
        westWall: westWallGeom,
        pillars: pillarGeometries
      }
    },
    collision: {
      innerBounds,
      pillars: collisionPillars,
      resolvePosition,
      isWalkable,
      getFloorY: () => 0.000
    },
    semantics: {
      surfaces: SURFACE_TYPES,
      constraints: CONSTRAINT_FLAGS,
      regions: GEOMETRY_REGIONS
    },
    stats
  };
}
