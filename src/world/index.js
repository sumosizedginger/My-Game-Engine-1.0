import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createWorldRecipe, seededUnit, worldDataHash } from './recipe.js';
import { createWorldFieldCache, createWorldFieldQuery } from './fields.js';
import { createWorldVolumeQuery } from './volumes.js';
export { createWorldRecipe, worldDataHash, createWorldFieldCache, createWorldFieldQuery, createWorldVolumeQuery };

export function createTerrainGeometry(cache) {
  const { resolution: n, spacing, half, height, forest } = cache;
  const positions = new Float32Array(height.length * 3), colors = new Float32Array(height.length * 3), indices = [];
  for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
    const i = z * (n + 1) + x, f = forest[i];
    positions.set([x * spacing - half, height[i], z * spacing - half], i * 3);
    // Linear-space earth/grass palette blended by the same ecological field.
    colors.set([0.20 - 0.11 * f, 0.29 - 0.15 * f, 0.075 - 0.025 * f], i * 3);
    if (x < n && z < n) indices.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function generateWorld(input = {}) {
  const started = performance.now(), recipe = createWorldRecipe(input), p = recipe.parameters;
  const cache = createWorldFieldCache(recipe), fields = createWorldFieldQuery(cache);
  const volumes = createWorldVolumeQuery(cache.half), trees = [], cover = [];
  const attempts = Math.ceil(p.worldSize ** 2 * p.treeDensity * 3);
  for (let i = 0; i < attempts; i++) {
    const x = (seededUnit(p.seed + 300, i) - 0.5) * (p.worldSize - 6);
    const z = (seededUnit(p.seed + 301, i) - 0.5) * (p.worldSize - 6);
    const s = fields.sample(x, z);
    if (s.slope > p.maxTreeSlope || seededUnit(p.seed + 302, i) > s.forestWeight * 0.65 || Math.hypot(x, z) < 3) continue;
    const scale = p.treeScaleMin + seededUnit(p.seed + 303, i) * (p.treeScaleMax - p.treeScaleMin);
    const rotation = seededUnit(p.seed + 304, i) * Math.PI * 2, radius = 0.24 * scale;
    // Extend the upright trunk below its sloped footprint instead of leaving a gap.
    const baseHeights = Array.from({ length: 9 }, (_, side) => {
      const angle = side * Math.PI * 2 / 9 + rotation;
      return fields.heightAt(x + Math.sin(angle) * radius, z + Math.cos(angle) * radius);
    });
    const baseDepth = Math.max(0.01, s.height - Math.min(...baseHeights) + 0.01);
    const tree = Object.freeze({ id: `tree-${i}`, x, y: s.height, z, scale,
      rotation, radius, baseDepth, trunkHeight: 4.8 * scale,
      forestWeight: s.forestWeight, slope: s.slope });
    if (volumes.overlaps({ x, z, radius: 2.4 * scale, minY: tree.y, maxY: tree.y + tree.trunkHeight }).length) continue;
    trees.push(tree); volumes.add(tree);
  }
  for (let i = 0; i < p.worldSize ** 2 * p.groundCoverDensity; i++) {
    const x = (seededUnit(p.seed + 501, i) - 0.5) * (p.worldSize - 2);
    const z = (seededUnit(p.seed + 502, i) - 0.5) * (p.worldSize - 2);
    const s = fields.sample(x, z);
    if (s.slope > p.maxTreeSlope || seededUnit(p.seed + 505, i) > 1 - s.forestWeight * 0.6 ||
      volumes.overlaps({ x, z, radius: 0.3, minY: s.height, maxY: s.height + 0.6 }).length) continue;
    cover.push(Object.freeze({ id: `cover-${i}`, x, y: s.height, z, normal: s.normal,
      scale: 0.3 + seededUnit(p.seed + 503, i) * 0.5, rotation: seededUnit(p.seed + 504, i) * Math.PI * 2,
      forestWeight: s.forestWeight }));
  }
  const terrain = createTerrainGeometry(cache);
  const hashes = { fields: cache.hash, terrain: worldDataHash({ positions: terrain.attributes.position.array, indices: terrain.index.array }),
    placements: worldDataHash({ trees, cover }), volumes: worldDataHash(volumes.records) };
  let disposed = false;
  return { recipe, cache, fields, volumes, trees: Object.freeze(trees), cover: Object.freeze(cover), terrain, hashes,
    diagnostics: [...recipe.diagnostics], timings: { fieldsMs: cache.generationMs, generationMs: performance.now() - started },
    dispose() { if (!disposed) { terrain.dispose(); disposed = true; } }, get disposed() { return disposed; } };
}
