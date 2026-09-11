/**
 * My Game Engine 1.0 — Full Engine Entry Point
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * This module is the entry point for authoring, Studio integration, and
 * games requiring runtime generation tooling.
 *
 * Conceptually: engine/full = engine/runtime + earned authoring systems.
 * Systems are integrated here only as real consumers earn them; no premature
 * placeholder stubs are fabricated.
 *
 * AI-ASSET-FOUNDATION-001 earned the authoring surface in ./authoring.js:
 * MeshIR, its canonical codec, the initial modeling verbs, generic semantic
 * anchors, Material Forge definitions, the Previewable contract, Preview Lab,
 * the canonical view solver and AssetPreviewManifest.
 *
 * Deliberately still absent: Kiln, Geometry Forge room generation, Character
 * Forge, Motion Forge and World Forge. They exist in the repository but no
 * public consumer has earned them.
 *
 * Node-only evaluation machinery must never be re-exported from here.
 */

import { createRuntime } from '../runtime/index.js';
import { compileDefinition } from './compiler.js';

export * from '../runtime/index.js';
export * from './authoring.js';
export { compileDefinition };

export const ENTRY_POINT = 'engine/full';

/**
 * Creates an engine instance in "full" mode.
 *
 * @param {object} [options={}] - Options.
 * @returns {object} The booted full engine runtime instance.
 */
export function createEngineFull(options = {}) {
  const runtime = createRuntime(options);

  return {
    ...runtime,
    entryPoint: ENTRY_POINT
  };
}
