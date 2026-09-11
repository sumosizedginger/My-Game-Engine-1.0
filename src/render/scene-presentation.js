/**
 * My Game Engine 1.0 — Scene Presentation Adapter
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The boundary between an instantiated engine scene and Three.js.
 *
 *   SceneInstance + asset library -> Object3D tree
 *
 * DIRECTION IS ONE-WAY. This adapter READS a scene and produces renderer
 * objects. It never writes scene state, never holds scene authority, and
 * nothing upstream of it knows this file exists. A SceneDefinition compiled
 * without ever calling this module is still a complete scene; it simply is not
 * on screen. That is the property CONSTITUTION.md and ARCHITECTURE.md §43
 * require, and it is why a scene is engine data rather than a renderer graph.
 *
 * This file is allowed to import 'three'. `src/scene/**` is not.
 *
 * FLAT OBJECT TREE. Nodes are added as siblings under one group, each placed
 * at its already-derived WORLD transform, rather than mirrored into a nested
 * Object3D hierarchy. The scene compiler has already composed the hierarchy;
 * rebuilding it in the renderer would create a second place where parent-child
 * composition happens, and therefore a second chance for the two to disagree.
 *
 * Geometry and materials are shared per asset key and per material id: a cell
 * that places the same crate twice uploads one crate. This is resource
 * sharing, not draw-call batching — render compilation is a separate concern
 * and is not started here.
 */

import { Group, Mesh, Quaternion, Vector3 } from 'three';
import { toBufferGeometry } from './mesh-adapter.js';
import { compileMaterial } from '../material/compiler.js';

/**
 * Live scene presentation count.
 *
 * Evidence that dispose released what create acquired, within one page.
 */
let livePresentations = 0;

/**
 * @returns {number} Live scene presentation count.
 */
export function liveScenePresentationCount() {
  return livePresentations;
}

/**
 * Builds a renderer representation of an instantiated scene.
 *
 * @param {object} options
 * @param {object} options.instance - SceneInstance from `instantiateScene`.
 * @param {Map<string, object>} options.assets - asset key -> MeshIR.
 * @param {Array<object>} [options.materials=[]] - MaterialDefinitions.
 * @returns {object} Presentation handle.
 */
export function createScenePresentation({ instance, assets, materials = [] }) {
  if (!instance || typeof instance.members !== 'function') {
    throw new TypeError('createScenePresentation requires a SceneInstance');
  }
  if (!(assets instanceof Map)) {
    throw new TypeError('createScenePresentation requires an asset Map of key -> MeshIR');
  }

  const root = new Group();
  root.name = `scene:${instance.sceneId}`;

  const geometryByAsset = new Map();
  const materialById = new Map();
  const meshByPid = new Map();
  const unresolved = [];

  // Materials are compiled once from their definitions. A node referencing a
  // material id with no definition gets the first material rather than a
  // silent invisible mesh; the omission is reported, not hidden.
  for (const definition of materials) {
    materialById.set(definition.id, compileMaterial(definition));
  }

  const materialsFor = (mesh) => {
    const order = [];
    for (const part of mesh.parts) {
      if (part.materialId && !order.includes(part.materialId)) order.push(part.materialId);
    }
    return {
      order,
      list: order.map((id) => {
        const compiled = materialById.get(id);
        if (compiled) return compiled;
        unresolved.push(id);
        const fallback = compileMaterial({ id, parameters: { color: 0xff00ff, roughness: 1 } });
        materialById.set(id, fallback);
        return fallback;
      })
    };
  };

  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  for (const member of instance.members()) {
    if (!member.asset) continue;

    const meshIR = assets.get(member.asset);
    if (!meshIR) {
      unresolved.push(member.asset);
      continue;
    }

    let entry = geometryByAsset.get(member.asset);
    if (!entry) {
      const { order, list } = materialsFor(meshIR);
      entry = { geometry: toBufferGeometry(meshIR, { materialOrder: order }), materials: list };
      geometryByAsset.set(member.asset, entry);
    }

    const object = new Mesh(entry.geometry, entry.materials.length === 1 ? entry.materials[0] : entry.materials);
    object.name = member.pid;

    // The world transform already carries the full composed placement.
    position.set(...member.world.translation);
    quaternion.set(...member.world.rotation);
    scale.set(...member.world.scale);
    object.position.copy(position);
    object.quaternion.copy(quaternion);
    object.scale.copy(scale);

    // Scene identity travels with the renderer object, so a picked mesh can be
    // resolved back to the authored node without a side table.
    object.userData = {
      scenePid: member.pid,
      sceneId: instance.sceneId,
      semanticName: member.name,
      parentPid: member.parent,
      depth: member.depth,
      tags: member.tags,
      asset: member.asset
    };

    root.add(object);
    meshByPid.set(member.pid, object);
  }

  livePresentations += 1;
  let disposed = false;

  return {
    /** Root Object3D. Add this to a renderer scene. */
    root,
    sceneId: instance.sceneId,

    /** Number of renderer objects created. Nodes without an asset add none. */
    get objectCount() {
      return meshByPid.size;
    },

    /** Distinct uploaded geometries. Repeated assets share one. */
    get geometryCount() {
      return geometryByAsset.size;
    },

    /** Distinct compiled materials. */
    get materialCount() {
      return materialById.size;
    },

    /** Asset or material keys a node referenced but the library did not hold. */
    get unresolvedKeys() {
      return [...new Set(unresolved)];
    },

    get disposed() {
      return disposed;
    },

    /**
     * Renderer object for an authored node.
     *
     * @param {string} pid
     * @returns {object|null}
     */
    objectFor(pid) {
      return meshByPid.get(pid) ?? null;
    },

    /**
     * Releases every GPU resource this presentation created.
     *
     * Each geometry and material is disposed exactly once even though many
     * nodes share them. Repeated calls are safe.
     */
    dispose() {
      if (disposed) return;
      disposed = true;

      for (const mesh of meshByPid.values()) {
        mesh.removeFromParent();
      }
      meshByPid.clear();

      for (const entry of geometryByAsset.values()) {
        entry.geometry.dispose();
      }
      geometryByAsset.clear();

      for (const material of materialById.values()) {
        material.dispose();
      }
      materialById.clear();

      root.removeFromParent();
      livePresentations -= 1;
    }
  };
}
