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
 * images are compared as DECODED PIXELS against an explicit numeric threshold.
 * Portable PNG byte identity is not a reliable graphics contract and is not
 * claimed here, and compressed file size is never used as a stand-in for
 * visual similarity.
 */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findBrowserExecutable } from './browser.js';
import { CANONICAL_VIEWS } from '../preview/views.js';
import { hashBytes } from '../geometry/mesh-codec.js';
import { getRevisionInfo } from './revision.js';
import { decodePng, compareImageBuffers, IMAGE_COMPARISON_DEFAULTS } from './png.js';

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

    const revision = getRevisionInfo();

    // Environment metadata describes the ACTUAL render, not what was requested.
    // The recorded surface size is the canvas Preview Lab really rendered into
    // and the recorded DPR is the value left after the budget clamp, so the
    // camera aspect in the manifest corresponds to the pixels captured.
    const pageEnvironment = await page.evaluate(() => {
      const canvas = document.querySelector('#preview-stage canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      let rendererBackend = 'unknown';
      if (gl) {
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        rendererBackend = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'webgl';
      }
      const stats = window.__PREVIEW_LAB__.getStats();
      return {
        userAgent: navigator.userAgent,
        rendererBackend,
        windowDevicePixelRatio: window.devicePixelRatio || 1,
        requestedDpr: stats.requestedDpr,
        effectiveDpr: stats.effectiveDpr,
        dprClamped: stats.dprClamped,
        surfaceWidth: stats.surfaceWidth,
        surfaceHeight: stats.surfaceHeight,
        drawingBufferWidth: stats.drawingBufferWidth,
        drawingBufferHeight: stats.drawingBufferHeight,
        cssViewportWidth: window.innerWidth,
        cssViewportHeight: window.innerHeight
      };
    });

    const environment = {
      ...pageEnvironment,
      engineRevision: revision.commit,
      engineBranch: revision.branch,
      engineWorktreeClean: revision.clean,
      nodeVersion: process.version
    };

    const identity = await page.evaluate(() => ({
      meshHash: window.__PREVIEW_LAB__.meshHash,
      manifestHash: window.__PREVIEW_LAB__.manifestHash,
      manifestJson: window.__PREVIEW_LAB__.manifestJson,
      // PORTABLE asset identity, free of camera pose, aspect and viewport.
      structuralHash: window.__PREVIEW_LAB__.structuralHash,
      structuralJson: window.__PREVIEW_LAB__.structuralJson,
      stats: window.__PREVIEW_LAB__.getStats(),
      parts: window.__PREVIEW_LAB__.getParts()
    }));

    if (writeFiles) fs.mkdirSync(outputDir, { recursive: true });

    const captures = [];
    for (const view of CANONICAL_VIEWS) {
      const viewState = await page.evaluate((v) => {
        window.__PREVIEW_LAB__.setView(v);
        const found = window.__PREVIEW_LAB__.manifest.captures.find((c) => c.name === v);
        return {
          camera: found ?? null,
          // Illumination that produced these pixels. Camera-relative, so it
          // legitimately differs per view; recorded so a reader can tell a dark
          // asset from a dark view.
          lighting: window.__PREVIEW_LAB__.getLighting(),
          lightCount: window.__PREVIEW_LAB__.lightCount
        };
      }, view);
      const camera = viewState.camera;

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

      // Dimensions come from the captured image itself, so the recorded
      // viewport can never drift from the pixels on disk.
      const decoded = decodePng(buffer);

      captures.push({
        name: view,
        cameraPosition: camera?.cameraPosition ?? null,
        cameraTarget: camera?.cameraTarget ?? null,
        up: camera?.up ?? null,
        fovDeg: camera?.fovDeg ?? null,
        aspect: camera?.aspect ?? null,
        projectedBoundsOccupancy: camera?.projectedBoundsOccupancy ?? null,
        lighting: viewState.lighting,
        lightCount: viewState.lightCount,
        // The ACTUAL captured surface, in device pixels and CSS pixels.
        viewport: { width: decoded.width, height: decoded.height },
        surface: {
          cssWidth: environment.surfaceWidth,
          cssHeight: environment.surfaceHeight,
          devicePixelWidth: decoded.width,
          devicePixelHeight: decoded.height,
          effectiveDpr: environment.effectiveDpr
        },
        environment,
        imagePath: writeFiles ? imagePath.replace(/\\/g, '/') : null,
        // Same-environment supplementary evidence only. NOT a portable contract
        // and NOT the comparison: see compareCaptureReports.
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

    // Two manifests, deliberately.
    //
    // The STRUCTURAL manifest is what the page produced: asset identity and
    // measurement only. It must be byte-identical across runs and machines, so
    // machine-specific facts are kept out of it entirely.
    //
    // The CAPTURE manifest is the structural one enriched with the evidence
    // context Decision 2 requires — engine revision, renderer backend, DPR,
    // actual surface size, image paths. That context legitimately differs
    // between machines, which is exactly why it cannot live in the artifact
    // whose identity must not.
    const structural = JSON.parse(identity.manifestJson);
    const captureManifest = {
      ...structural,
      capturedAt: new Date().toISOString(),
      environment,
      captures: structural.captures.map((planned) => {
        const actual = captures.find((c) => c.name === planned.name);
        return actual ? { ...planned, ...actual } : planned;
      })
    };

    const report = {
      asset,
      url,
      httpStatus,
      captureManifest,
      environment,
      meshHash: identity.meshHash,
      manifestHash: identity.manifestHash,
      manifestJson: identity.manifestJson,
      structuralHash: identity.structuralHash,
      structuralJson: identity.structuralJson,
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
        path.join(outputDir, `${asset}_capture_manifest.json`),
        JSON.stringify(captureManifest, null, 2)
      );
      fs.writeFileSync(
        path.join(outputDir, `${asset}_capture_report.json`),
        JSON.stringify({ ...report, manifestJson: undefined, captureManifest: undefined }, null, 2)
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
 * Structural evidence is compared strictly, byte for byte. Images are compared
 * as DECODED PIXELS with explicit numeric metrics and an explicit threshold.
 *
 * Image hashes are retained only as supplementary same-environment evidence.
 * They are not the comparison: a hash tells you two files differ, never by how
 * much or whether it matters. Compressed byte size is not used at all, because
 * it carries no information about what an image looks like.
 *
 * @param {object} a
 * @param {object} b
 * @param {object} [options]
 * @param {object} [options.thresholds=IMAGE_COMPARISON_DEFAULTS]
 * @returns {object} Comparison result.
 */
export function compareCaptureReports(a, b, { thresholds = IMAGE_COMPARISON_DEFAULTS } = {}) {
  const findings = [];

  // PORTABLE ASSET IDENTITY. These must match for the same asset on any
  // machine, in any browser, at any window size.
  if (a.meshHash !== b.meshHash) {
    findings.push({ kind: 'STRICT', field: 'meshHash', a: a.meshHash, b: b.meshHash });
  }
  if (a.structuralHash !== b.structuralHash) {
    findings.push({ kind: 'STRICT', field: 'structuralHash', a: a.structuralHash, b: b.structuralHash });
  }
  if (a.structuralJson !== b.structuralJson) {
    findings.push({ kind: 'STRICT', field: 'structuralJson', a: 'differs', b: 'differs' });
  }

  // OBSERVATION identity. The full manifest carries camera pose, aspect and
  // viewport, which are properties of the capture setup rather than of the
  // asset. Two runs under the SAME setup must still agree exactly, so a
  // difference is reported — but as CAPTURE_DEPENDENT, because a difference
  // here with matching structural hashes means the setup changed, not the
  // asset. Treating it as a structural failure is what previously made a
  // resized browser window look like a different asset.
  const sameSetup =
    a.environment?.surfaceWidth === b.environment?.surfaceWidth &&
    a.environment?.surfaceHeight === b.environment?.surfaceHeight &&
    a.environment?.effectiveDpr === b.environment?.effectiveDpr;

  if (a.manifestHash !== b.manifestHash) {
    findings.push({
      kind: sameSetup ? 'STRICT' : 'CAPTURE_DEPENDENT',
      field: 'manifestHash',
      a: a.manifestHash,
      b: b.manifestHash,
      note: sameSetup
        ? 'identical capture setup must reproduce the observation manifest exactly'
        : 'capture setup differs; compare structuralHash for asset identity'
    });
  }

  const imageComparisons = [];
  for (const capA of a.captures) {
    const capB = b.captures.find((c) => c.name === capA.name);
    if (!capB) {
      findings.push({ kind: 'STRICT', field: `captures.${capA.name}`, a: 'present', b: 'missing' });
      continue;
    }
    if (!capA.imagePath || !capB.imagePath) {
      findings.push({ kind: 'STRICT', field: `captures.${capA.name}.imagePath`, a: capA.imagePath, b: capB.imagePath });
      continue;
    }

    const pixels = compareImageBuffers(
      fs.readFileSync(capA.imagePath),
      fs.readFileSync(capB.imagePath),
      thresholds
    );

    imageComparisons.push({
      name: capA.name,
      ...pixels,
      // Supplementary, same-environment only. Never the contract.
      identicalHash: capA.imageHash === capB.imageHash
    });
  }

  return {
    // Asset identity, not observation identity: a CAPTURE_DEPENDENT finding
    // does not make two runs structurally different.
    structurallyIdentical: findings.every((f) => f.kind !== 'STRICT'),
    sameCaptureSetup: sameSetup,
    findings,
    imageComparisons,
    imagesWithinThreshold: imageComparisons.every((c) => c.withinThreshold)
  };
}
