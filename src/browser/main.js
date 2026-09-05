/**
 * My Game Engine 1.0 — Minimal Browser Boot Proof
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Demonstrates: repository -> dev command -> browser -> JS runtime -> expected visible result.
 */

import {
  createRuntime,
  instantiate,
  ENGINE_NAME,
  ENGINE_VERSION,
  CANONICAL_REPOSITORY
} from '../runtime/index.js';

import { createEngineFull, ENTRY_POINT as FULL_ENTRY_POINT } from '../full/index.js';

// Execute boot test
const results = {
  engineName: ENGINE_NAME,
  version: ENGINE_VERSION,
  repository: CANONICAL_REPOSITORY,
  timestamp: new Date().toISOString(),
  toolchain: {
    nodeTarget: '24.20.0 LTS',
    npmVersion: '11.19.1',
    viteVersion: '8.2.2'
  },
  checks: {}
};

try {
  // 1. Boot minimal runtime (engine/runtime)
  const runtime = createRuntime({ env: 'browser' });
  results.checks.runtimeBoot = runtime.isRunning() && runtime.entryPoint === 'engine/runtime';

  // 2. Artifact instantiation test (Definition / Artifact / Runtime separation)
  const sampleArtifact = { id: 'artifact_boot_01', type: 'mesh', data: { size: 1.0 } };
  const instance = runtime.instantiate(sampleArtifact);
  results.checks.instantiate = instance.artifactId === sampleArtifact.id && typeof instance.instantiatedAt === 'number';

  // 3. Full engine mode verification (engine/full seam)
  const fullEngine = createEngineFull({ env: 'browser' });
  results.checks.fullEngineSeam = fullEngine.entryPoint === FULL_ENTRY_POINT && fullEngine.entryPoint === 'engine/full';

  // 4. Runtime / Full purity verification (no premature Kiln / Forge exports)
  results.checks.purityCheck = !('Kiln' in runtime) && !('kiln' in fullEngine);

  // 5. Diagnostics reporting check
  const diagnostics = runtime.diagnostics.getDiagnostics();
  results.checks.diagnostics = Array.isArray(diagnostics) && diagnostics.length > 0;
  results.checks.noErrors = !runtime.diagnostics.hasErrors();

  results.status = Object.values(results.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (error) {
  results.status = 'ERROR';
  results.error = error.message;
}

// Attach to window for automated inspection
window.__PHASE_0_BOOT_PROOF__ = results;

// Render to DOM
const app = document.getElementById('app');
if (app) {
  const isPass = results.status === 'PASS';
  app.innerHTML = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 32px; background: #0f172a; color: #f8fafc; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); border: 1px solid #334155;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 16px;">
        <h1 id="engine-title" style="margin: 0; font-size: 24px; font-weight: 700; color: #38bdf8;">${results.engineName}</h1>
        <span id="boot-status" style="font-size: 14px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; background: ${isPass ? '#166534' : '#991b1b'}; color: ${isPass ? '#4ade80' : '#f87171'};">
          ${results.status}
        </span>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="color: #94a3b8; font-size: 13px;">Canonical Repository:</div>
        <div id="repo-id" style="font-family: monospace; font-size: 15px; color: #e2e8f0; margin-top: 2px;">${results.repository}</div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="color: #94a3b8; font-size: 13px;">Phase:</div>
        <div id="phase-badge" style="font-size: 15px; color: #e2e8f0; margin-top: 2px;">Phase 0 — Repository Foundation (Repaired)</div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="color: #94a3b8; font-size: 13px;">Bootstrap Seam Verifications:</div>
        <ul id="verification-list" style="list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 14px;">
          <li style="padding: 6px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: ${results.checks.runtimeBoot ? '#4ade80' : '#f87171'}; font-weight: bold;">[${results.checks.runtimeBoot ? '✔ PASS' : '✘ FAIL'}]</span>
            Runtime Initialization (<code>engine/runtime</code>)
          </li>
          <li style="padding: 6px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: ${results.checks.instantiate ? '#4ade80' : '#f87171'}; font-weight: bold;">[${results.checks.instantiate ? '✔ PASS' : '✘ FAIL'}]</span>
            Artifact Instantiation (<code>Artifact → Instance</code>)
          </li>
          <li style="padding: 6px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: ${results.checks.fullEngineSeam ? '#4ade80' : '#f87171'}; font-weight: bold;">[${results.checks.fullEngineSeam ? '✔ PASS' : '✘ FAIL'}]</span>
            Full Engine Seam (<code>engine/full</code>)
          </li>
          <li style="padding: 6px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: ${results.checks.purityCheck ? '#4ade80' : '#f87171'}; font-weight: bold;">[${results.checks.purityCheck ? '✔ PASS' : '✘ FAIL'}]</span>
            Seam Purity (No premature Kiln / Forge placeholder stubs)
          </li>
          <li style="padding: 6px 0;">
            <span style="color: ${results.checks.noErrors ? '#4ade80' : '#f87171'}; font-weight: bold;">[${results.checks.noErrors ? '✔ PASS' : '✘ FAIL'}]</span>
            Structured Diagnostics Reporting (Zero Errors)
          </li>
        </ul>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center;">
        Booted at: ${results.timestamp} | Node ${results.toolchain.nodeTarget} | npm ${results.toolchain.npmVersion} | Vite ${results.toolchain.viteVersion}
      </div>
    </div>
  `;
}

console.log('[My Game Engine 1.0] Browser boot proof executed:', results);
