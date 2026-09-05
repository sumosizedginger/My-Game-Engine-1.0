/**
 * My Game Engine 1.0 — Geometry Forge: Definition & Parameters
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Defines machine-readable parameters, bounds, and constructors for
 * procedural geometry and room definitions.
 * Follows ARCHITECTURE.md §20 & §21 and GEOMETRY_FORGE.md.
 */

export const ROOM_PARAMETER_BOUNDS = Object.freeze({
  width: { min: 8.0, max: 48.0, default: 16.0 },          // Arena width along X (meters)
  depth: { min: 8.0, max: 48.0, default: 16.0 },          // Arena depth along Z (meters)
  wallHeight: { min: 2.0, max: 8.0, default: 3.5 },       // Enclosing wall height (meters)
  wallThickness: { min: 0.2, max: 1.5, default: 0.4 },    // Wall thickness (meters)
  floorThickness: { min: 0.1, max: 1.0, default: 0.3 }    // Floor slab thickness below ground (meters)
});

export const PILLAR_PARAMETER_BOUNDS = Object.freeze({
  radius: { min: 0.3, max: 2.0, default: 0.75 },          // Column radius (meters)
  height: { min: 1.0, max: 8.0, default: 3.5 }            // Column height (meters)
});

export const ROOM_PRESETS = Object.freeze({
  combat_arena: Object.freeze({
    width: 16.0,
    depth: 16.0,
    wallHeight: 3.5,
    wallThickness: 0.4,
    floorThickness: 0.3,
    pillars: Object.freeze([
      Object.freeze({ id: 'pillar_1', x: -3.5, z: -2.5, radius: 0.75, height: 3.5 }),
      Object.freeze({ id: 'pillar_2', x: 3.5, z: 2.5, radius: 0.75, height: 3.5 })
    ])
  }),
  small_chamber: Object.freeze({
    width: 10.0,
    depth: 10.0,
    wallHeight: 3.0,
    wallThickness: 0.3,
    floorThickness: 0.2,
    pillars: Object.freeze([])
  })
});

/**
 * Resolves room parameters against schema bounds.
 *
 * @param {object|string} [input='combat_arena']
 * @returns {object} { parameters, diagnostics }
 */
export function resolveRoomParameters(input = 'combat_arena') {
  const diagnostics = [];
  let baseParams;

  if (typeof input === 'string') {
    if (ROOM_PRESETS[input]) {
      baseParams = { ...ROOM_PRESETS[input] };
    } else {
      diagnostics.push({
        severity: 'WARN',
        code: 'GEO_UNKNOWN_PRESET',
        message: `Unknown room preset "${input}", falling back to "combat_arena"`
      });
      baseParams = { ...ROOM_PRESETS.combat_arena };
    }
  } else if (input && typeof input === 'object') {
    const presetName = input.preset || 'combat_arena';
    const preset = ROOM_PRESETS[presetName] || ROOM_PRESETS.combat_arena;
    baseParams = { ...preset, ...input };
  } else {
    baseParams = { ...ROOM_PRESETS.combat_arena };
  }

  const resolved = {};
  for (const [key, bounds] of Object.entries(ROOM_PARAMETER_BOUNDS)) {
    let val = baseParams[key];
    if (typeof val !== 'number' || Number.isNaN(val)) {
      val = bounds.default;
      diagnostics.push({
        severity: 'WARN',
        code: 'GEO_INVALID_PARAM',
        message: `Parameter "${key}" was invalid, using default ${bounds.default}`
      });
    } else if (val < bounds.min) {
      diagnostics.push({
        severity: 'WARN',
        code: 'GEO_PARAM_CLAMPED_MIN',
        message: `Parameter "${key}" (${val}) below min (${bounds.min}), clamping`
      });
      val = bounds.min;
    } else if (val > bounds.max) {
      diagnostics.push({
        severity: 'WARN',
        code: 'GEO_PARAM_CLAMPED_MAX',
        message: `Parameter "${key}" (${val}) above max (${bounds.max}), clamping`
      });
      val = bounds.max;
    }
    resolved[key] = val;
  }

  // Preserve sanitized pillars
  resolved.pillars = Array.isArray(baseParams.pillars)
    ? baseParams.pillars.map((p, idx) => {
        let radius = typeof p.radius === 'number' ? p.radius : PILLAR_PARAMETER_BOUNDS.radius.default;
        if (radius < PILLAR_PARAMETER_BOUNDS.radius.min) {
          diagnostics.push({
            severity: 'WARN',
            code: 'GEO_PILLAR_CLAMPED_MIN',
            message: `Pillar "${p.id || idx + 1}" radius (${radius}) below min (${PILLAR_PARAMETER_BOUNDS.radius.min}), clamping`
          });
          radius = PILLAR_PARAMETER_BOUNDS.radius.min;
        } else if (radius > PILLAR_PARAMETER_BOUNDS.radius.max) {
          diagnostics.push({
            severity: 'WARN',
            code: 'GEO_PILLAR_CLAMPED_MAX',
            message: `Pillar "${p.id || idx + 1}" radius (${radius}) above max (${PILLAR_PARAMETER_BOUNDS.radius.max}), clamping`
          });
          radius = PILLAR_PARAMETER_BOUNDS.radius.max;
        }

        let height = typeof p.height === 'number' ? p.height : resolved.wallHeight;
        const maxHeight = Math.min(PILLAR_PARAMETER_BOUNDS.height.max, resolved.wallHeight);
        if (height < PILLAR_PARAMETER_BOUNDS.height.min) {
          diagnostics.push({
            severity: 'WARN',
            code: 'GEO_PILLAR_CLAMPED_MIN',
            message: `Pillar "${p.id || idx + 1}" height (${height}) below min (${PILLAR_PARAMETER_BOUNDS.height.min}), clamping`
          });
          height = PILLAR_PARAMETER_BOUNDS.height.min;
        } else if (height > maxHeight) {
          diagnostics.push({
            severity: 'WARN',
            code: 'GEO_PILLAR_CLAMPED_MAX',
            message: `Pillar "${p.id || idx + 1}" height (${height}) above max (${maxHeight}), clamping`
          });
          height = maxHeight;
        }

        return {
          id: p.id || `pillar_${idx + 1}`,
          x: typeof p.x === 'number' ? p.x : 0,
          z: typeof p.z === 'number' ? p.z : 0,
          radius,
          height
        };
      })
    : [];

  return {
    parameters: Object.freeze(resolved),
    diagnostics
  };
}

/**
 * Creates a validated, immutable RoomDefinition artifact.
 *
 * @param {object} [options={}]
 * @returns {object} Frozen RoomDefinition.
 */
export function createRoomDefinition(options = {}) {
  const id = options.id || 'room_combat_default';
  const rawPreset = typeof options.parameters === 'string' ? options.parameters : (options.preset || 'combat_arena');
  const resolvedPresetName = ROOM_PRESETS[rawPreset] ? rawPreset : 'combat_arena';
  const { parameters, diagnostics } = resolveRoomParameters(options.parameters || options.preset || 'combat_arena');

  return Object.freeze({
    id,
    type: 'geometry_room',
    diagnostics: Object.freeze([...diagnostics]),
    data: Object.freeze({
      type: 'enclosed_arena',
      preset: resolvedPresetName,
      parameters,
      diagnostics
    })
  });
}
