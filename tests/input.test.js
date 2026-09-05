import test from 'node:test';
import assert from 'node:assert/strict';

import { createInputSystem, selectActiveGamepad } from '../src/runtime/input.js';

test('input system: maps keyboard keys to semantic actions', () => {
  const input = createInputSystem();

  // Initially inactive
  let snapshot = input.captureSnapshot();
  assert.equal(snapshot.isActionActive('MoveUp'), false);
  assert.equal(snapshot.isActionActive('MoveDown'), false);

  // Key down KeyW -> MoveUp
  input.handleKeyDown({ code: 'KeyW' });
  snapshot = input.captureSnapshot();
  assert.equal(snapshot.isActionActive('MoveUp'), true);
  assert.equal(snapshot.isActionActive('MoveDown'), false);

  // Key up KeyW -> MoveUp turns off
  input.handleKeyUp({ code: 'KeyW' });
  snapshot = input.captureSnapshot();
  assert.equal(snapshot.isActionActive('MoveUp'), false);
});

test('input system: supports programmatic simulation for headless evaluation', () => {
  const input = createInputSystem();

  input.simulateAction('MoveDown', true);
  input.simulateAction('Pause', true);

  const snapshot = input.captureSnapshot();
  assert.equal(snapshot.isActionActive('MoveDown'), true);
  assert.equal(snapshot.isActionActive('Pause'), true);
  assert.equal(snapshot.isActionActive('MoveUp'), false);

  // Deactivate
  input.simulateAction('Pause', false);
  const snap2 = input.captureSnapshot();
  assert.equal(snap2.isActionActive('Pause'), false);
});

test('input system: maps gamepad axes and buttons to actions', () => {
  const input = createInputSystem();

  // Injected gamepad: Left stick tilted up (axis 1 = -0.85)
  const mockGamepad = {
    axes: [0, -0.85],
    buttons: [
      { pressed: false }, // 0 South
      { pressed: false },
      { pressed: false },
      { pressed: false },
      { pressed: false },
      { pressed: false },
      { pressed: false },
      { pressed: false },
      { pressed: false },
      { pressed: false }, // 9 Start
      { pressed: false },
      { pressed: false },
      { pressed: false }, // 12 D-pad Up
      { pressed: false }  // 13 D-pad Down
    ]
  };

  input.setGamepad(mockGamepad);
  const snap1 = input.captureSnapshot();
  assert.equal(snap1.isActionActive('MoveUp'), true);
  assert.equal(snap1.isActionActive('MoveDown'), false);

  // Button 9 (Start) pressed -> Pause
  mockGamepad.axes[1] = 0;
  mockGamepad.buttons[9].pressed = true;

  const snap2 = input.captureSnapshot();
  assert.equal(snap2.isActionActive('MoveUp'), false);
  assert.equal(snap2.isActionActive('Pause'), true);
});

test('input system: rejects binding to undeclared actions', () => {
  const input = createInputSystem({ actions: ['MoveUp', 'MoveDown'] });

  // Keyboard
  assert.throws(() => input.bindKey('KeyW', 'UnknownAction'), /undeclared action/);

  // Gamepad button
  assert.throws(() => input.bindGamepadButton(0, 'UnknownAction'), /undeclared action/);

  // Gamepad axis
  assert.throws(() => input.bindGamepadAxis(0, 'UnknownAction', 'MoveUp'), /undeclared action/);
  assert.throws(() => input.bindGamepadAxis(0, 'MoveUp', 'UnknownAction'), /undeclared action/);
});

test('input system: supports generic gamepad button and axis binding with deadzones', () => {
  const actions = ['MoveForward', 'MoveBackward', 'MoveLeft', 'MoveRight', 'Attack', 'Reset'];
  const input = createInputSystem({ actions });

  // Configure B2 controller bindings
  input.bindGamepadAxis(0, 'MoveLeft', 'MoveRight', { deadzone: 0.25 });
  input.bindGamepadAxis(1, 'MoveForward', 'MoveBackward', { deadzone: 0.25 });
  input.bindGamepadButton(0, 'Attack');
  input.bindGamepadButton(3, 'Reset');
  input.bindGamepadButton(8, 'Reset');
  input.bindGamepadButton(12, 'MoveForward');
  input.bindGamepadButton(13, 'MoveBackward');
  input.bindGamepadButton(14, 'MoveLeft');
  input.bindGamepadButton(15, 'MoveRight');

  const pad = {
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
  };
  input.setGamepad(pad);

  // 1. Neutral stick -> no movement
  let snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveForward'), false);
  assert.equal(snap.isActionActive('MoveBackward'), false);
  assert.equal(snap.isActionActive('MoveLeft'), false);
  assert.equal(snap.isActionActive('MoveRight'), false);

  // 2. Stick inside deadzone (< 0.25) -> no movement
  pad.axes[0] = 0.15;
  pad.axes[1] = -0.18;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveForward'), false, 'deadzone suppresses forward movement');
  assert.equal(snap.isActionActive('MoveRight'), false, 'deadzone suppresses lateral movement');

  // 3. Left stick tilted forward (axis 1 = -0.75 < -0.25) -> MoveForward
  pad.axes[0] = 0;
  pad.axes[1] = -0.75;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveForward'), true);
  assert.equal(snap.isActionActive('MoveBackward'), false);

  // 4. Left stick tilted backward (axis 1 = +0.80 > +0.25) -> MoveBackward
  pad.axes[1] = 0.80;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveForward'), false);
  assert.equal(snap.isActionActive('MoveBackward'), true);

  // 5. Left stick tilted left (axis 0 = -0.60) -> MoveLeft
  pad.axes[1] = 0;
  pad.axes[0] = -0.60;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveLeft'), true);
  assert.equal(snap.isActionActive('MoveRight'), false);

  // 6. Left stick tilted right (axis 0 = +0.65) -> MoveRight
  pad.axes[0] = 0.65;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveLeft'), false);
  assert.equal(snap.isActionActive('MoveRight'), true);
  pad.axes[0] = 0;

  // 7. D-Pad buttons 12, 13, 14, 15
  pad.buttons[12].pressed = true; // D-Pad Up
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveForward'), true);
  pad.buttons[12].pressed = false;

  pad.buttons[13].pressed = true; // D-Pad Down
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveBackward'), true);
  pad.buttons[13].pressed = false;

  pad.buttons[14].pressed = true; // D-Pad Left
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveLeft'), true);
  pad.buttons[14].pressed = false;

  pad.buttons[15].pressed = true; // D-Pad Right
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('MoveRight'), true);
  pad.buttons[15].pressed = false;

  // 8. Button South (0) -> Attack
  pad.buttons[0].pressed = true;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('Attack'), true);
  pad.buttons[0].pressed = false;

  // 9. Reset buttons (Button 3 and Button 8)
  pad.buttons[3].pressed = true;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('Reset'), true);
  pad.buttons[3].pressed = false;

  pad.buttons[8].pressed = true;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('Reset'), true);
  pad.buttons[8].pressed = false;

  // 10. Unbind button
  input.bindGamepadButton(0, null);
  pad.buttons[0].pressed = true;
  snap = input.captureSnapshot();
  assert.equal(snap.isActionActive('Attack'), false, 'unbound button does not trigger action');
});

test('gamepad discovery: selectActiveGamepad handles multi-slot arrays and disconnections', () => {
  const pad1 = { index: 1, id: 'Gamepad 1', connected: true, axes: [0, 0], buttons: [] };
  const pad2 = { index: 2, id: 'Gamepad 2', connected: true, axes: [0, 0], buttons: [] };

  // 1. Slot 0 null, controller at slot 1 -> controller IS detected
  const res1 = selectActiveGamepad([null, pad1, null, null]);
  assert.equal(res1, pad1);
  assert.equal(res1.index, 1);

  // 2. Slots 0 and 1 null, controller at slot 2 -> detected
  const res2 = selectActiveGamepad([null, null, pad2, null]);
  assert.equal(res2, pad2);
  assert.equal(res2.index, 2);

  // 3. Retains preferred controller while still connected
  const resRetain = selectActiveGamepad([null, pad1, pad2, null], 1);
  assert.equal(resRetain, pad1);

  // 4. Selected controller disconnects (null slot or connected: false) -> recovers to next valid controller
  const resRecovNull = selectActiveGamepad([null, null, pad2, null], 1);
  assert.equal(resRecovNull, pad2, 'recovers when preferred index becomes null');

  const disconnectedPad1 = { ...pad1, connected: false };
  const resRecovFlag = selectActiveGamepad([null, disconnectedPad1, pad2, null], 1);
  assert.equal(resRecovFlag, pad2, 'recovers when preferred index has connected: false');

  // 5. All slots null or disconnected -> returns null without throwing
  assert.equal(selectActiveGamepad([null, null, null, null]), null);
  assert.equal(selectActiveGamepad([disconnectedPad1, null]), null);
  assert.equal(selectActiveGamepad([]), null);
  assert.equal(selectActiveGamepad(null), null);
  assert.equal(selectActiveGamepad(undefined), null);
});

test('gamepad discovery: live navigator.getGamepads multi-slot polling and diagnostic status', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  try {
    const padSlot1 = {
      index: 1,
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
      mapping: 'standard',
      connected: true,
      axes: [0, -0.85], // tilted forward
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 })) // South pressed
    };

    let mockSlots = [null, padSlot1, null, null];
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        getGamepads: () => mockSlots
      },
      configurable: true,
      writable: true
    });

    const actions = ['MoveForward', 'MoveBackward', 'MoveLeft', 'MoveRight', 'Attack', 'Reset'];
    const input = createInputSystem({ actions });
    input.bindGamepadAxis(1, 'MoveForward', 'MoveBackward', { deadzone: 0.25 });
    input.bindGamepadButton(0, 'Attack');

    // 1. Discovers pad at slot 1 without calling setGamepad()
    const snap = input.captureSnapshot();
    assert.equal(snap.isActionActive('MoveForward'), true, 'discovers stick deflection at slot 1');
    assert.equal(snap.isActionActive('Attack'), true, 'discovers button press at slot 1');

    // 2. getGamepadStatus() reports machine-readable diagnostics
    const status = input.getGamepadStatus();
    assert.equal(status.detected, true);
    assert.equal(status.source, 'navigator');
    assert.equal(status.index, 1);
    assert.equal(status.id, 'Xbox Wireless Controller (STANDARD GAMEPAD)');
    assert.equal(status.mapping, 'standard');
    assert.equal(status.connected, true);
    assert.ok(status.activeActions.includes('MoveForward'));
    assert.ok(status.activeActions.includes('Attack'));

    // 3. Explicit setGamepad() overrides navigator polling
    const injectedPad = {
      index: 0,
      id: 'Injected Mock Pad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0.90], // backward
      buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
    };
    input.setGamepad(injectedPad);

    const snapInjected = input.captureSnapshot();
    assert.equal(snapInjected.isActionActive('MoveForward'), false);
    assert.equal(snapInjected.isActionActive('MoveBackward'), true);
    assert.equal(snapInjected.isActionActive('Attack'), false);

    const injectedStatus = input.getGamepadStatus();
    assert.equal(injectedStatus.source, 'injected');
    assert.equal(injectedStatus.id, 'Injected Mock Pad');

    // 4. Clearing injected pad restores navigator discovery
    input.setGamepad(null);
    const snapRestored = input.captureSnapshot();
    assert.equal(snapRestored.isActionActive('MoveForward'), true);
    assert.equal(snapRestored.isActionActive('Attack'), true);

    // 5. Controller disconnects in navigator
    mockSlots = [null, null, null, null];
    const snapDisconnected = input.captureSnapshot();
    assert.equal(snapDisconnected.isActionActive('MoveForward'), false);
    assert.equal(snapDisconnected.isActionActive('Attack'), false);

    const disconnStatus = input.getGamepadStatus();
    assert.equal(disconnStatus.detected, false);
    assert.equal(disconnStatus.connected, false);
    assert.equal(disconnStatus.activeActions.length, 0);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    } else {
      delete globalThis.navigator;
    }
  }
});
