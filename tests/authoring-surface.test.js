import test from 'node:test';
import assert from 'node:assert/strict';

import * as fullModule from '../src/full/index.js';
import { AUTHORING_SURFACE } from '../src/full/authoring.js';
import { MESH_OP_DESCRIPTORS } from '../src/geometry/mesh-ops.js';
import { PREVIEW_BUDGET_DEFAULTS } from '../src/preview/budget.js';
import { CANONICAL_VIEWS } from '../src/preview/views.js';
import { MESH_IR_VERSION } from '../src/geometry/mesh.js';

/**
 * API mismatch is the measured primary failure mode for agents writing 3D code
 * (3DCodeBench). The authoring-surface descriptor exists so an agent can
 * discover the surface instead of guessing it.
 *
 * These tests enforce Decision 5: the descriptor must SHARE source of truth
 * with the real operations. A hand-maintained duplicate registry would drift,
 * and drift in this descriptor is worse than having no descriptor at all.
 */

test('every described operation is actually exported', () => {
  for (const descriptor of AUTHORING_SURFACE.operations) {
    assert.equal(
      typeof fullModule[descriptor.name],
      'function',
      `descriptor names "${descriptor.name}" but engine/full does not export it`
    );
  }
});

test('every exported modeling verb is described', () => {
  const described = new Set(AUTHORING_SURFACE.operations.map((d) => d.name));
  for (const verb of ['createBoxMesh', 'createCylinderMesh', 'extrudeProfile', 'transformMesh', 'mergeMeshIR']) {
    assert.ok(described.has(verb), `exported verb "${verb}" is undescribed; an agent cannot discover it`);
  }
});

test('the descriptor shares the operation objects rather than copying them', () => {
  // Identity, not deep equality: a copy could drift, a shared reference cannot.
  assert.equal(AUTHORING_SURFACE.operations, MESH_OP_DESCRIPTORS);
});

test('the descriptor shares live budget and view values', () => {
  assert.equal(AUTHORING_SURFACE.preview.budgetDefaults, PREVIEW_BUDGET_DEFAULTS);
  assert.equal(AUTHORING_SURFACE.preview.canonicalViews, CANONICAL_VIEWS);
  assert.deepEqual(
    AUTHORING_SURFACE.preview.budgetDimensions,
    Object.keys(PREVIEW_BUDGET_DEFAULTS)
  );
});

test('the descriptor reports live version numbers', () => {
  assert.equal(AUTHORING_SURFACE.versions.meshIr, MESH_IR_VERSION);
  assert.ok(Number.isInteger(AUTHORING_SURFACE.versions.meshCodec));
  assert.ok(Number.isInteger(AUTHORING_SURFACE.versions.manifest));
});

test('the descriptor states the coordinate conventions an agent must assume', () => {
  assert.equal(AUTHORING_SURFACE.conventions.units, 'm');
  assert.equal(AUTHORING_SURFACE.conventions.upAxis, '+Y');
  assert.equal(AUTHORING_SURFACE.conventions.forwardAxis, '-Z');
  assert.equal(AUTHORING_SURFACE.conventions.attributeItemSizes.position, 3);
  assert.equal(AUTHORING_SURFACE.conventions.attributeItemSizes.uv, 2);
});

test('deliberate exclusions are documented with reasons, not merely absent', () => {
  const excluded = Object.fromEntries(AUTHORING_SURFACE.notExported.map((x) => [x.name, x.reason]));
  assert.ok(excluded.toBufferGeometry);
  assert.ok(excluded.renderCanonicalViews);
  for (const [name, reason] of Object.entries(excluded)) {
    assert.equal(name in fullModule, false, `${name} is documented as excluded but is exported`);
    assert.ok(reason.length > 20, `${name} needs a real reason, not a stub`);
  }
});

test('the laws an agent must obey are stated', () => {
  const laws = AUTHORING_SURFACE.laws.join(' ');
  assert.match(laws, /semanticName/);
  assert.match(laws, /pure/);
  assert.match(laws, /fails closed/);
  assert.match(laws, /bevel/);
});

test('the descriptor is serializable, so an agent can be handed it directly', () => {
  const json = JSON.stringify(AUTHORING_SURFACE);
  assert.ok(json.length > 500);
  const parsed = JSON.parse(json);
  assert.equal(parsed.tranche, 'AI-ASSET-FOUNDATION-001');
  assert.equal(parsed.operations.length, MESH_OP_DESCRIPTORS.length);
});

test('the descriptor is frozen', () => {
  assert.ok(Object.isFrozen(AUTHORING_SURFACE));
  assert.ok(Object.isFrozen(AUTHORING_SURFACE.conventions));
  assert.ok(Object.isFrozen(AUTHORING_SURFACE.notExported));
});
