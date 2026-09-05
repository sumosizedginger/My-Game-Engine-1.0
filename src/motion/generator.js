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

import { Vector3, Quaternion } from 'three';
import { resolveMotionParameters } from './definition.js';
import { solveTwoBoneIK } from './ik.js';
import { computeGaitFootPlacement } from './grounding.js';

/**
 * Creates a stateful locomotion evaluator instance.
 *
 * @param {object} character - Built character instance with bonesByName and landmarks.
 * @param {object|string} [motionOptions='natural'] - Motion preset or overrides.
 * @returns {object} Locomotion evaluator { update, reset, getPhase, getParameters, getDiagnostics, getSpeed }
 */
export function createLocomotionEvaluator(character, motionOptions = 'natural') {
  const { parameters: motionParams, diagnostics } = resolveMotionParameters(motionOptions);
  const { bonesByName, landmarks, parameters: charParams } = character;

  let phase = 0.0;
  let totalDistance = 0.0;
  let cycleCount = 0;

  // Limb dimensions from landmarks
  const footH = landmarks['ankle.L'].y;

  // Derive exact bone segment lengths directly from semantic landmarks
  const thighL = Math.hypot(
    landmarks['knee.L'].x - landmarks['hip.L'].x,
    landmarks['knee.L'].y - landmarks['hip.L'].y,
    landmarks['knee.L'].z - landmarks['hip.L'].z
  );
  const shinL = Math.hypot(
    landmarks['ankle.L'].x - landmarks['knee.L'].x,
    landmarks['ankle.L'].y - landmarks['knee.L'].y,
    landmarks['ankle.L'].z - landmarks['knee.L'].z
  );

  // Rest-pose bone direction unit vectors in character space
  const restThighDirL = new Vector3().subVectors(landmarks['knee.L'], landmarks['hip.L']).normalize();
  const restShinDirL = new Vector3().subVectors(landmarks['ankle.L'], landmarks['knee.L']).normalize();
  const restThighDirR = new Vector3().subVectors(landmarks['knee.R'], landmarks['hip.R']).normalize();
  const restShinDirR = new Vector3().subVectors(landmarks['ankle.R'], landmarks['knee.R']).normalize();

  // Reusable scratch objects to avoid per-frame allocations
  const _hipWorldPosL = new Vector3();
  const _hipWorldPosR = new Vector3();
  const _targetThighDir = new Vector3();
  const _targetShinDir = new Vector3();
  const _qPelvisWorld = new Quaternion();
  const _qThighWorld = new Quaternion();
  const _qThighLocal = new Quaternion();
  const _qShinWorld = new Quaternion();
  const _qShinLocal = new Quaternion();
  const _qFootWorld = new Quaternion();
  const _qFootLocal = new Quaternion();
  const _xAxis = new Vector3(1, 0, 0);
  const _realizedFootPosL = new Vector3();
  const _realizedFootPosR = new Vector3();

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
    // Dynamic locomotion dip + biological gait bounce: dips at heel strikes, rises at midstance
    const gaitDip = -0.024;
    const bounceY = gaitDip - motionParams.verticalBounce * 0.5 * (1.0 + Math.cos(fourPi * phase));
    // Lateral sway: shifts toward stance leg
    const swayX = motionParams.lateralSway * Math.sin(twoPi * phase);
    // Pelvis roll (Z-axis tilt): drops unsupported hip
    const pelvisRoll = motionParams.pelvisRoll * Math.sin(twoPi * phase);
    // Pelvis yaw (Y-axis rotation): counters advancing leg
    const pelvisYaw = motionParams.pelvisYaw * Math.cos(twoPi * phase);
    // Pelvis pitch (subtle dynamic tilt)
    const pelvisPitch = 0.005 * Math.cos(fourPi * phase);

    if (bonesByName.pelvis) {
      bonesByName.pelvis.position.x = landmarks.pelvis.x + swayX;
      bonesByName.pelvis.position.y = landmarks.pelvis.y + bounceY;
      bonesByName.pelvis.position.z = landmarks.pelvis.z;

      bonesByName.pelvis.rotation.set(pelvisPitch, pelvisYaw, pelvisRoll);
      bonesByName.pelvis.updateWorldMatrix(true, false);
    }

    // -------------------------------------------------------------
    // 2. TORSO & SPINE (Counter-Dynamics with Upright Posture)
    // -------------------------------------------------------------
    const torsoFactor = motionParams.torsoCounter;
    // Spine counters pelvis yaw and roll with natural upright alignment
    const spineYaw = -pelvisYaw * torsoFactor * 0.5;
    const spineRoll = -pelvisRoll * 0.5;
    const spinePitch = -0.005; // straight upright athletic spine

    if (bonesByName.spine) {
      bonesByName.spine.rotation.set(spinePitch, spineYaw, spineRoll);
    }

    // Chest counters further with proud upright posture
    const chestYaw = -pelvisYaw * torsoFactor * 0.5;
    const chestRoll = -pelvisRoll * 0.4;
    const chestPitch = -0.010; // eliminates hunchback stoop

    if (bonesByName.chest) {
      bonesByName.chest.rotation.set(chestPitch, chestYaw, chestRoll);
    }

    // Neck & Head stabilize gaze forward
    if (bonesByName.neck) {
      bonesByName.neck.rotation.set(0.010, -(spineYaw + chestYaw) * 0.4, 0);
    }
    if (bonesByName.head) {
      bonesByName.head.rotation.set(0.005, -(spineYaw + chestYaw) * 0.4, 0);
    }

    // -------------------------------------------------------------
    // 3. LOWER LIMBS & GROUNDED IK (Quaternion Relative Composition)
    // -------------------------------------------------------------
    const phaseL = phase;
    const phaseR = (phase + 0.5) % 1.0;

    // Left Foot Placement Target
    const footPlacementL = computeGaitFootPlacement({
      phase: phaseL,
      strideLength: motionParams.strideLength,
      stepHeight: motionParams.stepHeight,
      footH,
      hipX: landmarks['hip.L'].x
    });

    // Right Foot Placement Target
    const footPlacementR = computeGaitFootPlacement({
      phase: phaseR,
      strideLength: motionParams.strideLength,
      stepHeight: motionParams.stepHeight,
      footH,
      hipX: landmarks['hip.R'].x
    });

    // Solve Left Leg IK using exact realized hip world position
    if (bonesByName.thigh_l && bonesByName.shin_l && bonesByName.foot_l) {
      bonesByName.thigh_l.getWorldPosition(_hipWorldPosL);

      const ikL = solveTwoBoneIK({
        rootPos: _hipWorldPosL,
        targetPos: footPlacementL.targetPos,
        upperLength: thighL,
        lowerLength: shinL,
        poleDirection: { x: 0, y: 0, z: 1 },
        invertBend: false
      });

      // Thigh world orientation -> local quaternion relative to parent pelvis
      _targetThighDir.set(ikL.upperDir.x, ikL.upperDir.y, ikL.upperDir.z).normalize();
      _qThighWorld.setFromUnitVectors(restThighDirL, _targetThighDir);
      bonesByName.pelvis.getWorldQuaternion(_qPelvisWorld);
      _qThighLocal.copy(_qPelvisWorld).invert().multiply(_qThighWorld);
      bonesByName.thigh_l.quaternion.copy(_qThighLocal);
      bonesByName.thigh_l.updateWorldMatrix(true, false);

      // Shin world orientation -> local quaternion relative to parent thigh
      _targetShinDir.set(ikL.lowerDir.x, ikL.lowerDir.y, ikL.lowerDir.z).normalize();
      _qShinWorld.setFromUnitVectors(restShinDirL, _targetShinDir);
      bonesByName.thigh_l.getWorldQuaternion(_qThighWorld);
      _qShinLocal.copy(_qThighWorld).invert().multiply(_qShinWorld);
      bonesByName.shin_l.quaternion.copy(_qShinLocal);
      bonesByName.shin_l.updateWorldMatrix(true, false);

      // Foot pitch orientation -> local quaternion relative to parent shin
      _qFootWorld.setFromAxisAngle(_xAxis, footPlacementL.pitchAngle);
      bonesByName.shin_l.getWorldQuaternion(_qShinWorld);
      _qFootLocal.copy(_qShinWorld).invert().multiply(_qFootWorld);
      bonesByName.foot_l.quaternion.copy(_qFootLocal);
      bonesByName.foot_l.updateWorldMatrix(true, false);
    }

    // Solve Right Leg IK using exact realized hip world position
    if (bonesByName.thigh_r && bonesByName.shin_r && bonesByName.foot_r) {
      bonesByName.thigh_r.getWorldPosition(_hipWorldPosR);

      const ikR = solveTwoBoneIK({
        rootPos: _hipWorldPosR,
        targetPos: footPlacementR.targetPos,
        upperLength: thighL,
        lowerLength: shinL,
        poleDirection: { x: 0, y: 0, z: 1 },
        invertBend: false
      });

      _targetThighDir.set(ikR.upperDir.x, ikR.upperDir.y, ikR.upperDir.z).normalize();
      _qThighWorld.setFromUnitVectors(restThighDirR, _targetThighDir);
      bonesByName.pelvis.getWorldQuaternion(_qPelvisWorld);
      _qThighLocal.copy(_qPelvisWorld).invert().multiply(_qThighWorld);
      bonesByName.thigh_r.quaternion.copy(_qThighLocal);
      bonesByName.thigh_r.updateWorldMatrix(true, false);

      _targetShinDir.set(ikR.lowerDir.x, ikR.lowerDir.y, ikR.lowerDir.z).normalize();
      _qShinWorld.setFromUnitVectors(restShinDirR, _targetShinDir);
      bonesByName.thigh_r.getWorldQuaternion(_qThighWorld);
      _qShinLocal.copy(_qThighWorld).invert().multiply(_qShinWorld);
      bonesByName.shin_r.quaternion.copy(_qShinLocal);
      bonesByName.shin_r.updateWorldMatrix(true, false);

      _qFootWorld.setFromAxisAngle(_xAxis, footPlacementR.pitchAngle);
      bonesByName.shin_r.getWorldQuaternion(_qShinWorld);
      _qFootLocal.copy(_qShinWorld).invert().multiply(_qFootWorld);
      bonesByName.foot_r.quaternion.copy(_qFootLocal);
      bonesByName.foot_r.updateWorldMatrix(true, false);
    }

    // -------------------------------------------------------------
    // 4. UPPER LIMBS (Counter-Phase Arm Swing with Clavicle Articulation)
    // -------------------------------------------------------------
    // Left arm swings with Right leg
    const swingL = Math.sin(twoPi * phaseR);
    const swingR = Math.sin(twoPi * phaseL);

    // Arm swing angles
    const armSwingAmp = motionParams.armSwing;
    const elbowFlexAmp = motionParams.elbowFlex;
    const wristLagAmp = motionParams.wristLag;

    // Left Arm (swings with Right leg)
    if (bonesByName.shoulder_l) {
      // Clavicular protraction and elevation during forward swing
      bonesByName.shoulder_l.rotation.set(-0.04 * swingL, 0, 0.02 * swingL);
    }
    if (bonesByName.upperarm_l && bonesByName.forearm_l && bonesByName.hand_l) {
      // In Three.js: negative X-rotation pitches arm forward (+Z), positive pitches backward (-Z)
      const shoulderPitch = swingL > 0
        ? -armSwingAmp * 0.75 * swingL
        : armSwingAmp * 0.40 * (-swingL);

      const shoulderRoll = 0.06 + 0.03 * swingL;
      const shoulderYaw = -0.05 * swingL;
      bonesByName.upperarm_l.rotation.set(shoulderPitch, shoulderYaw, shoulderRoll);

      // Natural compound arm flexion: elbow flexes visibly forward (~45-55 deg arc)
      // and maintains natural relaxed flexion (~15-20 deg) during backward swing (never rigid)
      const elbowFlex = swingL > 0
        ? -(0.25 + elbowFlexAmp * 1.25 * swingL)
        : -(0.22 + 0.12 * (-swingL));
      bonesByName.forearm_l.rotation.set(elbowFlex, 0, 0);

      // Wrist lag trailing the swing velocity
      const wristLag = wristLagAmp * 0.5 * Math.cos(twoPi * phaseR);
      bonesByName.hand_l.rotation.set(wristLag, 0, 0);
    }

    // Right Arm (swings with Left leg, mirrored)
    if (bonesByName.shoulder_r) {
      bonesByName.shoulder_r.rotation.set(-0.04 * swingR, 0, -0.02 * swingR);
    }
    if (bonesByName.upperarm_r && bonesByName.forearm_r && bonesByName.hand_r) {
      const shoulderPitch = swingR > 0
        ? -armSwingAmp * 0.75 * swingR
        : armSwingAmp * 0.40 * (-swingR);

      const shoulderRoll = -(0.06 + 0.03 * swingR);
      const shoulderYaw = 0.05 * swingR;
      bonesByName.upperarm_r.rotation.set(shoulderPitch, shoulderYaw, shoulderRoll);

      const elbowFlex = swingR > 0
        ? -(0.25 + elbowFlexAmp * 1.25 * swingR)
        : -(0.22 + 0.12 * (-swingR));
      bonesByName.forearm_r.rotation.set(elbowFlex, 0, 0);

      const wristLag = wristLagAmp * 0.5 * Math.cos(twoPi * phaseL);
      bonesByName.hand_r.rotation.set(wristLag, 0, 0);
    }

    // Update bone matrices in character armature
    if (character.rootBone) {
      character.rootBone.updateWorldMatrix(true, true);
    }

    // Measure exact realized foot bone world positions
    if (bonesByName.foot_l) {
      bonesByName.foot_l.getWorldPosition(_realizedFootPosL);
    }
    if (bonesByName.foot_r) {
      bonesByName.foot_r.getWorldPosition(_realizedFootPosR);
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
        rightHeight: footPlacementR.targetPos.y,
        leftRealizedY: _realizedFootPosL.y,
        rightRealizedY: _realizedFootPosR.y,
        leftRealizedPos: { x: _realizedFootPosL.x, y: _realizedFootPosL.y, z: _realizedFootPosL.z },
        rightRealizedPos: { x: _realizedFootPosR.x, y: _realizedFootPosR.y, z: _realizedFootPosR.z },
        leftError: Math.abs(_realizedFootPosL.y - footPlacementL.targetPos.y),
        rightError: Math.abs(_realizedFootPosR.y - footPlacementR.targetPos.y)
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
