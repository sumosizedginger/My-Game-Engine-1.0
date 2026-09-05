/**
 * My Game Engine 1.0 — Action-Based Input System
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Decouples hardware keys and controllers into semantic actions.
 * Follows GAMEPLAY_FOUNDATION.md §5 and ARCHITECTURE.md §13.
 */

export const DEFAULT_ACTIONS = Object.freeze(['MoveUp', 'MoveDown', 'Pause', 'Reset']);

export const DEFAULT_KEYBOARD_BINDINGS = Object.freeze({
  KeyW: 'MoveUp',
  ArrowUp: 'MoveUp',
  KeyS: 'MoveDown',
  ArrowDown: 'MoveDown',
  KeyP: 'Pause',
  Space: 'Pause',
  KeyR: 'Reset'
});

/**
 * Creates an action-based input manager.
 *
 * @param {object} [options={}] - Options.
 * @param {Array<string>} [options.actions=DEFAULT_ACTIONS] - Declared action names.
 * @param {object} [options.keyboardBindings=DEFAULT_KEYBOARD_BINDINGS] - Key to action mapping.
 * @returns {object} Input system interface.
 */
export function createInputSystem({
  actions = DEFAULT_ACTIONS,
  keyboardBindings = DEFAULT_KEYBOARD_BINDINGS
} = {}) {
  const declaredActions = new Set(actions);
  const keyMap = { ...keyboardBindings };

  // Current raw device states
  const rawKeyStates = new Map();
  const simulatedActions = new Map();
  let activeGamepad = null;

  // Track key down and up
  function onKeyDown(event) {
    rawKeyStates.set(event.code, true);
  }

  function onKeyUp(event) {
    rawKeyStates.set(event.code, false);
  }

  return {
    /**
     * Rebinds a keyboard code to an action.
     */
    bindKey(code, action) {
      if (!declaredActions.has(action)) {
        throw new Error(`Cannot bind to undeclared action: ${action}`);
      }
      keyMap[code] = action;
    },

    /**
     * Programmatically simulates an action state (for automated tests / headless runs).
     */
    simulateAction(action, active = true) {
      if (!declaredActions.has(action)) {
        throw new Error(`Cannot simulate undeclared action: ${action}`);
      }
      simulatedActions.set(action, Boolean(active));
    },

    /**
     * Injects a gamepad object to poll (used for tests or standard Gamepad API).
     */
    setGamepad(gamepad) {
      activeGamepad = gamepad;
    },

    /**
     * Handles keyboard events manually.
     */
    handleKeyDown: onKeyDown,
    handleKeyUp: onKeyUp,

    /**
     * Attaches listener to a window or element.
     */
    attach(target) {
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener('keydown', onKeyDown);
        target.addEventListener('keyup', onKeyUp);
      }
    },

    /**
     * Detaches listener from window or element.
     */
    detach(target) {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
      }
      rawKeyStates.clear();
      simulatedActions.clear();
    },

    /**
     * Captures an immutable input snapshot for the fixed simulation step.
     * Game logic queries this snapshot throughout the step.
     *
     * @returns {object} Input snapshot.
     */
    captureSnapshot() {
      const activeState = {};
      for (const action of declaredActions) {
        activeState[action] = false;
      }

      // 1. Keyboard bindings
      for (const [code, isDown] of rawKeyStates.entries()) {
        if (isDown) {
          const action = keyMap[code];
          if (action && declaredActions.has(action)) {
            activeState[action] = true;
          }
        }
      }

      // 2. Gamepad bindings (polled hardware or injected object)
      const pad = activeGamepad || (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads()[0] : null);
      if (pad) {
        // Left stick Y axis (axis 1) or D-pad buttons (12 = up, 13 = down)
        const axisY = pad.axes && typeof pad.axes[1] === 'number' ? pad.axes[1] : 0;
        const buttonUp = pad.buttons && pad.buttons[12] && pad.buttons[12].pressed;
        const buttonDown = pad.buttons && pad.buttons[13] && pad.buttons[13].pressed;
        const buttonStart = pad.buttons && pad.buttons[9] && pad.buttons[9].pressed;
        const buttonSouth = pad.buttons && pad.buttons[0] && pad.buttons[0].pressed;
        const buttonNorth = pad.buttons && pad.buttons[3] && pad.buttons[3].pressed;
        const buttonBack = pad.buttons && pad.buttons[8] && pad.buttons[8].pressed;

        if (axisY < -0.4 || buttonUp) {
          activeState['MoveUp'] = true;
        }
        if (axisY > 0.4 || buttonDown) {
          activeState['MoveDown'] = true;
        }
        if (buttonStart || buttonSouth) {
          activeState['Pause'] = true;
        }
        if (buttonNorth || buttonBack) {
          activeState['Reset'] = true;
        }
      }

      // 3. Programmatic simulated actions (override or merge)
      for (const [action, isActive] of simulatedActions.entries()) {
        if (isActive) {
          activeState[action] = true;
        }
      }

      const frozenActions = Object.freeze(activeState);

      return Object.freeze({
        isActionActive(action) {
          return Boolean(frozenActions[action]);
        },
        getAllActions() {
          return frozenActions;
        }
      });
    },

    /**
     * Clears all active input states.
     */
    clear() {
      rawKeyStates.clear();
      simulatedActions.clear();
      activeGamepad = null;
    }
  };
}
