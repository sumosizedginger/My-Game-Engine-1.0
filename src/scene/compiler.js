/**
 * My Game Engine 1.0 — Scene Compiler
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The Definition -> Artifact half of the seam CONSTITUTION.md §3 requires,
 * applied to scene composition.
 *
 *   SceneDefinition -> compileScene() -> SceneArtifact -> instantiateScene()
 *
 * The compiler validates, takes an owned snapshot of the source, establishes a
 * canonical hierarchy order, derives world matrices from local ones, and deep
 * freezes the result. It does NOT render, own GPU resources, run gameplay, or
 * hold mutable state between calls. It is not a service locator and it is not
 * Kiln: Kiln is the engine-wide compile/bake system (ARCHITECTURE.md §6) and
 * remains unbuilt.
 *
 * WORLD COMPOSITION IS MATRIX COMPOSITION.
 *
 *   localMatrix = T * R * S
 *   worldMatrix = parentWorldMatrix * localMatrix
 *   root worldMatrix = localMatrix
 *
 * This replaced an independent-TRS composition that was mathematically wrong
 * whenever non-uniform scale and rotation appeared at different levels. It
 * lost the ordering between a parent's scale and a parent's rotation, and it
 * could not represent shear at all. See src/scene/affine.js for the defect,
 * the convention and the reproduction.
 *
 * The matrix is AUTHORITATIVE. `world.translation` is derived convenience data
 * read straight out of it. There is deliberately no `world.rotation` or
 * `world.scale`: for a hierarchy containing shear those values do not exist,
 * and publishing them would be a confident lie.
 *
 * THE ARTIFACT OWNS ITS DATA. Everything reachable from an artifact is copied
 * from the source and deep frozen, because a caller may legitimately pass a
 * plain mutable object — `decodeScene` output, an imported scene, a hand-built
 * definition — and a compiled artifact whose contents can change afterwards
 * while its hash does not is not an artifact.
 *
 * This module must never import 'three'.
 */

import { normalizeZero } from '../geometry/mesh.js';
import { SCENE_DEFINITION_VERSION } from './definition.js';
import { enforceValidSceneDefinition } from './validation.js';
import { encodeScene, hashTextBytes, sceneHash, SCENE_CODEC_VERSION } from './codec.js';
import {
  identityMatrix,
  matrixFromTRS,
  multiplyMatrices,
  transformPoint,
  translationOf,
  hasShear
} from './affine.js';

/**
 * Compiled scene artifact version.
 *
 * 2 — world placement became an authoritative affine matrix. Version 1 exposed
 *     `world.rotation` and `world.scale`, which are not generally derivable
 *     from a composed hierarchy.
 */
export const SCENE_ARTIFACT_VERSION = 2;

/**
 * Copies an authored TRS into artifact-owned frozen arrays.
 *
 * @param {object} transform
 * @returns {object} Frozen local TRS.
 */
function ownedTransform(transform) {
  return Object.freeze({
    translation: Object.freeze(transform.translation.map((n) => normalizeZero(Number(n)))),
    rotation: Object.freeze(transform.rotation.map((n) => normalizeZero(Number(n)))),
    scale: Object.freeze(transform.scale.map((n) => normalizeZero(Number(n))))
  });
}

/**
 * Takes an owned, frozen snapshot of a validated definition.
 *
 * Every mutable container the artifact will retain is copied here, once, so
 * nothing downstream aliases caller memory. Strings and numbers are immutable
 * already and are not cloned.
 *
 * @param {object} definition - Validated SceneDefinition.
 * @returns {object} Frozen snapshot.
 */
function snapshotDefinition(definition) {
  return Object.freeze({
    version: definition.version,
    id: definition.id,
    units: definition.units,
    upAxis: definition.upAxis,
    forwardAxis: definition.forwardAxis,
    nodes: Object.freeze(definition.nodes.map((node) => Object.freeze({
      pid: node.pid,
      name: node.name,
      parent: node.parent === undefined ? null : node.parent,
      asset: node.asset === undefined ? null : node.asset,
      tags: Object.freeze([...node.tags].map(String)),
      transform: ownedTransform(node.transform)
    })))
  });
}

/**
 * Establishes the canonical hierarchy order: every parent precedes every one
 * of its children, and siblings keep the order the author wrote them in.
 *
 * The order is a pure function of the definition, so the same definition
 * always compiles to the same artifact. Authored order is preserved rather
 * than sorted, because a scene's sibling order is authoring intent.
 *
 * @param {Array<object>} nodes
 * @returns {Array<object>} Nodes in canonical order.
 */
function canonicalOrder(nodes) {
  const childrenOf = new Map();
  const roots = [];
  for (const node of nodes) {
    if (node.parent === null) {
      roots.push(node);
    } else {
      if (!childrenOf.has(node.parent)) childrenOf.set(node.parent, []);
      childrenOf.get(node.parent).push(node);
    }
  }

  const ordered = [];
  const walk = (node) => {
    ordered.push(node);
    for (const child of childrenOf.get(node.pid) ?? []) walk(child);
  };
  roots.forEach(walk);
  return ordered;
}

/**
 * Compiles a scene definition into an immutable artifact.
 *
 * @param {object} definition - SceneDefinition.
 * @returns {object} Deep-frozen SceneArtifact.
 */
export function compileScene(definition) {
  enforceValidSceneDefinition(definition);

  // Snapshot BEFORE anything is derived. From here on the caller's object is
  // never read again, so mutating it cannot reach the artifact.
  const source = snapshotDefinition(definition);

  const ordered = canonicalOrder(source.nodes);
  const worldMatrices = new Map();
  const depths = new Map();
  const childPids = new Map();
  const compiled = [];

  ordered.forEach((node, index) => {
    const localMatrix = matrixFromTRS(node.transform);
    const parentMatrix = node.parent === null ? identityMatrix() : worldMatrices.get(node.parent);
    // worldMatrix = parentWorld * local. Column vectors, so `local` applies
    // to a point first and the parent chain applies outward from there.
    const worldMatrix = node.parent === null
      ? localMatrix
      : multiplyMatrices(parentMatrix, localMatrix);
    worldMatrices.set(node.pid, worldMatrix);

    // Canonical order guarantees the parent was visited first.
    const depth = node.parent === null ? 0 : depths.get(node.parent) + 1;
    depths.set(node.pid, depth);

    if (node.parent !== null) {
      if (!childPids.has(node.parent)) childPids.set(node.parent, []);
      childPids.get(node.parent).push(node.pid);
    }

    compiled.push({
      pid: node.pid,
      name: node.name,
      parent: node.parent,
      asset: node.asset,
      tags: node.tags,
      index,
      depth,
      local: node.transform,
      localMatrix: Object.freeze(localMatrix),
      world: Object.freeze({
        // AUTHORITATIVE. Column-major, column vectors. See src/scene/affine.js.
        matrix: Object.freeze(worldMatrix),
        // Derived: where the matrix places this node's local origin.
        translation: Object.freeze(translationOf(worldMatrix)),
        // Recorded rather than hidden. A sheared node has no TRS decomposition,
        // and a consumer that assumed one would be silently wrong.
        sheared: hasShear(worldMatrix)
      })
    });
  });

  // Child lists are attached after the walk so every parent has its complete
  // set, and frozen so an artifact cannot be edited into a different shape.
  const nodes = compiled.map((node) => Object.freeze({
    ...node,
    children: Object.freeze([...(childPids.get(node.pid) ?? [])])
  }));

  const sourceHash = hashTextBytes(encodeScene(source));

  const artifact = {
    artifactVersion: SCENE_ARTIFACT_VERSION,
    definitionVersion: SCENE_DEFINITION_VERSION,
    codecVersion: SCENE_CODEC_VERSION,
    id: source.id,
    units: source.units,
    upAxis: source.upAxis,
    forwardAxis: source.forwardAxis,
    sourceHash,
    nodes: Object.freeze(nodes),
    order: Object.freeze(nodes.map((n) => n.pid)),
    roots: Object.freeze(nodes.filter((n) => n.parent === null).map((n) => n.pid)),
    nodeCount: nodes.length,
    maxDepth: nodes.reduce((max, n) => Math.max(max, n.depth), 0),
    shearedNodeCount: nodes.filter((n) => n.world.sheared).length
  };

  // Artifact identity covers the compiled world MATRICES, because those are
  // what actually define placement. Hashing derived translation alone would
  // miss a compiler change that rotated or sheared every node in place.
  artifact.artifactHash = hashTextBytes(JSON.stringify({
    artifactVersion: artifact.artifactVersion,
    sourceHash,
    order: [...artifact.order],
    world: nodes.map((n) => [n.pid, [...n.world.matrix]])
  }));

  return Object.freeze(artifact);
}

/**
 * Convenience identity of a definition without compiling it.
 *
 * @param {object} definition
 * @returns {string} Hex fingerprint.
 */
export { sceneHash };

/**
 * Re-exported so consumers of a compiled scene can work with its matrices
 * without reaching for a private module.
 */
export { transformPoint, multiplyMatrices, identityMatrix, matrixFromTRS, translationOf, hasShear };
