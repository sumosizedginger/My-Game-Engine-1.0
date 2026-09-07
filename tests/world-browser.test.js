import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { findBrowserExecutable } from '../src/eval/browser.js';
import { runEvaluation } from '../src/eval/harness.js';
import { C_CHECKS } from '../src/eval/c-checks.js';

test('Proof C live, controlled, lifecycle and evaluator browser contracts', async t => {
  const fake = { success: false, checks: Object.fromEntries(C_CHECKS.map(k => [k, true])) };
  const server = await createServer({ cacheDir:'artifacts/proof-c/vite-test-cache', server: { port: 0, host: '127.0.0.1' }, plugins: [{ name:'c-failed-proof-test', configureServer(s) {
    s.middlewares.use('/failed-proof', (_req,res) => { res.setHeader('Content-Type','text/html'); res.end(`<script>window.__PROOF_C_WORLD__={runProof:()=>(${JSON.stringify(fake)})}</script>`); });
  } }] });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: findBrowserExecutable(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await t.test('live viewport, buffer, aspect and overlays respond to resize and capped DPR', async () => {
      await page.goto(`${url}/?proof=c`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__PROOF_C_WORLD__);
      for (const [width, height, deviceScaleFactor] of [[1920,1080,1], [2560,1440,1], [1024,768,1], [390,844,1], [1280,720,3]]) {
        await page.setViewport({ width, height, deviceScaleFactor });
        await page.waitForFunction((w, h) => { const b = window.__PROOF_C_WORLD__; return b.view.camera.aspect === w/h && b.view.renderer.domElement.width === w*Math.min(devicePixelRatio,2); }, {}, width, height);
        const state = await page.evaluate(() => {
          const b = window.__PROOF_C_WORLD__, c = b.view.renderer.domElement, r = c.getBoundingClientRect();
          return { rect: [r.x,r.y,r.width,r.height], buffer: [c.width,c.height], overlay: getComputedStyle(document.querySelector('#c-hud')).position,
            controlled: b.controlled, scroll: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
        });
        assert.deepEqual(state.rect, [0,0,width,height]);
        assert.deepEqual(state.buffer, [width*Math.min(deviceScaleFactor,2),height*Math.min(deviceScaleFactor,2)]);
        assert.equal(state.overlay, 'absolute'); assert.equal(state.controlled, false); assert.equal(state.scroll, false);
      }
    });
    await t.test('real browser keyboard drives semantic traversal', async () => {
      await page.setViewport({ width:1280,height:720,deviceScaleFactor:1 });
      const z = await page.evaluate(() => window.__PROOF_C_WORLD__.game.transform.position.z);
      await page.keyboard.down('w');
      await page.waitForFunction(start => window.__PROOF_C_WORLD__.game.transform.position.z < start - 0.15, {}, z);
      await page.keyboard.up('w');
    });
    await t.test('controlled sequence passes using actual instance transforms and fixed camera', async () => {
      await page.goto(`${url}/?proof=c&controlled=1`, { waitUntil:'load' });
      await page.waitForFunction(() => window.__PROOF_C_WORLD__);
      const result = await page.evaluate(async () => {
        const b = window.__PROOF_C_WORLD__, camera = b.view.camera.position.toArray();
        const proof = await b.runProof();
        return { proof, camera, after:b.view.camera.position.toArray(), controlled:b.controlled };
      });
      assert.equal(result.proof.success, true, JSON.stringify(result.proof)); assert.equal(result.controlled, true);
      assert.deepEqual(result.camera, result.after);
    });
    await t.test('live camera avoids a generated solid trunk on the second seed', async () => {
      await page.goto(`${url}/?proof=c&seed=87123`);
      await page.waitForFunction(() => window.__PROOF_C_WORLD__?.view.presentation.overhead === true);
      const blocked = await page.evaluate(async () => {
        const { Raycaster, Vector3 } = await import('/node_modules/three/build/three.module.js');
        const b = window.__PROOF_C_WORLD__, target = b.game.character.mesh.position.clone().add(new Vector3(0,1,0));
        const direction = target.clone().sub(b.view.camera.position), distance = direction.length();
        const ray = new Raycaster(b.view.camera.position,direction.normalize(),0,distance);
        return ray.intersectObject(b.view.trunks).length > 0;
      });
      assert.equal(blocked,false);
    });
    await t.test('destroy/recreate releases world, renderer resources, observers and input listeners', async () => {
      const result = await page.evaluate(async () => {
        window.__PROOF_C_WORLD__.dispose();
        const add = window.addEventListener, remove = window.removeEventListener, OriginalObserver = window.ResizeObserver;
        let observers = 0; const active = new Map();
        window.addEventListener = function(type, fn, ...rest) { if (!active.has(type)) active.set(type,new Set()); active.get(type).add(fn); return add.call(this,type,fn,...rest); };
        window.removeEventListener = function(type,fn,...rest) { active.get(type)?.delete(fn); return remove.call(this,type,fn,...rest); };
        window.ResizeObserver = class extends OriginalObserver { constructor(fn) { super(fn); observers++; } disconnect() { observers--; super.disconnect(); } };
        const { createCViewer } = await import('/src/browser/c-viewer.js');
        const b = createCViewer(document.querySelector('#app'));
        const geometry = new Set(), material = new Set();
        b.view.scene.traverse(o => { if(o.geometry) geometry.add(o.geometry); if(o.material) material.add(o.material); });
        let disposed = 0;
        for (const r of [...geometry,...material]) r.addEventListener('dispose',()=>disposed++);
        b.dispose(); b.dispose();
        const result = { expected:geometry.size+material.size, disposed, observers, listeners:[...active.values()].reduce((n,s)=>n+s.size,0),
          canvas:document.querySelectorAll('canvas').length, bridge:Boolean(window.__PROOF_C_WORLD__), bodyClass:document.body.classList.contains('c-mode') };
        window.addEventListener = add; window.removeEventListener = remove; window.ResizeObserver = OriginalObserver;
        return result;
      });
      assert.equal(result.disposed,result.expected); assert.equal(result.observers,0); assert.equal(result.listeners,0);
      assert.equal(result.canvas,0); assert.equal(result.bridge,false); assert.equal(result.bodyClass,false);
    });
    await t.test('real evaluator returns FAIL when page summary fails with all named checks true', async () => {
      const report = await runEvaluation({ url:`${url}/failed-proof?proof=c&controlled=1`,outputDir:'artifacts/proof-c/failure-sensitivity' });
      for (const key of C_CHECKS) assert.equal(report.checks[key],true);
      assert.equal(report.checks.cPageProofSuccess,false); assert.equal(report.status,'FAIL');
    });
    await t.test('Pong route does not fetch world generation or C rendering modules', async () => {
      const pong = await browser.newPage(), requests = [];
      pong.on('request',r=>requests.push(r.url()));
      await pong.goto(`${url}/?game=pong&controlled=1`, { waitUntil:'networkidle0' });
      assert.ok(await pong.evaluate(()=>Boolean(window.__PROOF_A_PONG__)));
      assert.equal(requests.some(r=>/\/src\/(world\/|games\/world\/|browser\/c-viewer)/.test(r)),false);
      await pong.close();
    });
    assert.deepEqual(errors,[]);
  } finally { await browser?.close(); await server.close(); }
});
