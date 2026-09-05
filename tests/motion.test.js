import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHumanoidCharacter } from '../src/character/index.js';
import {
  MOTION_PARAMETER_BOUNDS,
  MOTION_PRESETS,
  resolveMotionParameters,
  createMotionDefinition,
  solveTwoBoneIK,
  computeGaitFootPlacement,
  createLocomotionEvaluator,
  commitRootMotionIntent
} from '../src/motion/index.js';

describe('Motion Forge — Definition & Parameters', () => {
  it('resolves standard natural preset with all bounded fields', () => {
    const { parameters, diagnostics } = resolveMotionParameters('natural');
    assert.equal(diagnostics.length, 0);
    assert.equal(parameters.cadence, 112);
    assert.equal(parameters.strideLength, 1.30);
    assert.ok(Object.isFrozen(parameters));
  });

  it('clamps out-of-bounds parameter values with diagnostic warnings', () => {
    const { parameters, diagnostics } = resolveMotionParameters({
      cadence: 300, // exceeds max 160
      strideLength: 0.10 // below min 0.60
    });

    assert.equal(parameters.cadence, MOTION_PARAMETER_BOUNDS.cadence.max);
    assert.equal(parameters.strideLength, MOTION_PARAMETER_BOUNDS.strideLength.min);
    assert.ok(diagnostics.some(d => d.code === 'MOTION_PARAM_CLAMPED_MAX'));
    assert.ok(diagnostics.some(d => d.code === 'MOTION_PARAM_CLAMPED_MIN'));
  });

  it('handles unknown preset with diagnostic warning and fallback', () => {
    const { parameters, diagnostics } = resolveMotionParameters('sprint_ultra');
    assert.equal(parameters.cadence, 112);
    assert.ok(diagnostics.some(d => d.code === 'MOTION_UNKNOWN_PRESET'));
  });

  it('creates immutable MotionDefinition record', () => {
    const def = createMotionDefinition({ id: 'walk_01', parameters: 'energetic' });
    assert.equal(def.id, 'walk_01');
    assert.equal(def.type, 'motion');
    assert.equal(def.data.preset, 'energetic');
    assert.equal(def.data.parameters.cadence, 128);
    assert.ok(Object.isFrozen(def));
    assert.ok(Object.isFrozen(def.data));
  });
});

describe('Motion Forge — Analytical 2-Bone IK', () => {
  it('accurately positions middle joint preserving exact bone segment lengths', () => {
    const rootPos = { x: 0, y: 1.0, z: 0 };
    const targetPos = { x: 0, y: 0.2, z: 0.2 };
    const L1 = 0.50;
    const L2 = 0.45;

    const result = solveTwoBoneIK({
      rootPos,
      targetPos,
      upperLength: L1,
      lowerLength: L2,
      poleDirection: { x: 0, y: 0, z: 1 }
    });

    assert.ok(result.reachable);

    // Distance from root to joint must equal L1
    const dist1 = Math.hypot(
      result.jointPos.x - rootPos.x,
      result.jointPos.y - rootPos.y,
      result.jointPos.z - rootPos.z
    );
    assert.ok(Math.abs(dist1 - L1) < 1e-4, `Upper bone length deviation: ${Math.abs(dist1 - L1)}`);

    // Distance from joint to target must equal L2
    const dist2 = Math.hypot(
      targetPos.x - result.jointPos.x,
      targetPos.y - result.jointPos.y,
      targetPos.z - result.jointPos.z
    );
    assert.ok(Math.abs(dist2 - L2) < 1e-4, `Lower bone length deviation: ${Math.abs(dist2 - L2)}`);

    // Knee points forward (+Z)
    assert.ok(result.jointPos.z > rootPos.z);
  });

  it('clamps gracefully without NaN or popping when target exceeds maximum reach', () => {
    const rootPos = { x: 0, y: 1.0, z: 0 };
    const targetPos = { x: 0, y: -0.5, z: 0 }; // distance = 1.5 > L1+L2 = 0.95
    const L1 = 0.50;
    const L2 = 0.45;

    const result = solveTwoBoneIK({
      rootPos,
      targetPos,
      upperLength: L1,
      lowerLength: L2
    });

    assert.equal(result.reachable, false);
    assert.ok(Number.isFinite(result.jointPos.x));
    assert.ok(Number.isFinite(result.jointPos.y));
    assert.ok(Number.isFinite(result.jointPos.z));
    assert.ok(Number.isFinite(result.flexionAngle));
  });
});

describe('Motion Forge — Foot Grounding & Stance Height', () => {
  it('guarantees foot does not penetrate ground (Y < footH) or float (Y > footH + 0.02) during stance', () => {
    const footH = 0.09;
    const strideLength = 1.30;
    const stepHeight = 0.055;

    // Test across entire stance phase (0.00 to 0.60) in fine increments
    for (let p = 0; p <= 0.60; p += 0.02) {
      const placement = computeGaitFootPlacement({
        phase: p,
        strideLength,
        stepHeight,
        footH,
        hipX: 0.12
      });

      assert.equal(placement.inContact, true);
      assert.ok(
        placement.targetPos.y >= footH,
        `Foot penetrated floor at phase ${p}: y = ${placement.targetPos.y}`
      );
      assert.ok(
        placement.targetPos.y <= footH + 0.025,
        `Foot floated in stance at phase ${p}: y = ${placement.targetPos.y}`
      );
    }
  });

  it('elevates foot smoothly during swing phase and clears the floor', () => {
    const footH = 0.09;
    const strideLength = 1.30;
    const stepHeight = 0.055;

    let peakHeight = 0;
    // Test across swing phase (0.60 to 1.00)
    for (let p = 0.61; p < 1.00; p += 0.02) {
      const placement = computeGaitFootPlacement({
        phase: p,
        strideLength,
        stepHeight,
        footH,
        hipX: 0.12
      });

      assert.equal(placement.inContact, false);
      assert.ok(placement.targetPos.y >= footH);
      if (placement.targetPos.y > peakHeight) {
        peakHeight = placement.targetPos.y;
      }
    }

    // Peak height should be close to footH + stepHeight
    assert.ok(
      Math.abs(peakHeight - (footH + stepHeight)) < 0.01,
      `Peak clearance deviation: ${peakHeight} vs ${footH + stepHeight}`
    );
  });
});

describe('Motion Forge — Locomotion Generator', () => {
  it('evaluates dynamic gait cycle with pelvis bounce, lateral sway, and arm swings', () => {
    const char = buildHumanoidCharacter('average');
    const evaluator = createLocomotionEvaluator(char, 'natural');

    assert.equal(evaluator.getPhase(), 0);

    // Step 0.25 seconds
    const res1 = evaluator.update(0.25);
    assert.ok(res1.phase > 0);
    assert.ok(res1.rootMotionIntent.deltaZ > 0);

    // Verify pelvis moved dynamically
    assert.notEqual(res1.pelvisState.bounceY, 0);
    assert.notEqual(res1.pelvisState.swayX, 0);

    // Step through full cycle (approx 1.07s for 112 cadence)
    for (let i = 0; i < 40; i++) {
      evaluator.update(0.033);
    }

    // Phase wrapped around cleanly
    assert.ok(evaluator.getPhase() >= 0 && evaluator.getPhase() < 1.0);
  });
});

describe('Motion Forge — Root Motion & Transform Authority', () => {
  it('commits root motion intent respecting single-writer transform authority', () => {
    const transform = { position: { x: 0, y: 0, z: 0 } };
    const intent = { deltaX: 0, deltaY: 0, deltaZ: 0.05, speed: 1.2, totalDistance: 0.50 };

    // In-place mode: leaves position at origin
    const resInPlace = commitRootMotionIntent(intent, transform, 'in_place');
    assert.equal(transform.position.z, 0);
    assert.equal(resInPlace.totalDistance, 0.50);

    // Forward mode: translates position
    const resForward = commitRootMotionIntent(intent, transform, 'forward');
    assert.equal(transform.position.z, 0.05);
    assert.equal(resForward.position.z, 0.05);
  });
});
