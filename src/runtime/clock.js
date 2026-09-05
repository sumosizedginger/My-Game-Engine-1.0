/**
 * My Game Engine 1.0 — Fixed-Step Simulation Clock
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Implements deterministic accumulator-based fixed-step scheduling.
 * Follows GAMEPLAY_FOUNDATION.md §4 and ARCHITECTURE.md §10.
 */

/**
 * Creates a fixed-step simulation clock.
 *
 * @param {object} [options={}] - Configuration options.
 * @param {number} [options.tickRate=60] - Target ticks per second (Hz).
 * @param {number} [options.maxSubSteps=10] - Max simulation steps per frame to avoid spiral of death.
 * @returns {object} Simulation clock interface.
 */
export function createSimulationClock({
  tickRate = 60,
  maxSubSteps = 10
} = {}) {
  const fixedDelta = 1 / tickRate;
  let accumulator = 0;
  let totalTicks = 0;
  let elapsedTime = 0;

  return {
    get fixedDelta() {
      return fixedDelta;
    },
    get totalTicks() {
      return totalTicks;
    },
    get elapsedTime() {
      return elapsedTime;
    },
    get tickRate() {
      return tickRate;
    },

    /**
     * Advances the simulation clock by real elapsed time.
     *
     * @param {number} deltaMs - Elapsed frame time in milliseconds.
     * @param {Function} stepFn - Callback executed for each fixed simulation step: stepFn(fixedDelta, tickIndex).
     * @returns {object} { steps: number, alpha: number, totalTicks: number }
     */
    advance(deltaMs, stepFn) {
      if (typeof stepFn !== 'function') {
        throw new TypeError('Simulation stepFn must be a function');
      }

      // Convert ms to seconds and clamp to 250ms max frame delay to prevent spiral of death
      const dt = Math.min(Math.max(0, deltaMs) / 1000, 0.25);
      accumulator += dt;
      elapsedTime += dt;

      let steps = 0;
      while (accumulator >= fixedDelta && steps < maxSubSteps) {
        stepFn(fixedDelta, totalTicks);
        totalTicks++;
        accumulator -= fixedDelta;
        steps++;
      }

      // If still accumulating beyond maxSubSteps, discard residue to maintain real-time pacing
      if (steps >= maxSubSteps) {
        accumulator = 0;
      }

      // Interpolation alpha between previous and current step for smooth rendering
      const alpha = Math.min(Math.max(0, accumulator / fixedDelta), 1.0);

      return {
        steps,
        alpha,
        totalTicks
      };
    },

    /**
     * Resets the clock accumulator and counters.
     */
    reset() {
      accumulator = 0;
      totalTicks = 0;
      elapsedTime = 0;
    }
  };
}
