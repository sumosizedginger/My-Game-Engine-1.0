import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

/**
 * Extracts the option names a destructured signature declares.
 *
 * Splits on commas at the outer destructuring depth only, so default values
 * that are themselves objects (such as `origin = { x: 0, y: 0, z: 0 }`) do not
 * contribute their own keys.
 *
 * @param {string} signatureText
 * @returns {Array<string>}
 */
function declaredParameters(signatureText) {
  const names = [];
  let depth = 0;
  let current = '';

  const flush = () => {
    const match = current.trim().match(/^([A-Za-z_$][\w$]*)/);
    if (match) names.push(match[1]);
    current = '';
  };

  for (const char of signatureText) {
    if (char === '{' || char === '[' || char === '(') {
      depth += 1;
      if (depth === 1) continue;
    } else if (char === '}' || char === ']' || char === ')') {
      if (depth === 1) { flush(); depth -= 1; continue; }
      depth -= 1;
    } else if (char === ',' && depth === 1) {
      flush();
      continue;
    }
    if (depth >= 1) current += char;
  }
  flush();

  // Drop the trailing `= {}` default of the options object itself.
  return names.filter((name) => name.length > 0);
}

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

test('every descriptor documents every parameter the function actually accepts', () => {
  // Anti-drift. A descriptor that omits a parameter is worse than no
  // descriptor: an agent reads it as the complete surface and never discovers
  // the option it needed. Signatures are read from source, so adding a
  // parameter without describing it fails here.
  const source = fs.readFileSync(new URL('../src/geometry/mesh-ops.js', import.meta.url), 'utf8');

  // Parameters that are positional rather than destructured options.
  const POSITIONAL = { transformMesh: ['mesh'], mergeMeshIR: ['meshes'] };

  for (const descriptor of AUTHORING_SURFACE.operations) {
    const signature = source.match(
      new RegExp(`export function ${descriptor.name}\\(([\\s\\S]*?)\\)\\s*\\{`)
    );
    assert.ok(signature, `could not read the signature of ${descriptor.name}`);

    const expected = new Set([...(POSITIONAL[descriptor.name] ?? []), ...declaredParameters(signature[1])]);
    const described = new Set(Object.keys(descriptor.params));

    for (const name of expected) {
      assert.ok(described.has(name),
        `${descriptor.name} accepts "${name}" but the descriptor does not document it`);
    }
    for (const name of described) {
      assert.ok(expected.has(name),
        `${descriptor.name} descriptor documents "${name}", which the function does not accept`);
    }
  }
});

test('every descriptor states units and defaults an agent needs to call it', () => {
  for (const descriptor of AUTHORING_SURFACE.operations) {
    for (const [param, text] of Object.entries(descriptor.params)) {
      assert.ok(text.length > 12, `${descriptor.name}.${param} needs a real description`);
    }
    assert.ok(descriptor.constraints && descriptor.constraints.length > 20,
      `${descriptor.name} must state its constraints`);
  }
});

test('descriptors state the refusals that would otherwise surprise an agent', () => {
  const byName = Object.fromEntries(AUTHORING_SURFACE.operations.map((d) => [d.name, d]));
  assert.match(byName.extrudeProfile.constraints, /convex/);
  assert.match(byName.transformMesh.constraints, /unit quaternion/);
  assert.match(byName.transformMesh.constraints, /NEGATIVE scale|Mirroring/);
  assert.match(byName.mergeMeshIR.constraints, /units, upAxis or forwardAxis/);
  assert.match(byName.createCylinderMesh.constraints, /\+Y/);
  assert.match(byName.createBoxMesh.params.origin, /CENTRE|centre/);
  assert.match(byName.createCylinderMesh.params.origin, /BASE|base/);
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
