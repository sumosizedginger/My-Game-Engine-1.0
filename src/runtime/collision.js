/**
 * My Game Engine 1.0 — Deterministic 2D Collision
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Provides deterministic AABB and boundary collision resolution without physics engines.
 * Follows GAMEPLAY_FOUNDATION.md §6.
 */

/**
 * Checks if two 2D boxes intersect.
 *
 * @param {object} a - Box { x, y, halfWidth, halfHeight }
 * @param {object} b - Box { x, y, halfWidth, halfHeight }
 * @returns {boolean} True if intersecting.
 */
export function checkAABB(a, b) {
  return (
    Math.abs(a.x - b.x) <= a.halfWidth + b.halfWidth &&
    Math.abs(a.y - b.y) <= a.halfHeight + b.halfHeight
  );
}

/**
 * Creates a deterministic collision system.
 *
 * @returns {object} Collision system interface.
 */
export function createCollisionSystem() {
  return {
    /**
     * Clamps a kinematic paddle within top/bottom arena bounds.
     *
     * @param {object} paddleTransform - Transform object { position }
     * @param {number} halfHeight - Paddle half height
     * @param {object} arena - Arena bounds { minY, maxY }
     */
    clampPaddleToBounds(paddleTransform, halfHeight, arena) {
      const minY = arena.minY + halfHeight;
      const maxY = arena.maxY - halfHeight;

      if (paddleTransform.position.y < minY) {
        paddleTransform.position.y = minY;
      } else if (paddleTransform.position.y > maxY) {
        paddleTransform.position.y = maxY;
      }
    },

    /**
     * Tests and resolves ball collision with top/bottom arena walls.
     *
     * @param {object} ballTransform - Transform object { position, velocity }
     * @param {number} radius - Ball radius / halfSize
     * @param {object} arena - Arena bounds { minY, maxY }
     * @returns {boolean} True if bounced off wall.
     */
    resolveArenaWalls(ballTransform, radius, arena) {
      const top = arena.maxY - radius;
      const bottom = arena.minY + radius;

      if (ballTransform.position.y >= top && ballTransform.velocity.y > 0) {
        ballTransform.position.y = top;
        ballTransform.velocity.y = -Math.abs(ballTransform.velocity.y);
        return true;
      }
      if (ballTransform.position.y <= bottom && ballTransform.velocity.y < 0) {
        ballTransform.position.y = bottom;
        ballTransform.velocity.y = Math.abs(ballTransform.velocity.y);
        return true;
      }
      return false;
    },

    /**
     * Resolves collision between ball and paddle.
     *
     * @param {object} ballTransform - Ball transform
     * @param {object} ballBox - { halfWidth, halfHeight }
     * @param {object} paddleTransform - Paddle transform
     * @param {object} paddleBox - { halfWidth, halfHeight }
     * @param {string} side - 'left' (player) or 'right' (opponent)
     * @returns {object|null} Collision info or null if no hit.
     */
    resolvePaddleCollision(ballTransform, ballBox, paddleTransform, paddleBox, side) {
      const bBox = {
        x: ballTransform.position.x,
        y: ballTransform.position.y,
        halfWidth: ballBox.halfWidth,
        halfHeight: ballBox.halfHeight
      };

      const pBox = {
        x: paddleTransform.position.x,
        y: paddleTransform.position.y,
        halfWidth: paddleBox.halfWidth,
        halfHeight: paddleBox.halfHeight
      };

      if (!checkAABB(bBox, pBox)) {
        return null;
      }

      // Determine bounce direction
      const isLeft = side === 'left';
      // Only bounce if moving toward the paddle
      if (isLeft && ballTransform.velocity.x >= 0) return null;
      if (!isLeft && ballTransform.velocity.x <= 0) return null;

      // Position ball immediately outside paddle
      if (isLeft) {
        ballTransform.position.x = paddleTransform.position.x + paddleBox.halfWidth + ballBox.halfWidth;
      } else {
        ballTransform.position.x = paddleTransform.position.x - paddleBox.halfWidth - ballBox.halfWidth;
      }

      // Deflection: offset from paddle center (-1.0 to +1.0)
      const relativeOffset = (ballTransform.position.y - paddleTransform.position.y) / paddleBox.halfHeight;
      const clampedOffset = Math.max(-1.0, Math.min(1.0, relativeOffset));

      // Calculate speed and new angle
      const speed = Math.hypot(ballTransform.velocity.x, ballTransform.velocity.y);
      const acceleratedSpeed = Math.min(speed * 1.05, 800); // capped max speed

      const maxAngle = (Math.PI / 4); // 45 degrees
      const bounceAngle = clampedOffset * maxAngle;

      const directionX = isLeft ? 1 : -1;
      ballTransform.velocity.x = directionX * acceleratedSpeed * Math.cos(bounceAngle);
      ballTransform.velocity.y = acceleratedSpeed * Math.sin(bounceAngle);

      return {
        collided: true,
        side,
        offset: clampedOffset,
        speed: acceleratedSpeed
      };
    },

    /**
     * Checks if ball crossed left or right goal line.
     *
     * @param {object} ballTransform - Ball transform
     * @param {object} arena - Arena bounds { minX, maxX }
     * @returns {string|null} 'left' if left player missed, 'right' if right player missed, or null.
     */
    checkGoal(ballTransform, arena) {
      if (ballTransform.position.x < arena.minX) {
        return 'left';
      }
      if (ballTransform.position.x > arena.maxX) {
        return 'right';
      }
      return null;
    }
  };
}
