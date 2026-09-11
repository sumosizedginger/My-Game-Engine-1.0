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

// Vector helpers. Declared before the canonical tables because those tables are
// resolved at module evaluation time.
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
 * Axis specifications MeshIR admits, as unit vectors.
 *
 * @type {Readonly<Record<string, Readonly<number[]>>>}
 */
export const AXIS_VECTORS = Object.freeze({
  '+X': Object.freeze([1, 0, 0]),
  '-X': Object.freeze([-1, 0, 0]),
  '+Y': Object.freeze([0, 1, 0]),
  '-Y': Object.freeze([0, -1, 0]),
  '+Z': Object.freeze([0, 0, 1]),
  '-Z': Object.freeze([0, 0, -1])
});

/**
 * Default axis conventions.
 *
 * These MUST equal MESH_UP_AXIS and MESH_FORWARD_AXIS in src/geometry/mesh.js.
 * They are duplicated rather than imported so this module keeps zero imports,
 * and `tests/views.test.js` asserts the two agree so they cannot drift.
 */
export const DEFAULT_UP_AXIS = '+Y';
export const DEFAULT_FORWARD_AXIS = '-Z';

/**
 * Builds the asset's semantic frame from its declared axis conventions.
 *
 * `right` is derived as forward x up, which is the right-handed convention the
 * engine already declares: an asset facing -Z with +Y up has its own right
 * along +X.
 *
 * @param {string} [upAxis='+Y']
 * @param {string} [forwardAxis='-Z']
 * @returns {{forward: number[], up: number[], right: number[]}}
 */
export function semanticFrame(upAxis = DEFAULT_UP_AXIS, forwardAxis = DEFAULT_FORWARD_AXIS) {
  const up = AXIS_VECTORS[upAxis];
  const forward = AXIS_VECTORS[forwardAxis];
  if (!up) {
    throw new Error(`Unknown upAxis "${upAxis}". Expected one of: ${Object.keys(AXIS_VECTORS).join(', ')}`);
  }
  if (!forward) {
    throw new Error(`Unknown forwardAxis "${forwardAxis}". Expected one of: ${Object.keys(AXIS_VECTORS).join(', ')}`);
  }
  const right = cross(forward, up);
  if (Math.hypot(right[0], right[1], right[2]) < 0.5) {
    throw new Error(`upAxis "${upAxis}" and forwardAxis "${forwardAxis}" are parallel; they cannot define a frame`);
  }
  return { forward: [...forward], up: [...up], right };
}

/**
 * Resolves the camera direction for every canonical view, in the asset's own
 * semantic frame.
 *
 * THIS IS THE REPAIR. These directions used to be world-space constants, with
 * `front` fixed at +Z. An asset that declares `forwardAxis: '-Z'` — which is the
 * engine default — therefore had its REAR observed by the capture labelled
 * `front`. A manifest that states one forward axis while labelling the opposite
 * observation "front" is false evidence, and an agent reading it reconstructs a
 * backwards asset.
 *
 * Views are now asset-relative:
 *   front        camera on the side the asset faces, so it sees the front face
 *   back         exactly opposite front
 *   left/right   the asset's own left and right, by right-handed convention
 *   top          along the declared up axis
 *   threeQuarter front, right and above, from the same basis
 *
 * No world-relative aliases are exposed: nothing in the repository needs them,
 * and adding unused API to avoid deleting a wrong constant is not a repair. If
 * a world-relative view is ever required it should be named for the axis it
 * uses (`plusZ`, `minusZ`) rather than overloading a semantic name.
 *
 * @param {string} [upAxis='+Y']
 * @param {string} [forwardAxis='-Z']
 * @returns {Readonly<Record<string, Readonly<number[]>>>}
 */
export function resolveCanonicalViewDirections(upAxis = DEFAULT_UP_AXIS, forwardAxis = DEFAULT_FORWARD_AXIS) {
  const frame = semanticFrame(upAxis, forwardAxis);
  const negate = (v) => [-v[0], -v[1], -v[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  return Object.freeze({
    front: Object.freeze([...frame.forward]),
    back: Object.freeze(negate(frame.forward)),
    left: Object.freeze(negate(frame.right)),
    right: Object.freeze([...frame.right]),
    top: Object.freeze([...frame.up]),
    threeQuarter: Object.freeze(normalize(add(add(frame.forward, frame.right), frame.up)))
  });
}

/**
 * Resolves the up hint for every canonical view in the asset's frame.
 *
 * The top view cannot use the asset's up vector — it is the view direction, and
 * the basis would degenerate. It uses the asset's FORWARD instead, so a plan
 * view shows the asset pointing toward the top of the image.
 *
 * @param {string} [upAxis='+Y']
 * @param {string} [forwardAxis='-Z']
 * @returns {Readonly<Record<string, Readonly<number[]>>>}
 */
export function resolveCanonicalViewUps(upAxis = DEFAULT_UP_AXIS, forwardAxis = DEFAULT_FORWARD_AXIS) {
  const frame = semanticFrame(upAxis, forwardAxis);
  const assetUp = Object.freeze([...frame.up]);
  return Object.freeze({
    front: assetUp,
    back: assetUp,
    left: assetUp,
    right: assetUp,
    top: Object.freeze([...frame.forward]),
    threeQuarter: assetUp
  });
}

/**
 * Canonical view directions for the DEFAULT axis convention (+Y up, -Z forward).
 *
 * Retained as a convenience constant. For any asset, resolve from its declared
 * axes with `resolveCanonicalViewDirections` rather than assuming these.
 */
export const CANONICAL_VIEW_DIRECTIONS = resolveCanonicalViewDirections();

/** Canonical view up hints for the DEFAULT axis convention. */
export const CANONICAL_VIEW_UP = resolveCanonicalViewUps();

/** Default framing parameters. */
export const DEFAULT_VIEW_OPTIONS = Object.freeze({
  fovDeg: 35,
  aspect: 1,
  margin: 1.15,
  upAxis: DEFAULT_UP_AXIS,
  forwardAxis: DEFAULT_FORWARD_AXIS
});

/**
 * Deterministic studio inspection rig, expressed in VIEW SPACE.
 *
 * Offsets are in the active view's own basis: x is view right, y is view up,
 * z is toward the camera. Because the rig is defined relative to the view
 * rather than to the world, every canonical view receives comparable
 * illumination, which is what makes canonical captures comparable as evidence.
 *
 * Previously the lights were fixed in world space at roughly (3,5,4) and
 * (-4,2,-3), so views facing away from them returned systematically darker
 * evidence than views facing toward them, and an agent had no way to tell a
 * dark asset from a dark view.
 *
 * This is an illumination CONTRACT, not a material system. It is versioned so
 * that evidence can name the illumination that produced its pixels. Image-based
 * lighting remains future work.
 */
export const INSPECTION_RIG = Object.freeze({
  version: 1,
  hemisphere: Object.freeze({ sky: 0xdfe8ff, ground: 0x30302c, intensity: 1.4 }),
  lights: Object.freeze([
    Object.freeze({ name: 'key', offset: Object.freeze([0.55, 0.62, 0.56]), color: 0xffffff, intensity: 2.3 }),
    Object.freeze({ name: 'fill', offset: Object.freeze([-0.62, 0.16, 0.44]), color: 0xaabbdd, intensity: 0.85 }),
    Object.freeze({ name: 'rim', offset: Object.freeze([0.12, -0.34, -0.62]), color: 0x93a6c4, intensity: 0.5 })
  ])
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
export function viewBasis(view, { upAxis = DEFAULT_UP_AXIS, forwardAxis = DEFAULT_FORWARD_AXIS } = {}) {
  const directions = resolveCanonicalViewDirections(upAxis, forwardAxis);
  const ups = resolveCanonicalViewUps(upAxis, forwardAxis);
  if (!directions[view]) {
    throw new Error(`Unknown canonical view "${view}". Expected one of: ${CANONICAL_VIEWS.join(', ')}`);
  }
  const zAxis = normalize(directions[view]);
  const xAxis = normalize(cross(ups[view], zAxis));
  const yAxis = cross(zAxis, xAxis);
  return { xAxis, yAxis, zAxis };
}

/**
 * Resolves the inspection rig into WORLD directions for a solved camera.
 *
 * Each rig light's view-space offset is rotated into the camera's own basis, so
 * the key stays up-and-right-of-camera for every canonical view. Returns unit
 * directions FROM the asset centre TOWARD each light, which is the form a
 * directional light needs.
 *
 * Pure: no renderer. The Preview Lab applies the result, and because the
 * capture path drives the Preview Lab, human and automated evidence are lit by
 * the same computation rather than by two rigs that agree today.
 *
 * @param {object} camera - A record from solveCanonicalView.
 * @param {object} [rig=INSPECTION_RIG]
 * @returns {{version: number, lights: Array<{name: string, direction: number[], color: number, intensity: number}>}}
 */
export function inspectionLightFrame(camera, rig = INSPECTION_RIG) {
  const zAxis = normalize(sub(camera.position, camera.target));
  const xAxis = normalize(cross(camera.up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return {
    version: rig.version,
    lights: rig.lights.map((light) => {
      const [ox, oy, oz] = light.offset;
      const direction = normalize([
        xAxis[0] * ox + yAxis[0] * oy + zAxis[0] * oz,
        xAxis[1] * ox + yAxis[1] * oy + zAxis[1] * oz,
        xAxis[2] * ox + yAxis[2] * oy + zAxis[2] * oz
      ]);
      return { name: light.name, direction, color: light.color, intensity: light.intensity };
    })
  };
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
  const { fovDeg, aspect, margin, upAxis, forwardAxis } = { ...DEFAULT_VIEW_OPTIONS, ...options };

  const direction = resolveCanonicalViewDirections(upAxis, forwardAxis)[view];
  if (!direction) {
    throw new Error(`Unknown canonical view "${view}". Expected one of: ${CANONICAL_VIEWS.join(', ')}`);
  }
  if (!bounds || !Array.isArray(bounds.center) || !Array.isArray(bounds.dimensions)) {
    throw new TypeError('solveCanonicalView requires a bounds record with center and dimensions');
  }

  const viewUp = resolveCanonicalViewUps(upAxis, forwardAxis)[view];
  const basis = viewBasis(view, { upAxis, forwardAxis });
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
    up: viewUp,
    fovDeg,
    aspect,
    distance,
    // The axes the view was resolved against travel with the camera, so a
    // capture record can never be read against the wrong convention.
    upAxis,
    forwardAxis,
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
