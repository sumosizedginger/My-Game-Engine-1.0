/** Source parameters for the bounded Proof C world. No runtime objects belong here. */
export const WORLD_PARAMETER_BOUNDS = Object.freeze({
  seed: [0, 4294967295, 87122],
  worldSize: [96, 160, 128],
  terrainResolution: [64, 192, 128],
  heightAmplitude: [0, 8, 5],
  terrainFrequency: [0.006, 0.025, 0.018],
  moistureFrequency: [0.01, 0.06, 0.028],
  forestThreshold: [0.3, 0.7, 0.48],
  treeDensity: [0, 0.06, 0.035],
  groundCoverDensity: [0, 0.6, 0.3],
  treeScaleMin: [0.7, 1.2, 0.85],
  treeScaleMax: [1.2, 1.8, 1.5],
  maxTreeSlope: [0.1, 0.5, 0.32]
});

export function createWorldRecipe(input = {}) {
  const diagnostics = [];
  const source = input?.parameters ?? input ?? {};
  const parameters = {};
  for (const [name, [min, max, fallback]] of Object.entries(WORLD_PARAMETER_BOUNDS)) {
    const raw = source[name];
    let value = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
    if (name === 'seed' || name === 'terrainResolution') value = Math.floor(value);
    parameters[name] = value;
    if (raw !== undefined && raw !== value) diagnostics.push({
      severity: 'WARN', code: 'WORLD_PARAMETER_NORMALIZED', subsystem: 'world',
      message: `Normalized ${name}`, data: { parameter: name, value }
    });
  }
  return Object.freeze({ type: 'world_recipe', version: 1, parameters: Object.freeze(parameters), diagnostics: Object.freeze(diagnostics) });
}

/** Non-cryptographic world-data checksum, not a replacement for definition identity. */
export function worldDataHash(data) {
  const canonical = value => {
    if (ArrayBuffer.isView(value)) return Array.from(value);
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  };
  const text = JSON.stringify(canonical(data));
  let a = 2166136261, b = 3339675911;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export function seededUnit(seed, x, z = 0) {
  let n = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
