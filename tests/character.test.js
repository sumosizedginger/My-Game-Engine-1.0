import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUMANOID_PARAMETER_BOUNDS,
  HUMANOID_PRESETS,
  resolveHumanoidParameters,
  createCharacterDefinition,
  computeSemanticLandmarks,
  REGIONS,
  createHumanoidGeometry,
  BONE_DEFINITIONS,
  BONE_NAME_TO_INDEX,
  createHumanoidSkeleton,
  applyHumanoidSkinning,
  buildHumanoidCharacter
} from '../src/character/index.js';

describe('Character Forge — Definition & Parameters', () => {
  it('resolves standard average preset with all bounded fields', () => {
    const { parameters, diagnostics } = resolveHumanoidParameters('average');
    assert.equal(diagnostics.length, 0);
    assert.equal(parameters.height, 1.80);
    assert.equal(parameters.shoulderWidth, 0.44);
    assert.equal(parameters.legLength, 0.92);
    assert.ok(Object.isFrozen(parameters));
  });

  it('clamps out-of-bounds parameter values and records diagnostic warnings', () => {
    const { parameters, diagnostics } = resolveHumanoidParameters({
      height: 3.50, // exceeds max 2.20
      shoulderWidth: 0.10 // below min 0.32
    });

    assert.equal(parameters.height, HUMANOID_PARAMETER_BOUNDS.height.max);
    assert.equal(parameters.shoulderWidth, HUMANOID_PARAMETER_BOUNDS.shoulderWidth.min);
    assert.ok(diagnostics.some(d => d.code === 'CHAR_PARAM_CLAMPED_MAX'));
    assert.ok(diagnostics.some(d => d.code === 'CHAR_PARAM_CLAMPED_MIN'));
  });

  it('handles unknown preset gracefully with diagnostic fallback', () => {
    const { parameters, diagnostics } = resolveHumanoidParameters('nonexistent_preset');
    assert.equal(parameters.height, 1.80);
    assert.ok(diagnostics.some(d => d.code === 'CHAR_UNKNOWN_PRESET'));
  });

  it('creates immutable CharacterDefinition record', () => {
    const def = createCharacterDefinition({ id: 'hero_char', parameters: 'athletic' });
    assert.equal(def.id, 'hero_char');
    assert.equal(def.type, 'character');
    assert.equal(def.data.preset, 'athletic');
    assert.equal(def.data.parameters.height, 1.85);
    assert.ok(Object.isFrozen(def));
    assert.ok(Object.isFrozen(def.data));
  });
});

describe('Character Forge — Semantic Landmarks', () => {
  it('computes deterministic landmark positions matching anatomical constraints', () => {
    const { parameters } = resolveHumanoidParameters('average');
    const landmarks = computeSemanticLandmarks(parameters);

    // Root at ground origin
    assert.deepEqual(landmarks.root, { x: 0, y: 0, z: 0 });

    // Head apex equals character height
    assert.equal(landmarks.headApex.y, parameters.height);

    // Spine chain ascends vertically
    assert.ok(landmarks.pelvis.y > 0);
    assert.ok(landmarks.spine.y > landmarks.pelvis.y);
    assert.ok(landmarks.chest.y > landmarks.spine.y);
    assert.ok(landmarks.neck.y > landmarks.chest.y);
    assert.ok(landmarks.head.y > landmarks.neck.y);
    assert.ok(landmarks.headApex.y > landmarks.head.y);

    // Bilateral symmetry (X is inverted, Y and Z match)
    assert.equal(landmarks['shoulder.L'].x, -landmarks['shoulder.R'].x);
    assert.equal(landmarks['shoulder.L'].y, landmarks['shoulder.R'].y);
    assert.equal(landmarks['elbow.L'].x, -landmarks['elbow.R'].x);
    assert.equal(landmarks['wrist.L'].x, -landmarks['wrist.R'].x);
    assert.equal(landmarks['hip.L'].x, -landmarks['hip.R'].x);
    assert.equal(landmarks['knee.L'].x, -landmarks['knee.R'].x);
    assert.equal(landmarks['ankle.L'].x, -landmarks['ankle.R'].x);
  });
});

describe('Character Forge — Geometry Generation', () => {
  it('generates indexed deformation-ready mesh with finite coordinates and valid regions', () => {
    const { parameters } = resolveHumanoidParameters('average');
    const landmarks = computeSemanticLandmarks(parameters);
    const { geometry, rawData } = createHumanoidGeometry(parameters, landmarks);

    assert.ok(rawData.vertexCount > 300, `Expected > 300 vertices, got ${rawData.vertexCount}`);
    assert.ok(rawData.triangleCount > 500, `Expected > 500 triangles, got ${rawData.triangleCount}`);

    // Verify all positions and normals are finite numbers
    for (let i = 0; i < rawData.positions.length; i++) {
      assert.ok(Number.isFinite(rawData.positions[i]), `Position[${i}] is non-finite`);
    }
    for (let i = 0; i < rawData.normals.length; i++) {
      assert.ok(Number.isFinite(rawData.normals[i]), `Normal[${i}] is non-finite`);
    }

    // Verify all vertices have valid semantic region IDs
    const validRegions = new Set(Object.values(REGIONS));
    for (let i = 0; i < rawData.regionIds.length; i++) {
      assert.ok(validRegions.has(rawData.regionIds[i]), `Invalid region ID ${rawData.regionIds[i]}`);
    }

    // Verify geometry bounding box
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    assert.ok(box.min.y >= -0.05, `Mesh sinks beneath floor: min.y = ${box.min.y}`);
    assert.ok(box.max.y <= parameters.height + 0.05, `Mesh exceeds height: max.y = ${box.max.y}`);
  });
});

describe('Character Forge — Skeleton Hierarchy', () => {
  it('instantiates the canonical 22-bone hierarchy with valid bind matrices', () => {
    const { parameters } = resolveHumanoidParameters('average');
    const landmarks = computeSemanticLandmarks(parameters);
    const { skeleton, rootBone, bonesByName, bones, bonesData } = createHumanoidSkeleton(landmarks);

    assert.equal(bones.length, 22);
    assert.equal(bonesData.length, 22);

    // Root is root
    assert.equal(rootBone.name, 'root');
    assert.equal(rootBone.parent, null);

    // Hierarchy sanity
    assert.equal(bonesByName.pelvis.parent, rootBone);
    assert.equal(bonesByName.spine.parent, bonesByName.pelvis);
    assert.equal(bonesByName.chest.parent, bonesByName.spine);
    assert.equal(bonesByName.neck.parent, bonesByName.chest);
    assert.equal(bonesByName.head.parent, bonesByName.neck);
    assert.equal(bonesByName.thigh_l.parent, bonesByName.pelvis);
    assert.equal(bonesByName.shin_l.parent, bonesByName.thigh_l);
    assert.equal(bonesByName.foot_l.parent, bonesByName.shin_l);
    assert.equal(bonesByName.upperarm_l.parent, bonesByName.shoulder_l);
    assert.equal(bonesByName.forearm_l.parent, bonesByName.upperarm_l);

    // Inverses are computed and non-empty
    assert.equal(skeleton.boneInverses.length, 22);
  });
});

describe('Character Forge — Skinning & Normalization Invariant', () => {
  it('satisfies the strict normalization invariant sum(w_i) == 1.0 for every vertex', () => {
    const { parameters } = resolveHumanoidParameters('average');
    const landmarks = computeSemanticLandmarks(parameters);
    const { geometry } = createHumanoidGeometry(parameters, landmarks);
    const { stats } = applyHumanoidSkinning(geometry, landmarks);

    assert.ok(stats.allNormalized, `Normalization invariant failed with max error: ${stats.maxNormalizationError}`);

    const weights = geometry.getAttribute('skinWeight');
    const indices = geometry.getAttribute('skinIndex');

    for (let i = 0; i < weights.count; i++) {
      const w0 = weights.getX(i);
      const w1 = weights.getY(i);
      const w2 = weights.getZ(i);
      const w3 = weights.getW(i);
      const sum = w0 + w1 + w2 + w3;

      assert.ok(
        Math.abs(sum - 1.0) < 1e-4,
        `Vertex ${i} weights [${w0}, ${w1}, ${w2}, ${w3}] sum to ${sum} (deviation ${Math.abs(sum - 1.0)})`
      );

      // Verify bone indices are within range [0, 21]
      const b0 = indices.getX(i);
      const b1 = indices.getY(i);
      const b2 = indices.getZ(i);
      const b3 = indices.getW(i);
      assert.ok(b0 >= 0 && b0 < 22, `Invalid bone index ${b0}`);
      assert.ok(b1 >= 0 && b1 < 22, `Invalid bone index ${b1}`);
      assert.ok(b2 >= 0 && b2 < 22, `Invalid bone index ${b2}`);
      assert.ok(b3 >= 0 && b3 < 22, `Invalid bone index ${b3}`);
    }
  });

  it('prevents contralateral weight bleeding for limbs', () => {
    const { parameters } = resolveHumanoidParameters('average');
    const landmarks = computeSemanticLandmarks(parameters);
    const { geometry } = createHumanoidGeometry(parameters, landmarks);
    applyHumanoidSkinning(geometry, landmarks);

    const pos = geometry.getAttribute('position');
    const reg = geometry.getAttribute('region');
    const indices = geometry.getAttribute('skinIndex');
    const weights = geometry.getAttribute('skinWeight');

    const rightBoneIndices = new Set([
      BONE_NAME_TO_INDEX.shoulder_r,
      BONE_NAME_TO_INDEX.upperarm_r,
      BONE_NAME_TO_INDEX.forearm_r,
      BONE_NAME_TO_INDEX.hand_r,
      BONE_NAME_TO_INDEX.thigh_r,
      BONE_NAME_TO_INDEX.shin_r,
      BONE_NAME_TO_INDEX.foot_r,
      BONE_NAME_TO_INDEX.toe_r
    ]);

    // Check left limb vertices: must NOT have weight on right bones
    for (let i = 0; i < pos.count; i++) {
      const r = reg.getX(i);
      const isLeftLimb = (
        r === REGIONS.UPPER_ARM_L ||
        r === REGIONS.LOWER_ARM_L ||
        r === REGIONS.HAND_L ||
        r === REGIONS.THIGH_L ||
        r === REGIONS.SHIN_L ||
        r === REGIONS.FOOT_L
      );

      if (isLeftLimb) {
        for (const [boneIdx, weight] of [
          [indices.getX(i), weights.getX(i)],
          [indices.getY(i), weights.getY(i)],
          [indices.getZ(i), weights.getZ(i)],
          [indices.getW(i), weights.getW(i)]
        ]) {
          if (weight > 0.01) {
            assert.ok(
              !rightBoneIndices.has(boneIdx),
              `Left limb vertex ${i} (region ${r}) leaked weight ${weight} to right bone ${boneIdx}`
            );
          }
        }
      }
    }
  });
});

describe('Character Forge — Assembled Humanoid Character', () => {
  it('builds complete SkinnedMesh for average, athletic, and heavy presets', () => {
    for (const preset of ['average', 'athletic', 'heavy']) {
      const char = buildHumanoidCharacter(preset);
      assert.ok(char.mesh.isSkinnedMesh);
      assert.equal(char.skeleton.bones.length, 22);
      assert.ok(char.geometry.getAttribute('position').count > 300);
      assert.ok(char.geometry.getAttribute('skinWeight').count > 300);
    }
  });
});
