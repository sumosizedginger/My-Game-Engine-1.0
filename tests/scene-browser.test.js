import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';
import { buildSubterraCellDefinition } from '../examples/scenes/subterra-cell/scene.js';
import { compileScene } from '../src/scene/index.js';

/**
 * Real browser evidence for SCENE-COMPOSITION-001.
 *
 * Unit tests prove the scene model composes. They cannot prove that an
 * instantiated scene reaches the screen, that unloading releases what loading
 * acquired, or that repeated lifecycle cycles leak nothing. Only a real
 * browser can, and a green unit suite is not a PASS without this.
 */
test('SUBTERRA cell instantiates, renders, unloads and reloads in a real browser', async (t) => {
  const server = await createServer({
    cacheDir: 'artifacts/scene/vite-test-cache',
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;

  // Independently compiled expectation. If the page disagrees with this, the
  // browser is not running the same scene the engine describes.
  const expected = compileScene(buildSubterraCellDefinition());

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
    await page.goto(`${url}/?scene=subterra`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__SCENE_LAB__), { timeout: 20000 });

    await t.test('the scene renders real pixels through the engine path', async () => {
      const state = await page.evaluate(() => {
        const canvas = document.querySelector('#scene-stage canvas');
        const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
        const lab = window.__SCENE_LAB__;
        return {
          hasCanvas: Boolean(canvas),
          width: canvas?.width ?? 0,
          height: canvas?.height ?? 0,
          contextLost: gl ? gl.isContextLost() : true,
          loaded: lab.loaded,
          stats: lab.presentationStats()
        };
      });
      assert.equal(state.hasCanvas, true, 'a canvas must exist');
      assert.ok(state.width > 0 && state.height > 0);
      assert.equal(state.contextLost, false);
      assert.equal(state.loaded, true);
      assert.ok(state.stats.objectCount > 0, 'the scene must put objects on screen');
      assert.deepEqual(state.stats.unresolvedKeys, [],
        'every asset key a node references must resolve');
    });

    await t.test('scene identity in the browser matches the engine', async () => {
      const identity = await page.evaluate(() => window.__SCENE_LAB__.identity());
      assert.equal(identity.sceneId, expected.id);
      assert.equal(identity.sourceHash, expected.sourceHash);
      assert.equal(identity.artifactHash, expected.artifactHash);
      assert.equal(identity.nodeCount, expected.nodeCount);
      assert.equal(identity.maxDepth, expected.maxDepth);
      assert.deepEqual(identity.roots, [...expected.roots]);
    });

    await t.test('the rendered hierarchy matches the authored hierarchy exactly', async () => {
      const hierarchy = await page.evaluate(() => window.__SCENE_LAB__.hierarchy());

      assert.equal(hierarchy.length, expected.nodeCount);
      assert.deepEqual(hierarchy.map((n) => n.pid), [...expected.order],
        'canonical order must survive into the browser');

      for (const node of hierarchy) {
        const source = expected.nodes.find((n) => n.pid === node.pid);
        assert.ok(source, `${node.pid} must exist in the compiled artifact`);
        assert.equal(node.parent, source.parent);
        assert.equal(node.depth, source.depth);
        assert.ok(node.handle, `${node.pid} must have a runtime handle`);

        // Derived world placement must be identical, not merely close: it is
        // computed once by the compiler and only read by the browser.
        for (let i = 0; i < 3; i++) {
          assert.equal(node.world.translation[i], source.world.translation[i],
            `${node.pid} world translation ${i}`);
          assert.equal(node.world.scale[i], source.world.scale[i]);
        }
        for (let i = 0; i < 4; i++) {
          assert.equal(node.world.rotation[i], source.world.rotation[i]);
        }
      }

      // Nested assemblies really did survive to the browser.
      assert.ok(hierarchy.some((n) => n.depth >= 3), 'deep nesting must be present');
    });

    await t.test('renderer objects sit where the composed world transform says', async () => {
      // The renderer must place objects from the DERIVED world transform. If it
      // used local transforms, a child of a raised assembly would sit on the
      // floor instead.
      const placements = await page.evaluate(() => {
        const lab = window.__SCENE_LAB__;
        return ['doorway.frame.left', 'doorway.leaf', 'props.console.screen'].map((pid) => {
          const object = lab.presentation.objectFor(pid);
          const node = lab.instance.nodeFor(pid);
          return {
            pid,
            object: object ? [object.position.x, object.position.y, object.position.z] : null,
            world: [...node.world.translation],
            userDataPid: object?.userData?.scenePid ?? null,
            localY: node.local.translation[1]
          };
        });
      });

      for (const p of placements) {
        assert.ok(p.object, `${p.pid} must have a renderer object`);
        assert.equal(p.userDataPid, p.pid, 'renderer objects carry scene identity');
        for (let i = 0; i < 3; i++) {
          assert.ok(Math.abs(p.object[i] - p.world[i]) < 1e-6,
            `${p.pid} axis ${i}: rendered ${p.object[i]} vs composed ${p.world[i]}`);
        }
      }

      // The frame post is authored at local y = 0 but must render well above
      // the floor, because its parent assembly is raised.
      const post = placements.find((p) => p.pid === 'doorway.frame.left');
      assert.equal(post.localY, 0);
      assert.ok(post.object[1] > 1.0,
        `a child of a raised assembly must render raised, got y=${post.object[1]}`);
    });

    await t.test('repeated assets share one uploaded geometry', async () => {
      const stats = await page.evaluate(() => window.__SCENE_LAB__.presentationStats());
      assert.ok(stats.geometryCount < stats.objectCount,
        `repeated placements must share geometry: ${stats.geometryCount} geometries for ${stats.objectCount} objects`);
      assert.ok(stats.geometryCount > 0);
    });

    await t.test('unload removes the scene and reload rebuilds it', async () => {
      const before = await page.evaluate(() => {
        const lab = window.__SCENE_LAB__;
        return {
          loaded: lab.loaded,
          objects: lab.presentationStats().objectCount,
          handles: lab.hierarchy().map((n) => `${n.pid}@${n.handle.index}:${n.handle.generation}`),
          liveInstances: lab.liveInstances,
          livePresentations: lab.livePresentations,
          worldEntities: lab.worldEntityCount
        };
      });
      assert.equal(before.loaded, true);
      assert.equal(before.worldEntities, expected.nodeCount);

      const unloaded = await page.evaluate(() => {
        window.__SCENE_LAB__.unload();
        const lab = window.__SCENE_LAB__;
        return {
          loaded: lab.loaded,
          objects: lab.presentationStats().objectCount,
          rootChildren: lab.presentationStats().rootChildren,
          hierarchy: lab.hierarchy().length,
          liveInstances: lab.liveInstances,
          livePresentations: lab.livePresentations,
          worldEntities: lab.worldEntityCount,
          emptyMessage: document.querySelector('#scene-tree')?.textContent ?? ''
        };
      });
      assert.equal(unloaded.loaded, false, 'the scene must actually unload');
      assert.equal(unloaded.objects, 0, 'renderer objects must be released');
      assert.equal(unloaded.worldEntities, 0,
        'unloading must despawn the scene entities from the runtime world');
      assert.equal(unloaded.hierarchy, 0, 'no runtime hierarchy may survive an unload');
      assert.equal(unloaded.liveInstances, before.liveInstances - 1);
      assert.equal(unloaded.livePresentations, before.livePresentations - 1);
      assert.match(unloaded.emptyMessage, /unloaded/i, 'the human must see that it is gone');

      const reloaded = await page.evaluate(() => {
        window.__SCENE_LAB__.load();
        const lab = window.__SCENE_LAB__;
        return {
          loaded: lab.loaded,
          objects: lab.presentationStats().objectCount,
          identity: lab.identity(),
          handles: lab.hierarchy().map((n) => `${n.pid}@${n.handle.index}:${n.handle.generation}`),
          pids: lab.hierarchy().map((n) => n.pid),
          liveInstances: lab.liveInstances,
          livePresentations: lab.livePresentations
        };
      });

      assert.equal(reloaded.loaded, true);
      assert.equal(reloaded.objects, before.objects, 'the same composition must come back');
      assert.equal(reloaded.liveInstances, before.liveInstances);
      assert.equal(reloaded.livePresentations, before.livePresentations);

      // Persistent identity survives; runtime identity does not.
      assert.deepEqual(reloaded.pids, [...expected.order],
        'persistent authored ids must be identical after a reload');
      assert.equal(reloaded.identity.sourceHash, expected.sourceHash,
        'source identity is untouched by lifecycle');
      assert.notDeepEqual(reloaded.handles, before.handles,
        'runtime handles must be newly allocated after a reload');
    });

    await t.test('repeated lifecycle cycles accumulate nothing', async () => {
      const result = await page.evaluate(() => {
        const lab = window.__SCENE_LAB__;
        const baseline = {
          objects: lab.presentationStats().objectCount,
          geometries: lab.presentationStats().geometryCount,
          sceneChildren: lab.presentationStats().sceneChildren,
          liveInstances: lab.liveInstances,
          livePresentations: lab.livePresentations
        };
        const samples = [];
        for (let i = 0; i < 5; i++) {
          lab.reload();
          const s = lab.presentationStats();
          samples.push({
            objects: s.objectCount,
            geometries: s.geometryCount,
            sceneChildren: s.sceneChildren,
            liveInstances: lab.liveInstances,
            livePresentations: lab.livePresentations
          });
        }
        return { baseline, samples, cycles: lab.lifecycleCycles };
      });

      // Five full unload/reload cycles must leave every count where it started.
      for (const [i, sample] of result.samples.entries()) {
        assert.deepEqual(sample, result.baseline,
          `cycle ${i + 1} changed resource counts: ${JSON.stringify(sample)}`);
      }
      assert.ok(result.cycles >= 5);
    });

    await t.test('the page schedules no permanent animation frame', async () => {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const idle = await page.evaluate(() => window.__SCENE_LAB__.frameScheduled);
      assert.equal(idle, false,
        'the viewer must render on demand; a permanent RAF burns a frame budget forever');
    });

    await t.test('the hierarchy panel shows the human what the engine holds', async () => {
      const panel = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#scene-tree .scene-node')];
        return {
          rows: rows.length,
          depths: [...new Set(rows.map((r) => r.dataset.depth))].sort(),
          firstPid: rows[0]?.querySelector('.scene-node-pid')?.textContent ?? null,
          identityText: document.querySelector('#scene-identity')?.textContent ?? ''
        };
      });
      assert.equal(panel.rows, expected.nodeCount, 'every authored node must be inspectable');
      assert.ok(panel.depths.length >= 3, 'nesting must be visible, not flattened');
      assert.equal(panel.firstPid, expected.order[0]);
      assert.ok(panel.identityText.includes(expected.sourceHash),
        'the human must be able to read the scene source hash');
    });

    await t.test('same-page recreation disposes everything the first viewer owned', async () => {
      const result = await page.evaluate(() => {
        const before = {
          liveInstances: window.__SCENE_LAB__.liveInstances,
          livePresentations: window.__SCENE_LAB__.livePresentations
        };
        const next = window.__SCENE_RECREATE__();
        return {
          before,
          after: { liveInstances: next.liveInstances, livePresentations: next.livePresentations },
          loaded: next.loaded,
          canvases: document.querySelectorAll('#scene-stage canvas').length,
          identity: next.identity()
        };
      });

      // A page reload discards the whole JavaScript world and so proves
      // nothing. Recreating within one page is the real test.
      assert.deepEqual(result.after, result.before,
        'recreation must not accumulate instances or presentations');
      assert.equal(result.loaded, true);
      assert.equal(result.canvases, 1, 'the old canvas must be gone');
      assert.equal(result.identity.sourceHash, expected.sourceHash);
    });

    await t.test('dispose releases everything and is safe to repeat', async () => {
      const result = await page.evaluate(() => {
        const lab = window.__SCENE_LAB__;
        lab.dispose();
        let threw = false;
        try { lab.dispose(); } catch { threw = true; }
        return {
          disposed: lab.disposed,
          doubleDisposeThrew: threw,
          liveInstances: lab.liveInstances,
          livePresentations: lab.livePresentations,
          canvases: document.querySelectorAll('#scene-stage canvas').length,
          globalCleared: window.__SCENE_LAB__ === undefined
        };
      });
      assert.equal(result.disposed, true);
      assert.equal(result.doubleDisposeThrew, false, 'double dispose must be safe');
      assert.equal(result.liveInstances, 0, 'no scene instance may survive dispose');
      assert.equal(result.livePresentations, 0, 'no presentation may survive dispose');
      assert.equal(result.canvases, 0);
      assert.equal(result.globalCleared, true);
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
