import test from 'node:test';
import assert from 'node:assert/strict';

import { createSimulationClock } from '../src/runtime/clock.js';

test('simulation clock: fixedDelta matches configured tick rate', () => {
  const clock60 = createSimulationClock({ tickRate: 60 });
  assert.ok(Math.abs(clock60.fixedDelta - (1 / 60)) < 1e-6);

  const clock30 = createSimulationClock({ tickRate: 30 });
  assert.ok(Math.abs(clock30.fixedDelta - (1 / 30)) < 1e-6);
});

test('simulation clock: accumulator steps exactly when threshold reached', () => {
  const clock = createSimulationClock({ tickRate: 60 }); // ~16.6667ms per step
  let stepsRun = 0;

  // 10ms is less than 16.67ms -> 0 steps
  const r1 = clock.advance(10, () => {
    stepsRun++;
  });
  assert.equal(r1.steps, 0);
  assert.equal(stepsRun, 0);
  assert.ok(r1.alpha > 0);

  // Another 10ms -> accumulated 20ms >= 16.67ms -> 1 step
  const r2 = clock.advance(10, () => {
    stepsRun++;
  });
  assert.equal(r2.steps, 1);
  assert.equal(stepsRun, 1);
  assert.equal(clock.totalTicks, 1);

  // 50ms -> 3 steps (50ms + residual ~3.33ms = ~53.33ms / 16.67ms = 3 steps)
  const r3 = clock.advance(50, () => {
    stepsRun++;
  });
  assert.equal(r3.steps, 3);
  assert.equal(stepsRun, 4);
  assert.equal(clock.totalTicks, 4);
});
