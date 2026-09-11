import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';
import {
  CANONICAL_VIEWS, INSPECTION_RIG, inspectionLightFrame, solveCanonicalView
} from '../src/preview/views.js';
import { buildCinder } from '../examples/authoring/cinder-mk1/build.js';
import { meshHash, encodeMesh, bytesToHex } from '../src/geometry/mesh-codec.js';
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

    await t.test('the browser build matches the Node build BYTE FOR BYTE', async () => {
      // Cross-runtime determinism. Decision 8: evidence, not assumption.
      //
      // The bytes are compared directly. Equal hashes plus equal lengths would
      // NOT be byte identity: meshHash is a 64-bit non-cryptographic
      // fingerprint, which names a byte stream rather than proving two streams
      // are the same one.
      const nodeMesh = buildCinder().meshIR;
      const nodeBytes = encodeMesh(nodeMesh);
      const nodeHex = bytesToHex(nodeBytes);
      const nodeHash = meshHash(nodeMesh);

      const browserSide = await page.evaluate(() => ({
        hash: window.__PREVIEW_LAB__.meshHash,
        bytes: window.__PREVIEW_LAB__.meshByteLength,
        hex: window.__PREVIEW_LAB__.getMeshBytesHex()
      }));

      assert.equal(browserSide.bytes, nodeBytes.length,
        `byte length differs: node ${nodeBytes.length}, browser ${browserSide.bytes}`);

      if (nodeHex !== browserSide.hex) {
        const ranges = diffHexRanges(nodeHex, browserSide.hex, 4);
        assert.fail(
          'STOP CONDITION: canonical MeshIR bytes diverge between Node and browser. ' +
          `node=${nodeHash} browser=${browserSide.hash}. Differing ranges: ${JSON.stringify(ranges)}`
        );
      }

      assert.equal(nodeHex, browserSide.hex, 'canonical bytes must be identical');
      // The fingerprint agreeing is a consequence, not the proof.
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

    await t.test('switching canonical views re-aims the inspection rig without accumulating lights', async () => {
      // The rig is camera-relative, so every canonical view must be lit
      // comparably rather than half of them facing away from a fixed key.
      // Re-aiming must MUTATE the existing lights: creating a light per view
      // switch would leak GPU state and silently brighten the scene.
      const baseline = await page.evaluate(() => window.__PREVIEW_LAB__.lightCount);
      assert.ok(baseline > 0, 'the scene must actually be lit');

      const perView = [];
      for (const view of CANONICAL_VIEWS) {
        perView.push(await page.evaluate((v) => {
          window.__PREVIEW_LAB__.setView(v);
          const lighting = window.__PREVIEW_LAB__.getLighting();
          return {
            view: v,
            lightCount: window.__PREVIEW_LAB__.lightCount,
            rigVersion: lighting.rigVersion,
            cameraRelative: lighting.cameraRelative,
            reportedView: lighting.view,
            key: lighting.lights.find((l) => l.name === 'key').direction
          };
        }, view));
      }

      // Cycle twice: an accumulation bug shows up on the second pass.
      for (const view of CANONICAL_VIEWS) {
        await page.evaluate((v) => window.__PREVIEW_LAB__.setView(v), view);
      }
      const afterTwoCycles = await page.evaluate(() => window.__PREVIEW_LAB__.lightCount);
      assert.equal(afterTwoCycles, baseline,
        `light count grew from ${baseline} to ${afterTwoCycles} across view switches`);

      for (const entry of perView) {
        assert.equal(entry.lightCount, baseline, `${entry.view} changed the light count`);
        assert.equal(entry.rigVersion, INSPECTION_RIG.version);
        assert.equal(entry.cameraRelative, true);
        assert.equal(entry.reportedView, entry.view);
      }

      // The key direction must actually MOVE with the view. Identical key
      // directions across views would mean the rig is still world-fixed.
      const keys = new Set(perView.map((e) => e.key.map((n) => n.toFixed(6)).join(',')));
      assert.equal(keys.size, CANONICAL_VIEWS.length,
        'the key light must re-aim for every canonical view');

      // And it must agree with the pure solver the capture path uses.
      for (const entry of perView) {
        const camera = solveCanonicalView(entry.view, buildCinder().meshIR.bounds, {
          aspect: 1, upAxis: '+Y', forwardAxis: '-Z'
        });
        const expected = inspectionLightFrame(camera).lights.find((l) => l.name === 'key').direction;
        for (let i = 0; i < 3; i++) {
          assert.ok(Math.abs(entry.key[i] - expected[i]) < 1e-9,
            `${entry.view}: browser rig must match the shared solver`);
        }
      }
    });

    await t.test('portable structural identity ignores the live viewport', async () => {
      // Resizing a browser window must not change what asset this is. The
      // camera solve fits the viewport aspect, so the observation manifest
      // legitimately moves; the structural hash must not.
      const before = await page.evaluate(() => ({
        structuralHash: window.__PREVIEW_LAB__.structuralHash,
        manifestHash: window.__PREVIEW_LAB__.manifestHash,
        surface: window.__PREVIEW_LAB__.lab.getSurfaceSize()
      }));

      await page.setViewport({ width: 700, height: 1100, deviceScaleFactor: 1 });
      await page.evaluate(() => window.__PREVIEW_LAB__.lab.resize());
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      const after = await page.evaluate(() => ({
        structuralHash: window.__PREVIEW_LAB__.structuralHash,
        surface: window.__PREVIEW_LAB__.lab.getSurfaceSize(),
        meshHash: window.__PREVIEW_LAB__.meshHash
      }));

      assert.notDeepEqual(after.surface, before.surface, 'the surface must really have changed');
      assert.equal(after.structuralHash, before.structuralHash,
        'portable asset identity must not depend on the browser window');
      assert.match(after.structuralHash, /^[0-9a-f]{16}$/);

      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await page.evaluate(() => window.__PREVIEW_LAB__.lab.resize());
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

    await t.test('repeated create/dispose cycles in ONE page leak nothing', async () => {
      // The lifecycle proof. A reload cannot demonstrate cleanup: it discards
      // the whole JavaScript world, so it shows only that the page can boot
      // twice. These cycles stay in one page, so anything dispose failed to
      // release accumulates and is visible.
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__) && Boolean(window.__PREVIEW_RECREATE__), { timeout: 20000 });

      const cycles = await page.evaluate(async () => {
        const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const sample = () => {
          const handle = window.__PREVIEW_LAB__;
          const stats = handle.getStats();
          return {
            liveLabs: handle.liveLabs,
            canvases: document.querySelectorAll('#preview-stage canvas').length,
            allCanvases: document.querySelectorAll('canvas').length,
            geometries: stats.geometriesInMemory,
            textures: stats.texturesInMemory,
            drawCalls: stats.drawCalls,
            predictedDrawCalls: stats.predictedDrawCalls,
            meshHash: handle.meshHash,
            frameScheduled: handle.frameScheduled
          };
        };

        const observations = [];
        const disposedStates = [];

        await settle();
        observations.push(sample());

        for (let i = 0; i < 4; i++) {
          const previous = window.__PREVIEW_LAB__;
          await window.__PREVIEW_RECREATE__();
          disposedStates.push(previous.disposed);
          await settle();
          // Render again, so each cycle genuinely creates, renders and disposes.
          window.__PREVIEW_LAB__.setView(i % 2 === 0 ? 'front' : 'threeQuarter');
          await settle();
          observations.push(sample());
        }

        const final = window.__PREVIEW_LAB__;
        final.dispose();
        await settle();

        return {
          observations,
          disposedStates,
          liveLabsAfterFinalDispose: final.liveLabs,
          canvasesAfterFinalDispose: document.querySelectorAll('canvas').length
        };
      });

      // Every superseded lab was actually disposed.
      assert.deepEqual(cycles.disposedStates, [true, true, true, true], 'each cycle must dispose its predecessor');

      for (const [i, obs] of cycles.observations.entries()) {
        assert.equal(obs.liveLabs, 1, `cycle ${i}: exactly one live lab, saw ${obs.liveLabs}`);
        assert.equal(obs.canvases, 1, `cycle ${i}: exactly one canvas in the stage, saw ${obs.canvases}`);
        assert.equal(obs.allCanvases, 1, `cycle ${i}: exactly one canvas in the document, saw ${obs.allCanvases}`);
        assert.equal(obs.frameScheduled, false, `cycle ${i}: no RAF held while idle`);
        assert.ok(obs.drawCalls > 0, `cycle ${i}: rendered`);
        assert.equal(obs.drawCalls, obs.predictedDrawCalls,
          `cycle ${i}: predicted draw calls ${obs.predictedDrawCalls} must match measured ${obs.drawCalls}`);
        assert.equal(obs.meshHash, cycles.observations[0].meshHash, `cycle ${i}: identity stable across cycles`);
      }

      // Resource counts must not climb with cycle number.
      const geometries = cycles.observations.map((o) => o.geometries);
      const textures = cycles.observations.map((o) => o.textures);
      assert.ok(Math.max(...geometries) <= geometries[0],
        `geometries leaked across cycles: ${geometries.join(' -> ')}`);
      assert.ok(Math.max(...textures) <= textures[0],
        `textures leaked across cycles: ${textures.join(' -> ')}`);

      assert.equal(cycles.liveLabsAfterFinalDispose, 0, 'no lab may remain live after the final dispose');
      assert.equal(cycles.canvasesAfterFinalDispose, 0, 'no canvas may remain in the document after dispose');
    });

    await t.test('a disposed handle stays inert and does not resurrect itself', async () => {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout: 20000 });
      const result = await page.evaluate(async () => {
        const handle = window.__PREVIEW_LAB__;
        handle.dispose();
        const setViewThrew = (() => {
          try { handle.setView('front'); return false; } catch { return true; }
        })();
        handle.lab.requestRender();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return {
          setViewThrew,
          frameScheduled: handle.frameScheduled,
          stats: handle.getStats(),
          liveLabs: handle.liveLabs
        };
      });
      assert.equal(result.setViewThrew, true, 'a disposed lab must refuse a view change');
      assert.equal(result.frameScheduled, false, 'a disposed lab must not schedule frames');
      assert.equal(result.stats, null);
      assert.equal(result.liveLabs, 0);
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

    await t.test('reload after dispose also works (supplementary, not the lifecycle proof)', async () => {
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
