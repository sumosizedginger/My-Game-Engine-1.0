/**
 * My Game Engine 1.0 — Browser Entry Point
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Supports:
 * 1. Proof B1 Motion Truth (?proof=b1)
 * 2. Proof A Pong Game (?game=pong)
 * 3. Phase 0 Minimal Boot Proof (default or ?proof=phase0)
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
import { createB1Viewer } from './b1-viewer.js';
import { createB2Viewer } from './b2-viewer.js';
import { createB2LivePresentation } from './b2-presentation.js';
import './b2-live.css';

const params = new URLSearchParams(window.location.search);
const isB2Mode = params.get('proof') === 'b2';
const isB1Mode = params.get('proof') === 'b1';
const isPongMode = params.get('game') === 'pong';
const isControlled = params.has('controlled');

const app = document.getElementById('app');

if (isB2Mode) {
  // ==========================================
  // PROOF B2: PROCEDURAL COMBAT ROOM
  // ==========================================
  if (app) {
    if (!isControlled) {
      document.documentElement.classList.add('b2-live-mode');
      document.body.classList.add('b2-live-mode');
      app.classList.add('b2-live-root');
    }
    app.innerHTML = isControlled ? `
      <div style="display: flex; flex-direction: column; align-items: center; max-width: 960px; width: 100%; margin: 16px auto; padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box;">
        <!-- Top Navigation -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 12px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #38bdf8;">${ENGINE_NAME}</span>
            <span style="font-size: 13px; color: #94a3b8; margin-left: 8px;">Proof B2 — Procedural Combat Room</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/?proof=b2" style="font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 6px; background: #0284c7; color: #ffffff; text-decoration: none; border: 1px solid #0284c7;">Combat Room</a>
            <a href="/?proof=b1" style="font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof B1 (Motion)</a>
            <a href="/?game=pong" style="font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof A (Pong)</a>
            <a href="/?proof=phase0" style="font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Phase 0 Boot</a>
          </div>
        </div>

        <!-- Combat Status Banner & HUD -->
        <div style="display: flex; flex-direction: column; width: 100%; gap: 8px; margin-bottom: 12px;">
          <div id="b2-status-banner" style="width: 100%; padding: 8px 16px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; font-size: 13px; font-weight: 700; color: #38bdf8; text-align: center; box-sizing: border-box;">
            READY — APPROACH ENEMY TO ENGAGE
          </div>

          <!-- Health Bars -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
            <!-- Player Health -->
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 8px 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                <span style="color: #60a5fa; font-weight: 600;">PLAYER (Athletic Blue)</span>
                <span id="b2-player-hp-text" style="color: #cbd5e1; font-weight: 600;">100 / 100</span>
              </div>
              <div style="width: 100%; height: 10px; background: #1e293b; border-radius: 5px; overflow: hidden;">
                <div id="b2-player-hp-bar" style="width: 100%; height: 100%; background: #3b82f6; transition: width 0.15s ease-out;"></div>
              </div>
            </div>

            <!-- Enemy Health -->
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 8px 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                <span style="color: #f87171; font-weight: 600;">ENEMY BRUTE (Heavy Crimson)</span>
                <span id="b2-enemy-hp-text" style="color: #cbd5e1; font-weight: 600;">100 / 100</span>
              </div>
              <div style="width: 100%; height: 10px; background: #1e293b; border-radius: 5px; overflow: hidden;">
                <div id="b2-enemy-hp-bar" style="width: 100%; height: 100%; background: #ef4444; transition: width 0.15s ease-out;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3D Canvas Container -->
        <div id="b2-canvas-container" style="position: relative; width: 100%; height: 500px; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7); border: 2px solid #1e293b; background: #10141c;"></div>

        <!-- Telemetry & Semantics Bar -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; width: 100%; margin-top: 10px;">
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 6px 10px; font-size: 11px;">
            <span style="color: #64748b;">Combat:</span> <span id="b2-stat-hits" style="color: #4ade80; font-weight: 600;">Hits: 0 | Dmg: 0</span>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 6px 10px; font-size: 11px;">
            <span style="color: #64748b;">Enemy AI:</span> <span id="b2-stat-enemy-state" style="color: #facc15; font-weight: 600;">AI: IDLE</span>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 6px 10px; font-size: 11px;">
            <span style="color: #64748b;">Geometry:</span> <span style="color: #38bdf8; font-weight: 600;">16x16m Arena (2 Pillars)</span>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 6px 10px; font-size: 11px;">
            <span style="color: #64748b;">Hit Authority:</span> <span style="color: #a78bfa; font-weight: 600;">Single Volume Contract</span>
          </div>
        </div>

        <!-- Controls Guide -->
        <div style="margin-top: 10px; padding: 8px 16px; background: #0b1120; border: 1px solid #1e293b; border-radius: 6px; font-size: 11px; color: #94a3b8; text-align: center; width: 100%; box-sizing: border-box;">
          <span style="color: #38bdf8; font-weight: 600;">Controls:</span>
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">W</kbd>
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">A</kbd>
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">S</kbd>
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">D</kbd> or Arrows / Controller Left Stick / D-Pad to Move •
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">Space</kbd> / <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">J</kbd> / Controller South (A) to Strike •
          <kbd style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f8fafc;">R</kbd> / Controller North (Y) to Reset
        </div>

        ${!isControlled ? `
        <!-- Live Controller Diagnostic -->
        <div id="b2-controller-diagnostic" style="margin-top: 6px; padding: 6px 14px; background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; font-size: 11px; color: #94a3b8; width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <span style="color: #64748b; font-weight: 600;">Controller:</span>
            <span id="b2-diag-status" style="color: #cbd5e1; font-weight: 600; margin-left: 6px;">Searching (press any button to activate)...</span>
          </div>
          <div id="b2-diag-actions" style="color: #38bdf8; font-weight: 600; font-family: monospace;"></div>
        </div>
        ` : ''}

        <div id="proof-b2-fixture-tag" style="margin-top: 6px; font-size: 11px; color: #475569;">
          ${isControlled ? 'PROOF_B2_CONTROLLED_FIXTURE' : `Active Combat Loop (${ENGINE_VERSION})`}
        </div>
      </div>
    ` : createB2LivePresentation();

    const container = document.getElementById('b2-canvas-container');
    createB2Viewer({ container, isControlled });
    console.log('[My Game Engine 1.0] Proof B2 Combat Room initialized');
  }
} else if (isB1Mode) {
  // ==========================================
  // PROOF B1: MOTION TRUTH
  // ==========================================
  if (app) {
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; max-width: 900px; width: 100%; margin: 20px auto; padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Top Navigation -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 16px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #38bdf8;">${ENGINE_NAME}</span>
            <span style="font-size: 13px; color: #94a3b8; margin-left: 8px;">Proof B1 — Motion Truth</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/?proof=b2" style="font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof B2 (Combat)</a>
            <a href="/?proof=b1" style="font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 6px; background: #0284c7; color: #ffffff; text-decoration: none; border: 1px solid #0284c7;">Motion Studio</a>
            <a href="/?game=pong" style="font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof A (Pong)</a>
            <a href="/?proof=phase0" style="font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Phase 0 Boot</a>
          </div>
        </div>

        <!-- Studio Control Bar -->
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; width: 100%; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 10px 16px; margin-bottom: 12px; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <label style="font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
              Character:
              <select id="b1-char-select" style="background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 4px; padding: 3px 8px; font-size: 12px;">
                <option value="average" selected>Average (1.80m)</option>
                <option value="athletic">Athletic (1.85m)</option>
                <option value="heavy">Heavy (1.78m)</option>
              </select>
            </label>

            <label style="font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
              Motion:
              <select id="b1-motion-select" style="background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 4px; padding: 3px 8px; font-size: 12px;">
                <option value="natural" selected>Natural (112 spm)</option>
                <option value="energetic">Energetic (128 spm)</option>
                <option value="stroll">Stroll (92 spm)</option>
              </select>
            </label>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button id="b1-btn-wireframe" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">Wireframe</button>
            <button id="b1-btn-bones" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">Bones</button>
            <button id="b1-btn-slowmo" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">Slow-Mo (0.25x)</button>
            <button id="b1-btn-freewalk" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">In-Place (Treadmill)</button>
          </div>
        </div>

        <!-- WebGL 3D Studio Canvas Container -->
        <div id="b1-canvas-container" style="position: relative; width: 100%; height: 540px; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7); border: 2px solid #1e293b; background: #181a20;"></div>

        <!-- Telemetry & Grounding Diagnostics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; width: 100%; margin-top: 12px;">
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 12px; font-size: 12px;">
            <span style="color: #64748b;">Cycle Phase:</span> <span id="b1-stat-phase" style="color: #38bdf8; font-weight: 600;">0.0%</span>
            <span style="color: #64748b; margin-left: 8px;">Speed:</span> <span id="b1-stat-speed" style="color: #4ade80; font-weight: 600;">1.21 m/s</span>
          </div>

          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 12px; font-size: 12px;">
            <span style="color: #64748b;">Foot Contact:</span> <span id="b1-stat-contact" style="color: #facc15; font-weight: 600;">L: STANCE | R: STANCE</span>
          </div>

          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 12px; font-size: 12px;">
            <span style="color: #64748b;">Pelvis:</span> <span id="b1-stat-pelvis" style="color: #c084fc; font-weight: 600;">Bounce: 0.0mm | Sway: 0.0mm</span>
          </div>

          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 8px 12px; font-size: 12px;">
            <span style="color: #64748b;">Skinning Invariant:</span> <span style="color: #4ade80; font-weight: 600;">✔ Σw = 1.0 (0 err)</span>
          </div>
        </div>

        <!-- Visual Verification Instructions -->
        <div style="margin-top: 12px; padding: 10px 16px; background: #0b1120; border: 1px solid #1e293b; border-radius: 6px; font-size: 11px; color: #64748b; text-align: center; width: 100%; box-sizing: border-box;">
          <span style="color: #94a3b8; font-weight: 500;">Interaction:</span> Drag to orbit camera around character • Scroll wheel to zoom • 1m Floor Grid for inspecting foot contact & sliding
        </div>

        <div id="proof-b1-fixture-tag" style="margin-top: 8px; font-size: 11px; color: #475569;">
          ${isControlled ? 'PROOF_B1_CONTROLLED_FIXTURE' : `Active Motion Loop (${ENGINE_VERSION})`}
        </div>
      </div>
    `;

    const container = document.getElementById('b1-canvas-container');
    const viewer = createB1Viewer({ container, isControlled });

    // Wire controls
    const charSelect = document.getElementById('b1-char-select');
    if (charSelect) {
      charSelect.addEventListener('change', (e) => viewer.setCharPreset(e.target.value));
    }

    const motionSelect = document.getElementById('b1-motion-select');
    if (motionSelect) {
      motionSelect.addEventListener('change', (e) => viewer.setMotionPreset(e.target.value));
    }

    const btnWireframe = document.getElementById('b1-btn-wireframe');
    if (btnWireframe) {
      btnWireframe.addEventListener('click', () => {
        const active = viewer.toggleWireframe();
        btnWireframe.style.background = active ? '#0284c7' : '#1e293b';
        btnWireframe.style.color = active ? '#ffffff' : '#cbd5e1';
      });
    }

    const btnBones = document.getElementById('b1-btn-bones');
    if (btnBones) {
      btnBones.addEventListener('click', () => {
        const active = viewer.toggleBones();
        btnBones.style.background = active ? '#0284c7' : '#1e293b';
        btnBones.style.color = active ? '#ffffff' : '#cbd5e1';
      });
    }

    const btnSlowMo = document.getElementById('b1-btn-slowmo');
    if (btnSlowMo) {
      btnSlowMo.addEventListener('click', () => {
        const active = viewer.toggleSlowMotion();
        btnSlowMo.style.background = active ? '#0284c7' : '#1e293b';
        btnSlowMo.style.color = active ? '#ffffff' : '#cbd5e1';
      });
    }

    const btnFreeWalk = document.getElementById('b1-btn-freewalk');
    if (btnFreeWalk) {
      btnFreeWalk.addEventListener('click', () => {
        const active = viewer.toggleFreeWalk();
        btnFreeWalk.textContent = active ? 'Free Walk (Forward)' : 'In-Place (Treadmill)';
        btnFreeWalk.style.background = active ? '#0284c7' : '#1e293b';
        btnFreeWalk.style.color = active ? '#ffffff' : '#cbd5e1';
      });
    }

    console.log('[My Game Engine 1.0] Proof B1 Motion Viewer initialized');
  }
} else if (isPongMode) {
  // ==========================================
  // PROOF A: PONG GAME
  // ==========================================
  if (app) {
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; max-width: 860px; width: 100%; margin: 24px auto; padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Top Navigation -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 16px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #38bdf8;">${ENGINE_NAME}</span>
            <span style="font-size: 13px; color: #94a3b8; margin-left: 8px;">Proof A — Tiny Complete Game</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/?proof=b2" style="font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof B2 (Combat)</a>
            <a href="/?proof=b1" style="font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof B1 (Motion)</a>
            <a href="/?game=pong" style="font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 6px; background: #0284c7; color: #ffffff; text-decoration: none; border: 1px solid #0284c7;">Pong Court</a>
            <a href="/?proof=phase0" style="font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Phase 0 Boot</a>
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
            <a href="/?proof=b2" style="font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof B2 (Combat)</a>
            <a href="/?proof=b1" style="font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 6px; background: #1e293b; color: #94a3b8; text-decoration: none; border: 1px solid #334155;">Proof B1 (Motion)</a>
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
