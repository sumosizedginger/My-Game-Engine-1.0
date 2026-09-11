/**
 * My Game Engine 1.0 — Generic Previewable Contract
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The smallest useful contract that lets Preview Lab and the evaluation capture
 * path inspect a generated visual artifact without knowing what it is.
 *
 * This is deliberately NOT a universal asset ontology, and ordinary game
 * objects are not required to implement it. It exists for generated visual
 * authoring artifacts. See `Next step.md` section 7.9.
 */

import { Mesh } from 'three';
import { createDiagnostic } from '../runtime/index.js';
import { toBufferGeometry, uniqueMaterialIds } from '../render/mesh-adapter.js';
import { compileMaterial } from '../material/index.js';
import { triangleCount, vertexCount, validateMesh } from '../geometry/mesh.js';
import { meshHash } from '../geometry/mesh-codec.js';
import { enforcePreviewBudget, PREVIEW_BUDGET_DEFAULTS } from './budget.js';

/**
 * Creates a Previewable from an authoring result.
 *
 * The MeshIR is validated and budgeted BEFORE any renderer resource is
 * allocated, so a pathological asset is refused rather than half-built.
 *
 * @param {object} options
 * @param {object} options.mesh - MeshIR.
 * @param {Array<object>} [options.materials=[]] - MaterialDefinitions.
 * @param {string} [options.type='asset']
 * @param {object} [options.source={}] - { definitionId, sourceHash, seed }
 * @param {number|null} [options.generationMs=null]
 * @param {object} [options.budget=PREVIEW_BUDGET_DEFAULTS]
 * @returns {object} Previewable.
 */
export function createPreviewable({
  mesh,
  materials = [],
  type = 'asset',
  source = {},
  generationMs = null,
  budget = PREVIEW_BUDGET_DEFAULTS
}) {
  const validation = validateMesh(mesh);
  if (!validation.valid) {
    const error = new Error(
      `createPreviewable refused an invalid MeshIR: ${validation.diagnostics.map((d) => d.code).join(', ')}`
    );
    error.diagnostics = validation.diagnostics;
    throw error;
  }

  const diagnostics = [...mesh.diagnostics];
  const materialOrder = uniqueMaterialIds(mesh);

  // Every material referenced by a part must actually be supplied. A missing
  // material is reported, never quietly substituted.
  const byId = new Map(materials.map((m) => [m.id, m]));
  for (const id of materialOrder) {
    if (!byId.has(id)) {
      throw new Error(
        `createPreviewable: part material "${id}" has no MaterialDefinition. ` +
        'Supply it through Material Forge rather than letting the preview invent one.'
      );
    }
  }

  const stats = {
    triangles: triangleCount(mesh),
    vertices: vertexCount(mesh),
    parts: mesh.parts.length,
    materials: materialOrder.length,
    groups: mesh.parts.length,
    // PREDICTED, not measured. A Previewable is one Mesh with one geometry
    // group per part, and a renderer issues one draw call per group, so the
    // part count is the draw-call count. Predicting it is what allows the
    // budget to refuse a pathological asset BEFORE allocating GPU resources.
    // tests/preview-browser.test.js asserts this prediction against the
    // renderer's own measured figure.
    drawCalls: mesh.parts.length,
    generationMs
  };

  const budgetReport = enforcePreviewBudget(stats, budget);

  const geometry = toBufferGeometry(mesh, { materialOrder });
  const compiledMaterials = materialOrder.length > 0
    ? materialOrder.map((id) => compileMaterial(byId.get(id)))
    : [compileMaterial({ id: `${mesh.id}:default` })];

  const object3D = new Mesh(
    geometry,
    compiledMaterials.length === 1 ? compiledMaterials[0] : compiledMaterials
  );
  object3D.name = mesh.id;

  if (materialOrder.length === 0) {
    diagnostics.push(createDiagnostic({
      severity: 'WARNING',
      code: 'PREVIEW_DEFAULT_MATERIAL',
      step: 'preview',
      subsystem: 'preview',
      message: `MeshIR "${mesh.id}" declares no part materialIds; a single default Material Forge material was compiled`,
      data: { meshId: mesh.id }
    }));
  }

  let disposed = false;

  return {
    id: mesh.id,
    type,
    mesh,
    object3D,
    geometry,
    materials: [...materials],
    compiledMaterials,
    materialOrder,
    bounds: mesh.bounds,
    parts: mesh.parts,
    anchors: mesh.anchors,
    stats: Object.freeze({ ...stats }),
    budgetReport,
    diagnostics,
    source: Object.freeze({
      definitionId: source.definitionId ?? mesh.id,
      sourceHash: source.sourceHash ?? null,
      meshHash: meshHash(mesh),
      seed: source.seed ?? null
    }),

    /**
     * Releases every renderer resource this Previewable owns. Idempotent.
     */
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      for (const material of compiledMaterials) material.dispose();
      object3D.clear();
    },

    get disposed() {
      return disposed;
    }
  };
}
