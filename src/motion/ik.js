/**
 * My Game Engine 1.0 — Motion Forge: Analytical 2-Bone IK
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Implements a closed-form, deterministic 2-bone analytical inverse kinematics
 * solver for bipedal limbs (hip-knee-ankle and shoulder-elbow-wrist).
 * Enforces smooth reach clamping to completely eliminate joint popping
 * and numerical singularity at full extension.
 * Follows ARCHITECTURE.md §20.3 & §22 and MOTION_FORGE.md.
 */

/**
 * Solves analytical 2-bone inverse kinematics.
 *
 * @param {object} options
 * @param {{x: number, y: number, z: number}} options.rootPos - Joint A position (e.g. Hip)
 * @param {{x: number, y: number, z: number}} options.targetPos - Target joint C position (e.g. Ankle)
 * @param {number} options.upperLength - Length of proximal segment (Thigh)
 * @param {number} options.lowerLength - Length of distal segment (Shin)
 * @param {{x: number, y: number, z: number}} [options.poleDirection={x:0, y:0, z:1}] - Preferred bend direction
 * @param {boolean} [options.invertBend=false] - Invert flexion direction
 * @returns {object} { jointPos, flexionAngle, upperDir, lowerDir, reachable, distance }
 */
export function solveTwoBoneIK({
  rootPos,
  targetPos,
  upperLength,
  lowerLength,
  poleDirection = { x: 0, y: 0, z: 1 },
  invertBend = false
}) {
  const L1 = upperLength;
  const L2 = lowerLength;

  // Vector from root to target
  const vx = targetPos.x - rootPos.x;
  const vy = targetPos.y - rootPos.y;
  const vz = targetPos.z - rootPos.z;
  const dist = Math.hypot(vx, vy, vz);

  // Singularity and hyper-extension protection:
  // Clamp distance strictly below maximum reach to prevent instantaneous popping
  const maxReach = (L1 + L2) * 0.9998;
  const minReach = Math.max(0.005, Math.abs(L1 - L2) * 1.002);
  const clampedDist = Math.max(minReach, Math.min(dist, maxReach));

  const reachable = dist <= (L1 + L2);

  // Unit vector along root -> target line
  const safeDist = dist < 1e-6 ? 1 : dist;
  const ux = dist < 1e-6 ? 0 : vx / safeDist;
  const uy = dist < 1e-6 ? -1 : vy / safeDist;
  const uz = dist < 1e-6 ? 0 : vz / safeDist;

  // Law of Cosines
  // cos(alpha) at root joint
  const cosAlpha = Math.max(-1, Math.min(1,
    (L1 * L1 + clampedDist * clampedDist - L2 * L2) / (2 * L1 * clampedDist)
  ));
  const alpha = Math.acos(cosAlpha);

  // cos(beta) at middle joint (interior angle)
  const cosBeta = Math.max(-1, Math.min(1,
    (L1 * L1 + L2 * L2 - clampedDist * clampedDist) / (2 * L1 * L2)
  ));
  const beta = Math.acos(cosBeta);
  const flexionAngle = Math.PI - beta; // 0 when fully straight

  // Gram-Schmidt orthogonalize pole direction against root->target vector
  const poleDotU = poleDirection.x * ux + poleDirection.y * uy + poleDirection.z * uz;
  let px = poleDirection.x - poleDotU * ux;
  let py = poleDirection.y - poleDotU * uy;
  let pz = poleDirection.z - poleDotU * uz;
  let pLen = Math.hypot(px, py, pz);

  if (pLen < 1e-4) {
    // Fallback perpendicular vector if pole is collinear
    px = -uy; py = ux; pz = 0;
    pLen = Math.hypot(px, py, pz);
    if (pLen < 1e-4) {
      px = 0; py = -uz; pz = uy;
      pLen = Math.hypot(px, py, pz) || 1;
    }
  }
  px /= pLen; py /= pLen; pz /= pLen;

  // Sign factor for bend inversion
  const bendSign = invertBend ? -1 : 1;

  // Middle joint position B in 3D
  const projAlongU = L1 * cosAlpha;
  const projAlongP = L1 * Math.sin(alpha) * bendSign;

  const jointPos = {
    x: rootPos.x + ux * projAlongU + px * projAlongP,
    y: rootPos.y + uy * projAlongU + py * projAlongP,
    z: rootPos.z + uz * projAlongU + pz * projAlongP
  };

  // Direction vectors
  const u1x = jointPos.x - rootPos.x;
  const u1y = jointPos.y - rootPos.y;
  const u1z = jointPos.z - rootPos.z;
  const u1Len = Math.hypot(u1x, u1y, u1z) || 1;

  const u2x = targetPos.x - jointPos.x;
  const u2y = targetPos.y - jointPos.y;
  const u2z = targetPos.z - jointPos.z;
  const u2Len = Math.hypot(u2x, u2y, u2z) || 1;

  return {
    jointPos,
    flexionAngle,
    alpha,
    beta,
    upperDir: { x: u1x / u1Len, y: u1y / u1Len, z: u1z / u1Len },
    lowerDir: { x: u2x / u2Len, y: u2y / u2Len, z: u2z / u2Len },
    reachable,
    distance: dist,
    clampedDistance: clampedDist
  };
}
