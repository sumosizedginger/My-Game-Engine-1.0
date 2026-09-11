/**
 * My Game Engine 1.0 — Scene Definition
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * A SCENE IS NOT A THREE.JS SCENE.
 *
 * A SceneDefinition is engine-owned source data describing what a composed
 * space contains, how its parts relate, and where they sit. It is plain
 * JSON-compatible data: no renderer objects, no runtime handles, no geometry.
 * Rendering CONSUMES a scene; it never owns one.
 *
 * Follows CONSTITUTION.md §3 (Definition / Artifact / Runtime separation),
 * §13 (Transform Authority), §14 (Identity) and ARCHITECTURE.md §43.
 *
 * IDENTITY. A node is identified by its `pid` — a persistent, authored
 * identity that belongs to the SOURCE. It is stable across compilation,
 * serialization, instantiation, unload and reinstantiation. It is NOT an
 * `EntityHandle`: runtime handles are allocated fresh on every instantiation
 * and must never be serialized (CONSTITUTION.md §14).
 *
 * GEOMETRY. A node references geometry only through an opaque `asset` key. The
 * scene layer never interprets it, so the definition stays renderer-independent
 * and serializable. A presentation layer resolves keys to whatever it needs.
 *
 * This module must never import 'three'.
 */

import { normalizeZero } from '../geometry/mesh.js';

/** Scene definition schema version. Bump on any shape change. */
export const SCENE_DEFINITION_VERSION = 1;

/** Scene authoring conventions, matching MeshIR. */
export const SCENE_UNITS = 'm';
export const SCENE_UP_AXIS = '+Y';
export const SCENE_FORWARD_AXIS = '-Z';

/**
 * The identity local transform.
 *
 * Uses the same representation the engine already owns for geometry
 * (`transformMesh` in src/geometry/mesh-ops.js): translation triple, rotation
 * as an XYZW quaternion, component-wise scale. Reusing it rather than
 * inventing a second convention is deliberate.
 */
export const IDENTITY_TRANSFORM = Object.freeze({
  translation: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0, 1]),
  scale: Object.freeze([1, 1, 1])
});

/** Maximum node count accepted by a single scene definition in this tranche. */
export const SCENE_MAX_NODES = 4096;

const triple = (value, fallback) => {
  const source = Array.isArray(value) ? value : fallback;
  return Object.freeze([
    normalizeZero(Number(source[0])),
    normalizeZero(Number(source[1])),
    normalizeZero(Number(source[2]))
  ]);
};

/**
 * Creates a local transform record in the engine's existing TRS convention.
 *
 * Values are normalized but NOT validated here; `validateSceneDefinition`
 * owns validation so that a malformed authoring call produces a structured
 * diagnostic rather than a thrown error halfway through a scene build.
 *
 * @param {object} [transform]
 * @param {Array<number>} [transform.translation=[0,0,0]]
 * @param {Array<number>} [transform.rotation=[0,0,0,1]] - Quaternion XYZW.
 * @param {Array<number>} [transform.scale=[1,1,1]]
 * @returns {object} Frozen local transform.
 */
export function createLocalTransform({ translation, rotation, scale } = {}) {
  const q = Array.isArray(rotation) ? rotation : [0, 0, 0, 1];
  return Object.freeze({
    translation: triple(translation, [0, 0, 0]),
    rotation: Object.freeze([
      normalizeZero(Number(q[0])),
      normalizeZero(Number(q[1])),
      normalizeZero(Number(q[2])),
      normalizeZero(Number(q[3]))
    ]),
    scale: triple(scale, [1, 1, 1])
  });
}

/**
 * Creates a scene node.
 *
 * @param {object} options
 * @param {string} options.pid - Persistent authored identity, unique per scene.
 * @param {string} options.name - Semantic name. Anonymous nodes are refused.
 * @param {string|null} [options.parent=null] - Parent `pid`, or null for a root.
 * @param {object} [options.transform] - LOCAL transform, relative to the parent.
 * @param {Array<string>} [options.tags=[]] - Lightweight authored metadata.
 * @param {string|null} [options.asset=null] - Opaque presentation key.
 * @returns {object} Frozen SceneNode.
 */
export function createSceneNode({
  pid,
  name,
  parent = null,
  transform = undefined,
  tags = [],
  asset = null
} = {}) {
  return Object.freeze({
    pid,
    name,
    parent: parent === undefined ? null : parent,
    transform: createLocalTransform(transform),
    // Sorted so that two authorings of the same tag set are byte-identical.
    tags: Object.freeze([...tags].map(String).sort()),
    asset: asset === undefined ? null : asset
  });
}

/**
 * Creates a scene definition.
 *
 * Node order in the returned definition is the order supplied. Canonical
 * ordering is established by the compiler, not here, so that a definition
 * round-trips exactly as authored.
 *
 * @param {object} options
 * @param {string} options.id - Scene identity.
 * @param {Array<object>} [options.nodes=[]]
 * @param {string} [options.units='m']
 * @param {string} [options.upAxis='+Y']
 * @param {string} [options.forwardAxis='-Z']
 * @returns {object} Frozen SceneDefinition.
 */
export function createSceneDefinition({
  id,
  nodes = [],
  units = SCENE_UNITS,
  upAxis = SCENE_UP_AXIS,
  forwardAxis = SCENE_FORWARD_AXIS
} = {}) {
  return Object.freeze({
    version: SCENE_DEFINITION_VERSION,
    id,
    units,
    upAxis,
    forwardAxis,
    nodes: Object.freeze(nodes.map((node) => (Object.isFrozen(node) ? node : createSceneNode(node))))
  });
}
