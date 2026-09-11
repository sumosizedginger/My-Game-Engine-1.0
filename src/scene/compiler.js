/**
 * My Game Engine 1.0 — Scene Compiler
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The Definition -> Artifact half of the seam CONSTITUTION.md §3 requires,
 * applied to scene composition.
 *
 *   SceneDefinition -> compileScene() -> SceneArtifact -> instantiateScene()
 *
 * The compiler validates, establishes a canonical hierarchy order, derives
 * world transforms from local ones, and freezes the result. It does NOT
 * render, own GPU resources, run gameplay, or hold mutable state between
 * calls. It is not a service locator and it is not Kiln: Kiln is the
 * engine-wide compile/bake system (ARCHITECTURE.md §6) and remains unbuilt.
 *
 * WORLD TRANSFORM COMPOSITION follows the same order `transformMesh` uses for
 * geometry — scale, then rotate, then translate:
 *
 *   worldScale       = parentScale * localScale
 *   worldRotation    = parentRotation * localRotation
 *   worldTranslation = parentTranslation
 *                    + rotate(parentRotation, parentScale * localTranslation)
 *
 * Reusing that order is deliberate: a node's world placement must agree with
 * what the same TRS would have done to a mesh.
 *
 * This module must never import 'three'.
 */

import { normalizeZero } from '../geometry/mesh.js';
import { IDENTITY_TRANSFORM, SCENE_DEFINITION_VERSION } from './definition.js';
import { enforceValidSceneDefinition } from './validation.js';
import { encodeScene, hashTextBytes, sceneHash, SCENE_CODEC_VERSION } from './codec.js';

/** Compiled scene artifact version. Bump on any artifact shape change. */
export const SCENE_ARTIFACT_VERSION = 1;

/**
 * Hamilton product of two XYZW quaternions.
 *
 * Renormalized because repeated composition down a deep hierarchy accumulates
 * magnitude drift. `Math.sqrt` is IEEE-754 exact per the ECMAScript
 * specification, so this stays deterministic across conforming runtimes.
 *
 * @param {Array<number>} a
 * @param {Array<number>} b
 * @returns {Array<number>} Normalized quaternion XYZW.
 */
export function quaternionMultiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  const x = aw * bx + ax * bw + ay * bz - az * by;
  const y = aw * by - ax * bz + ay * bw + az * bx;
  const z = aw * bz + ax * by - ay * bx + az * bw;
  const w = aw * bw - ax * bx - ay * by - az * bz;
  const length = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
  return [
    normalizeZero(x / length),
    normalizeZero(y / length),
    normalizeZero(z / length),
    normalizeZero(w / length)
  ];
}

/**
 * Rotates a vector by an XYZW quaternion.
 *
 * Same formulation as `transformMesh`, so scene placement and geometry
 * transformation cannot drift apart.
 *
 * @param {Array<number>} q - Quaternion XYZW.
 * @param {Array<number>} v - Vector.
 * @returns {Array<number>} Rotated vector.
 */
export function quaternionRotate(q, v) {
  const [qx, qy, qz, qw] = q;
  const [x, y, z] = v;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    normalizeZero(x + qw * tx + (qy * tz - qz * ty)),
    normalizeZero(y + qw * ty + (qz * tx - qx * tz)),
    normalizeZero(z + qw * tz + (qx * ty - qy * tx))
  ];
}

/**
 * Composes a parent world transform with a child local transform.
 *
 * @param {object} parent - World TRS.
 * @param {object} local - Local TRS.
 * @returns {object} Frozen world TRS.
 */
export function composeTransforms(parent, local) {
  const scaled = [
    parent.scale[0] * local.translation[0],
    parent.scale[1] * local.translation[1],
    parent.scale[2] * local.translation[2]
  ];
  const rotated = quaternionRotate(parent.rotation, scaled);
  return Object.freeze({
    translation: Object.freeze([
      normalizeZero(parent.translation[0] + rotated[0]),
      normalizeZero(parent.translation[1] + rotated[1]),
      normalizeZero(parent.translation[2] + rotated[2])
    ]),
    rotation: Object.freeze(quaternionMultiply(parent.rotation, local.rotation)),
    scale: Object.freeze([
      normalizeZero(parent.scale[0] * local.scale[0]),
      normalizeZero(parent.scale[1] * local.scale[1]),
      normalizeZero(parent.scale[2] * local.scale[2])
    ])
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
 * @returns {object} Frozen SceneArtifact.
 */
export function compileScene(definition) {
  enforceValidSceneDefinition(definition);

  const ordered = canonicalOrder(definition.nodes);
  const world = new Map();
  const depths = new Map();
  const childPids = new Map();
  const compiled = [];

  ordered.forEach((node, index) => {
    const parentWorld = node.parent === null ? IDENTITY_TRANSFORM : world.get(node.parent);
    const nodeWorld = composeTransforms(parentWorld, node.transform);
    world.set(node.pid, nodeWorld);

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
      depth: depth,
      local: node.transform,
      world: nodeWorld
    });
  });

  // Child lists are attached after the walk so every parent has its complete
  // set, and frozen so an artifact cannot be edited into a different shape.
  const nodes = compiled.map((node) => Object.freeze({
    ...node,
    children: Object.freeze([...(childPids.get(node.pid) ?? [])])
  }));

  const sourceText = encodeScene(definition);
  const sourceHash = hashTextBytes(sourceText);

  const artifact = {
    artifactVersion: SCENE_ARTIFACT_VERSION,
    definitionVersion: SCENE_DEFINITION_VERSION,
    codecVersion: SCENE_CODEC_VERSION,
    id: definition.id,
    units: definition.units,
    upAxis: definition.upAxis,
    forwardAxis: definition.forwardAxis,
    sourceHash,
    nodes: Object.freeze(nodes),
    order: Object.freeze(nodes.map((n) => n.pid)),
    roots: Object.freeze(nodes.filter((n) => n.parent === null).map((n) => n.pid)),
    nodeCount: nodes.length,
    maxDepth: nodes.reduce((max, n) => Math.max(max, n.depth), 0)
  };

  // Artifact identity covers the compiled result, not just the source, so a
  // compiler change that alters derived world transforms is visible as a
  // different artifact even though the source is untouched.
  artifact.artifactHash = hashTextBytes(JSON.stringify({
    artifactVersion: artifact.artifactVersion,
    sourceHash,
    order: [...artifact.order],
    world: nodes.map((n) => [n.pid, [...n.world.translation], [...n.world.rotation], [...n.world.scale]])
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
