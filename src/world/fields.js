import { seededUnit, worldDataHash } from './recipe.js';

function noise(seed, x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const smooth = t => t * t * (3 - 2 * t);
  const u = smooth(x - ix), v = smooth(z - iz);
  const a = seededUnit(seed, ix, iz), b = seededUnit(seed, ix + 1, iz);
  const c = seededUnit(seed, ix, iz + 1), d = seededUnit(seed, ix + 1, iz + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

export function createWorldFieldCache(recipe) {
  const started = performance.now();
  const p = recipe.parameters, n = p.terrainResolution, count = (n + 1) ** 2;
  const height = new Float32Array(count), moisture = new Float32Array(count);
  const forest = new Float32Array(count);
  const spacing = p.worldSize / n, half = p.worldSize / 2;
  for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
    const wx = x * spacing - half, wz = z * spacing - half, i = z * (n + 1) + x;
    height[i] = p.heightAmplitude * (2 * noise(p.seed, wx * p.terrainFrequency, wz * p.terrainFrequency) - 1
      + 0.25 * (2 * noise(p.seed + 17, wx * p.terrainFrequency * 2, wz * p.terrainFrequency * 2) - 1));
    moisture[i] = noise(p.seed + 101, wx * p.moistureFrequency, wz * p.moistureFrequency);
    // A coherent meadow with a soft ecological fringe, also used by terrain color.
    const clearing = Math.exp(-((wx + 12) ** 2 + (wz - 8) ** 2) / 320);
    forest[i] = Math.max(0, Math.min(1, (moisture[i] - p.forestThreshold + 0.25) * 2.4)) * (1 - clearing);
  }
  return { recipe, resolution: n, spacing, half, height, moisture, forest,
    hash: worldDataHash({ height, moisture, forest }), generationMs: performance.now() - started };
}

/** Piecewise planar interpolation uses the very same diagonal as terrain indices. */
export function createWorldFieldQuery(cache) {
  const { resolution: n, spacing, half } = cache;
  function isInsideWorld(x, z) { return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= half && Math.abs(z) <= half; }
  function sample(x, z) {
    if (!isInsideWorld(x, z)) return null;
    const gx = (x + half) / spacing, gz = (z + half) / spacing;
    const ix = Math.min(n - 1, Math.floor(gx)), iz = Math.min(n - 1, Math.floor(gz));
    const u = gx - ix, v = gz - iz, a = iz * (n + 1) + ix;
    const ids = u + v <= 1 ? [a, a + 1, a + n + 1] : [a + n + 2, a + n + 1, a + 1];
    const weights = u + v <= 1 ? [1 - u - v, u, v] : [u + v - 1, 1 - u, 1 - v];
    const interpolate = field => ids.reduce((s, id, i) => s + field[id] * weights[i], 0);
    const h = cache.height;
    const dx = u + v <= 1 ? (h[a + 1] - h[a]) / spacing : (h[a + n + 2] - h[a + n + 1]) / spacing;
    const dz = u + v <= 1 ? (h[a + n + 1] - h[a]) / spacing : (h[a + n + 2] - h[a + 1]) / spacing;
    const length = Math.hypot(dx, 1, dz), weight = interpolate(cache.forest);
    return { height: interpolate(h), normal: { x: -dx / length, y: 1 / length, z: -dz / length },
      slope: Math.hypot(dx, dz), moisture: interpolate(cache.moisture), forestWeight: weight,
      biome: weight >= 0.45 ? 'forest' : 'meadow' };
  }
  return { sample, isInsideWorld, heightAt: (x, z) => sample(x, z)?.height ?? null };
}
