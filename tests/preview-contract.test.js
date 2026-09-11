import test from 'node:test';
import assert from 'node:assert/strict';

import { createPreviewable } from '../src/preview/previewable.js';
import {
  PREVIEW_BUDGET_DEFAULTS,
  evaluatePreviewBudget,
  enforcePreviewBudget,
  resolveDevicePixelRatio
} from '../src/preview/budget.js';
import { createBoxMesh, createCylinderMesh, mergeMeshIR, transformMesh } from '../src/geometry/mesh-ops.js';
import { createMaterialDefinition } from '../src/material/index.js';
import { createAnchor } from '../src/geometry/anchors.js';

function fixtureMesh() {
  return mergeMeshIR([
    createBoxMesh({
      semanticName: 'body',
      materialId: 'test.steel',
      anchors: [createAnchor({ name: 'test.tip', partId: 'body', position: [0, 0.5, 0] })]
    }),
    transformMesh(createCylinderMesh({ semanticName: 'tube', materialId: 'test.glass' }), { translation: [2, 0, 0] })
  ], { id: 'fixture' });
}

const MATERIALS = () => [
  createMaterialDefinition({ id: 'test.steel', parameters: { color: 0x888888, metalness: 0.9 } }),
  createMaterialDefinition({ id: 'test.glass', parameters: { color: 0x224466, roughness: 0.2 } })
];

test('a Previewable exposes the full generic contract', () => {
  const p = createPreviewable({ mesh: fixtureMesh(), materials: MATERIALS(), type: 'test' });
  for (const key of ['id', 'type', 'object3D', 'bounds', 'parts', 'anchors', 'materials', 'stats', 'diagnostics', 'source', 'dispose']) {
    assert.ok(key in p, `missing contract member: ${key}`);
  }
  assert.equal(p.type, 'test');
  assert.equal(p.parts.length, 2);
  assert.equal(p.anchors.length, 1);
  assert.match(p.source.meshHash, /^[0-9a-f]{16}$/);
  p.dispose();
});

test('measured stats are reported, unmeasured values are not fabricated', () => {
  const p = createPreviewable({ mesh: fixtureMesh(), materials: MATERIALS() });
  assert.equal(p.stats.parts, 2);
  assert.equal(p.stats.materials, 2);
  assert.ok(p.stats.triangles > 0);
  assert.ok(p.stats.vertices > 0);
  // generationMs was not supplied, so it is null rather than invented.
  assert.equal(p.stats.generationMs, null);
  // drawCalls is a PREDICTION from the one-group-per-part architecture, needed
  // so the budget can refuse before allocating GPU resources. The browser test
  // asserts the prediction against the renderer's measured figure.
  assert.equal(p.stats.drawCalls, p.stats.parts);
  assert.equal(p.stats.groups, p.stats.parts);
  p.dispose();
});

test('the budget separates fail-closed limits from degradation limits', () => {
  const report = evaluatePreviewBudget({ triangles: 10 }, PREVIEW_BUDGET_DEFAULTS);
  assert.deepEqual(report.failClosedDimensions.sort(), [
    'maxDrawCalls', 'maxGenerationMs', 'maxMaterials', 'maxParts', 'maxTriangles', 'maxVertices'
  ]);
  assert.deepEqual(report.degradationDimensions, ['maxDpr']);
  // A high DPR is degradation, never a refusal: it does not make an asset
  // pathological, only expensive to rasterize.
  assert.equal(evaluatePreviewBudget({ triangles: 10, dpr: 8 }, PREVIEW_BUDGET_DEFAULTS).withinBudget, true);
});

test('maxDrawCalls is actually enforced, not merely advertised', () => {
  const mesh = fixtureMesh();
  assert.throws(
    () => createPreviewable({ mesh, materials: MATERIALS(), budget: { ...PREVIEW_BUDGET_DEFAULTS, maxDrawCalls: 1 } }),
    (err) => {
      assert.ok(err.diagnostics.some((d) => d.data?.statName === 'drawCalls'));
      return true;
    }
  );
});

test('DPR clamping reports requested and effective values with a diagnostic', () => {
  const within = resolveDevicePixelRatio(1.5, PREVIEW_BUDGET_DEFAULTS);
  assert.equal(within.clamped, false);
  assert.equal(within.effectiveDpr, 1.5);
  assert.equal(within.diagnostic, null);

  const clamped = resolveDevicePixelRatio(3, PREVIEW_BUDGET_DEFAULTS);
  assert.equal(clamped.clamped, true);
  assert.equal(clamped.requestedDpr, 3);
  assert.equal(clamped.effectiveDpr, PREVIEW_BUDGET_DEFAULTS.maxDpr);
  assert.equal(clamped.diagnostic.code, 'PREVIEW_DPR_CLAMPED');
  assert.equal(clamped.diagnostic.data.requestedDpr, 3);

  // Degradation is visible, never silent.
  assert.ok(clamped.diagnostic.message.includes('clamped'));
});

test('materials come from Material Forge, never invented by the preview', () => {
  assert.throws(
    () => createPreviewable({ mesh: fixtureMesh(), materials: [MATERIALS()[0]] }),
    /has no MaterialDefinition/
  );
});

test('a mesh with no part materials gets one default and says so', () => {
  const mesh = createBoxMesh({ semanticName: 'plain' });
  const p = createPreviewable({ mesh, materials: [] });
  assert.equal(p.compiledMaterials.length, 1);
  assert.ok(p.diagnostics.some((d) => d.code === 'PREVIEW_DEFAULT_MATERIAL'));
  p.dispose();
});

test('an invalid MeshIR is refused before any renderer resource is allocated', () => {
  const broken = { ...createBoxMesh({ semanticName: 'x' }), parts: [] };
  assert.throws(
    () => createPreviewable({ mesh: broken, materials: [] }),
    (err) => {
      assert.ok(Array.isArray(err.diagnostics));
      return true;
    }
  );
});

test('the budget fails closed rather than degrading silently', () => {
  const mesh = fixtureMesh();
  assert.throws(
    () => createPreviewable({ mesh, materials: MATERIALS(), budget: { ...PREVIEW_BUDGET_DEFAULTS, maxTriangles: 4 } }),
    (err) => {
      assert.match(err.message, /budget exceeded/);
      assert.match(err.message, /fails closed/);
      assert.equal(err.diagnostics[0].code, 'PREVIEW_BUDGET_EXCEEDED');
      return true;
    }
  );
});

test('the budget reports every violation, not only the first', () => {
  const report = evaluatePreviewBudget(
    { triangles: 1e6, vertices: 1e7, parts: 9999, materials: 999 },
    PREVIEW_BUDGET_DEFAULTS
  );
  assert.equal(report.withinBudget, false);
  assert.equal(report.violations.length, 4);
});

test('the budget refuses an unmeasurable stat instead of passing it', () => {
  const report = evaluatePreviewBudget({ triangles: NaN }, PREVIEW_BUDGET_DEFAULTS);
  assert.equal(report.withinBudget, false);
  assert.equal(report.violations[0].code, 'PREVIEW_BUDGET_UNMEASURABLE');
});

test('budget defaults are above every measured accepted asset in this repository', () => {
  // Measured at authoring time: Proof C world terrain 32,768 triangles /
  // 16,641 vertices; accepted humanoid 2,576 triangles / 1,401 vertices.
  assert.ok(PREVIEW_BUDGET_DEFAULTS.maxTriangles > 32768);
  assert.ok(PREVIEW_BUDGET_DEFAULTS.maxVertices > 16641);
  assert.equal(enforcePreviewBudget({ triangles: 32768, vertices: 16641 }).withinBudget, true);
});

test('dispose releases owned resources and is idempotent', () => {
  const p = createPreviewable({ mesh: fixtureMesh(), materials: MATERIALS() });
  let geometryDisposals = 0;
  let materialDisposals = 0;
  p.geometry.addEventListener('dispose', () => { geometryDisposals += 1; });
  for (const material of p.compiledMaterials) {
    material.addEventListener('dispose', () => { materialDisposals += 1; });
  }

  assert.equal(p.disposed, false);
  p.dispose();
  assert.equal(p.disposed, true);
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 2);

  p.dispose();
  assert.equal(geometryDisposals, 1, 'dispose must not double-release');
  assert.equal(materialDisposals, 2);
});

test('create and destroy repeatedly without leaking', () => {
  for (let i = 0; i < 5; i++) {
    const p = createPreviewable({ mesh: fixtureMesh(), materials: MATERIALS() });
    assert.equal(p.disposed, false);
    p.dispose();
    assert.equal(p.disposed, true);
  }
});
