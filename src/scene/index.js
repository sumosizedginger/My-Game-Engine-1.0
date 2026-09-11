/**
 * My Game Engine 1.0 — Scene Composition
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Engine-owned scene composition: what a space contains, how its parts relate,
 * where they sit, and how that survives being unloaded and rebuilt.
 *
 *   SceneDefinition -> compileScene -> SceneArtifact -> instantiateScene
 *        source            compile        artifact         runtime
 *
 * A scene is engine DATA. It is not a renderer scene graph, it holds no
 * geometry, and it never stores runtime entity handles. Rendering consumes a
 * scene; it does not own one. See ARCHITECTURE.md §43 and docs/spec/scene.md.
 *
 * This module must never import 'three'.
 */

export {
  SCENE_DEFINITION_VERSION,
  SCENE_UNITS,
  SCENE_UP_AXIS,
  SCENE_FORWARD_AXIS,
  SCENE_MAX_NODES,
  IDENTITY_TRANSFORM,
  createLocalTransform,
  createSceneNode,
  createSceneDefinition
} from './definition.js';

export {
  validateSceneDefinition,
  enforceValidSceneDefinition
} from './validation.js';

export {
  SCENE_CODEC_VERSION,
  SCENE_CODEC_MAGIC,
  sceneBody,
  encodeScene,
  decodeScene,
  sceneHash,
  hashTextBytes
} from './codec.js';

export {
  SCENE_ARTIFACT_VERSION,
  compileScene
} from './compiler.js';

// Affine primitives. A compiled world placement is a matrix, so a consumer
// needs these to do anything with it beyond reading its translation.
export {
  identityMatrix,
  matrixFromTRS,
  multiplyMatrices,
  transformPoint,
  translationOf,
  hasShear
} from './affine.js';

export {
  instantiateScene,
  liveSceneInstanceCount
} from './instance.js';
