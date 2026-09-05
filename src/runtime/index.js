/**
 * My Game Engine 1.0 — Runtime Entry Point
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * This module is the baseline runtime for ordinary exported games.
 * It intentionally contains no compiler, authoring, or Forge dependencies.
 */

export const ENGINE_NAME = 'My Game Engine 1.0';
export const ENGINE_VERSION = '0.1.0';
export const CANONICAL_REPOSITORY = 'sumosizedginger/My-Game-Engine-1.0';
export const ENTRY_POINT = 'engine/runtime';

/**
 * Creates a structured diagnostic record adhering to CONSTITUTION.md & ARCHITECTURE.md.
 * Shape: { severity, code, step, subsystem, message, data }
 */
export function createDiagnostic({
  severity = 'INFO',
  code = 'OK',
  step = 'runtime',
  subsystem = 'core',
  message = '',
  data = null
} = {}) {
  return {
    severity,
    code,
    step,
    subsystem,
    message,
    data,
    timestamp: Date.now()
  };
}

/**
 * Creates a minimal diagnostic reporter.
 */
export function createDiagnosticReporter() {
  const diagnostics = [];

  return {
    report(diagnostic) {
      const record = createDiagnostic(diagnostic);
      diagnostics.push(record);
      return record;
    },
    getDiagnostics() {
      return [...diagnostics];
    },
    hasErrors() {
      return diagnostics.some((d) => d.severity === 'FATAL' || d.severity === 'ERROR');
    },
    clear() {
      diagnostics.length = 0;
    }
  };
}

/**
 * Instantiates a pre-compiled artifact into a transient runtime object.
 * Follows Definition / Artifact / Runtime separation.
 *
 * @param {object} artifact - The compiled artifact to instantiate.
 * @param {object} [context={}] - Runtime context.
 * @returns {object} Runtime instance.
 */
export function instantiate(artifact, context = {}) {
  if (!artifact || typeof artifact !== 'object') {
    throw new TypeError('Invalid artifact: artifact must be an object');
  }
  if (!artifact.id) {
    throw new Error('Invalid artifact: artifact must have an id');
  }

  return {
    instanceId: `${artifact.id}_inst_${Date.now()}`,
    artifactId: artifact.id,
    type: artifact.type || 'generic',
    data: artifact.data || null,
    instantiatedAt: Date.now(),
    context
  };
}

/**
 * Initializes the minimal engine runtime.
 *
 * @param {object} [options={}] - Runtime configuration options.
 * @returns {object} The booted runtime instance.
 */
export function createRuntime(options = {}) {
  const reporter = createDiagnosticReporter();

  reporter.report({
    severity: 'INFO',
    code: 'BOOT_INIT',
    step: 'bootstrap',
    subsystem: 'runtime',
    message: `${ENGINE_NAME} runtime initializing`,
    data: { options }
  });

  let running = true;

  const runtime = {
    name: ENGINE_NAME,
    version: ENGINE_VERSION,
    repository: CANONICAL_REPOSITORY,
    entryPoint: ENTRY_POINT,
    options,
    diagnostics: reporter,
    isRunning() {
      return running;
    },
    stop() {
      running = false;
      reporter.report({
        severity: 'INFO',
        code: 'RUNTIME_STOP',
        step: 'teardown',
        subsystem: 'runtime',
        message: 'Runtime stopped'
      });
    },
    instantiate(artifact, context) {
      return instantiate(artifact, context);
    }
  };

  reporter.report({
    severity: 'INFO',
    code: 'BOOT_COMPLETE',
    step: 'bootstrap',
    subsystem: 'runtime',
    message: `${ENGINE_NAME} runtime boot complete`
  });

  return runtime;
}
