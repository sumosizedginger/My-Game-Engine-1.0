/**
 * My Game Engine 1.0 — Runtime Variables & Finite State
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Implements declared runtime variables and discrete state machine primitives.
 * Follows GAMEPLAY_FOUNDATION.md §7 and ARCHITECTURE.md §11.
 */

/**
 * Creates a state and runtime variable manager.
 *
 * @param {object} [config={}] - Configuration.
 * @param {string} [config.initialState='SERVE'] - Starting state.
 * @param {Array<string>} [config.validStates=['SERVE', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'PAUSED']] - Allowed states.
 * @param {object} [config.initialVars={}] - Initial runtime variables.
 * @returns {object} State manager interface.
 */
export function createStateManager({
  initialState = 'SERVE',
  validStates = ['SERVE', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'PAUSED'],
  initialVars = {}
} = {}) {
  let currentState = initialState;
  const stateSet = new Set(validStates);
  const vars = new Map(Object.entries(initialVars));

  const stateListeners = [];
  const varListeners = new Map();

  return {
    /**
     * Gets current active state name.
     */
    getState() {
      return currentState;
    },

    /**
     * Attempts state transition.
     *
     * @param {string} nextState - Target state.
     * @returns {boolean} True if transitioned.
     */
    transition(nextState) {
      if (!stateSet.has(nextState)) {
        throw new Error(`Invalid state transition to undeclared state: "${nextState}"`);
      }
      if (currentState === nextState) {
        return false;
      }

      const previousState = currentState;
      currentState = nextState;

      for (const listener of [...stateListeners]) {
        try {
          listener(currentState, previousState);
        } catch (e) {
          console.error('[StateManager] State listener error:', e);
        }
      }
      return true;
    },

    /**
     * Subscribes to state changes in registration order. Each notification uses
     * a snapshot: additions and removals affect subsequent notifications only.
     */
    onStateChange(fn) {
      const listener = (next, previous) => fn(next, previous);
      stateListeners.push(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const idx = stateListeners.indexOf(listener);
        if (idx !== -1) stateListeners.splice(idx, 1);
      };
    },

    /**
     * Retrieves a runtime variable value.
     */
    getVar(key, defaultValue = undefined) {
      return vars.has(key) ? vars.get(key) : defaultValue;
    },

    /**
     * Sets a runtime variable.
     */
    setVar(key, value) {
      const prev = vars.get(key);
      vars.set(key, value);

      const listeners = varListeners.get(key);
      if (listeners) {
        for (const fn of [...listeners]) {
          try {
            fn(value, prev);
          } catch (e) {
            console.error(`[StateManager] Var listener error on ${key}:`, e);
          }
        }
      }
    },

    /**
     * Increments a numeric runtime variable.
     */
    incrementVar(key, amount = 1) {
      const current = Number(this.getVar(key, 0));
      const next = current + amount;
      this.setVar(key, next);
      return next;
    },

    /**
     * Subscribes to variable changes in registration order. Each notification uses
     * a snapshot: additions and removals affect subsequent notifications only.
     */
    onVarChange(key, fn) {
      if (!varListeners.has(key)) {
        varListeners.set(key, []);
      }
      const listener = (value, previous) => fn(value, previous);
      varListeners.get(key).push(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const list = varListeners.get(key);
        if (list) {
          const idx = list.indexOf(listener);
          if (idx !== -1) list.splice(idx, 1);
        }
      };
    },

    /**
     * Returns a snapshot object of all declared runtime variables.
     */
    getAllVars() {
      return Object.fromEntries(vars);
    },

    /**
     * Resets state and variables without notifying listeners.
     * An undeclared target throws before state or variables change.
     */
    reset(state = initialState, newVars = initialVars) {
      if (!stateSet.has(state)) {
        throw new Error(`Invalid state reset to undeclared state: "${state}"`);
      }
      currentState = state;
      vars.clear();
      for (const [k, v] of Object.entries(newVars)) {
        vars.set(k, v);
      }
    }
  };
}
