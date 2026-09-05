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
 * Pure helper to select an active, connected Gamepad from a GamepadList or array.
 * Scans all available slots (ignoring null/stale entries) and preserves stable selection
 * while the preferred gamepad remains connected.
 *
 * @param {Array<object|null>} [gamepads=[]] - Slot array from navigator.getGamepads().
 * @param {number|null} [preferredIndex=null] - Index of currently locked gamepad to retain stability.
 * @returns {object|null} The selected active gamepad or null if none connected.
 */
export function selectActiveGamepad(gamepads, preferredIndex = null) {
  if (!gamepads || typeof gamepads.length !== 'number') {
    return null;
  }

  // 1. If preferredIndex is valid and that slot is still populated and connected, retain it
  if (preferredIndex !== null && Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < gamepads.length) {
    const pad = gamepads[preferredIndex];
    if (pad && pad.connected !== false) {
      return pad;
    }
  }

  // 2. Otherwise scan all slots for the first non-null, connected gamepad
  for (let i = 0; i < gamepads.length; i++) {
    const pad = gamepads[i];
    if (pad && pad.connected !== false) {
      return pad;
    }
  }

  return null;
}

function isDefaultProofAActions(act) {
  if (act === DEFAULT_ACTIONS) return true;
  if (!Array.isArray(act) || act.length !== DEFAULT_ACTIONS.length) return false;
  return DEFAULT_ACTIONS.every((a, idx) => act[idx] === a);
}

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

  // Populate initial gamepad button bindings (content-safe check for Proof A defaults)
  const isProofA = isDefaultProofAActions(actions);
  const initialButtons = gamepadButtonBindings !== null
    ? gamepadButtonBindings
    : (isProofA ? DEFAULT_GAMEPAD_BUTTON_BINDINGS : {});

  for (const [btnIndex, action] of Object.entries(initialButtons)) {
    if (declaredActions.has(action)) {
      gamepadButtonMap.set(Number(btnIndex), action);
    }
  }

  // Populate initial gamepad axis bindings (content-safe check for Proof A defaults)
  const initialAxes = gamepadAxisBindings !== null
    ? gamepadAxisBindings
    : (isProofA ? DEFAULT_GAMEPAD_AXIS_BINDINGS : []);

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
  let preferredGamepadIndex = null;

  function getLiveGamepad() {
    if (activeGamepad) {
      return activeGamepad;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      let rawPads;
      try {
        rawPads = navigator.getGamepads();
      } catch {
        rawPads = null;
      }
      const selected = selectActiveGamepad(rawPads, preferredGamepadIndex);
      if (selected) {
        preferredGamepadIndex = typeof selected.index === 'number' ? selected.index : null;
        return selected;
      }
      preferredGamepadIndex = null;
    }
    return null;
  }

  // Track key down and up
  function onKeyDown(event) {
    rawKeyStates.set(event.code, true);
  }

  function onKeyUp(event) {
    rawKeyStates.set(event.code, false);
  }

  function onGamepadConnected(event) {
    if (event && event.gamepad && event.gamepad.connected !== false) {
      if (preferredGamepadIndex === null) {
        preferredGamepadIndex = typeof event.gamepad.index === 'number' ? event.gamepad.index : null;
      }
    }
  }

  function onGamepadDisconnected(event) {
    if (event && event.gamepad && event.gamepad.index === preferredGamepadIndex) {
      preferredGamepadIndex = null;
    }
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
     * Attaches listeners to a window or event target.
     */
    attach(target) {
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener('keydown', onKeyDown);
        target.addEventListener('keyup', onKeyUp);

        // Connection events help maintain prompt preferred index updates
        target.addEventListener('gamepadconnected', onGamepadConnected);
        target.addEventListener('gamepaddisconnected', onGamepadDisconnected);
      }
    },

    /**
     * Detaches listeners from window or event target.
     */
    detach(target) {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
        target.removeEventListener('gamepadconnected', onGamepadConnected);
        target.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
      }
      rawKeyStates.clear();
      simulatedActions.clear();
      preferredGamepadIndex = null;
    },

    /**
     * Returns machine-readable hardware diagnostics for inspectability.
     */
    getGamepadStatus() {
      const pad = getLiveGamepad();
      if (!pad) {
        return {
          detected: false,
          source: activeGamepad ? 'injected' : 'navigator',
          index: null,
          id: null,
          mapping: null,
          connected: false,
          axesCount: 0,
          buttonsCount: 0,
          axes: [],
          buttons: [],
          activeActions: []
        };
      }

      const axes = [];
      if (pad.axes && typeof pad.axes.length === 'number') {
        for (let i = 0; i < pad.axes.length; i++) {
          axes.push(Number(pad.axes[i]) || 0);
        }
      }

      const buttons = [];
      if (pad.buttons && typeof pad.buttons.length === 'number') {
        for (let i = 0; i < pad.buttons.length; i++) {
          const b = pad.buttons[i];
          buttons.push(b && (typeof b === 'object' ? Boolean(b.pressed || b.value > 0.5) : Boolean(b > 0.5)));
        }
      }

      const activeActions = [];
      // Check buttons
      for (const [btnIndex, action] of gamepadButtonMap.entries()) {
        if (buttons[btnIndex] && declaredActions.has(action) && !activeActions.includes(action)) {
          activeActions.push(action);
        }
      }
      // Check axes
      for (const binding of gamepadAxisMap.values()) {
        const val = axes[binding.axis];
        if (typeof val === 'number') {
          const dz = binding.deadzone;
          if (binding.negativeAction && val < -dz && declaredActions.has(binding.negativeAction) && !activeActions.includes(binding.negativeAction)) {
            activeActions.push(binding.negativeAction);
          }
          if (binding.positiveAction && val > dz && declaredActions.has(binding.positiveAction) && !activeActions.includes(binding.positiveAction)) {
            activeActions.push(binding.positiveAction);
          }
        }
      }

      return {
        detected: true,
        source: activeGamepad ? 'injected' : 'navigator',
        index: typeof pad.index === 'number' ? pad.index : (preferredGamepadIndex !== null ? preferredGamepadIndex : 0),
        id: pad.id || 'Standard Gamepad',
        mapping: pad.mapping || 'non-standard',
        connected: pad.connected !== false,
        axesCount: axes.length,
        buttonsCount: buttons.length,
        axes,
        buttons,
        activeActions
      };
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
      const pad = getLiveGamepad();
      if (pad) {
        // Poll buttons
        if (pad.buttons && typeof pad.buttons.length === 'number') {
          for (const [btnIndex, action] of gamepadButtonMap.entries()) {
            const btn = pad.buttons[btnIndex];
            const isPressed = btn && (typeof btn === 'object' ? Boolean(btn.pressed || btn.value > 0.5) : Boolean(btn > 0.5));
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
      preferredGamepadIndex = null;
    }
  };
}
