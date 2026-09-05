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
