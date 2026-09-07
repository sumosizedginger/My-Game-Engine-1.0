import { Mesh, MeshBasicMaterial, Raycaster, Vector3, Matrix4 } from 'three';
import { generateWorld } from '../../world/index.js';

// Independent rendered-triangle intersections, including off-grid sample points.
export function terrainQueryError(world) {
  const material = new MeshBasicMaterial(), mesh = new Mesh(world.terrain, material);
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  let error = 0;
  for (let i = 0; i < 64; i++) {
    const x = -world.cache.half + 0.317 + (i * 17.19) % (world.cache.half * 2 - 1);
    const z = -world.cache.half + 0.729 + (i * 31.73) % (world.cache.half * 2 - 1);
    ray.set(new Vector3(x, 30, z), down);
    const hit = ray.intersectObject(mesh)[0];
    error = Math.max(error, hit ? Math.abs(hit.point.y - world.fields.heightAt(x, z)) : Infinity);
  }
  material.dispose();
  return error;
}

export function runControlledWorldProof(game, view) {
  const world = game.world, checks = {}, metrics = { ...world.timings, hashes: world.hashes };
  const same = generateWorld(world.recipe), different = generateWorld({ ...world.recipe.parameters, seed: world.recipe.parameters.seed + 1 });
  try {
    checks.cFieldDeterminism = Object.keys(world.hashes).every(k => same.hashes[k] === world.hashes[k] && different.hashes[k] !== world.hashes[k]);
  } finally { same.dispose(); different.dispose(); }
  checks.cWorldGeneration = world.terrain.attributes.position.count > 4000 && world.trees.length > 0;
  metrics.terrainQueryError = terrainQueryError(world);
  checks.cTerrainQueryTruth = metrics.terrainQueryError < 1e-5;
  checks.cVegetationPlacement = [...world.trees, ...world.cover].every(r => {
    const s = world.fields.sample(r.x, r.z);
    return s && Math.abs(r.y - s.height) < 1e-7 && s.slope <= world.recipe.parameters.maxTreeSlope && r.forestWeight === s.forestWeight;
  });
  checks.cWorldVolumeQuery = world.trees.every((r, i) => world.volumes.records[i] === r &&
    world.volumes.overlaps({ x: r.x, z: r.z, radius: 0.1, minY: r.y, maxY: r.y + 1 }).includes(r) &&
    !world.volumes.overlaps({ x: r.x, z: r.z, radius: 0.1, minY: r.y + r.trunkHeight + 1, maxY: r.y + r.trunkHeight + 2 }).includes(r));
  // Inspect realized instance transforms, not just attached provenance metadata.
  checks.cVegetationRendering = Boolean(view?.trunks && view.trunks.count === world.trees.length && world.trees.every((r, i) => {
    const matrix = new Matrix4(); view.trunks.getMatrixAt(i, matrix);
    const base = new Vector3(0, -0.5, 0).applyMatrix4(matrix);
    const top = new Vector3(0, 0.5, 0).applyMatrix4(matrix);
    const radius = new Vector3(1, -0.5, 0).applyMatrix4(matrix).distanceTo(base);
    return base.distanceTo(new Vector3(r.x, r.y - r.baseDepth, r.z)) < 1e-5 && Math.abs(top.y - r.y - r.trunkHeight) < 1e-5 && Math.abs(radius - r.radius) < 1e-5;
  }));
  game.reset();
  let distance = 0, minHeight = Infinity, maxHeight = -Infinity, rootError = 0, ankleError = 0, soleMin = Infinity, stanceMax = -Infinity, overlaps = 0;
  const start = { ...game.transform.position };
  function walk(action, steps) {
    game.input.simulateAction(action, true);
    for (let i = 0; i < steps; i++) {
      const previous = { ...game.transform.position };
      game.update(1 / 60);
      const p = game.transform.position, sample = world.fields.sample(p.x, p.z);
      distance += Math.hypot(p.x - previous.x, p.z - previous.z);
      minHeight = Math.min(minHeight, p.y); maxHeight = Math.max(maxHeight, p.y);
      rootError = Math.max(rootError, Math.abs(p.y - sample.height));
      for (const f of game.grounding()) if (f.inContact) ankleError = Math.max(ankleError, Math.abs(f.clearance));
      for (const f of game.soleGrounding()) { soleMin = Math.min(soleMin, f.min); if (f.inContact) stanceMax = Math.max(stanceMax, f.max); }
      overlaps += world.volumes.overlaps({ x: p.x, z: p.z, radius: game.radius, minY: p.y, maxY: p.y + 1.8 }).length;
    }
    game.input.simulateAction(action, false);
  }
  walk('Forward', 340);
  const stopped = { ...game.transform.position }, blocked = game.blockedSteps;
  const tree = game.approachTree;
  const trunkDistance = tree ? Math.hypot(stopped.x - tree.x, stopped.z - tree.z) : Infinity;
  walk('Right', 180); walk('Forward', 720);
  checks.cCollision = blocked > 20 && overlaps === 0 && Boolean(tree) &&
    trunkDistance >= game.radius + tree.radius - 1e-6 && trunkDistance < game.radius + tree.radius + 0.03;
  checks.cTraversal = distance > 9 && maxHeight - minHeight > 0.05 && Math.hypot(stopped.x - start.x, stopped.z - start.z) > 3;
  checks.cCharacterGrounding = game.soleIndices.every(a => a.length >= 4) && rootError < 1e-6 && ankleError < 0.025 && soleMin >= -0.01 && stanceMax <= 0.025;
  Object.assign(metrics, { distance, heightRange: maxHeight - minHeight, rootError, ankleError, soleMin, stanceMax, overlaps, blocked, trunkDistance,
    treeCount: world.trees.length, coverCount: world.cover.length, volumeCount: world.volumes.records.length,
    terrainVertices: world.terrain.attributes.position.count, terrainTriangles: world.terrain.index.count / 3 });
  view?.render();
  const success = Object.values(checks).every(v => v === true);
  return { success, checks, metrics, final: game.snapshot(), diagnosticsRecords: Object.entries(checks).map(([code, pass]) => ({
    severity: pass ? 'INFO' : 'ERROR', code, subsystem: 'world', message: pass ? 'PASS' : 'FAIL'
  })) };
}
