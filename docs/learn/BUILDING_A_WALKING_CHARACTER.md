# Building a Walking Character: The Proof B1 Architecture Walkthrough

## Status

**ACCEPTED LEARNING MATERIAL**  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Ground truth base revision: `52eb3b3c91d725e9a73ebb1ea658b393a12029b4`  
Governing specifications: [`CHARACTER_FORGE.md`](../../CHARACTER_FORGE.md) and [`MOTION_FORGE.md`](../../MOTION_FORGE.md)  
Primary source implementation: [`src/character/`](../../src/character/) and [`src/motion/`](../../src/motion/)

---

## 1. What Proof B1 Proves

**Proof B1 (Motion Truth)** establishes the procedural 3D character generation and locomotion pipeline for **My Game Engine 1.0**.

The central architectural thesis of Proof B1 is:

> *Can a browser-first, code-native engine synthesize a complete humanoid character and evaluate believable, contact-grounded locomotion entirely from mathematical definitions—without importing downloaded meshes, FBX/glTF files, Blender models, or pre-baked animation clips?*

Proof B1 answers this in the affirmative by proving that:
1. **Humanoid form can be defined deterministically** through bounded anatomical parameters and presets (average, athletic, heavy) rather than static binary assets.
2. **Semantic landmarks anchor the body** in definition space, establishing stable attachment points for bones and mesh cross-sections without brittle vertex index dependencies.
3. **Deformation-ready geometry can be lofted algorithmically**, featuring continuous limb tubes, joint loop clusters, spherical articulation domes, and a foot sole resting flush on the ground plane.
4. **The skeletal hierarchy is strictly ordered** (22 canonical bones), computing bind and inverse-bind matrices synchronously in code.
5. **Procedural skin weights follow a strict normalization invariant**: $\sum_{i=1}^4 w_i = 1.0$ for every single vertex, with semantic region gating preventing contralateral weight bleeding.
6. **Locomotion can be evaluated analytically** using a parameterized gait cycle divided into stance and swing phases.
7. **Analytical two-bone IK solves limb articulation in closed form**, using the Law of Cosines with singularity reach clamping and pole vector orientation.
8. **Foot grounding must be enforced on realized rendered bones**, not merely on analytic motion targets. The rendered foot bones must plant firmly without floating ($\le 25\text{ mm}$ peak, $\le 10\text{ mm}$ mean) or penetrating the floor ($Y \ge \text{footH} - 0.001\text{ m}$).
9. **Locomotion requires whole-body counter-dynamics**: pelvic bounce, lateral weight-transfer sway, pelvic roll and yaw, thoracic counter-rotation, and bi-directional arm swing with elbow flexion.
10. **Animation intent respects single-writer transform authority**: motion systems output `rootMotionIntent`, and only the designated transform system commits position in world space.
11. **The entire pipeline runs in standard browsers and static web hosting**, verified automatically by unit tests (70/70) and a headless browser evaluation harness (15/15 checks).

---

## 2. Where the Character & Motion Implementations Live

All source files for Proof B1 are organized into modular, decoupled packages under `src/`:

```text
My-Game-Engine-1.0/
├── src/
│   ├── character/                # Character Forge: Procedural Humanoid Synthesis
│   │   ├── definition.js         # Bounded parameters, presets (average, athletic, heavy)
│   │   ├── landmarks.js          # Deterministic 3D semantic landmark anchors
│   │   ├── geometry.js           # Lofted axial torso/head and continuous limb tubes
│   │   ├── skeleton.js           # Canonical 22-bone hierarchy & bind matrix setup
│   │   ├── skinning.js           # Distance-to-segment weights, region gating, normalization
│   │   └── index.js              # Public barrel export and buildHumanoidCharacter()
│   ├── motion/                   # Motion Forge: Procedural Kinematics & Locomotion
│   │   ├── definition.js         # Locomotion parameters, presets (natural, energetic, stroll)
│   │   ├── ik.js                 # Closed-form analytical 2-bone IK solver
│   │   ├── grounding.js          # Foot placement, heel strike, midstance, toe push-off
│   │   ├── generator.js          # Gait phase timeline, pelvis dynamics, arm swings
│   │   ├── root-motion.js        # Root motion intent & single-writer transform commits
│   │   └── index.js              # Public barrel export for Motion Forge
│   ├── browser/
│   │   ├── b1-viewer.js          # Interactive 3D Motion Studio & evaluation bridge
│   │   └── main.js               # Route dispatcher (boot, Pong, B1)
│   └── eval/                     # Headless browser evaluation harness (Puppeteer)
│       ├── harness.js            # Three-target evaluator (Phase 0, Pong, B1)
│       ├── browser.js            # Browser driver inspecting window.__PROOF_B1_MOTION__
│       └── run.js                # CLI runner for `npm run eval`
└── tests/
    ├── character.test.js         # Unit tests for definition, landmarks, geometry, skinning
    └── motion.test.js            # Unit tests for motion parameters, IK, grounding, generator
```

---

## 3. Humanoid Definition and Parameter Resolution

Every character in My Game Engine 1.0 begins as a declarative, serializable definition following the Engine's foundational asset lifecycle:

```text
Definition (Source) ───> Compilation / Validation ───> Runtime Skinned Mesh
```

### 3.1 Parameter Bounds
In [`src/character/definition.js`](../../src/character/definition.js), `HUMANOID_PARAMETER_BOUNDS` defines the mathematical domain of all anatomical parameters:

```javascript
// Excerpt from src/character/definition.js
export const HUMANOID_PARAMETER_BOUNDS = Object.freeze({
  height: { min: 1.40, max: 2.20, default: 1.80 },
  shoulderWidth: { min: 0.32, max: 0.60, default: 0.44 },
  chestWidth: { min: 0.12, max: 0.28, default: 0.18 },
  chestDepth: { min: 0.08, max: 0.22, default: 0.13 },
  waistWidth: { min: 0.09, max: 0.24, default: 0.14 },
  waistDepth: { min: 0.07, max: 0.20, default: 0.11 },
  pelvisWidth: { min: 0.11, max: 0.26, default: 0.16 },
  pelvisDepth: { min: 0.08, max: 0.20, default: 0.12 },
  armLength: { min: 0.50, max: 0.90, default: 0.70 },
  armMass: { min: 0.60, max: 1.60, default: 1.00 },
  legLength: { min: 0.70, max: 1.20, default: 0.92 },
  legMass: { min: 0.60, max: 1.60, default: 1.00 },
  headScale: { min: 0.80, max: 1.30, default: 1.00 },
  neckLength: { min: 0.07, max: 0.18, default: 0.11 },
  neckThickness: { min: 0.04, max: 0.10, default: 0.06 },
  radialSegments: { min: 8, max: 32, default: 16 },
  torsoSegments: { min: 10, max: 32, default: 16 },
  limbSegments: { min: 8, max: 24, default: 12 }
});
```

### 3.2 Standard Presets
Three canonical presets are frozen in `HUMANOID_PRESETS`:
- **`average`**: Baseline standard humanoid ($H = 1.80\text{ m}$, balanced athletic build).
- **`athletic`**: Taller, wider shoulder taper ($H = 1.85\text{ m}$, shoulder width $0.48\text{ m}$, narrower waist $0.13\text{ m}$).
- **`heavy`**: Broader, thicker torso and limbs ($H = 1.78\text{ m}$, chest width $0.23\text{ m}$, waist width $0.20\text{ m}$, leg mass $1.30$).

### 3.3 Defensive Parameter Resolution
The function `resolveHumanoidParameters(raw)` sanitizes incoming definitions:
- Unknown presets trigger a structured diagnostic warning (`WARN_UNKNOWN_PRESET`) and fall back safely to `average`.
- Numeric values are clamped to their valid min/max domain, logging `WARN_PARAM_CLAMPED` if modified.
- Returns an immutable, frozen parameters record.

---

## 4. Semantic Landmarks: Joint Anchors in Definition Space

In traditional 3D pipelines, skeletons are bound to meshes using artist-assigned vertex groups or brittle vertex index tables. If the vertex count changes, the rig breaks.

My Game Engine 1.0 uses **Semantic Landmarks** ([`src/character/landmarks.js`](../../src/character/landmarks.js)). Landmarks are deterministic 3D vectors computed in character space ($X = \text{lateral}, Y = \text{vertical}, Z = \text{sagittal}$) that anchor joints and body sections:

```text
Spine Chain:
  root       -> (0, 0, 0)
  pelvis     -> (0, hipY, -0.020)
  spine      -> (0, waistY, 0.008)
  chest      -> (0, chestY, 0.010)
  neck       -> (0, neckBaseY, -0.010)
  head       -> (0, headCenterY, 0.005)
  headApex   -> (0, height, -0.010)

Left Upper Limb (mirrored X for Right):
  clavicle.L -> (shoulderHalf * 0.35, neckBaseY - 0.015, 0.005)
  shoulder.L -> (shoulderHalf * 0.86, shoulderY, 0.002)
  elbow.L    -> (shoulderHalf * 0.82, shoulderY - upperArmL, -0.015)
  wrist.L    -> (shoulderHalf * 0.78, shoulderY - upperArmL - forearmL, 0)
  hand.L     -> (shoulderHalf * 0.76, shoulderY - upperArmL - forearmL - handL, 0)

Left Lower Limb (mirrored X for Right):
  hip.L      -> (hipHalf, hipY, -0.015)
  knee.L     -> (hipHalf, hipY - thighL, 0.012)
  ankle.L    -> (hipHalf, footH, 0)
  heel.L     -> (hipHalf, 0, -footLength * 0.30)
  toe.L      -> (hipHalf, 0, footLength * 0.70)
```

### Anatomical S-Curve
Notice that the spine landmarks do not sit on a flat vertical line ($Z = 0$). They establish an anatomical human spinal curve:
- **Sacral Kyphosis**: Pelvis displaced backward to $Z = -0.020\text{ m}$.
- **Lumbar Lordosis**: Spine arches forward to $Z = +0.008\text{ m}$.
- **Thoracic Kyphosis**: Chest expands forward to $Z = +0.010\text{ m}$.
- **Cervical Slant**: Neck base slopes slightly backward to $Z = -0.010\text{ m}$.
- **Knee Micro-bend**: The resting knee has an anatomical forward offset ($Z = +0.012\text{ m}$) ensuring the IK solver flexes forward naturally without joint inversion.

---

## 5. Procedural Deformation-Ready Geometry

In [`src/character/geometry.js`](../../src/character/geometry.js), `createHumanoidGeometry()` builds an indexed Three.js `BufferGeometry` from the resolved parameters and landmarks.

### 5.1 Axial Body Loft
The torso, neck, and head are constructed as a continuous loft across 25 horizontal elliptical cross-sections:
- **Pelvic Bowl**: Starts at the perineum ($Y = \text{hipY} - 0.040\text{ m}$) and flares smoothly to the iliac crests, eliminating flat boxy skirts.
- **Waist / Navel**: Narrows to `params.waistWidth` with subtle forward lumbar lordosis.
- **Thoracic Cage & Pectorals**: Expands into an athletic pectoral shelf at `chestY`.
- **Acromial Shoulder Girdle**: Flared chest stations nest the shoulder joints cleanly without hollow armpit gaps.
- **Trapezius Slope**: Natural $11^\circ$ slope connecting neck base to shoulder tips.
- **Cranial Vault**: An 8-station cranial ellipsoid modeling the chin shelf, mandible jawline, maxilla cheekbones, brow ridge, and parietal vault.

### 5.2 Continuous Limb Tubes
Arms and legs are generated using `buildLimbTube()`, sweeping elliptical rings along 3D joint paths:
1. **True Spherical Articulation Domes**: Proximal origins (deltoid and femoral head) are modeled as exact mathematical hemispheres centered at the joint pivots (`shoulder.L`, `hip.L`). Because they are spherical about the pivot, they remain invariant under rotation—preventing bat-wing spikes, horns, or apron punch-through when rotated.
2. **Joint Loop Clusters**: Exactly 3 edge loops are clustered within $\pm 2.0-2.5\text{ cm}$ of the bend axes at elbows and knees to prevent volume collapse during flexion.
3. **Anatomical Contours**:
   - Arms taper from deltoid through bicep, elbow, and forearm to a flattened palm paddle hand.
   - Legs feature gastrocnemius calf swell ($Z = -0.010\text{ m}$), supramalleolar taper, and subtalar ankle base.
4. **Longitudinal Grounded Foot**: The foot is built as a longitudinal tube along $+Z$, spanning from posterior calcaneus heel ($Z = -0.0756\text{ m}$), through ankle talus base, medial arch, and metatarsal ball, to toes ($Z = +0.1764\text{ m}$). The lowest vertices rest precisely on the floor ($Y = 0.000\text{ m}$, $|Y| \le 0.001\text{ m}$).

> **Current Mesh Resolution**: For the standard average preset with default parameters (`torsoSegments: 16`, `limbSegments: 12`), the generated mesh contains approximately **1,401 vertices** and **2,576 triangles**. Polygon counts scale dynamically when segment parameters are altered.

---

## 6. Canonical 22-Bone Skeleton Hierarchy

The bone hierarchy ([`src/character/skeleton.js`](../../src/character/skeleton.js)) forms a strict topological tree where every parent precedes its descendants:

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

Three.js `Bone` objects are instantiated, added to their parent bones, and assembled into a `Skeleton`. The bind matrices and inverse-bind matrices are computed synchronously via `skeleton.calculateInverses()`.

---

## 7. Procedural Skin Weights & Normalization Invariant

In [`src/character/skinning.js`](../../src/character/skinning.js), skin weights are computed algorithmically using **distance-to-segment math**:

```javascript
// Excerpt from src/character/skinning.js
function distanceSqPointToSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 1e-8) return apx * apx + apy * apy + apz * apz;

  let t = (apx * abx + apy * aby + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const dx = px - (ax + t * abx);
  const dy = py - (ay + t * aby);
  const dz = pz - (az + t * abz);
  return { distSq: dx * dx + dy * dy + dz * dz, t };
}
```

For every vertex, distance $d$ to each candidate bone segment is computed. Raw bone weight uses inverse distance with smoothing radius $\epsilon = 0.015\text{ m}$:
$$w_{\text{raw}} = \frac{1}{(d + \epsilon)^2}$$

### Strict Normalization Invariant
The top 4 bone weights for each vertex are sorted, filtered, and normalized so they sum **exactly to 1.0**:
$$\sum_{j=1}^4 w_j = 1.0 \pm 10^{-6}$$
Zero normalization error is permitted. Every vertex is bound to valid bone indices in $[0, 21]$.

---

## 8. Region Gating: Preventing Contralateral Bleeding

A common pitfall in procedural skinning is **weight bleeding**:
- When the left arm swings past the hip, proximity math alone would assign left thigh bone weight to the hand.
- When thighs swing, nearby pelvis vertices might twist and tear if weighted to moving thigh bones.

My Game Engine 1.0 solves this via **Semantic Region Gating**:

```javascript
// Excerpt from src/character/skinning.js
const REGION_CANDIDATE_BONES = Object.freeze({
  [REGIONS.PELVIS]: ['pelvis', 'spine'],
  [REGIONS.SPINE]: ['pelvis', 'spine', 'chest'],
  [REGIONS.CHEST]: ['spine', 'chest', 'neck', 'shoulder_l', 'shoulder_r'],
  [REGIONS.NECK]: ['chest', 'neck', 'head'],
  [REGIONS.HEAD]: ['neck', 'head'],
  [REGIONS.UPPER_ARM_L]: ['shoulder_l', 'upperarm_l', 'forearm_l'],
  [REGIONS.LOWER_ARM_L]: ['upperarm_l', 'forearm_l', 'hand_l'],
  [REGIONS.HAND_L]: ['forearm_l', 'hand_l'],
  [REGIONS.UPPER_ARM_R]: ['shoulder_r', 'upperarm_r', 'forearm_r'],
  [REGIONS.LOWER_ARM_R]: ['upperarm_r', 'forearm_r', 'hand_r'],
  [REGIONS.HAND_R]: ['forearm_r', 'hand_r'],
  [REGIONS.THIGH_L]: ['pelvis', 'thigh_l', 'shin_l'],
  [REGIONS.SHIN_L]: ['thigh_l', 'shin_l', 'foot_l'],
  [REGIONS.FOOT_L]: ['shin_l', 'foot_l', 'toe_l'],
  [REGIONS.THIGH_R]: ['pelvis', 'thigh_r', 'shin_r'],
  [REGIONS.SHIN_R]: ['thigh_r', 'shin_r', 'foot_r'],
  [REGIONS.FOOT_R]: ['shin_r', 'foot_r', 'toe_r'],
  [REGIONS.TORSO]: ['pelvis', 'spine', 'chest']
});
```

Key Architectural Safeguards:
- **Zero Contralateral Bleeding**: Left limb regions never consider right bones; right limb regions never consider left bones.
- **Rigid Pelvic Girdle**: `REGIONS.PELVIS` vertices are restricted to `['pelvis', 'spine']`. Thigh bones cannot deform the pelvis, ensuring the pelvic bowl remains intact during walking.
- **Torso Isolation**: Torso vertices are attributed exclusively to axial spine bones.

---

## 9. Motion Definitions & Locomotion Parameters

In [`src/motion/definition.js`](../../src/motion/definition.js), locomotion is defined as a parameter set governing step timing, amplitudes, and dynamics:

```javascript
// Excerpt from src/motion/definition.js
export const MOTION_PARAMETER_BOUNDS = Object.freeze({
  cadence: { min: 60, max: 160, default: 112 },           // Steps per minute
  strideLength: { min: 0.60, max: 2.00, default: 1.30 },   // Meters per full 2-step cycle
  verticalBounce: { min: 0.005, max: 0.060, default: 0.028 }, // Meters of pelvis bounce
  pelvisRoll: { min: 0.01, max: 0.15, default: 0.065 },    // Radians of pelvic lateral tilt
  pelvisYaw: { min: 0.02, max: 0.20, default: 0.090 },     // Radians of pelvic transverse rotation
  lateralSway: { min: 0.005, max: 0.060, default: 0.022 }, // Meters of lateral weight shift
  armSwing: { min: 0.10, max: 0.80, default: 0.38 },       // Radians of shoulder swing
  elbowFlex: { min: 0.10, max: 0.90, default: 0.45 },      // Radians of elbow flexion during forward swing
  wristLag: { min: 0.02, max: 0.25, default: 0.08 },       // Radians of wrist secondary lag
  torsoCounter: { min: 0.30, max: 1.00, default: 0.75 },   // Torso counter-rotation factor relative to pelvis
  stepHeight: { min: 0.02, max: 0.12, default: 0.055 }     // Meters of foot clearance during swing
});
```

### 9.2 Standard Motion Presets

Three canonical presets are defined in `MOTION_PRESETS`:
- **`natural`**: Baseline balanced everyday walk (112 steps/min, 1.30 m stride, 0.028 m bounce, 0.38 rad arm swing).
- **`energetic`**: Faster athletic stride with exaggerated arm swing and pelvic dynamics (128 steps/min, 1.50 m stride, 0.038 m bounce, 0.52 rad arm swing).
- **`stroll`**: Slower, relaxed stride with reduced bounce and sway (92 steps/min, 1.10 m stride, 0.018 m bounce, 0.25 rad arm swing).

```javascript
// Excerpt from src/motion/definition.js
export const MOTION_PRESETS = Object.freeze({
  natural: Object.freeze({
    cadence: 112,
    strideLength: 1.30,
    verticalBounce: 0.028,
    pelvisRoll: 0.065,
    pelvisYaw: 0.090,
    lateralSway: 0.022,
    armSwing: 0.38,
    elbowFlex: 0.45,
    wristLag: 0.08,
    torsoCounter: 0.75,
    stepHeight: 0.055
  }),
  energetic: Object.freeze({
    cadence: 128,
    strideLength: 1.50,
    verticalBounce: 0.038,
    pelvisRoll: 0.080,
    pelvisYaw: 0.110,
    lateralSway: 0.026,
    armSwing: 0.52,
    elbowFlex: 0.60,
    wristLag: 0.12,
    torsoCounter: 0.85,
    stepHeight: 0.070
  }),
  stroll: Object.freeze({
    cadence: 92,
    strideLength: 1.10,
    verticalBounce: 0.018,
    pelvisRoll: 0.045,
    pelvisYaw: 0.065,
    lateralSway: 0.016,
    armSwing: 0.25,
    elbowFlex: 0.30,
    wristLag: 0.05,
    torsoCounter: 0.60,
    stepHeight: 0.040
  })
});

---

## 10. Gait Phase & Locomotion Timeline

Locomotion is parameterized over a normalized continuous cycle phase:
$$\phi \in [0, 1)$$

Given cadence (steps/minute):
- **Cycle Frequency**: $f = \frac{\text{cadence}}{120.0}$ (full 2-step cycle per second)
- **Forward Speed**: $v = \text{strideLength} \times f$
- **Delta Phase**: $\Delta \phi = f \times \Delta t$

### Bipedal Limb Timing
Human walking has a $180^\circ$ phase offset between the legs:
- **Left Leg Phase**: $\phi_L = \phi$
- **Right Leg Phase**: $\phi_R = (\phi + 0.5) \bmod 1.0$

### Stance vs. Swing Division
In walking, each foot spends approximately **60% of the cycle on the ground (stance)** and **40% in the air (swing)**:
- Stance Phase ($0.00 \le p \le 0.60$): Foot plants, carries weight, moves backward relative to hip.
- Swing Phase ($0.60 < p < 1.00$): Foot lifts, swings forward through air past the hip.

---

## 11. Closed-Form Analytical 2-Bone IK

Given the hip joint position $\vec{A}$ and the computed foot placement target $\vec{C}$, [`src/motion/ik.js`](../../src/motion/ik.js) solves the position of the knee $\vec{B}$ and the resulting bone orientations in closed form.

```text
    A (Hip)
    o
     \
  L1  \  alpha
       \
        o B (Knee)
       /
  L2  /  beta
     /
    o C (Foot Target)
```

### 11.1 Singularity & Hyperextension Protection
When the target distance $d = |\vec{C} - \vec{A}|$ approaches maximum reach $L_1 + L_2$, IK systems often pop or produce `NaN`. The engine enforces a continuous reach clamp:
$$d_{\text{clamped}} = \text{clamp}(d, \, \max(0.005, |L_1 - L_2| \times 1.002), \, (L_1 + L_2) \times 0.9998)$$

### 11.2 Law of Cosines
With clamped distance $d_{\text{clamped}}$:
$$\cos\alpha = \frac{L_1^2 + d_{\text{clamped}}^2 - L_2^2}{2 L_1 d_{\text{clamped}}}, \quad \alpha = \arccos(\text{clamp}(\cos\alpha, -1, 1))$$
$$\cos\beta = \frac{L_1^2 + L_2^2 - d_{\text{clamped}}^2}{2 L_1 L_2}, \quad \beta = \arccos(\text{clamp}(\cos\beta, -1, 1))$$

### 11.3 Pole Vector Orientation
A pole vector (e.g. $\vec{p}_{\text{pole}} = (0, 0, 1)$ for knees) is orthogonalized against the root-to-target line using Gram-Schmidt projection, defining the flexion plane and guaranteeing knees always bend forward.

---

## 12. Foot Grounding: Heel Strike, Midstance, and Toe Push-Off

In [`src/motion/grounding.js`](../../src/motion/grounding.js), `computeGaitFootPlacement()` models natural bipedal foot articulation:

```text
Stance Phase (p in [0.0, 0.60]):
1. Heel Strike   (p: 0.00 -> 0.18): Dorsiflexed pitch (-16 deg), heel touches, rolls to flat
2. Midstance     (p: 0.18 -> 0.65): Perfectly flat on ground (pitch = 0 deg, Y = footH)
3. Toe Push-Off  (p: 0.65 -> 1.00): Heel lifts, toes stay down, rolls up (+23 deg)

Swing Phase (p in [0.60, 1.00]):
Foot lifts into air, clears ground with smooth parabolic curve reaching apex at stepHeight
```

```javascript
// Excerpt from src/motion/grounding.js
if (stanceProgress < 0.18) {
  // Heel Strike: foot angled upward (dorsiflexion), smoothly relaxing to flat foot
  const t = stanceProgress / 0.18;
  const s = t * t * (3 - 2 * t); // Smoothstep C1
  pitch = PITCH_HEEL * (1 - s);
  y = footH + Math.sin(-pitch) * 0.015;
} else if (stanceProgress < 0.65) {
  // Midstance / Flat Foot: perfectly flat on ground
  pitch = 0;
  y = footH;
} else {
  // Heel Off / Push Off: heel rises, toe stays down, smooth roll to toe-off
  const t = (stanceProgress - 0.65) / 0.35;
  const s = t * t * (3 - 2 * t);
  pitch = PITCH_TOE * s;
  y = footH + Math.sin(pitch) * 0.025;
}
```

---

## 13. Durable Architectural Lesson: Analytic Target vs. Realized Rendered Pose

This is one of the most critical architectural lessons in 3D character engine engineering:

```text
┌────────────────────────────────────────────────────────┐
│               ANALYTIC MOTION TARGET                   │
│  The mathematical (x, y, z) target produced by         │
│  equations in computeGaitFootPlacement()               │
└──────────────────────────┬─────────────────────────────┘
                           │ (passed to IK solver)
                           ▼
┌────────────────────────────────────────────────────────┐
│                REALIZED RENDERED POSE                  │
│  The actual world-space coordinate of the foot bone    │
│  (character.bonesByName.foot_l.getWorldPosition())    │
│  after parent transforms, pelvis dynamics, IK solve,   │
│  and full Three.js scene-graph matrix updates          │
└────────────────────────────────────────────────────────┘
```

### Why Target Compliance Does Not Equal Grounding
An engine that tests only its analytic formulas will easily report `grounding: PASS` even when the character is visibly hovering 35 mm in the air.

Why?
1. **Pelvis Dynamics**: Pelvic vertical bounce, coronal roll, and lateral sway shift the hip joint in world space. If the IK target is computed relative to the hip without accounting for realized world transforms, the foot floats.
2. **Limb Reach Limits**: If the IK target exceeds the leg's physical reach, clamping keeps the knee straight but pulls the foot off the ground.
3. **Bone Matrix Hierarchy**: The rendered foot position is the accumulated product of `Object3D.matrixWorld`:
   $$M_{\text{foot\_world}} = M_{\text{char}} \times M_{\text{pelvis}} \times M_{\text{thigh}} \times M_{\text{shin}} \times M_{\text{foot}}$$

### The Engine's Law
Grounding is only valid if verified on **realized rendered bones**:
- **Zero Penetration**: Realized foot $Y \ge \text{footH} - 0.001\text{ m}$.
- **Bounded Stance Float**: Maximum stance float $\le 25\text{ mm}$, mean stance float $\le 10\text{ mm}$.

Both unit tests ([`tests/motion.test.js`](../../tests/motion.test.js)) and the evaluation harness ([`src/eval/browser.js`](../../src/eval/browser.js)) sample `character.bonesByName.foot_l.getWorldPosition()` directly:

```javascript
// Excerpt from src/eval/browser.js
const feet = b1.getRealizedFootPositions();
if (feet && stepRes.contactStates) {
  if (stepRes.contactStates.left) {
    const floatL = feet.left.y - footH;
    maxRealizedFloat = Math.max(maxRealizedFloat, floatL);
    minRealizedFloat = Math.min(minRealizedFloat, floatL);
    if (feet.left.y > footH + 0.025 || feet.left.y < footH - 0.001) {
      realizedGroundingPass = false;
    }
  }
}
```

---

## 14. Biological Counter-Motion: Pelvis, Spine, and Arms

A walking character that only moves its legs looks like a wooden marionette. In [`src/motion/generator.js`](../../src/motion/generator.js), locomotion is evaluated as a synchronized whole-body system:

### 14.1 Pelvis Dynamics
- **Vertical Bounce**: Dips at heel strikes and rises at midstance:
  $$y_{\text{bounce}} = y_{\text{dip}} - \frac{\text{verticalBounce}}{2} (1 + \cos(4\pi\phi))$$
- **Lateral Sway**: Shifts body mass over the active stance leg:
  $$x_{\text{sway}} = \text{lateralSway} \sin(2\pi\phi)$$
- **Pelvic Roll**: Coronal tilt dropping the swing hip:
  $$\theta_{\text{roll}} = \text{pelvisRoll} \sin(2\pi\phi)$$
- **Pelvic Yaw**: Transverse rotation twisting to advance the swinging leg:
  $$\theta_{\text{yaw}} = \text{pelvisYaw} \cos(2\pi\phi)$$

### 14.2 Spinal Counter-Rotation
The spine and chest twist in the opposite direction of the pelvis to stabilize the head and keep the gaze aligned forward:
$$\text{spineYaw} = -\theta_{\text{yaw}} \times \text{torsoCounter} \times 0.5$$
$$\text{chestYaw} = -\theta_{\text{yaw}} \times \text{torsoCounter} \times 0.5$$

### 14.3 Arm Swing & Bi-directional Elbow Flexion
Arms swing in counter-phase with the legs (left arm swings forward with right leg):
- **Forward Swing**: Deltoid pitches forward; elbow flexes to $45^\circ - 55^\circ$.
- **Backward Swing**: When the arm swings backward, the elbow does **not** lock into a stiff stick. It retains an organic $15^\circ - 20^\circ$ flexion.
- **Clavicular Articulation**: Clavicles protract and elevate slightly during forward swing.

---

## 15. Root Motion Intent & Transform Authority

Following [`CONSTITUTION.md`](../../CONSTITUTION.md) §3 and [`GAMEPLAY_FOUNDATION.md`](../../GAMEPLAY_FOUNDATION.md) §3:

> **Transform Authority Law**: *Animation systems produce movement intent; only the authoritative transform system commits world position.*

The motion evaluator does not mutate the character's world coordinates. Instead, `evaluator.update(dt)` returns a structured intent object:

```javascript
// Excerpt from src/motion/generator.js
return {
  phase,
  rootMotionIntent: {
    deltaX: 0,
    deltaY: 0,
    deltaZ: deltaDistance,
    speed,
    totalDistance
  },
  contactStates: { ... },
  pelvisState: { ... }
};
```

In [`src/motion/root-motion.js`](../../src/motion/root-motion.js), `commitRootMotionIntent()` commits this displacement into the entity's transform record:

```javascript
// Excerpt from src/motion/root-motion.js
export function commitRootMotionIntent(intent, transform, mode = 'in_place') {
  if (mode === 'forward') {
    transform.position.z += intent.deltaZ || 0;
    transform.position.x += intent.deltaX || 0;
    transform.position.y += intent.deltaY || 0;
  } else if (mode === 'in_place') {
    // In-place treadmill mode: character stays centered on studio grid origin
    transform.position.x = 0;
    transform.position.y = 0;
    transform.position.z = 0;
  }
  return { position: { ...transform.position }, speed: intent.speed, mode };
}
```

This clean seam allows the exact same character and motion system to operate both as an in-place studio fixture (treadmill mode) and as an in-game actor traversing world space.

---

## 16. Integration: The B1 Motion Studio Viewer

In [`src/browser/b1-viewer.js`](../../src/browser/b1-viewer.js), the character and motion engines are wired into an interactive browser studio:
- **WebGL Rendering**: Three.js standard shaded renderer with studio key lighting and an infinite ground grid.
- **Interactive Controls**: Character preset dropdown (`average`, `athletic`, `heavy`), motion preset dropdown (`natural`, `energetic`, `stroll`), slow-motion (0.25x), in-place treadmill toggle, wireframe toggle, and skeleton bone overlay.
- **Live DOM HUD**: Real-time display of cycle phase, speed, foot contact states (STANCE vs SWING), pelvic bounce and sway, and skinning normalization status ($\sum w = 1.0$).
- **Headless Evaluation Bridge**: Exposes `window.__PROOF_B1_MOTION__` with step control, realized foot position queries, and geometry statistics for automated testing.

---

## 17. Automated Verification & Testing

Every subsystem in Proof B1 is backed by automated tests and headless browser validation:

### 17.1 Unit Tests (`npm test`)
The test suite spans 11 suites and 70 passing tests:
- `tests/character.test.js`: Validates parameter resolution, landmark math, geometry vertex/triangle bounds, foot sole floor contact ($|Y| \le 0.001\text{ m}$), 22-bone tree topology, skinning normalization ($\sum w_i == 1.0$), and contralateral isolation.
- `tests/motion.test.js`: Validates motion parameter bounds, analytical 2-bone IK Law of Cosines accuracy and reach clamping, stance vs swing phase boundaries, and realized foot bone grounding across full gait cycles.

### 17.2 Headless Browser Evaluation (`npm run eval`)
The evaluation harness runs a headless browser via Puppeteer, validating all three engine proof targets simultaneously:
1. **Phase 0 Boot**: DOM boot text confirmation.
2. **Proof A Pong**: 2D gameplay, paddle movement, collision deflection, scoring rule execution.
3. **Proof B1 Motion Truth**:
   - `b1Boot`: WebGL viewer boots and initializes scene.
   - `b1CharacterGeneration`: Valid geometry, 22-bone skeleton, normalized skinning.
   - `b1MotionExecution`: Phase advances, speed is valid, pelvis bounces and sways.
   - `b1GroundingCheck`: Directly samples `getRealizedFootPositions()` across gait steps, asserting zero floor penetration and stance float $\le 25\text{ mm}$.
   - Captures deterministic PNG fixture: `artifacts/captures/proof_b1_motion_fixture.png`.

---

## 18. What Proof B1 Deliberately Does NOT Implement

Following the Engine's progressive disclosure law, Proof B1 focuses purely on **Motion Truth**. It deliberately omits:
- **No Facial Rigging or Animation**: Eyes, mouth, and facial morph targets are out of scope.
- **No Cloth or Hair Simulation**: The character is a clean procedural clay figure.
- **No Motion Matching or Animation Clips**: There are no imported FBX/glTF keyframe clips.
- **No Combat or Hit Reactions**: Combat mechanics belong to **Proof B2**.
- **No Advanced Physics or Ragdolls**: Limbs are driven kinematically by IK and procedural dynamics.
- **No Procedural Textures or PBR Shaders**: Shading uses studio clay materials; procedural texturing belongs to **Material Forge**.
- **No Terrain Following**: Walking takes place on a flat studio ground plane; irregular terrain belongs to **World Forge**.

By keeping Proof B1 tightly focused on anatomical proportions, procedural skinning, analytical IK, and contact grounding, the engine establishes a rock-solid, verifiable locomotion baseline before layering on combat and world complexity.
