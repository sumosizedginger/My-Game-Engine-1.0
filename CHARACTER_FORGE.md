# CHARACTER_FORGE.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **Proof B1 — Motion Truth**

This document defines the durable procedural character generation architecture of My Game Engine 1.0. It documents the contracts, data structures, and mathematical invariants established and evidenced by Proof B1.

---

## 1. Core Architectural Laws

1. **Code-Native Generation**: Character meshes, armatures, and skinning weights originate purely from deterministic TypeScript/JavaScript algorithms, parameters, and seeds. No external finished mesh downloads (e.g. FBX, glTF, OBJ) or third-party modeling software (Blender, Maya, ZBrush) are foundational requirements.
2. **Definition / Artifact / Runtime Separation**: Character definitions specify anatomical parameters and presets; the compiler seam compiles them into immutable artifacts with content fingerprints; the runtime instantiates transient skinned meshes.
3. **Semantic Landmarks as Stable Anchors**: Limb attachments, joints, and skeletal positions derive from semantic landmark vectors in 3D character space, never from brittle vertex indices.
4. **Deformation-Ready Loop Topology**: Cylindrical limb and torso meshes feature explicit multi-ring edge loop clusters concentrated at articulated bend axes (knees, elbows, waist/spine, neck) to prevent volume loss, pinched dome caps, and candy-wrapper twisting during rotation.
5. **Canonical 22-Bone Armature**: Characters utilize a deterministic, hierarchical 22-bone skeleton (`root`, `pelvis`, `spine`, `chest`, `neck`, `head`, bilateral `shoulder/upperarm/forearm/hand`, and bilateral `thigh/shin/foot/toe`).
6. **Strict Normalization Invariant**: Skinning influences are strictly clamped to a maximum of 4 bones per vertex, and the sum of weights must equal 1.0 ($\sum_{k=0}^3 w_k = 1.0$) with maximum error $< 10^{-5}$ across 100% of vertices.
7. **Region-Gated Influence Attribution**: Every vertex carries an immutable semantic body region tag (e.g. `UPPER_ARM_L`, `THIGH_R`). Skinning distance fields only evaluate candidate bones permitted for that region, eliminating contralateral weight bleeding.

---

## 2. Parameter Domain & Presets

Character dimensions derive from the machine-readable `HUMANOID_PARAMETER_BOUNDS` domain. Values outside bounds are clamped deterministically and emit diagnostic warnings.

### 2.1 Bounded Parameter Domain

```text
Parameter           Min       Max       Default    Unit
-----------------------------------------------------------------
height              1.40      2.20      1.80       meters
shoulderWidth       0.32      0.60      0.44       meters
chestWidth          0.12      0.28      0.18       meters
chestDepth          0.08      0.22      0.13       meters
waistWidth          0.09      0.24      0.14       meters
waistDepth          0.07      0.20      0.11       meters
pelvisWidth         0.11      0.26      0.16       meters
pelvisDepth         0.08      0.20      0.12       meters
armLength           0.50      0.90      0.70       meters
armMass             0.60      1.60      1.00       scalar
legLength           0.70      1.20      0.92       meters
legMass             0.60      1.60      1.00       scalar
headScale           0.80      1.30      1.00       scalar
neckLength          0.07      0.18      0.11       meters
neckThickness       0.04      0.10      0.06       meters
radialSegments      8         32        16         count
torsoSegments       10        32        16         count
limbSegments        8         24        12         count
```

### 2.2 Standard Presets

- **`average`**: Standard adult proportions (1.80m height, 0.44m shoulder, 0.92m leg length).
- **`athletic`**: Enhanced shoulder width and arm/leg mass (1.85m height, 0.48m shoulder, 1.15x arm mass).
- **`heavy`**: Broad torso, expanded chest and waist depth (1.78m height, 0.50m shoulder, 1.35x arm mass).

---

## 3. Semantic Landmarks

Semantic landmarks provide definition-space 3D vectors $\{x, y, z\}$ for skeletal joints and attachment points:

```text
Spine Chain:
  root       -> (0, 0, 0)
  pelvis     -> (0, hipY, 0)
  spine      -> (0, waistY, -0.005)
  chest      -> (0, chestY, 0.005)
  neck       -> (0, neckBaseY, 0)
  head       -> (0, headCenterY, 0.01)
  headApex   -> (0, height, 0)

Left Upper Limb (mirrored X for Right):
  clavicle.L -> (shoulderHalf * 0.35, shoulderY - 0.01, 0.01)
  shoulder.L -> (shoulderHalf, shoulderY, 0)
  elbow.L    -> (shoulderHalf + 0.03, shoulderY - upperArmL, -0.015)
  wrist.L    -> (shoulderHalf + 0.035, shoulderY - upperArmL - forearmL, 0)
  hand.L     -> (shoulderHalf + 0.04, shoulderY - upperArmL - forearmL - handL, 0)

Left Lower Limb (mirrored X for Right):
  hip.L      -> (hipHalf, hipY, 0)
  knee.L     -> (hipHalf, hipY - thighL, 0.012)
  ankle.L    -> (hipHalf, footH, 0)
  heel.L     -> (hipHalf, 0, -footLength * 0.30)
  toe.L      -> (hipHalf, 0, footLength * 0.70)
```

---

## 4. Deformation-Ready Geometry & Topology

Humanoid meshes are generated using lofted cross-sectional rings.

### 4.1 Topology Rules

1. **Continuous Limb Tubes**: Limbs are generated as continuous parametric tubes spanning proximal to distal joints (shoulder $\to$ elbow $\to$ wrist, hip $\to$ knee $\to$ ankle). Internal interior dome caps are strictly prohibited between adjacent limb segments.
2. **Joint Loop Clusters**: Exactly 3 edge loops are clustered within $\pm 2.5\text{ cm}$ of the bend axis at knees, elbows, and waist. When bones rotate, these rings distribute the curvature evenly.
3. **Flared Torso Shoulders**: The upper chest flaring matches the lateral shoulder joint coordinates ($x \approx \pm \text{shoulderHalf}$) to ensure the torso and upper arm intersect seamlessly without gaps.
4. **Anatomical Head Proportion**: The cranial volume is an ellipsoid with height $H_{\text{head}} = 0.13 \times H$ ($\approx 23.4\text{ cm}$), width $16.6\text{ cm}$, and depth $20.8\text{ cm}$, tapering at the jaw.
5. **Flat Foot Base**: The sole of the foot geometry rests cleanly on the ground plane $Y = 0$, guaranteeing zero penetration beneath the floor.

---

## 5. Canonical 22-Bone Skeleton Hierarchy

The bone tree is strictly ordered such that every parent precedes its descendants:

```text
Index  Bone Name      Parent Bone    Landmark Anchor
------------------------------------------------------
0      root           (null)         root
1      pelvis         root           pelvis
2      spine          pelvis         spine
3      chest          spine          chest
4      neck           chest          neck
5      head           neck           head
6      shoulder_l     chest          clavicle.L
7      upperarm_l     shoulder_l     shoulder.L
8      forearm_l      upperarm_l     elbow.L
9      hand_l         forearm_l      wrist.L
10     shoulder_r     chest          clavicle.R
11     upperarm_r     shoulder_r     shoulder.R
12     forearm_r      upperarm_r     elbow.R
13     hand_r         forearm_r      wrist.R
14     thigh_l        pelvis         hip.L
15     shin_l         thigh_l        knee.L
16     foot_l         shin_l         ankle.L
17     toe_l          foot_l         toe.L
18     thigh_r        pelvis         hip.R
19     shin_r         thigh_r        knee.R
20     foot_r         shin_r         ankle.R
21     toe_r          foot_r         toe.R
```

Local bone positions are calculated as relative offsets from parent landmarks:
$$\vec{p}_{\text{local}} = \vec{p}_{\text{landmark}} - \vec{p}_{\text{parent\_landmark}}$$

Bind matrices and inverse bind matrices are computed synchronously via Three.js `Skeleton.calculateInverses()`.

---

## 6. Procedural Skinning & Normalization Invariant

### 6.1 Distance-to-Segment Math

For every vertex $P(x, y, z)$ and bone segment $AB$:
$$\vec{u} = \vec{B} - \vec{A}$$
$$t = \text{clamp}\left( \frac{(\vec{P} - \vec{A}) \cdot \vec{u}}{|\vec{u}|^2}, 0, 1 \right)$$
$$\text{proj} = \vec{A} + t \cdot \vec{u}$$
$$d = |\vec{P} - \text{proj}|$$

The raw bone weight uses inverse distance with smoothing radius $\epsilon = 0.01\text{ m}$:
$$w_{\text{raw}} = \frac{1}{(d + \epsilon)^2}$$

### 6.2 Normalization Invariant

The top 4 candidate bone weights are selected, and all 4 weights are normalized:
$$S = \sum_{k=0}^3 w_k$$
$$w_k = \frac{w_k}{S}$$

The primary influence absorbs any floating-point residual:
$$w_0 \mathrel{+}= 1.0 - \sum_{k=0}^3 w_k$$

Guaranteeing:
$$\left| \sum_{k=0}^3 w_k - 1.0 \right| < 10^{-5} \quad \forall \text{ vertices}$$

---

## 7. Kiln Seam & High-Level Assembly

The `buildHumanoidCharacter(input, materialOptions)` factory executes the complete pipeline:
1. Resolves parameters via `resolveHumanoidParameters()`.
2. Computes landmarks via `computeSemanticLandmarks()`.
3. Generates deformation geometry via `createHumanoidGeometry()`.
4. Instantiates skeleton via `createHumanoidSkeleton()`.
5. Synthesizes skin weights via `applyHumanoidSkinning()`.
6. Binds `Skeleton` to `SkinnedMesh`.
7. Returns a self-contained character record with geometry, skeleton, root bone, and metadata.

---

## 8. Non-Goals & Boundaries for Character Forge

1. **No Hero Mesh Import**: Does not load static binary models as base meshes.
2. **No Hair or Dynamic Cloth Sim**: Secondary physics belongs to later dedicated FX proofs.
3. **No Facial Rigging**: Facial animation and phoneme shapes belong to later character expression proofs.
4. **No Transform Authority Mutation**: Character Forge does not mutate entity world transforms; transforms are owned solely by the engine runtime.
