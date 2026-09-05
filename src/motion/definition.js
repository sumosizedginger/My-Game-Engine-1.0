/**
 * My Game Engine 1.0 — Motion Forge: Definition & Parameters
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Defines machine-readable locomotion parameters, parameter bounds,
 * presets, and parameter resolution logic.
 * Follows ARCHITECTURE.md §20.3 & §22 and MOTION_FORGE.md.
 */

export const MOTION_PARAMETER_BOUNDS = Object.freeze({
  cadence: { min: 60, max: 160, default: 112 },           // Steps per minute
  strideLength: { min: 0.60, max: 2.00, default: 1.30 },   // Meters per full 2-step cycle
  verticalBounce: { min: 0.005, max: 0.060, default: 0.028 }, // Meters of pelvis bounce
  pelvisRoll: { min: 0.01, max: 0.15, default: 0.065 },    // Radians of pelvic lateral tilt
  pelvisYaw: { min: 0.02, max: 0.20, default: 0.090 },     // Radians of pelvic transverse rotation
  lateralSway: { min: 0.005, max: 0.060, default: 0.022 }, // Meters of lateral weight shift
  armSwing: { min: 0.10, max: 0.80, default: 0.38 },       // Radians of shoulder swing
  elbowFlex: { min: 0.10, max: 0.90, default: 0.45 },      // Radians of elbow flexion during forward swing
  wristLag: { min: 0.02, max: 0.25, default: 0.08 },       // Radians of wrist secondary lag
  torsoCounter: { min: 0.30, max: 1.00, default: 0.75 },   // Torso counter-rotation factor relative to pelvis
  stepHeight: { min: 0.02, max: 0.12, default: 0.055 }     // Meters of foot clearance during swing
});

export const MOTION_PRESETS = Object.freeze({
  natural: Object.freeze({
    cadence: 112,
    strideLength: 1.30,
    verticalBounce: 0.028,
    pelvisRoll: 0.065,
    pelvisYaw: 0.090,
    lateralSway: 0.022,
    armSwing: 0.38,
    elbowFlex: 0.45,
    wristLag: 0.08,
    torsoCounter: 0.75,
    stepHeight: 0.055
  }),
  energetic: Object.freeze({
    cadence: 128,
    strideLength: 1.50,
    verticalBounce: 0.038,
    pelvisRoll: 0.080,
    pelvisYaw: 0.110,
    lateralSway: 0.026,
    armSwing: 0.52,
    elbowFlex: 0.60,
    wristLag: 0.12,
    torsoCounter: 0.85,
    stepHeight: 0.070
  }),
  stroll: Object.freeze({
    cadence: 92,
    strideLength: 1.10,
    verticalBounce: 0.018,
    pelvisRoll: 0.045,
    pelvisYaw: 0.065,
    lateralSway: 0.016,
    armSwing: 0.25,
    elbowFlex: 0.30,
    wristLag: 0.05,
    torsoCounter: 0.60,
    stepHeight: 0.040
  })
});

/**
 * Resolves motion parameters against schema bounds.
 *
 * @param {string|object} [input='natural']
 * @returns {object} { parameters, diagnostics }
 */
export function resolveMotionParameters(input = 'natural') {
  const diagnostics = [];
  let baseParams = { ...MOTION_PRESETS.natural };

  if (typeof input === 'string') {
    if (MOTION_PRESETS[input]) {
      baseParams = { ...MOTION_PRESETS[input] };
    } else {
      diagnostics.push({
        severity: 'WARN',
        code: 'MOTION_UNKNOWN_PRESET',
        message: `Unknown motion preset "${input}", defaulting to "natural"`
      });
    }
  } else if (input && typeof input === 'object') {
    if (input.preset && MOTION_PRESETS[input.preset]) {
      baseParams = { ...MOTION_PRESETS[input.preset] };
    }
    Object.assign(baseParams, input);
  }

  const resolved = {};
  for (const [key, bounds] of Object.entries(MOTION_PARAMETER_BOUNDS)) {
    let val = baseParams[key];
    if (typeof val !== 'number' || Number.isNaN(val)) {
      val = bounds.default;
      diagnostics.push({
        severity: 'WARN',
        code: 'MOTION_INVALID_PARAM',
        message: `Parameter "${key}" invalid, defaulted to ${bounds.default}`
      });
    } else if (val < bounds.min) {
      diagnostics.push({
        severity: 'WARN',
        code: 'MOTION_PARAM_CLAMPED_MIN',
        message: `Parameter "${key}" clamped to min ${bounds.min}`
      });
      val = bounds.min;
    } else if (val > bounds.max) {
      diagnostics.push({
        severity: 'WARN',
        code: 'MOTION_PARAM_CLAMPED_MAX',
        message: `Parameter "${key}" clamped to max ${bounds.max}`
      });
      val = bounds.max;
    }
    resolved[key] = val;
  }

  return {
    parameters: Object.freeze(resolved),
    diagnostics
  };
}

/**
 * Creates a validated MotionDefinition artifact.
 *
 * @param {object} [options={}]
 * @returns {object} Frozen MotionDefinition.
 */
export function createMotionDefinition(options = {}) {
  const id = options.id || 'motion_walk_default';
  const { parameters, diagnostics } = resolveMotionParameters(options.parameters || 'natural');

  return Object.freeze({
    id,
    type: 'motion',
    data: Object.freeze({
      type: 'bipedal_locomotion',
      preset: typeof options.parameters === 'string' ? options.parameters : 'custom',
      parameters,
      diagnostics
    })
  });
}
