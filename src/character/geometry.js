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
  FOOT_R: 17,
  TORSO: 18
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
    let stx = 0, sty = -1, stz = 0;
    if (numStations > 1) {
      stx = points[1].x - pt.x;
      sty = points[1].y - pt.y;
      stz = points[1].z - pt.z;
      const l = Math.hypot(stx, sty, stz) || 1;
      stx /= l; sty /= l; stz /= l;
    }
    positions.push(pt.x, pt.y, pt.z);
    normals.push(-stx, -sty, -stz);
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
    let etx = 0, ety = -1, etz = 0;
    if (numStations > 1) {
      etx = pt.x - points[numStations - 2].x;
      ety = pt.y - points[numStations - 2].y;
      etz = pt.z - points[numStations - 2].z;
      const l = Math.hypot(etx, ety, etz) || 1;
      etx /= l; ety /= l; etz /= l;
    }
    positions.push(pt.x, pt.y, pt.z);
    normals.push(etx, ety, etz);
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
  const torsoSeg = params.torsoSegments || radSeg;
  const limbSeg = params.limbSegments || Math.max(8, Math.floor(radSeg * 0.75));

  const H = params.height;
  const hipY = landmarks.pelvis.y;
  const waistY = landmarks.spine.y;
  const chestY = landmarks.chest.y;
  const neckY = landmarks.neck.y;
  const headApexY = landmarks.headApex.y;
  const headCenterY = landmarks.head.y;

  // -------------------------------------------------------------
  // 1. AXIAL BODY (Pelvis -> Spine -> Torso -> Chest -> Neck -> Head)
  // Anatomical S-curve loft: sacral kyphosis -> lumbar lordosis ->
  // thoracic kyphosis -> cervical lordosis -> cranial vault.
  // -------------------------------------------------------------
  const shoulderY = landmarks['shoulder.L'].y;
  const shoulderHalf = params.shoulderWidth * 0.5;

  const headScale = params.headScale || 1.0;
  const headHeight = 0.13 * H * headScale;
  const headRy = headHeight * 0.50;
  const headRx = 0.046 * H * headScale;
  const headRz = 0.058 * H * headScale;
  const chinY = headApexY - headHeight;

  const axialStations = [
    // --- Pelvis & Groin (Anatomical pelvic bowl with curved gluteal fold) ---
    // Station 0: Perineum / gluteal fold bottom
    { x: 0, y: hipY - 0.040, z: -0.015, rx: params.pelvisWidth * 0.55, rz: params.pelvisDepth * 0.70, regionId: REGIONS.PELVIS },
    // Station 1: Sub-trochanteric pelvis / gluteal curve
    { x: 0, y: hipY - 0.020, z: -0.018, rx: params.pelvisWidth * 0.78, rz: params.pelvisDepth * 0.90, regionId: REGIONS.PELVIS },
    // Station 2: Hip joint level / greater trochanter (maximum pelvic width)
    { x: 0, y: hipY, z: -0.020, rx: params.pelvisWidth * 0.88, rz: params.pelvisDepth * 0.95, regionId: REGIONS.PELVIS },
    // Station 3: Iliac crest (flaring hip bone)
    { x: 0, y: hipY + 0.035, z: -0.012, rx: params.pelvisWidth * 0.90, rz: params.pelvisDepth * 0.88, regionId: REGIONS.PELVIS },
    // Station 4: Lower flank transition
    { x: 0, y: hipY + (waistY - hipY) * 0.55, z: -0.005, rx: params.waistWidth * 1.05, rz: params.waistDepth * 0.95, regionId: REGIONS.PELVIS },

    // --- Waist & Lumbar Spine (Lumbar lordosis: arches forward into +Z) ---
    // Station 5: Lower waist
    { x: 0, y: waistY - 0.025, z: 0.003, rx: params.waistWidth * 0.96, rz: params.waistDepth * 0.92, regionId: REGIONS.SPINE },
    // Station 6: Narrowest waist / navel level
    { x: 0, y: waistY, z: 0.008, rx: params.waistWidth * 0.90, rz: params.waistDepth * 0.86, regionId: REGIONS.SPINE },
    // Station 7: Upper waist inflection
    { x: 0, y: waistY + 0.025, z: 0.006, rx: params.waistWidth * 0.95, rz: params.waistDepth * 0.90, regionId: REGIONS.SPINE },

    // --- Torso & Lower Ribcage Transition ---
    // Station 8: Lower ribcage margin
    { x: 0, y: waistY + (chestY - waistY) * 0.40, z: 0.008, rx: params.chestWidth * 0.85, rz: params.chestDepth * 0.86, regionId: REGIONS.TORSO },
    // Station 9: Mid ribcage
    { x: 0, y: waistY + (chestY - waistY) * 0.75, z: 0.010, rx: params.chestWidth * 0.92, rz: params.chestDepth * 0.92, regionId: REGIONS.TORSO },

    // --- Chest & Pectoral Girdle (Thoracic Kyphosis & athletic pectoral swell) ---
    // Station 10: Chest / pectoral apex
    { x: 0, y: chestY, z: 0.012, rx: params.chestWidth * 0.98, rz: params.chestDepth * 0.98, regionId: REGIONS.CHEST },
    // Station 11: Upper pectorals / axillary fold
    { x: 0, y: chestY + (shoulderY - chestY) * 0.55, z: 0.008, rx: params.chestWidth * 0.94, rz: params.chestDepth * 0.90, regionId: REGIONS.CHEST },
    // Station 12: Clavicular girdle at shoulder level (nests deltoids cleanly)
    { x: 0, y: shoulderY, z: 0.002, rx: shoulderHalf * 0.85, rz: params.chestDepth * 0.85, regionId: REGIONS.CHEST },
    // Station 13: Trapezius slope (smooth angle from neck to shoulder)
    { x: 0, y: shoulderY + (neckY - shoulderY) * 0.50, z: -0.004, rx: shoulderHalf * 0.58, rz: params.chestDepth * 0.75, regionId: REGIONS.CHEST },

    // --- Neck (Cervical column with gentle forward slant) ---
    // Station 14: Neck base / C7 vertebra & suprasternal notch
    { x: 0, y: neckY, z: -0.008, rx: params.neckThickness * 0.86, rz: params.neckThickness * 0.90, regionId: REGIONS.NECK },
    // Station 15: Mid neck
    { x: 0, y: neckY + (chinY - neckY) * 0.45, z: -0.003, rx: params.neckThickness * 0.80, rz: params.neckThickness * 0.84, regionId: REGIONS.NECK },
    // Station 16: Upper neck / throat transition
    { x: 0, y: chinY - 0.005, z: 0.004, rx: params.neckThickness * 0.78, rz: params.neckThickness * 0.80, regionId: REGIONS.NECK },

    // --- Head (Anatomical cranial ellipsoid with defined jawline & chin) ---
    // Station 17: Submandibular chin shelf
    { x: 0, y: chinY + 0.015, z: 0.022, rx: headRx * 0.55, rz: headRz * 0.68, regionId: REGIONS.HEAD },
    // Station 18: Mandible jawline & oral region
    { x: 0, y: chinY + 0.045, z: 0.016, rx: headRx * 0.74, rz: headRz * 0.80, regionId: REGIONS.HEAD },
    // Station 19: Cheekbones & maxilla
    { x: 0, y: chinY + 0.080, z: 0.008, rx: headRx * 0.90, rz: headRz * 0.90, regionId: REGIONS.HEAD },
    // Station 20: Brow ridge, temples, eye level
    { x: 0, y: headCenterY, z: 0.002, rx: headRx * 0.96, rz: headRz * 0.96, regionId: REGIONS.HEAD },
    // Station 21: Forehead & upper temples
    { x: 0, y: headCenterY + 0.035, z: -0.004, rx: headRx * 0.92, rz: headRz * 0.94, regionId: REGIONS.HEAD },
    // Station 22: Parietal cranium / upper vault
    { x: 0, y: headCenterY + 0.065, z: -0.009, rx: headRx * 0.78, rz: headRz * 0.82, regionId: REGIONS.HEAD },
    // Station 23: Pre-apex crown rounding
    { x: 0, y: headApexY - 0.012, z: -0.010, rx: headRx * 0.45, rz: headRz * 0.48, regionId: REGIONS.HEAD },
    // Station 24: Cranial apex cap
    { x: 0, y: headApexY, z: -0.010, rx: 0.015, rz: 0.015, regionId: REGIONS.HEAD }
  ];

  buildLoft({
    stations: axialStations,
    radialSegments: torsoSeg,
    regionId: REGIONS.TORSO,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 2. LEFT ARM (Shoulder -> Elbow -> Wrist -> Hand)
  // Athletic proportion with true spherical deltoid dome centered at sL
  // -------------------------------------------------------------
  const sL = landmarks['shoulder.L'];
  const eL = landmarks['elbow.L'];
  const wL = landmarks['wrist.L'];
  const hL = landmarks['hand.L'];
  const armThick = 0.026 * H * params.armMass;
  const R_arm = armThick;

  const armLPoints = [
    // True spherical deltoid dome centered at glenohumeral pivot sL
    { x: sL.x, y: sL.y + R_arm * 0.966, z: sL.z, rx: R_arm * 0.26, rz: R_arm * 0.26, regionId: REGIONS.UPPER_ARM_L },
    { x: sL.x, y: sL.y + R_arm * 0.819, z: sL.z, rx: R_arm * 0.57, rz: R_arm * 0.57, regionId: REGIONS.UPPER_ARM_L },
    { x: sL.x, y: sL.y + R_arm * 0.500, z: sL.z, rx: R_arm * 0.866, rz: R_arm * 0.866, regionId: REGIONS.UPPER_ARM_L },
    { x: sL.x, y: sL.y, z: sL.z, rx: R_arm, rz: R_arm, regionId: REGIONS.UPPER_ARM_L },
    // Shaft of upper arm
    { x: sL.x + (eL.x - sL.x) * 0.40, y: sL.y + (eL.y - sL.y) * 0.40, z: sL.z, rx: R_arm * 0.92, rz: R_arm * 0.90, regionId: REGIONS.UPPER_ARM_L },
    { x: sL.x + (eL.x - sL.x) * 0.75, y: sL.y + (eL.y - sL.y) * 0.75, z: sL.z, rx: R_arm * 0.84, rz: R_arm * 0.84, regionId: REGIONS.UPPER_ARM_L },
    // Elbow deformation cluster (3 rings clustered within +-2.0cm)
    { x: eL.x, y: eL.y + 0.020, z: eL.z, rx: R_arm * 0.78, rz: R_arm * 0.78, regionId: REGIONS.UPPER_ARM_L },
    { x: eL.x, y: eL.y, z: eL.z, rx: R_arm * 0.74, rz: R_arm * 0.74, regionId: REGIONS.LOWER_ARM_L },
    { x: eL.x, y: eL.y - 0.020, z: eL.z, rx: R_arm * 0.76, rz: R_arm * 0.76, regionId: REGIONS.LOWER_ARM_L },
    // Forearm muscular swell (brachioradialis bulge)
    { x: eL.x + (wL.x - eL.x) * 0.35, y: eL.y + (wL.y - eL.y) * 0.35, z: eL.z + 0.002, rx: R_arm * 0.80, rz: R_arm * 0.78, regionId: REGIONS.LOWER_ARM_L },
    { x: eL.x + (wL.x - eL.x) * 0.75, y: eL.y + (wL.y - eL.y) * 0.75, z: eL.z + 0.001, rx: R_arm * 0.62, rz: R_arm * 0.58, regionId: REGIONS.LOWER_ARM_L },
    // Wrist constriction
    { x: wL.x, y: wL.y, z: wL.z, rx: R_arm * 0.50, rz: R_arm * 0.42, regionId: REGIONS.LOWER_ARM_L },
    // Hand paddle (anatomical palm flattened in Z, slightly wider in X)
    { x: wL.x + (hL.x - wL.x) * 0.45, y: wL.y + (hL.y - wL.y) * 0.45, z: wL.z, rx: R_arm * 0.55, rz: R_arm * 0.28, regionId: REGIONS.HAND_L },
    { x: wL.x + (hL.x - wL.x) * 0.80, y: wL.y + (hL.y - wL.y) * 0.80, z: wL.z, rx: R_arm * 0.48, rz: R_arm * 0.22, regionId: REGIONS.HAND_L },
    { x: hL.x, y: hL.y, z: hL.z, rx: R_arm * 0.25, rz: R_arm * 0.12, regionId: REGIONS.HAND_L }
  ];

  buildLimbTube({
    points: armLPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 3. RIGHT ARM (Mirrored X)
  // -------------------------------------------------------------
  const sR = landmarks['shoulder.R'];
  const eR = landmarks['elbow.R'];
  const wR = landmarks['wrist.R'];
  const hR = landmarks['hand.R'];

  const armRPoints = [
    { x: sR.x, y: sR.y + R_arm * 0.966, z: sR.z, rx: R_arm * 0.26, rz: R_arm * 0.26, regionId: REGIONS.UPPER_ARM_R },
    { x: sR.x, y: sR.y + R_arm * 0.819, z: sR.z, rx: R_arm * 0.57, rz: R_arm * 0.57, regionId: REGIONS.UPPER_ARM_R },
    { x: sR.x, y: sR.y + R_arm * 0.500, z: sR.z, rx: R_arm * 0.866, rz: R_arm * 0.866, regionId: REGIONS.UPPER_ARM_R },
    { x: sR.x, y: sR.y, z: sR.z, rx: R_arm, rz: R_arm, regionId: REGIONS.UPPER_ARM_R },
    { x: sR.x + (eR.x - sR.x) * 0.40, y: sR.y + (eR.y - sR.y) * 0.40, z: sR.z, rx: R_arm * 0.92, rz: R_arm * 0.90, regionId: REGIONS.UPPER_ARM_R },
    { x: sR.x + (eR.x - sR.x) * 0.75, y: sR.y + (eR.y - sR.y) * 0.75, z: sR.z, rx: R_arm * 0.84, rz: R_arm * 0.84, regionId: REGIONS.UPPER_ARM_R },
    { x: eR.x, y: eR.y + 0.020, z: eR.z, rx: R_arm * 0.78, rz: R_arm * 0.78, regionId: REGIONS.UPPER_ARM_R },
    { x: eR.x, y: eR.y, z: eR.z, rx: R_arm * 0.74, rz: R_arm * 0.74, regionId: REGIONS.LOWER_ARM_R },
    { x: eR.x, y: eR.y - 0.020, z: eR.z, rx: R_arm * 0.76, rz: R_arm * 0.76, regionId: REGIONS.LOWER_ARM_R },
    { x: eR.x + (wR.x - eR.x) * 0.35, y: eR.y + (wR.y - eR.y) * 0.35, z: eR.z + 0.002, rx: R_arm * 0.80, rz: R_arm * 0.78, regionId: REGIONS.LOWER_ARM_R },
    { x: eR.x + (wR.x - eR.x) * 0.75, y: eR.y + (wR.y - eR.y) * 0.75, z: eR.z + 0.001, rx: R_arm * 0.62, rz: R_arm * 0.58, regionId: REGIONS.LOWER_ARM_R },
    { x: wR.x, y: wR.y, z: wR.z, rx: R_arm * 0.50, rz: R_arm * 0.42, regionId: REGIONS.LOWER_ARM_R },
    { x: wR.x + (hR.x - wR.x) * 0.45, y: wR.y + (hR.y - wR.y) * 0.45, z: wR.z, rx: R_arm * 0.55, rz: R_arm * 0.28, regionId: REGIONS.HAND_R },
    { x: wR.x + (hR.x - wR.x) * 0.80, y: wR.y + (hR.y - wR.y) * 0.80, z: wR.z, rx: R_arm * 0.48, rz: R_arm * 0.22, regionId: REGIONS.HAND_R },
    { x: hR.x, y: hR.y, z: hR.z, rx: R_arm * 0.25, rz: R_arm * 0.12, regionId: REGIONS.HAND_R }
  ];

  buildLimbTube({
    points: armRPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 4. LEFT LEG (Hip -> Knee -> Ankle)
  // Continuous tube with true spherical femoral head dome centered at hipL
  // -------------------------------------------------------------
  const hipL = landmarks['hip.L'];
  const kneeL = landmarks['knee.L'];
  const ankL = landmarks['ankle.L'];
  const heelL = landmarks['heel.L'];
  const toeL = landmarks['toe.L'];
  const legThick = 0.038 * H * params.legMass;
  const R_hip = legThick * 0.75;

  const legLPoints = [
    // True spherical femoral head dome centered at acetabular pivot hipL
    { x: hipL.x, y: hipL.y + R_hip * 0.966, z: hipL.z, rx: R_hip * 0.26, rz: R_hip * 0.26, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y + R_hip * 0.819, z: hipL.z, rx: R_hip * 0.57, rz: R_hip * 0.57, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y + R_hip * 0.500, z: hipL.z, rx: R_hip * 0.866, rz: R_hip * 0.866, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y, z: hipL.z, rx: R_hip, rz: R_hip, regionId: REGIONS.THIGH_L },
    // Subtrochanteric cluster / upper thigh
    { x: hipL.x, y: hipL.y - 0.025, z: hipL.z + 0.003, rx: legThick * 0.86, rz: legThick * 0.86, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y - 0.060, z: hipL.z + 0.005, rx: legThick * 0.84, rz: legThick * 0.84, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y + (kneeL.y - hipL.y) * 0.40, z: hipL.z + 0.004, rx: legThick * 0.80, rz: legThick * 0.80, regionId: REGIONS.THIGH_L },
    { x: hipL.x, y: hipL.y + (kneeL.y - hipL.y) * 0.75, z: hipL.z + 0.002, rx: legThick * 0.72, rz: legThick * 0.72, regionId: REGIONS.THIGH_L },
    // Knee deformation cluster (3 rings clustered within +-2.5cm)
    { x: kneeL.x, y: kneeL.y + 0.025, z: kneeL.z - 0.002, rx: legThick * 0.65, rz: legThick * 0.65, regionId: REGIONS.THIGH_L },
    { x: kneeL.x, y: kneeL.y, z: kneeL.z, rx: legThick * 0.62, rz: legThick * 0.62, regionId: REGIONS.SHIN_L },
    { x: kneeL.x, y: kneeL.y - 0.025, z: kneeL.z - 0.002, rx: legThick * 0.60, rz: legThick * 0.60, regionId: REGIONS.SHIN_L },
    // Shin & Calf muscular swell (gastrocnemius swells backward into -Z)
    { x: kneeL.x, y: kneeL.y + (ankL.y - kneeL.y) * 0.35, z: ankL.z - 0.010, rx: legThick * 0.66, rz: legThick * 0.72, regionId: REGIONS.SHIN_L },
    { x: kneeL.x, y: kneeL.y + (ankL.y - kneeL.y) * 0.70, z: ankL.z - 0.004, rx: legThick * 0.48, rz: legThick * 0.48, regionId: REGIONS.SHIN_L },
    // Supramalleolar lower shin
    { x: ankL.x, y: ankL.y + 0.020, z: ankL.z, rx: legThick * 0.42, rz: legThick * 0.40, regionId: REGIONS.SHIN_L },
    // Ankle base (enters foot talus)
    { x: ankL.x, y: ankL.y, z: ankL.z, rx: legThick * 0.38, rz: legThick * 0.36, regionId: REGIONS.SHIN_L }
  ];

  buildLimbTube({
    points: legLPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 5. LEFT FOOT (Heel -> Ankle Junction -> Instep Arch -> Ball -> Toes)
  // Anatomical longitudinal sole resting cleanly on ground plane Y = 0
  // -------------------------------------------------------------
  const footRx = legThick * 0.50;

  const footLPoints = [
    // Station 0: Posterior calcaneus heel curve
    { x: ankL.x, y: 0.024, z: heelL.z, rx: footRx * 0.75, rz: 0.022, regionId: REGIONS.FOOT_L },
    // Station 1: Calcaneus heel ground pad (flat on floor)
    { x: ankL.x, y: 0.022, z: heelL.z * 0.65, rx: footRx * 0.90, rz: 0.022, regionId: REGIONS.FOOT_L },
    // Station 2: Subtalar ankle base (junction with leg)
    { x: ankL.x, y: 0.038, z: 0.000, rx: footRx * 1.05, rz: 0.038, regionId: REGIONS.FOOT_L },
    // Station 3: Medial longitudinal arch
    { x: ankL.x, y: 0.028, z: toeL.z * 0.35, rx: footRx * 1.00, rz: 0.025, regionId: REGIONS.FOOT_L },
    // Station 4: Metatarsal heads / Ball of foot (flat on floor)
    { x: ankL.x, y: 0.020, z: toeL.z * 0.70, rx: footRx * 1.08, rz: 0.020, regionId: REGIONS.FOOT_L },
    // Station 5: Phalanges
    { x: ankL.x, y: 0.015, z: toeL.z * 0.92, rx: footRx * 0.85, rz: 0.015, regionId: REGIONS.FOOT_L },
    // Station 6: Distal toe tip
    { x: ankL.x, y: 0.012, z: toeL.z, rx: footRx * 0.50, rz: 0.012, regionId: REGIONS.FOOT_L }
  ];

  buildLimbTube({
    points: footLPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 6. RIGHT LEG (Mirrored X)
  // -------------------------------------------------------------
  const hipR = landmarks['hip.R'];
  const kneeR = landmarks['knee.R'];
  const ankR = landmarks['ankle.R'];
  const heelR = landmarks['heel.R'];
  const toeR = landmarks['toe.R'];

  const legRPoints = [
    { x: hipR.x, y: hipR.y + R_hip * 0.966, z: hipR.z, rx: R_hip * 0.26, rz: R_hip * 0.26, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y + R_hip * 0.819, z: hipR.z, rx: R_hip * 0.57, rz: R_hip * 0.57, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y + R_hip * 0.500, z: hipR.z, rx: R_hip * 0.866, rz: R_hip * 0.866, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y, z: hipR.z, rx: R_hip, rz: R_hip, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y - 0.025, z: hipR.z + 0.003, rx: legThick * 0.86, rz: legThick * 0.86, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y - 0.060, z: hipR.z + 0.005, rx: legThick * 0.84, rz: legThick * 0.84, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y + (kneeR.y - hipR.y) * 0.40, z: hipR.z + 0.004, rx: legThick * 0.80, rz: legThick * 0.80, regionId: REGIONS.THIGH_R },
    { x: hipR.x, y: hipR.y + (kneeR.y - hipR.y) * 0.75, z: hipR.z + 0.002, rx: legThick * 0.72, rz: legThick * 0.72, regionId: REGIONS.THIGH_R },
    { x: kneeR.x, y: kneeR.y + 0.025, z: kneeR.z - 0.002, rx: legThick * 0.65, rz: legThick * 0.65, regionId: REGIONS.THIGH_R },
    { x: kneeR.x, y: kneeR.y, z: kneeR.z, rx: legThick * 0.62, rz: legThick * 0.62, regionId: REGIONS.SHIN_R },
    { x: kneeR.x, y: kneeR.y - 0.025, z: kneeR.z - 0.002, rx: legThick * 0.60, rz: legThick * 0.60, regionId: REGIONS.SHIN_R },
    { x: kneeR.x, y: kneeR.y + (ankR.y - kneeR.y) * 0.35, z: ankR.z - 0.010, rx: legThick * 0.66, rz: legThick * 0.72, regionId: REGIONS.SHIN_R },
    { x: kneeR.x, y: kneeR.y + (ankR.y - kneeR.y) * 0.70, z: ankR.z - 0.004, rx: legThick * 0.48, rz: legThick * 0.48, regionId: REGIONS.SHIN_R },
    { x: ankR.x, y: ankR.y + 0.020, z: ankR.z, rx: legThick * 0.42, rz: legThick * 0.40, regionId: REGIONS.SHIN_R },
    { x: ankR.x, y: ankR.y, z: ankR.z, rx: legThick * 0.38, rz: legThick * 0.36, regionId: REGIONS.SHIN_R }
  ];

  buildLimbTube({
    points: legRPoints,
    radialSegments: limbSeg,
    capStart: true,
    capEnd: true,
    positions, normals, uvs, regionIds, indices
  });

  // -------------------------------------------------------------
  // 7. RIGHT FOOT (Mirrored X)
  // -------------------------------------------------------------
  const footRPoints = [
    { x: ankR.x, y: 0.024, z: heelR.z, rx: footRx * 0.75, rz: 0.022, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: 0.022, z: heelR.z * 0.65, rx: footRx * 0.90, rz: 0.022, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: 0.038, z: 0.000, rx: footRx * 1.05, rz: 0.038, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: 0.028, z: toeR.z * 0.35, rx: footRx * 1.00, rz: 0.025, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: 0.020, z: toeR.z * 0.70, rx: footRx * 1.08, rz: 0.020, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: 0.015, z: toeR.z * 0.92, rx: footRx * 0.85, rz: 0.015, regionId: REGIONS.FOOT_R },
    { x: ankR.x, y: 0.012, z: toeR.z, rx: footRx * 0.50, rz: 0.012, regionId: REGIONS.FOOT_R }
  ];

  buildLimbTube({
    points: footRPoints,
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

  // Compute face-weighted normals
  geometry.computeVertexNormals();

  // Smooth normals across duplicate UV seam vertices (u=0 and u=1)
  const normAttr = geometry.getAttribute('normal');
  const posAttr = geometry.getAttribute('position');
  const keyMap = new Map();
  for (let i = 0; i < posAttr.count; i++) {
    const kx = Math.round(posAttr.getX(i) * 10000);
    const ky = Math.round(posAttr.getY(i) * 10000);
    const kz = Math.round(posAttr.getZ(i) * 10000);
    const key = `${kx},${ky},${kz}`;
    let list = keyMap.get(key);
    if (!list) {
      list = [];
      keyMap.set(key, list);
    }
    list.push(i);
  }
  for (const list of keyMap.values()) {
    if (list.length > 1) {
      let nx = 0, ny = 0, nz = 0;
      for (const idx of list) {
        nx += normAttr.getX(idx);
        ny += normAttr.getY(idx);
        nz += normAttr.getZ(idx);
      }
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      for (const idx of list) {
        normAttr.setXYZ(idx, nx, ny, nz);
      }
    }
  }
  normAttr.needsUpdate = true;

  return {
    geometry,
    rawData: {
      positions: posArray,
      normals: normAttr.array,
      uvs: uvArray,
      regionIds: regionArray,
      indices: indexArray,
      vertexCount: positions.length / 3,
      triangleCount: indices.length / 3
    }
  };
}
