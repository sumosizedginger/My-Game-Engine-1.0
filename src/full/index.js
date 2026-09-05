/**
 * My Game Engine 1.0 — Full Engine Entry Point
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * This module is the entry point for authoring, Studio integration, and
 * games requiring runtime generation tooling.
 *
 * Conceptually: engine/full = engine/runtime + future compiler/Forge systems.
 * Approved future systems (Kiln, Geometry Forge, Character Forge, Motion Forge,
 * Material Forge, World Forge) will be integrated here as proofs earn them.
 * No premature placeholder stubs are fabricated in Phase 0.
 */

import { createRuntime } from '../runtime/index.js';
import { compileDefinition } from './compiler.js';

export * from '../runtime/index.js';
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
