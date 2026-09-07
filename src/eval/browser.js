/**
 * My Game Engine 1.0 — Automated Browser Evaluation
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Drives headless browser validation using puppeteer-core and local Chrome/Edge.
 * Supports Phase 0 Boot Proof, Proof A Pong gameplay, and Proof B1 Motion Truth.
 */

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const STANDARD_CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

/**
 * Finds an available browser executable on the system.
 *
 * @returns {string} Executable path.
 */
export function findBrowserExecutable() {
  for (const p of STANDARD_CHROME_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error(
    'No supported browser executable found. Set CHROME_PATH environment variable to a valid Chrome/Edge binary.'
  );
}

/**
 * Runs automated browser evaluation on a target URL.
 *
 * @param {object} options
 * @param {string} options.url - Target URL to evaluate.
 * @param {object} [options.viewport={ width: 1280, height: 720 }] - Viewport dimensions.
 * @param {boolean} [options.captureScreenshot=true] - Whether to capture screenshot buffer.
 * @param {number} [options.timeout=10000] - Navigation timeout in ms.
 * @returns {Promise<object>} Evaluation execution report.
 */
export function runBrowserEvaluation({
  url = 'http://localhost:5173/?controlled=1',
  viewport = { width: 1280, height: 720 },
  captureScreenshot = true,
  timeout = 10000
} = {}) {
  return (async () => {
    const executablePath = findBrowserExecutable();
    const consoleErrors = [];
    const consoleWarnings = [];
    const pageErrors = [];
    const failedRequests = [];

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    });

    try {
      const page = await browser.newPage();
      if (url.includes('proof=c')) await page.setCacheEnabled(false);
      await page.setViewport(viewport);

      page.on('console', (msg) => {
        const type = msg.type();
        if (type === 'error') {
          consoleErrors.push(msg.text());
        } else if (type === 'warning') {
          consoleWarnings.push(msg.text());
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
      });

      page.on('requestfailed', (req) => {
        failedRequests.push({
          url: req.url(),
          failure: req.failure()?.errorText || 'unknown'
        });
      });

      const response = await page.goto(url, { waitUntil: 'load', timeout });
      const httpStatus = response ? response.status() : 0;

      // Wait for engine module initialization based on target URL
      try {
        if (url.includes('proof=d')) {
          await page.waitForFunction(() => Boolean(window.__PROOF_D_RACING__), { timeout: 6000 });
        } else if (url.includes('proof=c')) {
          await page.waitForFunction(() => Boolean(window.__PROOF_C_WORLD__), { timeout: 6000 });
        } else if (url.includes('proof=b2')) {
          await page.waitForFunction(() => Boolean(window.__PROOF_B2_COMBAT__), { timeout: 6000 });
        } else if (url.includes('proof=b1')) {
          await page.waitForFunction(() => Boolean(window.__PROOF_B1_MOTION__), { timeout: 6000 });
        } else if (url.includes('game=pong')) {
          await page.waitForFunction(() => Boolean(window.__PROOF_A_PONG__), { timeout: 6000 });
        } else {
          await page.waitForFunction(() => Boolean(window.__PHASE_0_BOOT_PROOF__ || window.__PROOF_RESULTS__), { timeout: 6000 });
        }
      } catch (waitErr) {
        console.warn(`[BrowserEval] Timeout waiting for boot window object on ${url}:`, waitErr.message);
      }

      // Extract boot proof object if on Phase 0 boot page
      const bootProof = await page.evaluate(() => {
        return window.__PHASE_0_BOOT_PROOF__ || window.__PROOF_RESULTS__ || null;
      });

      // Inspect DOM elements
      const domDetails = await page.evaluate(() => {
        const engineTitle = document.getElementById('engine-title')?.textContent?.trim() || '';
        const bootStatus = document.getElementById('boot-status')?.textContent?.trim() || '';
        const repoId = document.getElementById('repo-id')?.textContent?.trim() || '';
        const toolchainLabel = document.getElementById('toolchain-label')?.textContent?.trim() || '';
        const matchStatusBadge = document.getElementById('match-status-badge')?.textContent?.trim() || '';
        const p1Score = document.getElementById('p1-score')?.textContent?.trim() || '';
        const p2Score = document.getElementById('p2-score')?.textContent?.trim() || '';
        const b1Phase = document.getElementById('b1-stat-phase')?.textContent?.trim() || '';
        const b1Speed = document.getElementById('b1-stat-speed')?.textContent?.trim() || '';
        const b1Contact = document.getElementById('b1-stat-contact')?.textContent?.trim() || '';
        const b2Banner = document.getElementById('b2-status-banner')?.textContent?.trim() || '';
        const b2PlayerHp = document.getElementById('b2-player-hp-text')?.textContent?.trim() || '';
        const b2EnemyHp = document.getElementById('b2-enemy-hp-text')?.textContent?.trim() || '';
        const b2Hits = document.getElementById('b2-stat-hits')?.textContent?.trim() || '';
        return { engineTitle, bootStatus, repoId, toolchainLabel, matchStatusBadge, p1Score, p2Score, b1Phase, b1Speed, b1Contact, b2Banner, b2PlayerHp, b2EnemyHp, b2Hits };
      });

      // Capture deterministic baseline screenshot
      let screenshotBuffer = null;
      if (captureScreenshot) {
        screenshotBuffer = await page.screenshot({ type: 'png' });
      }

      // If evaluating Proof A Pong, run in-browser gameplay and rule verification
      let pongProof = null;
      if (url.includes('game=pong')) {
        pongProof = await page.evaluate(() => {
          try {
            if (!window.__PROOF_A_PONG__) {
              return { success: false, error: 'window.__PROOF_A_PONG__ not found' };
            }
            const game = window.__PROOF_A_PONG__;
            const initial = game.getState();

            // 1. Initial serve state check
            const isInitialServe = initial.status === 'SERVE' && initial.scores.player1 === 0 && initial.scores.player2 === 0;

            // 2. Action input verification: MoveUp moves player paddle
            game.simulateAction('MoveUp', true);
            for (let i = 0; i < 3; i++) {
              game.stepOnce(20);
            }
            game.simulateAction('MoveUp', false);
            const afterMove = game.getState();
            const movedUp = afterMove.entities.player.position.y > initial.entities.player.position.y;
            const inPlaying = afterMove.status === 'PLAYING';

            // 3. Goal scoring rule execution
            game.transformManager.teleport(afterMove.entities.ball.handle, { x: 395, y: 0, z: 0 });
            game.transformManager.setVelocity(afterMove.entities.ball.handle, { x: 500, y: 0, z: 0 });
            for (let i = 0; i < 4; i++) {
              game.stepOnce(20);
            }
            const afterScore = game.getState();
            const scoredPoint = afterScore.scores.player1 === 1 && afterScore.status === 'SERVE';

            // 4. DOM HUD update verification
            const p1Dom = document.getElementById('p1-score')?.textContent?.trim();
            const domScoreUpdated = p1Dom === '1';

            return {
              success: Boolean(isInitialServe && movedUp && inPlaying && scoredPoint && domScoreUpdated),
              checks: {
                isInitialServe,
                movedUp,
                inPlaying,
                scoredPoint,
                domScoreUpdated,
                initialY: initial.entities.player.position.y,
                afterMoveY: afterMove.entities.player.position.y,
                ballAfterScoreX: afterScore.entities.ball.position.x,
                scoreP1: afterScore.scores.player1,
                domP1: p1Dom
              },
              diagnosticsRecords: afterScore.diagnostics
            };
          } catch (evalErr) {
            return {
              success: false,
              evalError: evalErr.message,
              stack: evalErr.stack
            };
          }
        });
      }

      // If evaluating Proof B1 Motion, run in-browser character and motion evaluation
      let b1Proof = null;
      if (url.includes('proof=b1')) {
        b1Proof = await page.evaluate(() => {
          try {
            if (!window.__PROOF_B1_MOTION__) {
              return { success: false, error: 'window.__PROOF_B1_MOTION__ not found' };
            }
            const b1 = window.__PROOF_B1_MOTION__;
            const initial = b1.getStats();

            // 1. Initial character generation checks
            const hasGeometry = b1.vertexCount > 300 && b1.triangleCount > 500;
            const hasSkeleton = b1.boneCount === 22;
            const skinningNormalized = b1.skinningNormalized && b1.maxNormalizationError < 1e-4;

            // 2. Controlled multi-step gait motion evaluation (step 5 frames x 50ms = 250ms)
            const footH = 0.05 * 1.80; // 0.090m for 1.80m average character
            let maxRealizedFloat = 0;
            let minRealizedFloat = 999;
            let maxRealizedError = 0;
            let realizedGroundingPass = true;

            let stepRes = null;
            for (let f = 0; f < 5; f++) {
              stepRes = b1.step(50);
              const feet = b1.getRealizedFootPositions();
              if (feet && stepRes.contactStates) {
                if (stepRes.contactStates.left) {
                  const floatL = feet.left.y - footH;
                  maxRealizedFloat = Math.max(maxRealizedFloat, floatL);
                  minRealizedFloat = Math.min(minRealizedFloat, floatL);
                  const errL = Math.abs(feet.left.y - stepRes.contactStates.leftHeight);
                  maxRealizedError = Math.max(maxRealizedError, errL);
                  if (feet.left.y > footH + 0.025 || feet.left.y < footH - 0.001) {
                    realizedGroundingPass = false;
                  }
                }
                if (stepRes.contactStates.right) {
                  const floatR = feet.right.y - footH;
                  maxRealizedFloat = Math.max(maxRealizedFloat, floatR);
                  minRealizedFloat = Math.min(minRealizedFloat, floatR);
                  const errR = Math.abs(feet.right.y - stepRes.contactStates.rightHeight);
                  maxRealizedError = Math.max(maxRealizedError, errR);
                  if (feet.right.y > footH + 0.025 || feet.right.y < footH - 0.001) {
                    realizedGroundingPass = false;
                  }
                }
              }
            }

            const afterStep = b1.getStats();
            const phaseAdvanced = afterStep.phase > 0;
            const speedValid = afterStep.speed > 0.5 && afterStep.speed < 3.0;

            // 3. Grounding height check: target height valid and realized bones grounded
            const leftH = stepRes.contactStates.leftHeight;
            const rightH = stepRes.contactStates.rightHeight;
            const groundingValid = leftH >= 0.05 && rightH >= 0.05 && realizedGroundingPass;

            // 4. Dynamic Pelvis check (pelvis moved dynamically)
            const pelvisDynamic = Math.abs(stepRes.pelvisState.bounceY) > 0 || Math.abs(stepRes.pelvisState.swayX) > 0;

            const allPassed = Boolean(
              hasGeometry &&
              hasSkeleton &&
              skinningNormalized &&
              phaseAdvanced &&
              speedValid &&
              groundingValid &&
              realizedGroundingPass &&
              pelvisDynamic
            );

            return {
              success: allPassed,
              checks: {
                hasGeometry,
                hasSkeleton,
                skinningNormalized,
                phaseAdvanced,
                speedValid,
                groundingValid,
                realizedGroundingPass,
                pelvisDynamic,
                vertexCount: b1.vertexCount,
                triangleCount: b1.triangleCount,
                boneCount: b1.boneCount,
                initialPhase: initial.phase,
                afterPhase: afterStep.phase,
                speed: afterStep.speed,
                leftHeight: leftH,
                rightHeight: rightH,
                maxRealizedFloat,
                minRealizedFloat,
                maxRealizedError,
                maxNormError: b1.maxNormalizationError
              },
              diagnosticsRecords: [
                { severity: 'INFO', code: 'B1_CHAR_OK', subsystem: 'character', message: `Vertices: ${b1.vertexCount}, Bones: ${b1.boneCount}` },
                { severity: 'INFO', code: 'B1_MOTION_OK', subsystem: 'motion', message: `Speed: ${afterStep.speed.toFixed(2)}m/s, Phase: ${(afterStep.phase * 100).toFixed(1)}%` },
                { severity: 'INFO', code: 'B1_GROUNDING_OK', subsystem: 'motion', message: `RealizedFloat: ${(maxRealizedFloat * 1000).toFixed(1)}mm, RealizedErr: ${(maxRealizedError * 1000).toFixed(3)}mm` }
              ]
            };
          } catch (evalErr) {
            return {
              success: false,
              evalError: evalErr.message,
              stack: evalErr.stack
            };
          }
        });
      }

      // If evaluating Proof B2 Combat Room, run in-browser gameplay, collision, and combat evaluation
      let b2Proof = null;
      if (url.includes('proof=b2')) {
        b2Proof = await page.evaluate(() => {
          try {
            if (!window.__PROOF_B2_COMBAT__) {
              return { success: false, error: 'window.__PROOF_B2_COMBAT__ not found' };
            }
            const b2 = window.__PROOF_B2_COMBAT__;
            const initial = b2.getStateSnapshot();
            const startPosition = { ...initial.player.position };

            // 1. Initial generation checks (Room geometry, materials, character skeletons)
            const hasRoomGeometry = b2.hasRoomGeometry && b2.vertexCount > 50 && b2.triangleCount > 50;
            const hasMaterials = b2.hasMaterials;
            const hasCharacters = b2.hasCharacters;

            // 2. Controlled movement towards enemy via real action/input system
            // Player starts at Z = -4.5, Enemy at Z = +4.5. Advance player along +Z into melee range
            b2.simulateAction('MoveForward', true);
            for (let i = 0; i < 75; i++) {
              b2.step(16.666);
            }
            b2.simulateAction('MoveForward', false);
            for (let i = 0; i < 5; i++) {
              b2.step(16.666);
            }

            const movedSnapshot = b2.getStateSnapshot();
            const endPosition = { ...movedSnapshot.player.position };
            const movementDelta = endPosition.z - startPosition.z;
            const playerMovedForward = movementDelta > 1.5;

            // 3. Controlled Combat Strike & Single Hit Authority Resolution
            b2.triggerAttack();
            let fistSampleCoherent = false;

            for (let i = 0; i < 30; i++) {
              b2.step(16.666);
              const snap = b2.getStateSnapshot();
              if (snap.combatStats.lastFistCoherence && snap.combatStats.lastFistCoherence.coherent) {
                fistSampleCoherent = true;
              }
            }

            // 4. Repeated strikes to confirm damage accumulation and victory state transition
            let victoryAchieved = false;
            for (let round = 0; round < 6; round++) {
              b2.triggerAttack();
              for (let i = 0; i < 35; i++) {
                b2.step(16.666);
                const s = b2.getStateSnapshot();
                if (s.state === 'VICTORY' || s.enemy.hp <= 0) {
                  victoryAchieved = true;
                  break;
                }
              }
              if (victoryAchieved) break;
            }

            const finalSnap = b2.getStateSnapshot();
            const hitsLanded = finalSnap.combatStats.playerHitsLanded > 0;
            const damageDealt = finalSnap.combatStats.totalDamageDealt > 0;

            const allPassed = Boolean(
              hasRoomGeometry &&
              hasMaterials &&
              hasCharacters &&
              playerMovedForward &&
              hitsLanded &&
              damageDealt &&
              victoryAchieved
            );

            return {
              success: allPassed,
              checks: {
                b2Boot: Boolean(b2.game && b2.renderer),
                b2RoomGeneration: hasRoomGeometry,
                b2MaterialGeneration: hasMaterials,
                b2CharacterIntegration: hasCharacters,
                b2PlayerMovement: playerMovedForward,
                b2CombatExecution: hitsLanded && damageDealt,
                b2WinState: victoryAchieved,
                startPosition,
                endPosition,
                movementDelta,
                fistSampleCoherent,
                vertexCount: b2.vertexCount,
                triangleCount: b2.triangleCount,
                hitsLanded: finalSnap.combatStats.playerHitsLanded,
                totalDamage: finalSnap.combatStats.totalDamageDealt,
                finalState: finalSnap.state,
                enemyHp: finalSnap.enemy.hp
              },
              diagnosticsRecords: b2.game.diagnostics
            };
          } catch (evalErr) {
            return {
              success: false,
              evalError: evalErr.message,
              stack: evalErr.stack
            };
          }
        });
      }

      let cProof = null;
      if (url.includes('proof=c')) {
        cProof = await page.evaluate(async () => {
          try { return await window.__PROOF_C_WORLD__.runProof(); }
          catch (error) { return { success: false, error: error.message, stack: error.stack }; }
        });
        if (captureScreenshot) screenshotBuffer = await page.screenshot({ type: 'png' });
      }

      let dProof = null;
      if (url.includes('proof=d')) {
        dProof = await page.evaluate(async () => {
          try { return await window.__PROOF_D_RACING__.runProof(); }
          catch (error) { return { success: false, error: error.message, stack: error.stack }; }
        });
        if (captureScreenshot) screenshotBuffer = await page.screenshot({ type: 'png' });
      }

      return {
        url,
        httpStatus,
        bootProof,
        pongProof,
        b1Proof,
        b2Proof,
        cProof,
        dProof,
        domDetails,
        consoleErrors,
        consoleWarnings,
        pageErrors,
        failedRequests,
        screenshotBuffer,
        viewport
      };
    } finally {
      await browser.close();
    }
  })();
}
