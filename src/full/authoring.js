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

import { MESH_OP_DESCRIPTORS } from '../geometry/mesh-ops.js';
import { MESH_IR_VERSION as IR_VERSION, ATTRIBUTE_ITEM_SIZE } from '../geometry/mesh.js';
import { MESH_CODEC_VERSION as CODEC_VERSION } from '../geometry/mesh-codec.js';
import { CANONICAL_VIEWS as VIEWS } from '../preview/views.js';
import { PREVIEW_BUDGET_DEFAULTS as BUDGET } from '../preview/budget.js';
import { MANIFEST_VERSION as MANIFEST_V } from '../preview/manifest.js';

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
    manifest: MANIFEST_V
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
  laws: Object.freeze([
    'Every asset part requires a semanticName. Anonymous parts are refused.',
    'Operations are pure: inputs are never mutated.',
    'Merge never silently drops an input.',
    'The preview budget fails closed.',
    'Topology-aware operations (bevel, boolean, subdivision, remesh) are not available in this tranche.'
  ])
});
