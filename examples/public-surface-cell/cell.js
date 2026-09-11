/**
 * PUBLIC SURFACE ACCEPTANCE CELL
 * Forcing consumer for PUBLIC-SURFACE-001.
 *
 * This file exists to answer one question: can a developer who is NOT inside
 * this repository reach the engine's accepted Forge capability?
 *
 * It therefore imports through the package route an external consumer would
 * use, and nothing else:
 *
 *   @sumosizedginger/my-game-engine-1.0/full
 *
 * No `../../src/...`. No subsystem barrels. No renderer adapter. If a
 * capability is not reachable from that one specifier, this file cannot use
 * it, and the public surface has failed.
 *
 * It is NOT a game and NOT a visual benchmark. It composes four Forges plus
 * Scene into one coherent result so that the composition itself is the proof,
 * rather than four disconnected smoke calls:
 *
 *   World Forge      bounded terrain + field and volume queries
 *          |
 *          v         a clearing is chosen by querying the world
 *   Geometry Forge   a room is generated and placed at that clearing
 *          |
 *          v
 *   Character Forge  a humanoid is built and stood on the room floor
 *          |
 *          v
 *   Motion Forge     locomotion is evaluated, feet are grounded, one leg is
 *                    solved with two-bone IK, root motion is committed through
 *                    a transform rather than written directly
 *          |
 *          v
 *   Scene            the whole arrangement is composed, compiled and given
 *                    deterministic identity
 *
 * RESOURCE OWNERSHIP. Character Forge and World Forge both return Three.js
 * resources. This cell owns them and disposes them in `dispose()`.
 */

import {
  // World Forge
  createWorldRecipe,
  createWorldFieldCache,
  createWorldFieldQuery,
  createWorldVolumeQuery,
  generateWorld,
  worldDataHash,
  // Geometry Forge
  createRoomDefinition,
  generateProceduralRoom,
  SURFACE_NAMES,
  // Character Forge
  createCharacterDefinition,
  buildHumanoidCharacter,
  computeSemanticLandmarks,
  resolveHumanoidParameters,
  // Motion Forge
  createMotionDefinition,
  createLocomotionEvaluator,
  solveTwoBoneIK,
  commitRootMotionIntent,
  // Scene
  createSceneDefinition,
  createSceneNode,
  compileScene,
  instantiateScene
} from '@sumosizedginger/my-game-engine-1.0/full';

/** Fixed seed so the cell is reproducible evidence rather than a lottery. */
export const CELL_SEED = 4471;

/** Scene identity for the composed result. */
export const PUBLIC_SURFACE_CELL_ID = 'public.surface.cell.v1';

/**
 * Finds a buildable clearing by asking the world, rather than guessing.
 *
 * Uses WorldFieldQuery for cheap terrain sampling and WorldVolumeQuery for
 * authoritative 3D occupancy — the split CONSTITUTION.md §19 requires.
 *
 * @param {object} world - Result of generateWorld.
 * @param {number} radius - Required clear radius in metres.
 * @returns {object|null} { x, y, z, slope } or null when the world has no room.
 */
function findClearing(world, radius) {
  // A deterministic spiral outward from the origin. No randomness: the same
  // world must always yield the same clearing.
  for (let ring = 0; ring < 12; ring++) {
    for (let step = 0; step < 8; step++) {
      const angle = (step / 8) * Math.PI * 2;
      const distance = ring * 3.5;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const sample = world.fields.sample(x, z);
      if (!sample || sample.slope > 0.22) continue;

      const occupied = world.volumes.overlaps({
        x, z, radius, minY: sample.height, maxY: sample.height + 4
      });
      if (occupied.length > 0) continue;

      return { x, y: sample.height, z, slope: sample.slope };
    }
  }
  return null;
}

/**
 * Builds the acceptance cell.
 *
 * Every capability used here arrived through the public package specifier.
 *
 * @param {object} [options]
 * @param {number} [options.seed=CELL_SEED]
 * @param {string} [options.roomPreset='small_chamber']
 * @param {string} [options.characterPreset='average']
 * @param {string} [options.motionPreset='natural']
 * @returns {object} The composed cell, with a dispose().
 */
export function buildPublicSurfaceCell({
  seed = CELL_SEED,
  roomPreset = 'small_chamber',
  characterPreset = 'average',
  motionPreset = 'natural'
} = {}) {
  const report = { steps: [], diagnostics: [] };
  const note = (forge, detail) => report.steps.push({ forge, ...detail });

  // ---- WORLD FORGE ------------------------------------------------------
  // The recipe is source; the world is generated from it deterministically.
  const recipe = createWorldRecipe({ seed, worldSize: 96, treeDensity: 0.012 });
  const world = generateWorld(recipe.parameters);
  report.diagnostics.push(...world.diagnostics);

  // The query layer is reachable standalone, not only as a by-product of
  // generateWorld. An external author sampling terrain without building a
  // whole world needs exactly this.
  const probeCache = createWorldFieldCache(recipe);
  const probeFields = createWorldFieldQuery(probeCache);
  const probeVolumes = createWorldVolumeQuery(probeCache.half);

  note('world', {
    seed: recipe.parameters.seed,
    trees: world.trees.length,
    groundCover: world.cover.length,
    fieldHash: world.hashes.fields,
    // The standalone query must agree with the generated world's own query.
    standaloneQueryAgrees:
      probeFields.heightAt(2, 2) === world.fields.heightAt(2, 2),
    standaloneVolumeEmpty: probeVolumes.records.length === 0
  });

  const clearing = findClearing(world, 7);
  if (!clearing) {
    world.dispose();
    throw new Error('Public surface cell: the generated world offered no clearing.');
  }

  // ---- GEOMETRY FORGE ---------------------------------------------------
  const roomDefinition = createRoomDefinition({ preset: roomPreset });
  const room = generateProceduralRoom(roomDefinition);
  report.diagnostics.push(...(roomDefinition.diagnostics ?? []));

  const floorY = room.collision.getFloorY();
  note('geometry', {
    preset: roomPreset,
    surfaces: Object.values(SURFACE_NAMES),
    triangles: room.stats?.triangleCount ?? null,
    innerBounds: room.collision.innerBounds,
    // The room's own collision contract answers where a character may stand.
    centreWalkable: room.collision.isWalkable({ x: 0, y: floorY, z: 0 }) !== false
  });

  // ---- CHARACTER FORGE --------------------------------------------------
  const characterDefinition = createCharacterDefinition({ parameters: characterPreset });
  const character = buildHumanoidCharacter(characterDefinition);
  report.diagnostics.push(...character.diagnostics);

  // Landmarks are recomputable from parameters alone, independently of the
  // built character. Proving that is proving the semantic layer is public.
  const { parameters: resolved } = resolveHumanoidParameters(characterPreset);
  const independentLandmarks = computeSemanticLandmarks(resolved);

  note('character', {
    preset: characterPreset,
    bones: character.bones.length,
    landmarkCount: Object.keys(character.landmarks).length,
    landmarksReproducible:
      independentLandmarks['hip.L'].y === character.landmarks['hip.L'].y,
    height: resolved.height
  });

  // ---- MOTION FORGE -----------------------------------------------------
  const motionDefinition = createMotionDefinition({ parameters: motionPreset });
  const locomotion = createLocomotionEvaluator(character, motionPreset);
  report.diagnostics.push(...locomotion.getDiagnostics());

  // A transform the cell owns. Root motion is COMMITTED into it rather than
  // written by the motion system, which is the transform-authority law
  // (CONSTITUTION.md §13): motion produces intent, the transform owner applies it.
  //
  // 'forward' rather than 'in_place': in_place is a studio treadmill that pins
  // the character to the origin, which would throw away the clearing the world
  // query chose. A character standing in a generated world walks.
  const startPosition = { x: clearing.x, y: floorY, z: clearing.z };
  const rootTransform = { position: { ...startPosition } };

  const samples = [];
  for (let step = 0; step < 30; step++) {
    const frame = locomotion.update(1 / 60);
    commitRootMotionIntent(frame.rootMotionIntent, rootTransform, 'forward');
    if (step % 10 === 9) {
      samples.push({
        phase: Number(frame.phase.toFixed(4)),
        leftContact: frame.contactStates.left,
        rightContact: frame.contactStates.right,
        leftGroundError: Number(frame.contactStates.leftError.toFixed(6))
      });
    }
  }
  const travelled = Math.hypot(
    rootTransform.position.x - startPosition.x,
    rootTransform.position.z - startPosition.z
  );

  // One two-bone IK solve, called directly rather than through the evaluator,
  // because an external author composing custom motion needs the primitive.
  //
  // Segment lengths are DERIVED from the semantic landmarks rather than
  // hardcoded: that is what the landmark layer is for, and a hardcoded 0.42
  // would silently stop matching the moment a different preset is used.
  const L = character.landmarks;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const upperLength = distance(L['hip.L'], L['knee.L']);
  const lowerLength = distance(L['knee.L'], L['ankle.L']);
  const hip = { x: L['hip.L'].x, y: L['hip.L'].y, z: L['hip.L'].z };

  // A foot plant slightly forward of rest. Raising the ankle keeps the target
  // inside reach: hip-to-ankle is already most of the leg's length, so a
  // forward step with no lift would exceed it.
  const ik = solveTwoBoneIK({
    rootPos: hip,
    targetPos: { x: L['ankle.L'].x, y: L['ankle.L'].y + 0.12, z: L['ankle.L'].z + 0.16 },
    upperLength,
    lowerLength
  });

  // The refusal matters as much as the solve: a target beyond reach must be
  // reported, not silently clamped into a plausible-looking pose.
  const unreachable = solveTwoBoneIK({
    rootPos: hip,
    targetPos: { x: L['ankle.L'].x, y: L['ankle.L'].y - 0.9, z: L['ankle.L'].z },
    upperLength,
    lowerLength
  });

  note('motion', {
    preset: motionPreset,
    definitionId: motionDefinition.id,
    speed: locomotion.getSpeed(),
    phaseAdvanced: locomotion.getPhase() > 0,
    samples,
    // Root motion reached the transform, which is the whole point of
    // committing intent rather than writing position directly.
    travelledMetres: Number(travelled.toFixed(4)),
    rootAdvanced: travelled > 0,
    ikSegments: [Number(upperLength.toFixed(4)), Number(lowerLength.toFixed(4))],
    ikReachable: ik.reachable,
    ikFlexionDegrees: Number(((ik.flexionAngle * 180) / Math.PI).toFixed(2)),
    ikRefusesOutOfReach: unreachable.reachable === false
  });

  // ---- SCENE ------------------------------------------------------------
  // The arrangement is composed as engine data. Assets are opaque keys: the
  // scene never holds the geometry the Forges produced.
  const sceneDefinition = createSceneDefinition({
    id: PUBLIC_SURFACE_CELL_ID,
    nodes: [
      createSceneNode({ pid: 'cell', name: 'Public Surface Cell' }),
      createSceneNode({
        pid: 'terrain', name: 'Generated Terrain', parent: 'cell',
        asset: 'world.terrain', tags: ['world']
      }),
      createSceneNode({
        pid: 'room', name: 'Generated Room', parent: 'cell',
        transform: { translation: [clearing.x, clearing.y, clearing.z] },
        asset: 'geometry.room', tags: ['geometry', 'shelter']
      }),
      createSceneNode({
        pid: 'room.occupant', name: 'Procedural Humanoid', parent: 'room',
        // Placed at where the walk actually took it, relative to the room.
        transform: {
          translation: [
            rootTransform.position.x - clearing.x,
            floorY,
            rootTransform.position.z - clearing.z
          ]
        },
        asset: 'character.humanoid', tags: ['character', 'animated']
      })
    ]
  });
  const sceneArtifact = compileScene(sceneDefinition);
  const sceneInstance = instantiateScene(sceneArtifact);

  note('scene', {
    sceneId: sceneArtifact.id,
    nodes: sceneArtifact.nodeCount,
    maxDepth: sceneArtifact.maxDepth,
    sourceHash: sceneArtifact.sourceHash,
    // The occupant is a child of the room, which sits at the clearing. Its
    // world placement must therefore have inherited the clearing offset.
    occupantWorld: [...sceneInstance.worldTransformOf('room.occupant').translation]
  });

  // Deterministic identity over everything the cell generated, so a validator
  // can compare two runs without comparing pixels.
  const identity = worldDataHash({
    world: world.hashes,
    room: room.stats,
    character: { height: resolved.height, bones: character.bones.length },
    scene: sceneArtifact.artifactHash
  });

  let disposed = false;

  return {
    seed,
    clearing,
    world,
    room,
    character,
    locomotion,
    rootTransform,
    sceneDefinition,
    sceneArtifact,
    sceneInstance,
    identity,
    report,

    get disposed() {
      return disposed;
    },

    /**
     * Releases everything this cell created.
     *
     * Character Forge and World Forge hand back Three.js resources; an API
     * routing tranche is no excuse for leaking them. Repeated calls are safe.
     */
    dispose() {
      if (disposed) return;
      disposed = true;
      sceneInstance.dispose();
      world.dispose();
      character.geometry.dispose();
      character.material.dispose();
      room.visual.geometry.dispose();
      for (const part of Object.values(room.visual.parts)) {
        if (Array.isArray(part)) {
          part.forEach((geometry) => geometry.dispose?.());
        } else {
          part?.dispose?.();
        }
      }
    }
  };
}
