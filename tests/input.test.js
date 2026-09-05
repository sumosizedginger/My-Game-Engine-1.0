import test from 'node:test';
import assert from 'node:assert/strict';

import { createInputSystem } from '../src/runtime/input.js';

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
