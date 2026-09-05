import test from 'node:test';
import assert from 'node:assert/strict';

import { createEntityManager, createEntityHandle } from '../src/runtime/entities.js';

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
