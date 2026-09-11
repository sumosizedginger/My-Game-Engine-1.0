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
  return solveAllCanonicalViews(previewable.bounds, viewOptions);
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
 * Returns the manifest with volatile capture environment fields removed.
 *
 * Manifest determinism is asserted over the structural content. Environment
 * metadata (browser build, renderer backend) and image hashes are evidence
 * ABOUT a capture, not part of the asset's identity, and legitimately differ
 * between machines.
 *
 * @param {object} manifest
 * @returns {object}
 */
export function structuralManifest(manifest) {
  return {
    ...manifest,
    captures: manifest.captures.map(({ environment, imageHash, imagePath, ...rest }) => rest)
  };
}
