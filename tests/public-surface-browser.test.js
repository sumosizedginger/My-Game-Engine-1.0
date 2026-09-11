import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';
import { buildPublicSurfaceCell } from '../examples/public-surface-cell/cell.js';

/**
 * Real browser acceptance for PUBLIC-SURFACE-001.
 *
 * Node resolving `@sumosizedginger/my-game-engine-1.0/full` proves one thing.
 * A BUNDLER resolving it proves another, and an external consumer needs both.
 * The page under test reaches the engine only through that specifier, so if
 * Vite could not resolve the package self-reference the page would not load at
 * all — which makes this the decisive check rather than a smoke test.
 */
test('the public package surface resolves and generates in a real browser', async (t) => {
  const server = await createServer({
    cacheDir: 'artifacts/public-surface/vite-test-cache',
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;

  // Independently built in Node, to compare against what the browser produced.
  const reference = buildPublicSurfaceCell();
  const referenceIdentity = reference.identity;
  const referenceSteps = Object.fromEntries(reference.report.steps.map((s) => [s.forge, s]));
  reference.dispose();

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
    const failedRequests = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));

    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(`${url}/?surface=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__PUBLIC_SURFACE__), { timeout: 30000 });

    await t.test('the package specifier resolved through the bundler', async () => {
      // Reaching here at all is the proof: the module graph of this page is
      // rooted in a file that imports only the package specifier.
      const forges = await page.evaluate(() => window.__PUBLIC_SURFACE__.resolvedThroughPackage());
      assert.deepEqual([...forges].sort(), ['character', 'geometry', 'motion', 'scene', 'world']);
      assert.deepEqual(failedRequests, [], 'no module failed to resolve');
    });

    await t.test('every Forge produced a real result in the browser', async () => {
      const report = await page.evaluate(() => window.__PUBLIC_SURFACE__.report());
      const byForge = Object.fromEntries(report.steps.map((s) => [s.forge, s]));

      assert.ok(byForge.world.trees > 0, 'World Forge generated nothing');
      assert.equal(byForge.world.standaloneQueryAgrees, true);
      assert.ok(byForge.geometry.triangles > 0, 'Geometry Forge generated nothing');
      assert.ok(byForge.character.bones > 0, 'Character Forge generated nothing');
      assert.equal(byForge.character.landmarksReproducible, true);
      assert.equal(byForge.motion.phaseAdvanced, true, 'Motion Forge did not advance');
      assert.ok(byForge.motion.travelledMetres > 0);
      assert.equal(byForge.motion.ikReachable, true);
      assert.equal(byForge.motion.ikRefusesOutOfReach, true);
      assert.equal(byForge.scene.nodes, 4);
      assert.equal(report.diagnostics, 0);
    });

    await t.test('the browser result is identical to the Node result', async () => {
      // Same seed, same engine, same answer. A package route that produced
      // different output in the browser would not be one contract.
      const report = await page.evaluate(() => window.__PUBLIC_SURFACE__.report());
      assert.equal(report.identity, referenceIdentity,
        'browser and Node must agree on the generated cell');
      assert.equal(report.sceneSourceHash, referenceSteps.scene.sourceHash);

      const browserWorld = report.steps.find((s) => s.forge === 'world');
      assert.equal(browserWorld.fieldHash, referenceSteps.world.fieldHash);
      assert.equal(browserWorld.trees, referenceSteps.world.trees);
    });

    await t.test('the generated results actually reached the renderer', async () => {
      const state = await page.evaluate(() => {
        const canvas = document.querySelector('#ps-stage canvas');
        const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
        return {
          hasCanvas: Boolean(canvas),
          width: canvas?.width ?? 0,
          contextLost: gl ? gl.isContextLost() : true,
          presented: window.__PUBLIC_SURFACE__.report().presentedObjects,
          panelText: document.querySelector('#ps-forges')?.textContent ?? ''
        };
      });
      assert.equal(state.hasCanvas, true);
      assert.ok(state.width > 0);
      assert.equal(state.contextLost, false);
      // terrain + room + character.
      assert.equal(state.presented, 3, 'all three generated meshes must be on screen');
      for (const forge of ['World Forge', 'Geometry Forge', 'Character Forge', 'Motion Forge']) {
        assert.ok(state.panelText.includes(forge), `${forge} must be reported to the human`);
      }
    });

    await t.test('the page schedules no permanent animation frame', async () => {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const idle = await page.evaluate(() => window.__PUBLIC_SURFACE__.frameScheduled);
      assert.equal(idle, false, 'the viewer must render on demand');
    });

    await t.test('dispose releases Forge-owned renderer resources', async () => {
      const result = await page.evaluate(() => {
        const handle = window.__PUBLIC_SURFACE__;
        const cell = handle.cell;
        const before = {
          terrainDisposed: cell.world.disposed,
          sceneDisposed: cell.sceneInstance.disposed
        };
        handle.dispose();
        let threw = false;
        try { handle.dispose(); } catch { threw = true; }
        return {
          before,
          disposed: handle.disposed,
          cellDisposed: cell.disposed,
          worldDisposed: cell.world.disposed,
          sceneDisposed: cell.sceneInstance.disposed,
          doubleDisposeThrew: threw,
          canvases: document.querySelectorAll('#ps-stage canvas').length,
          globalCleared: window.__PUBLIC_SURFACE__ === undefined
        };
      });
      assert.equal(result.before.terrainDisposed, false, 'the fixture must start live');
      assert.equal(result.disposed, true);
      assert.equal(result.cellDisposed, true);
      assert.equal(result.worldDisposed, true, 'World Forge terrain must be released');
      assert.equal(result.sceneDisposed, true);
      assert.equal(result.doubleDisposeThrew, false);
      assert.equal(result.canvases, 0);
      assert.equal(result.globalCleared, true);
    });

    await t.test('repeated create and dispose cycles accumulate nothing', async () => {
      const result = await page.evaluate(() => {
        const identities = [];
        let canvases = [];
        for (let i = 0; i < 3; i++) {
          const handle = window.__PUBLIC_SURFACE_RECREATE__();
          identities.push(handle.report().identity);
          canvases.push(document.querySelectorAll('#ps-stage canvas').length);
        }
        const last = window.__PUBLIC_SURFACE__;
        last.dispose();
        return { identities, canvases, finalCanvases: document.querySelectorAll('#ps-stage canvas').length };
      });
      assert.equal(new Set(result.identities).size, 1, 'each cycle must reproduce the same cell');
      assert.deepEqual(result.canvases, [1, 1, 1], 'a canvas must not accumulate per cycle');
      assert.equal(result.finalCanvases, 0);
    });

    await t.test('no console or page errors occurred at any point', () => {
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
    });
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});
