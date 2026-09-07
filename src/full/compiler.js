/**
 * My Game Engine 1.0 — Minimal Definition Compiler Seam
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Provides the minimal legitimate Definition -> Compile/Artifact -> Instantiate seam
 * without premature Kiln or Forge complexity.
 * Follows CONSTITUTION.md §3, ARCHITECTURE.md §5, and GAMEPLAY_FOUNDATION.md §8.
 */

/**
 * Independent copy of JSON-compatible definition data.
 * Plain objects and arrays are rebuilt; primitives and null are returned as-is.
 * Array order is preserved. Object key order is preserved on the copy.
 *
 * @param {*} value
 * @returns {*}
 */
function cloneJsonValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    const copy = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      copy[i] = cloneJsonValue(value[i]);
    }
    return copy;
  }
  // Define own data properties, including JSON keys such as "__proto__".
  // Assignment to {} would invoke its inherited prototype setter instead.
  return Object.fromEntries(Object.keys(value).map(key => [key, cloneJsonValue(value[key])]));
}

/**
 * Recursively freeze a JSON-compatible object or array graph.
 *
 * @param {*} value
 * @returns {*}
 */
function freezeJsonValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      freezeJsonValue(value[i]);
    }
  } else {
    for (const key of Object.keys(value)) {
      freezeJsonValue(value[key]);
    }
  }
  return Object.freeze(value);
}

/**
 * Serialize JSON-compatible values with sorted object keys at every depth.
 * Emit keys directly so integer-like keys also follow the canonical sort.
 * Arrays keep their element order. Unsupported values have no contract here.
 *
 * @param {*} value
 * @returns {*}
 */
function serializeJsonValue(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeJsonValue).join(',')}]`;
  }
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${serializeJsonValue(value[key])}`).join(',')}}`;
}

/**
 * Generates a simple deterministic pure-JS content fingerprint from a serializable object.
 * Intentionally non-cryptographic and NOT SHA-256; provides synchronous deterministic
 * content identity within Proof A scope without async WebCrypto dependencies.
 *
 * @param {object} obj
 * @returns {string} Hex fingerprint string.
 */
function computeDeterministicHash(obj) {
  const str = serializeJsonValue(obj);
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

  const payload = freezeJsonValue(definition.data ? cloneJsonValue(definition.data) : {});
  const hash = computeDeterministicHash({ id: definition.id, type: definition.type, data: payload });

  return Object.freeze({
    id: definition.id,
    type: definition.type,
    data: payload,
    hash,
    compiledAt: Date.now()
  });
}
