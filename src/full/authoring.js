/**
 * My Game Engine 1.0 — Public Authoring Surface
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The intentional public authoring API earned by AI-ASSET-FOUNDATION-001.
 *
 * Two exclusions are deliberate and binding:
 *
 *   1. Node-only evaluation machinery is NOT exported. `renderCanonicalViews`
 *      lives in src/eval/ and depends on puppeteer-core, node:fs and a local
 *      browser binary. Importing engine/full must never drag headless-browser
 *      machinery into a browser authoring bundle. The shared contract is the
 *      canonical VIEW SOLVER, not the capture driver. (Decision 9)
 *
 *   2. `toBufferGeometry` is NOT exported. The adapter is an engine-owned
 *      internal boundary. The intended authoring workflow is
 *      definitions -> MeshIR -> Previewable -> preview, not
 *      MeshIR -> BufferGeometry -> Mesh. Teaching asset authors to manipulate
 *      renderer representation is precisely what this architecture exists to
 *      escape. (Decision 10)
 *
 * The surface is earned by what CINDER MK-I actually required. Do not widen it
 * because a Forge happens to exist.
 */

// MeshIR: engine-owned authoring geometry.
export {
  MESH_IR_VERSION,
  MESH_UNITS,
  MESH_UP_AXIS,
  MESH_FORWARD_AXIS,
  createMesh,
  createPart,
  validateMesh,
  enforceValidMesh,
  meshBounds,
  triangleCount,
  vertexCount
} from '../geometry/mesh.js';

// Canonical artifact identity.
export {
  MESH_CODEC_VERSION,
  encodeMesh,
  meshHash
} from '../geometry/mesh-codec.js';

// Modeling verbs.
export {
  createBoxMesh,
  createCylinderMesh,
  extrudeProfile,
  transformMesh,
  mergeMeshIR
} from '../geometry/mesh-ops.js';

// Generic semantics.
export {
  createAnchor,
  identityTransform
} from '../geometry/anchors.js';

// Material definitions. CINDER must author surface appearance through Material
// Forge rather than inventing a private material pathway.
export {
  createMaterialDefinition,
  MATERIAL_PRESETS
} from '../material/index.js';

// Preview.
export {
  createPreviewable
} from '../preview/previewable.js';

export {
  previewArtifact,
  createPreviewLab
} from '../preview/lab.js';

export {
  PREVIEW_BUDGET_DEFAULTS,
  evaluatePreviewBudget,
  enforcePreviewBudget
} from '../preview/budget.js';

// Canonical views: the solver only. The capture driver stays in evaluation.
export {
  CANONICAL_VIEWS,
  CANONICAL_VIEW_DIRECTIONS,
  CANONICAL_VIEW_UP,
  AXIS_VECTORS,
  semanticFrame,
  resolveCanonicalViewDirections,
  resolveCanonicalViewUps,
  solveCanonicalView,
  solveAllCanonicalViews,
  INSPECTION_RIG,
  inspectionLightFrame
} from '../preview/views.js';

// Manifest.
export {
  MANIFEST_VERSION,
  createAssetPreviewManifest,
  planCanonicalCaptures,
  encodeManifest,
  manifestHash,
  structuralManifest,
  structuralManifestHash
} from '../preview/manifest.js';

// Scene composition (SCENE-COMPOSITION-001): authoring, validation,
// serialization and compilation. The RUNTIME half - instantiateScene - is
// exported from engine/runtime, so an exported game carries the instantiator
// without the compiler. See CONSTITUTION.md §5 and docs/spec/scene.md.
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
} from '../scene/definition.js';

export {
  validateSceneDefinition,
  enforceValidSceneDefinition
} from '../scene/validation.js';

export {
  SCENE_CODEC_VERSION,
  SCENE_CODEC_MAGIC,
  encodeScene,
  decodeScene,
  sceneHash
} from '../scene/codec.js';

export {
  SCENE_ARTIFACT_VERSION,
  compileScene
} from '../scene/compiler.js';

// Affine primitives: a compiled world placement is a matrix, so an authoring
// consumer needs these to reason about one.
export {
  identityMatrix,
  matrixFromTRS,
  multiplyMatrices,
  transformPoint,
  translationOf,
  hasShear
} from '../scene/affine.js';

// ---------------------------------------------------------------------------
// ACCEPTED FORGE CAPABILITY — PUBLIC-SURFACE-001
//
// Character, Motion, World and Geometry room generation were implemented and
// accepted, but an external author could only reach them by deep-importing
// repository paths. PRD.md §39 makes that a defect: implemented + accepted +
// intended for external authoring MUST have a supported public route.
//
// This is a ROUTING reconciliation, not new capability. No subsystem algorithm
// changed. Every name below is a deliberate decision, allowlisted in
// tests/purity.test.js and described in AUTHORING_SURFACE.
//
// FLAT NAMED EXPORTS, not namespace objects. That matches the existing surface,
// stays tree-shakeable, and keeps `CharacterForge`-style names free — which
// tests/purity.test.js still forbids, because two ways to reach one capability
// is two contracts.
//
// The exclusions are as deliberate as the inclusions. Renderer primitives
// (buildBoxGeometry, compileMaterial, toBufferGeometry) stay internal so the
// presentation layer remains replaceable; a Forge that returns renderer output
// as part of its accepted result is a different thing from handing authors the
// builders.
// ---------------------------------------------------------------------------

// Geometry Forge: room generation and the semantic vocabulary that makes its
// output machine-readable.
export {
  SURFACE_TYPES,
  SURFACE_NAMES,
  CONSTRAINT_FLAGS,
  GEOMETRY_REGIONS,
  ROOM_PARAMETER_BOUNDS,
  PILLAR_PARAMETER_BOUNDS,
  ROOM_PRESETS,
  resolveRoomParameters,
  createRoomDefinition,
  generateProceduralRoom
} from '../geometry/index.js';

// Character Forge. `REGIONS` is re-exported as CHARACTER_REGIONS: the internal
// name is far too generic for a shared package namespace.
export {
  HUMANOID_PARAMETER_BOUNDS,
  HUMANOID_PRESETS,
  resolveHumanoidParameters,
  createCharacterDefinition,
  computeSemanticLandmarks,
  buildHumanoidCharacter,
  REGIONS as CHARACTER_REGIONS
} from '../character/index.js';

// Motion Forge.
export {
  MOTION_PARAMETER_BOUNDS,
  MOTION_PRESETS,
  resolveMotionParameters,
  createMotionDefinition,
  createLocomotionEvaluator,
  solveTwoBoneIK,
  computeGaitFootPlacement,
  commitRootMotionIntent
} from '../motion/index.js';

// World Forge. The two query constructors are exported because CONSTITUTION.md
// §19 makes WorldFieldQuery and WorldVolumeQuery first-class architecture, and
// createWorldFieldCache comes with them because the query cannot be built
// without it.
export {
  WORLD_PARAMETER_BOUNDS,
  createWorldRecipe,
  worldDataHash,
  createWorldFieldCache,
  createWorldFieldQuery,
  createWorldVolumeQuery,
  generateWorld
} from '../world/index.js';

// Material Forge gains only its parameter bounds here; createMaterialDefinition
// and MATERIAL_PRESETS were already public.
export {
  MATERIAL_PARAMETER_BOUNDS
} from '../material/index.js';

import { MESH_OP_DESCRIPTORS } from '../geometry/mesh-ops.js';
import { MESH_IR_VERSION as IR_VERSION, ATTRIBUTE_ITEM_SIZE } from '../geometry/mesh.js';
import { MESH_CODEC_VERSION as CODEC_VERSION } from '../geometry/mesh-codec.js';
import { CANONICAL_VIEWS as VIEWS } from '../preview/views.js';
import { PREVIEW_BUDGET_DEFAULTS as BUDGET } from '../preview/budget.js';
import { MANIFEST_VERSION as MANIFEST_V } from '../preview/manifest.js';
import { SCENE_DEFINITION_VERSION as SCENE_V } from '../scene/definition.js';
import { SCENE_CODEC_VERSION as SCENE_CODEC_V } from '../scene/codec.js';
import { SCENE_ARTIFACT_VERSION as SCENE_ARTIFACT_V } from '../scene/compiler.js';
import { QUATERNION_UNIT_TOLERANCE as QUAT_TOL } from '../geometry/mesh.js';
// Live values for the Forge descriptors below. Preset and bound NAMES are read
// from the real objects so the descriptor cannot drift from the code.
import {
  ROOM_PRESETS as ROOMS, ROOM_PARAMETER_BOUNDS as ROOM_BOUNDS,
  SURFACE_TYPES as SURFACES, GEOMETRY_REGIONS as GEO_REGIONS
} from '../geometry/index.js';
import {
  HUMANOID_PRESETS as HUMANOIDS, HUMANOID_PARAMETER_BOUNDS as HUMANOID_BOUNDS,
  REGIONS as CHAR_REGIONS
} from '../character/index.js';
import {
  MOTION_PRESETS as MOTIONS, MOTION_PARAMETER_BOUNDS as MOTION_BOUNDS
} from '../motion/index.js';
import { WORLD_PARAMETER_BOUNDS as WORLD_BOUNDS } from '../world/index.js';
import {
  MATERIAL_PRESETS as MATERIALS, MATERIAL_PARAMETER_BOUNDS as MATERIAL_BOUNDS
} from '../material/index.js';

/**
 * Machine-readable description of the public authoring capabilities.
 *
 * API mismatch is the measured primary failure mode for agents writing 3D code
 * (3DCodeBench: failures "mostly arise from API mismatches"). This descriptor
 * exists so an authoring agent can discover the surface rather than guess it.
 *
 * It is ASSEMBLED from live values and colocated operation descriptors — never
 * a hand-maintained duplicate registry, which would drift. See Decision 5.
 * `tests/authoring-surface.test.js` asserts it stays in step with the actual
 * exports.
 */
export const AUTHORING_SURFACE = Object.freeze({
  engine: 'My Game Engine 1.0',
  surface: 'engine/full authoring',
  tranche: 'AI-ASSET-FOUNDATION-001',
  conventions: Object.freeze({
    units: 'm',
    upAxis: '+Y',
    forwardAxis: '-Z',
    handedness: 'right',
    attributeItemSizes: ATTRIBUTE_ITEM_SIZE
  }),
  versions: Object.freeze({
    meshIr: IR_VERSION,
    meshCodec: CODEC_VERSION,
    manifest: MANIFEST_V,
    sceneDefinition: SCENE_V,
    sceneCodec: SCENE_CODEC_V,
    sceneArtifact: SCENE_ARTIFACT_V
  }),
  operations: MESH_OP_DESCRIPTORS,
  preview: Object.freeze({
    canonicalViews: VIEWS,
    budgetDimensions: Object.freeze(Object.keys(BUDGET)),
    budgetDefaults: BUDGET,
    failsClosed: true
  }),
  notExported: Object.freeze([
    Object.freeze({
      name: 'toBufferGeometry',
      reason: 'Renderer adapter is an engine-owned internal boundary; author in MeshIR and Previewable.'
    }),
    Object.freeze({
      name: 'renderCanonicalViews',
      reason: 'Node-only evaluation tooling; depends on puppeteer-core and node:fs. The shared contract is solveCanonicalView.'
    })
  ]),
  /**
   * Accepted Forge subsystems reachable through engine/full.
   *
   * Preset and bound NAMES are read from the live objects, so a preset added
   * to a Forge appears here without anyone remembering to update a list.
   * `capabilities` is the one hand-written part, and tests/public-surface.test.js
   * asserts it BOTH ways: every name listed is exported, and every newly public
   * Forge export is listed. A descriptor an agent cannot trust is worse than
   * none.
   */
  forges: Object.freeze({
    geometry: Object.freeze({
      subsystem: 'Geometry Forge',
      specification: 'GEOMETRY_FORGE.md',
      accepted: 'Proof B2',
      publicSince: 'PUBLIC-SURFACE-001',
      capabilities: Object.freeze([
        'SURFACE_TYPES', 'SURFACE_NAMES', 'CONSTRAINT_FLAGS', 'GEOMETRY_REGIONS',
        'ROOM_PARAMETER_BOUNDS', 'PILLAR_PARAMETER_BOUNDS', 'ROOM_PRESETS',
        'resolveRoomParameters', 'createRoomDefinition', 'generateProceduralRoom'
      ]),
      presets: Object.freeze(Object.keys(ROOMS)),
      parameters: Object.freeze(Object.keys(ROOM_BOUNDS)),
      surfaceTypes: Object.freeze(Object.keys(SURFACES)),
      regions: Object.freeze(Object.keys(GEO_REGIONS)),
      conventions: 'A generated room returns { definition, visual, collision, semantics, stats }. Floor top sits at y = 0.',
      notExported: Object.freeze([
        Object.freeze({
          name: 'buildBoxGeometry, buildCylinderGeometry, mergeSemanticGeometries',
          reason: 'Renderer primitives. A Forge may return renderer output as part of an accepted result; handing authors the builders would freeze the presentation layer into the public contract.'
        })
      ])
    }),

    character: Object.freeze({
      subsystem: 'Character Forge',
      specification: 'CHARACTER_FORGE.md',
      accepted: 'Proof B1',
      publicSince: 'PUBLIC-SURFACE-001',
      capabilities: Object.freeze([
        'HUMANOID_PARAMETER_BOUNDS', 'HUMANOID_PRESETS', 'resolveHumanoidParameters',
        'createCharacterDefinition', 'computeSemanticLandmarks', 'buildHumanoidCharacter',
        'CHARACTER_REGIONS'
      ]),
      presets: Object.freeze(Object.keys(HUMANOIDS)),
      parameters: Object.freeze(Object.keys(HUMANOID_BOUNDS)),
      regions: Object.freeze(Object.keys(CHAR_REGIONS)),
      conventions: 'buildHumanoidCharacter returns { definition, parameters, landmarks, geometry, skeleton, bonesByName, mesh, material, diagnostics }. It owns Three.js resources: dispose geometry and material when finished.',
      ownsRendererResources: true,
      notExported: Object.freeze([
        Object.freeze({
          name: 'createHumanoidGeometry, createHumanoidSkeleton, applyHumanoidSkinning',
          reason: 'The steps buildHumanoidCharacter composes. Exposing them would freeze the assembly order into the public contract for no demonstrated external need.'
        }),
        Object.freeze({
          name: 'BONE_DEFINITIONS, BONE_NAME_TO_INDEX',
          reason: 'Deferred, not rejected. A built character already exposes bonesByName, which is what attachment needs today. A real attachment API can earn these later.'
        })
      ])
    }),

    motion: Object.freeze({
      subsystem: 'Motion Forge',
      specification: 'MOTION_FORGE.md',
      accepted: 'Proof B1',
      publicSince: 'PUBLIC-SURFACE-001',
      capabilities: Object.freeze([
        'MOTION_PARAMETER_BOUNDS', 'MOTION_PRESETS', 'resolveMotionParameters',
        'createMotionDefinition', 'createLocomotionEvaluator', 'solveTwoBoneIK',
        'computeGaitFootPlacement', 'commitRootMotionIntent'
      ]),
      presets: Object.freeze(Object.keys(MOTIONS)),
      parameters: Object.freeze(Object.keys(MOTION_BOUNDS)),
      conventions: 'createLocomotionEvaluator(character, motionPreset) is stateful and advanced by update(). commitRootMotionIntent writes through the transform owner; motion never mutates a world transform directly (CONSTITUTION.md §13).',
      notExported: Object.freeze([])
    }),

    world: Object.freeze({
      subsystem: 'World Forge',
      specification: 'WORLD_FORGE.md',
      accepted: 'Proof C',
      publicSince: 'PUBLIC-SURFACE-001',
      capabilities: Object.freeze([
        'WORLD_PARAMETER_BOUNDS', 'createWorldRecipe', 'worldDataHash',
        'createWorldFieldCache', 'createWorldFieldQuery', 'createWorldVolumeQuery',
        'generateWorld'
      ]),
      parameters: Object.freeze(Object.keys(WORLD_BOUNDS)),
      conventions: 'generateWorld returns a bounded world with recipe, fields, volumes, trees, cover, terrain, hashes and dispose(). It owns a Three.js terrain geometry: call dispose(). WorldFieldQuery is cheap 2.5D; WorldVolumeQuery is authoritative 3D (CONSTITUTION.md §19).',
      ownsRendererResources: true,
      deterministic: 'Same recipe produces the same world. worldDataHash gives comparable identity.',
      notExported: Object.freeze([
        Object.freeze({
          name: 'createTerrainGeometry',
          reason: 'Builds a Three.js BufferGeometry directly. generateWorld already returns the terrain it produces; exposing the builder would make renderer representation part of the contract.'
        }),
        Object.freeze({
          name: 'streaming, chunking, residency',
          reason: 'Not implemented. World generation is bounded. See ARCHITECTURE.md §46.'
        })
      ])
    }),

    material: Object.freeze({
      subsystem: 'Material Forge',
      specification: 'MATERIAL_FORGE.md',
      accepted: 'Proof B2',
      publicSince: 'AI-ASSET-FOUNDATION-001; parameter bounds added by PUBLIC-SURFACE-001',
      capabilities: Object.freeze([
        'MATERIAL_PARAMETER_BOUNDS', 'MATERIAL_PRESETS', 'createMaterialDefinition'
      ]),
      presets: Object.freeze(Object.keys(MATERIALS)),
      parameters: Object.freeze(Object.keys(MATERIAL_BOUNDS)),
      conventions: 'A MaterialDefinition is serializable source. Compilation to a renderer material is an engine-owned boundary.',
      notExported: Object.freeze([
        Object.freeze({
          name: 'compileMaterial',
          reason: 'Returns a Three.js MeshStandardMaterial. Same exclusion class as toBufferGeometry: authors describe materials, the engine decides how they are realized.'
        }),
        Object.freeze({
          name: 'normalizeColor, resolveMaterialParameters',
          reason: 'Internal normalization that createMaterialDefinition already performs and reports through diagnostics.'
        })
      ])
    })
  }),

  scene: Object.freeze({
    tranche: 'SCENE-COMPOSITION-001',
    pipeline: 'SceneDefinition -> compileScene -> SceneArtifact -> instantiateScene',
    // A scene holds no geometry. Nodes carry an opaque `asset` key that a
    // presentation layer resolves, which is what keeps the definition
    // renderer-independent and serializable.
    holdsGeometry: false,
    serializesRuntimeHandles: false,
    runtimeEntryPoint: 'engine/runtime: instantiateScene',
    transformOwnership: Object.freeze({ root: 'STATIC', child: 'ATTACHED' }),
    // Local authoring is TRS; compiled world placement is an affine matrix,
    // because a composed hierarchy is not always TRS-representable.
    localTransform: 'TRS: translation, rotation UNIT quaternion XYZW, scale',
    worldTransform: 'affine 4x4, column-major, column vectors',
    worldComposition: 'worldMatrix = parentWorldMatrix * localMatrix; localMatrix = T * R * S',
    // Shared with the geometry TRS contract. A non-unit quaternion scales as a
    // side effect of rotating, and is refused rather than normalized.
    quaternionUnitTolerance: QUAT_TOL
  }),
  laws: Object.freeze([
    'Every asset part requires a semanticName. Anonymous parts are refused.',
    'Operations are pure: inputs are never mutated.',
    'Merge never silently drops an input.',
    'The preview budget fails closed.',
    'Topology-aware operations (bevel, boolean, subdivision, remesh) are not available in this tranche.',
    'A scene is engine data, never a renderer scene graph. It holds no geometry.',
    'Compiled world placement is an affine matrix. It is not decomposed into rotation and scale, because a sheared hierarchy has no such decomposition.',
    'A compiled artifact owns and deep-freezes its data; mutating the source definition afterwards cannot change it.',
    'Scene persistent ids belong to the source. Runtime entity handles are never serialized.',
    'Scene hierarchy is a forest: duplicate ids, missing parents, self-parents and cycles are refused.',
    'A rotation must be a unit quaternion. Non-unit quaternions are refused, never normalized, because they apply an implicit scale and normalizing would rewrite authored source.',
    'Accepted capability intended for external authoring is reachable through engine/full. A deep import into src/ is not a supported route.',
    'Renderer primitives stay internal. A Forge result may carry renderer output; the builders that produced it are not part of the contract.',
    'A Forge result that owns Three.js resources must be disposed by its consumer.'
  ])
});
