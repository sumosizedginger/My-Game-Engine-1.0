/**
 * My Game Engine 1.0 — Transform Authority
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Enforces one authoritative writer per entity transform per simulation step.
 * Follows GAMEPLAY_FOUNDATION.md §3 and ARCHITECTURE.md §9.
 */

export const TRANSFORM_OWNERSHIP = Object.freeze({
  STATIC: 'STATIC',
  KINEMATIC: 'KINEMATIC',
  SIMULATED: 'SIMULATED',
  ATTACHED: 'ATTACHED'
});

/**
 * Creates a transform manager bound to an entity manager.
 *
 * @param {object} entityManager - The active entity manager.
 * @returns {object} Transform manager interface.
 */
export function createTransformManager(entityManager) {
  const transforms = new Map();

  function getKey(handle) {
    return `${handle.index}:${handle.generation}`;
  }

  return {
    /**
     * Registers or updates an entity's authoritative transform.
     *
     * @param {object} handle - EntityHandle.
     * @param {object} config - Transform configuration.
     * @returns {object} The stored transform record.
     */
    setTransform(handle, {
      position = { x: 0, y: 0, z: 0 },
      velocity = { x: 0, y: 0, z: 0 },
      ownership = TRANSFORM_OWNERSHIP.STATIC
    } = {}) {
      if (!entityManager.isValid(handle)) {
        throw new Error('Cannot set transform on invalid or stale entity handle');
      }

      const key = getKey(handle);
      const record = {
        handle,
        position: { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 },
        velocity: { x: velocity.x ?? 0, y: velocity.y ?? 0, z: velocity.z ?? 0 },
        previousPosition: { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 },
        intentVelocity: { x: 0, y: 0, z: 0 },
        ownership
      };

      transforms.set(key, record);
      return record;
    },

    /**
     * Retrieves transform for an entity.
     *
     * @param {object} handle - EntityHandle.
     * @returns {object|null}
     */
    getTransform(handle) {
      if (!entityManager.isValid(handle)) {
        return null;
      }
      return transforms.get(getKey(handle)) || null;
    },

    /**
     * Sets movement intent velocity (e.g. from input or AI).
     *
     * @param {object} handle - EntityHandle.
     * @param {object} intent - Intent velocity { x, y, z }.
     */
    setIntent(handle, intent = {}) {
      const transform = this.getTransform(handle);
      if (!transform) return;

      transform.intentVelocity.x = intent.x ?? transform.intentVelocity.x;
      transform.intentVelocity.y = intent.y ?? transform.intentVelocity.y;
      transform.intentVelocity.z = intent.z ?? transform.intentVelocity.z;
    },

    /**
     * Directly adjusts velocity (e.g. collision bounce).
     *
     * @param {object} handle - EntityHandle.
     * @param {object} velocity - New velocity { x, y, z }.
     */
    setVelocity(handle, velocity = {}) {
      const transform = this.getTransform(handle);
      if (!transform) return;

      transform.velocity.x = velocity.x ?? transform.velocity.x;
      transform.velocity.y = velocity.y ?? transform.velocity.y;
      transform.velocity.z = velocity.z ?? transform.velocity.z;
    },

    /**
     * Teleports an entity immediately to a position, setting previousPosition
     * equal to position to suppress render interpolation.
     *
     * @param {object} handle - EntityHandle.
     * @param {object} position - New position { x, y, z }.
     */
    teleport(handle, position = {}) {
      const transform = this.getTransform(handle);
      if (!transform) return;

      const px = position.x ?? transform.position.x;
      const py = position.y ?? transform.position.y;
      const pz = position.z ?? transform.position.z;

      transform.position.x = px;
      transform.position.y = py;
      transform.position.z = pz;

      transform.previousPosition.x = px;
      transform.previousPosition.y = py;
      transform.previousPosition.z = pz;
    },

    /**
     * Commits transform updates for all active entities for one simulation tick.
     * Enforces single-writer authority: movement intent/physics is committed here only.
     *
     * @param {number} dt - Fixed simulation delta in seconds.
     */
    commitAll(dt) {
      for (const [key, transform] of transforms.entries()) {
        if (!entityManager.isValid(transform.handle)) {
          transforms.delete(key);
          continue;
        }

        // 1. Store previous position for render interpolation
        transform.previousPosition.x = transform.position.x;
        transform.previousPosition.y = transform.position.y;
        transform.previousPosition.z = transform.position.z;

        // 2. Commit position based on authoritative ownership model
        if (transform.ownership === TRANSFORM_OWNERSHIP.KINEMATIC) {
          // Kinematic entities consume intent velocity
          transform.position.x += transform.intentVelocity.x * dt;
          transform.position.y += transform.intentVelocity.y * dt;
          transform.position.z += transform.intentVelocity.z * dt;
          // Reflect active velocity
          transform.velocity.x = transform.intentVelocity.x;
          transform.velocity.y = transform.intentVelocity.y;
          transform.velocity.z = transform.intentVelocity.z;
        } else if (transform.ownership === TRANSFORM_OWNERSHIP.SIMULATED) {
          // Simulated entities consume ballistic/physical velocity
          transform.position.x += transform.velocity.x * dt;
          transform.position.y += transform.velocity.y * dt;
          transform.position.z += transform.velocity.z * dt;
        }
        // STATIC entities do not move
      }
    },

    /**
     * Clears all transform data.
     */
    clear() {
      transforms.clear();
    }
  };
}
