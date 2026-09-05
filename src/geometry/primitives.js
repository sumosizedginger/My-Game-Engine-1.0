/**
 * My Game Engine 1.0 — Geometry Forge: Procedural Primitives
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Constructs procedural semantic BufferGeometry primitives (boxes, cylinders, slabs)
 * with explicit position, normal, uv, regionId, and surfaceId attributes.
 * Follows ARCHITECTURE.md §20.1 & §21 and GEOMETRY_FORGE.md.
 */

import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three';
import { SURFACE_TYPES, GEOMETRY_REGIONS } from './semantics.js';

/**
 * Builds a box BufferGeometry with semantic attributes.
 *
 * @param {object} options
 * @param {number} [options.width=1]
 * @param {number} [options.height=1]
 * @param {number} [options.depth=1]
 * @param {object} [options.origin={x:0, y:0, z:0}] - Center position.
 * @param {number} [options.regionId=0]
 * @param {number} [options.surfaceId=0]
 * @returns {BufferGeometry}
 */
export function buildBoxGeometry({
  width = 1,
  height = 1,
  depth = 1,
  origin = { x: 0, y: 0, z: 0 },
  regionId = GEOMETRY_REGIONS.ARENA_FEATURE,
  surfaceId = SURFACE_TYPES.OBSTACLE
} = {}) {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  const ox = origin.x || 0;
  const oy = origin.y || 0;
  const oz = origin.z || 0;

  // 6 faces * 4 vertices = 24 vertices
  const positions = [];
  const normals = [];
  const uvs = [];
  const regionIds = [];
  const surfaceIds = [];
  const indices = [];

  const faces = [
    // +Z (Front)
    { norm: [0, 0, 1], corners: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
    // -Z (Back)
    { norm: [0, 0, -1], corners: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
    // +Y (Top)
    { norm: [0, 1, 0], corners: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
    // -Y (Bottom)
    { norm: [0, -1, 0], corners: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] },
    // +X (Right)
    { norm: [1, 0, 0], corners: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
    // -X (Left)
    { norm: [-1, 0, 0], corners: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] }
  ];

  const faceUVs = [
    [0, 0], [1, 0], [1, 1], [0, 1]
  ];

  let vertOffset = 0;
  for (const face of faces) {
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i];
      positions.push(c[0] + ox, c[1] + oy, c[2] + oz);
      normals.push(face.norm[0], face.norm[1], face.norm[2]);
      uvs.push(faceUVs[i][0], faceUVs[i][1]);
      regionIds.push(regionId);
      surfaceIds.push(surfaceId);
    }
    // 2 triangles per face (quad)
    indices.push(vertOffset, vertOffset + 1, vertOffset + 2);
    indices.push(vertOffset, vertOffset + 2, vertOffset + 3);
    vertOffset += 4;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('regionId', new Float32BufferAttribute(regionIds, 1));
  geometry.setAttribute('surfaceId', new Float32BufferAttribute(surfaceIds, 1));

  const IndexArray = positions.length / 3 > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute;
  geometry.setIndex(new IndexArray(indices, 1));

  return geometry;
}

/**
 * Builds a cylinder BufferGeometry with semantic attributes.
 *
 * @param {object} options
 * @param {number} [options.radiusTop=0.5]
 * @param {number} [options.radiusBottom=0.5]
 * @param {number} [options.height=2]
 * @param {number} [options.radialSegments=16]
 * @param {object} [options.origin={x:0, y:0, z:0}] - Base center (Y=0 rests at origin.y).
 * @param {number} [options.regionId=0]
 * @param {number} [options.surfaceId=0]
 * @returns {BufferGeometry}
 */
export function buildCylinderGeometry({
  radiusTop = 0.5,
  radiusBottom = 0.5,
  height = 2,
  radialSegments = 16,
  origin = { x: 0, y: 0, z: 0 },
  regionId = GEOMETRY_REGIONS.ARENA_PILLAR_1,
  surfaceId = SURFACE_TYPES.PILLAR
} = {}) {
  const ox = origin.x || 0;
  const oy = origin.y || 0;
  const oz = origin.z || 0;

  const positions = [];
  const normals = [];
  const uvs = [];
  const regionIds = [];
  const surfaceIds = [];
  const indices = [];

  // 1. Side body vertices
  for (let yStep = 0; yStep <= 1; yStep++) {
    const y = yStep === 0 ? oy : oy + height;
    const r = yStep === 0 ? radiusBottom : radiusTop;
    const v = yStep;

    for (let s = 0; s <= radialSegments; s++) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vx = ox + r * cos;
      const vz = oz + r * sin;

      positions.push(vx, y, vz);
      normals.push(cos, 0, sin);
      uvs.push(u, v);
      regionIds.push(regionId);
      surfaceIds.push(surfaceId);
    }
  }

  // Side indices
  const stride = radialSegments + 1;
  for (let s = 0; s < radialSegments; s++) {
    const a = s;
    const b = s + 1;
    const c = s + stride + 1;
    const d = s + stride;

    indices.push(a, b, d);
    indices.push(b, c, d);
  }

  // 2. Top Cap
  const topCenterIdx = positions.length / 3;
  positions.push(ox, oy + height, oz);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  regionIds.push(regionId);
  surfaceIds.push(surfaceId);

  const topStartIdx = positions.length / 3;
  for (let s = 0; s <= radialSegments; s++) {
    const u = s / radialSegments;
    const theta = u * Math.PI * 2;
    positions.push(ox + radiusTop * Math.cos(theta), oy + height, oz + radiusTop * Math.sin(theta));
    normals.push(0, 1, 0);
    uvs.push(0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta));
    regionIds.push(regionId);
    surfaceIds.push(surfaceId);
  }

  for (let s = 0; s < radialSegments; s++) {
    indices.push(topCenterIdx, topStartIdx + s + 1, topStartIdx + s);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('regionId', new Float32BufferAttribute(regionIds, 1));
  geometry.setAttribute('surfaceId', new Float32BufferAttribute(surfaceIds, 1));

  const IndexArray = positions.length / 3 > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute;
  geometry.setIndex(new IndexArray(indices, 1));

  return geometry;
}

/**
 * Merges multiple BufferGeometries with matching attributes into a single BufferGeometry.
 *
 * @param {Array<BufferGeometry>} geometries
 * @returns {BufferGeometry}
 */
export function mergeSemanticGeometries(geometries) {
  if (!Array.isArray(geometries) || geometries.length === 0) {
    return new BufferGeometry();
  }
  if (geometries.length === 1) {
    return geometries[0].clone();
  }

  const mergedPositions = [];
  const mergedNormals = [];
  const mergedUvs = [];
  const mergedRegionIds = [];
  const mergedSurfaceIds = [];
  const mergedIndices = [];

  let indexOffset = 0;

  for (const geom of geometries) {
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    const uv = geom.getAttribute('uv');
    const reg = geom.getAttribute('regionId');
    const surf = geom.getAttribute('surfaceId');
    const idx = geom.getIndex();

    if (!pos || !idx) continue;

    const count = pos.count;
    for (let i = 0; i < count; i++) {
      mergedPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      mergedNormals.push(norm ? norm.getX(i) : 0, norm ? norm.getY(i) : 1, norm ? norm.getZ(i) : 0);
      mergedUvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      mergedRegionIds.push(reg ? reg.getX(i) : 0);
      mergedSurfaceIds.push(surf ? surf.getX(i) : 0);
    }

    for (let i = 0; i < idx.count; i++) {
      mergedIndices.push(idx.getX(i) + indexOffset);
    }

    indexOffset += count;
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(mergedPositions, 3));
  merged.setAttribute('normal', new Float32BufferAttribute(mergedNormals, 3));
  merged.setAttribute('uv', new Float32BufferAttribute(mergedUvs, 2));
  merged.setAttribute('regionId', new Float32BufferAttribute(mergedRegionIds, 1));
  merged.setAttribute('surfaceId', new Float32BufferAttribute(mergedSurfaceIds, 1));

  const IndexArray = mergedPositions.length / 3 > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute;
  merged.setIndex(new IndexArray(mergedIndices, 1));

  return merged;
}
