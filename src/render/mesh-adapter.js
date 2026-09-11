/**
 * My Game Engine 1.0 — MeshIR to Three.js Render Adapter
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The designated boundary between engine-owned authoring geometry and Three.js
 * render geometry:
 *
 *   MeshIR -> toBufferGeometry() -> renderer
 *
 * This file is allowed to import 'three'. The authoring modules
 * (src/geometry/mesh.js, mesh-ops.js, mesh-codec.js, anchors.js) are not.
 * That is the entire law — there is deliberately NO repository-wide rule that
 * only src/render may import Three.js, because Character Forge, Motion Forge
 * and the game renderers legitimately do. See `Next step.md` Decision 6.
 *
 * This adapter is an engine-owned internal boundary. It is NOT part of the
 * public AI authoring surface: asset authors work in MeshIR and Previewable,
 * not in BufferGeometry. See Decision 10.
 */

import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';

/**
 * Converts a MeshIR into a Three.js BufferGeometry.
 *
 * Semantic ids are stored as Uint16 in the authoring representation, because
 * they are integer identities rather than measurements. They are widened to
 * Float32 vertex attributes here, matching the accepted legacy geometry so the
 * render path stays uniform.
 *
 * Each part becomes a geometry group, so a multi-material mesh maps part
 * identity directly onto material slots.
 *
 * @param {object} mesh - MeshIR.
 * @param {object} [options]
 * @param {Array<string>} [options.materialOrder] - Material ids defining group material indices.
 * @returns {BufferGeometry}
 */
export function toBufferGeometry(mesh, { materialOrder = null } = {}) {
  if (!mesh || !mesh.attributes?.position || !mesh.indices) {
    throw new TypeError('toBufferGeometry requires a MeshIR with position and indices');
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(mesh.attributes.position), 3));

  if (mesh.attributes.normal) {
    geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(mesh.attributes.normal), 3));
  }
  if (mesh.attributes.uv) {
    geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(mesh.attributes.uv), 2));
  }
  if (mesh.attributes.regionId) {
    geometry.setAttribute('regionId', new Float32BufferAttribute(Float32Array.from(mesh.attributes.regionId), 1));
  }
  if (mesh.attributes.surfaceId) {
    geometry.setAttribute('surfaceId', new Float32BufferAttribute(Float32Array.from(mesh.attributes.surfaceId), 1));
  }

  geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(mesh.indices), 1));

  if (!mesh.attributes.normal) {
    geometry.computeVertexNormals();
  }

  // One group per part: part identity maps onto material slots.
  const order = materialOrder ?? uniqueMaterialIds(mesh);
  for (const part of mesh.parts) {
    const materialIndex = part.materialId ? Math.max(0, order.indexOf(part.materialId)) : 0;
    geometry.addGroup(part.indexStart, part.indexCount, materialIndex);
  }

  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  geometry.userData = {
    meshId: mesh.id,
    meshVersion: mesh.version,
    units: mesh.units,
    upAxis: mesh.upAxis,
    forwardAxis: mesh.forwardAxis,
    materialOrder: order,
    parts: mesh.parts.map((p) => ({
      id: p.id,
      semanticName: p.semanticName,
      indexStart: p.indexStart,
      indexCount: p.indexCount,
      triangleCount: p.indexCount / 3,
      materialId: p.materialId
    })),
    anchors: mesh.anchors.map((a) => ({ ...a }))
  };

  return geometry;
}

/**
 * Collects the distinct material ids referenced by a MeshIR, in part order.
 *
 * @param {object} mesh
 * @returns {Array<string>}
 */
export function uniqueMaterialIds(mesh) {
  const seen = [];
  for (const part of mesh.parts) {
    if (part.materialId && !seen.includes(part.materialId)) {
      seen.push(part.materialId);
    }
  }
  return seen;
}
