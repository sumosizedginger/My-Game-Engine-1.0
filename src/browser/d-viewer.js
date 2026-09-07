import {ArcadeRace} from '../games/racing/game.js';
import {createRacingRenderer} from '../games/racing/renderer.js';
import './d.css';

export function createDViewer(app,{controlled=false}={}) {
  document.documentElement.classList.add('d-mode');document.body.classList.add('d-mode');app.classList.add('d-root');
  app.innerHTML=`<main class="d-race"><div id="d-canvas"></div>
    <div class="d-brand">COPPER LOOP<span>HOVER CIRCUIT / 02 LAPS</span></div>
    <div id="d-progress"></div><div id="d-message"></div>
    <div class="d-bottom"><div id="d-speed"></div><div id="d-time"></div></div>
    <div id="d-controls">W / ↑ accelerate · S / ↓ brake / reverse · A D / ← → steer<br>Q E / right stick: camera · R / Y: restart · Triggers: drive</div>
    <div id="d-controller"></div></main>`;
  const container=app.querySelector('#d-canvas'),game=new ArcadeRace(),view=createRacingRenderer(container,game,controlled);
  // The public injection seam isolates controlled runs from physical controllers,
  // including the legacy boolean Reset binding. Driving still uses semantic values.
  if(controlled)game.input.setGamepad({connected:true,axes:[],buttons:[]});
  const hud={};for(const id of ['progress','message','speed','time','controller'])hud[id]=app.querySelector(`#d-${id}`);
  let frame=null,last=performance.now(),disposed=false;const timings=[];
  function updateHUD() {
    const state=game.snapshot(),finished=state.state==='FINISHED';
    hud.progress.textContent=finished?'2 LAPS · 16 GATES COMPLETE':`LAP ${Math.min(2,state.race.laps+1)} / 2  ·  NEXT ${state.race.next===0?'FINISH':`GATE ${state.race.next}`} `;
    hud.speed.innerHTML=`${Math.round(Math.abs(state.speed)*3.6)}<small> KM/H</small>`;
    hud.time.textContent=`${state.time.toFixed(2)} s`;
    hud.message.textContent=state.state==='READY'?'HOLD THROTTLE TO START':state.state==='COUNTDOWN'?String(Math.ceil(state.countdown/60)):finished?(controlled?'CIRCUIT COMPLETE':'CIRCUIT COMPLETE · R / Y TO RACE AGAIN'):'';
    const pad=game.input.getGamepadStatus();hud.controller.textContent=controlled?'CONTROLLED RUN':pad.detected&&pad.connected?'CONTROLLER CONNECTED':'KEYBOARD · Press a controller button to connect';
  }
  function step(){if(disposed)throw new Error('D_VIEW_DISPOSED');game.update();view.render();updateHUD();return game.snapshot();}
  const bridge={game,view,controlled,timings,step,snapshot:()=>game.snapshot(),dispose};
  if(controlled)bridge.runProof=async()=>{const {runControlledRacingProof}=await import('../games/racing/proof.js');const result=runControlledRacingProof(game,view);updateHUD();bridge.proof=result;return result;};
  window.__PROOF_D_RACING__=bridge;
  function loop(now) {
    if(disposed)return;const raw=now-last;last=now;if(timings.length<1200)timings.push(raw);
    const {alpha}=game.clock.advance(raw,dt=>game.update(dt));view.render(alpha,raw/1000);updateHUD();frame=requestAnimationFrame(loop);
  }
  const resize=()=>view.resize(),blur=()=>game.input.clear();
  const observer=new ResizeObserver(resize);observer.observe(container);window.addEventListener('resize',resize);
  if(!controlled){game.input.attach(window);window.addEventListener('blur',blur);frame=requestAnimationFrame(loop);}
  updateHUD();
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('blur',blur);
    game.input.detach(window);view.dispose();game.dispose();if(window.__PROOF_D_RACING__===bridge)delete window.__PROOF_D_RACING__;
    app.classList.remove('d-root');document.body.classList.remove('d-mode');document.documentElement.classList.remove('d-mode');app.replaceChildren();}
  return bridge;
}
