/**
 * My Game Engine 1.0 — MeshIR Authoring Operations
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The generic modeling verbs authorized for AI-ASSET-FOUNDATION-001. These are
 * GENERATING operations: each constructs correct geometry directly rather than
 * editing existing topology.
 *
 * IMPORTANT SCOPE NOTE. MeshIR v1 stores split vertices, exactly as render
 * geometry does, so that face-specific normals and UVs survive. v1 therefore
 * buys part semantics, anchors and artifact identity — it does NOT solve
 * topology. Topology-aware operations (bevel, chamfer, boolean, subdivision,
 * remesh) are explicitly out of scope and require a representation that
 * preserves connectivity. See the topology law in `Next step.md` section 5.
 *
 * This module must never import 'three'.
 */

import { createDiagnostic } from '../runtime/index.js';
import {
  createMesh,
  createPart,
  computeRangeBounds,
  OPTIONAL_ATTRIBUTES,
  ATTRIBUTE_ITEM_SIZE,
  ATTRIBUTE_MERGE_DEFAULTS,
  normalizeZero,
  QUATERNION_UNIT_TOLERANCE
} from './mesh.js';
import { transformAnchor } from './anchors.js';

/**
 * Requires a non-empty semantic name. Anonymous parts are refused at every
 * entry point, not merely discouraged.
 *
 * @param {string} semanticName
 * @param {string} context
 * @returns {string}
 */
function requireSemanticName(semanticName, context) {
  if (!semanticName || typeof semanticName !== 'string' || semanticName.trim() === '') {
    throw new Error(
      `${context} requires a semanticName. Anonymous parts (part_0, part_1, ...) are refused: ` +
      'the part table exists so generated content can be measured and revised by name.'
    );
  }
  return semanticName;
}

/**
 * Builds a single-part MeshIR from raw arrays.
 *
 * @param {object} options
 * @returns {object} MeshIR.
 */
function singlePartMesh({
  id,
  semanticName,
  positions,
  normals,
  uvs,
  indices,
  regionId,
  surfaceId,
  materialId,
  anchors = [],
  diagnostics = []
}) {
  const vertexTotal = positions.length / 3;
  const regionIds = new Uint16Array(vertexTotal).fill(regionId ?? 0);
  const surfaceIds = new Uint16Array(vertexTotal).fill(surfaceId ?? 0);

  return createMesh({
    id,
    attributes: {
      position: Float32Array.from(positions),
      normal: Float32Array.from(normals),
      uv: Float32Array.from(uvs),
      regionId: regionIds,
      surfaceId: surfaceIds
    },
    indices: Uint32Array.from(indices),
    parts: [createPart({
      id: semanticName,
      semanticName,
      indexStart: 0,
      indexCount: indices.length,
      regionId: regionId ?? null,
      surfaceId: surfaceId ?? null,
      materialId: materialId ?? null
    })],
    anchors,
    diagnostics
  });
}

/**
 * Creates an axis-aligned box as a single-part MeshIR.
 *
 * Face order, corner order, UV layout and winding deliberately match the
 * accepted legacy `buildBoxGeometry`, so conformance evidence can pin the two
 * representations together before any migration is considered.
 *
 * @param {object} options
 * @param {number} [options.width=1]
 * @param {number} [options.height=1]
 * @param {number} [options.depth=1]
 * @param {object} [options.origin={x:0,y:0,z:0}] - Center position.
 * @param {string} options.semanticName - Required.
 * @returns {object} MeshIR.
 */
export function createBoxMesh({
  width = 1,
  height = 1,
  depth = 1,
  origin = { x: 0, y: 0, z: 0 },
  semanticName,
  id = null,
  regionId = 0,
  surfaceId = 0,
  materialId = null,
  anchors = []
} = {}) {
  requireSemanticName(semanticName, 'createBoxMesh');

  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  const ox = origin.x || 0;
  const oy = origin.y || 0;
  const oz = origin.z || 0;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const faces = [
    { norm: [0, 0, 1], corners: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
    { norm: [0, 0, -1], corners: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
    { norm: [0, 1, 0], corners: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
    { norm: [0, -1, 0], corners: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] },
    { norm: [1, 0, 0], corners: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
    { norm: [-1, 0, 0], corners: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] }
  ];
  const faceUVs = [[0, 0], [1, 0], [1, 1], [0, 1]];

  let vertOffset = 0;
  for (const face of faces) {
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i];
      positions.push(c[0] + ox, c[1] + oy, c[2] + oz);
      normals.push(face.norm[0], face.norm[1], face.norm[2]);
      uvs.push(faceUVs[i][0], faceUVs[i][1]);
    }
    indices.push(vertOffset, vertOffset + 1, vertOffset + 2);
    indices.push(vertOffset, vertOffset + 2, vertOffset + 3);
    vertOffset += 4;
  }

  return singlePartMesh({
    id: id ?? `box:${semanticName}`,
    semanticName, positions, normals, uvs, indices,
    regionId, surfaceId, materialId, anchors
  });
}

/**
 * Creates a cylinder as a single-part MeshIR.
 *
 * Layout matches the accepted legacy `buildCylinderGeometry`: side body first,
 * then the top cap, then an optional bottom cap. `origin.y` is the base, not
 * the center.
 *
 * @param {object} options
 * @returns {object} MeshIR.
 */
export function createCylinderMesh({
  radiusTop = 0.5,
  radiusBottom = 0.5,
  height = 2,
  radialSegments = 16,
  origin = { x: 0, y: 0, z: 0 },
  semanticName,
  id = null,
  regionId = 0,
  surfaceId = 0,
  materialId = null,
  cappedBottom = true,
  anchors = []
} = {}) {
  requireSemanticName(semanticName, 'createCylinderMesh');

  const ox = origin.x || 0;
  const oy = origin.y || 0;
  const oz = origin.z || 0;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let yStep = 0; yStep <= 1; yStep++) {
    const y = yStep === 0 ? oy : oy + height;
    const r = yStep === 0 ? radiusBottom : radiusTop;
    for (let s = 0; s <= radialSegments; s++) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      positions.push(ox + r * cos, y, oz + r * sin);
      normals.push(cos, 0, sin);
      uvs.push(u, yStep);
    }
  }

  const stride = radialSegments + 1;
  for (let s = 0; s < radialSegments; s++) {
    indices.push(s, s + 1, s + stride);
    indices.push(s + 1, s + stride + 1, s + stride);
  }

  // Top cap.
  const topCenterIdx = positions.length / 3;
  positions.push(ox, oy + height, oz);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  const topStartIdx = positions.length / 3;
  for (let s = 0; s <= radialSegments; s++) {
    const theta = (s / radialSegments) * Math.PI * 2;
    positions.push(ox + radiusTop * Math.cos(theta), oy + height, oz + radiusTop * Math.sin(theta));
    normals.push(0, 1, 0);
    uvs.push(0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta));
  }
  for (let s = 0; s < radialSegments; s++) {
    indices.push(topCenterIdx, topStartIdx + s + 1, topStartIdx + s);
  }

  if (cappedBottom) {
    const bottomCenterIdx = positions.length / 3;
    positions.push(ox, oy, oz);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0.5);
    const bottomStartIdx = positions.length / 3;
    for (let s = 0; s <= radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      positions.push(ox + radiusBottom * Math.cos(theta), oy, oz + radiusBottom * Math.sin(theta));
      normals.push(0, -1, 0);
      uvs.push(0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta));
    }
    for (let s = 0; s < radialSegments; s++) {
      indices.push(bottomCenterIdx, bottomStartIdx + s, bottomStartIdx + s + 1);
    }
  }

  return singlePartMesh({
    id: id ?? `cylinder:${semanticName}`,
    semanticName, positions, normals, uvs, indices,
    regionId, surfaceId, materialId, anchors
  });
}

/**
 * Signed area of a 2D polygon. Positive means counter-clockwise.
 *
 * @param {Array<number[]>} profile
 * @returns {number}
 */
function signedArea(profile) {
  let area = 0;
  for (let i = 0; i < profile.length; i++) {
    const [x0, y0] = profile[i];
    const [x1, y1] = profile[(i + 1) % profile.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

/**
 * Reports whether a counter-clockwise polygon is convex.
 *
 * @param {Array<number[]>} profile
 * @returns {boolean}
 */
function isConvex(profile) {
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = profile[i];
    const [bx, by] = profile[(i + 1) % n];
    const [cx, cy] = profile[(i + 2) % n];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cross < -1e-9) return false;
  }
  return true;
}

/**
 * Extrudes a 2D profile along +Z into a single-part MeshIR.
 *
 * The profile lies in the XY plane. Winding is normalized to counter-clockwise;
 * a reversal is reported as a diagnostic rather than applied silently.
 *
 * Caps use fan triangulation, which is only correct for convex profiles. A
 * non-convex profile with caps requested FAILS CLOSED with a structured
 * diagnostic rather than emitting wrong geometry. Compose concave shapes from
 * several convex extrusions and merge them — that is the correct engine answer
 * until a topology-aware representation is earned.
 *
 * @param {object} options
 * @param {Array<number[]>} options.profile - [[x, y], ...], at least 3 points.
 * @param {number} [options.distance=1] - Extrusion length along +Z.
 * @param {string} options.semanticName - Required.
 * @returns {object} MeshIR.
 */
export function extrudeProfile({
  profile,
  distance = 1,
  origin = { x: 0, y: 0, z: 0 },
  semanticName,
  id = null,
  regionId = 0,
  surfaceId = 0,
  materialId = null,
  capStart = true,
  capEnd = true,
  anchors = []
} = {}) {
  requireSemanticName(semanticName, 'extrudeProfile');

  if (!Array.isArray(profile) || profile.length < 3) {
    throw new Error('extrudeProfile requires a profile of at least 3 points');
  }
  for (const point of profile) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
      throw new Error('extrudeProfile profile points must be finite [x, y] pairs');
    }
  }
  if (!Number.isFinite(distance) || distance === 0) {
    throw new Error('extrudeProfile requires a finite non-zero distance');
  }

  const diagnostics = [];
  let points = profile.map(([x, y]) => [x, y]);
  if (signedArea(points) < 0) {
    points = points.slice().reverse();
    diagnostics.push(createDiagnostic({
      severity: 'INFO',
      code: 'EXTRUDE_WINDING_NORMALIZED',
      step: 'extrudeProfile',
      subsystem: 'meshir',
      message: `Profile for "${semanticName}" was clockwise and has been normalized to counter-clockwise`,
      data: { semanticName }
    }));
  }

  const wantsCap = capStart || capEnd;
  if (wantsCap && !isConvex(points)) {
    const error = new Error(
      `extrudeProfile cannot cap the non-convex profile for "${semanticName}". ` +
      'Fan triangulation would produce incorrect geometry. Either set capStart/capEnd to false, ' +
      'or compose the shape from several convex extrusions and mergeMeshIR them.'
    );
    error.diagnostics = [createDiagnostic({
      severity: 'ERROR',
      code: 'EXTRUDE_NON_CONVEX_CAP',
      step: 'extrudeProfile',
      subsystem: 'meshir',
      message: error.message,
      data: { semanticName, pointCount: points.length }
    })];
    throw error;
  }

  const ox = origin.x || 0;
  const oy = origin.y || 0;
  const oz = origin.z || 0;

  // A negative distance would invert every side normal. Normalize it to a
  // positive extrusion starting further back, and report the correction rather
  // than shipping inward-facing walls.
  let z0 = oz;
  let z1 = oz + distance;
  if (distance < 0) {
    z0 = oz + distance;
    z1 = oz;
    diagnostics.push(createDiagnostic({
      severity: 'INFO',
      code: 'EXTRUDE_DISTANCE_NORMALIZED',
      step: 'extrudeProfile',
      subsystem: 'meshir',
      message: `Negative extrusion distance for "${semanticName}" was normalized to a positive extrusion from z=${z0}`,
      data: { semanticName, requestedDistance: distance }
    }));
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const n = points.length;

  // Perimeter parameterization for side UVs.
  const edgeLengths = [];
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    const len = Math.hypot(bx - ax, by - ay);
    edgeLengths.push(len);
    perimeter += len;
  }

  // Side walls: one split quad per edge so each face keeps its own normal.
  let uRun = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;

    const u0 = perimeter > 0 ? uRun / perimeter : 0;
    uRun += edgeLengths[i];
    const u1 = perimeter > 0 ? uRun / perimeter : 1;

    const base = positions.length / 3;
    positions.push(ox + ax, oy + ay, z0);
    positions.push(ox + bx, oy + by, z0);
    positions.push(ox + bx, oy + by, z1);
    positions.push(ox + ax, oy + ay, z1);
    for (let k = 0; k < 4; k++) normals.push(nx, ny, 0);
    uvs.push(u0, 0, u1, 0, u1, 1, u0, 1);

    indices.push(base, base + 1, base + 2);
    indices.push(base, base + 2, base + 3);
  }

  // Cap UV normalization over the profile bounding box.
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  if (capEnd) {
    const base = positions.length / 3;
    for (const [x, y] of points) {
      positions.push(ox + x, oy + y, z1);
      normals.push(0, 0, 1);
      uvs.push((x - minX) / spanX, (y - minY) / spanY);
    }
    for (let i = 1; i < n - 1; i++) {
      indices.push(base, base + i, base + i + 1);
    }
  }

  if (capStart) {
    const base = positions.length / 3;
    for (const [x, y] of points) {
      positions.push(ox + x, oy + y, z0);
      normals.push(0, 0, -1);
      uvs.push((x - minX) / spanX, (y - minY) / spanY);
    }
    for (let i = 1; i < n - 1; i++) {
      indices.push(base, base + i + 1, base + i);
    }
  }

  return singlePartMesh({
    id: id ?? `extrude:${semanticName}`,
    semanticName, positions, normals, uvs, indices,
    regionId, surfaceId, materialId, anchors, diagnostics
  });
}

/**
 * Validates a TRS transform, failing closed on anything this tranche does not
 * correctly support.
 *
 * Mirroring is REFUSED rather than silently accepted. A negative scale flips
 * triangle winding and inverts surface orientation; supporting it correctly
 * means re-winding indices and re-deriving normals and anchor frames, which is
 * work this tranche did not authorize. Silently producing inside-out geometry
 * would be worse than refusing.
 *
 * @param {object} transform
 * @returns {object} The validated transform.
 */
export function validateTransform({ translation, rotation, scale }) {
  const finiteTriple = (value, name) => {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
      throw new TypeError(`transformMesh ${name} must be a finite [x, y, z]; received ${JSON.stringify(value)}`);
    }
  };

  finiteTriple(translation, 'translation');
  finiteTriple(scale, 'scale');

  for (const component of scale) {
    if (component === 0) {
      throw new RangeError(
        'transformMesh scale components must be non-zero. A zero scale collapses geometry to a ' +
        'degenerate plane or line and destroys normals.'
      );
    }
    if (component < 0) {
      throw new RangeError(
        'transformMesh refuses a negative scale. Mirroring flips triangle winding and surface ' +
        'orientation, and correct mirroring (re-winding indices, re-deriving normals and anchor ' +
        'frames) is out of scope for this tranche. Author the mirrored form directly instead.'
      );
    }
  }

  if (!Array.isArray(rotation) || rotation.length !== 4 || !rotation.every(Number.isFinite)) {
    throw new TypeError(`transformMesh rotation must be a finite quaternion [x, y, z, w]; received ${JSON.stringify(rotation)}`);
  }
  const length = Math.hypot(...rotation);
  if (Math.abs(length - 1) > QUATERNION_UNIT_TOLERANCE) {
    throw new RangeError(
      `transformMesh rotation must be a unit quaternion; |q| = ${length}. ` +
      'A non-unit quaternion scales geometry as a side effect of rotating it, which would make ' +
      'the transform silently lossy. Normalize it at the call site so the intent is explicit.'
    );
  }

  return { translation, rotation, scale };
}

/**
 * Applies a TRS transform to a MeshIR, producing a new MeshIR.
 *
 * The input is never mutated. Parts keep their index ranges and are re-measured;
 * anchors are transformed alongside the geometry so semantic frames stay
 * attached. Normals use the inverse-transpose of the scale so non-uniform
 * scaling does not shear lighting.
 *
 * @param {object} mesh
 * @param {object} transform - { translation, rotation, scale }
 * @returns {object} New MeshIR.
 */
export function transformMesh(mesh, {
  translation = [0, 0, 0],
  rotation = [0, 0, 0, 1],
  scale = [1, 1, 1]
} = {}) {
  validateTransform({ translation, rotation, scale });
  const src = mesh.attributes.position;
  const positions = new Float32Array(src.length);
  const [qx, qy, qz, qw] = rotation;

  const rotate = (x, y, z) => {
    const tx = 2 * (qy * z - qz * y);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (qx * y - qy * x);
    return [
      x + qw * tx + (qy * tz - qz * ty),
      y + qw * ty + (qz * tx - qx * tz),
      z + qw * tz + (qx * ty - qy * tx)
    ];
  };

  for (let i = 0; i < src.length; i += 3) {
    const [rx, ry, rz] = rotate(src[i] * scale[0], src[i + 1] * scale[1], src[i + 2] * scale[2]);
    positions[i] = normalizeZero(rx + translation[0]);
    positions[i + 1] = normalizeZero(ry + translation[1]);
    positions[i + 2] = normalizeZero(rz + translation[2]);
  }

  let normals = null;
  if (mesh.attributes.normal) {
    const srcN = mesh.attributes.normal;
    normals = new Float32Array(srcN.length);
    for (let i = 0; i < srcN.length; i += 3) {
      // Inverse-transpose for a diagonal scale is component-wise reciprocal.
      const ix = srcN[i] / scale[0];
      const iy = srcN[i + 1] / scale[1];
      const iz = srcN[i + 2] / scale[2];
      const [rx, ry, rz] = rotate(ix, iy, iz);
      const len = Math.hypot(rx, ry, rz) || 1;
      normals[i] = normalizeZero(rx / len);
      normals[i + 1] = normalizeZero(ry / len);
      normals[i + 2] = normalizeZero(rz / len);
    }
  }

  const indices = new Uint32Array(mesh.indices);
  const parts = mesh.parts.map((part) => createPart({
    ...part,
    bounds: computeRangeBounds(positions, indices, part.indexStart, part.indexCount)
  }));

  return createMesh({
    id: mesh.id,
    attributes: {
      position: positions,
      normal: normals,
      uv: mesh.attributes.uv ? new Float32Array(mesh.attributes.uv) : null,
      regionId: mesh.attributes.regionId ? new Uint16Array(mesh.attributes.regionId) : null,
      surfaceId: mesh.attributes.surfaceId ? new Uint16Array(mesh.attributes.surfaceId) : null
    },
    indices,
    parts,
    anchors: mesh.anchors.map((a) => transformAnchor(a, { translation, rotation, scale })),
    units: mesh.units,
    upAxis: mesh.upAxis,
    forwardAxis: mesh.forwardAxis,
    diagnostics: mesh.diagnostics
  });
}

/**
 * Merges several MeshIRs into one, concatenating part tables and anchors.
 *
 * Unlike the legacy `mergeSemanticGeometries`, this NEVER silently drops an
 * input. Duplicate part ids, duplicate anchor names and anonymous parts are
 * refused. An optional attribute present on some inputs but not others is
 * filled with a declared default and reported as a WARNING, so the substitution
 * is visible in diagnostics rather than invisible in the data.
 *
 * @param {Array<object>} meshes
 * @param {object} [options]
 * @param {string} [options.id]
 * @returns {object} New MeshIR.
 */
export function mergeMeshIR(meshes, { id = 'merged' } = {}) {
  if (!Array.isArray(meshes) || meshes.length === 0) {
    throw new Error('mergeMeshIR requires a non-empty array of MeshIR inputs');
  }
  for (const mesh of meshes) {
    if (!mesh || !mesh.attributes?.position || !mesh.indices) {
      throw new Error(
        'mergeMeshIR refuses an input without position and indices. ' +
        'Inputs are never skipped silently: fix or remove the input.'
      );
    }
  }

  // Coordinate conventions must agree. Silently inheriting the first input's
  // units or axes would merge metres with centimetres, or +Y-up with +Z-up,
  // into geometry that looks plausible and measures wrong — and every
  // downstream measurement in the manifest would then be a confident lie.
  const reference = meshes[0];
  for (const mesh of meshes.slice(1)) {
    for (const field of ['units', 'upAxis', 'forwardAxis']) {
      if (mesh[field] !== reference[field]) {
        throw new Error(
          `mergeMeshIR refuses inputs with mismatched ${field}: ` +
          `"${reference.id}" declares "${reference[field]}" but "${mesh.id}" declares "${mesh[field]}". ` +
          'Convert explicitly rather than letting the first input define the result.'
        );
      }
    }
  }

  const diagnostics = [];
  const present = {};
  for (const name of OPTIONAL_ATTRIBUTES) {
    const withAttr = meshes.filter((m) => m.attributes[name]).length;
    present[name] = withAttr > 0;
    if (withAttr > 0 && withAttr < meshes.length) {
      diagnostics.push(createDiagnostic({
        severity: 'WARNING',
        code: 'MERGE_ATTRIBUTE_FILLED',
        step: 'mergeMeshIR',
        subsystem: 'meshir',
        message: `Attribute "${name}" was present on ${withAttr}/${meshes.length} inputs; missing inputs filled with the declared default`,
        data: { attribute: name, present: withAttr, total: meshes.length, fill: ATTRIBUTE_MERGE_DEFAULTS[name] }
      }));
    }
  }

  let totalVerts = 0;
  let totalIndices = 0;
  for (const mesh of meshes) {
    totalVerts += mesh.attributes.position.length / 3;
    totalIndices += mesh.indices.length;
  }

  const out = {
    position: new Float32Array(totalVerts * 3),
    normal: present.normal ? new Float32Array(totalVerts * 3) : null,
    uv: present.uv ? new Float32Array(totalVerts * 2) : null,
    regionId: present.regionId ? new Uint16Array(totalVerts) : null,
    surfaceId: present.surfaceId ? new Uint16Array(totalVerts) : null
  };
  const indices = new Uint32Array(totalIndices);
  const parts = [];
  const anchors = [];
  const partIds = new Set();
  const anchorNames = new Set();

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const mesh of meshes) {
    const verts = mesh.attributes.position.length / 3;
    out.position.set(mesh.attributes.position, vertexOffset * 3);

    for (const name of OPTIONAL_ATTRIBUTES) {
      if (!present[name]) continue;
      const itemSize = ATTRIBUTE_ITEM_SIZE[name];
      const target = out[name];
      const source = mesh.attributes[name];
      if (source) {
        target.set(source, vertexOffset * itemSize);
      } else {
        const fill = ATTRIBUTE_MERGE_DEFAULTS[name];
        for (let v = 0; v < verts; v++) {
          for (let c = 0; c < itemSize; c++) {
            target[(vertexOffset + v) * itemSize + c] = fill[c];
          }
        }
      }
    }

    for (let i = 0; i < mesh.indices.length; i++) {
      indices[indexOffset + i] = mesh.indices[i] + vertexOffset;
    }

    for (const part of mesh.parts) {
      if (!part.semanticName || part.semanticName.trim() === '') {
        throw new Error(`mergeMeshIR refuses a part without a semanticName (from mesh "${mesh.id}")`);
      }
      if (partIds.has(part.id)) {
        throw new Error(
          `mergeMeshIR refuses duplicate part id "${part.id}". ` +
          'Part identity must stay unique so per-part evidence remains attributable.'
        );
      }
      partIds.add(part.id);
      parts.push(createPart({
        ...part,
        indexStart: part.indexStart + indexOffset,
        indexCount: part.indexCount,
        bounds: null
      }));
    }

    for (const anchor of mesh.anchors) {
      if (anchorNames.has(anchor.name)) {
        throw new Error(`mergeMeshIR refuses duplicate anchor name "${anchor.name}"`);
      }
      anchorNames.add(anchor.name);
      anchors.push(anchor);
    }

    vertexOffset += verts;
    indexOffset += mesh.indices.length;
  }

  const mergedDiagnostics = [...diagnostics];
  for (const mesh of meshes) mergedDiagnostics.push(...mesh.diagnostics);

  return createMesh({
    id,
    attributes: out,
    indices,
    parts,
    anchors,
    units: reference.units,
    upAxis: reference.upAxis,
    forwardAxis: reference.forwardAxis,
    diagnostics: mergedDiagnostics
  });
}

/**
 * Machine-readable descriptors for the authoring verbs.
 *
 * Colocated with the operations so the public authoring-surface descriptor
 * shares one source of truth. A separately maintained API registry would drift
 * and is forbidden. See `Next step.md` Decision 5.
 */

/** Parameters every single-part generator accepts, described once. */
const COMMON_GENERATOR_PARAMS = Object.freeze({
  semanticName: 'string, REQUIRED, non-empty. Becomes the part id and the name in every manifest measurement. Anonymous names such as "part_0" are refused.',
  id: 'string or null, default null. Mesh id; defaults to "<kind>:<semanticName>".',
  regionId: 'integer 0-65535, default 0. Per-vertex semantic region identity.',
  surfaceId: 'integer 0-65535, default 0. Per-vertex semantic surface identity.',
  materialId: 'string or null, default null. MaterialDefinition id; must be supplied to createPreviewable when set.',
  anchors: 'array of SemanticAnchor, default []. Positions are in this mesh\'s local space and are transformed with it.'
});

export const MESH_OP_DESCRIPTORS = Object.freeze([
  Object.freeze({
    name: 'createBoxMesh',
    summary: 'Axis-aligned box as a single named part. 12 triangles across 24 split vertices.',
    params: Object.freeze({
      width: 'number, metres, default 1. Extent along X.',
      height: 'number, metres, default 1. Extent along Y.',
      depth: 'number, metres, default 1. Extent along Z.',
      origin: '{x,y,z} metres, default {0,0,0}. The box CENTRE, not a corner.',
      ...COMMON_GENERATOR_PARAMS
    }),
    returns: 'MeshIR',
    constraints: 'Throws TypeError when semanticName is missing or blank.'
  }),
  Object.freeze({
    name: 'createCylinderMesh',
    summary: 'Cylinder or truncated cone as a single named part, extending along +Y from its base.',
    params: Object.freeze({
      radiusTop: 'number, metres, default 0.5.',
      radiusBottom: 'number, metres, default 0.5. Differs from radiusTop to make a cone.',
      height: 'number, metres, default 2. Extent along +Y.',
      radialSegments: 'integer, default 16. Higher is rounder and costs triangles.',
      origin: '{x,y,z} metres, default {0,0,0}. origin.y is the BASE, not the centre.',
      cappedBottom: 'boolean, default true. Set false to leave the base open where it is hidden.',
      ...COMMON_GENERATOR_PARAMS
    }),
    returns: 'MeshIR',
    constraints: 'Built along +Y. To point it along -Z (engine forward), transformMesh with a -90 degree rotation about X.'
  }),
  Object.freeze({
    name: 'extrudeProfile',
    summary: 'Extrudes a 2D profile in the XY plane along Z into a single named part.',
    params: Object.freeze({
      profile: 'array of [x,y] pairs, minimum 3, metres. Counter-clockwise; clockwise input is normalized and reported.',
      distance: 'number, metres, non-zero, default 1. Negative distance is normalized to a positive extrusion from a lower z, and reported.',
      origin: '{x,y,z} metres, default {0,0,0}. Profile offset; extrusion starts at origin.z.',
      capStart: 'boolean, default true. Cap at the starting z.',
      capEnd: 'boolean, default true. Cap at the ending z.',
      ...COMMON_GENERATOR_PARAMS
    }),
    returns: 'MeshIR',
    constraints:
      'Caps use fan triangulation and REQUIRE a convex profile. A non-convex profile with either cap requested throws ' +
      'EXTRUDE_NON_CONVEX_CAP rather than emitting wrong geometry. Either set capStart and capEnd false, or compose the ' +
      'shape from several convex extrusions and mergeMeshIR them.'
  }),
  Object.freeze({
    name: 'transformMesh',
    summary: 'Applies translation, rotation and scale, returning a new MeshIR. Pure: the input is never mutated. Anchors and part bounds move with the geometry.',
    params: Object.freeze({
      mesh: 'MeshIR, required, positional first argument.',
      translation: '[x,y,z] metres, finite, default [0,0,0].',
      rotation: '[x,y,z,w] quaternion, finite and UNIT length, default [0,0,0,1].',
      scale: '[x,y,z], finite and strictly positive, default [1,1,1].'
    }),
    returns: 'MeshIR',
    constraints:
      'Rejects a non-unit quaternion (it would scale as a side effect of rotating), a zero scale component (collapses ' +
      'geometry and destroys normals), and a NEGATIVE scale component. Mirroring is refused because it flips triangle ' +
      'winding and surface orientation, and correct mirroring is out of scope for this tranche. Author the mirrored form directly.'
  }),
  Object.freeze({
    name: 'mergeMeshIR',
    summary: 'Concatenates meshes, part tables and anchors into one MeshIR.',
    params: Object.freeze({
      meshes: 'array of MeshIR, non-empty, positional first argument.',
      id: 'string, default "merged". Id for the merged result.'
    }),
    returns: 'MeshIR',
    constraints:
      'Never skips an input silently. Refuses duplicate part ids, duplicate anchor names, anonymous parts, and inputs whose ' +
      'units, upAxis or forwardAxis disagree. An optional attribute present on some inputs but not others is filled with a ' +
      'declared default and reported as a MERGE_ATTRIBUTE_FILLED warning.'
  })
]);
