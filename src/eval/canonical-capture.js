/**
 * My Game Engine 1.0 — Canonical View Capture
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * EVALUATION TOOLING. Node-only: depends on puppeteer-core, node:fs and a local
 * browser binary. This module is deliberately NOT exported through engine/full
 * — importing the authoring surface must never drag headless-browser machinery
 * into a browser bundle. See `Next step.md` Decision 9.
 *
 * It consumes the same canonical view solver the human Preview Lab uses, so
 * human and automated evidence are framed identically. The framing contract is
 * shared; the capture driver is not.
 *
 * Determinism, per Decision 2: the manifest is compared byte-for-byte; rendered
 * images are compared by tolerance. Portable PNG byte identity is not a
 * reliable graphics contract and is not claimed here.
 */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findBrowserExecutable } from './browser.js';
import { CANONICAL_VIEWS } from '../preview/views.js';
import { hashBytes } from '../geometry/mesh-codec.js';

/**
 * Captures every canonical view of a previewable asset from a running dev
 * server, writing PNGs and the AssetPreviewManifest to an output directory.
 *
 * @param {object} [options]
 * @param {string} [options.asset='cinder']
 * @param {string} [options.baseUrl='http://localhost:5173']
 * @param {string} [options.outputDir='artifacts/preview']
 * @param {object} [options.viewport={width:960,height:640}]
 * @param {number} [options.timeout=20000]
 * @param {boolean} [options.writeFiles=true]
 * @returns {Promise<object>} Capture report.
 */
export async function renderCanonicalViews({
  asset = 'cinder',
  baseUrl = 'http://localhost:5173',
  outputDir = 'artifacts/preview',
  viewport = { width: 960, height: 640 },
  timeout = 20000,
  writeFiles = true
} = {}) {
  const executablePath = findBrowserExecutable();
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setCacheEnabled(false);

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));

    const url = `${baseUrl}/?preview=${encodeURIComponent(asset)}`;
    const response = await page.goto(url, { waitUntil: 'load', timeout });
    const httpStatus = response ? response.status() : 0;

    await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout });

    const environment = await page.evaluate(() => {
      const canvas = document.querySelector('#preview-stage canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      let rendererBackend = 'unknown';
      if (gl) {
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        rendererBackend = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'webgl';
      }
      return {
        userAgent: navigator.userAgent,
        rendererBackend,
        dpr: window.devicePixelRatio || 1,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });

    const identity = await page.evaluate(() => ({
      meshHash: window.__PREVIEW_LAB__.meshHash,
      manifestHash: window.__PREVIEW_LAB__.manifestHash,
      manifestJson: window.__PREVIEW_LAB__.manifestJson,
      stats: window.__PREVIEW_LAB__.getStats(),
      parts: window.__PREVIEW_LAB__.getParts()
    }));

    if (writeFiles) fs.mkdirSync(outputDir, { recursive: true });

    const captures = [];
    for (const view of CANONICAL_VIEWS) {
      const camera = await page.evaluate((v) => {
        window.__PREVIEW_LAB__.setView(v);
        const found = window.__PREVIEW_LAB__.manifest.captures.find((c) => c.name === v);
        return found ?? null;
      }, view);

      // Let the on-demand render settle. There is no persistent RAF loop, so a
      // scheduled frame must be allowed to run before the pixels are read.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      // Capture the RENDER SURFACE only. Page chrome in a canonical view would
      // pollute the evidence an agent reasons over, and would not match the
      // camera aspect recorded in the manifest.
      const element = await page.$('#preview-stage canvas');
      if (!element) throw new Error('Preview canvas not found; cannot capture a canonical view');
      const buffer = await element.screenshot({ type: 'png' });

      const imagePath = path.join(outputDir, `${asset}_${view}.png`);
      if (writeFiles) fs.writeFileSync(imagePath, buffer);

      captures.push({
        name: view,
        cameraPosition: camera?.cameraPosition ?? null,
        cameraTarget: camera?.cameraTarget ?? null,
        up: camera?.up ?? null,
        fovDeg: camera?.fovDeg ?? null,
        viewport: { width: viewport.width, height: viewport.height },
        environment,
        imagePath: writeFiles ? imagePath.replace(/\\/g, '/') : null,
        // Same-environment supplementary evidence only. NOT a portable contract.
        imageHash: hashBytes(new Uint8Array(buffer)),
        imageBytes: buffer.length
      });
    }

    // Idle behaviour: a static asset must not hold a permanent animation loop.
    const idleFrameScheduled = await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__PREVIEW_LAB__.frameScheduled;
    });

    // Lifecycle: dispose must be clean and idempotent.
    const lifecycle = await page.evaluate(() => {
      window.__PREVIEW_LAB__.dispose();
      const afterFirst = window.__PREVIEW_LAB__.disposed;
      window.__PREVIEW_LAB__.dispose();
      return { disposed: afterFirst, doubleDisposeThrew: false };
    }).catch((err) => ({ disposed: false, doubleDisposeThrew: true, error: String(err) }));

    const report = {
      asset,
      url,
      httpStatus,
      environment,
      meshHash: identity.meshHash,
      manifestHash: identity.manifestHash,
      manifestJson: identity.manifestJson,
      stats: identity.stats,
      parts: identity.parts,
      captures,
      idleFrameScheduled,
      lifecycle,
      consoleErrors,
      pageErrors,
      capturedAt: new Date().toISOString()
    };

    if (writeFiles) {
      fs.writeFileSync(
        path.join(outputDir, `${asset}_manifest.json`),
        identity.manifestJson
      );
      fs.writeFileSync(
        path.join(outputDir, `${asset}_capture_report.json`),
        JSON.stringify({ ...report, manifestJson: undefined }, null, 2)
      );
    }

    return report;
  } finally {
    await browser.close();
  }
}

/**
 * Compares two capture reports of the same asset.
 *
 * Structural evidence is compared strictly. Images are compared by byte size
 * within a tolerance, because portable PNG byte identity is not a reliable
 * contract across GPU vendors, drivers and browser builds.
 *
 * @param {object} a
 * @param {object} b
 * @param {object} [options]
 * @param {number} [options.imageSizeTolerance=0.02] - Fractional byte-size tolerance.
 * @returns {object} Comparison result.
 */
export function compareCaptureReports(a, b, { imageSizeTolerance = 0.02 } = {}) {
  const findings = [];

  if (a.meshHash !== b.meshHash) {
    findings.push({ kind: 'STRICT', field: 'meshHash', a: a.meshHash, b: b.meshHash });
  }
  if (a.manifestHash !== b.manifestHash) {
    findings.push({ kind: 'STRICT', field: 'manifestHash', a: a.manifestHash, b: b.manifestHash });
  }
  if (a.manifestJson !== b.manifestJson) {
    findings.push({ kind: 'STRICT', field: 'manifestJson', a: 'differs', b: 'differs' });
  }

  const imageComparisons = [];
  for (const capA of a.captures) {
    const capB = b.captures.find((c) => c.name === capA.name);
    if (!capB) {
      findings.push({ kind: 'STRICT', field: `captures.${capA.name}`, a: 'present', b: 'missing' });
      continue;
    }
    const larger = Math.max(capA.imageBytes, capB.imageBytes) || 1;
    const delta = Math.abs(capA.imageBytes - capB.imageBytes) / larger;
    imageComparisons.push({
      name: capA.name,
      byteDelta: delta,
      identicalHash: capA.imageHash === capB.imageHash,
      withinTolerance: delta <= imageSizeTolerance
    });
  }

  return {
    structurallyIdentical: findings.length === 0,
    findings,
    imageComparisons,
    imagesWithinTolerance: imageComparisons.every((c) => c.withinTolerance)
  };
}
