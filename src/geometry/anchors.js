/**
 * My Game Engine 1.0 — Semantic Anchors
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * A SemanticAnchor is a named, stable frame on a generated asset. Anchors are
 * generic engine vocabulary: they work for weapons, doors, vehicles, props and
 * characters alike.
 *
 *   weapon.grip.R   weapon.muzzle   weapon.magazineSocket
 *   door.hinge      vehicle.wheel.FL
 *   character.hand.R
 *
 * This module must never import 'three', and must never depend on Character
 * Forge. Character Forge may later map its humanoid SemanticLandmarks into this
 * contract; the dependency direction is one-way.
 *
 * See `Next step.md` Decision 1.
 */

/**
 * Creates a semantic anchor.
 *
 * @param {object} options
 * @param {string} options.name - Stable semantic name, e.g. "weapon.grip.R".
 * @param {number[]} options.position - Required [x, y, z].
 * @param {number[]|null} [options.orientation=null] - Optional quaternion [x, y, z, w].
 * @param {string|null} [options.partId=null] - Optional owning part id.
 * @returns {object} Frozen anchor record.
 */
export function createAnchor({ name, position, orientation = null, partId = null }) {
  if (!name || typeof name !== 'string') {
    throw new TypeError('Anchor requires a string name');
  }
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
    throw new TypeError(`Anchor ${name} requires a finite [x, y, z] position`);
  }
  if (orientation !== null) {
    if (!Array.isArray(orientation) || orientation.length !== 4 || !orientation.every(Number.isFinite)) {
      throw new TypeError(`Anchor ${name} orientation must be a finite quaternion [x, y, z, w]`);
    }
  }
  return Object.freeze({
    name,
    partId,
    position: Object.freeze(position.map((n) => (n === 0 ? 0 : n))),
    orientation: orientation === null ? null : Object.freeze([...orientation])
  });
}

/**
 * Rotates a vector by a quaternion.
 *
 * @param {number[]} v - [x, y, z]
 * @param {number[]} q - [x, y, z, w]
 * @returns {number[]} Rotated [x, y, z].
 */
export function rotateVectorByQuaternion(v, q) {
  const [vx, vy, vz] = v;
  const [qx, qy, qz, qw] = q;
  // t = 2 * (q_vec x v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  // v' = v + qw * t + q_vec x t
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx)
  ];
}

/**
 * Multiplies two quaternions (a then b applied as b * a).
 *
 * @param {number[]} b - [x, y, z, w] applied second.
 * @param {number[]} a - [x, y, z, w] applied first.
 * @returns {number[]} Composed quaternion.
 */
export function multiplyQuaternions(b, a) {
  const [bx, by, bz, bw] = b;
  const [ax, ay, az, aw] = a;
  return [
    bw * ax + bx * aw + by * az - bz * ay,
    bw * ay - bx * az + by * aw + bz * ax,
    bw * az + bx * ay - by * ax + bz * aw,
    bw * aw - bx * ax - by * ay - bz * az
  ];
}

/**
 * Applies a TRS transform to an anchor.
 *
 * Scale is applied first, then rotation, then translation, matching the vertex
 * transform in `transformMesh` so anchors stay attached to their geometry.
 *
 * An anchor with no orientation keeps none: an orientation is not invented
 * merely because a rotation was applied.
 *
 * @param {object} anchor
 * @param {object} transform - { translation, rotation, scale }
 * @returns {object} New frozen anchor.
 */
export function transformAnchor(anchor, { translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1] } = {}) {
  const scaled = [
    anchor.position[0] * scale[0],
    anchor.position[1] * scale[1],
    anchor.position[2] * scale[2]
  ];
  const rotated = rotateVectorByQuaternion(scaled, rotation);
  const position = [
    rotated[0] + translation[0],
    rotated[1] + translation[1],
    rotated[2] + translation[2]
  ];
  const orientation = anchor.orientation === null
    ? null
    : multiplyQuaternions(rotation, anchor.orientation);

  return createAnchor({
    name: anchor.name,
    partId: anchor.partId,
    position,
    orientation
  });
}

/**
 * Identity transform, useful as an explicit default.
 *
 * @returns {object}
 */
export function identityTransform() {
  return { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
}
