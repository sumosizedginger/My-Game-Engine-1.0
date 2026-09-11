/**
 * My Game Engine 1.0 — AssetPreviewManifest v1
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * A capture is not a PNG. A capture is pixels PLUS camera pose, bounds, units,
 * orientation and per-part measurement. Measured evidence (3DHarnessBench,
 * September 2026) found explicit bounding boxes and dimensions consistently
 * improve agent reconstruction, with PART-LEVEL measurements producing the best
 * topology results. The manifest is that evidence in machine-readable form.
 *
 * Determinism, per `Next step.md` Decision 2:
 *   - manifest canonical encoding: STRICT byte identity;
 *   - rendered images: tolerance-based comparison, never portable byte identity.
 *
 * Telemetry that was not measured is omitted, never fabricated.
 */

import { canonicalJsonString, hashBytes } from '../geometry/mesh-codec.js';
import { solveAllCanonicalViews } from './views.js';

/** Manifest schema version. */
export const MANIFEST_VERSION = 1;

/**
 * Converts a bounds record into manifest form.
 *
 * @param {object} bounds
 * @returns {object}
 */
function boundsToManifest(bounds) {
  return {
    min: [...bounds.min],
    max: [...bounds.max],
    center: [...bounds.center],
    dimensions: [...bounds.dimensions]
  };
}

/**
 * Builds an AssetPreviewManifest from a Previewable.
 *
 * @param {object} previewable
 * @param {object} [options]
 * @param {Array<object>} [options.captures=[]] - Capture records with camera and environment metadata.
 * @param {object|null} [options.performance=null] - Measured values only.
 * @returns {object} Manifest.
 */
export function createAssetPreviewManifest(previewable, { captures = [], performance = null } = {}) {
  const mesh = previewable.mesh;

  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    source: {
      definitionId: previewable.source.definitionId,
      sourceHash: previewable.source.sourceHash,
      meshHash: previewable.source.meshHash,
      seed: previewable.source.seed
    },
    scene: {
      units: mesh.units,
      upAxis: mesh.upAxis,
      forwardAxis: mesh.forwardAxis
    },
    bounds: boundsToManifest(mesh.bounds),
    geometry: {
      triangles: previewable.stats.triangles,
      vertices: previewable.stats.vertices,
      partCount: previewable.stats.parts,
      groupCount: previewable.stats.groups
    },
    parts: mesh.parts.map((part) => ({
      id: part.id,
      semanticName: part.semanticName,
      bounds: boundsToManifest(part.bounds),
      triangleCount: part.indexCount / 3,
      materialId: part.materialId,
      regionId: part.regionId,
      surfaceId: part.surfaceId
    })),
    anchors: mesh.anchors.map((anchor) => ({
      name: anchor.name,
      partId: anchor.partId,
      position: [...anchor.position],
      orientation: anchor.orientation === null ? null : [...anchor.orientation]
    })),
    materials: previewable.materials.map((definition) => ({
      id: definition.id,
      type: definition.type,
      parameters: definition.data?.parameters ?? null
    })),
    captures: captures.map((capture) => ({
      name: capture.name,
      cameraPosition: [...capture.cameraPosition],
      cameraTarget: [...capture.cameraTarget],
      up: [...capture.up],
      fovDeg: capture.fovDeg,
      aspect: capture.aspect ?? null,
      viewport: { width: capture.viewport.width, height: capture.viewport.height },
      // Fraction of the frame spanned by the asset's projected axis-aligned
      // bounds. A FRAMING measurement, not rendered-pixel coverage: it tells a
      // reviewer whether the view is sized usefully, not how much of the image
      // the geometry actually painted.
      projectedBoundsOccupancy: capture.projectedBoundsOccupancy ? { width: capture.projectedBoundsOccupancy.width, height: capture.projectedBoundsOccupancy.height } : null,
      environment: capture.environment ? { ...capture.environment } : null,
      imagePath: capture.imagePath ?? null,
      imageHash: capture.imageHash ?? null
    })),
    diagnostics: previewable.diagnostics.map((d) => ({
      severity: d.severity,
      code: d.code,
      step: d.step,
      subsystem: d.subsystem,
      message: d.message
    }))
  };

  if (performance && Object.keys(performance).length > 0) {
    manifest.performance = { ...performance };
  }

  return manifest;
}

/**
 * Plans the canonical captures for a Previewable without rendering anything.
 *
 * Returns the camera records the browser preview and the evaluation capture
 * path will both use, so framing is decided once.
 *
 * @param {object} previewable
 * @param {object} [viewOptions]
 * @returns {Array<object>} Camera records.
 */
export function planCanonicalCaptures(previewable, viewOptions = {}) {
  // Views are resolved against the ASSET'S declared axes, not against world
  // constants, so `front` observes the face the asset says it faces.
  return solveAllCanonicalViews(previewable.bounds, {
    upAxis: previewable.mesh.upAxis,
    forwardAxis: previewable.mesh.forwardAxis,
    ...viewOptions
  });
}

/**
 * Canonically encodes a manifest.
 *
 * Object keys are sorted at every depth and negative zero is normalized, so the
 * same manifest always produces the same bytes.
 *
 * @param {object} manifest
 * @returns {string}
 */
export function encodeManifest(manifest) {
  return canonicalJsonString(manifest);
}

/**
 * Hashes the canonical manifest encoding.
 *
 * @param {object} manifest
 * @returns {string} Hex fingerprint.
 */
export function manifestHash(manifest) {
  return hashBytes(new TextEncoder().encode(encodeManifest(manifest)));
}

/**
 * Reduces a manifest to PORTABLE ASSET IDENTITY.
 *
 * ---------------------------------------------------------------------------
 * The contract this repairs
 * ---------------------------------------------------------------------------
 * This function previously stripped only `environment`, `imageHash` and
 * `imagePath` from each capture, and kept the camera pose, aspect, viewport and
 * projectedBoundsOccupancy. Every one of those is a function of the LIVE
 * PREVIEW SURFACE: the solver fits the camera to the viewport aspect, so
 * resizing a browser window moves the camera, which changed the "structural"
 * bytes and hash.
 *
 * The observed consequence, from this branch's own evidence: identical MeshIR
 * `1f3c73aa330cbe18` produced manifest hash `4aad7de3ff23fee9` at a 960x640
 * viewport and `2913d0deddc1406e` at 1680x1180. Same asset, same source, same
 * bytes of geometry — different "identity".
 *
 * A UI viewport is not asset identity. Captures are an OBSERVATION OF an asset
 * and are removed here in full, along with measured `performance`, which is
 * machine speed rather than asset content.
 *
 * What remains is portable: source identity, scene units and axes, bounds,
 * geometry statistics, semantic parts, anchors, materials and structural
 * diagnostics. Those are identical for the same asset on any machine at any
 * window size.
 *
 * The single AssetPreviewManifest type is kept — the repository architecture
 * favours it — so this is the explicit exclusion the contract requires rather
 * than a second manifest type. `manifestHash` is NOT redefined: it still hashes
 * whatever manifest it is given. Portable identity is `structuralManifestHash`.
 *
 * @param {object} manifest
 * @returns {object} Manifest without capture-dependent fields.
 */
export function structuralManifest(manifest) {
  const { captures, performance, ...structural } = manifest;
  return structural;
}

/**
 * Hashes the PORTABLE structural identity of an asset.
 *
 * This is the hash that must be equal for the same asset across machines,
 * browsers, window sizes and aspect ratios. Compare assets with this; compare
 * observations with `manifestHash`.
 *
 * @param {object} manifest
 * @returns {string} Hex fingerprint.
 */
export function structuralManifestHash(manifest) {
  return manifestHash(structuralManifest(manifest));
}
