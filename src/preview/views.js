/**
 * My Game Engine 1.0 — Canonical View Solver
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * THE SHARED CONTRACT. Both the human Preview Lab and the automated evaluation
 * capture path resolve cameras through this module, so a human and an AI
 * reviewing the same asset are looking at identically framed geometry.
 *
 *                 solveCanonicalView()
 *                         |
 *               +---------+---------+
 *               |                   |
 *        Preview Lab          Eval Capture
 *        (browser UI)         (Puppeteer)
 *
 * Normalized framing is not cosmetic. Measured evidence (3DHarnessBench,
 * September 2026) found that poor viewport state degrades agent observations
 * more than reasoning limits do, and that camera pose metadata produces the
 * largest reconstruction gains. Framing is therefore solved from artifact
 * bounds rather than left to whatever the viewport happened to be showing.
 *
 * This module is pure math with no renderer and no Node dependency.
 */

/** Canonical view names, in canonical order. */
export const CANONICAL_VIEWS = Object.freeze([
  'front', 'back', 'left', 'right', 'top', 'threeQuarter'
]);

const INV_SQRT3 = 1 / Math.sqrt(3);

/** Unit direction from the asset centre toward the camera, per view. */
export const CANONICAL_VIEW_DIRECTIONS = Object.freeze({
  front: Object.freeze([0, 0, 1]),
  back: Object.freeze([0, 0, -1]),
  left: Object.freeze([-1, 0, 0]),
  right: Object.freeze([1, 0, 0]),
  top: Object.freeze([0, 1, 0]),
  threeQuarter: Object.freeze([INV_SQRT3, INV_SQRT3, INV_SQRT3])
});

/** Up vector per view. Top view needs a different up or the basis degenerates. */
export const CANONICAL_VIEW_UP = Object.freeze({
  front: Object.freeze([0, 1, 0]),
  back: Object.freeze([0, 1, 0]),
  left: Object.freeze([0, 1, 0]),
  right: Object.freeze([0, 1, 0]),
  top: Object.freeze([0, 0, -1]),
  threeQuarter: Object.freeze([0, 1, 0])
});

/** Default framing parameters. */
export const DEFAULT_VIEW_OPTIONS = Object.freeze({
  fovDeg: 35,
  aspect: 1,
  margin: 1.15
});

/**
 * Radius of the sphere bounding the asset.
 *
 * Retained for depth-range work. It is deliberately NOT used to choose camera
 * distance: a bounding sphere cannot tell which axis is actually visible, so
 * an elongated asset viewed down its long axis gets framed for a dimension
 * that is hidden along the view direction. For CINDER that reduced the front
 * view to roughly 7% of frame width.
 *
 * @param {object} bounds - MeshIR bounds record.
 * @returns {number}
 */
export function boundingRadius(bounds) {
  const [dx, dy, dz] = bounds.dimensions;
  return Math.hypot(dx, dy, dz) / 2;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const normalize = (v) => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/**
 * The eight corners of an axis-aligned bounding box.
 *
 * Corner order is fixed so the solve is deterministic.
 *
 * @param {object} bounds
 * @returns {Array<number[]>}
 */
export function boundsCorners(bounds) {
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push([x, y, z]);
      }
    }
  }
  return corners;
}

/**
 * Builds the orthonormal view basis for a canonical view.
 *
 * `zAxis` points from the asset toward the camera; `xAxis` is view right and
 * `yAxis` is view up. The basis depends only on the view direction and its up
 * hint, never on distance, so framing can be solved in one pass.
 *
 * @param {string} view
 * @returns {{xAxis: number[], yAxis: number[], zAxis: number[]}}
 */
export function viewBasis(view) {
  const zAxis = normalize(CANONICAL_VIEW_DIRECTIONS[view]);
  const xAxis = normalize(cross(CANONICAL_VIEW_UP[view], zAxis));
  const yAxis = cross(zAxis, xAxis);
  return { xAxis, yAxis, zAxis };
}

/**
 * Projects an asset's bounding box into a view basis.
 *
 * @param {object} bounds
 * @param {object} basis
 * @returns {{halfWidth: number, halfHeight: number, minDepth: number, maxDepth: number}}
 */
export function projectBounds(bounds, basis) {
  let halfWidth = 0;
  let halfHeight = 0;
  let minDepth = Infinity;
  let maxDepth = -Infinity;

  for (const corner of boundsCorners(bounds)) {
    const relative = sub(corner, bounds.center);
    const cx = dot(relative, basis.xAxis);
    const cy = dot(relative, basis.yAxis);
    const cz = dot(relative, basis.zAxis);
    halfWidth = Math.max(halfWidth, Math.abs(cx));
    halfHeight = Math.max(halfHeight, Math.abs(cy));
    minDepth = Math.min(minDepth, cz);
    maxDepth = Math.max(maxDepth, cz);
  }

  return { halfWidth, halfHeight, minDepth, maxDepth };
}

/**
 * Solves the camera for one canonical view of an asset.
 *
 * The distance fits the bounding sphere within both the vertical and the
 * horizontal field of view, so the asset is framed identically regardless of
 * viewport aspect ratio.
 *
 * @param {string} view - One of CANONICAL_VIEWS.
 * @param {object} bounds - MeshIR bounds record.
 * @param {object} [options]
 * @param {number} [options.fovDeg=35] - Vertical field of view in degrees.
 * @param {number} [options.aspect=1] - Viewport width divided by height.
 * @param {number} [options.margin=1.15] - Framing headroom multiplier.
 * @returns {object} Frozen camera record.
 */
export function solveCanonicalView(view, bounds, options = {}) {
  const direction = CANONICAL_VIEW_DIRECTIONS[view];
  if (!direction) {
    throw new Error(`Unknown canonical view "${view}". Expected one of: ${CANONICAL_VIEWS.join(', ')}`);
  }
  if (!bounds || !Array.isArray(bounds.center) || !Array.isArray(bounds.dimensions)) {
    throw new TypeError('solveCanonicalView requires a bounds record with center and dimensions');
  }

  const { fovDeg, aspect, margin } = { ...DEFAULT_VIEW_OPTIONS, ...options };

  const basis = viewBasis(view);
  const projected = projectBounds(bounds, basis);

  const tanV = Math.tan((fovDeg * Math.PI) / 180 / 2);
  const tanH = tanV * Math.max(aspect, 1e-6);

  // Fit the PROJECTED extents, corner by corner.
  //
  // A corner sitting at view-space depth cz toward the camera is (D - cz) away
  // along the view axis, so it fits vertically when
  //     |cy| * margin <= tanV * (D - cz)   ->   D >= cz + |cy| * margin / tanV
  // and horizontally by the same argument with tanH. Taking the maximum over
  // all eight corners and both axes gives the smallest distance that frames
  // the whole box. Depth along the view axis therefore no longer inflates the
  // distance the way a bounding sphere does.
  let distance = 0;
  for (const corner of boundsCorners(bounds)) {
    const relative = sub(corner, bounds.center);
    const cx = Math.abs(dot(relative, basis.xAxis));
    const cy = Math.abs(dot(relative, basis.yAxis));
    const cz = dot(relative, basis.zAxis);
    distance = Math.max(
      distance,
      cz + (cx * margin) / tanH,
      cz + (cy * margin) / tanV
    );
  }

  // A fully degenerate asset projects to nothing; keep the camera outside it
  // rather than at the origin.
  const depthSpan = projected.maxDepth - projected.minDepth;
  const fallback = Math.max(boundingRadius(bounds), depthSpan, 1e-3);
  if (!(distance > projected.maxDepth)) {
    distance = projected.maxDepth + fallback;
  }

  const target = [bounds.center[0], bounds.center[1], bounds.center[2]];
  const position = [
    target[0] + direction[0] * distance,
    target[1] + direction[1] * distance,
    target[2] + direction[2] * distance
  ];

  const nearestSurface = distance - projected.maxDepth;
  const farthestSurface = distance - projected.minDepth;

  return Object.freeze({
    name: view,
    position: Object.freeze(position),
    target: Object.freeze(target),
    up: CANONICAL_VIEW_UP[view],
    fovDeg,
    aspect,
    distance,
    near: Math.max(nearestSurface * 0.5, distance / 10000),
    far: farthestSurface * 2 + fallback,
    projected: Object.freeze({
      halfWidth: projected.halfWidth,
      halfHeight: projected.halfHeight,
      minDepth: projected.minDepth,
      maxDepth: projected.maxDepth
    }),
    // Fraction of the frame spanned by the asset's PROJECTED AXIS-ALIGNED
    // BOUNDS — not by its rendered pixels. It says whether a canonical view is
    // framed usefully or is a postage stamp, so it travels with the camera
    // rather than being recomputed. See projectedBoundsOccupancy for what this
    // number does and does not claim.
    projectedBoundsOccupancy: Object.freeze(projectedBoundsOccupancy(bounds, basis, distance, tanH, tanV))
  });
}

/**
 * Measures the fraction of the frame spanned by an asset's PROJECTED
 * AXIS-ALIGNED BOUNDING BOX from a solved camera.
 *
 * This is a framing measurement, not a coverage measurement. It answers "is
 * the asset sized correctly in frame?" — it does NOT answer "how many pixels
 * did the asset actually paint?". A thin, hollow or sparse asset can report a
 * high value here while covering very little of the image, because the bounding
 * box spans frame area the geometry does not fill.
 *
 * Rendered-pixel occupancy is a separate, unimplemented measurement. Do not
 * read this value as a stand-in for it.
 *
 * @param {object} bounds
 * @param {object} basis
 * @param {number} distance
 * @param {number} tanH
 * @param {number} tanV
 * @returns {{width: number, height: number}} Fractions in [0, 1].
 */
export function projectedBoundsOccupancy(bounds, basis, distance, tanH, tanV) {
  let width = 0;
  let height = 0;
  for (const corner of boundsCorners(bounds)) {
    const relative = sub(corner, bounds.center);
    const depth = distance - dot(relative, basis.zAxis);
    if (!(depth > 0)) continue;
    width = Math.max(width, Math.abs(dot(relative, basis.xAxis)) / (tanH * depth));
    height = Math.max(height, Math.abs(dot(relative, basis.yAxis)) / (tanV * depth));
  }
  return { width, height };
}

/**
 * Solves every canonical view for an asset.
 *
 * @param {object} bounds
 * @param {object} [options]
 * @returns {Array<object>} Camera records in canonical order.
 */
export function solveAllCanonicalViews(bounds, options = {}) {
  return CANONICAL_VIEWS.map((view) => solveCanonicalView(view, bounds, options));
}
