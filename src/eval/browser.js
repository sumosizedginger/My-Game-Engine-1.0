/**
 * My Game Engine 1.0 — Automated Browser Evaluation
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Drives headless browser validation using puppeteer-core and local Chrome/Edge.
 * Supports both Phase 0 Boot Proof and Proof A Pong gameplay evaluation.
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

      // Wait for engine module initialization
      try {
        if (url.includes('game=pong')) {
          await page.waitForFunction(() => Boolean(window.__PROOF_A_PONG__), { timeout: 6000 });
        } else {
          await page.waitForFunction(() => Boolean(window.__PHASE_0_BOOT_PROOF__), { timeout: 6000 });
        }
      } catch (waitErr) {
        console.warn(`[BrowserEval] Timeout waiting for boot window object on ${url}:`, waitErr.message);
      }

      // Extract boot proof object if on Phase 0 boot page
      const bootProof = await page.evaluate(() => {
        return window.__PHASE_0_BOOT_PROOF__ || null;
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
        return { engineTitle, bootStatus, repoId, toolchainLabel, matchStatusBadge, p1Score, p2Score };
      });

      // Capture deterministic initial baseline screenshot BEFORE executing interactive simulation
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

      return {
        url,
        httpStatus,
        bootProof,
        pongProof,
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
