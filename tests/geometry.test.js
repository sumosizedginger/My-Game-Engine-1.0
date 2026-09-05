/**
 * My Game Engine 1.0 — Geometry Forge Unit Tests
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoomDefinition,
  resolveRoomParameters,
  buildBoxGeometry,
  buildCylinderGeometry,
  generateProceduralRoom,
  SURFACE_TYPES,
  SURFACE_NAMES,
  CONSTRAINT_FLAGS,
  GEOMETRY_REGIONS,
  ROOM_PARAMETER_BOUNDS,
  PILLAR_PARAMETER_BOUNDS
} from '../src/geometry/index.js';

test('Geometry Forge — Room Definition & Parameters', async (t) => {
  await t.test('resolves standard combat_arena preset with bounded dimensions', () => {
    const def = createRoomDefinition({ preset: 'combat_arena' });

    assert.equal(def.type, 'geometry_room');
    assert.equal(def.data.preset, 'combat_arena');
    assert.equal(def.data.parameters.width, 16.0);
    assert.equal(def.data.parameters.depth, 16.0);
    assert.equal(def.data.parameters.wallHeight, 3.5);
    assert.equal(def.data.parameters.pillars.length, 2);
    assert.ok(Array.isArray(def.diagnostics));
    assert.equal(def.diagnostics.length, 0);
  });

  await t.test('clamps out-of-bounds room parameters and records diagnostic warnings', () => {
    const def = createRoomDefinition({
      parameters: {
        width: 1000.0, // Exceeds max 48.0
        depth: 1.0,    // Below min 8.0
        wallHeight: 50.0 // Exceeds max 8.0
      }
    });

    assert.equal(def.data.parameters.width, 48.0);
    assert.equal(def.data.parameters.depth, 8.0);
    assert.equal(def.data.parameters.wallHeight, 8.0);
    assert.ok(def.diagnostics.length >= 3);
    assert.ok(def.diagnostics.some((d) => d.code === 'GEO_PARAM_CLAMPED_MAX'));
    assert.ok(def.diagnostics.some((d) => d.code === 'GEO_PARAM_CLAMPED_MIN'));
  });

  await t.test('falls back gracefully on unknown preset with diagnostic warning', () => {
    const def = createRoomDefinition({ preset: 'nonexistent_dungeon' });

    assert.equal(def.data.preset, 'combat_arena');
    assert.ok(def.diagnostics.some((d) => d.code === 'GEO_UNKNOWN_PRESET'));
  });
});

test('Geometry Forge — Semantic Procedural Primitives', async (t) => {
  await t.test('buildBoxGeometry generates indexed geometry with semantic attributes', () => {
    const geom = buildBoxGeometry({
      width: 4.0,
      height: 2.0,
      depth: 3.0,
      regionId: GEOMETRY_REGIONS.ARENA_WALL_NORTH,
      surfaceId: SURFACE_TYPES.WALL
    });

    assert.ok(geom.getAttribute('position'), 'has position attribute');
    assert.ok(geom.getAttribute('normal'), 'has normal attribute');
    assert.ok(geom.getAttribute('uv'), 'has uv attribute');
    assert.ok(geom.getAttribute('regionId'), 'has regionId attribute');
    assert.ok(geom.getAttribute('surfaceId'), 'has surfaceId attribute');
    assert.ok(geom.getIndex(), 'has index buffer');

    const posCount = geom.getAttribute('position').count;
    assert.equal(posCount, 24); // 6 faces * 4 vertices
    assert.equal(geom.getIndex().count, 36); // 6 faces * 2 triangles * 3 indices

    const regionArr = geom.getAttribute('regionId').array;
    const surfaceArr = geom.getAttribute('surfaceId').array;
    assert.equal(regionArr[0], GEOMETRY_REGIONS.ARENA_WALL_NORTH);
    assert.equal(surfaceArr[0], SURFACE_TYPES.WALL);
  });

  await t.test('buildCylinderGeometry generates indexed cylinder with semantic attributes', () => {
    const cyl = buildCylinderGeometry({
      radiusTop: 1.0,
      radiusBottom: 1.0,
      height: 3.0,
      radialSegments: 16,
      regionId: GEOMETRY_REGIONS.ARENA_PILLAR_1,
      surfaceId: SURFACE_TYPES.PILLAR
    });

    assert.ok(cyl.getAttribute('position'));
    assert.ok(cyl.getAttribute('regionId'));
    assert.ok(cyl.getAttribute('surfaceId'));
    assert.equal(cyl.getAttribute('surfaceId').array[0], SURFACE_TYPES.PILLAR);
    assert.ok(cyl.getIndex().count > 0);
  });
});

test('Geometry Forge — Procedural Room & Collision Single-Truth Derivation', async (t) => {
  await t.test('generates visual mesh and collision from identical RoomDefinition parameters', () => {
    const room = generateProceduralRoom('combat_arena');

    assert.ok(room.visual.geometry, 'visual geometry is generated');
    assert.ok(room.collision, 'collision representation is generated');
    assert.equal(room.collision.pillars.length, 2);

    const { width, depth, wallThickness } = room.definition.data.parameters;
    const expectedMinX = -width / 2 + wallThickness;
    const expectedMaxX = width / 2 - wallThickness;

    assert.equal(room.collision.innerBounds.minX, expectedMinX);
    assert.equal(room.collision.innerBounds.maxX, expectedMaxX);
  });

  await t.test('collision.resolvePosition constrains entity inside perimeter walls', () => {
    const room = generateProceduralRoom('combat_arena');
    const radius = 0.40;

    // Entity attempting to run past east wall (+X)
    const outEast = room.collision.resolvePosition(15.0, 0, radius);
    assert.ok(outEast.collided);
    assert.equal(outEast.x, room.collision.innerBounds.maxX - radius);

    // Entity attempting to run past south wall (-Z)
    const outSouth = room.collision.resolvePosition(0, -15.0, radius);
    assert.ok(outSouth.collided);
    assert.equal(outSouth.z, room.collision.innerBounds.minZ + radius);

    // Entity in valid center arena
    const inCenter = room.collision.resolvePosition(0, 0, radius);
    assert.equal(inCenter.collided, false);
    assert.equal(inCenter.x, 0);
    assert.equal(inCenter.z, 0);
  });

  await t.test('collision.resolvePosition pushes entity out of interior pillar obstacles', () => {
    const room = generateProceduralRoom('combat_arena');
    const p1 = room.collision.pillars[0];
    const charRadius = 0.40;

    // Place candidate position exactly at pillar center
    const insidePillar = room.collision.resolvePosition(p1.x, p1.z, charRadius);
    assert.ok(insidePillar.collided);

    // Distance from pillar center to resolved position must be >= pillar.radius + charRadius
    const dist = Math.hypot(insidePillar.x - p1.x, insidePillar.z - p1.z);
    assert.ok(dist >= p1.radius + charRadius - 1e-4);
  });

  await t.test('collision.isWalkable correctly tests valid vs blocked locations', () => {
    const room = generateProceduralRoom('combat_arena');
    assert.equal(room.collision.isWalkable(0, 0, 0.4), true, 'center is walkable');
    assert.equal(room.collision.isWalkable(10.0, 0, 0.4), false, 'outside wall is not walkable');

    const p1 = room.collision.pillars[0];
    assert.equal(room.collision.isWalkable(p1.x, p1.z, 0.4), false, 'inside pillar is not walkable');
  });

  await t.test('reconciled semantic enums match durable canonical spec contract', () => {
    // SURFACE_TYPES
    assert.equal(SURFACE_TYPES.FLOOR, 1);
    assert.equal(SURFACE_TYPES.WALL, 2);
    assert.equal(SURFACE_TYPES.PILLAR, 3);
    assert.equal(SURFACE_TYPES.OBSTACLE, 4);
    assert.equal(SURFACE_TYPES.CEILING, 5);

    // SURFACE_NAMES
    assert.equal(SURFACE_NAMES[1], 'floor');
    assert.equal(SURFACE_NAMES[2], 'wall');
    assert.equal(SURFACE_NAMES[3], 'pillar');
    assert.equal(SURFACE_NAMES[4], 'obstacle');
    assert.equal(SURFACE_NAMES[5], 'ceiling');

    // CONSTRAINT_FLAGS
    assert.equal(CONSTRAINT_FLAGS.NONE, 0);
    assert.equal(CONSTRAINT_FLAGS.WALKABLE, 1);
    assert.equal(CONSTRAINT_FLAGS.SOLID, 2);
    assert.equal(CONSTRAINT_FLAGS.PERIMETER, 4);
    assert.equal(CONSTRAINT_FLAGS.CLIMBABLE, 8);
    assert.equal(CONSTRAINT_FLAGS.DESTRUCTIBLE, 16);

    // GEOMETRY_REGIONS
    assert.equal(GEOMETRY_REGIONS.ARENA_FLOOR, 10);
    assert.equal(GEOMETRY_REGIONS.ARENA_WALL_NORTH, 20);
    assert.equal(GEOMETRY_REGIONS.ARENA_WALL_SOUTH, 21);
    assert.equal(GEOMETRY_REGIONS.ARENA_WALL_EAST, 22);
    assert.equal(GEOMETRY_REGIONS.ARENA_WALL_WEST, 23);
    assert.equal(GEOMETRY_REGIONS.ARENA_PILLAR_1, 30);
    assert.equal(GEOMETRY_REGIONS.ARENA_PILLAR_2, 31);
    assert.equal(GEOMETRY_REGIONS.ARENA_FEATURE, 40);
  });

  await t.test('PILLAR_PARAMETER_BOUNDS validates and clamps pillar dimensions', () => {
    assert.equal(PILLAR_PARAMETER_BOUNDS.radius.min, 0.3);
    assert.equal(PILLAR_PARAMETER_BOUNDS.radius.max, 2.0);
    assert.equal(PILLAR_PARAMETER_BOUNDS.radius.default, 0.75);
    assert.equal(PILLAR_PARAMETER_BOUNDS.height.min, 1.0);
    assert.equal(PILLAR_PARAMETER_BOUNDS.height.max, 8.0);
    assert.equal(PILLAR_PARAMETER_BOUNDS.height.default, 3.5);

    const { parameters, diagnostics } = resolveRoomParameters({
      pillars: [
        { id: 'p_extreme', x: 0, z: 0, radius: 99.0, height: 0.1 }
      ]
    });

    assert.equal(parameters.pillars[0].radius, 2.0);
    assert.equal(parameters.pillars[0].height, 1.0);
    assert.ok(diagnostics.some((d) => d.code === 'GEO_PILLAR_CLAMPED_MAX'));
    assert.ok(diagnostics.some((d) => d.code === 'GEO_PILLAR_CLAMPED_MIN'));
  });

  await t.test('buildCylinderGeometry supports open-bottom default and optional cappedBottom', () => {
    // Default open-bottom: eliminates coplanar z-fighting with floor
    const openCyl = buildCylinderGeometry({ radialSegments: 16, cappedBottom: false });
    // Side: 16 * 6 = 96 indices. Top cap: 16 * 3 = 48 indices. Total = 144.
    assert.equal(openCyl.getIndex().count, 144);

    // Explicit capped-bottom: adds bottom cap (48 indices -> 192 total)
    const closedCyl = buildCylinderGeometry({ radialSegments: 16, cappedBottom: true });
    assert.equal(closedCyl.getIndex().count, 192);

    // Verify bottom cap center normal is -Y
    const normals = closedCyl.getAttribute('normal');
    // The bottom center is vertex (posCount - (1 + radialSegments + 1))
    // Bottom center was pushed at index posCount - 18
    const botCenterIdx = closedCyl.getAttribute('position').count - 18;
    assert.equal(normals.getY(botCenterIdx), -1);
  });
});
