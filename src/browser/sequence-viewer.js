/**
 * Order Five browser viewer. HUD reads game truth; it does not author it.
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 */

import { createSequenceGame } from '../games/sequence/game.js';
import { createSequenceRenderer } from '../games/sequence/renderer.js';
import './sequence.css';

export function createSequenceViewer(app, { controlled = false } = {}) {
  document.documentElement.classList.add('sequence-mode');
  document.body.classList.add('sequence-mode');
  app.classList.add('sequence-root');
  app.innerHTML = `
    <div class="sequence-stage">
      <div id="sequence-canvas"></div>
      <div class="sequence-hud">
        <div class="sequence-card">
          <div class="sequence-label">State</div>
          <div id="sequence-state" class="sequence-value">READY</div>
        </div>
        <div class="sequence-card">
          <div class="sequence-label">Objective</div>
          <div id="sequence-objective" class="sequence-value">Collect relic 1</div>
        </div>
        <div class="sequence-card">
          <div class="sequence-label">Collected</div>
          <div id="sequence-collected" class="sequence-value">0 / 5</div>
        </div>
        <div class="sequence-card">
          <div class="sequence-label">Time</div>
          <div id="sequence-time" class="sequence-value">0.00 s</div>
        </div>
      </div>
      <div class="sequence-brand">ORDER FIVE<span>Collect relics 1-5 in order, then enter the exit</span></div>
      <div class="sequence-controls">
        WASD / arrows or left stick to move<br>
        R / Y to reset attempt
        <div id="sequence-controller" class="sequence-controller"></div>
      </div>
    </div>
  `;

  const container = app.querySelector('#sequence-canvas');
  const game = createSequenceGame({ env: 'browser' });
  const view = createSequenceRenderer(container, game);

  if (controlled) {
    game.input.setGamepad({ connected: true, axes: [], buttons: [] });
  }

  const hud = {
    state: app.querySelector('#sequence-state'),
    objective: app.querySelector('#sequence-objective'),
    collected: app.querySelector('#sequence-collected'),
    time: app.querySelector('#sequence-time'),
    controller: app.querySelector('#sequence-controller')
  };

  function updateHUD() {
    const snap = game.snapshot();
    hud.state.textContent = snap.status;
    hud.state.classList.toggle('complete', snap.status === 'COMPLETE');
    hud.objective.textContent = snap.objective;
    hud.collected.textContent = `${snap.collected} / 5`;
    hud.time.textContent = `${snap.time.toFixed(2)} s`;
    const pad = game.input.getGamepadStatus();
    hud.controller.textContent = controlled
      ? 'CONTROLLED RUN'
      : pad.detected && pad.connected
        ? 'CONTROLLER CONNECTED'
        : 'KEYBOARD · press a controller button to connect';
  }

  let frame = null;
  let last = performance.now();
  let disposed = false;

  function loop(now) {
    if (disposed) return;
    const raw = now - last;
    last = now;
    const { alpha } = game.clock.advance(raw, (dt) => game.step(dt));
    view.render(alpha);
    updateHUD();
    frame = requestAnimationFrame(loop);
  }

  const resize = () => view.resize();
  const blur = () => game.input.clear();
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener('resize', resize);

  if (!controlled) {
    game.input.attach(window);
    window.addEventListener('blur', blur);
    frame = requestAnimationFrame(loop);
  } else {
    game.step();
    view.render(1);
  }

  updateHUD();

  const bridge = {
    game,
    view,
    controlled,
    snapshot: () => game.snapshot(),
    step() {
      game.step();
      view.render(1);
      updateHUD();
      return game.snapshot();
    },
    dispose
  };

  window.__ORDER_FIVE__ = bridge;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('blur', blur);
    game.input.detach(window);
    view.dispose();
    game.dispose();
    if (window.__ORDER_FIVE__ === bridge) {
      delete window.__ORDER_FIVE__;
    }
    app.classList.remove('sequence-root');
    document.body.classList.remove('sequence-mode');
    document.documentElement.classList.remove('sequence-mode');
    app.replaceChildren();
  }

  return bridge;
}
