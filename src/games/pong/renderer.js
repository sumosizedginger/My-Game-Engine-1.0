/**
 * My Game Engine 1.0 — Proof A Pong Canvas & DOM Renderer
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Renders the Pong court on Canvas2D with interpolated transforms
 * and synchronizes live score and match status to the DOM HUD.
 * Follows GAMEPLAY_FOUNDATION.md §9.
 */

/**
 * Creates a Pong renderer.
 *
 * @param {object} options
 * @param {HTMLCanvasElement} [options.canvas] - Court canvas.
 * @param {HTMLElement} [options.hudElement] - Container element for DOM HUD.
 * @param {object} options.arena - Arena dimensions.
 * @returns {object} Renderer interface.
 */
export function createPongRenderer({
  canvas = null,
  hudElement = null,
  arena = { width: 800, height: 500, minX: -400, maxX: 400, minY: -250, maxY: 250 }
} = {}) {
  const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

  // Initialize DOM HUD if provided
  if (hudElement) {
    hudElement.innerHTML = `
      <div id="pong-hud" style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 48px;">
          <div style="text-align: center;">
            <div style="font-size: 13px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">Player (P1)</div>
            <div id="p1-score" style="font-size: 44px; font-weight: 800; color: #f8fafc; line-height: 1;">0</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <span id="match-status-badge" style="font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 9999px; background: #1e293b; color: #38bdf8; border: 1px solid #334155; text-transform: uppercase; letter-spacing: 0.05em;">
              SERVE
            </span>
            <span id="target-score-label" style="font-size: 11px; color: #64748b;">First to 5</span>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 13px; font-weight: 600; color: #f43f5e; text-transform: uppercase; letter-spacing: 0.05em;">Engine AI (P2)</div>
            <div id="p2-score" style="font-size: 44px; font-weight: 800; color: #f8fafc; line-height: 1;">0</div>
          </div>
        </div>
      </div>
    `;
  }

  // Helper: map court coordinates (-400..400, -250..250) to canvas pixel space (0..800, 0..500)
  // In our court, positive Y is UP. On Canvas, positive Y is DOWN.
  const originX = arena.width / 2;
  const originY = arena.height / 2;

  function toScreenX(courtX) {
    return originX + courtX;
  }

  function toScreenY(courtY) {
    return originY - courtY;
  }

  return {
    /**
     * Updates DOM HUD with latest game state.
     *
     * @param {object} state - { status, scoreP1, scoreP2, maxScore }
     */
    updateHUD({ status, scoreP1 = 0, scoreP2 = 0, maxScore = 5 } = {}) {
      if (!hudElement) return;

      const p1El = hudElement.querySelector('#p1-score');
      const p2El = hudElement.querySelector('#p2-score');
      const badgeEl = hudElement.querySelector('#match-status-badge');

      if (p1El) p1El.textContent = String(scoreP1);
      if (p2El) p2El.textContent = String(scoreP2);
      if (badgeEl) {
        badgeEl.textContent = status;
        if (status === 'GAME_OVER') {
          const winner = scoreP1 >= maxScore ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS';
          badgeEl.textContent = winner;
          badgeEl.style.background = scoreP1 >= maxScore ? '#166534' : '#881337';
          badgeEl.style.color = scoreP1 >= maxScore ? '#4ade80' : '#fda4af';
          badgeEl.style.borderColor = scoreP1 >= maxScore ? '#22c55e' : '#e11d48';
        } else if (status === 'PAUSED') {
          badgeEl.style.background = '#854d0e';
          badgeEl.style.color = '#fde047';
          badgeEl.style.borderColor = '#ca8a04';
        } else {
          badgeEl.style.background = '#1e293b';
          badgeEl.style.color = '#38bdf8';
          badgeEl.style.borderColor = '#334155';
        }
      }
    },

    /**
     * Renders a frame on the canvas.
     *
     * @param {object} scene - Scene objects with interpolated transforms.
     * @param {number} [alpha=1.0] - Interpolation factor.
     */
    render(scene, alpha = 1.0) {
      if (!ctx || !canvas) return;

      const { playerPaddle, opponentPaddle, ball } = scene;

      // 1. Clear background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, arena.width, arena.height);

      // 2. Arena border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, arena.width - 4, arena.height - 4);

      // 3. Center net dashed line
      ctx.beginPath();
      ctx.setLineDash([10, 10]);
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, arena.height);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Helper for interpolated position
      function getInterp(t) {
        if (!t) return { x: 0, y: 0 };
        const px = t.previousPosition ? t.previousPosition.x : t.position.x;
        const py = t.previousPosition ? t.previousPosition.y : t.position.y;
        return {
          x: px + (t.position.x - px) * alpha,
          y: py + (t.position.y - py) * alpha
        };
      }

      // 5. Draw Player Paddle (Left)
      if (playerPaddle) {
        const pos = getInterp(playerPaddle.transform);
        const w = playerPaddle.halfWidth * 2;
        const h = playerPaddle.halfHeight * 2;
        const sx = toScreenX(pos.x) - playerPaddle.halfWidth;
        const sy = toScreenY(pos.y) - playerPaddle.halfHeight;

        ctx.fillStyle = playerPaddle.color || '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(sx, sy, w, h, 4);
        ctx.fill();
      }

      // 6. Draw Opponent Paddle (Right)
      if (opponentPaddle) {
        const pos = getInterp(opponentPaddle.transform);
        const w = opponentPaddle.halfWidth * 2;
        const h = opponentPaddle.halfHeight * 2;
        const sx = toScreenX(pos.x) - opponentPaddle.halfWidth;
        const sy = toScreenY(pos.y) - opponentPaddle.halfHeight;

        ctx.fillStyle = opponentPaddle.color || '#f43f5e';
        ctx.beginPath();
        ctx.roundRect(sx, sy, w, h, 4);
        ctx.fill();
      }

      // 7. Draw Ball
      if (ball) {
        const pos = getInterp(ball.transform);
        const sx = toScreenX(pos.x);
        const sy = toScreenY(pos.y);
        const r = ball.radius || 7;

        ctx.fillStyle = ball.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
}
