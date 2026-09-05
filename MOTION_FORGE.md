# MOTION_FORGE.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **Proof B1 — Motion Truth**

This document defines the durable procedural character motion and locomotion architecture of My Game Engine 1.0. It documents the contracts, kinematics, gait mechanics, and transform-authority boundaries established and evidenced by Proof B1.

---

## 1. Core Architectural Laws

1. **Transform Authority Compliance**: Animation and locomotion systems NEVER directly mutate world entity transforms. Locomotion produces local bone poses and horizontal displacement increments as `rootMotionIntent`; the engine's authoritative transform manager commits entity position.
2. **Organic Living Motion Over Mechanical Rigidity**: Locomotion must express the dynamic physical realities of human movement: double-frequency vertical bounce, lateral weight shifts over stance limbs, pelvic roll, transverse pelvic yaw, and counter-phase torso rotation.
3. **Continuous Periodic Gait Phase**: Locomotion cycles evaluate continuously over normalized phase $\phi \in [0, 1)$. The left leg evaluates at $\phi_L = \phi$; the right leg evaluates exactly half a cycle out of phase ($\phi_R = (\phi + 0.5) \pmod 1.0$). Loop boundaries wrap with zero jerk or discontinuity.
4. **Stance & Swing Phasing**: Each leg cycle divides into a 60% ground stance phase ($\phi \in [0, 0.60]$) and a 40% aerial swing phase ($\phi \in [0.60, 1.0]$).
5. **Analytical 2-Bone IK Without Popping**: Leg kinematics use closed-form analytical 2-bone inverse kinematics with smooth reach clamping strictly below $L_1 + L_2$ to eliminate mathematical singularities and knee hyper-extension popping.
6. **Strict Grounding Guarantee**: During stance phase, the foot sole is clamped to the ground plane: ankle height $Y \ge \text{footH}$ (zero penetration beneath floor) and $Y \le \text{footH} + 0.025\text{ m}$ (zero floating during contact).
7. **Counter-Phase Arm Dynamics**: The contralateral arm swings forward with the advancing leg, featuring dynamic elbow flexion on forward swing and secondary wrist lag trailing swing velocity.

---

## 2. Locomotion Parameter Domain & Presets

Gait dynamics derive from bounded parameters in `MOTION_PARAMETER_BOUNDS`:

```text
Parameter           Min       Max       Default    Unit
-----------------------------------------------------------------
cadence             60        160       112        steps/minute
strideLength        0.60      2.00      1.30       meters/cycle
verticalBounce      0.005     0.060     0.028      meters
pelvisRoll          0.01      0.15      0.065      radians
pelvisYaw           0.02      0.20      0.090      radians
lateralSway         0.005     0.060     0.022      meters
armSwing            0.10      0.80      0.38       radians
elbowFlex           0.10      0.90      0.45       radians
wristLag            0.02      0.25      0.08       radians
torsoCounter        0.30      1.00      0.75       scalar ratio
stepHeight          0.02      0.12      0.055      meters
```

### Standard Presets

- **`natural`**: Standard balanced bipedal walk (112 spm, 1.30m stride, 28mm bounce, 1.21 m/s speed).
- **`energetic`**: Athletic brisk walk (128 spm, 1.50m stride, 38mm bounce, 1.60 m/s speed).
- **`stroll`**: Relaxed, low-impact stroll (92 spm, 1.10m stride, 18mm bounce, 0.84 m/s speed).

---

## 3. Analytical 2-Bone Inverse Kinematics

Given root joint $A$ (Hip), target joint $C$ (Ankle), upper length $L_1$ (Thigh), and lower length $L_2$ (Shin):

### 3.1 Distance & Reach Clamping

$$D = |\vec{C} - \vec{A}|$$
$$D_{\text{clamped}} = \max\left( |L_1 - L_2| \cdot 1.002, \min(D, (L_1 + L_2) \cdot 0.9998) \right)$$

### 3.2 Law of Cosines

$$\cos \alpha = \frac{L_1^2 + D_{\text{clamped}}^2 - L_2^2}{2 L_1 D_{\text{clamped}}}$$
$$\cos \beta = \frac{L_1^2 + L_2^2 - D_{\text{clamped}}^2}{2 L_1 L_2}$$
$$\alpha = \arccos(\text{clamp}(\cos \alpha, -1, 1))$$
$$\beta = \arccos(\text{clamp}(\cos \beta, -1, 1))$$
$$\theta_{\text{flexion}} = \pi - \beta$$

### 3.3 Joint Position Calculation

Using unit vector $\hat{u} = (\vec{C} - \vec{A}) / D$ and orthogonalized pole vector $\hat{p}$ (pointing forward $+Z$):
$$\vec{B}_{\text{knee}} = \vec{A} + \hat{u} \cdot (L_1 \cos \alpha) + \hat{p} \cdot (L_1 \sin \alpha)$$

Both bone segment lengths are preserved with machine precision:
$$|\vec{B} - \vec{A}| = L_1 \quad \text{and} \quad |\vec{C} - \vec{B}| = L_2$$

---

## 4. Foot Grounding, Heel Strike, and Toe Roll

The foot placement solver evaluates single-leg phase $p \in [0, 1)$:

### 4.1 Stance Phase ($p \le 0.60$)

- **Horizontal Trajectory**: Moves linearly rearward relative to hip:
  $$z = z_{\text{reach}} - (2 z_{\text{reach}}) \cdot \frac{p}{0.60}$$
- **Heel Strike** ($p / 0.60 < 0.18$): Heel contacts floor; foot is dorsiflexed:
  $$\theta_{\text{pitch}} = -0.30 \cdot \left(1 - \frac{p / 0.60}{0.18}\right) \text{ rad}$$
- **Midstance / Flat Foot** ($0.18 \le p / 0.60 < 0.65$): Foot sits completely flat on the floor ($\theta_{\text{pitch}} = 0, y = \text{footH}$).
- **Push-Off / Toe Roll** ($p / 0.60 \ge 0.65$): Heel rises while toe stays on ground; foot rolls up to $+0.45\text{ rad}$ ($+26^\circ$).

### 4.2 Swing Phase ($p > 0.60$)

- **Forward Trajectory**: Smoothstep curve accelerates forward from $-z_{\text{reach}}$ to $+z_{\text{reach}}$.
- **Vertical Foot Clearance**: Parabolic elevation arc clearing the floor:
  $$y = \text{footH} + \text{stepHeight} \cdot \sin(\pi \cdot s) \quad \text{where } s = \frac{p - 0.60}{0.40}$$

---

## 5. Pelvis & Upper Body Dynamics

### 5.1 Pelvis Oscillation

- **Vertical Bounce** (Double Frequency):
  $$y_{\text{bounce}} = -A_{\text{bounce}} \cdot \cos(4\pi \phi)$$
- **Lateral Sway**:
  $$x_{\text{sway}} = A_{\text{sway}} \cdot \sin(2\pi \phi)$$
- **Pelvic Roll** (Lateral Tilt):
  $$R_z = A_{\text{roll}} \cdot \sin(2\pi \phi)$$
- **Pelvic Yaw** (Transverse Rotation):
  $$R_y = A_{\text{yaw}} \cdot \cos(2\pi \phi)$$

### 5.2 Torso & Arm Counter-Dynamics

- **Spine & Chest Counter-Rotation**: Rotates around Y in the opposite direction of the pelvis:
  $$R_{y, \text{torso}} = -R_{y, \text{pelvis}} \cdot \text{torsoCounter} \cdot 0.5$$
- **Arm Swing**: Left arm swings in phase with the right leg ($\phi_{\text{armL}} = (\phi + 0.5) \pmod 1.0$).
  $$\theta_{\text{shoulder}} = A_{\text{swing}} \cdot \sin(2\pi \phi_{\text{arm}})$$
- **Elbow Flexion**: Arm bends on forward swing and extends on backswing:
  $$\theta_{\text{elbow}} = 0.15 + A_{\text{elbow}} \cdot \max(0, \sin(2\pi \phi_{\text{arm}})) + 0.06 \cdot \max(0, -\sin(2\pi \phi_{\text{arm}}))$$
- **Wrist Secondary Lag**:
  $$\theta_{\text{wrist}} = -A_{\text{wrist}} \cdot \cos(2\pi \phi_{\text{arm}})$$

---

## 6. Root Motion & Transform Authority

During every step, the locomotion evaluator outputs:

```text
rootMotionIntent {
  deltaX: 0,
  deltaY: 0,
  deltaZ: speed * deltaSeconds,
  speed: strideLength * (cadence / 120),
  totalDistance: cumulativeMeters
}
```

The engine's `commitRootMotionIntent(intent, transform, mode)` consumes this intent:
- **`'in_place'`** (Treadmill Studio Mode): Leaves `transform.position` at $(0, 0, 0)$ on the 1-meter floor grid for visual foot contact inspection while updating `totalDistance`.
- **`'forward'`**: Translates `transform.position.z += intent.deltaZ`.

---

## 7. The 8 Visual Failure Criteria

Before declaring motion truth, procedural motion is verified against these cardinal failure modes:

1. **Obvious Foot Sliding**: Stance foot moving relative to ground while in contact phase.
2. **Foot Penetration or Floating**: Feet sinking beneath ground ($Y < 0$) or hovering in stance ($Y > 0.025$).
3. **Knee / Elbow Collapse or Popping**: Limbs suddenly flipping or hyper-extending at inflection points.
4. **Severe Volume Loss**: Mesh thinning to a paper-like waist or candy-wrapper twisting during joint rotation.
5. **Rigid Pendulum Limbs**: Limbs swinging as stiff wooden rods without elbow flex or wrist lag.
6. **Mechanical Pelvis**: Pelvis translating like an elevator on rails without dynamic bounce, roll, and yaw.
7. **Loop Discontinuity**: Stutter or jerk at cycle boundary repetitions.
8. **Mannequin-Like Rigidity**: Character moving as disjoint rigid shapes without organic weight transfer.

---

## 8. Non-Goals & Boundaries for Motion Forge

1. **No External MoCap Files**: Does not import BVH, FBX animations, or captured mocap tracks.
2. **No Ragdoll Physics**: Physical death simulations belong to later physics proofs.
3. **No Combat Move Sets**: Punches, kicks, and hit reactions belong to Proof B2 (Combat Room).
4. **No Transform Commits**: Motion Forge never writes directly to authoritative world coordinates.
