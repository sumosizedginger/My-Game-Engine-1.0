/** Live-only DOM HUD. Controlled captures keep their original template in main.js. */
export function createB2LivePresentation() {
  return `
    <main class="b2-live-game" aria-label="Proof B2 combat room">
      <div id="b2-canvas-container"></div>
      <details class="b2-proof-menu b2-panel">
        <summary>My Game Engine · B2</summary>
        <nav aria-label="Proof navigation">
          <a href="/?proof=b2">Restart Combat Room</a>
          <a href="/?proof=b1">Proof B1 (Motion)</a>
          <a href="/?game=pong">Proof A (Pong)</a>
          <a href="/?proof=phase0">Phase 0 Boot</a>
        </nav>
        <p>Move: WASD / Arrows / Left Stick / D-Pad<br>
          Strike: Space / J / South (A)<br>
          Reset: R / North (Y)</p>
      </details>
      <div id="b2-status-banner" class="b2-panel" role="status">READY</div>
      <section class="b2-health b2-player-health b2-panel" aria-label="Player health">
        <div class="b2-health-label"><span>PLAYER · BLUE</span><span id="b2-player-hp-text">100 / 100</span></div>
        <div class="b2-health-track"><div id="b2-player-hp-bar"></div></div>
      </section>
      <section class="b2-health b2-enemy-health b2-panel" aria-label="Enemy health">
        <div class="b2-health-label"><span>ENEMY · CRIMSON</span><span id="b2-enemy-hp-text">100 / 100</span></div>
        <div class="b2-health-track"><div id="b2-enemy-hp-bar"></div></div>
      </section>
      <div id="b2-controller-diagnostic" class="b2-panel">
        <div>Controller: <span id="b2-diag-status">Checking browser devices...</span></div>
        <div id="b2-diag-actions"></div>
        <div class="b2-input-hint">WASD / Arrows: move · Space / J: strike · R: reset</div>
      </div>
      <aside class="b2-telemetry b2-panel" aria-label="Combat telemetry">
        <span id="b2-stat-hits">Hits: 0 | Dmg: 0</span>
        <span id="b2-stat-enemy-state">AI: IDLE</span>
      </aside>
    </main>
  `;
}
