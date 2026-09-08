import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';

test('B1 character replacement and viewer teardown release owned resources and listeners', async () => {
  const server = await createServer({ cacheDir: 'artifacts/b1-lifecycle/test-cache', server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: findBrowserExecutable(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?controlled=1`);
    await page.evaluate(async () => { window.createViewer = (await import('/src/browser/b1-viewer.js')).createB1Viewer; });
    const threeUrl = requests.find(url => /\/three\.js\?/.test(url));
    assert.ok(threeUrl);
    const result = await page.evaluate(async (threeUrl) => {
      const { Scene } = await import(threeUrl);
      const resources = new Map(), renderers = new Map(), listeners = [], calls = {};
      let scene, camera;
      function track(resource) {
        if (!resource || resources.has(resource)) return;
        resources.set(resource, 0);
        const original = resource.dispose;
        resource.dispose = function (...args) { resources.set(resource, resources.get(resource) + 1); return original.apply(this, args); };
      }
      Scene.prototype.onBeforeRender = function (renderer, s, c) {
        scene = s; camera = c;
        if (!renderers.has(renderer)) {
          renderers.set(renderer, 0);
          const original = renderer.dispose;
          renderer.dispose = () => { renderers.set(renderer, renderers.get(renderer) + 1); original.call(renderer); };
        }
        s.traverse(object => {
          track(object.geometry);
          for (const material of (Array.isArray(object.material) ? object.material : [object.material])) track(material);
          if (object.isSkinnedMesh) track(object.skeleton);
        });
      };
      const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
      const types = ['mousedown', 'mouseup', 'mousemove', 'wheel', 'resize'];
      EventTarget.prototype.addEventListener = function (type, fn, options) {
        if (!types.includes(type) || (this !== window && !(this instanceof HTMLCanvasElement))) return add.call(this, type, fn, options);
        const record = { target: this, type, fn, active: true, wrapper(event) { calls[type] = (calls[type] || 0) + 1; return fn.call(this, event); } };
        listeners.push(record); return add.call(this, type, record.wrapper, options);
      };
      EventTarget.prototype.removeEventListener = function (type, fn, options) {
        const record = listeners.find(record => record.active && record.target === this && record.type === type && record.fn === fn);
        if (record) { record.active = false; return remove.call(this, type, record.wrapper, options); }
        return remove.call(this, type, fn, options);
      };
      const container = document.createElement('div'); container.style.cssText = 'width:640px;height:560px'; document.body.append(container);
      const viewer = window.createViewer({ container, isControlled: true });
      const canvas = container.querySelector('canvas');
      const replacement = [];
      for (const preset of ['heavy', 'athletic', 'average', 'heavy']) {
        const retired = scene.children.filter(object => object.isSkinnedMesh || object.isSkeletonHelper);
        const oldResources = [...resources.keys()];
        const currentResources = retired.flatMap(object => [object.geometry, object.material, ...(object.isSkinnedMesh ? [object.skeleton] : [])]);
        viewer.setCharPreset(preset);
        replacement.push({ disposed: currentResources.every(resource => resources.get(resource) === 1), removed: retired.every(object => object.parent === null && !scene.children.includes(object)), liveScene: scene.children.length });
        // Existing scene resources stay alive while the replaced character is released.
        replacement.at(-1).environmentAlive = oldResources.filter(resource => !currentResources.includes(resource) && resources.get(resource) === 0).length > 0;
      }
      const phase = viewer.getPhase(); viewer.step(16.67);
      const motion = { advances: viewer.getPhase() !== phase, bones: viewer.boneCount, normalized: viewer.skinningNormalized, feet: viewer.getRealizedFootPositions() };
      const activeBefore = listeners.filter(record => record.active).length;
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 10 }));
      const cameraMoved = camera.position.x !== 0;
      const reactions = { ...calls }, oldScene = scene;
      viewer.destroy();
      const disposedOnce = [...resources.values()].every(count => count === 1);
      const afterDestroy = { ...calls };
      canvas.dispatchEvent(new MouseEvent('mousedown'));
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 5 }));
      window.dispatchEvent(new MouseEvent('mousemove'));
      window.dispatchEvent(new MouseEvent('mouseup'));
      window.dispatchEvent(new Event('resize'));
      const eventsSilent = JSON.stringify(calls) === JSON.stringify(afterDestroy);
      viewer.destroy();
      const doubleSafe = [...resources.values()].every(count => count === 1) && [...renderers.values()].every(count => count === 1);
      let rejected = false; try { viewer.setCharPreset('average'); } catch { rejected = true; }
      const cleared = !viewer.ready && viewer.characterId === null && viewer.getPhase() === null && viewer.getStats() === null && viewer.getRealizedFootPositions() === null;
      const bridgeRemoved = !window.__PROOF_B1_MOTION__;
      const live = window.createViewer({ container });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const newer = window.createViewer({ container, isControlled: true });
      live.destroy();
      const bridgeOwnership = window.__PROOF_B1_MOTION__ === newer;
      newer.destroy();
      await new Promise(resolve => requestAnimationFrame(resolve));
      return { replacement, motion, activeBefore, cameraMoved, reactions, disposedOnce, eventsSilent, doubleSafe, rejected, cleared, bridgeRemoved, bridgeOwnership,
        activeAfter: listeners.filter(record => record.active).length, emptyScene: oldScene.children.length === 0, canvases: container.querySelectorAll('canvas').length,
        allDisposedOnce: [...resources.values()].every(count => count === 1), renderersDisposedOnce: [...renderers.values()].every(count => count === 1) };
    }, threeUrl);
    assert.ok(result.replacement.every(item => item.disposed && item.removed && item.environmentAlive), JSON.stringify(result));
    assert.ok(result.replacement.every(item => item.liveScene === result.replacement[0].liveScene));
    assert.equal(result.activeBefore, 5);
    assert.equal(result.reactions.mousedown, 1); assert.equal(result.reactions.mousemove, 1);
    assert.equal(result.motion.bones, 22); assert.ok(result.motion.normalized && result.motion.advances);
    assert.ok(Object.values(result.motion.feet).every(foot => Object.values(foot).every(Number.isFinite)));
    for (const key of ['cameraMoved', 'disposedOnce', 'eventsSilent', 'doubleSafe', 'rejected', 'cleared', 'bridgeRemoved', 'bridgeOwnership', 'emptyScene', 'allDisposedOnce', 'renderersDisposedOnce']) assert.equal(result[key], true, key);
    assert.equal(result.activeAfter, 0); assert.equal(result.canvases, 0);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
