import test from 'node:test';
import assert from 'node:assert/strict';

import * as runtimeModule from '../src/runtime/index.js';
import {
  createRuntime,
  instantiate,
  createDiagnostic,
  createDiagnosticReporter,
  ENGINE_NAME,
  ENGINE_VERSION,
  CANONICAL_REPOSITORY,
  ENTRY_POINT
} from '../src/runtime/index.js';

test('runtime module exports canonical identity constants', () => {
  assert.equal(ENGINE_NAME, 'My Game Engine 1.0');
  assert.equal(ENGINE_VERSION, '0.1.0');
  assert.equal(CANONICAL_REPOSITORY, 'sumosizedginger/My-Game-Engine-1.0');
  assert.equal(ENTRY_POINT, 'engine/runtime');
});

test('runtime module does not export Kiln or compiler tooling', () => {
  assert.equal('Kiln' in runtimeModule, false, 'Runtime must not export Kiln');
  assert.equal('createEngineFull' in runtimeModule, false, 'Runtime must not export createEngineFull');
});

test('createRuntime initializes running instance and reports diagnostics', () => {
  const runtime = createRuntime({ env: 'test' });

  assert.equal(runtime.name, ENGINE_NAME);
  assert.equal(runtime.version, ENGINE_VERSION);
  assert.equal(runtime.repository, CANONICAL_REPOSITORY);
  assert.equal(runtime.entryPoint, 'engine/runtime');
  assert.equal(runtime.isRunning(), true);

  const diagnostics = runtime.diagnostics.getDiagnostics();
  assert.ok(Array.isArray(diagnostics));
  assert.ok(diagnostics.length >= 2, 'Should record init and complete diagnostics');
  assert.equal(runtime.diagnostics.hasErrors(), false);

  runtime.stop();
  assert.equal(runtime.isRunning(), false);
});

test('instantiate converts compiled artifact into runtime instance', () => {
  const artifact = {
    id: 'artifact_001',
    type: 'mesh',
    data: { vertices: [0, 0, 0] }
  };

  const instance = instantiate(artifact, { sceneId: 'main' });

  assert.ok(instance.instanceId.startsWith('artifact_001_inst_'));
  assert.equal(instance.artifactId, 'artifact_001');
  assert.equal(instance.type, 'mesh');
  assert.deepEqual(instance.data, { vertices: [0, 0, 0] });
  assert.equal(instance.context.sceneId, 'main');
  assert.equal(typeof instance.instantiatedAt, 'number');
});

test('instantiate validates input arguments', () => {
  assert.throws(() => instantiate(null), /Invalid artifact/);
  assert.throws(() => instantiate({}), /Invalid artifact: artifact must have an id/);
});

test('createDiagnostic produces structured diagnostic record', () => {
  const diag = createDiagnostic({
    severity: 'WARN',
    code: 'TEST_WARN',
    subsystem: 'test',
    message: 'test warning',
    data: { detail: 123 }
  });

  assert.equal(diag.severity, 'WARN');
  assert.equal(diag.code, 'TEST_WARN');
  assert.equal(diag.subsystem, 'test');
  assert.equal(diag.message, 'test warning');
  assert.deepEqual(diag.data, { detail: 123 });
  assert.equal(typeof diag.timestamp, 'number');
});
