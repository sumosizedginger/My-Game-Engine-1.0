import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { createWorldRecipe, generateWorld, createWorldVolumeQuery } from '../src/world/index.js';
import { WORLD_PARAMETER_BOUNDS, seededUnit } from '../src/world/recipe.js';
import { WorldTraversal } from '../src/games/world/traversal.js';
import { terrainQueryError, runControlledWorldProof } from '../src/games/world/proof.js';
import { compileMaterial, createMaterialDefinition } from '../src/material/index.js';
import { buildHumanoidCharacter } from '../src/character/index.js';
import { createLocomotionEvaluator } from '../src/motion/index.js';
import { C_CHECKS, cTargetChecks } from '../src/eval/c-checks.js';

test('World recipe clamps finite bounds and emits reproducible diagnostics for invalid values', () => {
  for (const [key, [min, max]] of Object.entries(WORLD_PARAMETER_BOUNDS)) {
    assert.equal(createWorldRecipe({ [key]: min - 1 }).parameters[key], min);
    assert.equal(createWorldRecipe({ [key]: max + 1 }).parameters[key], max);
    for (const invalid of [NaN, Infinity, '4', null]) {
      const a = createWorldRecipe({ [key]: invalid }), b = createWorldRecipe({ [key]: invalid });
      assert.deepEqual(a, b); assert.equal(a.diagnostics[0].code, 'WORLD_PARAMETER_NORMALIZED');
      assert.ok(Number.isFinite(a.parameters[key]));
    }
  }
  assert.equal(createWorldRecipe({ seed: 12.9 }).parameters.seed, 12);
  const a = createWorldRecipe(); assert.deepEqual(createWorldRecipe(JSON.parse(JSON.stringify(a))), a);
});

test('World canonical fields, terrain, placements, and volumes reproduce and vary with seed', () => {
  const a = generateWorld(), b = generateWorld(), c = generateWorld({ seed: 87123 });
  try {
    assert.deepEqual(a.hashes, b.hashes); assert.deepEqual(a.cache.height, b.cache.height);
    assert.deepEqual(a.trees, b.trees);
    for (const key of Object.keys(a.hashes)) assert.notEqual(a.hashes[key], c.hashes[key]);
    assert.ok(a.cache.height.filter((v, i) => Math.abs(v - c.cache.height[i]) > 0.2).length > a.cache.height.length / 2);
    for (const path of ['recipe', 'fields', 'volumes', 'index']) assert.ok(!readFileSync(new URL(`../src/world/${path}.js`, import.meta.url), 'utf8').includes('Math.random'));
    let covariance = 0, x2 = 0, z2 = 0;
    for (let i = 0; i < 1024; i++) { const x = seededUnit(87422, i) - 0.5, z = seededUnit(87423, i) - 0.5; covariance += x * z; x2 += x * x; z2 += z * z; }
    assert.ok(Math.abs(covariance / Math.sqrt(x2 * z2)) < 0.1, 'Placement coordinate channels must not collapse into correlated rows');
  } finally { a.dispose(); b.dispose(); c.dispose(); }
});

test('Terrain vertices, independent ray intersections, normals and bounds agree with sampled truth', () => {
  for (const params of [{}, { terrainResolution: 93, worldSize: 137, heightAmplitude: 8 }]) {
    const world = generateWorld(params);
    try {
      const p = world.terrain.attributes.position, normals = world.terrain.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        assert.equal(p.getY(i), world.cache.height[i]); assert.ok(normals.getY(i) > 0);
        assert.ok(Math.abs(world.fields.heightAt(p.getX(i), p.getZ(i)) - p.getY(i)) < 2e-6);
      }
      assert.ok(terrainQueryError(world) < 1e-5);
      const half = world.cache.half;
      for (const x of [-half, half]) for (const z of [-half, half]) assert.ok(world.fields.sample(x, z));
      assert.equal(world.fields.heightAt(half + 0.001, 0), null);
      assert.equal(world.fields.sample(NaN, 0), null);
      for (let x = -50.27; x < 50; x += 3.1) {
        const s = world.fields.sample(x, 0.37), dx = (world.fields.heightAt(x + 1e-5, 0.37) - s.height) / 1e-5;
        assert.ok(Math.abs(dx + s.normal.x / s.normal.y) < 1e-5);
      }
    } finally { world.dispose(); }
  }
});

test('Ecology placement uses fields and the very same tree records feed collision', () => {
  const world = generateWorld({ maxTreeSlope: 0.1 });
  try {
    assert.ok(world.trees.length > 50); assert.ok(world.cover.length > 100);
    for (const r of [...world.trees, ...world.cover]) {
      const s = world.fields.sample(r.x, r.z); assert.equal(r.y, s.height);
      assert.equal(r.forestWeight, s.forestWeight); assert.ok(s.slope <= 0.1);
    }
    for (let i = 0; i < world.trees.length; i++) {
      const r = world.trees[i]; assert.equal(world.volumes.records[i], r);
      assert.ok(r.forestWeight > 0);
      for (let side=0;side<9;side++) {
        const angle=side*Math.PI*2/9+r.rotation;
        const height=world.fields.heightAt(r.x+Math.sin(angle)*r.radius,r.z+Math.cos(angle)*r.radius);
        assert.ok(r.y-r.baseDepth <= height, 'No exposed gap beneath a trunk rim on slopes');
      }
      assert.ok(world.volumes.overlaps({x:r.x,z:r.z,radius:0.01,minY:r.y-r.baseDepth,maxY:r.y}).includes(r));
      assert.equal(world.volumes.overlaps({ x: r.x, z: r.z, radius: r.radius, minY: r.y, maxY: r.y + r.trunkHeight }).length, 1);
    }
    const averageWeight = world.trees.reduce((sum, r) => sum + r.forestWeight, 0) / world.trees.length;
    const fieldWeight = world.cache.forest.reduce((sum, v) => sum + v, 0) / world.cache.forest.length;
    assert.ok(averageWeight > fieldWeight, 'Trees should prefer forest field over uniform scatter');
  } finally { world.dispose(); }
});

test('World volumes query vertical extents, block tunneling, slide and enforce boundaries', () => {
  const v = createWorldVolumeQuery(10), fields = { sample: () => ({ height: 0, slope: 0 }), heightAt: () => 0 };
  const tree = { x: 0, y: 0, z: 0, radius: 0.4, trunkHeight: 5 }; v.add(tree);
  assert.deepEqual(v.overlaps({ x: 0, z: 0, radius: 0.1, minY: 1, maxY: 2 }), [tree]);
  assert.equal(v.overlaps({ x: 0, z: 0, radius: 0.1, minY: 6, maxY: 7 }).length, 0);
  const hit = v.resolveMovement({ x: 0, z: 4 }, { x: 0, z: -4 }, 0.35, 1.8, fields);
  assert.ok(hit.blocked && hit.z >= 0.75 && hit.z < 0.86);
  const edge = v.resolveMovement({ x: 4, z: 4 }, { x: 20, z: 20 }, 0.35, 1.8, fields);
  assert.ok(edge.blocked && edge.x <= 9.65 && edge.z <= 9.65);
  const slide = v.resolveMovement({ x: 0.8, z: 0.8 }, { x: 0, z: -2 }, 0.35, 1.8, fields);
  assert.ok(slide.z < 0.8); assert.ok(Math.hypot(slide.x, slide.z) >= 0.75);
  assert.throws(() => v.resolveMovement({x:0,z:0},{x:1,z:0},0,1.8,fields), { code:'WORLD_INVALID_VOLUME_QUERY' });
  assert.throws(() => v.overlaps({x:NaN,z:0,radius:1,minY:0,maxY:2}), { code:'WORLD_INVALID_VOLUME_QUERY' });
});

test('Controlled traversal exercises movement, non-flat realized soles and generated trunk collision', () => {
  const game = new WorldTraversal();
  try {
    const result = runControlledWorldProof(game);
    for (const key of C_CHECKS.filter(k => k !== 'cVegetationRendering')) assert.equal(result.checks[key], true, key);
    assert.ok(result.metrics.heightRange > 0.3); assert.ok(result.metrics.distance > 20);
    assert.ok(game.soleIndices.every(a => a.length >= 4));
    assert.equal(result.checks.cVegetationRendering, false, 'No renderer is not visual evidence');
  } finally { game.dispose(); }
});

test('Grounding remains attached across terrain samples, turns, uphill and downhill gait', () => {
  const game = new WorldTraversal({ seed: 10, heightAmplitude: 8, terrainFrequency: 0.025 });
  try {
    for (const x of [-42, -21, 0, 21, 42]) for (const z of [-42, -21, 0, 21, 42]) {
      for (const rotation of [0, Math.PI / 2, Math.PI]) for (let frame = 0; frame < 24; frame++) {
        game.rotation = rotation; game.poseAt({ x, z }, 1 / 24);
        for (const f of game.grounding()) if (f.inContact) assert.ok(Math.abs(f.clearance) < 0.025, JSON.stringify({ x, z, rotation, f }));
        for (const f of game.soleGrounding()) {
          assert.ok(f.min >= -0.01, JSON.stringify({ x, z, rotation, f }));
          if (f.inContact) assert.ok(f.max <= 0.025, JSON.stringify({ x, z, rotation, f }));
        }
      }
    }
  } finally { game.dispose(); }
});

test('Proof C fails when actual query, grounding or collision integration is broken', () => {
  for (const defect of ['query', 'grounding', 'collision']) {
    const game = new WorldTraversal();
    try {
      if (defect === 'query') { const f = game.world.fields.heightAt; game.world.fields.heightAt = (x, z) => f(x, z) + 0.1; }
      if (defect === 'grounding') { const pose = game.poseAt.bind(game); game.poseAt = (...args) => { pose(...args); game.character.mesh.position.y += 0.1; game.character.mesh.updateMatrixWorld(true); }; }
      if (defect === 'collision') game.world.volumes.resolveMovement = (from, to, radius, height, fields) => ({ ...to, y: fields.heightAt(to.x, to.z), blocked: false });
      const proof = runControlledWorldProof(game);
      const key = { query: 'cTerrainQueryTruth', grounding: 'cCharacterGrounding', collision: 'cCollision' }[defect];
      assert.equal(proof.checks[key], false); assert.equal(proof.success, false);
    } finally { game.dispose(); }
  }
});

test('Real semantic traversal stops at every world edge with realized soles still on terrain', () => {
  const game = new WorldTraversal({ treeDensity:0 });
  try {
    for (const actions of [['Forward'],['Backward'],['Left'],['Right'],['Forward','Right']]) {
      game.reset(); for (const action of actions) game.input.simulateAction(action,true);
      for (let i=0;i<5000;i++) game.update(1/60);
      for (const action of actions) game.input.simulateAction(action,false);
      assert.ok(game.blockedSteps > 0);
      assert.ok(Math.abs(game.transform.position.x) <= game.world.cache.half-game.radius);
      assert.ok(Math.abs(game.transform.position.z) <= game.world.cache.half-game.radius);
      for (const foot of game.soleGrounding()) { assert.ok(Number.isFinite(foot.min)); assert.ok(foot.min >= -0.01); }
    }
  } finally { game.dispose(); }
});

test('C evaluator requires every check and page success, with no truthy coercion', () => {
  const good = { httpStatus: 200, cProof: { success: true, checks: Object.fromEntries(C_CHECKS.map(k => [k, true])) } };
  assert.ok(Object.values(cTargetChecks(good)).every(Boolean));
  for (const key of C_CHECKS) for (const invalid of [false, undefined, 'true']) {
    const result = structuredClone(good); result.cProof.checks[key] = invalid;
    assert.equal(cTargetChecks(result)[key], false);
  }
  good.cProof.success = false; assert.equal(cTargetChecks(good).cPageProofSuccess, false);
  assert.ok(Object.values(cTargetChecks(null)).every(v => !v));
});

test('C semantic controller input shares movement and reset with keyboard actions', () => {
  const game = new WorldTraversal();
  try {
    const start = game.transform.position.z;
    game.input.setGamepad({ connected: true, id: 'Injected test device', axes: [0, -1], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) });
    game.update(1 / 60); assert.ok(game.transform.position.z < start);
    game.input.setGamepad(null); game.input.simulateAction('Reset', true); game.update(1 / 60);
    assert.deepEqual(game.transform.position, game.spawn);
  } finally { game.dispose(); }
});

test('World and traversal dispose owned geometry, material and skeleton exactly once', () => {
  const game = new WorldTraversal(); let geometries = 0, materials = 0, skeletons = 0;
  for (const g of [game.world.terrain, game.character.geometry]) g.addEventListener('dispose', () => geometries++);
  game.character.mesh.material.addEventListener('dispose', () => materials++);
  const dispose = game.character.skeleton.dispose.bind(game.character.skeleton);
  game.character.skeleton.dispose = () => { skeletons++; dispose(); };
  game.dispose(); game.dispose(); assert.equal(geometries, 2); assert.equal(materials, 1); assert.equal(skeletons, 1);
  assert.equal(game.world.disposed, true); assert.throws(() => game.update(1 / 60), /disposed/);
});

test('Stopping traversal settles both realized soles instead of freezing a swing foot in air', () => {
  const game = new WorldTraversal();
  try {
    game.input.simulateAction('Forward',true);
    for(let i=0;i<60;i++) game.update(1/60);
    game.input.simulateAction('Forward',false); game.update(1/60); game.renderPose(0.5);
    for(const f of game.soleGrounding()) { assert.equal(f.inContact,true); assert.ok(f.min>=-0.01 && f.max<=0.025); }
  } finally { game.dispose(); }
});

test('Material vertex colors remain explicit, opt-in and deterministic', () => {
  for (const enabled of [false, true]) {
    const definition = createMaterialDefinition({ id: 'vertex-test', parameters: { vertexColors: enabled } });
    assert.equal(definition.data.parameters.vertexColors, enabled);
    const material = compileMaterial(definition); assert.equal(material.vertexColors, enabled); material.dispose();
  }
});

test('Terrain-aware motion rejects invalid samples with an explicit diagnostic code', () => {
  const char = buildHumanoidCharacter('average'), motion = createLocomotionEvaluator(char,'natural');
  try {
    for (const ground of [{height:NaN}, {height:0,normal:{x:0,y:0,z:1}}, {height:0,normal:{x:0,y:2,z:0}}]) {
      assert.throws(() => motion.update(1/60,{groundAt:()=>ground}), {code:'MOTION_INVALID_GROUND_SAMPLE'});
    }
  } finally { char.geometry.dispose(); char.material.dispose(); char.skeleton.dispose(); }
});

for (const preset of ['average', 'athletic', 'heavy']) test(`B1 flat realized-foot regression: ${preset}`, t => {
  const char = buildHumanoidCharacter(preset), motion = createLocomotionEvaluator(char, 'natural');
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  for (let i = 0; i < 200; i++) {
    const pose = motion.update(0.016); char.mesh.updateMatrixWorld(true);
    for (const [side, contact] of [['l', pose.contactStates.left], ['r', pose.contactStates.right]]) if (contact) {
      const p = char.bonesByName[`foot_${side}`].getWorldPosition(new Vector3());
      const delta = p.y - char.parameters.height * 0.05;
      min = Math.min(min, delta); max = Math.max(max, delta); sum += delta; count++;
    }
  }
  t.diagnostic(JSON.stringify({ min, max, mean: sum / count, count }));
  assert.ok(count > 100 && min >= -0.001 && max <= 0.025 && sum / count <= 0.010);
  char.geometry.dispose(); char.material.dispose(); char.skeleton.dispose();
});
