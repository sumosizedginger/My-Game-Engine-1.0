import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';
import { CANONICAL_VIEWS } from '../src/preview/views.js';
import { buildCinder } from '../examples/authoring/cinder-mk1/build.js';
import { meshHash } from '../src/geometry/mesh-codec.js';
import { diffHexRanges } from '../src/eval/probe-cinder.js';

/**
 * Real browser evidence for Preview Lab.
 *
 * Visual and runtime behaviour is only authoritative in a real browser. Code
 * inspection is not a visual PASS.
 */
test('Preview Lab renders CINDER, honours canonical views, stays idle and disposes cleanly', async (t) => {
  const server = await createServer({
    cacheDir: 'artifacts/preview/vite-test-cache',
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findBrowserExecutable(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(`${url}/?preview=cinder`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout: 20000 });

    await t.test('the asset actually renders pixels through the engine path', async () => {
      const state = await page.evaluate(() => {
        const canvas = document.querySelector('#preview-stage canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return {
          hasCanvas: Boolean(canvas),
          width: canvas.width,
          height: canvas.height,
          contextLost: gl ? gl.isContextLost() : true,
          drawCalls: window.__PREVIEW_LAB__.getStats().drawCalls,
          renderedTriangles: window.__PREVIEW_LAB__.getStats().renderedTriangles
        };
      });
      assert.equal(state.hasCanvas, true);
      assert.ok(state.width > 0 && state.height > 0);
      assert.equal(state.contextLost, false);
      assert.ok(state.drawCalls > 0, 'the renderer must have issued real draw calls');
      assert.ok(state.renderedTriangles > 0, 'triangles must have reached the GPU');
    });

    await t.test('the render surface fits the viewport and matches its container', async () => {
      // Regression: the shared index.html body is a centring flex container.
      // Without the scoped preview layout the lab sized to its content, the
      // page overflowed, and part of the render surface sat off-screen at a
      // negative x — which silently corrupted every canonical capture.
      for (const [width, height] of [[960, 640], [1280, 800], [1024, 720]]) {
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        await page.evaluate(() => window.__PREVIEW_LAB__.lab.resize());
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const box = await page.evaluate(() => {
          const rect = (sel) => {
            const r = document.querySelector(sel).getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
          };
          return {
            stage: rect('#preview-stage'),
            canvas: rect('#preview-stage canvas'),
            overflowsX: document.documentElement.scrollWidth > window.innerWidth,
            overflowsY: document.documentElement.scrollHeight > window.innerHeight
          };
        });
        assert.equal(box.overflowsX, false, `page overflows horizontally at ${width}x${height}`);
        assert.equal(box.overflowsY, false, `page overflows vertically at ${width}x${height}`);
        assert.ok(box.stage.x >= 0, `stage pushed off-screen at ${width}x${height}: x=${box.stage.x}`);
        assert.equal(box.canvas.w, box.stage.w, `canvas width must match its container at ${width}x${height}`);
        assert.equal(box.canvas.h, box.stage.h, `canvas height must match its container at ${width}x${height}`);
        assert.ok(box.stage.x + box.stage.w <= width, 'the render surface must fit inside the viewport');
      }
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    });

    await t.test('the recorded camera aspect matches the real render surface', async () => {
      const match = await page.evaluate(() => {
        const surface = window.__PREVIEW_LAB__.lab.getSurfaceSize();
        const capture = window.__PREVIEW_LAB__.manifest.captures[0];
        return {
          surface,
          viewport: capture.viewport,
          equal: capture.viewport.width === surface.width && capture.viewport.height === surface.height
        };
      });
      assert.equal(match.equal, true,
        `manifest viewport ${JSON.stringify(match.viewport)} must match surface ${JSON.stringify(match.surface)}`);
    });

    await t.test('the browser build matches the Node build byte for byte', async () => {
      // Cross-runtime determinism probe. Decision 8: evidence, not assumption.
      const nodeHash = meshHash(buildCinder().meshIR);
      const browserSide = await page.evaluate(() => ({
        hash: window.__PREVIEW_LAB__.meshHash,
        bytes: window.__PREVIEW_LAB__.meshByteLength
      }));
      if (nodeHash !== browserSide.hash) {
        const browserHex = await page.evaluate(() => window.__PREVIEW_LAB__.getMeshBytesHex());
        const { bytesToHex, encodeMesh } = await import('../src/geometry/mesh-codec.js');
        const ranges = diffHexRanges(bytesToHex(encodeMesh(buildCinder().meshIR)), browserHex, 4);
        assert.fail(
          'STOP CONDITION: canonical MeshIR bytes diverge between Node and browser. ' +
          `node=${nodeHash} browser=${browserSide.hash}. Differing ranges: ${JSON.stringify(ranges)}`
        );
      }
      assert.equal(nodeHash, browserSide.hash);
    });

    await t.test('every canonical view is reachable and reframes the camera', async () => {
      const seen = [];
      for (const view of CANONICAL_VIEWS) {
        const state = await page.evaluate((v) => {
          window.__PREVIEW_LAB__.setView(v);
          const capture = window.__PREVIEW_LAB__.manifest.captures.find((c) => c.name === v);
          return { current: window.__PREVIEW_LAB__.getStats().view, position: capture.cameraPosition };
        }, view);
        assert.equal(state.current, view);
        seen.push(state.position.join(','));
      }
      assert.equal(new Set(seen).size, CANONICAL_VIEWS.length, 'each canonical view must frame differently');
    });

    await t.test('an unknown view is refused rather than silently ignored', async () => {
      const threw = await page.evaluate(() => {
        try { window.__PREVIEW_LAB__.setView('isometric'); return false; } catch { return true; }
      });
      assert.equal(threw, true);
    });

    await t.test('a static asset holds no permanent animation loop while idle', async () => {
      // Settle any scheduled frame, then confirm nothing reschedules itself.
      const idle = await page.evaluate(async () => {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const first = window.__PREVIEW_LAB__.frameScheduled;
        await new Promise((r) => setTimeout(r, 250));
        return { first, after: window.__PREVIEW_LAB__.frameScheduled };
      });
      assert.equal(idle.first, false, 'no frame should be scheduled once the view has settled');
      assert.equal(idle.after, false, 'the preview must not re-arm a RAF loop while idle');
    });

    await t.test('interaction schedules exactly one frame, not a loop', async () => {
      const result = await page.evaluate(async () => {
        window.__PREVIEW_LAB__.lab.requestRender();
        const scheduledImmediately = window.__PREVIEW_LAB__.frameScheduled;
        window.__PREVIEW_LAB__.lab.requestRender();
        const stillOne = window.__PREVIEW_LAB__.frameScheduled;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { scheduledImmediately, stillOne, afterFrame: window.__PREVIEW_LAB__.frameScheduled };
      });
      assert.equal(result.scheduledImmediately, true);
      assert.equal(result.stillOne, true, 'repeated requests within a frame must coalesce');
      assert.equal(result.afterFrame, false, 'the scheduled frame must not re-arm');
    });

    await t.test('the inspector reports measured part names and dimensions', async () => {
      const parts = await page.evaluate(() => window.__PREVIEW_LAB__.getParts());
      assert.ok(parts.length >= 6);
      for (const part of parts) {
        assert.ok(part.semanticName.length > 0);
        assert.ok(part.triangleCount > 0);
        assert.equal(part.dimensions.length, 3);
      }
      const rendered = await page.evaluate(() => document.querySelector('#preview-parts').textContent);
      assert.match(rendered, /receiver/);
      assert.match(rendered, /barrel/);
    });

    await t.test('device pixel ratio stays within the declared budget', async () => {
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 3 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout: 20000 });
      const dpr = await page.evaluate(() => window.__PREVIEW_LAB__.getStats().dpr);
      assert.ok(dpr <= 2, `dpr ${dpr} must be capped by the preview budget`);
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    });

    await t.test('dispose releases GPU resources and is idempotent', async () => {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout: 20000 });
      const result = await page.evaluate(() => {
        const handle = window.__PREVIEW_LAB__;
        const before = handle.lab.getStats().geometriesInMemory;
        handle.dispose();
        const afterFirst = handle.disposed;
        handle.dispose();
        return {
          before,
          afterFirst,
          afterSecond: handle.disposed,
          canvasRemoved: !document.querySelector('#preview-stage canvas'),
          statsAfterDispose: handle.lab.getStats()
        };
      });
      assert.ok(result.before > 0, 'geometry should have been resident before dispose');
      assert.equal(result.afterFirst, true);
      assert.equal(result.afterSecond, true, 'double dispose must be safe');
      assert.equal(result.canvasRemoved, true, 'the canvas must be detached');
      assert.equal(result.statsAfterDispose, null, 'a disposed lab reports no stats');
    });

    await t.test('recreate after dispose works, proving no leaked global state', async () => {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout: 20000 });
      const second = await page.evaluate(() => ({
        disposed: window.__PREVIEW_LAB__.disposed,
        drawCalls: window.__PREVIEW_LAB__.getStats().drawCalls,
        meshHash: window.__PREVIEW_LAB__.meshHash
      }));
      assert.equal(second.disposed, false);
      assert.ok(second.drawCalls > 0);
      assert.equal(second.meshHash, meshHash(buildCinder().meshIR));
    });

    await t.test('no console or page errors occurred', () => {
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
    });
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});
