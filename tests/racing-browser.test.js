import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {findBrowserExecutable} from '../src/eval/browser.js';
import {runEvaluation} from '../src/eval/harness.js';
import {D_CHECKS} from '../src/eval/d-checks.js';

test('Proof D browser play, camera, controller, lifecycle and fail-closed evaluation',async t=>{
  const fake={success:false,checks:Object.fromEntries(D_CHECKS.map(k=>[k,true]))};
  const server=await createServer({cacheDir:'artifacts/proof-d/test-cache',server:{port:0,host:'127.0.0.1'},plugins:[{name:'d-failed-proof',configureServer(s){
    s.middlewares.use('/failed-proof',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<script>window.__PROOF_D_RACING__={runProof:()=>(${JSON.stringify(fake)})}</script>`);});
  }}]});await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}`;let browser;
  try {
    browser=await puppeteer.launch({executablePath:findBrowserExecutable(),headless:true,args:['--no-sandbox','--disable-gpu']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await t.test('live full viewport and capped DPR resize',async()=>{
      await page.goto(`${url}/?proof=d`);await page.waitForFunction(()=>window.__PROOF_D_RACING__);
      for(const [width,height,deviceScaleFactor] of [[1280,720,1],[390,844,1],[1024,768,3]]){
        await page.setViewport({width,height,deviceScaleFactor});
        await page.waitForFunction((w,h)=>{const b=window.__PROOF_D_RACING__;return b.view.camera.aspect===w/h&&b.view.renderer.domElement.width===w*Math.min(devicePixelRatio,2);},{},width,height);
        const rect=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return [r.x,r.y,r.width,r.height,document.documentElement.scrollWidth>innerWidth];});
        assert.deepEqual(rect,[0,0,width,height,false]);
      }
      await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
    });
    await t.test('real keyboard starts countdown, accelerates, steers, brakes, orbits and resets',async()=>{
      await page.keyboard.down('w');await page.waitForFunction(()=>window.__PROOF_D_RACING__.game.speed>5,{timeout:15000});
      const heading=await page.evaluate(()=>window.__PROOF_D_RACING__.game.heading);
      await page.keyboard.down('a');await page.waitForFunction(h=>window.__PROOF_D_RACING__.game.heading>h+0.15,{},heading);await page.keyboard.up('a');await page.keyboard.up('w');
      await page.keyboard.down('s');await page.waitForFunction(()=>window.__PROOF_D_RACING__.game.speed<1);await page.keyboard.up('s');
      await page.keyboard.down('e');await page.waitForFunction(()=>window.__PROOF_D_RACING__.view.policy.orbit>0.2);await page.keyboard.up('e');
      await page.keyboard.down('r');await page.waitForFunction(()=>window.__PROOF_D_RACING__.game.state.getState()==='READY');await page.keyboard.up('r');
      const p=await page.evaluate(()=>window.__PROOF_D_RACING__.snapshot());assert.equal(p.speed,0);assert.equal(p.race.records.length,0);
    });
    await t.test('browser gamepad binding preserves partial trigger and signed stick magnitude',async()=>{
      const result=await page.evaluate(()=>{
        const b=window.__PROOF_D_RACING__;
        b.game.input.setGamepad({connected:true,index:2,axes:[-0.575,0,0.575],buttons:Array.from({length:8},(_,i)=>({pressed:false,value:i===7?0.42:0}))});
        const s=b.game.input.captureSnapshot();b.game.input.setGamepad(null);return s.getAllActionValues();
      });assert.ok(Math.abs(result.Steer+0.5)<1e-10);assert.equal(result.Throttle,0.42);assert.ok(Math.abs(result.CameraOrbit-0.5)<1e-10);
    });
    await t.test('live camera changes without simulation mutation and car fits its collision disk',async()=>{
      const result=await page.evaluate(()=>{
        const b=window.__PROOF_D_RACING__,before=b.snapshot(),camera=b.view.camera.position.toArray();
        b.game.input.simulateActionValue('CameraOrbit',-1);
        for(let i=0;i<90;i++)b.view.render(1,1/60);
        let radius=0;
        b.view.car.children.forEach(m=>{const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i)+m.position.x,p.getZ(i)+m.position.z));});
        b.game.input.clear();return {before,after:b.snapshot(),camera,afterCamera:b.view.camera.position.toArray(),radius};
      });assert.deepEqual(result.before,result.after);assert.notDeepEqual(result.camera,result.afterCamera);assert.ok(result.radius<=1.25);
    });
    await t.test('controlled proof traverses real track with fixed camera and records finish',async()=>{
      await page.goto(`${url}/?proof=d&controlled=1`);await page.waitForFunction(()=>window.__PROOF_D_RACING__);
      const result=await page.evaluate(async()=>{
        let physicalPolls=0;
        Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{physicalPolls++;return [{connected:true,axes:[1,1,1],buttons:Array.from({length:8},()=>({pressed:true,value:1}))}];}});
        const b=window.__PROOF_D_RACING__;b.game.input.simulateActionValue('CameraOrbit',1);
        return {proof:await b.runProof(),physicalPolls};
      });
      assert.equal(result.physicalPolls,0);assert.equal(result.proof.success,true,JSON.stringify(result));assert.equal(result.proof.state.race.records.length,16);
    });
    await t.test('actual page proof detects collision, vehicle and checkpoint failure injections',async()=>{
      for(const failure of ['collision','motion','progress']){
        await page.goto(`${url}/?proof=d&controlled=1`);await page.waitForFunction(()=>window.__PROOF_D_RACING__);
        const result=await page.evaluate(async kind=>{
          const b=window.__PROOF_D_RACING__;
          if(kind==='collision')b.game.track.resolveMovement=(from,to)=>({...to,blocked:false});
          if(kind==='motion')b.game.transforms.commitAll=()=>{};
          if(kind==='progress')b.game.race.next=0;
          return b.runProof();
        },failure);
        assert.equal(result.success,false, failure);assert.equal(result.checks[failure==='collision'?'dBarrierCollision':failure==='motion'?'dVehicleMotion':'dCheckpointProgress'],false);
      }
    });
    await t.test('dispose/recreate releases geometry, materials, observers, listeners and canvas',async()=>{
      const result=await page.evaluate(async()=>{
        window.__PROOF_D_RACING__.dispose();const add=window.addEventListener,remove=window.removeEventListener,Observer=window.ResizeObserver;
        let observers=0;const listeners=new Map();
        window.addEventListener=function(k,fn,...rest){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn);return add.call(this,k,fn,...rest);};
        window.removeEventListener=function(k,fn,...rest){listeners.get(k)?.delete(fn);return remove.call(this,k,fn,...rest);};
        window.ResizeObserver=class extends Observer{constructor(fn){super(fn);observers++;}disconnect(){observers--;super.disconnect();}};
        const {createDViewer}=await import('/src/browser/d-viewer.js');let expected=0,released=0;
        for(let i=0;i<2;i++){
          const b=createDViewer(document.querySelector('#app')),resources=new Set();
          b.view.scene.traverse(o=>{if(o.geometry&&!o.isSprite)resources.add(o.geometry);if(o.material)resources.add(o.material);if(o.material?.map)resources.add(o.material.map);});
          expected+=resources.size;for(const r of resources)r.addEventListener('dispose',()=>released++);
          b.dispose();b.dispose();
        }
        window.addEventListener=add;window.removeEventListener=remove;window.ResizeObserver=Observer;
        return {expected,released,observers,listeners:[...listeners.values()].reduce((n,s)=>n+s.size,0),canvas:document.querySelectorAll('canvas').length,bridge:Boolean(window.__PROOF_D_RACING__)};
      });assert.equal(result.released,result.expected);assert.equal(result.observers,0);assert.equal(result.listeners,0);assert.equal(result.canvas,0);assert.equal(result.bridge,false);
    });
    await t.test('real evaluator fails when page success is false despite all named checks true',async()=>{
      const report=await runEvaluation({url:`${url}/failed-proof?proof=d&controlled=1`,outputDir:'artifacts/proof-d/failure-sensitivity'});
      assert.equal(report.status,'FAIL');assert.equal(report.checks.dPageProofSuccess,false);for(const key of D_CHECKS)assert.equal(report.checks[key],true);
    });
    await t.test('Pong fetches no D project, renderer, stylesheet or driver modules',async()=>{
      const pong=await browser.newPage(),requests=[];pong.on('request',r=>requests.push(r.url()));
      await pong.goto(`${url}/?game=pong&controlled=1`,{waitUntil:'networkidle0'});
      assert.equal(requests.some(r=>/\/games\/racing\/|\/browser\/d-viewer|\/browser\/d\.css/.test(r)),false);await pong.close();
    });
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await server.close();}
});
