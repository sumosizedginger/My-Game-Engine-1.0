/**
 * My Game Engine 1.0 — Character Forge: Definition & Parameters
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Defines machine-readable humanoid anatomical parameter domains,
 * presets, and parameter resolution logic.
 * Follows ARCHITECTURE.md §22 and CHARACTER_FORGE.md.
 */

/**
 * Raw parameter domain bounds.
 */
export const HUMANOID_PARAMETER_BOUNDS = Object.freeze({
  height: { min: 1.40, max: 2.20, default: 1.80 },
  shoulderWidth: { min: 0.32, max: 0.60, default: 0.44 },
  chestWidth: { min: 0.12, max: 0.28, default: 0.18 },
  chestDepth: { min: 0.08, max: 0.22, default: 0.13 },
  waistWidth: { min: 0.09, max: 0.24, default: 0.14 },
  waistDepth: { min: 0.07, max: 0.20, default: 0.11 },
  pelvisWidth: { min: 0.11, max: 0.26, default: 0.16 },
  pelvisDepth: { min: 0.08, max: 0.20, default: 0.12 },
  armLength: { min: 0.50, max: 0.90, default: 0.70 },
  armMass: { min: 0.60, max: 1.60, default: 1.00 },
  legLength: { min: 0.70, max: 1.20, default: 0.92 },
  legMass: { min: 0.60, max: 1.60, default: 1.00 },
  headScale: { min: 0.80, max: 1.30, default: 1.00 },
  neckLength: { min: 0.07, max: 0.18, default: 0.11 },
  neckThickness: { min: 0.04, max: 0.10, default: 0.06 },
  radialSegments: { min: 8, max: 32, default: 16 },
  torsoSegments: { min: 10, max: 32, default: 16 },
  limbSegments: { min: 8, max: 24, default: 12 }
});

/**
 * Standard character presets.
 */
export const HUMANOID_PRESETS = Object.freeze({
  average: Object.freeze({
    height: 1.80,
    shoulderWidth: 0.44,
    chestWidth: 0.18,
    chestDepth: 0.13,
    waistWidth: 0.14,
    waistDepth: 0.11,
    pelvisWidth: 0.16,
    pelvisDepth: 0.12,
    armLength: 0.70,
    armMass: 1.00,
    legLength: 0.92,
    legMass: 1.00,
    headScale: 1.00,
    neckLength: 0.11,
    neckThickness: 0.06,
    radialSegments: 16,
    torsoSegments: 16,
    limbSegments: 12
  }),
  athletic: Object.freeze({
    height: 1.85,
    shoulderWidth: 0.48,
    chestWidth: 0.20,
    chestDepth: 0.14,
    waistWidth: 0.13,
    waistDepth: 0.10,
    pelvisWidth: 0.15,
    pelvisDepth: 0.11,
    armLength: 0.72,
    armMass: 1.15,
    legLength: 0.95,
    legMass: 1.10,
    headScale: 0.98,
    neckLength: 0.12,
    neckThickness: 0.065,
    radialSegments: 16,
    torsoSegments: 16,
    limbSegments: 12
  }),
  heavy: Object.freeze({
    height: 1.78,
    shoulderWidth: 0.50,
    chestWidth: 0.23,
    chestDepth: 0.17,
    waistWidth: 0.20,
    waistDepth: 0.16,
    pelvisWidth: 0.19,
    pelvisDepth: 0.15,
    armLength: 0.68,
    armMass: 1.35,
    legLength: 0.88,
    legMass: 1.30,
    headScale: 1.05,
    neckLength: 0.10,
    neckThickness: 0.08,
    radialSegments: 16,
    torsoSegments: 16,
    limbSegments: 12
  })
});

/**
 * Resolves and validates raw parameters against parameter bounds.
 *
 * @param {object|string} [input='average'] - Preset name or parameter overrides.
 * @returns {object} { parameters, diagnostics }
 */
export function resolveHumanoidParameters(input = 'average') {
  const diagnostics = [];
  let baseParams = { ...HUMANOID_PRESETS.average };

  if (typeof input === 'string') {
    if (HUMANOID_PRESETS[input]) {
      baseParams = { ...HUMANOID_PRESETS[input] };
    } else {
      diagnostics.push({
        severity: 'WARN',
        code: 'CHAR_UNKNOWN_PRESET',
        message: `Unknown preset "${input}", falling back to "average"`
      });
    }
  } else if (input && typeof input === 'object') {
    if (input.preset && HUMANOID_PRESETS[input.preset]) {
      baseParams = { ...HUMANOID_PRESETS[input.preset] };
    }
    Object.assign(baseParams, input);
  }

  const resolved = {};
  for (const [key, bounds] of Object.entries(HUMANOID_PARAMETER_BOUNDS)) {
    let val = baseParams[key];
    if (typeof val !== 'number' || Number.isNaN(val)) {
      val = bounds.default;
      diagnostics.push({
        severity: 'WARN',
        code: 'CHAR_INVALID_PARAM',
        message: `Parameter "${key}" was invalid, using default ${bounds.default}`
      });
    } else if (val < bounds.min) {
      diagnostics.push({
        severity: 'WARN',
        code: 'CHAR_PARAM_CLAMPED_MIN',
        message: `Parameter "${key}" (${val}) below min (${bounds.min}), clamping`
      });
      val = bounds.min;
    } else if (val > bounds.max) {
      diagnostics.push({
        severity: 'WARN',
        code: 'CHAR_PARAM_CLAMPED_MAX',
        message: `Parameter "${key}" (${val}) above max (${bounds.max}), clamping`
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
 * Creates a validated CharacterDefinition.
 *
 * @param {object} [options={}]
 * @param {string} [options.id='char_humanoid_default']
 * @param {string|object} [options.parameters='average']
 * @returns {object} Frozen CharacterDefinition.
 */
export function createCharacterDefinition(options = {}) {
  const id = options.id || 'char_humanoid_default';
  const { parameters, diagnostics } = resolveHumanoidParameters(options.parameters || 'average');

  return Object.freeze({
    id,
    type: 'character',
    data: Object.freeze({
      preset: typeof options.parameters === 'string' ? options.parameters : 'custom',
      parameters,
      diagnostics
    })
  });
}
