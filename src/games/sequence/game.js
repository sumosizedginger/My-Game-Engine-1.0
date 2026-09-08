/**
 * Order Five — bounded 3D top-down collection puzzle.
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Uses only public runtime + full package surfaces documented from README,
 * GAMEPLAY_FOUNDATION.md, and the accepted tiny-game / different-genre lessons.
 */

import {
  createRuntime,
  createEntityManager,
  createTransformManager,
  TRANSFORM_OWNERSHIP,
  createSimulationClock,
  createInputSystem,
  checkAABB,
  createStateManager,
  createRuleEngine
} from '../../runtime/index.js';

import { compileDefinition } from '../../full/index.js';

import {
  ARENA_DEFINITION,
  PLAYER_DEFINITION,
  COLLECTIBLE_DEFINITIONS,
  HAZARD_DEFINITIONS,
  EXIT_DEFINITION,
  MATCH_DEFINITION
} from './definitions.js';

const FIXED_DT = 1 / 60;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Map an XZ gameplay disk onto the documented 2D AABB (x, y) contract.
 */
export function xzBox(position, radius) {
  return {
    x: position.x,
    y: position.z,
    halfWidth: radius,
    halfHeight: radius
  };
}

export function xzAabb(position, halfWidth, halfDepth) {
  return {
    x: position.x,
    y: position.z,
    halfWidth,
    halfHeight: halfDepth
  };
}

export function hazardPose(tick, data) {
  const phase = tick * data.omega;
  return {
    x: data.homeX + Math.sin(phase) * data.ampX,
    y: data.homeY,
    z: data.homeZ + Math.sin(phase) * data.ampZ
  };
}

export function createSequenceInput() {
  const input = createInputSystem({
    actions: ['MoveX', 'MoveZ', 'MoveLeft', 'MoveRight', 'MoveUp', 'MoveDown', 'Reset'],
    keyboardBindings: {
      KeyR: 'Reset'
    }
  });

  input.bindScalarKey('KeyA', 'MoveX', -1);
  input.bindScalarKey('ArrowLeft', 'MoveX', -1);
  input.bindScalarKey('KeyD', 'MoveX', 1);
  input.bindScalarKey('ArrowRight', 'MoveX', 1);
  input.bindScalarKey('KeyW', 'MoveZ', -1);
  input.bindScalarKey('ArrowUp', 'MoveZ', -1);
  input.bindScalarKey('KeyS', 'MoveZ', 1);
  input.bindScalarKey('ArrowDown', 'MoveZ', 1);

  input.bindScalarAxis(0, 'MoveX', { deadzone: 0.25 });
  input.bindScalarAxis(1, 'MoveZ', { deadzone: 0.25 });

  input.bindGamepadAxis(0, 'MoveLeft', 'MoveRight', { deadzone: 0.25 });
  input.bindGamepadAxis(1, 'MoveUp', 'MoveDown', { deadzone: 0.25 });
  input.bindGamepadButton(14, 'MoveLeft');
  input.bindGamepadButton(15, 'MoveRight');
  input.bindGamepadButton(12, 'MoveUp');
  input.bindGamepadButton(13, 'MoveDown');
  input.bindGamepadButton(3, 'Reset');
  input.bindGamepadButton(8, 'Reset');

  return input;
}

function createInitialVars() {
  const vars = {
    'sequence.collected': 0,
    'sequence.expected': 1,
    'sequence.objective': 'Collect relic 1',
    'sequence.rejected': 0,
    'exit.active': false,
    'exit.inactiveContacts': 0
  };
  for (const definition of COLLECTIBLE_DEFINITIONS) {
    vars[`collectible.${definition.data.order}.collected`] = false;
  }
  return vars;
}

export function createSequenceGame(options = {}) {
  const runtime = createRuntime({ env: options.env || 'browser', game: 'sequence' });
  const entityManager = createEntityManager();
  const transformManager = createTransformManager(entityManager);
  const clock = createSimulationClock({ tickRate: 60 });
  const input = createSequenceInput();
  const initialVars = createInitialVars();
  const state = createStateManager({
    initialState: 'READY',
    validStates: ['READY', 'PLAYING', 'COMPLETE'],
    initialVars
  });
  const rules = createRuleEngine({ state, entityManager, transformManager });

  const arenaArtifact = compileDefinition(ARENA_DEFINITION);
  const playerArtifact = compileDefinition(PLAYER_DEFINITION);
  const collectibleArtifacts = COLLECTIBLE_DEFINITIONS.map((definition) => compileDefinition(definition));
  const hazardArtifacts = HAZARD_DEFINITIONS.map((definition) => compileDefinition(definition));
  const exitArtifact = compileDefinition(EXIT_DEFINITION);
  const matchArtifact = compileDefinition(MATCH_DEFINITION);

  runtime.instantiate(arenaArtifact);
  runtime.instantiate(playerArtifact);
  for (const artifact of collectibleArtifacts) runtime.instantiate(artifact);
  for (const artifact of hazardArtifacts) runtime.instantiate(artifact);
  runtime.instantiate(exitArtifact);
  runtime.instantiate(matchArtifact);

  const arena = arenaArtifact.data;
  const playerData = playerArtifact.data;

  const arenaHandle = entityManager.spawn({
    name: 'Arena',
    role: 'arena',
    halfWidth: arena.halfWidth,
    halfDepth: arena.halfDepth
  });
  transformManager.setTransform(arenaHandle, {
    position: { x: 0, y: arena.floorY, z: 0 },
    ownership: TRANSFORM_OWNERSHIP.STATIC
  });

  const playerHandle = entityManager.spawn({
    name: 'Player',
    role: playerData.role,
    radius: playerData.radius,
    speed: playerData.speed,
    color: playerData.color
  });
  transformManager.setTransform(playerHandle, {
    position: { x: playerData.initialX, y: playerData.initialY, z: playerData.initialZ },
    velocity: { x: 0, y: 0, z: 0 },
    ownership: TRANSFORM_OWNERSHIP.KINEMATIC
  });

  const collectibles = collectibleArtifacts.map((artifact) => {
    const handle = entityManager.spawn({
      name: `Relic${artifact.data.order}`,
      role: 'collectible',
      order: artifact.data.order,
      radius: artifact.data.radius,
      color: artifact.data.color
    });
    transformManager.setTransform(handle, {
      position: {
        x: artifact.data.initialX,
        y: artifact.data.initialY,
        z: artifact.data.initialZ
      },
      ownership: TRANSFORM_OWNERSHIP.STATIC
    });
    return { handle, order: artifact.data.order, radius: artifact.data.radius, artifact };
  });

  const hazards = hazardArtifacts.map((artifact) => {
    const handle = entityManager.spawn({
      name: artifact.data.name,
      role: 'hazard',
      radius: artifact.data.radius,
      color: artifact.data.color
    });
    const pose = hazardPose(0, artifact.data);
    transformManager.setTransform(handle, {
      position: pose,
      velocity: { x: 0, y: 0, z: 0 },
      ownership: TRANSFORM_OWNERSHIP.KINEMATIC
    });
    return { handle, radius: artifact.data.radius, data: artifact.data, artifact };
  });

  const exitHandle = entityManager.spawn({
    name: 'Exit',
    role: 'exit',
    halfWidth: exitArtifact.data.halfWidth,
    halfDepth: exitArtifact.data.halfDepth
  });
  transformManager.setTransform(exitHandle, {
    position: {
      x: exitArtifact.data.initialX,
      y: exitArtifact.data.initialY,
      z: exitArtifact.data.initialZ
    },
    ownership: TRANSFORM_OWNERSHIP.STATIC
  });

  let playTicks = 0;
  let hazardTicks = 0;
  let disposed = false;
  let resetHeld = false;

  function objectiveFor(collected, expected, gameState) {
    if (gameState === 'COMPLETE') return 'Complete';
    if (collected >= matchArtifact.data.collectibleCount) return 'Enter the exit';
    return `Collect relic ${expected}`;
  }

  rules.addRule({
    name: 'collect_expected',
    event: 'COLLECTIBLE_CONTACT',
    condition: (payload) => {
      const expected = state.getVar('sequence.expected', 1);
      const already = state.getVar(`collectible.${payload.order}.collected`, false);
      return payload.order === expected && !already;
    },
    action: (payload) => {
      state.setVar(`collectible.${payload.order}.collected`, true);
      const collected = state.incrementVar('sequence.collected');
      const next = payload.order + 1;
      state.setVar('sequence.expected', next);
      if (collected >= matchArtifact.data.collectibleCount) {
        state.setVar('exit.active', true);
        state.setVar('sequence.objective', 'Enter the exit');
      } else {
        state.setVar('sequence.objective', `Collect relic ${next}`);
      }
    }
  });

  rules.addRule({
    name: 'reject_wrong_order',
    event: 'COLLECTIBLE_CONTACT',
    condition: (payload) => {
      const expected = state.getVar('sequence.expected', 1);
      const already = state.getVar(`collectible.${payload.order}.collected`, false);
      return !already && payload.order !== expected;
    },
    action: () => {
      state.incrementVar('sequence.rejected');
    }
  });

  rules.addRule({
    name: 'hazard_resets_attempt',
    event: 'HAZARD_CONTACT',
    action: () => {
      resetAttempt();
    }
  });

  rules.addRule({
    name: 'inactive_exit_ignored',
    event: 'EXIT_CONTACT',
    condition: () => state.getVar('exit.active', false) !== true,
    action: () => {
      state.incrementVar('exit.inactiveContacts');
    }
  });

  rules.addRule({
    name: 'active_exit_completes',
    event: 'EXIT_CONTACT',
    condition: () => state.getVar('exit.active', false) === true && state.getState() === 'PLAYING',
    action: () => {
      state.transition('COMPLETE');
      state.setVar('sequence.objective', 'Complete');
      transformManager.setIntent(playerHandle, { x: 0, y: 0, z: 0 });
      transformManager.setVelocity(playerHandle, { x: 0, y: 0, z: 0 });
      for (const hazard of hazards) {
        transformManager.setIntent(hazard.handle, { x: 0, y: 0, z: 0 });
        transformManager.setVelocity(hazard.handle, { x: 0, y: 0, z: 0 });
      }
    }
  });

  function resetAttempt() {
    transformManager.teleport(playerHandle, {
      x: playerData.initialX,
      y: playerData.initialY,
      z: playerData.initialZ
    });
    transformManager.setIntent(playerHandle, { x: 0, y: 0, z: 0 });
    transformManager.setVelocity(playerHandle, { x: 0, y: 0, z: 0 });

    for (const collectible of collectibles) {
      transformManager.teleport(collectible.handle, {
        x: collectible.artifact.data.initialX,
        y: collectible.artifact.data.initialY,
        z: collectible.artifact.data.initialZ
      });
    }

    hazardTicks = 0;
    playTicks = 0;
    for (const hazard of hazards) {
      const pose = hazardPose(0, hazard.data);
      transformManager.teleport(hazard.handle, pose);
      transformManager.setIntent(hazard.handle, { x: 0, y: 0, z: 0 });
      transformManager.setVelocity(hazard.handle, { x: 0, y: 0, z: 0 });
    }

    clock.reset();
    state.reset('READY', createInitialVars());
  }

  function readMove(snapshot) {
    let mx = snapshot.getActionValue('MoveX');
    let mz = snapshot.getActionValue('MoveZ');
    if (snapshot.isActionActive('MoveLeft')) mx -= 1;
    if (snapshot.isActionActive('MoveRight')) mx += 1;
    if (snapshot.isActionActive('MoveUp')) mz -= 1;
    if (snapshot.isActionActive('MoveDown')) mz += 1;
    mx = clamp(mx, -1, 1);
    mz = clamp(mz, -1, 1);
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    return { mx, mz, mag: Math.hypot(mx, mz) };
  }

  function resolvePlayerIntent(mx, mz, dt) {
    const transform = transformManager.getTransform(playerHandle);
    const radius = playerData.radius;
    const nextX = clamp(
      transform.position.x + mx * playerData.speed * dt,
      arena.minX + radius,
      arena.maxX - radius
    );
    const nextZ = clamp(
      transform.position.z + mz * playerData.speed * dt,
      arena.minZ + radius,
      arena.maxZ - radius
    );
    transformManager.setIntent(playerHandle, {
      x: (nextX - transform.position.x) / dt,
      y: 0,
      z: (nextZ - transform.position.z) / dt
    });
  }

  function resolveHazardIntents(dt) {
    for (const hazard of hazards) {
      const transform = transformManager.getTransform(hazard.handle);
      const target = hazardPose(hazardTicks, hazard.data);
      transformManager.setIntent(hazard.handle, {
        x: (target.x - transform.position.x) / dt,
        y: 0,
        z: (target.z - transform.position.z) / dt
      });
    }
  }

  function evaluateContacts() {
    const playerTransform = transformManager.getTransform(playerHandle);
    const playerBox = xzBox(playerTransform.position, playerData.radius);

    for (const collectible of collectibles) {
      const collected = state.getVar(`collectible.${collectible.order}.collected`, false);
      if (collected) continue;
      const transform = transformManager.getTransform(collectible.handle);
      if (checkAABB(playerBox, xzBox(transform.position, collectible.radius))) {
        rules.trigger('COLLECTIBLE_CONTACT', { order: collectible.order });
      }
    }

    for (const hazard of hazards) {
      const transform = transformManager.getTransform(hazard.handle);
      if (checkAABB(playerBox, xzBox(transform.position, hazard.radius))) {
        rules.trigger('HAZARD_CONTACT', { name: hazard.data.name });
        return;
      }
    }

    const exitTransform = transformManager.getTransform(exitHandle);
    if (checkAABB(playerBox, xzAabb(exitTransform.position, exitArtifact.data.halfWidth, exitArtifact.data.halfDepth))) {
      rules.trigger('EXIT_CONTACT', {});
    }
  }

  function stepSimulation(dt) {
    const snapshot = input.captureSnapshot();
    const reset = snapshot.isActionActive('Reset');
    if (reset && !resetHeld) {
      resetHeld = true;
      resetAttempt();
      return;
    }
    resetHeld = reset;

    const phase = state.getState();
    if (phase === 'COMPLETE') {
      transformManager.setIntent(playerHandle, { x: 0, y: 0, z: 0 });
      for (const hazard of hazards) {
        transformManager.setIntent(hazard.handle, { x: 0, y: 0, z: 0 });
      }
      transformManager.commitAll(dt);
      return;
    }

    const move = readMove(snapshot);
    if (phase === 'READY' && move.mag > 0) {
      state.transition('PLAYING');
      state.setVar('sequence.objective', objectiveFor(
        state.getVar('sequence.collected', 0),
        state.getVar('sequence.expected', 1),
        'PLAYING'
      ));
    }

    const playing = state.getState() === 'PLAYING';
    if (playing) {
      playTicks += 1;
    }

    hazardTicks += 1;
    resolveHazardIntents(dt);
    if (playing) {
      resolvePlayerIntent(move.mx, move.mz, dt);
    } else {
      transformManager.setIntent(playerHandle, { x: 0, y: 0, z: 0 });
    }

    transformManager.commitAll(dt);

    if (state.getState() !== 'COMPLETE') {
      evaluateContacts();
    }
  }

  function cloneVec(v) {
    return { x: v.x, y: v.y, z: v.z };
  }

  function snapshot() {
    const playerTransform = transformManager.getTransform(playerHandle);
    return {
      status: state.getState(),
      objective: state.getVar('sequence.objective'),
      collected: state.getVar('sequence.collected', 0),
      expected: state.getVar('sequence.expected', 1),
      rejected: state.getVar('sequence.rejected', 0),
      exitActive: state.getVar('exit.active', false),
      inactiveExitContacts: state.getVar('exit.inactiveContacts', 0),
      playTicks,
      hazardTicks,
      time: playTicks * FIXED_DT,
      player: {
        handle: playerHandle,
        position: cloneVec(playerTransform.position),
        velocity: cloneVec(playerTransform.velocity)
      },
      collectibles: collectibles.map((item) => {
        const transform = transformManager.getTransform(item.handle);
        return {
          order: item.order,
          collected: state.getVar(`collectible.${item.order}.collected`, false),
          position: cloneVec(transform.position)
        };
      }),
      hazards: hazards.map((item) => {
        const transform = transformManager.getTransform(item.handle);
        return {
          name: item.data.name,
          position: cloneVec(transform.position)
        };
      }),
      exit: {
        handle: exitHandle,
        position: cloneVec(transformManager.getTransform(exitHandle).position),
        active: state.getVar('exit.active', false)
      },
      arena: {
        minX: arena.minX,
        maxX: arena.maxX,
        minZ: arena.minZ,
        maxZ: arena.maxZ
      },
      artifacts: {
        arena: arenaArtifact.hash,
        player: playerArtifact.hash,
        match: matchArtifact.hash
      }
    };
  }

  resetAttempt();

  return {
    runtime,
    entityManager,
    transformManager,
    clock,
    input,
    state,
    rules,
    playerHandle,
    collectibles,
    hazards,
    exitHandle,
    arena,

    step(dt = FIXED_DT) {
      if (disposed) {
        throw new Error('SEQUENCE_GAME_DISPOSED');
      }
      if (Math.abs(dt - FIXED_DT) > 1e-10) {
        throw new Error('SEQUENCE_FIXED_STEP_REQUIRED');
      }
      stepSimulation(dt);
    },

    stepOnce(deltaMs) {
      if (disposed) {
        throw new Error('SEQUENCE_GAME_DISPOSED');
      }
      return clock.advance(deltaMs, (fixedDt) => {
        stepSimulation(fixedDt);
      });
    },

    simulateAction(action, active = true) {
      input.simulateAction(action, active);
    },

    simulateActionValue(action, value) {
      input.simulateActionValue(action, value);
    },

    reset() {
      resetAttempt();
    },

    getState() {
      return snapshot();
    },

    snapshot,

    dispose() {
      if (disposed) return;
      disposed = true;
      input.clear();
      transformManager.clear();
      entityManager.clear();
      rules.clear();
      clock.reset();
    }
  };
}
