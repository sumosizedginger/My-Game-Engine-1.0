/**
 * My Game Engine 1.0 — Motion Forge: Root Motion & Transform Authority
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Enforces GAMEPLAY_FOUNDATION.md §3: Animation systems produce movement intent;
 * only the authoritative transform system commits world position.
 * Supports both treadmill view mode (in-place evaluation) and forward translation.
 * Follows ARCHITECTURE.md §20.3 & §22 and MOTION_FORGE.md.
 */

/**
 * Commits root motion intent into a target transform according to the specified mode.
 *
 * @param {object} intent - Root motion intent { deltaX, deltaY, deltaZ, speed, totalDistance }.
 * @param {object} transform - Transform component with position { x, y, z }.
 * @param {string} [mode='in_place'] - 'in_place' | 'forward'
 * @returns {object} Updated transform position copy.
 */
export function commitRootMotionIntent(intent, transform, mode = 'in_place') {
  if (!transform || !transform.position) {
    throw new Error('commitRootMotionIntent requires a transform with a position object');
  }

  if (mode === 'forward') {
    transform.position.z += intent.deltaZ || 0;
    transform.position.x += intent.deltaX || 0;
    transform.position.y += intent.deltaY || 0;
  } else if (mode === 'in_place') {
    // In-place treadmill mode: character stays centered on studio grid origin
    transform.position.x = 0;
    transform.position.y = 0;
    transform.position.z = 0;
  }

  return {
    position: { ...transform.position },
    speed: intent.speed,
    totalDistance: intent.totalDistance,
    mode
  };
}
