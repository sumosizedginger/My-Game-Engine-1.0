/**
 * My Game Engine 1.0 — Browser Entry Point
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Supports:
 * 1. Proof A Pong Game (?game=pong)
 * 2. Phase 0 Minimal Boot Proof (default or ?proof=phase0)
 */

import {
  createRuntime,
  instantiate,
  ENGINE_NAME,
  ENGINE_VERSION,
  CANONICAL_REPOSITORY
} from '../runtime/index.js';

import { createEngineFull, ENTRY_POINT as FULL_ENTRY_POINT } from '../full/index.js';
import { createPongGame } from '../games/pong/index.js';

const params = new URLSearchParams(window.location.search);
const isPongMode = params.get('game') === 'pong';
const isControlled = params.has('controlled');

const app = document.getElementById('app');

if (isPongMode) {
  // ==========================================
  // PROOF A: PONG GAME
  // ==========================================
  if (app) {
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; max-width: 860px; width: 100%; margin: 24px auto; padding: 0 16px;">
        <!-- Top Navigation -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 16px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #38bdf8;">${ENGINE_NAME}</span>
            <span style="font-size: 13px; color: #94a3b8; margin-left: 8px;">Proof A — Tiny Complete Game</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/?game=pong" style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 6px; background: #0284c7; color: #ffffff; text-decoration: none;">Pong Court</a>
            <a href="/?proof=phase0" style="font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Phase 0 Boot Proof</a>
          </div>
        </div>

        <!-- DOM Score & Match Status HUD Container -->
        <div id="pong-hud-container" style="width: 100%;"></div>

        <!-- Pong Canvas -->
        <div style="position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); border: 2px solid #1e293b;">
          <canvas id="pong-canvas" width="800" height="500" style="display: block; background: #090d16;"></canvas>
        </div>

        <!-- Control Guide -->
        <div style="margin-top: 16px; padding: 12px 24px; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; font-size: 12px; color: #94a3b8; text-align: center; width: 100%; box-sizing: border-box;">
          <span style="color: #38bdf8; font-weight: 600;">Controls:</span>
          Keyboard: <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">W</kbd> / <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">S</kbd> or <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">↑</kbd> / <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">↓</kbd> to Move •
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">P</kbd> or <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">Space</kbd> to Pause •
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">R</kbd> to Reset •
          <span style="color: #a855f7; font-weight: 600; margin-left: 8px;">Gamepad:</span> Left Stick or D-Pad to Move, Start/A to Pause
        </div>

        <div id="proof-a-fixture-tag" style="margin-top: 8px; font-size: 11px; color: #475569;">
          ${isControlled ? 'PROOF_A_CONTROLLED_FIXTURE' : `Active Game Loop (${ENGINE_VERSION})`}
        </div>
      </div>
    `;

    const canvas = document.getElementById('pong-canvas');
    const hud = document.getElementById('pong-hud-container');

    const game = createPongGame({
      canvas,
      hudElement: hud
    });

    if (!isControlled) {
      game.start();
    } else {
      // In controlled mode, perform one initial step to render baseline court
      game.stepOnce(16.67);
    }

    // Attach to window for automated harness inspection
    window.__PROOF_A_PONG__ = game;
    console.log('[My Game Engine 1.0] Proof A Pong initialized:', game.getState());
  }
} else {
  // ==========================================
  // PHASE 0: BOOT PROOF
  // ==========================================
  const results = {
    engineName: ENGINE_NAME,
    version: ENGINE_VERSION,
    repository: CANONICAL_REPOSITORY,
    timestamp: new Date().toISOString(),
    canonicalToolchainTarget: {
      node: '24.20.0',
      npm: '11.19.1',
      vite: '8.2.2'
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
  if (app) {
    const isPass = results.status === 'PASS';
    app.innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 32px; background: #0f172a; color: #f8fafc; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); border: 1px solid #334155;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 16px;">
          <h1 id="engine-title" style="margin: 0; font-size: 24px; font-weight: 700; color: #38bdf8;">${results.engineName}</h1>
          <div style="display: flex; align-items: center; gap: 8px;">
            <a href="/?game=pong" style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 6px; background: #0284c7; color: #ffffff; text-decoration: none;">Launch Proof A (Pong)</a>
            <span id="boot-status" style="font-size: 14px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; background: ${isPass ? '#166534' : '#991b1b'}; color: ${isPass ? '#4ade80' : '#f87171'};">
              ${results.status}
            </span>
          </div>
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

        <div id="toolchain-target-card" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center;">
          <div id="boot-timestamp">Booted at: ${isControlled ? 'CONTROLLED_FIXTURE' : results.timestamp}</div>
          <div id="toolchain-label" style="margin-top: 4px; color: #94a3b8; font-weight: 500;">
            Canonical Toolchain Target: Node ${results.canonicalToolchainTarget.node} | npm ${results.canonicalToolchainTarget.npm} | Vite ${results.canonicalToolchainTarget.vite}
          </div>
        </div>
      </div>
    `;
  }

  console.log('[My Game Engine 1.0] Browser boot proof executed:', results);
}
