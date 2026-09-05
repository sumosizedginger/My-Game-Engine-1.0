/**
 * My Game Engine 1.0 — Minimal Definition Compiler Seam
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Provides the minimal legitimate Definition -> Compile/Artifact -> Instantiate seam
 * without premature Kiln or Forge complexity.
 * Follows CONSTITUTION.md §3, ARCHITECTURE.md §5, and GAMEPLAY_FOUNDATION.md §8.
 */

/**
 * Generates a simple deterministic hash string from serializable object.
 *
 * @param {object} obj
 * @returns {string} Hex hash string.
 */
function computeDeterministicHash(obj) {
  const str = JSON.stringify(obj, Object.keys(obj || {}).sort());
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const val = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return val.toString(16).padStart(12, '0');
}

/**
 * Compiles a raw definition into an immutable artifact for runtime instantiation.
 *
 * @param {object} definition - Source definition object.
 * @param {string} definition.id - Unique definition identifier.
 * @param {string} definition.type - Artifact type classification.
 * @param {object} [definition.data={}] - Configuration parameters.
 * @returns {object} Immutable compiled artifact.
 */
export function compileDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('Invalid definition: definition must be an object');
  }
  if (!definition.id || typeof definition.id !== 'string') {
    throw new Error('Invalid definition: definition requires a string id');
  }
  if (!definition.type || typeof definition.type !== 'string') {
    throw new Error('Invalid definition: definition requires a string type');
  }

  const payload = definition.data ? { ...definition.data } : {};
  const hash = computeDeterministicHash({ id: definition.id, type: definition.type, data: payload });

  return Object.freeze({
    id: definition.id,
    type: definition.type,
    data: Object.freeze(payload),
    hash,
    compiledAt: Date.now()
  });
}
