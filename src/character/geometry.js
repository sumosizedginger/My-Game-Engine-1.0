/**
 * My Game Engine 1.0 — Character Forge: Geometry
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Constructs a procedural deformation-ready humanoid mesh with explicit
 * multi-ring topology around articulated bending joints (knees, elbows,
 * waist, neck). Assigns semantic body regions for skinning attribution.
 * Follows ARCHITECTURE.md §20.2 & §22 and CHARACTER_FORGE.md.
 */

import { BufferGeometry, BufferAttribute } from 'three';

export const REGIONS = Object.freeze({
  PELVIS: 1,
  SPINE: 2,
  CHEST: 3,
  NECK: 4,
  HEAD: 5,
  UPPER_ARM_L: 6,
  LOWER_ARM_L: 7,
  HAND_L: 8,
  UPPER_ARM_R: 9,
  LOWER_ARM_R: 10,
  HAND_R: 11,
  THIGH_L: 12,
  SHIN_L: 13,
  FOOT_L: 14,
  THIGH_R: 15,
  SHIN_R: 16,
  FOOT_R: 17
});

/**
 * Builds a lofted cylinder / tube between cross-section stations.
 */
function buildLoft({
  stations,
  radialSegments = 12,
  regionId = 1,
  capStart = false,
  capEnd = false,
  positions,
  normals,
  uvs,
  regionIds,
  indices
}) {
  const startIndex = positions.length / 3;
  const numRings = stations.length;

  // 1. Generate ring vertices
  for (let r = 0; r < numRings; r++) {
    const st = stations[r];
    const cx = st.x;
    const cy = st.y;
    const cz = st.z;
    const rx = st.rx;
    const rz = st.rz !== undefined ? st.rz : rx;
    const reg = st.regionId !== undefined ? st.regionId : regionId;
    const v = r / (numRings - 1);

    for (let s = 0; s <= radialSegments; s++) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vx = cx + cos * rx;
      const vy = cy;
      const vz = cz + sin * rz;

      positions.push(vx, vy, vz);
      normals.push(cos, 0, sin); // Initial radial normal, recomputed later
      uvs.push(u, v);
      regionIds.push(reg);
    }
  }

  const ringStride = radialSegments + 1;

  // 2. Generate side quads (as 2 triangles)
  for (let r = 0; r < numRings - 1; r++) {
    const ringA = startIndex + r * ringStride;
    const ringB = startIndex + (r + 1) * ringStride;

    for (let s = 0; s < radialSegments; s++) {
      const a = ringA + s;
      const b = ringA + s + 1;
      const c = ringB + s + 1;
      const d = ringB + s;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // 3. Cap start if requested
  if (capStart && numRings > 0) {
    const firstRing = startIndex;
    const st = stations[0];
    const centerIdx = positions.length / 3;
    positions.push(st.x, st.y, st.z);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0);
    regionIds.push(stations[0].regionId || regionId);

    for (let s = 0; s < radialSegments; s++) {
      indices.push(centerIdx, firstRing + s + 1, firstRing + s);
    }
  }

  // 4. Cap end if requested
  if (capEnd && numRings > 0) {
    const lastRing = startIndex + (numRings - 1) * ringStride;
    const st = stations[numRings - 1];
    const centerIdx = positions.length / 3;
    positions.push(st.x, st.y, st.z);
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);
    regionIds.push(stations[numRings - 1].regionId || regionId);

    for (let s = 0; s < radialSegments; s++) {
      indices.push(centerIdx, lastRing + s, lastRing + s + 1);
    }
  }
}

/**
 * Builds a limb tube along a 3D path with joint cluster rings.
 */
function buildLimbTube({
  points, // [{ x, y, z, rx, rz, regionId }]
  radialSegments = 10,
  capStart = false,
  capEnd = true,
  positions,
  normals,
  uvs,
  regionIds,
  indices
}) {
  const startIndex = positions.length / 3;
  const numStations = points.length;

  for (let i = 0; i < numStations; i++) {
    const pt = points[i];
    const rx = pt.rx;
    const rz = pt.rz !== undefined ? pt.rz : rx;
    const reg = pt.regionId;
    const v = i / (numStations - 1);

    // Compute local orientation along tangent
    let tx = 0, ty = -1, tz = 0;
    if (i < numStations - 1) {
      tx = points[i + 1].x - pt.x;
      ty = points[i + 1].y - pt.y;
      tz = points[i + 1].z - pt.z;
    } else {
      tx = pt.x - points[i - 1].x;
      ty = pt.y - points[i - 1].y;
      tz = pt.z - points[i - 1].z;
    }
    const len = Math.hypot(tx, ty, tz) || 1;
    tx /= len; ty /= len; tz /= len;

    // Normal vector perpendicular to tangent
    let nx = 1, ny = 0, nz = 0;
    if (Math.abs(tx) > 0.9) {
      nx = 0; ny = 1; nz = 0;
    }
    // Gram-Schmidt orthogonalize
    const dot = nx * tx + ny * ty + nz * tz;
    nx -= dot * tx; ny -= dot * ty; nz -= dot * tz;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    nx /= nlen; ny /= nlen; nz /= nlen;

    // Binormal
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    for (let s = 0; s <= radialSegments; s++) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vx = pt.x + (nx * cos * rx) + (bx * sin * rz);
      const vy = pt.y + (ny * cos * rx) + (by * sin * rz);
      const vz = pt.z + (nz * cos * rx) + (bz * sin * rz);

      positions.push(vx, vy, vz);
      normals.push(nx * cos + bx * sin, ny * cos + by * sin, nz * cos + bz * sin);
      uvs.push(u, v);
      regionIds.push(reg);
    }
  }

  const ringStride = radialSegments + 1;
  for (let r = 0; r < numStations - 1; r++) {
    const ringA = startIndex + r * ringStride;
    const ringB = startIndex + (r + 1) * ringStride;

    for (let s = 0; s < radialSegments; s++) {
      const a = ringA + s;
      const b = ringA + s + 1;
      const c = ringB + s + 1;
      const d = ringB + s;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const firstRing = startIndex;
    const pt = points[0];
    const centerIdx = positions.length / 3;
    positions.push(pt.x, pt.y, pt.z);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0);
    regionIds.push(points[0].regionId);

    for (let s = 0; s < radialSegments; s++) {
      indices.push(centerIdx, firstRing + s + 1, firstRing + s);
    }
  }

  if (capEnd) {
    const lastRing = startIndex + (numStations - 1) * ringStride;
    const pt = points[numStations - 1];
    const centerIdx = positions.length / 3;
    positions.push(pt.x, pt.y, pt.z);
    normals.push(0, -1, 0);
    uvs.push(0.5, 1);
    regionIds.push(points[numStations - 1].regionId);

    for (let s = 0; s < radialSegments; s++) {
      indices.push(centerIdx, lastRing + s, lastRing + s + 1);
    }
  }
}

/**
 * Generates deformation-ready procedural humanoid geometry.
 *
 * @param {object} params - Resolved humanoid parameters.
 * @param {object} landmarks - Semantic landmark vectors.
 * @returns {object} { geometry, rawData }
 */
export function createHumanoidGeometry(params, landmarks) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const regionIds = [];
  const indices = [];

  const radSeg = params.radialSegments || 16;
  const limbSeg = Math.max(8, Math.floor(radSeg * 0.75));

  const H = params.height;
  const hipY = landmarks.pelvis.y;
  const waistY = landmarks.spine.y;
  const chestY = landmarks.chest.y;
  const neckY = landmarks.neck.y;
  const headApexY = landmarks.headApex.y;
  const headCenterY = landmarks.head.y;

  // -------------------------------------------------------------
  // 1. TORSO (Pelvis to Neck Base)
  // Continuous rings with deformation loop cluster at waist/spine
  // -------------------------------------------------------------
  const shoulderY = landmarks['shoulder.L'].y;
  const shoulderHalf = params.shoulderWidth * 0.5;

  const torsoStations = [
    // Pelvis bottom
    { x: 0, y: hipY - params.pelvisDepth * 0.7, z: 0, rx: params.pelvisWidth * 0.40, rz: params.pelvisDepth * 0.40, regionId: REGIONS.PELVIS },
    { x: 0, y: hipY - params.pelvisDepth * 0.3, z: 0, rx: params.pelvisWidth * 0.52, rz: params.pelvisDepth * 0.48, regionId: REGIONS.PELVIS },
    // Pelvis / Hip level
    { x: 0, y: hipY, z: 0, rx: params.pelvisWidth * 0.55, rz: params.pelvisDepth * 0.50, regionId: REGIONS.PELVIS },
    { x: 0, y: hipY + (waistY - hipY) * 0.4, z: -0.002, rx: params.pelvisWidth * 0.50, rz: params.pelvisDepth * 0.48, regionId: REGIONS.PELVIS },

    // Waist / Spine inflection (3 rings clustered for smooth bend)
    { x: 0, y: waistY - 0.03, z: -0.004, rx: params.waistWidth * 0.50, rz: params.waistDepth * 0.50, regionId: REGIONS.SPINE },
    { x: 0, y: waistY, z: -0.005, rx: params.waistWidth * 0.48, rz: params.waistDepth * 0.47, regionId: REGIONS.SPINE },
    { x: 0, y: waistY + 0.03, z: -0.002, rx: params.waistWidth * 0.51, rz: params.waistDepth * 0.49, regionId: REGIONS.SPINE },

    // Lower chest to mid chest
    { x: 0, y: waistY + (chestY - waistY) * 0.5, z: 0.002, rx: params.chestWidth * 0.58, rz: params.chestDepth * 0.52, regionId: REGIONS.CHEST },
    { x: 0, y: chestY, z: 0.005, rx: params.chestWidth * 0.65, rz: params.chestDepth * 0.58, regionId: REGIONS.CHEST },

    // Upper chest broadening into shoulders to meet limb joints seamlessly
    { x: 0, y: shoulderY - 0.03, z: 0.003, rx: shoulderHalf * 0.88, rz: params.chestDepth * 0.54, regionId: REGIONS.CHEST },
    { x: 0, y: shoulderY, z: 0.001, rx: shoulderHalf * 0.96, rz: params.chestDepth * 0.50, regionId: REGIONS.CHEST },
    { x: 0, y: shoulderY + 0.02, z: 0, rx: shoulderHalf * 0.72, rz: params.chestDepth * 0.44, regionId: REGIONS.CHEST },

    // Neck base
    { x: 0, y: neckY, z: 0, rx: params.neckThickness * 0.85, rz: params.neckThickness * 0.80, regionId: REGIONS.NECK }
  ];

  buildLoft({
    stations: torsoStations,
    radialSegments: radSeg,
    regionId: REGIONS.TORSO || REGIONS.SPINE,
    capStart: true,
    capEnd: false,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 2. NECK
  // -------------------------------------------------------------
  const neckStations = [
    { x: 0, y: neckY, z: 0, rx: params.neckThickness * 0.85, rz: params.neckThickness * 0.80, regionId: REGIONS.NECK },
    { x: 0, y: neckY + 0.04, z: 0, rx: params.neckThickness * 0.78, rz: params.neckThickness * 0.78, regionId: REGIONS.NECK },
    { x: 0, y: landmarks.head.y - 0.06, z: 0, rx: params.neckThickness * 0.82, rz: params.neckThickness * 0.82, regionId: REGIONS.NECK }
  ];

  buildLoft({
    stations: neckStations,
    radialSegments: limbSeg,
    regionId: REGIONS.NECK,
    capStart: false,
    capEnd: false,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 3. HEAD
  // Anatomical cranial ellipsoid with jaw taper
  // -------------------------------------------------------------
  const headScale = params.headScale || 1.0;
  const headHeight = 0.13 * H * headScale;
  const headRy = headHeight * 0.50;
  const headRx = 0.046 * H * headScale;
  const headRz = 0.058 * H * headScale;
  const headCenter = headCenterY;

  const headRings = 8;
  const headStations = [];
  for (let i = 0; i <= headRings; i++) {
    const phi = (i / headRings) * Math.PI; // 0 at chin, PI at apex
    const y = headCenter - Math.cos(phi) * headRy;
    const sinPhi = Math.sin(phi);
    const jawTaper = phi < Math.PI * 0.5 ? (0.80 + 0.20 * sinPhi) : 1.0;

    headStations.push({
      x: 0,
      y,
      z: 0.01 + 0.015 * (1.0 - phi / Math.PI),
      rx: Math.max(0.015, headRx * sinPhi * jawTaper),
      rz: Math.max(0.015, headRz * sinPhi),
      regionId: REGIONS.HEAD
    });
  }

  buildLoft({
    stations: headStations,
    radialSegments: radSeg,
    regionId: REGIONS.HEAD,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 4. LEFT ARM (Shoulder -> Elbow -> Wrist -> Hand)
  // Continuous tube with 3 deformation rings at elbow
  // -------------------------------------------------------------
  const sL = landmarks['shoulder.L'];
  const eL = landmarks['elbow.L'];
  const wL = landmarks['wrist.L'];
  const hL = landmarks['hand.L'];
  const armThick = 0.038 * H * params.armMass;

  const armLPoints = [
    // Shoulder start
    { x: sL.x, y: sL.y, z: sL.z, rx: armThick * 1.25, rz: armThick * 1.20, regionId: REGIONS.UPPER_ARM_L },
    { x: sL.x + (eL.x - sL.x) * 0.4, y: sL.y + (eL.y - sL.y) * 0.4, z: sL.z + (eL.z - sL.z) * 0.4, rx: armThick * 1.05, rz: armThick * 1.00, regionId: REGIONS.UPPER_ARM_L },
    // Elbow deformation cluster (3 rings)
    { x: eL.x - 0.015 * (eL.x - sL.x), y: eL.y + 0.02, z: eL.z - 0.005, rx: armThick * 0.95, rz: armThick * 0.92, regionId: REGIONS.UPPER_ARM_L },
    { x: eL.x, y: eL.y, z: eL.z, rx: armThick * 0.92, rz: armThick * 0.90, regionId: REGIONS.LOWER_ARM_L },
    { x: eL.x + 0.015 * (wL.x - eL.x), y: eL.y - 0.02, z: eL.z, rx: armThick * 0.90, rz: armThick * 0.88, regionId: REGIONS.LOWER_ARM_L },
    // Forearm
    { x: eL.x + (wL.x - eL.x) * 0.5, y: eL.y + (wL.y - eL.y) * 0.5, z: eL.z + (wL.z - eL.z) * 0.5, rx: armThick * 0.85, rz: armThick * 0.82, regionId: REGIONS.LOWER_ARM_L },
    // Wrist
    { x: wL.x, y: wL.y, z: wL.z, rx: armThick * 0.72, rz: armThick * 0.68, regionId: REGIONS.LOWER_ARM_L },
    // Hand
    { x: wL.x + (hL.x - wL.x) * 0.5, y: wL.y + (hL.y - wL.y) * 0.5, z: wL.z, rx: armThick * 0.75, rz: armThick * 0.45, regionId: REGIONS.HAND_L },
    { x: hL.x, y: hL.y, z: hL.z, rx: armThick * 0.50, rz: armThick * 0.30, regionId: REGIONS.HAND_L }
  ];

  buildLimbTube({
    points: armLPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 5. RIGHT ARM (Mirrored X)
  // -------------------------------------------------------------
  const sR = landmarks['shoulder.R'];
  const eR = landmarks['elbow.R'];
  const wR = landmarks['wrist.R'];
  const hR = landmarks['hand.R'];

  const armRPoints = [
    { x: sR.x, y: sR.y, z: sR.z, rx: armThick * 1.25, rz: armThick * 1.20, regionId: REGIONS.UPPER_ARM_R },
    { x: sR.x + (eR.x - sR.x) * 0.4, y: sR.y + (eR.y - sR.y) * 0.4, z: sR.z + (eR.z - sR.z) * 0.4, rx: armThick * 1.05, rz: armThick * 1.00, regionId: REGIONS.UPPER_ARM_R },
    { x: eR.x - 0.015 * (eR.x - sR.x), y: eR.y + 0.02, z: eR.z - 0.005, rx: armThick * 0.95, rz: armThick * 0.92, regionId: REGIONS.UPPER_ARM_R },
    { x: eR.x, y: eR.y, z: eR.z, rx: armThick * 0.92, rz: armThick * 0.90, regionId: REGIONS.LOWER_ARM_R },
    { x: eR.x + 0.015 * (wR.x - eR.x), y: eR.y - 0.02, z: eR.z, rx: armThick * 0.90, rz: armThick * 0.88, regionId: REGIONS.LOWER_ARM_R },
    { x: eR.x + (wR.x - eR.x) * 0.5, y: eR.y + (wR.y - eR.y) * 0.5, z: eR.z + (wR.z - eR.z) * 0.5, rx: armThick * 0.85, rz: armThick * 0.82, regionId: REGIONS.LOWER_ARM_R },
    { x: wR.x, y: wR.y, z: wR.z, rx: armThick * 0.72, rz: armThick * 0.68, regionId: REGIONS.LOWER_ARM_R },
    { x: wR.x + (hR.x - wR.x) * 0.5, y: wR.y + (hR.y - wR.y) * 0.5, z: wR.z, rx: armThick * 0.75, rz: armThick * 0.45, regionId: REGIONS.HAND_R },
    { x: hR.x, y: hR.y, z: hR.z, rx: armThick * 0.50, rz: armThick * 0.30, regionId: REGIONS.HAND_R }
  ];

  buildLimbTube({
    points: armRPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 6. LEFT LEG (Hip -> Knee -> Ankle -> Foot)
  // Continuous tube with 3 deformation rings at knee
  // -------------------------------------------------------------
  const hipL = landmarks['hip.L'];
  const kneeL = landmarks['knee.L'];
  const ankL = landmarks['ankle.L'];
  const toeL = landmarks['toe.L'];
  const legThick = 0.055 * H * params.legMass;

    // Ankle / Foot
    const footH = 0.05 * H;
    const footRx = legThick * 0.55;
    const footRy = footH * 0.36;

    const legLPoints = [
    // Hip start
    { x: hipL.x, y: hipL.y, z: hipL.z, rx: legThick * 1.35, rz: legThick * 1.30, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y + (kneeL.y - hipL.y) * 0.35, z: hipL.z, rx: legThick * 1.20, rz: legThick * 1.15, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y + (kneeL.y - hipL.y) * 0.70, z: hipL.z, rx: legThick * 1.05, rz: legThick * 1.00, regionId: REGIONS.THIGH_L },
    // Knee deformation cluster (3 rings)
    { x: kneeL.x, y: kneeL.y + 0.025, z: kneeL.z - 0.005, rx: legThick * 0.95, rz: legThick * 0.95, regionId: REGIONS.THIGH_L },
    { x: kneeL.x, y: kneeL.y, z: kneeL.z, rx: legThick * 0.92, rz: legThick * 0.92, regionId: REGIONS.SHIN_L },
    { x: kneeL.x, y: kneeL.y - 0.025, z: kneeL.z - 0.003, rx: legThick * 0.90, rz: legThick * 0.90, regionId: REGIONS.SHIN_L },
    // Shin
    { x: kneeL.x, y: kneeL.y + (ankL.y - kneeL.y) * 0.45, z: ankL.z, rx: legThick * 0.85, rz: legThick * 0.82, regionId: REGIONS.SHIN_L },
    { x: ankL.x, y: ankL.y + 0.02, z: ankL.z, rx: legThick * 0.72, rz: legThick * 0.70, regionId: REGIONS.SHIN_L },
    // Ankle / Foot
    { x: ankL.x, y: ankL.y * 0.75, z: ankL.z + 0.02, rx: footRx, rz: footRy * 1.1, regionId: REGIONS.FOOT_L },
    { x: ankL.x, y: footRy * 1.15, z: toeL.z * 0.5, rx: footRx * 0.95, rz: footRy, regionId: REGIONS.FOOT_L },
    { x: toeL.x, y: footRy * 0.85, z: toeL.z, rx: footRx * 0.80, rz: footRy * 0.75, regionId: REGIONS.FOOT_L }
  ];

  buildLimbTube({
    points: legLPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 7. RIGHT LEG (Mirrored X)
  // -------------------------------------------------------------
  const hipR = landmarks['hip.R'];
  const kneeR = landmarks['knee.R'];
  const ankR = landmarks['ankle.R'];
  const toeR = landmarks['toe.R'];

  const legRPoints = [
    { x: hipR.x, y: hipR.y, z: hipR.z, rx: legThick * 1.35, rz: legThick * 1.30, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y + (kneeR.y - hipR.y) * 0.35, z: hipR.z, rx: legThick * 1.20, rz: legThick * 1.15, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y + (kneeR.y - hipR.y) * 0.70, z: hipR.z, rx: legThick * 1.05, rz: legThick * 1.00, regionId: REGIONS.THIGH_R },
    { x: kneeR.x, y: kneeR.y + 0.025, z: kneeR.z - 0.005, rx: legThick * 0.95, rz: legThick * 0.95, regionId: REGIONS.THIGH_R },
    { x: kneeR.x, y: kneeR.y, z: kneeR.z, rx: legThick * 0.92, rz: legThick * 0.92, regionId: REGIONS.SHIN_R },
    { x: kneeR.x, y: kneeR.y - 0.025, z: kneeR.z - 0.003, rx: legThick * 0.90, rz: legThick * 0.90, regionId: REGIONS.SHIN_R },
    { x: kneeR.x, y: kneeR.y + (ankR.y - kneeR.y) * 0.45, z: ankR.z, rx: legThick * 0.85, rz: legThick * 0.82, regionId: REGIONS.SHIN_R },
    { x: ankR.x, y: ankR.y + 0.02, z: ankR.z, rx: legThick * 0.72, rz: legThick * 0.70, regionId: REGIONS.SHIN_R },
    { x: ankR.x, y: ankR.y * 0.75, z: ankR.z + 0.02, rx: footRx, rz: footRy * 1.1, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: footRy * 1.15, z: toeR.z * 0.5, rx: footRx * 0.95, rz: footRy, regionId: REGIONS.FOOT_R },
    { x: toeR.x, y: footRy * 0.85, z: toeR.z, rx: footRx * 0.80, rz: footRy * 0.75, regionId: REGIONS.FOOT_R }
  ];

  buildLimbTube({
    points: legRPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // Package into Three.js BufferGeometry
  // -------------------------------------------------------------
  const posArray = new Float32Array(positions);
  const normArray = new Float32Array(normals);
  const uvArray = new Float32Array(uvs);
  const regionArray = new Uint8Array(regionIds);
  const indexArray = indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(posArray, 3));
  geometry.setAttribute('normal', new BufferAttribute(normArray, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvArray, 2));
  geometry.setAttribute('region', new BufferAttribute(regionArray, 1));
  geometry.setIndex(new BufferAttribute(indexArray, 1));

  // Compute smooth face-weighted normals
  geometry.computeVertexNormals();

  return {
    geometry,
    rawData: {
      positions: posArray,
      normals: normArray,
      uvs: uvArray,
      regionIds: regionArray,
      indices: indexArray,
      vertexCount: positions.length / 3,
      triangleCount: indices.length / 3
    }
  };
}
