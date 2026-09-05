/**
 * My Game Engine 1.0 — Motion Forge: Locomotion Generator
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Evaluates parameterized bipedal walk cycles with dynamic pelvis bounce,
 * lateral weight transfer, transverse pelvic yaw, counter-phase spine rotation,
 * organic arm swings with elbow flex and wrist lag, and grounded 2-bone leg IK.
 * Produces root motion intent respecting single-writer transform authority.
 * Follows ARCHITECTURE.md §20.3 & §22 and MOTION_FORGE.md.
 */

import { resolveMotionParameters } from './definition.js';
import { solveTwoBoneIK } from './ik.js';
import { computeGaitFootPlacement } from './grounding.js';

/**
 * Creates a stateful locomotion evaluator instance.
 *
 * @param {object} character - Built character instance with bonesByName and landmarks.
 * @param {object|string} [motionOptions='natural'] - Motion preset or overrides.
 * @returns {object} Locomotion evaluator { update, reset, getPose, getParameters, getDiagnostics }
 */
export function createLocomotionEvaluator(character, motionOptions = 'natural') {
  const { parameters: motionParams, diagnostics } = resolveMotionParameters(motionOptions);
  const { bonesByName, landmarks, parameters: charParams } = character;

  let phase = 0.0;
  let totalDistance = 0.0;
  let cycleCount = 0;

  // Limb dimensions from landmarks
  const hipL = landmarks['hip.L'];
  const kneeL = landmarks['knee.L'];
  const ankL = landmarks['ankle.L'];
  const thighL = Math.hypot(kneeL.x - hipL.x, kneeL.y - hipL.y, kneeL.z - hipL.z);
  const shinL = Math.hypot(ankL.x - kneeL.x, ankL.y - kneeL.y, ankL.z - kneeL.z);
  const footH = landmarks['ankle.L'].y;

  // Gait speed
  const frequency = motionParams.cadence / 120.0; // 2 steps per full cycle
  const speed = motionParams.strideLength * frequency;

  /**
   * Evaluates the gait at a given phase and updates character bones.
   *
   * @param {number} deltaSeconds - Elapsed delta time.
   * @param {object} [options={}]
   * @param {boolean} [options.applyRootMotion=false] - If true, translates root bone
   * @returns {object} { phase, rootMotionIntent, contactStates, pelvisState }
   */
  function update(deltaSeconds, options = {}) {
    const deltaPhase = frequency * deltaSeconds;
    phase = (phase + deltaPhase) % 1.0;
    if (phase < 0) phase += 1.0;

    const deltaDistance = speed * deltaSeconds;
    totalDistance += deltaDistance;

    const twoPi = Math.PI * 2;
    const fourPi = Math.PI * 4;

    // -------------------------------------------------------------
    // 1. PELVIS DYNAMICS (Bounce, Sway, Roll, Yaw)
    // -------------------------------------------------------------
    // Vertical bounce: double-frequency (dips at heel strikes 0.0 and 0.5)
    const bounceY = -motionParams.verticalBounce * Math.cos(fourPi * phase);
    // Lateral sway: shifts toward stance leg
    const swayX = motionParams.lateralSway * Math.sin(twoPi * phase);
    // Pelvis roll (Z-axis tilt): drops unsupported hip
    const pelvisRoll = motionParams.pelvisRoll * Math.sin(twoPi * phase);
    // Pelvis yaw (Y-axis rotation): counters advancing leg
    const pelvisYaw = motionParams.pelvisYaw * Math.cos(twoPi * phase);
    // Pelvis pitch (slight forward tilt at push-off)
    const pelvisPitch = 0.02 * Math.cos(fourPi * phase);

    if (bonesByName.pelvis) {
      bonesByName.pelvis.position.x = landmarks.pelvis.x + swayX;
      bonesByName.pelvis.position.y = landmarks.pelvis.y + bounceY;
      bonesByName.pelvis.position.z = landmarks.pelvis.z;

      bonesByName.pelvis.rotation.set(pelvisPitch, pelvisYaw, pelvisRoll);
    }

    // -------------------------------------------------------------
    // 2. TORSO & SPINE (Counter-Dynamics)
    // -------------------------------------------------------------
    const torsoFactor = motionParams.torsoCounter;
    // Spine counters pelvis yaw and roll
    const spineYaw = -pelvisYaw * torsoFactor * 0.5;
    const spineRoll = -pelvisRoll * 0.5;
    const spinePitch = 0.02;

    if (bonesByName.spine) {
      bonesByName.spine.rotation.set(spinePitch, spineYaw, spineRoll);
    }

    // Chest counters further
    const chestYaw = -pelvisYaw * torsoFactor * 0.5;
    const chestRoll = -pelvisRoll * 0.4;
    const chestPitch = 0.03; // slight forward athletic lean

    if (bonesByName.chest) {
      bonesByName.chest.rotation.set(chestPitch, chestYaw, chestRoll);
    }

    // Neck & Head stabilize gaze
    if (bonesByName.neck) {
      bonesByName.neck.rotation.set(-chestPitch * 0.5, -(spineYaw + chestYaw) * 0.4, 0);
    }
    if (bonesByName.head) {
      bonesByName.head.rotation.set(-chestPitch * 0.3, -(spineYaw + chestYaw) * 0.4, 0);
    }

    // -------------------------------------------------------------
    // 3. LOWER LIMBS & GROUNDED IK
    // -------------------------------------------------------------
    const phaseL = phase;
    const phaseR = (phase + 0.5) % 1.0;

    // Left Foot Placement
    const footPlacementL = computeGaitFootPlacement({
      phase: phaseL,
      strideLength: motionParams.strideLength,
      stepHeight: motionParams.stepHeight,
      footH,
      hipX: landmarks['hip.L'].x
    });

    // Right Foot Placement
    const footPlacementR = computeGaitFootPlacement({
      phase: phaseR,
      strideLength: motionParams.strideLength,
      stepHeight: motionParams.stepHeight,
      footH,
      hipX: landmarks['hip.R'].x
    });

    // Solve Left Leg IK
    const currentHipPosL = {
      x: landmarks['hip.L'].x + swayX + Math.sin(pelvisYaw) * 0.02,
      y: landmarks['hip.L'].y + bounceY - Math.sin(pelvisRoll) * landmarks['hip.L'].x,
      z: landmarks['hip.L'].z - Math.sin(pelvisYaw) * landmarks['hip.L'].x
    };

    const ikL = solveTwoBoneIK({
      rootPos: currentHipPosL,
      targetPos: footPlacementL.targetPos,
      upperLength: thighL,
      lowerLength: shinL,
      poleDirection: { x: 0, y: 0, z: 1 },
      invertBend: false
    });

    if (bonesByName.thigh_l && bonesByName.shin_l && bonesByName.foot_l) {
      // Rotate thigh towards knee
      const thighPitch = Math.atan2(ikL.upperDir.z, -ikL.upperDir.y);
      const thighRoll = Math.asin(Math.max(-1, Math.min(1, ikL.upperDir.x)));
      bonesByName.thigh_l.rotation.set(thighPitch, 0, thighRoll);

      // Knee flexion
      bonesByName.shin_l.rotation.set(-ikL.flexionAngle, 0, 0);

      // Foot pitch (ankle roll)
      bonesByName.foot_l.rotation.set(-thighPitch + ikL.flexionAngle + footPlacementL.pitchAngle, 0, 0);
    }

    // Solve Right Leg IK
    const currentHipPosR = {
      x: landmarks['hip.R'].x + swayX - Math.sin(pelvisYaw) * 0.02,
      y: landmarks['hip.R'].y + bounceY + Math.sin(pelvisRoll) * landmarks['hip.R'].x,
      z: landmarks['hip.R'].z - Math.sin(pelvisYaw) * landmarks['hip.R'].x
    };

    const ikR = solveTwoBoneIK({
      rootPos: currentHipPosR,
      targetPos: footPlacementR.targetPos,
      upperLength: thighL,
      lowerLength: shinL,
      poleDirection: { x: 0, y: 0, z: 1 },
      invertBend: false
    });

    if (bonesByName.thigh_r && bonesByName.shin_r && bonesByName.foot_r) {
      const thighPitch = Math.atan2(ikR.upperDir.z, -ikR.upperDir.y);
      const thighRoll = Math.asin(Math.max(-1, Math.min(1, ikR.upperDir.x)));
      bonesByName.thigh_r.rotation.set(thighPitch, 0, thighRoll);

      bonesByName.shin_r.rotation.set(-ikR.flexionAngle, 0, 0);
      bonesByName.foot_r.rotation.set(-thighPitch + ikR.flexionAngle + footPlacementR.pitchAngle, 0, 0);
    }

    // -------------------------------------------------------------
    // 4. UPPER LIMBS (Counter-Phase Arm Swing)
    // -------------------------------------------------------------
    // Left arm swings with Right leg
    const swingL = Math.sin(twoPi * phaseR);
    const swingR = Math.sin(twoPi * phaseL);

    // Arm swing angles
    const armSwingAmp = motionParams.armSwing;
    const elbowFlexAmp = motionParams.elbowFlex;
    const wristLagAmp = motionParams.wristLag;

    // Left Arm
    if (bonesByName.upperarm_l && bonesByName.forearm_l && bonesByName.hand_l) {
      const shoulderPitch = armSwingAmp * swingL;
      const shoulderRoll = 0.06; // natural arm rest angle away from torso
      bonesByName.upperarm_l.rotation.set(shoulderPitch, 0, shoulderRoll);

      // Elbow flexes when swinging forward, relaxes slightly when swinging back
      const elbowFlex = 0.15 + elbowFlexAmp * Math.max(0, swingL) + 0.06 * Math.max(0, -swingL);
      bonesByName.forearm_l.rotation.set(elbowFlex, 0, 0);

      // Wrist lag trailing the swing velocity
      const wristLag = -wristLagAmp * Math.cos(twoPi * phaseR);
      bonesByName.hand_l.rotation.set(wristLag, 0, 0);
    }

    // Right Arm
    if (bonesByName.upperarm_r && bonesByName.forearm_r && bonesByName.hand_r) {
      const shoulderPitch = armSwingAmp * swingR;
      const shoulderRoll = -0.06;
      bonesByName.upperarm_r.rotation.set(shoulderPitch, 0, shoulderRoll);

      const elbowFlex = 0.15 + elbowFlexAmp * Math.max(0, swingR) + 0.06 * Math.max(0, -swingR);
      bonesByName.forearm_r.rotation.set(elbowFlex, 0, 0);

      const wristLag = -wristLagAmp * Math.cos(twoPi * phaseL);
      bonesByName.hand_r.rotation.set(wristLag, 0, 0);
    }

    // Update bone matrices in character armature
    if (character.rootBone) {
      character.rootBone.updateWorldMatrix(true, true);
    }

    // Movement intent for engine transform authority
    const rootMotionIntent = {
      deltaX: 0,
      deltaY: 0,
      deltaZ: deltaDistance,
      speed,
      totalDistance
    };

    return {
      phase,
      rootMotionIntent,
      contactStates: {
        left: footPlacementL.inContact,
        right: footPlacementR.inContact,
        leftHeight: footPlacementL.targetPos.y,
        rightHeight: footPlacementR.targetPos.y
      },
      pelvisState: {
        bounceY,
        swayX,
        pelvisRoll,
        pelvisYaw
      }
    };
  }

  function reset() {
    phase = 0.0;
    totalDistance = 0.0;
    cycleCount = 0;
  }

  return {
    update,
    reset,
    getPhase: () => phase,
    getParameters: () => motionParams,
    getDiagnostics: () => diagnostics,
    getSpeed: () => speed
  };
}
