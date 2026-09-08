import test from 'node:test';
import assert from 'node:assert/strict';

import { createEntityManager, createEntityHandle, createTransformManager } from '../src/runtime/index.js';

test('generational handle: spawn creates valid handle with initial generation 1', () => {
  const manager = createEntityManager();
  const handle = manager.spawn({ name: 'Player' });

  assert.equal(handle.index, 0);
  assert.equal(handle.generation, 1);
  assert.equal(manager.isValid(handle), true);
  assert.equal(manager.count(), 1);

  const data = manager.get(handle);
  assert.equal(data.name, 'Player');
});

test('generational handle: despawn invalidates handle and frees slot', () => {
  const manager = createEntityManager();
  const handle = manager.spawn({ name: 'Enemy' });

  const despawned = manager.despawn(handle);
  assert.equal(despawned, true);
  assert.equal(manager.isValid(handle), false);
  assert.equal(manager.get(handle), null);
  assert.equal(manager.count(), 0);
});

test('generational handle: slot reuse increments generation and rejects stale handles', () => {
  const manager = createEntityManager();
  const handle1 = manager.spawn({ name: 'FirstOccupant' });
  assert.equal(handle1.index, 0);
  assert.equal(handle1.generation, 1);

  // Despawn slot 0
  manager.despawn(handle1);

  // Spawn new entity - should reuse slot 0 with incremented generation 2
  const handle2 = manager.spawn({ name: 'SecondOccupant' });
  assert.equal(handle2.index, 0);
  assert.equal(handle2.generation, 2);

  // handle2 is valid, points to SecondOccupant
  assert.equal(manager.isValid(handle2), true);
  assert.equal(manager.get(handle2).name, 'SecondOccupant');

  // CRITICAL ARCHITECTURAL CONTRACT: Stale handle1 targeting same slot 0 must be rejected!
  assert.equal(manager.isValid(handle1), false);
  assert.equal(manager.get(handle1), null);
});

test('generational handle: getAll iterates only active entities', () => {
  const manager = createEntityManager();
  const h1 = manager.spawn({ id: 1 });
  const h2 = manager.spawn({ id: 2 });
  const h3 = manager.spawn({ id: 3 });

  manager.despawn(h2);

  const all = manager.getAll();
  assert.equal(all.length, 2);
  const ids = all.map((e) => e.data.id);
  assert.deepEqual(ids, [1, 3]);
});

test('clear invalidates handles immediately and after slot reuse', () => {
  const manager = createEntityManager();
  const stale = manager.spawn({ name: 'old' });
  manager.clear();

  assert.equal(manager.count(), 0);
  assert.deepEqual(manager.getAll(), []);
  assert.equal(manager.isValid(stale), false);
  assert.equal(manager.get(stale), null);

  const current = manager.spawn({ name: 'new' });
  assert.equal(current.index, stale.index);
  assert.ok(current.generation > stale.generation);
  assert.equal(manager.isValid(stale), false);
  assert.equal(manager.get(stale), null);
  assert.equal(manager.set(stale, { name: 'corrupted' }), false);
  assert.equal(manager.despawn(stale), false);
  assert.deepEqual(manager.get(current), { name: 'new' });
  assert.equal(manager.count(), 1);
});

test('clear safely reuses multiple live and previously despawned slots', () => {
  const manager = createEntityManager();
  const stale = Array.from({ length: 8 }, (_, id) => manager.spawn({ id }));
  manager.despawn(stale[3]);
  manager.clear();
  assert.equal(manager.count(), 0);
  assert.deepEqual(manager.getAll(), []);

  const current = stale.map((_, id) => manager.spawn({ id }));
  assert.equal(new Set(current.map(handle => handle.index)).size, stale.length);
  assert.equal(manager.count(), stale.length);
  assert.equal(manager.getAll().length, stale.length);
  for (const old of stale) {
    assert.equal(manager.isValid(old), false);
    assert.equal(manager.get(old), null);
    const reused = current.find(handle => handle.index === old.index);
    assert.ok(reused);
    assert.ok(reused.generation > old.generation);
    assert.equal(manager.isValid(reused), true);
  }
});

test('repeated clear and reuse never resurrects any earlier handle', () => {
  const manager = createEntityManager();
  const history = [];
  for (let cycle = 0; cycle < 100; cycle++) {
    const live = Array.from({ length: 4 }, () => manager.spawn());
    for (const current of live) {
      for (const old of history.filter(handle => handle.index === current.index)) {
        assert.ok(current.generation > old.generation);
      }
    }
    for (const old of history) {
      assert.equal(manager.isValid(old), false);
      assert.equal(manager.get(old), null);
    }
    history.push(...live);
    manager.clear();
    assert.equal(manager.count(), 0);
    assert.deepEqual(manager.getAll(), []);
    for (const old of history) {
      assert.equal(manager.isValid(old), false);
      assert.equal(manager.get(old), null);
    }
  }
});

test('empty clears preserve safe reuse and subsequent despawn behavior', () => {
  const manager = createEntityManager();
  manager.clear();
  manager.clear();
  const first = manager.spawn();
  assert.equal(manager.despawn(first), true);
  manager.clear();
  manager.clear();
  assert.equal(manager.count(), 0);
  assert.deepEqual(manager.getAll(), []);
  const second = manager.spawn();
  assert.equal(second.index, first.index);
  assert.ok(second.generation > first.generation);
  assert.equal(manager.despawn(first), false);
  assert.equal(manager.despawn(second), true);
  assert.equal(manager.despawn(second), false);
  const third = manager.spawn();
  assert.equal(third.index, second.index);
  assert.ok(third.generation > second.generation);
  assert.equal(manager.isValid(first), false);
  assert.equal(manager.isValid(second), false);
  assert.equal(manager.count(), 1);
  assert.deepEqual(manager.getAll().map(entity => entity.handle), [third]);
});

test('invalid numeric handles are rejected without changing entity lifetime', () => {
  const manager = createEntityManager();
  const live = manager.spawn({ name: 'live' });
  const invalid = [null, {}, ...[NaN, Infinity, -Infinity, -1, 0.5, 1, '0'].map(index => ({ index, generation: live.generation })),
    ...[NaN, Infinity, -1, 0.5, '1'].map(generation => ({ index: live.index, generation }))];
  for (const handle of invalid) {
    assert.equal(manager.isValid(handle), false);
    assert.equal(manager.get(handle), null);
    assert.equal(manager.set(handle, { name: 'corrupted' }), false);
    assert.equal(manager.despawn(handle), false);
  }
  assert.equal(manager.count(), 1);
  assert.deepEqual(manager.get(live), { name: 'live' });
  assert.equal(manager.despawn(live), true);
  const next = manager.spawn();
  assert.equal(next.index, live.index);
  assert.equal(next.generation, live.generation + 1);
});

test('entity clear prevents stale transform access and mutation after reuse', () => {
  const manager = createEntityManager();
  const transforms = createTransformManager(manager);
  const stale = manager.spawn();
  transforms.setTransform(stale, { ownership: 'KINEMATIC' });
  transforms.setIntent(stale, { x: 100 });
  manager.clear();
  const current = manager.spawn();
  assert.equal(transforms.getTransform(current), null);
  transforms.setTransform(current, { position: { x: 3 }, ownership: 'KINEMATIC' });
  transforms.setIntent(current, { x: 2 });
  assert.equal(transforms.getTransform(stale), null);
  assert.throws(() => transforms.setTransform(stale), /invalid or stale/);
  transforms.setIntent(stale, { x: 100 });
  transforms.setVelocity(stale, { x: 100 });
  transforms.teleport(stale, { x: 100 });
  transforms.commitAll(1);
  assert.equal(transforms.getTransform(current).position.x, 5);
  assert.equal(transforms.getTransform(current).previousPosition.x, 3);
  assert.equal(transforms.getTransform(stale), null);
  transforms.clear();
  transforms.clear();
  assert.equal(transforms.getTransform(current), null);
});
