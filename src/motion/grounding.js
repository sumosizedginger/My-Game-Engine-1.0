/**
 * My Game Engine 1.0 — Motion Forge: Foot Grounding & Roll
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Computes deterministic foot placement, ground plane clamping, heel strike,
 * flat-foot contact, and toe roll. Guarantees zero penetration beneath ground
 * plane (Y < 0) and zero floating during stance phase (Y > 0.02).
 * Follows ARCHITECTURE.md §20.3 & §22 and MOTION_FORGE.md.
 */

/**
 * Computes foot target position and pitch angle for a single leg at given gait phase.
 *
 * @param {object} options
 * @param {number} options.phase - Single-leg phase in [0, 1)
 * @param {number} options.strideLength - Full 2-step stride length in meters
 * @param {number} options.stepHeight - Foot clearance apex in meters
 * @param {number} options.footH - Resting ankle height from ground in meters
 * @param {number} options.hipX - Lateral hip anchor X
 * @returns {object} { targetPos, pitchAngle, inContact, contactPhase }
 */
export function computeGaitFootPlacement({
  phase,
  strideLength,
  stepHeight,
  footH,
  hipX
}) {
  // Normalize phase to [0, 1)
  let p = phase % 1.0;
  if (p < 0) p += 1.0;

  const halfStride = strideLength * 0.5;
  const reachZ = halfStride * 0.5; // Forward/backward swing limit from hip

  const STANCE_RATIO = 0.60; // 60% stance, 40% swing

  if (p <= STANCE_RATIO) {
    // -------------------------------------------------------------
    // STANCE PHASE (Foot on ground, moving backwards relative to hip)
    // -------------------------------------------------------------
    const stanceProgress = p / STANCE_RATIO; // 0 to 1

    // Horizontal Z trajectory: travels linearly from +reachZ to -reachZ
    const z = reachZ - (2 * reachZ) * stanceProgress;

    // Height Y: Strictly clamped to ground plane
    let y = footH;
    let pitch = 0; // Radians

    if (stanceProgress < 0.18) {
      // 1. Heel Strike: foot angled upward (dorsiflexion)
      const t = stanceProgress / 0.18;
      pitch = (-0.30) * (1 - t); // -17 degrees decaying to 0
      y = footH + Math.sin(-pitch) * 0.015;
    } else if (stanceProgress < 0.65) {
      // 2. Midstance / Flat Foot: perfectly flat on ground
      pitch = 0;
      y = footH;
    } else {
      // 3. Heel Off / Push Off: heel rises, toe stays down
      const t = (stanceProgress - 0.65) / 0.35;
      pitch = 0.45 * t; // rolls up to +26 degrees
      y = footH + Math.sin(pitch) * 0.025;
    }

    // Strict safety clamp: never sink below ground plane
    const clampedY = Math.max(footH, y);

    return {
      targetPos: { x: hipX, y: clampedY, z },
      pitchAngle: pitch,
      inContact: true,
      contactPhase: 'stance',
      stanceProgress
    };
  } else {
    // -------------------------------------------------------------
    // SWING PHASE (Foot in air, swinging forward from -reachZ to +reachZ)
    // -------------------------------------------------------------
    const swingProgress = (p - STANCE_RATIO) / (1.0 - STANCE_RATIO); // 0 to 1

    // Smoothstep forward trajectory (starts with toe-off push, accelerates through passing, decelerates at reach)
    const smoothT = swingProgress * swingProgress * (3 - 2 * swingProgress);
    const z = -reachZ + (2 * reachZ) * smoothT;

    // Parabolic arc for vertical foot clearance
    const arc = Math.sin(swingProgress * Math.PI);
    const y = footH + stepHeight * arc;

    // Pitch transitions from toe-off roll to neutral, then prepares heel-strike
    let pitch = 0;
    if (swingProgress < 0.4) {
      // Relaxing toe-off
      pitch = 0.35 * (1 - swingProgress / 0.4);
    } else if (swingProgress > 0.75) {
      // Preparing heel strike
      const t = (swingProgress - 0.75) / 0.25;
      pitch = -0.25 * t;
    }

    return {
      targetPos: { x: hipX, y, z },
      pitchAngle: pitch,
      inContact: false,
      contactPhase: 'swing',
      swingProgress
    };
  }
}
