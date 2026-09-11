/**
 * My Game Engine 1.0 — MeshIR: Engine-Owned Authoring Geometry
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * MeshIR is the engine-owned authoring representation for generated geometry.
 * It is renderer-independent: this module must never import 'three'.
 *
 * Authoring geometry preserves construction truth, part identity, and semantic
 * anchors. Render geometry is a separate product produced by an explicitly
 * designated adapter boundary (src/render/mesh-adapter.js).
 *
 * See `Next step.md` sections 4, 5, 7.1 and Decision 6.
 */

import { createDiagnostic } from '../runtime/index.js';

/** Canonical MeshIR structural version. Bump only with a codec change. */
export const MESH_IR_VERSION = 1;

/** Default coordinate conventions for authored assets. */
export const MESH_UNITS = 'm';
export const MESH_UP_AXIS = '+Y';
export const MESH_FORWARD_AXIS = '-Z';

/**
 * Optional vertex attributes in canonical encoding order.
 * Order is part of the serialization contract; do not reorder.
 */
export const OPTIONAL_ATTRIBUTES = Object.freeze(['normal', 'uv', 'regionId', 'surfaceId']);

/** Components per vertex for each attribute. */
export const ATTRIBUTE_ITEM_SIZE = Object.freeze({
  position: 3,
  normal: 3,
  uv: 2,
  regionId: 1,
  surfaceId: 1
});

/** Defaults used when merging meshes with inconsistent optional attributes. */
export const ATTRIBUTE_MERGE_DEFAULTS = Object.freeze({
  normal: [0, 1, 0],
  uv: [0, 0],
  regionId: [0],
  surfaceId: [0]
});

/**
 * Describes a value's type for a diagnostic payload, without throwing on
 * anything a caller might hand in.
 *
 * @param {*} value
 * @returns {string}
 */
function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Normalizes negative zero to positive zero.
 * Required for byte-deterministic encoding: -0 and 0 compare equal but encode
 * to different bytes.
 *
 * @param {number} n
 * @returns {number}
 */
export function normalizeZero(n) {
  return n === 0 ? 0 : n;
}

/**
 * Tolerance for accepting a quaternion as unit length.
 *
 * THE AUTHORED TRS CONTRACT, shared by geometry and scene composition.
 *
 * A rotation quaternion must satisfy `|Math.hypot(...q) - 1| <= this`. A
 * non-unit quaternion scales as a side effect of rotating, so `[0, 0, 0.5,
 * 0.5]` combined with an authored scale of `[1, 1, 1]` silently shrinks by
 * 0.707. Both `transformMesh` and `validateSceneDefinition` reject that rather
 * than normalizing it, because normalizing would rewrite authored intent.
 *
 * It lives here, in the MeshIR core, so the two systems cannot drift onto
 * separately invented values.
 */
export const QUATERNION_UNIT_TOLERANCE = 1e-6;

/**
 * Reports whether every entry of an array-like is a finite number.
 *
 * @param {ArrayLike<number>} values
 * @returns {boolean}
 */
export function allFinite(values) {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) return false;
  }
  return true;
}

/**
 * Builds a bounds record from min/max component arrays.
 *
 * @param {number[]} min - [x, y, z]
 * @param {number[]} max - [x, y, z]
 * @returns {object} Frozen bounds record.
 */
export function createBounds(min, max) {
  const lo = [normalizeZero(min[0]), normalizeZero(min[1]), normalizeZero(min[2])];
  const hi = [normalizeZero(max[0]), normalizeZero(max[1]), normalizeZero(max[2])];
  return Object.freeze({
    min: Object.freeze(lo),
    max: Object.freeze(hi),
    center: Object.freeze([
      normalizeZero((lo[0] + hi[0]) / 2),
      normalizeZero((lo[1] + hi[1]) / 2),
      normalizeZero((lo[2] + hi[2]) / 2)
    ]),
    dimensions: Object.freeze([
      normalizeZero(hi[0] - lo[0]),
      normalizeZero(hi[1] - lo[1]),
      normalizeZero(hi[2] - lo[2])
    ])
  });
}

/**
 * Computes bounds over the vertices referenced by a range of the index buffer.
 * Measuring through the index range is what makes per-part bounds truthful:
 * a part owns triangles, not a contiguous slice of the vertex buffer.
 *
 * @param {Float32Array} positions
 * @param {Uint32Array} indices
 * @param {number} [indexStart=0]
 * @param {number} [indexCount=indices.length]
 * @returns {object} Bounds record.
 */
export function computeRangeBounds(positions, indices, indexStart = 0, indexCount = indices.length) {
  if (indexCount <= 0) {
    return createBounds([0, 0, 0], [0, 0, 0]);
  }
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = indexStart; i < indexStart + indexCount; i++) {
    const base = indices[i] * 3;
    const x = positions[base];
    const y = positions[base + 1];
    const z = positions[base + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return createBounds([minX, minY, minZ], [maxX, maxY, maxZ]);
}

/**
 * Builds a part record.
 *
 * `id` and `semanticName` are enforced HERE, at the public construction
 * boundary, not only in validation. The law is that anonymous parts are refused
 * at every entry point; leaving construction permissive while only validation
 * refused them made the implementation contradict its own stated law.
 *
 * `bounds` is DERIVED data, not authored source. Callers may pass a
 * precomputed value, but `createMesh` re-derives every part's bounds from
 * positions, indices and the part's index range, so a false value can never
 * reach the manifest.
 *
 * @param {object} options
 * @returns {object} Frozen part record.
 */
export function createPart({
  id,
  semanticName,
  indexStart,
  indexCount,
  regionId = null,
  surfaceId = null,
  materialId = null,
  bounds = null
}) {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('createPart requires a non-empty string id');
  }
  if (!semanticName || typeof semanticName !== 'string' || semanticName.trim() === '') {
    throw new TypeError(
      `createPart requires a non-empty semanticName for part "${id}". ` +
      'Anonymous parts are refused: the part table exists so generated content can be ' +
      'measured and revised by name.'
    );
  }
  if (!Number.isInteger(indexStart) || indexStart < 0) {
    throw new TypeError(`createPart part "${id}" requires a non-negative integer indexStart`);
  }
  if (!Number.isInteger(indexCount) || indexCount <= 0) {
    throw new TypeError(`createPart part "${id}" requires a positive integer indexCount`);
  }
  return Object.freeze({
    id,
    semanticName,
    indexStart,
    indexCount,
    regionId,
    surfaceId,
    materialId,
    bounds
  });
}

/**
 * Constructs a MeshIR from raw attribute data.
 *
 * Parts must exactly partition the index buffer: every triangle belongs to
 * exactly one named part. That invariant is what makes per-part triangle
 * counts and bounds trustworthy evidence rather than an approximation.
 *
 * @param {object} options
 * @param {string} options.id
 * @param {object} options.attributes - { position, normal?, uv?, regionId?, surfaceId? }
 * @param {Uint32Array|number[]} options.indices
 * @param {Array<object>} options.parts
 * @param {Array<object>} [options.anchors=[]]
 * @param {Array<object>} [options.diagnostics=[]]
 * @returns {object} Frozen MeshIR.
 */
export function createMesh({
  id,
  attributes,
  indices,
  parts,
  anchors = [],
  units = MESH_UNITS,
  upAxis = MESH_UP_AXIS,
  forwardAxis = MESH_FORWARD_AXIS,
  diagnostics = []
}) {
  const position = toFloat32(attributes?.position);
  const indexArray = toUint32(indices);

  const resolvedAttributes = { position };
  for (const name of OPTIONAL_ATTRIBUTES) {
    const source = attributes?.[name];
    if (source === undefined || source === null) {
      resolvedAttributes[name] = null;
    } else if (name === 'regionId' || name === 'surfaceId') {
      resolvedAttributes[name] = toUint16(source);
    } else {
      resolvedAttributes[name] = toFloat32(source);
    }
  }

  // Part bounds are DERIVED, always. A caller-supplied value is discarded
  // rather than trusted, so the manifest's per-part measurements are
  // authoritative geometry facts and cannot be asserted into being.
  const resolvedParts = parts.map((part) => createPart({
    ...part,
    bounds: computeRangeBounds(position, indexArray, part.indexStart, part.indexCount)
  }));

  const mesh = Object.freeze({
    version: MESH_IR_VERSION,
    id,
    units,
    upAxis,
    forwardAxis,
    attributes: Object.freeze(resolvedAttributes),
    indices: indexArray,
    parts: Object.freeze(resolvedParts),
    anchors: Object.freeze(anchors.map((a) => Object.freeze({ ...a }))),
    bounds: computeRangeBounds(position, indexArray),
    diagnostics: Object.freeze([...diagnostics])
  });

  return mesh;
}

/**
 * Coerces to Float32Array with -0 normalized.
 *
 * @param {ArrayLike<number>} source
 * @returns {Float32Array}
 */
function toFloat32(source) {
  const out = source instanceof Float32Array ? new Float32Array(source) : Float32Array.from(source ?? []);
  for (let i = 0; i < out.length; i++) {
    if (out[i] === 0) out[i] = 0;
  }
  return out;
}

/**
 * Coerces to Uint32Array.
 *
 * @param {ArrayLike<number>} source
 * @returns {Uint32Array}
 */
function toUint32(source) {
  return source instanceof Uint32Array ? new Uint32Array(source) : Uint32Array.from(source ?? []);
}

/**
 * Coerces to Uint16Array. Semantic ids are integer identities, not floats;
 * the render adapter widens them at the boundary.
 *
 * @param {ArrayLike<number>} source
 * @returns {Uint16Array}
 */
function toUint16(source) {
  return source instanceof Uint16Array ? new Uint16Array(source) : Uint16Array.from(source ?? []);
}

/**
 * Returns the vertex count of a MeshIR.
 *
 * @param {object} mesh
 * @returns {number}
 */
export function vertexCount(mesh) {
  return mesh.attributes.position.length / ATTRIBUTE_ITEM_SIZE.position;
}

/**
 * Returns the triangle count of a MeshIR.
 *
 * @param {object} mesh
 * @returns {number}
 */
export function triangleCount(mesh) {
  return mesh.indices.length / 3;
}

/**
 * Returns the MeshIR bounds record.
 *
 * @param {object} mesh
 * @returns {object}
 */
export function meshBounds(mesh) {
  return mesh.bounds;
}

/**
 * Validates a MeshIR against its structural contract.
 *
 * Returns structured diagnostics rather than throwing, so callers can decide
 * whether a finding is blocking. `enforceValidMesh` is the fail-closed variant.
 *
 * @param {object} mesh
 * @returns {{valid: boolean, diagnostics: Array<object>}}
 */
export function validateMesh(mesh) {
  const diagnostics = [];
  const fail = (code, message, data = null) => {
    diagnostics.push(createDiagnostic({
      severity: 'ERROR', code, step: 'validate', subsystem: 'meshir', message, data
    }));
  };

  if (!mesh || typeof mesh !== 'object') {
    fail('MESH_INVALID', 'MeshIR must be an object');
    return { valid: false, diagnostics };
  }
  if (mesh.version !== MESH_IR_VERSION) {
    fail('MESH_VERSION', `MeshIR version must be ${MESH_IR_VERSION}`, { version: mesh.version });
  }
  if (!mesh.id || typeof mesh.id !== 'string') {
    fail('MESH_ID', 'MeshIR requires a string id');
  }

  const position = mesh.attributes?.position;
  if (!(position instanceof Float32Array) || position.length === 0) {
    fail('MESH_POSITION', 'MeshIR requires a non-empty Float32Array position attribute');
    return { valid: false, diagnostics };
  }
  if (position.length % 3 !== 0) {
    fail('MESH_POSITION_STRIDE', 'position length must be a multiple of 3', { length: position.length });
  }
  if (!allFinite(position)) {
    fail('MESH_NON_FINITE', 'position contains NaN or Infinity');
  }

  const verts = position.length / 3;

  for (const name of OPTIONAL_ATTRIBUTES) {
    const attr = mesh.attributes[name];
    if (attr === null || attr === undefined) continue;
    const expected = verts * ATTRIBUTE_ITEM_SIZE[name];
    if (attr.length !== expected) {
      fail('MESH_ATTRIBUTE_LENGTH', `${name} length ${attr.length} does not match ${expected}`, { name });
    }
    if ((name === 'normal' || name === 'uv') && !allFinite(attr)) {
      fail('MESH_NON_FINITE', `${name} contains NaN or Infinity`, { name });
    }
  }

  const indices = mesh.indices;
  if (!(indices instanceof Uint32Array) || indices.length === 0) {
    fail('MESH_INDICES', 'MeshIR requires a non-empty Uint32Array index buffer');
    return { valid: diagnostics.length === 0, diagnostics };
  }
  if (indices.length % 3 !== 0) {
    fail('MESH_INDEX_STRIDE', 'index length must be a multiple of 3', { length: indices.length });
  }
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= verts) {
      fail('MESH_INDEX_RANGE', `index ${indices[i]} at position ${i} exceeds vertex count ${verts}`);
      break;
    }
  }

  // Parts must exactly partition the index buffer.
  //
  // This block is written so that NO malformed input can escape as a raw
  // TypeError: validateMesh promises structured diagnostics, and a caller
  // handed an arbitrary object must get diagnostics back, not a crash.
  const partList = Array.isArray(mesh.parts) ? mesh.parts : [];
  if (!Array.isArray(mesh.parts)) {
    fail('MESH_PARTS_INVALID', 'MeshIR parts must be an array', { received: describeType(mesh.parts) });
  } else if (mesh.parts.length === 0) {
    fail('MESH_PARTS_EMPTY', 'MeshIR requires at least one part');
  }

  const seen = new Set();
  let cursor = 0;
  const ordered = partList
    .filter((part) => {
      if (!part || typeof part !== 'object') {
        fail('MESH_PART_INVALID', 'every part must be an object', { received: describeType(part) });
        return false;
      }
      return true;
    })
    .sort((a, b) => (Number(a.indexStart) || 0) - (Number(b.indexStart) || 0));

  for (const part of ordered) {
    const label = typeof part.id === 'string' && part.id ? part.id : '<unnamed>';

    if (!part.id || typeof part.id !== 'string') {
      fail('MESH_PART_ID', 'every part requires a string id');
    } else if (seen.has(part.id)) {
      fail('MESH_PART_DUPLICATE', `duplicate part id ${part.id}`, { partId: part.id });
    } else {
      seen.add(part.id);
    }

    if (!part.semanticName || typeof part.semanticName !== 'string' || part.semanticName.trim() === '') {
      fail('MESH_PART_UNNAMED', `part ${label} has no semanticName`, { partId: label });
    }

    const hasValidRange =
      Number.isInteger(part.indexStart) && part.indexStart >= 0 &&
      Number.isInteger(part.indexCount) && part.indexCount > 0;

    if (!hasValidRange) {
      fail(
        'MESH_PART_RANGE',
        `part ${label} requires integer indexStart >= 0 and indexCount > 0`,
        { partId: label, indexStart: part.indexStart, indexCount: part.indexCount }
      );
      continue;
    }
    if (part.indexCount % 3 !== 0) {
      fail('MESH_PART_COUNT', `part ${label} indexCount must be a multiple of 3`, { partId: label });
    }
    if (part.indexStart !== cursor) {
      fail(
        'MESH_PART_PARTITION',
        `part ${label} starts at ${part.indexStart}, expected ${cursor}; parts must exactly partition the index buffer`,
        { partId: label, indexStart: part.indexStart, expected: cursor }
      );
    }
    cursor = part.indexStart + part.indexCount;
  }

  if (partList.length > 0 && cursor !== indices.length) {
    fail(
      'MESH_PART_COVERAGE',
      `parts cover ${cursor} indices but the index buffer has ${indices.length}`,
      { covered: cursor, total: indices.length }
    );
  }

  // Anchors.
  const partIds = new Set(partList.filter((p) => p && typeof p.id === 'string').map((p) => p.id));
  const anchorNames = new Set();
  const anchorList = Array.isArray(mesh.anchors) ? mesh.anchors : [];
  if (mesh.anchors !== undefined && mesh.anchors !== null && !Array.isArray(mesh.anchors)) {
    fail('MESH_ANCHORS_INVALID', 'MeshIR anchors must be an array', { received: describeType(mesh.anchors) });
  }
  for (const anchor of anchorList) {
    if (!anchor || typeof anchor !== 'object') {
      fail('ANCHOR_INVALID', 'every anchor must be an object', { received: describeType(anchor) });
      continue;
    }
    if (!anchor.name || typeof anchor.name !== 'string') {
      fail('ANCHOR_NAME', 'every anchor requires a string name');
      continue;
    }
    if (anchorNames.has(anchor.name)) {
      fail('ANCHOR_DUPLICATE', `duplicate anchor name ${anchor.name}`, { anchor: anchor.name });
    }
    anchorNames.add(anchor.name);
    if (!Array.isArray(anchor.position) || anchor.position.length !== 3 || !allFinite(anchor.position)) {
      fail('ANCHOR_POSITION', `anchor ${anchor.name} requires a finite [x,y,z] position`, { anchor: anchor.name });
    }
    if (anchor.orientation !== null && anchor.orientation !== undefined) {
      if (!Array.isArray(anchor.orientation) || anchor.orientation.length !== 4 || !allFinite(anchor.orientation)) {
        fail('ANCHOR_ORIENTATION', `anchor ${anchor.name} orientation must be a finite quaternion`, { anchor: anchor.name });
      }
    }
    if (anchor.partId !== null && anchor.partId !== undefined && !partIds.has(anchor.partId)) {
      fail('ANCHOR_PART', `anchor ${anchor.name} references unknown part ${anchor.partId}`, { anchor: anchor.name });
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/**
 * Fail-closed validation. Throws on any structural error.
 *
 * @param {object} mesh
 * @returns {object} The same mesh.
 */
export function enforceValidMesh(mesh) {
  const { valid, diagnostics } = validateMesh(mesh);
  if (!valid) {
    const detail = diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ');
    const error = new Error(`Invalid MeshIR: ${detail}`);
    error.diagnostics = diagnostics;
    throw error;
  }
  return mesh;
}
