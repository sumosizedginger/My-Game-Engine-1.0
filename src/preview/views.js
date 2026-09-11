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
 * @param {object} bounds - MeshIR bounds record.
 * @returns {number}
 */
export function boundingRadius(bounds) {
  const [dx, dy, dz] = bounds.dimensions;
  return Math.hypot(dx, dy, dz) / 2;
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
  const radius = boundingRadius(bounds) || 0.5;

  const fovV = (fovDeg * Math.PI) / 180;
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * Math.max(aspect, 1e-6));
  const distV = radius / Math.sin(fovV / 2);
  const distH = radius / Math.sin(fovH / 2);
  const distance = Math.max(distV, distH) * margin;

  const target = [bounds.center[0], bounds.center[1], bounds.center[2]];
  const position = [
    target[0] + direction[0] * distance,
    target[1] + direction[1] * distance,
    target[2] + direction[2] * distance
  ];

  return Object.freeze({
    name: view,
    position: Object.freeze(position),
    target: Object.freeze(target),
    up: CANONICAL_VIEW_UP[view],
    fovDeg,
    aspect,
    distance,
    near: Math.max(distance - radius * 2, distance / 1000),
    far: distance + radius * 4
  });
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
