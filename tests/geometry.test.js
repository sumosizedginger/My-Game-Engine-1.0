/**
 * My Game Engine 1.0 — Geometry Forge Unit Tests
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoomDefinition,
  buildBoxGeometry,
  buildCylinderGeometry,
  generateProceduralRoom,
  SURFACE_TYPES,
  CONSTRAINT_FLAGS,
  GEOMETRY_REGIONS
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
});
