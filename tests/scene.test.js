/**
 * SCENE-COMPOSITION-001 — Scene composition contracts.
 *
 * The properties asserted here are the ones future streaming, save and
 * networking work will stand on. In particular: persistent identity belongs to
 * the source, runtime handles belong to an instance, and the two must never be
 * confused.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCENE_DEFINITION_VERSION,
  SCENE_CODEC_VERSION,
  SCENE_ARTIFACT_VERSION,
  SCENE_MAX_NODES,
  IDENTITY_TRANSFORM,
  createSceneDefinition,
  createSceneNode,
  createLocalTransform,
  validateSceneDefinition,
  enforceValidSceneDefinition,
  encodeScene,
  decodeScene,
  sceneHash,
  compileScene,
  composeTransforms,
  quaternionMultiply,
  instantiateScene,
  liveSceneInstanceCount
} from '../src/scene/index.js';
import { createEntityManager } from '../src/runtime/entities.js';
import { createTransformManager, TRANSFORM_OWNERSHIP } from '../src/runtime/transforms.js';

const rotY = (radians) => [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)];

/** A small valid scene: root -> child -> grandchild, plus a second root. */
function sampleDefinition(id = 'sample.scene') {
  return createSceneDefinition({
    id,
    nodes: [
      createSceneNode({ pid: 'room', name: 'Room', transform: { translation: [1, 0, 0] } }),
      createSceneNode({ pid: 'rig', name: 'Rig', parent: 'room', transform: { translation: [0, 2, 0] } }),
      createSceneNode({ pid: 'lamp', name: 'Lamp', parent: 'rig', transform: { translation: [0, 0, 3] }, asset: 'lamp' }),
      createSceneNode({ pid: 'marker', name: 'Marker', tags: ['debug'] })
    ]
  });
}

const codesOf = (result) => result.diagnostics.map((d) => d.code);

// ---------------------------------------------------------------------------
// 1-6. Validation
// ---------------------------------------------------------------------------

test('a valid scene definition is accepted', () => {
  const result = validateSceneDefinition(sampleDefinition());
  assert.equal(result.valid, true, codesOf(result).join(','));
  assert.deepEqual(result.diagnostics, []);
});

test('a duplicate persistent id is refused', () => {
  const definition = createSceneDefinition({
    id: 'dupes',
    nodes: [
      createSceneNode({ pid: 'a', name: 'First' }),
      createSceneNode({ pid: 'a', name: 'Second' })
    ]
  });
  const result = validateSceneDefinition(definition);
  assert.equal(result.valid, false);
  assert.ok(codesOf(result).includes('SCENE_DUPLICATE_PID'));
  // Persistent identity is the whole contract: if two nodes can share one, a
  // save file cannot name a single object.
  assert.match(result.diagnostics[0].message, /unique within a scene/);
});

test('a missing parent is refused', () => {
  const definition = createSceneDefinition({
    id: 'orphan',
    nodes: [createSceneNode({ pid: 'child', name: 'Child', parent: 'nobody' })]
  });
  const result = validateSceneDefinition(definition);
  assert.equal(result.valid, false);
  assert.ok(codesOf(result).includes('SCENE_MISSING_PARENT'));
});

test('a self-parenting node is refused', () => {
  const definition = createSceneDefinition({
    id: 'selfish',
    nodes: [createSceneNode({ pid: 'loop', name: 'Loop', parent: 'loop' })]
  });
  const result = validateSceneDefinition(definition);
  assert.equal(result.valid, false);
  assert.ok(codesOf(result).includes('SCENE_SELF_PARENT'));
  // One defect, one diagnostic: a self-parent must not also be reported as a
  // missing parent and a cycle.
  assert.equal(codesOf(result).filter((c) => c.startsWith('SCENE_')).length, 1);
});

test('a hierarchy cycle is refused', () => {
  const definition = createSceneDefinition({
    id: 'cyclic',
    nodes: [
      createSceneNode({ pid: 'a', name: 'A', parent: 'c' }),
      createSceneNode({ pid: 'b', name: 'B', parent: 'a' }),
      createSceneNode({ pid: 'c', name: 'C', parent: 'b' })
    ]
  });
  const result = validateSceneDefinition(definition);
  assert.equal(result.valid, false);
  assert.ok(codesOf(result).includes('SCENE_CYCLE'));
  // A three-node ring is one defect, not three.
  assert.equal(codesOf(result).filter((c) => c === 'SCENE_CYCLE').length, 1);
});

test('non-finite and degenerate transforms are refused', () => {
  const cases = [
    [{ translation: [Number.NaN, 0, 0] }, 'SCENE_TRANSFORM_INVALID'],
    [{ translation: [Infinity, 0, 0] }, 'SCENE_TRANSFORM_INVALID'],
    [{ rotation: [0, 0, 0, Number.NaN] }, 'SCENE_TRANSFORM_INVALID'],
    [{ rotation: [0, 0, 0, 0] }, 'SCENE_ROTATION_DEGENERATE'],
    [{ scale: [1, 0, 1] }, 'SCENE_SCALE_INVALID'],
    [{ scale: [1, -1, 1] }, 'SCENE_SCALE_INVALID'],
    [{ scale: [1, Number.NaN, 1] }, 'SCENE_TRANSFORM_INVALID']
  ];
  for (const [transform, expected] of cases) {
    const definition = createSceneDefinition({
      id: 'bad-transform',
      nodes: [createSceneNode({ pid: 'n', name: 'N', transform })]
    });
    const result = validateSceneDefinition(definition);
    assert.equal(result.valid, false, `${JSON.stringify(transform)} should be refused`);
    assert.ok(codesOf(result).includes(expected),
      `${JSON.stringify(transform)} expected ${expected}, got ${codesOf(result).join(',')}`);
  }
});

test('structural defects are reported together, not one at a time', () => {
  const definition = createSceneDefinition({
    id: 'messy',
    nodes: [
      createSceneNode({ pid: 'a', name: '' }),
      createSceneNode({ pid: 'b', name: 'B', parent: 'ghost' }),
      createSceneNode({ pid: 'c', name: 'C', transform: { scale: [0, 1, 1] } })
    ]
  });
  const result = validateSceneDefinition(definition);
  assert.equal(result.valid, false);
  const codes = codesOf(result);
  assert.ok(codes.includes('SCENE_NAME_REQUIRED'));
  assert.ok(codes.includes('SCENE_MISSING_PARENT'));
  assert.ok(codes.includes('SCENE_SCALE_INVALID'));
});

test('anonymous nodes and malformed identities are refused', () => {
  for (const pid of ['', ' leading', 'has space', '_startsUnderscore', 'x'.repeat(200)]) {
    const result = validateSceneDefinition(createSceneDefinition({
      id: 'ids', nodes: [createSceneNode({ pid, name: 'N' })]
    }));
    assert.equal(result.valid, false, `pid ${JSON.stringify(pid)} should be refused`);
    assert.ok(codesOf(result).includes('SCENE_PID_INVALID'));
  }
  assert.ok(codesOf(validateSceneDefinition(createSceneDefinition({
    id: 'anon', nodes: [createSceneNode({ pid: 'ok', name: '' })]
  }))).includes('SCENE_NAME_REQUIRED'));
});

test('enforceValidSceneDefinition throws with diagnostics attached', () => {
  const definition = createSceneDefinition({
    id: 'bad', nodes: [createSceneNode({ pid: 'a', name: 'A', parent: 'missing' })]
  });
  assert.throws(() => enforceValidSceneDefinition(definition), (error) => {
    assert.match(error.message, /SCENE_MISSING_PARENT/);
    assert.ok(Array.isArray(error.diagnostics));
    return true;
  });
});

test('the node ceiling is enforced', () => {
  const nodes = Array.from({ length: SCENE_MAX_NODES + 1 }, (_, i) =>
    createSceneNode({ pid: `n${i}`, name: `N${i}` }));
  const result = validateSceneDefinition(createSceneDefinition({ id: 'huge', nodes }));
  assert.equal(result.valid, false);
  assert.ok(codesOf(result).includes('SCENE_TOO_LARGE'));
});

// ---------------------------------------------------------------------------
// 7-9. Serialization and identity
// ---------------------------------------------------------------------------

test('canonical serialization is deterministic', () => {
  const a = sampleDefinition();
  const b = sampleDefinition();
  assert.equal(encodeScene(a), encodeScene(b));
  assert.equal(sceneHash(a), sceneHash(b));
  assert.match(sceneHash(a), /^[0-9a-f]{16}$/);
});

test('canonical serialization ignores authored key order and tag order', () => {
  // Two authorings of the same scene that differ only in incidental ordering
  // must be the same scene. If they are not, a save file diffs for no reason.
  const one = createSceneDefinition({
    id: 's',
    nodes: [createSceneNode({ pid: 'a', name: 'A', tags: ['z', 'm', 'a'], asset: 'k' })]
  });
  const two = createSceneDefinition({
    id: 's',
    nodes: [createSceneNode({ asset: 'k', tags: ['a', 'z', 'm'], name: 'A', pid: 'a' })]
  });
  assert.equal(encodeScene(one), encodeScene(two));
  assert.equal(sceneHash(one), sceneHash(two));
});

test('a different scene produces a different hash', () => {
  const base = sampleDefinition();
  const moved = createSceneDefinition({
    id: base.id,
    nodes: base.nodes.map((n) => (n.pid === 'lamp'
      ? createSceneNode({ ...n, transform: { translation: [0, 0, 3.0001] } })
      : n))
  });
  assert.notEqual(sceneHash(base), sceneHash(moved));
});

test('encode/decode round-trips to an equivalent definition', () => {
  const original = sampleDefinition();
  const text = encodeScene(original);
  const decoded = decodeScene(text);

  assert.equal(decoded.version, SCENE_DEFINITION_VERSION);
  assert.equal(decoded.id, original.id);
  assert.equal(decoded.nodes.length, original.nodes.length);
  assert.equal(encodeScene(decoded), text);
  assert.equal(sceneHash(decoded), sceneHash(original));
  // And the round-tripped definition compiles to the same artifact.
  assert.equal(compileScene(decoded).artifactHash, compileScene(original).artifactHash);
});

test('decoding refuses foreign, corrupt or mis-versioned input', () => {
  assert.throws(() => decodeScene(''), TypeError);
  assert.throws(() => decodeScene('not json'), SyntaxError);
  assert.throws(() => decodeScene('{"magic":"NOPE"}'), /magic mismatch/);
  assert.throws(() => decodeScene(JSON.stringify({
    magic: 'MGE1SCN', codec: 99, version: 1, nodes: []
  })), /codec version mismatch/);
  assert.throws(() => decodeScene(JSON.stringify({
    magic: 'MGE1SCN', codec: SCENE_CODEC_VERSION, version: 99, nodes: []
  })), /scene version mismatch/);
});

test('serialized scene text contains no runtime handle', () => {
  // THE identity law, checked at the byte level rather than by inspection.
  const artifact = compileScene(sampleDefinition());
  const instance = instantiateScene(artifact);
  const handle = instance.handleFor('lamp');
  assert.ok(handle, 'the fixture must actually have a handle to leak');

  const text = encodeScene(sampleDefinition());
  assert.ok(!text.includes('generation'), 'scene text must not carry handle generations');
  assert.ok(!text.includes('"index"'), 'scene text must not carry handle indices');
  assert.ok(!/handle/i.test(text), 'scene text must not mention handles at all');
  instance.dispose();
});

test('artifact identity is deterministic and covers derived world transforms', () => {
  const a = compileScene(sampleDefinition());
  const b = compileScene(sampleDefinition());
  assert.equal(a.sourceHash, b.sourceHash);
  assert.equal(a.artifactHash, b.artifactHash);
  assert.match(a.artifactHash, /^[0-9a-f]{16}$/);
  assert.equal(a.artifactVersion, SCENE_ARTIFACT_VERSION);

  // Moving a PARENT changes descendants' world transforms. The artifact hash
  // must notice, or a compiled scene could differ from its own evidence.
  const moved = createSceneDefinition({
    id: 'sample.scene',
    nodes: sampleDefinition().nodes.map((n) => (n.pid === 'rig'
      ? createSceneNode({ ...n, transform: { translation: [0, 5, 0] } })
      : n))
  });
  assert.notEqual(compileScene(moved).artifactHash, a.artifactHash);
});

// ---------------------------------------------------------------------------
// 10-11. Hierarchy and transform composition
// ---------------------------------------------------------------------------

test('parent translation composes into child world transforms', () => {
  const artifact = compileScene(sampleDefinition());
  const world = (pid) => artifact.nodes.find((n) => n.pid === pid).world.translation;
  assert.deepEqual([...world('room')], [1, 0, 0]);
  assert.deepEqual([...world('rig')], [1, 2, 0]);
  assert.deepEqual([...world('lamp')], [1, 2, 3]);
  assert.deepEqual([...world('marker')], [0, 0, 0]);
});

test('parent rotation carries its children around with it', () => {
  // A child one metre along +X of a parent yawed 90 degrees must end up along
  // -Z in world space. This is the property a door assembly depends on.
  const definition = createSceneDefinition({
    id: 'rot',
    nodes: [
      createSceneNode({ pid: 'hinge', name: 'Hinge', transform: { rotation: rotY(Math.PI / 2) } }),
      createSceneNode({ pid: 'leaf', name: 'Leaf', parent: 'hinge', transform: { translation: [1, 0, 0] } })
    ]
  });
  const artifact = compileScene(definition);
  const leaf = artifact.nodes.find((n) => n.pid === 'leaf').world;
  assert.ok(Math.abs(leaf.translation[0]) < 1e-12, `x ${leaf.translation[0]}`);
  assert.ok(Math.abs(leaf.translation[1]) < 1e-12);
  assert.ok(Math.abs(leaf.translation[2] + 1) < 1e-12, `z ${leaf.translation[2]}`);
});

test('rotations compose, they do not replace', () => {
  const definition = createSceneDefinition({
    id: 'rot2',
    nodes: [
      createSceneNode({ pid: 'a', name: 'A', transform: { rotation: rotY(Math.PI / 2) } }),
      createSceneNode({ pid: 'b', name: 'B', parent: 'a', transform: { rotation: rotY(Math.PI / 2) } })
    ]
  });
  const b = compileScene(definition).nodes.find((n) => n.pid === 'b').world;
  const expected = rotY(Math.PI);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(b.rotation[i] - expected[i]) < 1e-12,
      `component ${i}: ${b.rotation[i]} vs ${expected[i]}`);
  }
});

test('parent scale multiplies and scales child offsets', () => {
  const definition = createSceneDefinition({
    id: 'scaled',
    nodes: [
      createSceneNode({ pid: 'p', name: 'P', transform: { scale: [2, 2, 2] } }),
      createSceneNode({ pid: 'c', name: 'C', parent: 'p', transform: { translation: [1, 0, 0], scale: [3, 1, 1] } })
    ]
  });
  const c = compileScene(definition).nodes.find((n) => n.pid === 'c').world;
  // The child's offset is expressed in the parent's scaled frame.
  assert.deepEqual([...c.translation], [2, 0, 0]);
  assert.deepEqual([...c.scale], [6, 2, 2]);
});

test('multi-level hierarchy composes to the same result as manual composition', () => {
  const chain = [
    { translation: [1, 0, 0], rotation: rotY(0.3), scale: [1.5, 1, 1] },
    { translation: [0, 2, 0], rotation: rotY(-0.7), scale: [1, 2, 1] },
    { translation: [0, 0, 3], rotation: rotY(1.1), scale: [1, 1, 0.5] },
    { translation: [0.5, 0.5, 0.5], rotation: rotY(0.25), scale: [2, 2, 2] }
  ];
  const definition = createSceneDefinition({
    id: 'deep',
    nodes: chain.map((transform, i) => createSceneNode({
      pid: `n${i}`, name: `N${i}`, parent: i === 0 ? null : `n${i - 1}`, transform
    }))
  });
  const artifact = compileScene(definition);
  assert.equal(artifact.maxDepth, 3);

  let expected = IDENTITY_TRANSFORM;
  for (const step of chain) expected = composeTransforms(expected, createLocalTransform(step));

  const actual = artifact.nodes.find((n) => n.pid === 'n3').world;
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(actual.translation[i] - expected.translation[i]) < 1e-12);
    assert.ok(Math.abs(actual.scale[i] - expected.scale[i]) < 1e-12);
  }
});

test('canonical order places every parent before its children, whatever the authored order', () => {
  const definition = createSceneDefinition({
    id: 'shuffled',
    nodes: [
      createSceneNode({ pid: 'grandchild', name: 'GC', parent: 'child' }),
      createSceneNode({ pid: 'child', name: 'C', parent: 'root' }),
      createSceneNode({ pid: 'root', name: 'R' })
    ]
  });
  const artifact = compileScene(definition);
  assert.deepEqual([...artifact.order], ['root', 'child', 'grandchild']);
  for (const node of artifact.nodes) {
    if (node.parent === null) continue;
    assert.ok(artifact.order.indexOf(node.parent) < artifact.order.indexOf(node.pid));
  }
});

test('the compiled artifact records children, roots and depth', () => {
  const artifact = compileScene(sampleDefinition());
  const node = (pid) => artifact.nodes.find((n) => n.pid === pid);
  assert.deepEqual([...artifact.roots], ['room', 'marker']);
  assert.deepEqual([...node('room').children], ['rig']);
  assert.deepEqual([...node('rig').children], ['lamp']);
  assert.deepEqual([...node('lamp').children], []);
  assert.equal(node('room').depth, 0);
  assert.equal(node('lamp').depth, 2);
  assert.equal(artifact.maxDepth, 2);
  assert.equal(artifact.nodeCount, 4);
});

test('quaternion composition stays normalized down a deep chain', () => {
  let q = [0, 0, 0, 1];
  for (let i = 0; i < 200; i++) q = quaternionMultiply(q, rotY(0.37));
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9, `length ${Math.hypot(...q)}`);
});

// ---------------------------------------------------------------------------
// 12-19. Runtime instantiation and identity
// ---------------------------------------------------------------------------

test('instantiation creates one engine entity per authored node', () => {
  const artifact = compileScene(sampleDefinition());
  const instance = instantiateScene(artifact);

  assert.equal(instance.size, artifact.nodeCount);
  assert.equal(instance.entities.count(), artifact.nodeCount);
  for (const pid of artifact.order) {
    const handle = instance.handleFor(pid);
    assert.ok(handle, `${pid} must have a runtime handle`);
    assert.equal(instance.entities.isValid(handle), true);
    assert.equal(instance.entities.get(handle).scenePid, pid);
  }
  instance.dispose();
});

test('persistent ids and runtime handles map both ways', () => {
  const instance = instantiateScene(compileScene(sampleDefinition()));
  const handle = instance.handleFor('lamp');
  assert.equal(instance.pidFor(handle), 'lamp');
  assert.equal(instance.handleFor('nope'), null);
  assert.equal(instance.pidFor({ index: 999, generation: 999 }), null);
  instance.dispose();
});

test('scene registration respects transform authority', () => {
  const instance = instantiateScene(compileScene(sampleDefinition()));

  // A root is immovable scenery; a parented node derives its world transform
  // from its parent. GAMEPLAY_FOUNDATION.md §3.1 already defines ATTACHED that
  // way, so composition introduces no new ownership mode.
  const root = instance.transforms.getTransform(instance.handleFor('room'));
  const child = instance.transforms.getTransform(instance.handleFor('lamp'));
  assert.equal(root.ownership, TRANSFORM_OWNERSHIP.STATIC);
  assert.equal(child.ownership, TRANSFORM_OWNERSHIP.ATTACHED);

  // The published position is the DERIVED world position, not the local one.
  assert.deepEqual([child.position.x, child.position.y, child.position.z], [1, 2, 3]);

  // And no scene entity is moved by the simulation commit: composition is not
  // a second per-tick writer.
  for (let i = 0; i < 10; i++) instance.transforms.commitAll(1 / 60);
  const after = instance.transforms.getTransform(instance.handleFor('lamp'));
  assert.deepEqual([after.position.x, after.position.y, after.position.z], [1, 2, 3]);
  instance.dispose();
});

test('rotation and scale stay in scene composition, not in the runtime transform', () => {
  // The runtime Transform owns position and velocity. Scene composition must
  // not smuggle a second transform representation into it.
  const instance = instantiateScene(compileScene(sampleDefinition()));
  const record = instance.transforms.getTransform(instance.handleFor('lamp'));
  assert.equal(record.rotation, undefined);
  assert.equal(record.scale, undefined);

  // Full placement is available from the scene, as derived artifact data.
  const world = instance.worldTransformOf('lamp');
  assert.equal(world.rotation.length, 4);
  assert.equal(world.scale.length, 3);
  assert.ok(Object.isFrozen(world));
  instance.dispose();
});

test('two instances of one artifact are independent', () => {
  const artifact = compileScene(sampleDefinition());
  const a = instantiateScene(artifact);
  const b = instantiateScene(artifact);

  assert.equal(a.artifact, b.artifact, 'immutable source truth is shared');
  assert.equal(a.sourceHash, b.sourceHash);
  assert.equal(a.sceneId, b.sceneId, 'scene identity comes from the source, so it is shared');

  // Separate pools, separate entities, separate runtime state.
  assert.notEqual(a.entities, b.entities, 'instances must not share an entity manager');
  assert.notEqual(a.instanceId, b.instanceId, 'each instantiation has its own runtime identity');

  for (const pid of artifact.order) {
    const ha = a.handleFor(pid);
    const hb = b.handleFor(pid);
    assert.equal(a.entities.isValid(ha), true);
    assert.equal(b.entities.isValid(hb), true);
    // The entities are genuinely different objects in different pools.
    assert.notEqual(a.entities.get(ha), b.entities.get(hb));
    assert.equal(a.entities.get(ha).sceneInstanceId, a.instanceId);
    assert.equal(b.entities.get(hb).sceneInstanceId, b.instanceId);
  }

  a.dispose();
  b.dispose();
});

test('an EntityHandle is scoped to its entity manager, and the scene says so', () => {
  // A DOCUMENTED LIMIT, asserted so it cannot be forgotten.
  //
  // Two entity managers each starting from an empty pool both allocate
  // {index: 0, generation: 1}. Those handle values are equal while referring
  // to different entities. No lookup inside one pool can discover that a
  // value "came from" the other pool, because the value carries no pool
  // identity. A handle is meaningful only with the manager that issued it.
  //
  // This is not fixable inside the scene layer: it would require handles
  // themselves to carry a pool id, which is runtime identity architecture and
  // outside this tranche. What the scene layer CAN do is make the safe usage
  // the easy one - scenes sharing a runtime world share a manager - and the
  // test below proves that case is unambiguous.
  const artifact = compileScene(sampleDefinition());
  const a = instantiateScene(artifact);
  const b = instantiateScene(artifact);

  assert.deepEqual(a.handleFor('room'), b.handleFor('room'),
    'separate pools do produce colliding handle values; this is the documented limit');
  assert.notEqual(a.entities, b.entities);
  assert.notEqual(a.instanceId, b.instanceId);

  a.dispose();
  b.dispose();
});

test('scenes sharing one runtime world never confuse each other handles', () => {
  // The realistic multi-scene shape, and the one that must be unambiguous:
  // one entity pool, several scenes loaded into it. Here handle values are
  // genuinely distinct and ownership is decidable.
  const artifact = compileScene(sampleDefinition());
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);

  const a = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });
  const b = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });

  const fromA = a.handleFor('room');
  const fromB = b.handleFor('room');
  assert.notDeepEqual(fromA, fromB, 'a shared pool must not issue the same handle twice');

  assert.equal(a.pidFor(fromA), 'room');
  assert.equal(b.pidFor(fromB), 'room');
  assert.equal(b.pidFor(fromA), null, "B must not resolve A's handle");
  assert.equal(a.pidFor(fromB), null, "A must not resolve B's handle");

  assert.equal(a.owns(fromA), true);
  assert.equal(a.owns(fromB), false);
  assert.equal(b.owns(fromB), true);
  assert.equal(b.owns(fromA), false);

  a.dispose();
  assert.equal(b.owns(fromB), true, 'disposing A must not disturb B ownership');
  b.dispose();
  assert.equal(b.owns(fromB), false, 'a disposed instance owns nothing');
});

test('disposing one instance does not damage another', () => {
  const artifact = compileScene(sampleDefinition());
  const a = instantiateScene(artifact);
  const b = instantiateScene(artifact);

  a.dispose();

  assert.equal(a.disposed, true);
  assert.equal(b.disposed, false);
  assert.equal(b.size, artifact.nodeCount);
  for (const pid of artifact.order) {
    const handle = b.handleFor(pid);
    assert.equal(b.entities.isValid(handle), true, `${pid} must survive in B`);
    assert.equal(b.pidFor(handle), pid);
  }
  b.dispose();
});

test('instances can share one runtime world without sharing scene identity', () => {
  // The shape a real game uses: one entity pool, several scenes loaded into it.
  const artifact = compileScene(sampleDefinition());
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);

  const a = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });
  const b = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });

  assert.equal(entities.count(), artifact.nodeCount * 2);
  assert.notDeepEqual(a.handleFor('lamp'), b.handleFor('lamp'));

  a.dispose();
  // Disposing one scene despawns only its own entities from the shared pool.
  assert.equal(entities.count(), artifact.nodeCount);
  assert.equal(entities.isValid(b.handleFor('lamp')), true);
  b.dispose();
  assert.equal(entities.count(), 0);
});

test('a half-borrowed manager pair is refused', () => {
  const artifact = compileScene(sampleDefinition());
  const entities = createEntityManager();
  assert.throws(() => instantiateScene(artifact, { entityManager: entities }),
    /both entityManager and transformManager, or neither/);
});

test('unload and reinstantiate preserves persistent ids and renews runtime handles', () => {
  // The property future streaming depends on: an unloaded and reloaded object
  // is the same authored object, and is not the same runtime entity.
  const artifact = compileScene(sampleDefinition());
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);

  const first = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });
  const firstHandles = new Map(artifact.order.map((pid) => [pid, first.handleFor(pid)]));
  first.dispose();

  const second = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });

  for (const pid of artifact.order) {
    assert.ok(second.handleFor(pid), `${pid} must exist again after reload`);
    assert.equal(second.pidFor(second.handleFor(pid)), pid, 'persistent identity is unchanged');
    assert.notDeepEqual(second.handleFor(pid), firstHandles.get(pid),
      `${pid} must receive a NEW runtime handle after reload`);
  }
  assert.equal(second.sourceHash, artifact.sourceHash, 'source identity is untouched by lifecycle');
  second.dispose();
});

test('a stale handle never becomes valid for a newly instantiated entity', () => {
  // Generational slots already guarantee this. The scene layer must not
  // reintroduce the bug by caching a pid against a reused slot.
  const artifact = compileScene(sampleDefinition());
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);

  const first = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });
  const stale = first.handleFor('lamp');
  first.dispose();

  const second = instantiateScene(artifact, { entityManager: entities, transformManager: transforms });

  assert.equal(entities.isValid(stale), false, 'a stale handle must not validate');
  assert.equal(entities.get(stale), null);
  assert.equal(second.pidFor(stale), null, 'a stale handle must not resolve to a pid');

  // And the slot really was reused, so this is not a vacuous assertion.
  const reused = [...artifact.order].map((pid) => second.handleFor(pid));
  assert.ok(reused.some((h) => h.index === stale.index),
    'the fixture must actually reuse the slot for this test to mean anything');
  assert.ok(reused.every((h) => !(h.index === stale.index && h.generation === stale.generation)));
  second.dispose();
});

test('a disposed instance refuses runtime queries instead of answering stale ones', () => {
  const instance = instantiateScene(compileScene(sampleDefinition()));
  instance.dispose();
  assert.equal(instance.disposed, true);
  assert.throws(() => instance.handleFor('lamp'), /disposed/);
  assert.throws(() => instance.members(), /disposed/);
  // Repeated disposal is safe.
  instance.dispose();
  assert.equal(instance.disposed, true);
});

test('the artifact is immutable and survives every instance', () => {
  const artifact = compileScene(sampleDefinition());
  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.nodes));
  assert.ok(artifact.nodes.every((n) => Object.isFrozen(n) && Object.isFrozen(n.world)));

  assert.throws(() => { artifact.id = 'hacked'; }, TypeError);
  assert.throws(() => { artifact.nodes[0].pid = 'hacked'; }, TypeError);

  const before = artifact.artifactHash;
  const a = instantiateScene(artifact);
  const b = instantiateScene(artifact);
  a.dispose();
  b.dispose();
  assert.equal(artifact.artifactHash, before);
  assert.equal(compileScene(sampleDefinition()).artifactHash, before);
});

test('instantiation refuses anything that is not a compiled artifact', () => {
  assert.throws(() => instantiateScene(null), TypeError);
  assert.throws(() => instantiateScene({ nodes: [] }), /frozen SceneArtifact/);
  assert.throws(() => instantiateScene(sampleDefinition()), TypeError);
});

test('live instance count returns to its baseline after disposal', () => {
  const baseline = liveSceneInstanceCount();
  const artifact = compileScene(sampleDefinition());
  const instances = [instantiateScene(artifact), instantiateScene(artifact), instantiateScene(artifact)];
  assert.equal(liveSceneInstanceCount(), baseline + 3);
  instances.forEach((i) => i.dispose());
  assert.equal(liveSceneInstanceCount(), baseline);
  // Double dispose must not drive the counter negative.
  instances.forEach((i) => i.dispose());
  assert.equal(liveSceneInstanceCount(), baseline);
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

test('scene queries answer hierarchy questions without a query language', () => {
  const instance = instantiateScene(compileScene(sampleDefinition()));
  assert.deepEqual(instance.roots(), ['room', 'marker']);
  assert.deepEqual(instance.childrenOf('room'), ['rig']);
  assert.equal(instance.parentOf('lamp'), 'rig');
  assert.equal(instance.parentOf('room'), null);
  assert.equal(instance.nodeFor('lamp').asset, 'lamp');
  assert.deepEqual(instance.childrenOf('missing'), []);
  assert.equal(instance.worldTransformOf('missing'), null);

  const members = instance.members();
  assert.equal(members.length, 4);
  assert.deepEqual(members.map((m) => m.pid), ['room', 'rig', 'lamp', 'marker']);
  assert.ok(members.every((m) => m.handle !== null));
  instance.dispose();
});

test('an INFO diagnostic records the instantiation', () => {
  const instance = instantiateScene(compileScene(sampleDefinition()));
  const diagnostics = instance.getDiagnostics();
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, 'SCENE_INSTANTIATED');
  assert.equal(diagnostics[0].subsystem, 'scene');
  assert.equal(diagnostics[0].severity, 'INFO');
  assert.equal(diagnostics[0].data.nodes, 4);
  instance.dispose();
});
