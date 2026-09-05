/**
 * My Game Engine 1.0 — Full Engine Entry Point
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * This module is for authoring, Studio integration, and games that perform
 * runtime generation requiring compiler / Kiln tooling.
 *
 * Conceptually: engine/full = engine/runtime + Kiln + approved compilers.
 * Future Forges (Geometry, Character, Motion, Material, World) will be exposed here
 * as proofs earn them.
 */

import {
  createRuntime,
  instantiate,
  createDiagnostic,
  createDiagnosticReporter,
  ENGINE_NAME,
  ENGINE_VERSION,
  CANONICAL_REPOSITORY
} from '../runtime/index.js';

export * from '../runtime/index.js';

export const ENTRY_POINT = 'engine/full';

/**
 * Minimal Kiln compilation seam.
 * Compiles a declarative definition into a runtime artifact.
 */
export const Kiln = {
  compile(definition, options = {}) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('Invalid definition: definition must be an object');
    }
    if (!definition.id) {
      throw new Error('Invalid definition: definition must have an id');
    }

    return {
      id: definition.id,
      type: definition.type || 'generic',
      data: definition.data || null,
      compiledAt: Date.now(),
      options
    };
  }
};

/**
 * Creates an engine instance in "full" mode with Kiln available.
 *
 * @param {object} [options={}] - Options.
 * @returns {object} The booted full engine runtime instance.
 */
export function createEngineFull(options = {}) {
  const runtime = createRuntime(options);

  return {
    ...runtime,
    entryPoint: ENTRY_POINT,
    kiln: Kiln
  };
}
