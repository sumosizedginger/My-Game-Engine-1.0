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

export const DEFAULT_GAMEPAD_BUTTON_BINDINGS = Object.freeze({
  0: 'Pause',    // South / A
  9: 'Pause',    // Start / Options
  3: 'Reset',    // North / Y
  8: 'Reset',    // Back / Select
  12: 'MoveUp',  // D-pad Up
  13: 'MoveDown' // D-pad Down
});

export const DEFAULT_GAMEPAD_AXIS_BINDINGS = Object.freeze([
  Object.freeze({
    axis: 1,
    negativeAction: 'MoveUp',
    positiveAction: 'MoveDown',
    deadzone: 0.4
  })
]);

/**
 * Creates an action-based input manager.
 *
 * @param {object} [options={}] - Options.
 * @param {Array<string>} [options.actions=DEFAULT_ACTIONS] - Declared action names.
 * @param {object} [options.keyboardBindings=DEFAULT_KEYBOARD_BINDINGS] - Key to action mapping.
 * @param {object} [options.gamepadButtonBindings] - Button index to action mapping.
 * @param {Array<object>} [options.gamepadAxisBindings] - Array of axis bindings.
 * @returns {object} Input system interface.
 */
export function createInputSystem({
  actions = DEFAULT_ACTIONS,
  keyboardBindings = DEFAULT_KEYBOARD_BINDINGS,
  gamepadButtonBindings = null,
  gamepadAxisBindings = null
} = {}) {
  const declaredActions = new Set(actions);
  const keyMap = { ...keyboardBindings };
  const gamepadButtonMap = new Map();
  const gamepadAxisMap = new Map();

  // Populate initial gamepad button bindings
  const initialButtons = gamepadButtonBindings !== null
    ? gamepadButtonBindings
    : (actions === DEFAULT_ACTIONS ? DEFAULT_GAMEPAD_BUTTON_BINDINGS : {});

  for (const [btnIndex, action] of Object.entries(initialButtons)) {
    if (declaredActions.has(action)) {
      gamepadButtonMap.set(Number(btnIndex), action);
    }
  }

  // Populate initial gamepad axis bindings
  const initialAxes = gamepadAxisBindings !== null
    ? gamepadAxisBindings
    : (actions === DEFAULT_ACTIONS ? DEFAULT_GAMEPAD_AXIS_BINDINGS : []);

  for (const binding of initialAxes) {
    if ((!binding.negativeAction || declaredActions.has(binding.negativeAction)) &&
        (!binding.positiveAction || declaredActions.has(binding.positiveAction))) {
      gamepadAxisMap.set(Number(binding.axis), {
        axis: Number(binding.axis),
        negativeAction: binding.negativeAction || null,
        positiveAction: binding.positiveAction || null,
        deadzone: typeof binding.deadzone === 'number' ? binding.deadzone : 0.4
      });
    }
  }

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
     * Binds a gamepad button index to a semantic action.
     *
     * @param {number} buttonIndex - Hardware button index (e.g. 0 for South/A).
     * @param {string|null} action - Semantic action name, or null to unbind.
     */
    bindGamepadButton(buttonIndex, action) {
      const idx = Number(buttonIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        throw new Error(`Invalid gamepad button index: ${buttonIndex}`);
      }
      if (action === null) {
        gamepadButtonMap.delete(idx);
        return;
      }
      if (!declaredActions.has(action)) {
        throw new Error(`Cannot bind gamepad button to undeclared action: ${action}`);
      }
      gamepadButtonMap.set(idx, action);
    },

    /**
     * Binds a gamepad analog axis to bidirectional semantic actions with deadzone.
     *
     * @param {number} axisIndex - Hardware axis index (e.g. 0 for Left X, 1 for Left Y).
     * @param {string|null} negativeAction - Action when axis is < -deadzone.
     * @param {string|null} positiveAction - Action when axis is > +deadzone.
     * @param {object} [options={}] - Configuration options.
     * @param {number} [options.deadzone=0.4] - Absolute deflection threshold [0, 1).
     */
    bindGamepadAxis(axisIndex, negativeAction = null, positiveAction = null, options = {}) {
      const idx = Number(axisIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        throw new Error(`Invalid gamepad axis index: ${axisIndex}`);
      }
      if (negativeAction !== null && !declaredActions.has(negativeAction)) {
        throw new Error(`Cannot bind gamepad axis to undeclared action: ${negativeAction}`);
      }
      if (positiveAction !== null && !declaredActions.has(positiveAction)) {
        throw new Error(`Cannot bind gamepad axis to undeclared action: ${positiveAction}`);
      }
      if (negativeAction === null && positiveAction === null) {
        gamepadAxisMap.delete(idx);
        return;
      }
      const deadzone = typeof options.deadzone === 'number' ? options.deadzone : 0.4;
      gamepadAxisMap.set(idx, {
        axis: idx,
        negativeAction: negativeAction || null,
        positiveAction: positiveAction || null,
        deadzone
      });
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
        // Poll buttons
        if (pad.buttons && typeof pad.buttons.length === 'number') {
          for (const [btnIndex, action] of gamepadButtonMap.entries()) {
            const btn = pad.buttons[btnIndex];
            const isPressed = btn && (typeof btn === 'object' ? Boolean(btn.pressed) : Boolean(btn));
            if (isPressed && declaredActions.has(action)) {
              activeState[action] = true;
            }
          }
        }

        // Poll axes
        if (pad.axes && typeof pad.axes.length === 'number') {
          for (const binding of gamepadAxisMap.values()) {
            const val = pad.axes[binding.axis];
            if (typeof val === 'number') {
              const dz = binding.deadzone;
              if (binding.negativeAction && val < -dz && declaredActions.has(binding.negativeAction)) {
                activeState[binding.negativeAction] = true;
              }
              if (binding.positiveAction && val > dz && declaredActions.has(binding.positiveAction)) {
                activeState[binding.positiveAction] = true;
              }
            }
          }
        }
      }

      // 3. Programmatic simulated actions (override or merge)
      for (const [action, isActive] of simulatedActions.entries()) {
        if (isActive && declaredActions.has(action)) {
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
