/**
 * My Game Engine 1.0 — Scene Canonical Codec
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Deterministic identity for a SceneDefinition.
 *
 *   same SceneDefinition -> same text -> same hash
 *
 * A scene is pure JSON-compatible data with no typed arrays, so the canonical
 * form is TEXT rather than the binary block layout MeshIR needs. The ordering
 * and number rules are the same ones `canonicalJsonString` already defines, so
 * there is one canonical-serialization discipline in the engine, not two.
 *
 * WHAT IS NEVER ENCODED: runtime entity handles, renderer objects, geometry,
 * derived world transforms. A scene encodes SOURCE. `EntityHandle` values are
 * runtime identity and CONSTITUTION.md §14 forbids serializing them.
 *
 * No float quantization is performed, matching the MeshIR codec: if
 * cross-runtime divergence is ever demonstrated, a quantization policy must be
 * explicit, versioned, tested and documented — never silent.
 *
 * This module must never import 'three'.
 */

import { canonicalJsonString, hashBytes } from '../geometry/mesh-codec.js';
import {
  SCENE_DEFINITION_VERSION,
  createSceneDefinition,
  createSceneNode
} from './definition.js';

/** Canonical scene encoding format version. Bump on any layout change. */
export const SCENE_CODEC_VERSION = 1;

/** Magic prefix identifying a canonical scene text stream. */
export const SCENE_CODEC_MAGIC = 'MGE1SCN';

/**
 * Reduces a scene definition to exactly the fields that constitute its source
 * identity, in a fixed field order.
 *
 * Keys are emitted explicitly rather than spread, so that adding a field to
 * SceneDefinition cannot silently change every existing scene's hash.
 *
 * @param {object} definition
 * @returns {object} Plain JSON-compatible body.
 */
export function sceneBody(definition) {
  return {
    magic: SCENE_CODEC_MAGIC,
    codec: SCENE_CODEC_VERSION,
    version: definition.version,
    id: definition.id,
    units: definition.units,
    upAxis: definition.upAxis,
    forwardAxis: definition.forwardAxis,
    nodes: definition.nodes.map((node) => ({
      pid: node.pid,
      name: node.name,
      parent: node.parent,
      asset: node.asset,
      tags: [...node.tags],
      transform: {
        translation: [...node.transform.translation],
        rotation: [...node.transform.rotation],
        scale: [...node.transform.scale]
      }
    }))
  };
}

/**
 * Encodes a scene definition to its canonical text form.
 *
 * @param {object} definition - SceneDefinition.
 * @returns {string} Canonical text.
 */
export function encodeScene(definition) {
  return canonicalJsonString(sceneBody(definition));
}

/**
 * Computes the canonical scene hash.
 *
 * @param {object} definition - SceneDefinition.
 * @returns {string} Hex fingerprint.
 */
export function sceneHash(definition) {
  return hashTextBytes(encodeScene(definition));
}

/**
 * Hashes UTF-8 text through the engine's existing byte hash, so scene identity
 * and mesh identity come from the same primitive.
 *
 * @param {string} text
 * @returns {string} Hex fingerprint.
 */
export function hashTextBytes(text) {
  return hashBytes(new TextEncoder().encode(text));
}

/**
 * Decodes canonical scene text back into a SceneDefinition.
 *
 * Decoding is strict: an unknown magic or codec version is refused rather than
 * best-effort parsed, because a silently misread scene is worse than a
 * rejected one.
 *
 * @param {string} text - Canonical scene text from `encodeScene`.
 * @returns {object} SceneDefinition.
 */
export function decodeScene(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('decodeScene requires canonical scene text');
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError(`decodeScene received text that is not valid JSON: ${error.message}`);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('decodeScene requires a scene object');
  }
  if (body.magic !== SCENE_CODEC_MAGIC) {
    throw new TypeError(
      `decodeScene magic mismatch: expected "${SCENE_CODEC_MAGIC}", received ${JSON.stringify(body.magic)}`
    );
  }
  if (body.codec !== SCENE_CODEC_VERSION) {
    throw new RangeError(
      `decodeScene codec version mismatch: expected ${SCENE_CODEC_VERSION}, received ${body.codec}`
    );
  }
  if (body.version !== SCENE_DEFINITION_VERSION) {
    throw new RangeError(
      `decodeScene scene version mismatch: expected ${SCENE_DEFINITION_VERSION}, received ${body.version}`
    );
  }
  if (!Array.isArray(body.nodes)) {
    throw new TypeError('decodeScene requires a nodes array');
  }

  return createSceneDefinition({
    id: body.id,
    units: body.units,
    upAxis: body.upAxis,
    forwardAxis: body.forwardAxis,
    nodes: body.nodes.map((node) => createSceneNode({
      pid: node.pid,
      name: node.name,
      parent: node.parent ?? null,
      asset: node.asset ?? null,
      tags: Array.isArray(node.tags) ? node.tags : [],
      transform: node.transform
    }))
  });
}
