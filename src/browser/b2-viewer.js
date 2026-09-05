/**
 * My Game Engine 1.0 — Proof B2: Combat Room Browser Viewer & Bridge
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Provides interactive gameplay controls, live DOM HUD updates,
 * and the headless evaluation bridge window.__PROOF_B2_COMBAT__.
 * Follows B2 work order and PRD.md §16.5.
 */

import { ArenaCombatGame } from '../games/combat/arena-game.js';
import { createCombatRenderer } from '../games/combat/renderer.js';
import { COMBAT_STATES, ENEMY_AI_STATES } from '../games/combat/definitions.js';

export function createB2Viewer({ container, isControlled = false }) {
  // 1. Instantiate the game coordinator
  const game = new ArenaCombatGame();

  // 2. Instantiate the 3D renderer
  const renderer = createCombatRenderer({ container, game, isControlled });

  // 3. Execution state
  let running = !isControlled;
  let lastTime = performance.now();
  let animationFrameId = null;

  // 4. Expose the Headless Evaluation Bridge
  const b2Bridge = {
    game,
    renderer,
    get isControlled() { return isControlled; },
    get isRunning() { return running; },
    get roomStats() { return game.room.stats; },
    get vertexCount() { return game.room.stats.vertexCount; },
    get triangleCount() { return game.room.stats.triangleCount; },
    get pillarCount() { return game.room.stats.pillarCount; },
    get hasRoomGeometry() { return Boolean(game.room?.visual?.geometry); },
    get hasMaterials() {
      return Boolean(game.player.character?.mesh?.material && game.enemy.character?.mesh?.material);
    },
    get hasCharacters() {
      return Boolean(game.player.character?.skeleton && game.enemy.character?.skeleton);
    },
    getStateSnapshot: () => game.getStateSnapshot(),
    getStats: () => game.getStateSnapshot(),
    triggerAttack: () => {
      game.triggerAttack();
      return game.getStateSnapshot();
    },
    setPlayerVelocity: (vx, vz) => {
      game.player.velocity.x = vx;
      game.player.velocity.z = vz;
      game.player.speed = Math.hypot(vx, vz);
      if (game.player.speed > 0.001) {
        game.player.transform.rotationY = Math.atan2(vx, vz);
        if (game.state === COMBAT_STATES.READY) game.state = COMBAT_STATES.ENGAGED;
      }
    },
    step: (dtMs = 16.666) => {
      const dt = dtMs * 0.001;
      game.update(dt);
      renderer.render();
      updateHUD();
      return game.getStateSnapshot();
    },
    reset: () => {
      game.reset();
      renderer.render();
      updateHUD();
      return game.getStateSnapshot();
    }
  };

  window.__PROOF_B2_COMBAT__ = b2Bridge;

  // Attach input listener in browser environment
  if (typeof window !== 'undefined' && game.input?.attach) {
    game.input.attach(window);
  }

  // 5. HUD update logic
  function updateHUD() {
    const snap = game.getStateSnapshot();

    // Player HP
    const pBar = document.getElementById('b2-player-hp-bar');
    const pText = document.getElementById('b2-player-hp-text');
    if (pBar) {
      const pct = Math.max(0, (snap.player.hp / snap.player.maxHp) * 100);
      pBar.style.width = `${pct}%`;
      pBar.style.backgroundColor = pct > 40 ? '#3b82f6' : pct > 20 ? '#f59e0b' : '#ef4444';
    }
    if (pText) pText.textContent = `${Math.round(snap.player.hp)} / ${snap.player.maxHp}`;

    // Enemy HP
    const eBar = document.getElementById('b2-enemy-hp-bar');
    const eText = document.getElementById('b2-enemy-hp-text');
    if (eBar) {
      const pct = Math.max(0, (snap.enemy.hp / snap.enemy.maxHp) * 100);
      eBar.style.width = `${pct}%`;
      eBar.style.backgroundColor = pct > 40 ? '#ef4444' : pct > 20 ? '#f59e0b' : '#b91c1c';
    }
    if (eText) eText.textContent = `${Math.round(snap.enemy.hp)} / ${snap.enemy.maxHp}`;

    // Status Banner
    const banner = document.getElementById('b2-status-banner');
    if (banner) {
      if (snap.state === COMBAT_STATES.VICTORY) {
        banner.textContent = '🏆 VICTORY — ENEMY DEFEATED';
        banner.style.color = '#10b981';
        banner.style.borderColor = '#10b981';
      } else if (snap.state === COMBAT_STATES.DEFEAT) {
        banner.textContent = '💀 DEFEAT — PLAYER FALLEN';
        banner.style.color = '#ef4444';
        banner.style.borderColor = '#ef4444';
      } else if (snap.state === COMBAT_STATES.ENGAGED) {
        banner.textContent = `⚔️ ENGAGED — ENEMY ${snap.enemy.aiState}`;
        banner.style.color = '#f59e0b';
        banner.style.borderColor = '#f59e0b';
      } else {
        banner.textContent = 'READY — APPROACH ENEMY TO ENGAGE';
        banner.style.color = '#38bdf8';
        banner.style.borderColor = '#334155';
      }
    }

    // Telemetry stats
    const hitsEl = document.getElementById('b2-stat-hits');
    if (hitsEl) {
      hitsEl.textContent = `Hits: ${snap.combatStats.playerHitsLanded} | Dmg: ${snap.combatStats.totalDamageDealt}`;
    }

    const enemyStateEl = document.getElementById('b2-stat-enemy-state');
    if (enemyStateEl) {
      enemyStateEl.textContent = `AI: ${snap.enemy.aiState}`;
    }
  }

  // 6. Window Resize Handler
  function onResize() {
    renderer.resize();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
  }

  // 7. Initial render (ensures scene is drawn immediately)
  renderer.render();
  updateHUD();

  // 8. Game Loop
  function loop(currentTime) {
    if (!running) return;
    const delta = Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;

    // Advance clock accumulator with fixed simulation callback
    game.clock.advance(delta, (fixedDelta) => {
      game.update(fixedDelta);
    });

    renderer.render();
    updateHUD();

    animationFrameId = requestAnimationFrame(loop);
  }

  if (running) {
    animationFrameId = requestAnimationFrame(loop);
  }

  function destroy() {
    running = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
      if (game.input?.detach) {
        game.input.detach(window);
      }
    }
    renderer.destroy();
    if (window.__PROOF_B2_COMBAT__ === b2Bridge) {
      delete window.__PROOF_B2_COMBAT__;
    }
  }

  return {
    game,
    renderer,
    bridge: b2Bridge,
    destroy
  };
}
