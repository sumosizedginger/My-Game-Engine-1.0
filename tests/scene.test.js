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
  identityMatrix,
  matrixFromTRS,
  multiplyMatrices,
  transformPoint,
  translationOf,
  hasShear,
  instantiateScene,
  liveSceneInstanceCount
} from '../src/scene/index.js';
import { createEntityManager } from '../src/runtime/entities.js';
import { createTransformManager, TRANSFORM_OWNERSHIP } from '../src/runtime/transforms.js';
import { QUATERNION_UNIT_TOLERANCE } from '../src/geometry/mesh.js';
import { createBoxMesh, transformMesh } from '../src/geometry/mesh-ops.js';

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

test('artifact identity is deterministic and covers derived world matrices', () => {
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
  // Two quarter turns about Y must land a +X offset on -X, not back on +X.
  const definition = createSceneDefinition({
    id: 'rot2',
    nodes: [
      createSceneNode({ pid: 'a', name: 'A', transform: { rotation: rotY(Math.PI / 2) } }),
      createSceneNode({ pid: 'b', name: 'B', parent: 'a', transform: { rotation: rotY(Math.PI / 2) } }),
      createSceneNode({ pid: 'c', name: 'C', parent: 'b', transform: { translation: [1, 0, 0] } })
    ]
  });
  const world = compileScene(definition).nodes.find((n) => n.pid === 'c').world;
  const p = transformPoint(world.matrix, [0, 0, 0]);
  assert.ok(Math.abs(p[0] + 1) < 1e-12, `x ${p[0]}`);
  assert.ok(Math.abs(p[1]) < 1e-12);
  assert.ok(Math.abs(p[2]) < 1e-12);
});

test('parent scale scales child offsets', () => {
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
  // A point one unit along the child's local +X is scaled by 2 * 3.
  assert.deepEqual(transformPoint(c.matrix, [1, 0, 0]), [8, 0, 0]);
});

test('multi-level hierarchy matches matrices multiplied by hand', () => {
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

  let expected = identityMatrix();
  for (const step of chain) {
    expected = multiplyMatrices(expected, matrixFromTRS(createLocalTransform(step)));
  }

  const actual = artifact.nodes.find((n) => n.pid === 'n3').world.matrix;
  for (let i = 0; i < 16; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) < 1e-12,
      `matrix element ${i}: ${actual[i]} vs ${expected[i]}`);
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

test('a long rotation-only chain does not drift in scale', () => {
  // 200 nested quarter-ish turns. A rotation-only chain must stay a rotation:
  // basis columns of unit length, so nothing silently grows or shrinks.
  const nodes = [];
  for (let i = 0; i < 200; i++) {
    nodes.push(createSceneNode({
      pid: `n${i}`, name: `N${i}`, parent: i === 0 ? null : `n${i - 1}`,
      transform: { rotation: rotY(0.37) }
    }));
  }
  const last = compileScene(createSceneDefinition({ id: 'chain', nodes }))
    .nodes.find((n) => n.pid === 'n199').world.matrix;

  for (const col of [[last[0], last[1], last[2]], [last[4], last[5], last[6]], [last[8], last[9], last[10]]]) {
    assert.ok(Math.abs(Math.hypot(...col) - 1) < 1e-9, `basis column length ${Math.hypot(...col)}`);
  }
  assert.equal(hasShear(last), false, 'a rotation-only chain cannot shear');
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

test('orientation stays in scene composition, not in the runtime transform', () => {
  // The runtime Transform owns position and velocity. Scene composition must
  // not smuggle a second transform representation into it.
  const instance = instantiateScene(compileScene(sampleDefinition()));
  const record = instance.transforms.getTransform(instance.handleFor('lamp'));
  assert.equal(record.rotation, undefined);
  assert.equal(record.scale, undefined);
  assert.equal(record.matrix, undefined);

  // Full placement is available from the scene, as derived artifact data.
  const world = instance.worldTransformOf('lamp');
  assert.equal(world.matrix.length, 16);
  assert.equal(world.translation.length, 3);
  assert.ok(Object.isFrozen(world));
  assert.ok(Object.isFrozen(world.matrix));

  // And there is deliberately NO world rotation or scale: a sheared hierarchy
  // has no such decomposition, so publishing one would be a confident lie.
  assert.equal(world.rotation, undefined);
  assert.equal(world.scale, undefined);

  // The published runtime position is exactly what the matrix says.
  assert.deepEqual(
    [record.position.x, record.position.y, record.position.z],
    transformPoint(instance.worldMatrixOf('lamp'), [0, 0, 0])
  );
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

// ---------------------------------------------------------------------------
// AFFINE HIERARCHY — SCENE-COMPOSITION-001 REPAIR R1
//
// The original compiler composed world placement as three independent parts:
//
//   worldScale       = parentScale * localScale
//   worldRotation    = parentRotation * localRotation
//   worldTranslation = parentTranslation + rotate(parentRotation,
//                                                 parentScale * localTranslation)
//
// That loses the ordering between a parent's scale and a parent's rotation,
// and it cannot represent shear at all. These tests compare transformed POINTS
// and MATRICES, never decomposed convenience values, because comparing
// decomposed values is exactly what hid the defect.
// ---------------------------------------------------------------------------

const rotZ = (radians) => [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];
const rotX = (radians) => [Math.sin(radians / 2), 0, 0, Math.cos(radians / 2)];

/** Builds a chain of nodes n0 -> n1 -> ... from a list of local transforms. */
function chainDefinition(id, transforms) {
  return createSceneDefinition({
    id,
    nodes: transforms.map((transform, i) => createSceneNode({
      pid: `n${i}`, name: `N${i}`, parent: i === 0 ? null : `n${i - 1}`, transform
    }))
  });
}

const worldOf = (artifact, pid) => artifact.nodes.find((n) => n.pid === pid).world;
const closeTo = (actual, expected, epsilon = 1e-12) =>
  actual.every((v, i) => Math.abs(v - expected[i]) < epsilon);

test('REGRESSION: non-uniform parent scale above a rotated child places correctly', () => {
  // The validator's exact reproduction. The old independent-TRS composition
  // produced [0, 2, 0] because it applied the parent's scale to the child's
  // offset BEFORE the parent's rotation, which is not what the authored chain
  // means. Correct is scale(2,1,1) * rotZ(90) * translate(1,0,0) applied to
  // the origin: the translation rotates onto +Y first, and the x-only scale
  // then has nothing to stretch.
  const artifact = compileScene(chainDefinition('validator-repro', [
    { scale: [2, 1, 1] },
    { rotation: rotZ(Math.PI / 2) },
    { translation: [1, 0, 0] }
  ]));

  const world = worldOf(artifact, 'n2');
  assert.ok(closeTo([...world.translation], [0, 1, 0]),
    `world translation ${JSON.stringify([...world.translation])}, expected [0, 1, 0]`);

  // And prove it through the authoritative matrix, not only the convenience
  // value read out of it.
  assert.ok(closeTo(transformPoint(world.matrix, [0, 0, 0]), [0, 1, 0]),
    `matrix applied to origin ${JSON.stringify(transformPoint(world.matrix, [0, 0, 0]))}`);
});

test('AFFINE 1: uniform scale, rotation and translation compose', () => {
  const artifact = compileScene(chainDefinition('uniform', [
    { translation: [1, 2, 3], rotation: rotZ(Math.PI / 2), scale: [2, 2, 2] },
    { translation: [1, 0, 0] }
  ]));
  // Child local origin is at parent-local (1,0,0), scaled by 2 -> (2,0,0),
  // rotated a quarter turn about Z -> (0,2,0), then translated -> (1,4,3).
  assert.ok(closeTo([...worldOf(artifact, 'n1').translation], [1, 4, 3]),
    JSON.stringify([...worldOf(artifact, 'n1').translation]));
});

test('AFFINE 2: non-uniform parent scale over a rotated child produces shear', () => {
  // A 45 degree rotation under a non-uniform scale genuinely shears: the basis
  // columns stop being perpendicular, and no TRS can express the result. An
  // axis-aligned rotation would not shear, so the angle matters.
  const artifact = compileScene(chainDefinition('shear', [
    { scale: [2, 1, 1] },
    { rotation: rotZ(Math.PI / 4) }
  ]));
  const world = worldOf(artifact, 'n1');
  assert.equal(world.sheared, true, 'this composition must actually shear');
  assert.equal(hasShear(world.matrix), true);
  assert.equal(artifact.shearedNodeCount, 1);

  // A unit square corner must land where the full chain puts it.
  const expected = transformPoint(
    multiplyMatrices(
      matrixFromTRS(createLocalTransform({ scale: [2, 1, 1] })),
      matrixFromTRS(createLocalTransform({ rotation: rotZ(Math.PI / 4) }))
    ),
    [1, 1, 0]
  );
  assert.ok(closeTo(transformPoint(world.matrix, [1, 1, 0]), expected), 'sheared point must match');
});

test('AFFINE 3: rotated parent over a non-uniformly scaled child', () => {
  const artifact = compileScene(chainDefinition('rot-then-scale', [
    { rotation: rotZ(Math.PI / 2) },
    { scale: [3, 1, 1] },
    { translation: [1, 0, 0] }
  ]));
  // The child's x-scale acts in the child's own frame, which the parent has
  // already turned onto +Y. So one unit of local +X becomes three units of
  // world +Y.
  assert.ok(closeTo([...worldOf(artifact, 'n2').translation], [0, 3, 0]),
    JSON.stringify([...worldOf(artifact, 'n2').translation]));
  // This ordering does NOT shear: the rotation is outermost.
  assert.equal(worldOf(artifact, 'n2').sheared, false);
});

test('AFFINE 4: three-level mixed scale and rotation', () => {
  const chain = [
    { translation: [0, 1, 0], rotation: rotZ(Math.PI / 6), scale: [2, 1, 1] },
    { translation: [1, 0, 0], rotation: rotX(Math.PI / 3), scale: [1, 3, 1] },
    { translation: [0, 0, 2], rotation: rotZ(-Math.PI / 4), scale: [1, 1, 0.5] }
  ];
  const artifact = compileScene(chainDefinition('mixed', chain));

  let expected = identityMatrix();
  for (const step of chain) {
    expected = multiplyMatrices(expected, matrixFromTRS(createLocalTransform(step)));
  }
  const actual = worldOf(artifact, 'n2').matrix;
  for (let i = 0; i < 16; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) < 1e-12, `element ${i}`);
  }
});

test('AFFINE 5: siblings are independent of each other', () => {
  const artifact = compileScene(createSceneDefinition({
    id: 'siblings',
    nodes: [
      createSceneNode({ pid: 'p', name: 'P', transform: { scale: [2, 1, 1], rotation: rotZ(Math.PI / 4) } }),
      createSceneNode({ pid: 'a', name: 'A', parent: 'p', transform: { translation: [1, 0, 0] } }),
      createSceneNode({ pid: 'b', name: 'B', parent: 'p', transform: { translation: [0, 1, 0] } })
    ]
  }));
  const parent = worldOf(artifact, 'p').matrix;
  for (const [pid, local] of [['a', [1, 0, 0]], ['b', [0, 1, 0]]]) {
    const expected = transformPoint(parent, local);
    assert.ok(closeTo([...worldOf(artifact, pid).translation], expected),
      `${pid} must be placed by the parent alone, not by its sibling`);
  }
  assert.notDeepEqual([...worldOf(artifact, 'a').translation], [...worldOf(artifact, 'b').translation]);
});

test('AFFINE 6: an identity hierarchy leaves everything at the origin', () => {
  const artifact = compileScene(chainDefinition('identity', [{}, {}, {}]));
  for (const node of artifact.nodes) {
    assert.deepEqual([...node.world.matrix], identityMatrix());
    assert.deepEqual([...node.world.translation], [0, 0, 0]);
    assert.equal(node.world.sheared, false);
  }
});

test('AFFINE 7: a deeply nested chain accumulates exactly', () => {
  const depth = 40;
  const step = { translation: [0.25, 0, 0], rotation: rotZ(Math.PI / 20), scale: [1, 1, 1] };
  const artifact = compileScene(chainDefinition('deep-chain', Array.from({ length: depth }, () => step)));
  assert.equal(artifact.maxDepth, depth - 1);

  let expected = identityMatrix();
  for (let i = 0; i < depth; i++) {
    expected = multiplyMatrices(expected, matrixFromTRS(createLocalTransform(step)));
  }
  const actual = worldOf(artifact, `n${depth - 1}`).matrix;
  for (let i = 0; i < 16; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) < 1e-9, `element ${i} drifted`);
  }
});

test('AFFINE 8: parentMatrix * childMatrix * point equals the compiled world matrix', () => {
  // The composition law itself, stated as an equation and checked on points
  // rather than on a decomposition.
  const artifact = compileScene(chainDefinition('law', [
    { translation: [1, -2, 0.5], rotation: rotZ(0.9), scale: [2, 0.5, 1] },
    { translation: [0, 3, -1], rotation: rotX(-0.4), scale: [1, 2, 3] }
  ]));

  const parentMatrix = worldOf(artifact, 'n0').matrix;
  const childLocal = matrixFromTRS(artifact.nodes.find((n) => n.pid === 'n1').local);
  const childWorld = worldOf(artifact, 'n1').matrix;

  for (const point of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-2.5, 1.25, 3.75]]) {
    const viaChain = transformPoint(parentMatrix, transformPoint(childLocal, point));
    const viaWorld = transformPoint(childWorld, point);
    assert.ok(closeTo(viaWorld, viaChain, 1e-12),
      `point ${JSON.stringify(point)}: ${JSON.stringify(viaWorld)} vs ${JSON.stringify(viaChain)}`);
  }
});

test('AFFINE 9: transform order is T * R * S, not any other ordering', () => {
  // Scale first, then rotate, then translate - matching transformMesh. If the
  // order were T * S * R the translation would come out scaled.
  const trs = { translation: [10, 0, 0], rotation: rotZ(Math.PI / 2), scale: [2, 1, 1] };
  const artifact = compileScene(chainDefinition('order', [trs]));
  const world = worldOf(artifact, 'n0');

  // The node's own origin is unaffected by its scale and rotation.
  assert.ok(closeTo([...world.translation], [10, 0, 0]));
  // A local +X unit is scaled by 2 and then rotated onto +Y, then offset.
  assert.ok(closeTo(transformPoint(world.matrix, [1, 0, 0]), [10, 2, 0]),
    JSON.stringify(transformPoint(world.matrix, [1, 0, 0])));
  // Had scale been applied after rotation, the result would be [10, 1, 0].
  assert.ok(!closeTo(transformPoint(world.matrix, [1, 0, 0]), [10, 1, 0]));
});

test('the matrix convention is column-major with translation in elements 12-14', () => {
  // Stated and tested rather than inferred, because a silent row/column
  // mismatch is invisible until something renders wrong.
  const artifact = compileScene(chainDefinition('convention', [
    { translation: [7, 8, 9] }
  ]));
  const m = worldOf(artifact, 'n0').matrix;
  assert.equal(m.length, 16);
  assert.equal(m[12], 7);
  assert.equal(m[13], 8);
  assert.equal(m[14], 9);
  assert.equal(m[15], 1);
  assert.deepEqual([...translationOf(m)], [7, 8, 9]);
  // Bottom row of an affine transform, in column-major positions.
  assert.deepEqual([m[3], m[7], m[11]], [0, 0, 0]);
});

// ---------------------------------------------------------------------------
// ARTIFACT IMMUTABILITY — SCENE-COMPOSITION-001 REPAIR R1
//
// The original compiler stored `tags: node.tags` and `local: node.transform`
// straight from the source. A caller holding a mutable definition could change
// the artifact's contents after compilation while artifactHash stayed put.
//
// These tests deliberately use PLAIN MUTABLE OBJECTS rather than
// createSceneDefinition(), because that helper freezes its output and would
// hide the defect entirely.
// ---------------------------------------------------------------------------

/** A valid definition made of ordinary mutable objects and arrays. */
function mutableDefinition() {
  return {
    version: SCENE_DEFINITION_VERSION,
    id: 'mutable.scene',
    units: 'm',
    upAxis: '+Y',
    forwardAxis: '-Z',
    nodes: [
      {
        pid: 'root', name: 'Root', parent: null, asset: 'a', tags: ['alpha'],
        transform: { translation: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [2, 1, 1] }
      },
      {
        pid: 'child', name: 'Child', parent: 'root', asset: null, tags: ['beta'],
        transform: { translation: [1, 0, 0], rotation: rotZ(Math.PI / 2), scale: [1, 1, 1] }
      }
    ]
  };
}

test('REGRESSION: a compiled artifact does not alias its source definition', () => {
  const source = mutableDefinition();
  const artifact = compileScene(source);

  const before = {
    artifactHash: artifact.artifactHash,
    sourceHash: artifact.sourceHash,
    tags: JSON.stringify(artifact.nodes.map((n) => [...n.tags])),
    local: JSON.stringify(artifact.nodes.map((n) => ({
      t: [...n.local.translation], r: [...n.local.rotation], s: [...n.local.scale]
    }))),
    matrices: JSON.stringify(artifact.nodes.map((n) => [...n.world.matrix])),
    translations: JSON.stringify(artifact.nodes.map((n) => [...n.world.translation])),
    name: artifact.nodes[0].name,
    asset: artifact.nodes[0].asset
  };

  // Mutate every mutable container the source owns.
  source.nodes[0].tags.push('INJECTED');
  source.nodes[0].transform.translation[0] = 999;
  source.nodes[0].transform.rotation[3] = 0.5;
  source.nodes[0].transform.scale[1] = 42;
  source.nodes[1].tags.length = 0;
  source.nodes[1].transform.translation[2] = -17;
  source.nodes[0].name = 'RENAMED';
  source.nodes[0].asset = 'SWAPPED';
  source.id = 'HIJACKED';
  source.nodes.push({ pid: 'sneak', name: 'S', parent: null, tags: [], asset: null,
    transform: { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } });

  assert.equal(artifact.artifactHash, before.artifactHash, 'artifactHash must not move');
  assert.equal(artifact.sourceHash, before.sourceHash, 'sourceHash must not move');
  assert.equal(artifact.id, 'mutable.scene', 'artifact id must not follow the source');
  assert.equal(artifact.nodeCount, 2, 'a node appended to the source must not appear');
  assert.equal(artifact.nodes[0].name, before.name);
  assert.equal(artifact.nodes[0].asset, before.asset);
  assert.equal(JSON.stringify(artifact.nodes.map((n) => [...n.tags])), before.tags);
  assert.equal(JSON.stringify(artifact.nodes.map((n) => ({
    t: [...n.local.translation], r: [...n.local.rotation], s: [...n.local.scale]
  }))), before.local);
  assert.equal(JSON.stringify(artifact.nodes.map((n) => [...n.world.matrix])), before.matrices);
  assert.equal(JSON.stringify(artifact.nodes.map((n) => [...n.world.translation])), before.translations);
});

test('every artifact-owned container is frozen, not just the top level', () => {
  const artifact = compileScene(mutableDefinition());

  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.nodes));
  assert.ok(Object.isFrozen(artifact.order));
  assert.ok(Object.isFrozen(artifact.roots));

  for (const node of artifact.nodes) {
    assert.ok(Object.isFrozen(node), `${node.pid} node`);
    assert.ok(Object.isFrozen(node.tags), `${node.pid} tags`);
    assert.ok(Object.isFrozen(node.children), `${node.pid} children`);
    assert.ok(Object.isFrozen(node.local), `${node.pid} local`);
    assert.ok(Object.isFrozen(node.local.translation), `${node.pid} local.translation`);
    assert.ok(Object.isFrozen(node.local.rotation), `${node.pid} local.rotation`);
    assert.ok(Object.isFrozen(node.local.scale), `${node.pid} local.scale`);
    assert.ok(Object.isFrozen(node.localMatrix), `${node.pid} localMatrix`);
    assert.ok(Object.isFrozen(node.world), `${node.pid} world`);
    assert.ok(Object.isFrozen(node.world.matrix), `${node.pid} world.matrix`);
    assert.ok(Object.isFrozen(node.world.translation), `${node.pid} world.translation`);
  }
});

test('writing through an artifact throws rather than silently succeeding', () => {
  const artifact = compileScene(mutableDefinition());
  assert.throws(() => { artifact.id = 'x'; }, TypeError);
  assert.throws(() => { artifact.nodes[0].pid = 'x'; }, TypeError);
  assert.throws(() => { artifact.nodes[0].tags.push('x'); }, TypeError);
  assert.throws(() => { artifact.nodes[0].local.translation[0] = 99; }, TypeError);
  assert.throws(() => { artifact.nodes[0].world.matrix[12] = 99; }, TypeError);
  assert.throws(() => { artifact.nodes[0].world.translation[0] = 99; }, TypeError);
});

test('a decoded definition compiles to an artifact that owns its data', () => {
  // decodeScene returns frozen objects today, but the artifact must not depend
  // on that: the compiler is the thing that guarantees ownership.
  const decoded = decodeScene(encodeScene(createSceneDefinition({
    id: 'decoded',
    nodes: [createSceneNode({ pid: 'a', name: 'A', tags: ['t'], transform: { translation: [1, 1, 1] } })]
  })));
  const artifact = compileScene(decoded);
  assert.notEqual(artifact.nodes[0].tags, decoded.nodes[0].tags, 'tags must be a copy, not the same array');
  assert.notEqual(artifact.nodes[0].local, decoded.nodes[0].transform, 'local must be a copy');
  assert.notEqual(artifact.nodes[0].local.translation, decoded.nodes[0].transform.translation);
  assert.deepEqual([...artifact.nodes[0].tags], ['t']);
});

test('two artifacts compiled from one source share no mutable state', () => {
  const source = mutableDefinition();
  const a = compileScene(source);
  const b = compileScene(source);

  assert.equal(a.artifactHash, b.artifactHash, 'same source, same identity');
  assert.notEqual(a, b);
  assert.notEqual(a.nodes[0], b.nodes[0]);
  assert.notEqual(a.nodes[0].world.matrix, b.nodes[0].world.matrix);
  assert.deepEqual([...a.nodes[0].world.matrix], [...b.nodes[0].world.matrix]);
});

// ---------------------------------------------------------------------------
// UNIT-QUATERNION SOURCE CONTRACT — SCENE-COMPOSITION-001 REPAIR R2
//
// Scene validation accepted any finite, non-zero quaternion. But the rotation
// matrix formula in src/scene/affine.js assumes UNIT length, so a quaternion of
// length 0.707 shrank a node by 0.707 while its authored scale said [1, 1, 1] —
// an implicit scale the author never wrote.
//
// The contract already existed for geometry: transformMesh rejects non-unit
// quaternions with the same 1e-6 tolerance. Scene composition now shares that
// exact constant rather than inventing a second one.
//
// Non-unit quaternions are REFUSED, never normalized. Normalizing would rewrite
// authored source behind the author's back.
// ---------------------------------------------------------------------------

/** Builds a one-node definition carrying the given rotation. */
function rotationDefinition(rotation) {
  return createSceneDefinition({
    id: 'rotation.contract',
    nodes: [createSceneNode({ pid: 'n', name: 'N', transform: { rotation } })]
  });
}

test('REGRESSION: a non-unit quaternion is refused, not silently normalized', () => {
  // The validator's exact case. |q| = 0.7071..., so the node would have been
  // shrunk to 70.7% while its authored scale said [1, 1, 1].
  const rotation = [0, 0, 0.5, 0.5];
  assert.ok(Math.abs(Math.hypot(...rotation) - 1) > QUATERNION_UNIT_TOLERANCE,
    'the fixture must genuinely be non-unit');

  const result = validateSceneDefinition(rotationDefinition(rotation));
  assert.equal(result.valid, false);
  assert.ok(codesOf(result).includes('SCENE_ROTATION_NOT_UNIT'),
    `expected SCENE_ROTATION_NOT_UNIT, got ${codesOf(result).join(',')}`);

  // The diagnostic carries the measurement, so an author can see how far off
  // they are rather than guessing.
  const diagnostic = result.diagnostics.find((d) => d.code === 'SCENE_ROTATION_NOT_UNIT');
  assert.equal(diagnostic.severity, 'ERROR');
  assert.equal(diagnostic.subsystem, 'scene');
  assert.ok(Math.abs(diagnostic.data.length - Math.SQRT1_2) < 1e-12);
  assert.equal(diagnostic.data.tolerance, QUATERNION_UNIT_TOLERANCE);
  assert.match(diagnostic.message, /unit quaternion/);
  // The message must tell the author what to do, not merely that it failed.
  assert.match(diagnostic.message, /Normalize it at the authoring site/);
});

test('compileScene fails closed on a non-unit quaternion', () => {
  // Validation is the authoritative gate, and compilation enforces it before
  // any matrix is built. Previously this compiled successfully and produced a
  // silently shrunken node.
  assert.throws(() => compileScene(rotationDefinition([0, 0, 0.5, 0.5])), (error) => {
    assert.match(error.message, /SCENE_ROTATION_NOT_UNIT/);
    assert.ok(error.diagnostics.some((d) => d.code === 'SCENE_ROTATION_NOT_UNIT'));
    return true;
  });
});

test('the unit-quaternion tolerance is shared with the geometry TRS contract', () => {
  // One constant, one meaning. If these ever diverge, a transform valid for a
  // scene could be invalid for the mesh inside it.
  assert.equal(QUATERNION_UNIT_TOLERANCE, 1e-6);

  // transformMesh enforces the same rule on the same value.
  const mesh = createBoxMesh({ width: 1, height: 1, depth: 1, semanticName: 'probe' });
  assert.throws(() => transformMesh(mesh, { rotation: [0, 0, 0.5, 0.5] }), /unit quaternion/);
  assert.doesNotThrow(() => transformMesh(mesh, { rotation: [0, 0, 0, 1] }));
});

test('BOUNDARY: quaternion acceptance is exactly the shared tolerance', () => {
  const cases = [
    ['identity', [0, 0, 0, 1], true, null],
    ['generated 90 deg about Z', [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)], true, null],
    ['generated 30 deg about X', [Math.sin(Math.PI / 12), 0, 0, Math.cos(Math.PI / 12)], true, null],
    ['half length', [0, 0, 0.5, 0.5], false, 'SCENE_ROTATION_NOT_UNIT'],
    ['double length', [0, 0, 0, 2], false, 'SCENE_ROTATION_NOT_UNIT'],
    ['just outside tolerance, long', [0, 0, 0, 1 + 2e-6], false, 'SCENE_ROTATION_NOT_UNIT'],
    ['just outside tolerance, short', [0, 0, 0, 1 - 2e-6], false, 'SCENE_ROTATION_NOT_UNIT'],
    ['just inside tolerance, long', [0, 0, 0, 1 + 5e-7], true, null],
    ['just inside tolerance, short', [0, 0, 0, 1 - 5e-7], true, null],
    ['zero quaternion', [0, 0, 0, 0], false, 'SCENE_ROTATION_DEGENERATE'],
    ['effectively zero', [0, 0, 0, 1e-9], false, 'SCENE_ROTATION_DEGENERATE'],
    ['NaN component', [0, 0, 0, Number.NaN], false, 'SCENE_TRANSFORM_INVALID'],
    ['Infinite component', [Infinity, 0, 0, 1], false, 'SCENE_TRANSFORM_INVALID'],
    ['wrong arity', [0, 0, 1], false, 'SCENE_TRANSFORM_INVALID']
  ];

  for (const [label, rotation, expectValid, expectedCode] of cases) {
    const result = validateSceneDefinition(rotationDefinition(rotation));
    assert.equal(result.valid, expectValid,
      `${label}: expected ${expectValid ? 'ACCEPT' : 'REJECT'}, got ${codesOf(result).join(',') || 'ACCEPT'}`);

    if (expectedCode) {
      assert.ok(codesOf(result).includes(expectedCode),
        `${label}: expected ${expectedCode}, got ${codesOf(result).join(',')}`);
      // ONE malformed quaternion must produce ONE diagnostic. A zero
      // quaternion is also non-unit, and reporting both would be noise that
      // makes the real problem harder to see.
      const rotationCodes = codesOf(result).filter((c) => c.startsWith('SCENE_ROTATION_') || c === 'SCENE_TRANSFORM_INVALID');
      assert.equal(rotationCodes.length, 1,
        `${label}: expected exactly one rotation diagnostic, got ${rotationCodes.join(',')}`);
    }
  }
});

test('a degenerate quaternion is not reported as merely non-unit', () => {
  // These are different failures. A zero quaternion defines no orientation at
  // all; a length-0.5 quaternion defines a perfectly good orientation and is
  // refused for a different reason. Overloading one code would lose that.
  const zero = codesOf(validateSceneDefinition(rotationDefinition([0, 0, 0, 0])));
  assert.ok(zero.includes('SCENE_ROTATION_DEGENERATE'));
  assert.ok(!zero.includes('SCENE_ROTATION_NOT_UNIT'));

  const short = codesOf(validateSceneDefinition(rotationDefinition([0, 0, 0.5, 0.5])));
  assert.ok(short.includes('SCENE_ROTATION_NOT_UNIT'));
  assert.ok(!short.includes('SCENE_ROTATION_DEGENERATE'));
});

test('the authored quaternion is preserved exactly, never rewritten', () => {
  // Proof that nothing normalizes behind the author's back: an accepted
  // quaternion survives compilation bit for bit.
  const rotation = [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
  const artifact = compileScene(rotationDefinition(rotation));
  assert.deepEqual([...artifact.nodes[0].local.rotation], rotation);
});

test('an accepted rotation produces a matrix with unit basis columns', () => {
  // The property the contract exists to guarantee: authored scale [1,1,1]
  // means an actual scale of 1, with no implicit shrink hidden in the rotation.
  for (const angle of [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, 2.3]) {
    const rotation = [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];
    const artifact = compileScene(rotationDefinition(rotation));
    const m = artifact.nodes[0].world.matrix;
    for (const col of [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]]) {
      assert.ok(Math.abs(Math.hypot(...col) - 1) < 1e-12,
        `angle ${angle}: basis column length ${Math.hypot(...col)} must be 1`);
    }
  }
});
