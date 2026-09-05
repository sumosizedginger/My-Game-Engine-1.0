/**
 * My Game Engine 1.0 — Generational Entity Management
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Implements generational slot handles preventing stale reference reuse.
 * Follows GAMEPLAY_FOUNDATION.md §2 and ARCHITECTURE.md §8.
 */

/**
 * Creates an immutable entity handle value.
 *
 * @param {number} index - The slot index in the entity pool.
 * @param {number} generation - The generation count of the slot.
 * @returns {object} EntityHandle value object.
 */
export function createEntityHandle(index, generation) {
  return Object.freeze({
    index: Number(index),
    generation: Number(generation)
  });
}

/**
 * Creates an entity manager pool.
 *
 * @returns {object} Entity manager interface.
 */
export function createEntityManager() {
  const slots = [];
  const freeIndices = [];
  let liveCount = 0;

  return {
    /**
     * Spawns a new entity in the pool.
     *
     * @param {object} [data={}] - Initial data/components for the entity.
     * @returns {object} Immutable EntityHandle.
     */
    spawn(data = {}) {
      let index;
      if (freeIndices.length > 0) {
        index = freeIndices.pop();
        const slot = slots[index];
        slot.active = true;
        slot.data = { ...data };
        liveCount++;
        return createEntityHandle(index, slot.generation);
      }

      index = slots.length;
      const slot = {
        generation: 1,
        active: true,
        data: { ...data }
      };
      slots.push(slot);
      liveCount++;
      return createEntityHandle(index, slot.generation);
    },

    /**
     * Despawns an entity, invalidating all current handles for that slot.
     *
     * @param {object} handle - The EntityHandle to despawn.
     * @returns {boolean} True if successfully despawned; false if handle was invalid.
     */
    despawn(handle) {
      if (!this.isValid(handle)) {
        return false;
      }

      const slot = slots[handle.index];
      slot.active = false;
      slot.data = null;
      // Increment generation so any stale handle no longer matches
      slot.generation++;
      freeIndices.push(handle.index);
      liveCount--;
      return true;
    },

    /**
     * Checks if an entity handle is currently active and valid.
     *
     * @param {object} handle - EntityHandle to test.
     * @returns {boolean} True if handle points to an active, matching entity slot.
     */
    isValid(handle) {
      if (!handle || typeof handle.index !== 'number' || typeof handle.generation !== 'number') {
        return false;
      }
      if (handle.index < 0 || handle.index >= slots.length) {
        return false;
      }
      const slot = slots[handle.index];
      return slot.active && slot.generation === handle.generation;
    },

    /**
     * Retrieves entity data if the handle is valid.
     *
     * @param {object} handle - EntityHandle.
     * @returns {object|null} Entity data or null if invalid/stale.
     */
    get(handle) {
      if (!this.isValid(handle)) {
        return null;
      }
      return slots[handle.index].data;
    },

    /**
     * Sets or updates entity data.
     *
     * @param {object} handle - EntityHandle.
     * @param {object} data - Updated data object.
     * @returns {boolean} True if updated, false if invalid handle.
     */
    set(handle, data) {
      if (!this.isValid(handle)) {
        return false;
      }
      slots[handle.index].data = { ...slots[handle.index].data, ...data };
      return true;
    },

    /**
     * Returns count of active living entities.
     *
     * @returns {number}
     */
    count() {
      return liveCount;
    },

    /**
     * Iterates over all active living entities.
     *
     * @returns {Array<{ handle: object, data: object }>}
     */
    getAll() {
      const result = [];
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.active) {
          result.push({
            handle: createEntityHandle(i, slot.generation),
            data: slot.data
          });
        }
      }
      return result;
    },

    /**
     * Resets the entire entity pool.
     */
    clear() {
      slots.length = 0;
      freeIndices.length = 0;
      liveCount = 0;
    }
  };
}
