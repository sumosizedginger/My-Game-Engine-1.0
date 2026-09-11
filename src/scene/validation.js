/**
 * My Game Engine 1.0 — Scene Definition Validation
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Structural validation for SceneDefinition, following the same
 * `{ valid, diagnostics }` contract and structured-diagnostic shape as
 * `validateMesh` in src/geometry/mesh.js.
 *
 * NO SILENT CORRECTION. A structurally ambiguous hierarchy — a duplicate
 * identity, a missing parent, a cycle — is refused with a diagnostic naming
 * exactly what is wrong. Guessing what an author meant is how editor-only
 * truth gets established, and CONSTITUTION.md §23 forbids it.
 *
 * That applies to values as well as structure. A non-unit rotation quaternion
 * is refused rather than normalized, matching the contract `transformMesh`
 * already enforces for geometry: normalizing would rewrite authored source
 * behind the author's back, and the source is what a human or an AI reads to
 * understand the scene.
 *
 * This module must never import 'three'.
 */

import { createDiagnostic } from '../runtime/index.js';
import { QUATERNION_UNIT_TOLERANCE } from '../geometry/mesh.js';
import { SCENE_DEFINITION_VERSION, SCENE_MAX_NODES } from './definition.js';

/** Identity strings accepted for `pid`: no whitespace, bounded length. */
const PID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

const isFiniteArray = (value, length) =>
  Array.isArray(value) && value.length === length && value.every(Number.isFinite);

/**
 * Validates a scene definition.
 *
 * Every structural defect is reported, not just the first, so an author fixes
 * one scene rather than one error at a time.
 *
 * @param {object} definition - SceneDefinition.
 * @returns {{ valid: boolean, diagnostics: Array<object> }}
 */
export function validateSceneDefinition(definition) {
  const diagnostics = [];
  const fail = (code, message, data = null) => {
    diagnostics.push(createDiagnostic({
      severity: 'ERROR', code, step: 'validate', subsystem: 'scene', message, data
    }));
  };

  if (!definition || typeof definition !== 'object') {
    fail('SCENE_INVALID', 'SceneDefinition must be an object');
    return { valid: false, diagnostics };
  }
  if (definition.version !== SCENE_DEFINITION_VERSION) {
    fail('SCENE_VERSION', `SceneDefinition version must be ${SCENE_DEFINITION_VERSION}`, { version: definition.version });
  }
  if (!definition.id || typeof definition.id !== 'string') {
    fail('SCENE_ID', 'SceneDefinition requires a non-empty string id');
  }
  for (const field of ['units', 'upAxis', 'forwardAxis']) {
    if (!definition[field] || typeof definition[field] !== 'string') {
      fail('SCENE_CONVENTION', `SceneDefinition requires a string ${field}`, { [field]: definition[field] });
    }
  }
  if (!Array.isArray(definition.nodes)) {
    fail('SCENE_NODES_INVALID', 'SceneDefinition.nodes must be an array');
    return { valid: false, diagnostics };
  }
  if (definition.nodes.length > SCENE_MAX_NODES) {
    fail('SCENE_TOO_LARGE', `SceneDefinition exceeds ${SCENE_MAX_NODES} nodes`, { nodes: definition.nodes.length });
  }

  // ---- Per-node structure and identity ----------------------------------
  const byPid = new Map();
  definition.nodes.forEach((node, index) => {
    const at = { index, pid: node?.pid ?? null };

    if (!node || typeof node !== 'object') {
      fail('SCENE_NODE_INVALID', `Scene node at index ${index} must be an object`, at);
      return;
    }
    if (typeof node.pid !== 'string' || !PID_PATTERN.test(node.pid)) {
      fail('SCENE_PID_INVALID',
        `Scene node at index ${index} requires a pid matching ${PID_PATTERN}`, at);
      return;
    }
    if (byPid.has(node.pid)) {
      fail('SCENE_DUPLICATE_PID',
        `Duplicate persistent id "${node.pid}". Persistent identity must be unique within a scene.`,
        { ...at, firstIndex: byPid.get(node.pid) });
      return;
    }
    byPid.set(node.pid, index);

    if (typeof node.name !== 'string' || node.name.length === 0) {
      fail('SCENE_NAME_REQUIRED',
        `Scene node "${node.pid}" requires a non-empty semantic name. Anonymous nodes are refused.`, at);
    }
    if (node.parent !== null && typeof node.parent !== 'string') {
      fail('SCENE_PARENT_INVALID', `Scene node "${node.pid}" parent must be a pid string or null`, at);
    }
    if (node.asset !== null && typeof node.asset !== 'string') {
      fail('SCENE_ASSET_INVALID', `Scene node "${node.pid}" asset must be a string key or null`, at);
    }
    if (!Array.isArray(node.tags) || !node.tags.every((t) => typeof t === 'string')) {
      fail('SCENE_TAGS_INVALID', `Scene node "${node.pid}" tags must be an array of strings`, at);
    }

    const t = node.transform;
    if (!t || typeof t !== 'object') {
      fail('SCENE_TRANSFORM_INVALID', `Scene node "${node.pid}" requires a transform`, at);
      return;
    }
    if (!isFiniteArray(t.translation, 3)) {
      fail('SCENE_TRANSFORM_INVALID',
        `Scene node "${node.pid}" translation must be a finite [x, y, z]`, { ...at, translation: t.translation });
    }
    // One malformed quaternion produces exactly one diagnostic: the chain below
    // is ordered from most to least fundamental, and stops at the first match.
    if (!isFiniteArray(t.rotation, 4)) {
      fail('SCENE_TRANSFORM_INVALID',
        `Scene node "${node.pid}" rotation must be a finite quaternion [x, y, z, w]`, { ...at, rotation: t.rotation });
    } else if (Math.hypot(...t.rotation) < QUATERNION_UNIT_TOLERANCE) {
      fail('SCENE_ROTATION_DEGENERATE',
        `Scene node "${node.pid}" rotation quaternion has zero length and cannot define an orientation`,
        { ...at, rotation: t.rotation });
    } else if (Math.abs(Math.hypot(...t.rotation) - 1) > QUATERNION_UNIT_TOLERANCE) {
      // A non-unit quaternion is NOT degenerate: it defines a perfectly good
      // orientation. It is rejected because the rotation-matrix formula in
      // src/scene/affine.js assumes unit length, so a quaternion of length
      // 0.707 shrinks the node by 0.707 even though its authored scale says
      // [1, 1, 1]. That is an implicit scale the author never wrote.
      //
      // It is REFUSED rather than normalized. Normalizing would silently
      // rewrite authored source, and the source is the truth a human or an AI
      // is meant to be able to read back. The same contract is enforced by
      // `transformMesh` for geometry.
      const length = Math.hypot(...t.rotation);
      fail('SCENE_ROTATION_NOT_UNIT',
        `Scene node "${node.pid}" rotation must be a unit quaternion; |q| = ${length}. ` +
        'A non-unit quaternion scales the node as a side effect of rotating it. ' +
        'Normalize it at the authoring site so the intent is explicit.',
        { ...at, rotation: t.rotation, length, tolerance: QUATERNION_UNIT_TOLERANCE });
    }
    if (!isFiniteArray(t.scale, 3)) {
      fail('SCENE_TRANSFORM_INVALID',
        `Scene node "${node.pid}" scale must be a finite [x, y, z]`, { ...at, scale: t.scale });
    } else {
      // Matches the law transformMesh already enforces: a zero scale collapses
      // geometry, and a negative scale mirrors it, flipping winding and normals.
      for (const component of t.scale) {
        if (component === 0) {
          fail('SCENE_SCALE_INVALID',
            `Scene node "${node.pid}" scale components must be non-zero`, { ...at, scale: t.scale });
          break;
        }
        if (component < 0) {
          fail('SCENE_SCALE_INVALID',
            `Scene node "${node.pid}" refuses a negative scale. Mirroring flips winding and surface ` +
            'orientation; author the mirrored form directly instead.', { ...at, scale: t.scale });
          break;
        }
      }
    }
  });

  // ---- Hierarchy --------------------------------------------------------
  for (const node of definition.nodes) {
    if (!node || typeof node.pid !== 'string' || byPid.get(node.pid) === undefined) continue;
    if (node.parent === null || typeof node.parent !== 'string') continue;

    if (node.parent === node.pid) {
      fail('SCENE_SELF_PARENT', `Scene node "${node.pid}" cannot be its own parent`, { pid: node.pid });
      continue;
    }
    if (!byPid.has(node.parent)) {
      fail('SCENE_MISSING_PARENT',
        `Scene node "${node.pid}" references parent "${node.parent}", which does not exist in this scene`,
        { pid: node.pid, parent: node.parent });
    }
  }

  // Cycle detection walks each node upward. Self-parents and missing parents
  // are already reported above and are skipped here so one defect produces one
  // diagnostic rather than three.
  const parentOf = new Map();
  for (const node of definition.nodes) {
    if (node && typeof node.pid === 'string' && byPid.get(node.pid) !== undefined) {
      const parent = typeof node.parent === 'string' && node.parent !== node.pid && byPid.has(node.parent)
        ? node.parent
        : null;
      parentOf.set(node.pid, parent);
    }
  }
  const reported = new Set();
  for (const startPid of parentOf.keys()) {
    const seen = new Set([startPid]);
    let current = parentOf.get(startPid);
    while (current) {
      if (seen.has(current)) {
        const chain = [...seen, current];
        if (!chain.some((pid) => reported.has(pid))) {
          chain.forEach((pid) => reported.add(pid));
          fail('SCENE_CYCLE',
            `Scene hierarchy contains a cycle through "${current}". A scene must be a forest, not a graph.`,
            { chain });
        }
        break;
      }
      seen.add(current);
      current = parentOf.get(current);
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/**
 * Validates and throws on failure, for call sites that cannot continue.
 *
 * @param {object} definition
 * @returns {object} The same definition.
 */
export function enforceValidSceneDefinition(definition) {
  const result = validateSceneDefinition(definition);
  if (!result.valid) {
    const error = new Error(
      `Invalid SceneDefinition: ${result.diagnostics.map((d) => d.code).join(', ')}`
    );
    error.diagnostics = result.diagnostics;
    throw error;
  }
  return definition;
}
