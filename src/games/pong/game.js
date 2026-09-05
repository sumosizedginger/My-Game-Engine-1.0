/**
 * My Game Engine 1.0 — Proof A Pong Game Coordinator
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Coordinates entities, transforms, action input, fixed simulation, collision,
 * state machine, and declarative rules to implement the complete Pong proof.
 * Follows GAMEPLAY_FOUNDATION.md and ARCHITECTURE.md §3.
 */

import {
  createRuntime,
  createEntityManager,
  createTransformManager,
  TRANSFORM_OWNERSHIP,
  createSimulationClock,
  createInputSystem,
  createCollisionSystem,
  createStateManager,
  createRuleEngine
} from '../../runtime/index.js';

import { compileDefinition } from '../../full/compiler.js';

import {
  ARENA_DEFINITION,
  PLAYER_PADDLE_DEFINITION,
  OPPONENT_PADDLE_DEFINITION,
  BALL_DEFINITION,
  MATCH_RULES_DEFINITION
} from './definitions.js';

import { createPongRenderer } from './renderer.js';

/**
 * Creates and boots a playable Pong game instance.
 *
 * @param {object} [options={}] - Options.
 * @param {HTMLCanvasElement} [options.canvas] - Court canvas.
 * @param {HTMLElement} [options.hudElement] - Container element for DOM HUD.
 * @param {boolean} [options.autoStart=false] - Whether to start browser animation loop automatically.
 * @returns {object} Game interface.
 */
export function createPongGame(options = {}) {
  // 1. Initialize Engine Runtime Foundation
  const runtime = createRuntime({ env: options.env || 'browser', game: 'pong' });
  const entityManager = createEntityManager();
  const transformManager = createTransformManager(entityManager);
  const clock = createSimulationClock({ tickRate: 60 });
  const input = createInputSystem();
  const collision = createCollisionSystem();
  const state = createStateManager({
    initialState: 'SERVE',
    validStates: ['SERVE', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'PAUSED'],
    initialVars: {
      'score.player1': 0,
      'score.player2': 0,
      'score.max': MATCH_RULES_DEFINITION.data.maxScore,
      'match.winner': null
    }
  });
  const rules = createRuleEngine({ state, entityManager, transformManager, collision });

  // 2. Kiln Seam: Compile definitions to immutable artifacts
  const arenaArtifact = compileDefinition(ARENA_DEFINITION);
  const playerArtifact = compileDefinition(PLAYER_PADDLE_DEFINITION);
  const opponentArtifact = compileDefinition(OPPONENT_PADDLE_DEFINITION);
  const ballArtifact = compileDefinition(BALL_DEFINITION);

  // 3. Runtime Instantiate: Instantiate artifacts into transient runtime objects
  runtime.instantiate(arenaArtifact);
  runtime.instantiate(playerArtifact);
  runtime.instantiate(opponentArtifact);
  runtime.instantiate(ballArtifact);

  // 4. Entity Spawning & Authoritative Transform Setup
  const arena = arenaArtifact.data;

  // Player Paddle Entity
  const playerHandle = entityManager.spawn({
    name: 'PlayerPaddle',
    role: playerArtifact.data.role,
    halfWidth: playerArtifact.data.halfWidth,
    halfHeight: playerArtifact.data.halfHeight,
    speed: playerArtifact.data.speed,
    color: playerArtifact.data.color
  });
  transformManager.setTransform(playerHandle, {
    position: { x: playerArtifact.data.initialX, y: playerArtifact.data.initialY, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    ownership: TRANSFORM_OWNERSHIP.KINEMATIC
  });

  // Opponent Paddle Entity
  const opponentHandle = entityManager.spawn({
    name: 'OpponentPaddle',
    role: opponentArtifact.data.role,
    halfWidth: opponentArtifact.data.halfWidth,
    halfHeight: opponentArtifact.data.halfHeight,
    speed: opponentArtifact.data.speed,
    color: opponentArtifact.data.color
  });
  transformManager.setTransform(opponentHandle, {
    position: { x: opponentArtifact.data.initialX, y: opponentArtifact.data.initialY, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    ownership: TRANSFORM_OWNERSHIP.KINEMATIC
  });

  // Ball Entity
  const ballHandle = entityManager.spawn({
    name: 'Ball',
    radius: ballArtifact.data.radius,
    halfWidth: ballArtifact.data.halfWidth,
    halfHeight: ballArtifact.data.halfHeight,
    initialSpeed: ballArtifact.data.initialSpeed,
    maxSpeed: ballArtifact.data.maxSpeed,
    color: ballArtifact.data.color
  });
  transformManager.setTransform(ballHandle, {
    position: { x: ballArtifact.data.initialX, y: ballArtifact.data.initialY, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    ownership: TRANSFORM_OWNERSHIP.SIMULATED
  });

  // 5. Declarative Rules Configuration
  // Rule 1: When point scored -> increment scorer score and evaluate win condition
  rules.addRule({
    name: 'on_point_scored',
    event: 'POINT_SCORED',
    action: (payload) => {
      const varKey = payload.side === 'right' ? 'score.player1' : 'score.player2';
      state.incrementVar(varKey);
      rules.trigger('CHECK_WIN_CONDITION', payload);
    }
  });

  // Rule 2: Win condition -> game over
  rules.addRule({
    name: 'check_game_over',
    event: 'CHECK_WIN_CONDITION',
    condition: () => {
      const p1 = state.getVar('score.player1', 0);
      const p2 = state.getVar('score.player2', 0);
      const max = state.getVar('score.max', 5);
      return p1 >= max || p2 >= max;
    },
    action: () => {
      const p1 = state.getVar('score.player1', 0);
      const winner = p1 >= state.getVar('score.max', 5) ? 'Player 1' : 'Player 2';
      state.setVar('match.winner', winner);
      state.transition('GAME_OVER');
      // Halt ball
      transformManager.setVelocity(ballHandle, { x: 0, y: 0, z: 0 });
    }
  });

  // Rule 3: Continue match -> reset for next serve
  rules.addRule({
    name: 'continue_match',
    event: 'CHECK_WIN_CONDITION',
    condition: () => {
      const p1 = state.getVar('score.player1', 0);
      const p2 = state.getVar('score.player2', 0);
      const max = state.getVar('score.max', 5);
      return p1 < max && p2 < max;
    },
    action: (payload) => {
      state.transition('SERVE');
      serveBall(payload.side === 'right' ? 1 : -1);
    }
  });

  // Internal Serve & Ball reset
  let serveTimer = 0;
  let serveDirection = 1; // 1 = towards opponent, -1 = towards player

  function serveBall(direction = 1) {
    serveDirection = direction;
    serveTimer = MATCH_RULES_DEFINITION.data.serveDelaySeconds;
    transformManager.teleport(ballHandle, { x: 0, y: 0, z: 0 });
    transformManager.setVelocity(ballHandle, { x: 0, y: 0, z: 0 });
  }

  function launchBall() {
    const speed = ballArtifact.data.initialSpeed;
    // Launch angle: slight angle for interest
    const angle = (Math.sin(clock.totalTicks) * 0.35);
    const vx = serveDirection * speed * Math.cos(angle);
    const vy = speed * Math.sin(angle);
    transformManager.setVelocity(ballHandle, { x: vx, y: vy, z: 0 });
    state.transition('PLAYING');
  }

  // Initial serve
  serveBall(1);

  // 6. Renderer
  const renderer = createPongRenderer({
    canvas: options.canvas,
    hudElement: options.hudElement,
    arena
  });

  // 7. Fixed-Step Simulation Function
  let previousPauseAction = false;

  function stepSimulation(dt) {
    const snapshot = input.captureSnapshot();

    // Toggle Pause
    const pauseActive = snapshot.isActionActive('Pause');
    if (pauseActive && !previousPauseAction) {
      if (state.getState() === 'PAUSED') {
        state.transition('PLAYING');
      } else if (state.getState() === 'PLAYING' || state.getState() === 'SERVE') {
        state.transition('PAUSED');
      }
    }
    previousPauseAction = pauseActive;

    // Reset Match
    if (snapshot.isActionActive('Reset')) {
      state.setVar('score.player1', 0);
      state.setVar('score.player2', 0);
      state.setVar('match.winner', null);
      state.transition('SERVE');
      serveBall(1);
      return;
    }

    const currentState = state.getState();
    if (currentState === 'PAUSED' || currentState === 'GAME_OVER') {
      return;
    }

    // State: SERVE
    if (currentState === 'SERVE') {
      serveTimer -= dt;
      const playerAction = snapshot.isActionActive('MoveUp') || snapshot.isActionActive('MoveDown');
      if (serveTimer <= 0 || playerAction) {
        launchBall();
      }
    }

    // State: PLAYING or SERVE (allow paddle movement in both)
    const playerPaddleData = entityManager.get(playerHandle);
    const opponentPaddleData = entityManager.get(opponentHandle);
    const ballData = entityManager.get(ballHandle);

    // 1. Evaluate Player Movement Intent
    let playerIntentY = 0;
    if (snapshot.isActionActive('MoveUp')) {
      playerIntentY = playerPaddleData.speed;
    } else if (snapshot.isActionActive('MoveDown')) {
      playerIntentY = -playerPaddleData.speed;
    }
    transformManager.setIntent(playerHandle, { x: 0, y: playerIntentY, z: 0 });

    // 2. Evaluate Opponent AI Movement Intent
    const ballTransform = transformManager.getTransform(ballHandle);
    const oppTransform = transformManager.getTransform(opponentHandle);
    let oppIntentY = 0;
    if (ballTransform && oppTransform) {
      const diff = ballTransform.position.y - oppTransform.position.y;
      if (Math.abs(diff) > 12) {
        oppIntentY = Math.sign(diff) * opponentPaddleData.speed;
      }
    }
    transformManager.setIntent(opponentHandle, { x: 0, y: oppIntentY, z: 0 });

    // 3. Collision resolution (Walls & Paddles)
    if (currentState === 'PLAYING') {
      // Top / Bottom Arena Walls
      collision.resolveArenaWalls(ballTransform, ballData.radius, arena);

      // Paddles
      const playerTransform = transformManager.getTransform(playerHandle);
      collision.resolvePaddleCollision(ballTransform, ballData, playerTransform, playerPaddleData, 'left');
      collision.resolvePaddleCollision(ballTransform, ballData, oppTransform, opponentPaddleData, 'right');

      // Goal detection
      const goalSide = collision.checkGoal(ballTransform, arena);
      if (goalSide) {
        rules.trigger('POINT_SCORED', { side: goalSide });
      }
    }

    // 4. Commit Authoritative Transforms
    transformManager.commitAll(dt);

    // 5. Clamp Paddles to Arena Bounds
    const playerT = transformManager.getTransform(playerHandle);
    const oppT = transformManager.getTransform(opponentHandle);
    collision.clampPaddleToBounds(playerT, playerPaddleData.halfHeight, arena);
    collision.clampPaddleToBounds(oppT, opponentPaddleData.halfHeight, arena);
  }

  // 8. Animation & Render Loop
  let animationFrameId = null;
  let lastFrameTime = null;
  let running = false;

  function loop(currentTime) {
    if (!running) return;

    if (lastFrameTime === null) {
      lastFrameTime = currentTime;
    }
    const deltaMs = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Advance fixed clock
    const clockResult = clock.advance(deltaMs, (fixedDt) => {
      stepSimulation(fixedDt);
    });

    // Render with interpolation
    renderer.render({
      playerPaddle: {
        transform: transformManager.getTransform(playerHandle),
        ...entityManager.get(playerHandle)
      },
      opponentPaddle: {
        transform: transformManager.getTransform(opponentHandle),
        ...entityManager.get(opponentHandle)
      },
      ball: {
        transform: transformManager.getTransform(ballHandle),
        ...entityManager.get(ballHandle)
      }
    }, clockResult.alpha);

    // Update DOM HUD
    renderer.updateHUD({
      status: state.getState(),
      scoreP1: state.getVar('score.player1', 0),
      scoreP2: state.getVar('score.player2', 0),
      maxScore: state.getVar('score.max', 5)
    });

    animationFrameId = requestAnimationFrame(loop);
  }

  return {
    runtime,
    entityManager,
    transformManager,
    clock,
    input,
    collision,
    state,
    rules,
    arena,

    /**
     * Starts the browser animation loop.
     */
    start() {
      if (running) return;
      running = true;
      lastFrameTime = null;
      if (typeof window !== 'undefined') {
        input.attach(window);
      }
      if (typeof requestAnimationFrame === 'function') {
        animationFrameId = requestAnimationFrame(loop);
      }
    },

    /**
     * Stops the animation loop and detaches input listeners.
     */
    stop() {
      running = false;
      if (animationFrameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (typeof window !== 'undefined') {
        input.detach(window);
      }
    },

    /**
     * Manually advances the game by deltaMs (for headless evaluation and tests).
     *
     * @param {number} deltaMs
     * @returns {object} { steps, alpha, totalTicks }
     */
    stepOnce(deltaMs) {
      const clockResult = clock.advance(deltaMs, (fixedDt) => {
        stepSimulation(fixedDt);
      });

      renderer.render({
        playerPaddle: {
          transform: transformManager.getTransform(playerHandle),
          ...entityManager.get(playerHandle)
        },
        opponentPaddle: {
          transform: transformManager.getTransform(opponentHandle),
          ...entityManager.get(opponentHandle)
        },
        ball: {
          transform: transformManager.getTransform(ballHandle),
          ...entityManager.get(ballHandle)
        }
      }, clockResult.alpha);

      renderer.updateHUD({
        status: state.getState(),
        scoreP1: state.getVar('score.player1', 0),
        scoreP2: state.getVar('score.player2', 0),
        maxScore: state.getVar('score.max', 5)
      });

      return clockResult;
    },

    /**
     * Injects an action for headless evaluation or automated test scripts.
     */
    simulateAction(action, active = true) {
      input.simulateAction(action, active);
    },

    /**
     * Returns full state snapshot.
     */
    getState() {
      const pT = transformManager.getTransform(playerHandle);
      const oT = transformManager.getTransform(opponentHandle);
      const bT = transformManager.getTransform(ballHandle);

      function cloneT(t) {
        if (!t) return null;
        return {
          handle: t.handle,
          position: { ...t.position },
          velocity: { ...t.velocity },
          previousPosition: { ...t.previousPosition },
          ownership: t.ownership
        };
      }

      return {
        status: state.getState(),
        scores: {
          player1: state.getVar('score.player1', 0),
          player2: state.getVar('score.player2', 0),
          max: state.getVar('score.max', 5),
          winner: state.getVar('match.winner')
        },
        entities: {
          player: cloneT(pT),
          opponent: cloneT(oT),
          ball: cloneT(bT)
        },
        totalTicks: clock.totalTicks,
        diagnostics: runtime.diagnostics.getDiagnostics()
      };
    }
  };
}
