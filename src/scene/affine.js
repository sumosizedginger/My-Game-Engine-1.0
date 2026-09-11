/**
 * My Game Engine 1.0 — Affine Transform Primitives
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The smallest pure-numeric 4x4 affine utility scene composition needs.
 *
 * WHY THIS EXISTS. A composed world placement is NOT always representable as
 * translation + quaternion + component-wise scale. Nesting a non-uniform scale
 * above a rotation produces SHEAR, and a shear-capable affine transform cannot
 * be decomposed back into a lossless TRS. Composing world transforms as
 * independent T, R and S therefore loses ordering information and silently
 * computes the wrong placement:
 *
 *   root  scale [2,1,1]
 *   child rotation 90 degrees about Z
 *   grandchild translation [1,0,0]
 *
 *   correct    [0, 1, 0]
 *   TRS model  [0, 2, 0]
 *
 * Local AUTHORING stays TRS, because that is how a human or an AI describes a
 * placement. Compiled WORLD placement is a matrix, because that is what is
 * true.
 *
 * CONVENTION — stated explicitly, never inferred:
 *
 *   - COLUMN VECTORS. A point is a column, so transforms apply right to left:
 *     `M * p`.
 *   - COLUMN-MAJOR STORAGE in a flat array of 16 numbers. Element at row `r`,
 *     column `c` lives at index `c * 4 + r`. This matches WebGL and Three.js,
 *     so the renderer consumes a matrix without a transpose — a transpose is
 *     exactly the kind of silent convention mismatch this comment exists to
 *     prevent.
 *   - LOCAL MATRIX is `T * R * S`: scale first, then rotate, then translate.
 *     Same order `transformMesh` applies to geometry.
 *   - WORLD MATRIX is `parentWorld * local`. A root's world matrix is its
 *     local matrix.
 *
 * This is deliberately not a math library. It holds what scene composition
 * uses and nothing else. A second consumer may earn its promotion to a shared
 * location; one consumer does not.
 *
 * This module must never import 'three'.
 */

import { normalizeZero } from '../geometry/mesh.js';

/** Index of the element at row `r`, column `c` in column-major storage. */
export const at = (r, c) => c * 4 + r;

/**
 * The identity matrix.
 *
 * @returns {Array<number>} A fresh 16-element column-major array.
 */
export function identityMatrix() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

/**
 * Builds a local affine matrix from an authored TRS.
 *
 * Computes `T * R * S`. The rotation quaternion is XYZW, matching the
 * convention `transformMesh` and MeshIR already use.
 *
 * PRECONDITION: `rotation` MUST be a unit quaternion. The rotation-matrix
 * formula below assumes it, and a non-unit quaternion silently scales: length
 * 0.707 shrinks the node by 0.707 regardless of its authored scale.
 *
 * This function does NOT normalize and does NOT validate. Normalizing here
 * would hide invalid source from the author; validating here would create a
 * second gate competing with the authoritative one. `validateSceneDefinition`
 * is the source gate, it rejects non-unit quaternions with
 * `SCENE_ROTATION_NOT_UNIT`, and `compileScene` enforces it before any matrix
 * is built. The shared tolerance is `QUATERNION_UNIT_TOLERANCE` in
 * src/geometry/mesh.js.
 *
 * @param {object} trs
 * @param {Array<number>} trs.translation - [x, y, z].
 * @param {Array<number>} trs.rotation - UNIT quaternion [x, y, z, w].
 * @param {Array<number>} trs.scale - [x, y, z].
 * @returns {Array<number>} Column-major 16-element matrix.
 */
export function matrixFromTRS({ translation, rotation, scale }) {
  const [x, y, z, w] = rotation;
  const [sx, sy, sz] = scale;

  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  // Rotation basis columns, each scaled by its own axis factor. Scaling the
  // COLUMNS is what makes this T * R * S rather than T * S * R.
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    translation[0], translation[1], translation[2], 1
  ];
}

/**
 * Multiplies two affine matrices: `a * b`.
 *
 * With column vectors this means `b` is applied to a point first. For scene
 * composition, `a` is the parent world matrix and `b` the child local matrix.
 *
 * @param {Array<number>} a
 * @param {Array<number>} b
 * @returns {Array<number>} Column-major 16-element product.
 */
export function multiplyMatrices(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = normalizeZero(
        a[r] * b0 + a[4 + r] * b1 + a[8 + r] * b2 + a[12 + r] * b3
      );
    }
  }
  return out;
}

/**
 * Applies an affine matrix to a point.
 *
 * The point is treated as a column vector with an implied w of 1.
 *
 * @param {Array<number>} m - Column-major matrix.
 * @param {Array<number>} p - [x, y, z].
 * @returns {Array<number>} Transformed [x, y, z].
 */
export function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    normalizeZero(m[0] * x + m[4] * y + m[8] * z + m[12]),
    normalizeZero(m[1] * x + m[5] * y + m[9] * z + m[13]),
    normalizeZero(m[2] * x + m[6] * y + m[10] * z + m[14])
  ];
}

/**
 * Extracts the translation column.
 *
 * This is derived convenience data, not an independent authority: it is
 * exactly where the matrix places the local origin.
 *
 * @param {Array<number>} m - Column-major matrix.
 * @returns {Array<number>} [x, y, z].
 */
export function translationOf(m) {
  return [normalizeZero(m[12]), normalizeZero(m[13]), normalizeZero(m[14])];
}

/**
 * Reports whether a matrix carries shear.
 *
 * True when the upper-left basis columns are not mutually perpendicular,
 * which is precisely the case a TRS representation cannot express. Used by
 * diagnostics and by tests that must prove shear is genuinely present rather
 * than assumed.
 *
 * @param {Array<number>} m - Column-major matrix.
 * @param {number} [epsilon=1e-9]
 * @returns {boolean}
 */
export function hasShear(m, epsilon = 1e-9) {
  const cx = [m[0], m[1], m[2]];
  const cy = [m[4], m[5], m[6]];
  const cz = [m[8], m[9], m[10]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (v) => Math.hypot(...v) || 1;
  // Normalized dot products: scale alone leaves columns perpendicular, so a
  // non-zero value here can only come from composition order.
  return Math.abs(dot(cx, cy) / (len(cx) * len(cy))) > epsilon
    || Math.abs(dot(cx, cz) / (len(cx) * len(cz))) > epsilon
    || Math.abs(dot(cy, cz) / (len(cy) * len(cz))) > epsilon;
}

/**
 * Freezes a matrix array so an artifact cannot be edited through it.
 *
 * @param {Array<number>} m
 * @returns {Array<number>} The same array, frozen.
 */
export function freezeMatrix(m) {
  return Object.freeze(m);
}
