import test from 'node:test';
import assert from 'node:assert/strict';

import { createSimulationClock } from '../src/runtime/clock.js';

test('simulation clock: fixedDelta matches configured tick rate', () => {
  const clock60 = createSimulationClock({ tickRate: 60 });
  assert.ok(Math.abs(clock60.fixedDelta - (1 / 60)) < 1e-6);

  const clock30 = createSimulationClock({ tickRate: 30 });
  assert.ok(Math.abs(clock30.fixedDelta - (1 / 30)) < 1e-6);
});

for (const invalid of [NaN, Infinity, -Infinity]) {
  test(`simulation clock: rejects ${invalid} without changing subsequent fixed steps`, () => {
    const clock = createSimulationClock();
    const control = createSimulationClock();
    const actualTicks = [], expectedTicks = [];
    const actualStep = (dt, tick) => actualTicks.push({ dt, tick });
    const expectedStep = (dt, tick) => expectedTicks.push({ dt, tick });

    // Preserve both completed ticks and a partial step across rejection.
    assert.deepEqual(clock.advance(20, actualStep), control.advance(20, expectedStep));
    const elapsed = clock.elapsedTime;
    const ticks = clock.totalTicks;
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.throws(() => clock.advance(invalid, actualStep), {
        name: 'TypeError', message: 'Simulation deltaMs must be a finite number'
      });
      assert.equal(clock.elapsedTime, elapsed);
      assert.equal(clock.totalTicks, ticks);
      assert.deepEqual(actualTicks, expectedTicks);
    }
    for (const delta of [10, 100, 0, -10, 1000, 10, 10]) {
      const result = clock.advance(delta, actualStep);
      assert.deepEqual(result, control.advance(delta, expectedStep));
      assert.ok(Number.isFinite(result.alpha));
      assert.deepEqual(actualTicks, expectedTicks);
      assert.equal(clock.elapsedTime, control.elapsedTime);
    }
  });
}

test('simulation clock: rejects non-number deltas without numeric coercion', () => {
  const clock = createSimulationClock();
  for (const invalid of [undefined, null, '100', false, {}, 100n]) {
    assert.throws(() => clock.advance(invalid, () => assert.fail('invalid input stepped')), TypeError);
    assert.equal(clock.totalTicks, 0);
    assert.equal(clock.elapsedTime, 0);
  }
  assert.deepEqual(clock.advance(0, () => {}), { steps: 0, alpha: 0, totalTicks: 0 });
});

test('simulation clock: rejection preserves reset, finite clamping and max-step behavior', () => {
  const clock = createSimulationClock({ tickRate: 50, maxSubSteps: 2 });
  const ticks = [];
  const step = (dt, tick) => ticks.push({ dt, tick });
  assert.deepEqual(clock.advance(10, step), { steps: 0, alpha: 0.5, totalTicks: 0 });
  assert.throws(() => clock.advance(NaN, step), TypeError);
  assert.deepEqual(clock.advance(-100, step), { steps: 0, alpha: 0.5, totalTicks: 0 });
  assert.deepEqual(clock.advance(1000, step), { steps: 2, alpha: 0, totalTicks: 2 });
  assert.equal(clock.elapsedTime, 0.26);
  assert.deepEqual(ticks, [{ dt: 0.02, tick: 0 }, { dt: 0.02, tick: 1 }]);
  clock.advance(10, step);
  clock.reset();
  clock.reset();
  assert.equal(clock.elapsedTime, 0);
  assert.equal(clock.totalTicks, 0);
  assert.deepEqual(clock.advance(10, step), { steps: 0, alpha: 0.5, totalTicks: 0 });
  assert.deepEqual(clock.advance(10, step), { steps: 1, alpha: 0, totalTicks: 1 });
  assert.deepEqual(ticks.at(-1), { dt: 0.02, tick: 0 });
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
