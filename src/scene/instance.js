/**
 * My Game Engine 1.0 — Runtime Scene Instance
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The Artifact -> Runtime half of the CONSTITUTION.md §3 seam.
 *
 *   SceneArtifact -> instantiateScene() -> SceneInstance
 *
 * IDENTITY. This is where the two identities meet and must not be confused:
 *
 *   pid            persistent authored identity, owned by the SOURCE.
 *                  Stable across compile, serialize, unload and reload.
 *
 *   EntityHandle   runtime identity, owned by THIS instance.
 *                  Allocated fresh on every instantiation. Never serialized.
 *
 * Unloading and reinstantiating the same artifact yields the same pids and
 * different handles. That is the property future streaming and save systems
 * depend on, and `tests/scene.test.js` asserts it directly.
 *
 * TRANSFORM AUTHORITY. A node with a parent is registered as
 * `TRANSFORM_OWNERSHIP.ATTACHED`, which GAMEPLAY_FOUNDATION.md §3.1 already
 * defines as "derives world transform hierarchically from a parent entity".
 * A root node is `STATIC`. Neither is moved by `commitAll`, so scene
 * composition adds no second per-tick writer: it publishes derived world
 * POSITION into the existing transform manager once, at instantiation.
 *
 * Rotation and scale are deliberately NOT pushed into the transform record,
 * because the runtime Transform owns position and velocity only. Consumers
 * needing full placement read `worldMatrixOf(pid)`, which is derived artifact
 * data rather than a competing mutable transform store. The published position
 * is read out of that authoritative matrix, so the two can never disagree.
 *
 * NO SINGLETON. Every instance owns its own maps. Two instances of the same
 * artifact are fully independent, and disposing one cannot disturb the other.
 *
 * This module must never import 'three'.
 */

import { transformPoint } from './affine.js';
import { createEntityManager } from '../runtime/entities.js';
import { createTransformManager, TRANSFORM_OWNERSHIP } from '../runtime/transforms.js';
import { createDiagnostic } from '../runtime/index.js';

/**
 * Live SceneInstance count for the whole module.
 *
 * Page reload proves nothing about lifecycle correctness — it discards the
 * whole JavaScript world — so this counter is the evidence that dispose
 * released what instantiate acquired, within one page. It is a diagnostic
 * counter, never scene state: no instance is reachable through it.
 */
let liveInstances = 0;

/**
 * Monotonic counter producing a unique id per SceneInstance.
 *
 * An `EntityHandle` is only meaningful relative to the entity manager that
 * issued it: two managers each starting from an empty pool both allocate
 * `{index: 0, generation: 1}`. Those are different entities with equal handle
 * VALUES. Without a discriminator, handing instance A's handle to instance B
 * would resolve to B's entity in that slot -- silent cross-scene identity
 * confusion, which is the same class of bug generational handles exist to
 * prevent, one level up.
 *
 * Each instance therefore stamps its own id into the entity data it creates
 * and checks it when resolving a handle back to a pid.
 *
 * KNOWN LIMIT. This makes ownership decidable when instances SHARE an entity
 * manager, which is the realistic multi-scene shape. It cannot help when two
 * instances own separate pools: there the handle values genuinely collide and
 * carry no pool identity, so no lookup can tell them apart. Making handles
 * globally unique would mean changing runtime identity architecture, which is
 * out of scope here. Scenes that must interoperate should share one manager.
 */
let instanceSequence = 0;

/**
 * @returns {number} Live SceneInstance count.
 */
export function liveSceneInstanceCount() {
  return liveInstances;
}

const handleKey = (handle) => `${handle.index}:${handle.generation}`;

/**
 * Instantiates a compiled scene artifact into runtime state.
 *
 * The artifact is never mutated. Managers may be supplied so several scenes
 * share one runtime world; when omitted, the instance creates and owns its
 * own, and disposes them.
 *
 * @param {object} artifact - Frozen SceneArtifact from `compileScene`.
 * @param {object} [options]
 * @param {object} [options.entityManager] - Existing entity manager to borrow.
 * @param {object} [options.transformManager] - Existing transform manager to borrow.
 * @returns {object} SceneInstance.
 */
export function instantiateScene(artifact, { entityManager = null, transformManager = null } = {}) {
  if (!artifact || typeof artifact !== 'object' || !Array.isArray(artifact.nodes)) {
    throw new TypeError('instantiateScene requires a compiled SceneArtifact');
  }
  if (!Object.isFrozen(artifact)) {
    throw new TypeError('instantiateScene requires a frozen SceneArtifact; compile it with compileScene');
  }

  if ((entityManager === null) !== (transformManager === null)) {
    throw new TypeError(
      'instantiateScene requires both entityManager and transformManager, or neither. ' +
      'A borrowed entity manager paired with a fresh transform manager would silently ' +
      'split transform authority across two stores.'
    );
  }

  const ownsManagers = entityManager === null;
  const entities = entityManager ?? createEntityManager();
  const transforms = transformManager ?? createTransformManager(entities);

  instanceSequence += 1;
  const instanceId = `scene:${artifact.id}#${instanceSequence}`;

  const handleByPid = new Map();
  const pidByHandle = new Map();
  const diagnostics = [];
  let disposed = false;

  for (const node of artifact.nodes) {
    const handle = entities.spawn({
      scenePid: node.pid,
      sceneId: artifact.id,
      sceneInstanceId: instanceId,
      name: node.name,
      tags: node.tags,
      asset: node.asset,
      parentPid: node.parent
    });
    handleByPid.set(node.pid, handle);
    pidByHandle.set(handleKey(handle), node.pid);

    // Position comes from the authoritative world matrix rather than from a
    // parallel value, so there is one source of placement truth.
    const [wx, wy, wz] = transformPoint(node.world.matrix, [0, 0, 0]);
    transforms.setTransform(handle, {
      position: { x: wx, y: wy, z: wz },
      // A parented node's world transform is derived from its parent, which is
      // exactly what ATTACHED means. Roots are immovable scenery.
      ownership: node.parent === null ? TRANSFORM_OWNERSHIP.STATIC : TRANSFORM_OWNERSHIP.ATTACHED
    });
  }

  diagnostics.push(createDiagnostic({
    severity: 'INFO',
    code: 'SCENE_INSTANTIATED',
    step: 'instantiate',
    subsystem: 'scene',
    message: `Scene "${artifact.id}" instantiated with ${artifact.nodes.length} nodes`,
    data: {
      sceneId: artifact.id,
      instanceId,
      nodes: artifact.nodes.length,
      sourceHash: artifact.sourceHash
    }
  }));

  liveInstances += 1;

  const requireLive = () => {
    if (disposed) throw new Error(`SceneInstance for "${artifact.id}" has been disposed`);
  };

  const instance = {
    /** Scene identity from the artifact source. */
    sceneId: artifact.id,
    /**
     * Unique id for THIS instantiation.
     *
     * Runtime only. It is never serialized and is not part of scene identity:
     * two instances of one artifact share a `sceneId` and differ here.
     */
    instanceId,
    /** Immutable compiled artifact this instance was built from. */
    artifact,
    sourceHash: artifact.sourceHash,
    artifactHash: artifact.artifactHash,

    /** Runtime managers. Owned when created here, borrowed when supplied. */
    entities,
    transforms,
    ownsManagers,

    /** Number of scene members this instance created. */
    get size() {
      return handleByPid.size;
    },

    get disposed() {
      return disposed;
    },

    /**
     * Runtime handle for a persistent authored id.
     *
     * @param {string} pid
     * @returns {object|null} EntityHandle, or null if the pid is not in this scene.
     */
    handleFor(pid) {
      requireLive();
      return handleByPid.get(pid) ?? null;
    },

    /**
     * Persistent authored id for a runtime handle.
     *
     * Returns null for a stale handle, because a stale handle refers to
     * nothing — resolving it to a pid would be exactly the silent reuse
     * generational handles exist to prevent.
     *
     * Also returns null for a handle issued by a different scene instance in
     * the SAME entity manager. Across separate managers, handle values can
     * collide and are indistinguishable - see the module note on that limit.
     *
     * @param {object} handle - EntityHandle.
     * @returns {string|null}
     */
    pidFor(handle) {
      requireLive();
      if (!handle || !entities.isValid(handle)) return null;
      if (entities.get(handle)?.sceneInstanceId !== instanceId) return null;
      return pidByHandle.get(handleKey(handle)) ?? null;
    },

    /**
     * Reports whether a handle was issued by this instance and is still live.
     *
     * Decidable within one entity manager. Across separate managers, a
     * colliding handle value from another instance cannot be detected.
     *
     * @param {object} handle - EntityHandle.
     * @returns {boolean}
     */
    owns(handle) {
      if (disposed || !handle || !entities.isValid(handle)) return false;
      return entities.get(handle)?.sceneInstanceId === instanceId;
    },

    /**
     * Compiled node record for a persistent id.
     *
     * @param {string} pid
     * @returns {object|null} Frozen node, or null.
     */
    nodeFor(pid) {
      return artifact.nodes.find((node) => node.pid === pid) ?? null;
    },

    /**
     * Derived world placement for a persistent id.
     *
     * Composition-derived artifact data, not a mutable transform. The shape is
     * `{ matrix, translation, sheared }`, where `matrix` is authoritative and
     * `translation` is read out of it. There is no `rotation` or `scale`: a
     * sheared hierarchy has no TRS decomposition and claiming one would be
     * false.
     *
     * @param {string} pid
     * @returns {object|null} Frozen world placement, or null.
     */
    worldTransformOf(pid) {
      return this.nodeFor(pid)?.world ?? null;
    },

    /**
     * Authoritative world matrix for a persistent id.
     *
     * Column-major, column vectors. See src/scene/affine.js for the convention.
     *
     * @param {string} pid
     * @returns {Array<number>|null} Frozen 16-element matrix, or null.
     */
    worldMatrixOf(pid) {
      return this.nodeFor(pid)?.world.matrix ?? null;
    },

    /**
     * Authored local transform for a persistent id.
     *
     * @param {string} pid
     * @returns {object|null} Frozen local TRS, or null.
     */
    localTransformOf(pid) {
      return this.nodeFor(pid)?.local ?? null;
    },

    /**
     * Child persistent ids of a node, in canonical order.
     *
     * @param {string} pid
     * @returns {Array<string>}
     */
    childrenOf(pid) {
      return [...(this.nodeFor(pid)?.children ?? [])];
    },

    /**
     * Parent persistent id of a node.
     *
     * @param {string} pid
     * @returns {string|null}
     */
    parentOf(pid) {
      return this.nodeFor(pid)?.parent ?? null;
    },

    /**
     * Root persistent ids.
     *
     * @returns {Array<string>}
     */
    roots() {
      return [...artifact.roots];
    },

    /**
     * Every scene member, in canonical hierarchy order.
     *
     * @returns {Array<object>} { pid, name, parent, depth, handle, world }
     */
    members() {
      requireLive();
      return artifact.nodes.map((node) => ({
        pid: node.pid,
        name: node.name,
        parent: node.parent,
        depth: node.depth,
        asset: node.asset,
        tags: node.tags,
        handle: handleByPid.get(node.pid) ?? null,
        world: node.world
      }));
    },

    /**
     * Structured diagnostics produced by this instance.
     *
     * @returns {Array<object>}
     */
    getDiagnostics() {
      return [...diagnostics];
    },

    /**
     * Releases every runtime entity this instance created.
     *
     * Borrowed managers keep serving their other consumers: only this scene's
     * own entities are despawned. Owned managers are cleared entirely.
     * Repeated calls are safe.
     */
    dispose() {
      if (disposed) return;
      disposed = true;

      for (const handle of handleByPid.values()) {
        // Despawn bumps the slot generation, so every handle this instance
        // handed out becomes permanently stale rather than silently valid for
        // whatever entity occupies the slot next.
        entities.despawn(handle);
      }
      handleByPid.clear();
      pidByHandle.clear();

      if (ownsManagers) {
        transforms.clear();
        entities.clear();
      }

      liveInstances -= 1;
    }
  };

  return instance;
}
