import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';

test('B2 live viewport policy is independent of the controlled fixture', async (t) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findBrowserExecutable(), headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await t.test('live canvas fills changing viewports and updates the real camera and buffer', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${url}/?proof=b2`);
      await page.waitForFunction(() => Boolean(window.__PROOF_B2_COMBAT__));
      for (const [width, height, deviceScaleFactor] of [[1920, 1080, 1], [2560, 1440, 1], [3440, 1440, 1], [1024, 768, 1], [390, 844, 1], [1280, 720, 3]]) {
        await page.setViewport({ width, height, deviceScaleFactor });
        // A reload exercises initial DPR as well as the resize path above.
        if (deviceScaleFactor !== 1) await page.reload();
        await page.waitForFunction((w, h) => {
          const b = window.__PROOF_B2_COMBAT__;
          return b && b.renderer.camera.aspect === w / h && b.renderer.renderer.domElement.width === w * Math.min(devicePixelRatio, 2);
        }, {}, width, height);
        const measured = await page.evaluate(() => {
          const b = window.__PROOF_B2_COMBAT__;
          const canvas = b.renderer.renderer.domElement;
          const rect = canvas.getBoundingClientRect();
          const root = getComputedStyle(document.getElementById('app'));
          return {
            rect: [rect.x, rect.y, rect.width, rect.height],
            buffer: [canvas.width, canvas.height], maxWidth: root.maxWidth,
            overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
            overlay: getComputedStyle(document.getElementById('b2-status-banner')).position,
            running: b.isRunning, controlled: b.isControlled,
            menuOpen: document.querySelector('.b2-proof-menu').open
          };
        });
        assert.deepEqual(measured.rect, [0, 0, width, height]);
        assert.deepEqual(measured.buffer, [width * Math.min(deviceScaleFactor, 2), height * Math.min(deviceScaleFactor, 2)]);
        assert.equal(measured.maxWidth, 'none');
        assert.equal(measured.overflow, false);
        assert.equal(measured.overlay, 'absolute');
        assert.equal(measured.running, true);
        assert.equal(measured.controlled, false);
        assert.equal(measured.menuOpen, false);
      }
    });

    await t.test('only live rendering cuts away the north wall; room truth still encloses it', async () => {
      for (const controlled of [false, true]) {
        await page.goto(`${url}/?proof=b2${controlled ? '&controlled=1' : ''}`);
        await page.waitForFunction(() => Boolean(window.__PROOF_B2_COMBAT__));
        const walls = await page.evaluate(() => {
          const { game, renderer } = window.__PROOF_B2_COMBAT__;
          const room = game.room;
          const parts = room.visual.parts;
          const visibility = Object.fromEntries(['northWall', 'southWall', 'eastWall', 'westWall'].map(name => {
            const mesh = renderer.scene.children.find(child => child.geometry === parts[name]);
            return [name, mesh?.visible];
          }));
          const { depth, wallThickness } = room.definition.data.parameters;
          const limit = depth / 2 - wallThickness;
          return {
            visibility,
            wallSurface: Array.from(parts.northWall.getAttribute('surfaceId').array).every(id => id === room.semantics.surfaces.WALL),
            wallRegion: Array.from(parts.northWall.getAttribute('regionId').array).every(id => id === room.semantics.regions.ARENA_WALL_NORTH),
            mergedWall: Array.from(room.visual.geometry.getAttribute('regionId').array).includes(room.semantics.regions.ARENA_WALL_NORTH),
            boundaryMatchesDefinition: room.collision.innerBounds.maxZ === limit,
            blocked: room.collision.resolvePosition(0, depth, 0.4),
            expectedZ: limit - 0.4,
            outsideWalkable: room.collision.isWalkable(0, depth, 0.4)
          };
        });
        assert.deepEqual(walls.visibility, { northWall: controlled, southWall: true, eastWall: true, westWall: true });
        assert.equal(walls.wallSurface, true);
        assert.equal(walls.wallRegion, true);
        assert.equal(walls.mergedWall, true);
        assert.equal(walls.boundaryMatchesDefinition, true);
        assert.equal(walls.blocked.collided, true);
        assert.equal(walls.blocked.z, walls.expectedZ);
        assert.equal(walls.outsideWalkable, false);
      }
    });

    await t.test('controlled mode retains bounded layout and 500px game viewport', async () => {
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await page.goto(`${url}/?proof=b2&controlled=1`);
      await page.waitForFunction(() => Boolean(window.__PROOF_B2_COMBAT__));
      const policy = await page.evaluate(() => {
        const container = document.getElementById('b2-canvas-container');
        const b = window.__PROOF_B2_COMBAT__;
        return {
          scoped: document.body.classList.contains('b2-live-mode'),
          rootScoped: document.getElementById('app').classList.contains('b2-live-root'),
          maxWidth: getComputedStyle(container.parentElement).maxWidth,
          height: getComputedStyle(container).height,
          running: b.isRunning, controlled: b.isControlled,
          statusPosition: getComputedStyle(document.getElementById('b2-status-banner')).position
        };
      });
      assert.deepEqual(policy, { scoped: false, rootScoped: false, maxWidth: '960px', height: '500px', running: false, controlled: true, statusPosition: 'static' });
    });

    await t.test('live resize observation disconnects when the viewer is destroyed and recreated', async () => {
      // Navigate away from B2 so no existing live viewer owns the test container.
      await page.goto(url);
      const lifecycle = await page.evaluate(async () => {
        const { createB2Viewer } = await import('/src/browser/b2-viewer.js');
        const NativeObserver = window.ResizeObserver;
        const active = new Set();
        let observed = 0;
        window.ResizeObserver = class extends NativeObserver {
          observe(target) { observed++; active.add(this); super.observe(target); }
          disconnect() { active.delete(this); super.disconnect(); }
        };
        const container = document.createElement('div');
        container.style.cssText = 'width:320px;height:240px';
        document.body.appendChild(container);
        const results = [];
        try {
          for (let i = 0; i < 2; i++) {
            const viewer = createB2Viewer({ container });
            await new Promise(resolve => requestAnimationFrame(resolve));
            results.push(active.size);
            viewer.destroy();
            results.push(active.size, container.querySelectorAll('canvas').length);
          }
          window.dispatchEvent(new Event('resize'));
          return { observed, results, bridgeRemoved: !window.__PROOF_B2_COMBAT__ };
        } finally {
          window.ResizeObserver = NativeObserver;
          container.remove();
        }
      });
      assert.deepEqual(lifecycle, { observed: 2, results: [1, 0, 0, 1, 0, 0], bridgeRemoved: true });
    });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});
