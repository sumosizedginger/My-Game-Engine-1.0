/**
 * My Game Engine 1.0 — Automated Browser Evaluation
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Drives headless browser validation using puppeteer-core and local Chrome/Edge.
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

      // Extract boot proof object
      const bootProof = await page.evaluate(() => {
        return window.__PHASE_0_BOOT_PROOF__ || null;
      });

      // Inspect DOM elements
      const domDetails = await page.evaluate(() => {
        const engineTitle = document.getElementById('engine-title')?.textContent?.trim() || '';
        const bootStatus = document.getElementById('boot-status')?.textContent?.trim() || '';
        const repoId = document.getElementById('repo-id')?.textContent?.trim() || '';
        const toolchainLabel = document.getElementById('toolchain-label')?.textContent?.trim() || '';
        return { engineTitle, bootStatus, repoId, toolchainLabel };
      });

      let screenshotBuffer = null;
      if (captureScreenshot) {
        screenshotBuffer = await page.screenshot({ type: 'png' });
      }

      return {
        url,
        httpStatus,
        bootProof,
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
