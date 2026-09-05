/**
 * My Game Engine 1.0 — Material Forge: Definition & Parameters
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Defines machine-readable, deterministic material parameters, bounds,
 * and declarative definition constructors.
 * Follows ARCHITECTURE.md §24 and MATERIAL_FORGE.md.
 */

export const MATERIAL_PARAMETER_BOUNDS = Object.freeze({
  roughness: { min: 0.0, max: 1.0, default: 0.65 },
  metalness: { min: 0.0, max: 1.0, default: 0.05 },
  emissiveIntensity: { min: 0.0, max: 10.0, default: 1.0 }
});

let _materialCounter = 0;

/**
  * Parses and normalizes a color input to a 24-bit integer hex value.
  *
  * @param {number|string} colorInput
  * @param {number} [defaultColor=0x888888]
  * @returns {{ color: number, valid: boolean }}
  */
export function normalizeColor(colorInput, defaultColor = 0x888888) {
  if (typeof colorInput === 'number' && !Number.isNaN(colorInput)) {
    return { color: Math.max(0, Math.min(0xffffff, Math.floor(colorInput))), valid: true };
  }
  if (typeof colorInput === 'string') {
    let clean = colorInput.trim().replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      const parsed = parseInt(clean, 16);
      if (!Number.isNaN(parsed)) {
        return { color: Math.max(0, Math.min(0xffffff, parsed)), valid: true };
      }
    }
  }
  return { color: defaultColor, valid: false };
}

/**
 * Resolves raw material parameters against schema bounds.
 *
 * @param {object} [raw={}]
 * @returns {object} { parameters, diagnostics }
 */
export function resolveMaterialParameters(raw = {}) {
  const diagnostics = [];
  const input = typeof raw === 'object' && raw !== null ? raw : {};

  const rawColor = input.color ?? input.baseColor;
  const colRes = normalizeColor(rawColor, 0x888888);
  if (rawColor !== undefined && !colRes.valid) {
    diagnostics.push({
      severity: 'WARN',
      code: 'MAT_INVALID_COLOR',
      message: `Invalid color specification "${rawColor}", falling back to default 0x888888`
    });
  }

  const rawEmissive = input.emissive;
  const emRes = normalizeColor(rawEmissive, 0x000000);
  if (rawEmissive !== undefined && !emRes.valid) {
    diagnostics.push({
      severity: 'WARN',
      code: 'MAT_INVALID_EMISSIVE',
      message: `Invalid emissive specification "${rawEmissive}", falling back to 0x000000`
    });
  }

  const wireframe = Boolean(input.wireframe);

  const resolved = {
    color: colRes.color,
    emissive: emRes.color,
    wireframe
  };

  for (const [key, bounds] of Object.entries(MATERIAL_PARAMETER_BOUNDS)) {
    let val = input[key];
    if (typeof val !== 'number' || Number.isNaN(val)) {
      val = bounds.default;
    } else if (val < bounds.min) {
      diagnostics.push({
        severity: 'WARN',
        code: 'MAT_PARAM_CLAMPED_MIN',
        message: `Material parameter "${key}" (${val}) below min (${bounds.min}), clamped`
      });
      val = bounds.min;
    } else if (val > bounds.max) {
      diagnostics.push({
        severity: 'WARN',
        code: 'MAT_PARAM_CLAMPED_MAX',
        message: `Material parameter "${key}" (${val}) above max (${bounds.max}), clamped`
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
 * Creates a validated, immutable MaterialDefinition artifact.
 *
 * @param {object} [options={}]
 * @returns {object} Frozen MaterialDefinition.
 */
export function createMaterialDefinition(options = {}) {
  _materialCounter += 1;
  const id = options.id || `mat_def_${_materialCounter}`;
  const { parameters, diagnostics } = resolveMaterialParameters(options.parameters || options);

  return Object.freeze({
    id,
    type: 'material',
    diagnostics: Object.freeze([...diagnostics]),
    data: Object.freeze({
      type: 'pbr_standard',
      name: options.name || id,
      parameters,
      diagnostics
    })
  });
}
