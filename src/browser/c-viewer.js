import { WorldTraversal } from '../games/world/traversal.js';
import { createWorldRenderer } from '../games/world/renderer.js';
import './c.css';

export function createCViewer(app, { controlled = false, seed } = {}) {
  app.classList.add('c-root'); document.body.classList.add('c-mode'); document.documentElement.classList.add('c-mode');
  app.innerHTML = `<main class="c-world ${controlled ? 'c-controlled' : 'c-live'}">
    <div id="c-canvas"></div>
    <details class="c-menu"><summary>My Game Engine · World C</summary>
      <nav><a href="/?proof=b2">Combat B2</a> · <a href="/?proof=b1">Motion B1</a> · <a href="/?game=pong">Pong</a></nav>
      <p>WASD / Arrows / Left stick / D-pad: walk<br>R / Y: reset traversal</p>
      <label>World seed <input id="c-seed" type="number" min="0" max="4294967295" value="${seed ?? 87122}"></label>
      <button id="c-regenerate">Generate world</button>
    </details>
    <div class="c-label">BOUNDED FOREST <span>128 m · seed-defined terrain & ecology</span></div>
    <div id="c-hud"></div><div id="c-input">WASD / Arrows: walk · R: reset</div>
  </main>`;
  const game = new WorldTraversal({ seed: controlled ? 87122 : seed });
  const view = createWorldRenderer(document.getElementById('c-canvas'), game, controlled);
  let frame = null, last = performance.now(), disposed = false;
  const timings = [];
  const hud = document.getElementById('c-hud');
  function updateHUD() {
    const p = game.transform.position, s = game.world.fields.sample(p.x, p.z);
    hud.textContent = `Seed ${game.world.recipe.parameters.seed} · ${s.biome}\nHeight ${s.height.toFixed(2)} m · slope ${(Math.atan(s.slope) * 180 / Math.PI).toFixed(1)}°\n${game.world.trees.length} trees · ${game.world.cover.length} grass tufts\nField ${game.world.hashes.fields}\nCanopy cutaway: ${view.presentation.cutawayCount}`;
    if (!controlled) { const gp = game.input.getGamepadStatus(); document.getElementById('c-input').textContent = `WASD / Arrows: walk · R: reset | Controller: ${gp.detected ? gp.id : 'none detected (press a button)'}`; }
  }
  const bridge = { game, view, controlled, timings,
    step() { game.update(1 / 60); view.render(); updateHUD(); return game.snapshot(); },
    simulateAction: (action, active) => game.input.simulateAction(action, active),
    snapshot: () => game.snapshot(), dispose };
  if (controlled) bridge.runProof = async () => {
    const { runControlledWorldProof } = await import('../games/world/proof.js');
    const result = runControlledWorldProof(game, view); updateHUD(); bridge.proof = result; return result;
  };
  window.__PROOF_C_WORLD__ = bridge;
  function loop(now) {
    if (disposed) return;
    const rawDelta = now - last, dt = Math.min(100, rawDelta); last = now;
    if (timings.length < 600) timings.push(rawDelta);
    const { alpha } = game.clock.advance(dt, seconds => game.update(seconds));
    game.renderPose(alpha); view.render(); updateHUD(); frame = requestAnimationFrame(loop);
  }
  const resize = () => view.resize();
  const observer = new ResizeObserver(resize); observer.observe(document.getElementById('c-canvas'));
  window.addEventListener('resize', resize);
  const regenerate = () => { const newSeed = Number(document.getElementById('c-seed').value); dispose(); createCViewer(app, { seed: newSeed }); };
  document.getElementById('c-regenerate').addEventListener('click', regenerate);
  if (!controlled) { game.input.attach(window); frame = requestAnimationFrame(loop); }
  else document.querySelector('.c-menu').hidden = true;
  view.render(); updateHUD();
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener('resize', resize); game.input.detach(window);
    document.getElementById('c-regenerate')?.removeEventListener('click', regenerate);
    view.dispose(); game.dispose();
    if (window.__PROOF_C_WORLD__ === bridge) delete window.__PROOF_C_WORLD__;
    app.classList.remove('c-root'); document.body.classList.remove('c-mode'); document.documentElement.classList.remove('c-mode');
    app.replaceChildren();
  }
  return bridge;
}
