# Building a Different Genre: The Proof D Architecture Walkthrough

## Building a Bounded 3D Arcade Racer Without Turning the Engine Into a Racing Engine

### Status

**ACCEPTED LEARNING MATERIAL**  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Ground truth base revision: `5fb46b9a3da1a6896530afec86cd205d616e832f`  
Governing specifications: [`ROADMAP.md`](../../ROADMAP.md), [`GAMEPLAY_FOUNDATION.md`](../../GAMEPLAY_FOUNDATION.md), [`TESTING_AND_VALIDATION.md`](../../TESTING_AND_VALIDATION.md), [`DOCUMENTATION_MAP.md`](../../DOCUMENTATION_MAP.md)  
Primary source implementation: [`src/runtime/input.js`](../../src/runtime/input.js), [`src/games/racing/`](../../src/games/racing/), [`src/browser/d-viewer.js`](../../src/browser/d-viewer.js)

---

## The Central Architectural Thesis

In **My Game Engine 1.0**, Proof D exists to answer a fundamental architectural question:

> **Does the engine remain genuinely general when a mechanically different game applies pressure to it?**

Earlier proofs established foundational systems for discrete 2D paddle mechanics (Proof A), procedural humanoid synthesis and locomotion (Proof B1), procedural arena combat (Proof B2), and bounded procedural terrain traversal (Proof C). While those games validated character skinning, IK, physics-free collision, and terrain field queries, they all shared related interaction paradigms: character roots moving across planes or fields, discrete button actions, and fixed spectator perspective cameras.

Proof D intentionally shifts genre into a **bounded 3D arcade racer** (*Copper Loop*). It pressures the engine with continuous velocities, variable analog steering, ordered checkpoint gates, lap tracking, tight track boundary containment, and an interactive chase camera.

The central lesson of Proof D is:

```text
GENERIC ENGINE SUBSTRATE (src/runtime/)
  ├── Semantic scalar input channel (bindScalarKey, bindScalarAxis, bindScalarButton)
  ├── Single-writer transform authority (KINEMATIC ownership)
  ├── Fixed-step simulation clock (60 Hz ticks)
  └── State manager & entity manager
         +
PROJECT-LEVEL RACING MECHANICS (src/games/racing/)
  ├── Track definition & ribbon geometry (track.js)
  ├── Wall collision segments & sliding containment (track.js)
  ├── Arcade vehicle kinematics & steering yaw (game.js)
  ├── Direction-sensitive ordered checkpoint authority (game.js)
  ├── Race state machine (game.js)
  └── Interactive chase camera presentation (camera.js, renderer.js)
         │
         ▼
MECHANICALLY DIFFERENT GAME WITHOUT CORE POLLUTION
```

Proof D demonstrates how to build a game the engine never anticipated **without stuffing genre-specific concepts into the core engine**. The engine core remains free of vehicle physics, tire friction models, track curves, and checkpoint managers.

---

## 1. Why a Racer: The Generality Pressure Test

Proof D did not build a racer to begin a racing franchise. It selected an arcade circuit racer because racing exercises architectural vectors that flat combat and open-world character traversal never touch:

1. **Continuous Velocity and Heading**: Unlike a walking humanoid whose root moves through discrete locomotion strides, a racing vehicle exhibits high-speed continuous forward momentum, drag, and steering rates proportional to forward speed.
2. **Analog Magnitude**: Digital on/off inputs are insufficient for vehicle steering and throttle feel. Racing requires signed, continuous deflection values $[-1.0, 1.0]$ for steering and analog triggers $[0.0, 1.0]$ for acceleration and braking.
3. **Non-Humanoid Movement**: Proof D has **zero dependency** on Character Forge (`src/character/`) or Motion Forge (`src/motion/`). It proves that entities do not require 22-bone skeletal rigs or 2-bone IK solvers to move authoritatively.
4. **Ordered Checkpoint Progression**: Laps require direction-sensitive, plane-crossing gate detection. Checkpoints must be cleared in strict cyclic order; cutting corners or driving backwards must be detected and rejected.
5. **Track Containment**: High-speed movement must be contained within continuous inner and outer ribbon barriers without tunneling or catching on mesh seams.
6. **Chase Camera & User Orbit**: Proof D introduces the first presentation camera that smoothly trails behind an entity's heading while allowing the player to orbit the view independently without corrupting simulation truth.

Proof D is a **generality test** designed to verify that the core runtime is extensible rather than rigid.

---

## 2. The Engine-Promotion Test: When to Promote Substrate

When developing Proof D, new mechanics were required at every level: curved tracks, vehicle acceleration, barrier bouncing, lap timers, and analog steering.

To decide what belonged in `src/runtime/` versus `src/games/racing/`, the team followed the canonical **Engine-Promotion Test** defined in `ROADMAP.md` §40:

```text
Does project code solve it cleanly?
  YES ──► Keep it project-level (track, kinematics, barriers, checkpoints, camera)

Does it require privileged engine access?
  NO  ──► Keep it project-level

Has unrelated game evidence shown this is reusable engine substrate?
  NO  ──► Do not promote yet
  YES ──► Promote as capability candidate (scalar semantic input)
```

Applying this law produced clean, unambiguous boundaries:

- **Track Generation**: Could have been generalized into an abstract "Track Forge". But only Proof D needed race circuits. Result: **Keep project-level** in `src/games/racing/track.js`.
- **Vehicle Kinematics**: Could have been an engine "VehicleComponent". But Pong, Combat, and World do not need drag, reverse speed, or wheelbases. Result: **Keep project-level** in `src/games/racing/game.js`.
- **Checkpoints and Laps**: Could have been promoted into an engine-level "TriggerVolumeSystem". But simple math in project code solved it in under 20 lines. Result: **Keep project-level** in `src/games/racing/game.js`.
- **Scalar Input**: Continuous analog values are needed not just for steering wheels and triggers, but for flight sticks, camera sticks, mouse look, and variable movement speed across future genres. It requires access to raw DOM events and the Gamepad API inside the snapshot cycle. Result: **Promote to engine substrate** in `src/runtime/input.js`.

---

## 3. Scalar Semantic Input: Generic Engine Extension

In Proofs A through C, the input manager (`src/runtime/input.js`) captured boolean snapshots: actions were either active (`true`) or inactive (`false`).

Proof D extended `createInputSystem` with an additive, generic **scalar semantic channel** (documented in `GAMEPLAY_FOUNDATION.md` §5.6).

```text
Hardware Events / Gamepad API
             │
             ▼
    createInputSystem()
  ├── bindScalarKey(code, action, value)
  ├── bindScalarAxis(index, action, { deadzone })
  └── bindScalarButton(index, action)
             │
             ▼
      captureSnapshot()
             │
             ▼
   Immutable Input Snapshot
  ├── getActionValue(action): number [-1.0 .. 1.0]
  ├── getAllActionValues(): Readonly<Record<string, number>>
  ├── isActionActive(action): boolean (compatibility)
  └── getAllActions(): Readonly<Record<string, boolean>>
             │
             ▼
   ArcadeRace.update(dt) (Gameplay logic never inspects raw hardware)
```

### 3.1 Public Scalar Binding APIs

```javascript
// Excerpt from src/runtime/input.js
return {
  bindScalarKey(code, action, value = 1) {
    if (action === null) { scalarKeys.delete(code); return; }
    checkAction(action);
    if (!Number.isFinite(value)) throw new Error('Scalar key value must be finite');
    scalarKeys.set(code, { action, value: scalar(value) });
  },

  bindScalarAxis(index, action, { deadzone = 0.15 } = {}) {
    bindScalarDevice(scalarAxes, index, action, deadzone);
  },

  bindScalarButton(index, action) {
    bindScalarDevice(scalarButtons, index, action);
  },

  simulateActionValue(action, value) {
    checkAction(action);
    if (!Number.isFinite(value)) throw new Error('Simulated scalar must be finite');
    simulatedValues.set(action, scalar(value));
  },
  // ...
};
```

### 3.2 Racing Input Declaration

In `src/games/racing/game.js`, semantic actions decouple the game completely from physical device indices:

```javascript
// Excerpt from src/games/racing/game.js
export function createRacingInput() {
  const input = createInputSystem({
    actions: ['Steer', 'Throttle', 'Brake', 'Reset', 'CameraOrbit'],
    keyboardBindings: { KeyR: 'Reset' }
  });

  for (const [code, action, value] of [
    ['KeyA', 'Steer', -1], ['ArrowLeft', 'Steer', -1],
    ['KeyD', 'Steer', 1],  ['ArrowRight', 'Steer', 1],
    ['KeyW', 'Throttle', 1], ['ArrowUp', 'Throttle', 1],
    ['KeyS', 'Brake', 1],    ['ArrowDown', 'Brake', 1],
    ['KeyQ', 'CameraOrbit', -1], ['KeyE', 'CameraOrbit', 1]
  ]) input.bindScalarKey(code, action, value);

  input.bindScalarAxis(0, 'Steer');           // Left thumbstick X
  input.bindScalarAxis(2, 'CameraOrbit');     // Right thumbstick X
  input.bindScalarButton(7, 'Throttle');      // Right Trigger (RT / R2)
  input.bindScalarButton(6, 'Brake');         // Left Trigger (LT / L2)
  input.bindGamepadButton(3, 'Reset');        // North button (Y / Triangle)
  return input;
}
```

The game simulation updates solely by querying `input.getActionValue('Throttle')` or `input.getActionValue('Steer')`.

---

## 4. Backward Compatibility: Additive Input Channel

Extending the input system to support scalar magnitudes did not break or require refactoring earlier proofs.

1. **Additive API**: `bindScalarKey`, `bindScalarAxis`, and `bindScalarButton` exist alongside legacy `bindKey`, `bindGamepadButton`, and `bindGamepadAxis`.
2. **Boolean Bridging**: In `captureSnapshot()`, any action with a non-zero scalar value automatically activates the corresponding boolean flag:
   ```javascript
   // Excerpt from src/runtime/input.js: captureSnapshot()
   for (const action of declaredActions) activeState[action] ||= values[action] !== 0;
   ```
3. **Zero Migration for Prior Games**: Proof A (Pong), Proof B1 (Motion), Proof B2 (Combat), and Proof C (World) continue to call `snapshot.isActionActive('MoveUp')` and `snapshot.getAllActions()` without a single line of modified code.

---

## 5. Analog Precision: Deadzones, Remapping & Merging

Raw analog hardware produces noise around zero, jitter, and non-linear boundaries. The engine guarantees deterministic, sanitized scalar values:

### 5.1 Clamping and Normalization
All scalar inputs are clamped to the finite range $[-1.0, 1.0]$. Non-finite inputs (`NaN`, `Infinity`) gracefully become `0.0`.

### 5.2 Post-Deadzone Remapping
Deadzone thresholding does not simply chop off values below the deadzone; it rescales the remaining travel to ensure smooth initial acceleration:
$$\text{magnitude} = \frac{|\text{raw}| - \text{deadzone}}{1 - \text{deadzone}}$$

In `src/runtime/input.js`:
```javascript
// Excerpt from src/runtime/input.js: captureSnapshot()
for (const [index, { action, deadzone }] of scalarAxes) {
  const value = scalar(pad.axes?.[index]);
  merge(action, Math.abs(value) <= deadzone ? 0 : Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone));
}
```

### 5.3 Analog Triggers
Buttons can report continuous values (`button.value` in $[0.0, 1.0]$ on modern pressure-sensitive triggers) or fallback to digital states (`button.pressed ? 1 : 0`).

### 5.4 Digital Aliasing and Opposites Cancellation
When multiple keys map to the same action:
- **Aliases Count Once**: Pressing both `KeyA` and `ArrowLeft` (both mapped to `Steer: -1`) does not double the turn rate to `-2`.
- **Opposites Cancel**: Pressing `KeyA` (`Steer: -1`) and `KeyD` (`Steer: +1`) simultaneously sums to $0.0$, canceling digital steering cleanly.

```javascript
// Excerpt from src/runtime/input.js: captureSnapshot()
const contributions = new Map();
for (const [code, { action, value }] of scalarKeys) {
  if (!rawKeyStates.get(code)) continue;
  if (!contributions.has(action)) contributions.set(action, new Set());
  contributions.get(action).add(value); // Alias keys do not double magnitude.
}
const merge = (action, value) => { if (Math.abs(value) > Math.abs(values[action])) values[action] = value; };
for (const [action, parts] of contributions) merge(action, scalar([...parts].reduce((a, b) => a + b, 0)));
```

---

## 6. Human Hardware Truth: Two Layers of Input Correctness

During the acceptance phase of Proof D, a vital architectural lesson emerged regarding testing:

> **Input correctness has at least two independent layers:**
> 1. **Numeric / Sign Propagation**: Verifying that a hardware axis or key registers non-zero numbers in the snapshot.
> 2. **Realized Human-Facing Semantic Behavior**: Verifying that physical input produces the expected spatial movement from the player's perspective.

Initially, Proof D passed automated synthetic tests: pressing `KeyD` produced `Steer: +1`, and `+1` changed the vehicle's yaw heading. However, when human verification took place on physical hardware, steering was completely reversed: pressing `KeyD` or pushing the analog stick right steered the vehicle to the left.

Synthetic tests had verified that numbers moved, but failed to assert the **realized semantic outcome** of those numbers in 3D world space.

---

## 7. Vehicle-Relative Steering: Coordinate System Semantics

To resolve the steering reversal, the team formalized the canonical semantic contract:

$$\text{Steer} < 0 \implies \text{Vehicle-Local Left}$$
$$\text{Steer} > 0 \implies \text{Vehicle-Local Right}$$

### The Coordinate System Wrinkle

In My Game Engine 1.0's world coordinate system:
- $+Y$ points up
- $+Z$ points forward along the initial heading ($0\text{ rad}$)
- $+X$ points world-right

However, for an entity facing along $+Z$ with $+Y$ up, the local right direction vector is defined by the cross product:
$$\mathbf{Right} = \mathbf{Forward} \times \mathbf{Up} = (0, 0, 1) \times (0, 1, 0) = (-1, 0, 0)$$

At heading zero, **vehicle-right corresponds to $-X$ in world coordinates**.

Therefore, turning toward vehicle-right requires decreasing yaw heading ($\Delta \theta < 0$):

```javascript
// Excerpt from src/games/racing/game.js: ArcadeRace.update()
// Positive semantic steering means right. With +Z forward and +Y up,
// vehicle-right is -X at heading zero, so right steering decreases yaw.
const turn = -steer * 1.6 * Math.min(1, Math.abs(this.speed) / 5) * Math.sign(this.speed) * dt;
this.heading += turn;
this.headingTravel += Math.abs(turn);

const p = this.transform.position, from = { x: p.x, z: p.z };
const next = this.track.resolveMovement(
  from,
  { x: p.x + Math.sin(this.heading) * this.speed * dt, z: p.z + Math.cos(this.heading) * this.speed * dt },
  VEHICLE.radius
);
```

Notice also `Math.sign(this.speed)`: when driving in reverse (`speed < 0`), steering direction inverts relative to heading change, preserving natural car backing behavior.

---

## 8. Testing Realized Outcomes: Beyond "Activity"

The fix led directly to a rigorous unit test in `tests/racing.test.js`. Instead of checking if `heading !== previousHeading`, the test measures actual **vehicle-relative lateral displacement**:

```javascript
// Excerpt from tests/racing.test.js
test('keyboard and analog controller steer toward vehicle-relative left/right, including reverse', () => {
  for (const [device, value] of [
    ['KeyA', -1], ['ArrowLeft', -1],
    ['KeyD', 1],  ['ArrowRight', 1],
    ['pad', -0.575], ['pad', 0.575]
  ]) {
    for (const speed of [8, -4]) {
      const game = new ArcadeRace();
      game.state.transition('COUNTDOWN');
      game.state.transition('RACING');
      game.speed = speed;

      if (device === 'pad') game.input.setGamepad({ connected: true, axes: [value], buttons: [] });
      else game.input.handleKeyDown({ code: device });

      const before = { ...game.transform.position }, heading = game.heading;
      // Vehicle-right = forward cross world-up, independently of yaw integration.
      const right = { x: -Math.cos(heading), z: Math.sin(heading) };

      game.update();

      const after = game.transform.position;
      const lateral = (after.x - before.x) * right.x + (after.z - before.z) * right.z;

      // Positive steer value MUST produce positive displacement along vehicle-right vector.
      assert.ok(lateral * Math.sign(value) > 0, `${device} ${value}, speed ${speed}: lateral ${lateral}`);
      assert.ok((game.heading - heading) * Math.sign(value) * Math.sign(speed) < 0);
      game.dispose();
    }
  }
});
```

**Lesson**: Never test merely that a system is "active" or that numbers changed. Assert the realized physical or semantic outcome.

---

## 9. Track as One Project Truth: Definition to World

Following the core philosophy proven in Proof C, the race course in Proof D derives from **one central track definition**:

```text
TRACK_DEFINITION (Copper Loop)
             │
             ▼
      generateTrack()
  ├── Centerline Samples (128 samples: x, z, tangent, heading)
  ├── Inner & Outer Ribbon Edges (128 pairs of x, z vertices)
  ├── Visual Road Surface Geometry (256 vertices, 256 triangles)
  ├── 256 Barrier Wall Segments (128 inner, 128 outer collision records)
  ├── 8 Checkpoint Gates (positions, headings, inner/outer posts)
  └── Authoritative Spawn Pose & Movement Resolver
```

Visual asphalt, instanced concrete barriers, gate frames, and collision boundaries are never modeled separately in external DCC tools. They are all calculated from the same mathematical circuit.

---

## 10. Procedural Circuit Geometry: The Ribbon and Barriers

The Copper Loop circuit is defined in `src/games/racing/track.js`:

```javascript
// Excerpt from src/games/racing/track.js
export const TRACK_DEFINITION = Object.freeze({
  id: 'copper-loop',
  type: 'arcade-circuit',
  data: Object.freeze({
    radiusX: 44,
    radiusZ: 29,
    width: 12,
    samples: 128,
    gates: 8,
    laps: 2,
    barrierHeight: 0.9,
    barrierThickness: 0.45
  })
});
```

### 10.1 Mathematical Ribbon Synthesis
For each of the $128$ samples around the ellipse:
1. Sample position $\mathbf{P}(a) = (R_x \cos a, R_z \sin a)$.
2. Tangent vector $\mathbf{T} = \frac{\mathbf{P}'(a)}{\|\mathbf{P}'(a)\|}$ and Normal vector $\mathbf{N} = (T_z, -T_x)$.
3. Offset edge vertices:
   $$\mathbf{Inner} = \mathbf{P} - \mathbf{N} \cdot \frac{W}{2}$$
   $$\mathbf{Outer} = \mathbf{P} + \mathbf{N} \cdot \frac{W}{2}$$
4. Connect adjacent edge vertices into alternating upward-wound triangles:
   `indices.push(a, b, a + 1, a + 1, b, b + 1)`

### 10.2 Structural Elements
- **Visual Pavement**: $256$ vertices ($128 \times 2$), $256$ triangles ($768$ indices).
- **Barriers**: $256$ instanced wall boxes ($128$ along outer perimeter, $128$ along inner perimeter) with height $0.9\text{m}$ and thickness $0.45\text{m}$.
- **Gates**: $8$ gate gantries placed at every $16\text{th}$ sample ($0, 16, 32, 48, 64, 80, 96, 112$). Gate 0 serves as the start/finish line.

---

## 11. Deterministic Arcade Kinematics: The Project Vehicle

Proof D does not use rigid-body dynamics, Rapier, PhysX, or complex tire friction slip curves. It implements **deterministic arcade kinematics** in `src/games/racing/game.js`:

```javascript
// Excerpt from src/games/racing/game.js
export const VEHICLE = Object.freeze({
  radius: 1.25,
  acceleration: 16,
  braking: 25,
  drag: 0.35,
  maxSpeed: 29,
  reverseSpeed: 7
});
```

### The Kinematic Update Loop
Every simulation tick ($dt = 1/60\text{s}$):
1. **Acceleration & Braking**:
   ```javascript
   const acceleration = throttle * VEHICLE.acceleration -
     brake * (this.speed > 0 ? VEHICLE.braking : VEHICLE.acceleration * 0.6);
   ```
2. **Speed Integration with Linear Drag**:
   ```javascript
   this.speed = Math.max(-VEHICLE.reverseSpeed, Math.min(VEHICLE.maxSpeed, (this.speed + acceleration * dt) / (1 + VEHICLE.drag * dt)));
   ```
3. **Speed-Dependent Steering Rate**:
   At near-zero speed, turning radius is suppressed to prevent unrealistic stationary spinning:
   ```javascript
   const turn = -steer * 1.6 * Math.min(1, Math.abs(this.speed) / 5) * Math.sign(this.speed) * dt;
   this.heading += turn;
   ```
4. **Intended Displacement**:
   $$\Delta \mathbf{X} = (\sin \theta \cdot v \cdot dt, \cos \theta \cdot v \cdot dt)$$

---

## 12. Single-Writer Transform Authority: Preserving Engine Law

Under `CONSTITUTION.md` and `ARCHITECTURE.md` §11, **only one authoritative writer may mutate an entity's transform per simulation step**.

Proof D strictly respects this rule. `ArcadeRace` creates a `KINEMATIC` transform for the racer entity. The vehicle kinematics and collision solver compute the resolved movement, but never directly write to `transform.position`. Instead, intent is assigned and committed authoritatively:

```javascript
// Excerpt from src/games/racing/game.js: ArcadeRace.update()
this.transforms.setIntent(this.handle, {
  x: (next.x - p.x) / dt,
  y: 0,
  z: (next.z - p.z) / dt
});
this.transforms.commitAll(dt); // Sole normal-step position writer.
```

In unit tests (`tests/racing.test.js`), a spy verifies that `transforms.commitAll(dt)` executes exactly once per simulation frame.

---

## 13. Fixed-Step Simulation Time: Deriving Race Clock

Race timing in Proof D is derived strictly from fixed-step simulation ticks, never from wall-clock time (`performance.now()` or `Date.now()`):

```javascript
// Excerpt from src/games/racing/game.js
update(dt = 1/60) {
  if (this.disposed) throw new Error('D_GAME_DISPOSED');
  if (Math.abs(dt - 1/60) > 1e-10) throw new Error('D_FIXED_STEP_REQUIRED');
  // ...
  if (this.state.getState() === 'RACING') {
    this.raceTicks++;
  }
}
```

The authoritative race elapsed time is:
$$\text{time} = \frac{\text{raceTicks}}{60}$$

This guarantees that two runs executing identical inputs produce the exact same lap times to the millisecond across different computers, framerates, or background load.

---

## 14. Authoritative Barrier Containment: Subsegmented Sliding

High-speed vehicles ($29\text{ m/s} \approx 104\text{ km/h}$) travel up to $0.48\text{m}$ per tick. A naive discrete collision check would risk tunneling through the track barriers.

In `src/games/racing/track.js`, `resolveMovement()` uses a **subsegmented continuous sweep with bisection contact search**:

```javascript
// Excerpt from src/games/racing/track.js
function resolveMovement(from, to, radius) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const count = Math.max(1, Math.ceil(distance / 0.2));
  let result = { x: from.x, z: from.z }, blocked = false;
  const delta = { x: (to.x - from.x) / count, z: (to.z - from.z) / count };

  for (let i = 0; i < count; i++) {
    const candidate = { x: result.x + delta.x, z: result.z + delta.z };
    if (contains(candidate, radius)) {
      result = candidate;
      continue;
    }
    blocked = true;
    let lo = 0, hi = 1;
    // Bisection search (16 iterations) to find the precise contact point
    for (let j = 0; j < 16; j++) {
      const t = (lo + hi) / 2;
      if (contains({ x: result.x + delta.x * t, z: result.z + delta.z * t }, radius)) lo = t;
      else hi = t;
    }
    result = { x: result.x + delta.x * lo, z: result.z + delta.z * lo };

    // Slide along the barrier normal
    const n = nearestWall(candidate).wall.normal;
    const dot = delta.x * n.x + delta.z * n.z;
    const slide = { x: result.x + (delta.x - n.x * dot) * (1 - lo), z: result.z + (delta.z - n.z * dot) * (1 - lo) };
    if (contains(slide, radius)) result = slide;
  }
  return { ...result, blocked };
}
```

When contact occurs:
- The car slides along the wall tangent without sticking.
- In `game.js`, a collision friction penalty is applied: `this.speed *= 0.985; this.blockedSteps++;`.
- The vehicle collision disk ($r = 1.25\text{m}$) is strictly contained within the track boundaries at all times.

---

## 15. Ordered Checkpoint Authority: Direction-Sensitive Gates

A racing game cannot rely on loose distance checks (e.g. `distanceTo(checkpoint) < 5`). Proximity triggers can be activated from behind walls, in reverse, or out of order.

Proof D implements **direction-sensitive plane-crossing gates**:

```javascript
// Excerpt from src/games/racing/game.js
export function forwardGateCrossing(gate, from, to, radius = VEHICLE.radius) {
  // Signed distance of from and to relative to the gate plane along its tangent vector
  const signed = p => (p.x - gate.x) * gate.tangent.x + (p.z - gate.z) * gate.tangent.z;
  const a = signed(from), b = signed(to);

  // Must cross from behind the gate (a < 0) to on/in front of the gate (b >= 0)
  if (!(a < 0 && b >= 0 && b > a)) return false;

  // Compute exact intersection point t on the gate line
  const t = -a / (b - a);
  const x = from.x + (to.x - from.x) * t - gate.x;
  const z = from.z + (to.z - from.z) * t - gate.z;

  // Verify intersection falls within the gate width (between the posts)
  return Math.abs(x * gate.tangent.z - z * gate.tangent.x) <= gate.halfWidth - radius;
}
```

### Strict Progression Rules
In `advanceCheckpoints()`:
```javascript
// Excerpt from src/games/racing/game.js
export function advanceCheckpoints(race, track, from, to, tick) {
  if (!forwardGateCrossing(track.gates[race.next], from, to)) return false;
  race.records.push({ checkpoint: race.next, lap: race.laps + 1, tick });
  if (race.next === 0) race.laps++;
  race.next = (race.next + 1) % track.gates.length;
  return true;
}
```

1. **Strict Ordering**: Only crossings of `track.gates[race.next]` are evaluated. Crossing Gate 3 when expecting Gate 2 is completely ignored.
2. **Reverse Crossing Rejection**: Crossing backwards produces $a > 0$ and $b \le 0$, which evaluates to `false`.
3. **Out-of-Width Rejection**: Driving outside the pylons fails the lateral width check.
4. **Lap Authority**: Crossing Gate 0 increments `race.laps` only after all preceding gates ($1 \dots 7$) have been cleared.

---

## 16. Physical Crossing Validation: Proving Progression

Automated tests in `tests/racing.test.js` verify physical crossing invariants:

- Attempting to skip gates returns `false`.
- Crossing backwards returns `false`.
- Crossing outside the barrier bounds returns `false`.
- Passing Gate 0 at spawn without completing the loop returns `false`.
- Only a complete sequence of 16 consecutive forward crossings ($2\text{ laps} \times 8\text{ gates}$) marks the race complete.

---

## 17. Project Race State: The Finite State Machine

The race lifecycle is managed by an isolated instance of `createStateManager` inside `ArcadeRace`:

```text
       [ Throttle > 0 ]              [ 180 Ticks (3.0s) ]
READY ──────────────────► COUNTDOWN ─────────────────────► RACING
  ▲                                                          │
  │                                                          │ [ 2 Laps Complete ]
  │                       [ Reset Action ]                   ▼
  └────────────────────────────────────────────────────── FINISHED
```

- **READY**: Spawns at Gate 0 with speed $0$. Throttle triggers countdown.
- **COUNTDOWN**: Frozen controls for 180 ticks ($3.0\text{ seconds}$ at 60 Hz). HUD displays countdown numbers `3`, `2`, `1`.
- **RACING**: Full control enabled. Lap timer and checkpoint tracking advance.
- **FINISHED**: Triggers when `race.laps === 2`. Vehicle automatically coasts to $0$, speed and intent are zeroed, and final race time is preserved.

---

## 18. Clean Reset & Recovery: Rebuilding State

Pressing `KeyR` or Gamepad Button 3 (Y / North) immediately resets all simulation and transform state:

```javascript
// Excerpt from src/games/racing/game.js: ArcadeRace.reset()
reset() {
  this.transforms.teleport(this.handle, this.track.spawn);
  this.transforms.setIntent(this.handle, { x: 0, y: 0, z: 0 });
  this.transforms.setVelocity(this.handle, { x: 0, y: 0, z: 0 });
  this.heading = this.track.spawn.heading;
  this.previousHeading = this.heading;
  this.speed = 0;
  this.race = { next: 1, laps: 0, records: [] };
  this.ticks = 0;
  this.raceTicks = 0;
  this.countdown = 180;
  this.blockedSteps = 0;
  this.distance = 0;
  this.maxSpeed = 0;
  this.headingTravel = 0;
  this.state.reset('READY');
}
```

No speculative checkpoint-teleport or mid-track respawn features were invented, keeping the implementation tight and robust.

---

## 19. Presentation Decoupling: The Interactive Chase Camera

Proof D provides an interactive chase camera in `src/games/racing/camera.js`:

```javascript
// Excerpt from src/games/racing/camera.js
export function createChaseCamera(controlled = false) {
  let orbit = 0;
  return {
    get orbit() { return orbit; },
    update(value, dt) {
      if (!controlled) orbit = Math.max(-1.1, Math.min(1.1, orbit + value * Math.min(Math.max(dt, 0), 0.1) * 1.2));
    },
    pose(position, heading) {
      if (controlled) return { position: { x: 72, y: 84, z: 80 }, target: { x: 0, y: 0, z: 0 } };
      const angle = heading + orbit;
      return {
        position: { x: position.x - Math.sin(angle) * 10, y: position.y + 6, z: position.z - Math.cos(angle) * 10 },
        target:   { x: position.x + Math.sin(heading) * 5, y: position.y + 0.5, z: position.z + Math.cos(heading) * 5 }
      };
    }
  };
}
```

### Presentation vs. Simulation Isolation
The chase camera demonstrates clean architectural decoupling:
- **Presentation State Only**: The camera retains **zero writable reference** to `ArcadeRace` or its entities.
- **User Orbit**: Players can press `KeyQ` / `KeyE` or tilt the right analog stick (`CameraOrbit`) to swivel the camera up to $\pm 1.1\text{ radians}$ ($\approx \pm 63^\circ$).
- **Variable Frame Interpolation**: `interpolatedVehicle(game, alpha)` smoothly interpolates position and heading between fixed simulation steps, providing jitter-free high-refresh rendering without affecting simulation ticks.

---

## 20. Camera Isolation Testing: Presentation vs. Simulation

In `tests/racing.test.js` and `tests/racing-browser.test.js`, explicit tests verify that camera manipulation cannot corrupt gameplay truth:

1. A vehicle state snapshot is recorded before camera updates.
2. A live chase camera is driven for 100 frames in one direction (`camera.update(1, 1/60)`), reaching and asserting the $\pm 1.1\text{ rad}$ orbit clamp.
3. The resulting vehicle snapshot is compared against the initial snapshot:
   - Position, heading, speed, distance, ticks, and checkpoint records match exactly (`assert.deepEqual(game.snapshot(), before)`).
   - Only camera pose changes, while a fixed controlled camera ignores orbit inputs entirely (`assert.deepEqual(fixed.pose(...), controlled)`).
   - Injecting active `CameraOrbit` semantic input during `game.update()` does not alter vehicle speed or race records.

The camera is strictly presentation, never simulation authority.

---

## 21. Live vs. Controlled Routes: Playability and Fixture

Proof D provides two distinct runtime routes via `src/browser/d-viewer.js`:

### 21.1 Live Interactive Route: `?proof=d`
- **Purpose**: Real human gameplay, gamepad testing, and visual review.
- Dynamic responsive rendering with device pixel ratio capped at $2.0$.
- Interactive chase camera with user orbit controls.
- Full HTML HUD overlay displaying current lap, next gate, speed in KM/H, race timer, and gamepad connection status.

### 21.2 Controlled Deterministic Fixture: `?proof=d&controlled=1`
- **Purpose**: Headless browser evaluation harness (`npm run eval`) and regression testing.
- Fixed isometric spectator camera (`position: (72, 84, 80)`, `target: (0, 0, 0)`).
- Synthetic controller injection isolates the run from physical gamepads or accidental key presses.
- Programmatic closed-loop driver (`controlledInput`) drives the real track.

---

## 22. The Deterministic Controlled Driver: Closed-Loop Guidance

The controlled driver in `src/games/racing/proof.js` is not a cheat script: it does not teleport the car, fake checkpoint triggers, or manipulate positions. It is a **closed-loop feedback driver** that steers the vehicle purely by injecting semantic scalar inputs:

```javascript
// Excerpt from src/games/racing/proof.js
export function controlledInput(game) {
  // Deliberate initial impact into outer barrier to test collision resolution
  if (game.raceTicks < 135) return { Throttle: 0.9, Brake: 0, Steer: 0 };

  // Lookahead sample along the actual track centerline
  const p = game.transform.position;
  const index = game.track.nearestSample(p);
  const target = game.track.samples[(index + 5) % game.track.samples.length];

  // Heading error to target lookahead
  const error = angleDelta(Math.atan2(target.x - p.x, target.z - p.z), game.heading);

  return {
    Throttle: game.speed < 18 ? 0.85 : 0.3,
    Brake: game.speed > 20 ? 0.2 : 0,
    Steer: Math.max(-1, Math.min(1, -error * 2.4))
  };
}
```

Notice `-error * 2.4`: this matches the accepted vehicle-relative steering law (decreasing heading yaw turns right).

During evaluation:
1. The driver starts at Gate 0, hits the countdown, accelerates, and intentionally crashes into the outer barrier to test bounce and slide resolution.
2. The driver navigates around the circuit for two full laps.
3. Exactly $16$ gate crossings are recorded in order.
4. The race transitions to `FINISHED` after $1,822$ total steps ($180$ countdown ticks $+ 1,642$ race ticks).

---

## 23. Headless Browser Evaluator: The Sixth Verification Target

The evaluation harness (`npm run eval`) boots `http://localhost:5173/?proof=d&controlled=1` as its **sixth default target**.

Nine explicit truth checks are validated via `src/eval/d-checks.js`:

| Check Name | Verification Truth |
|---|---|
| `dBoot` | HTTP 200, viewer initialized, `window.__PROOF_D_RACING__` bridge exposed |
| `dTrackGeneration` | Road mesh matches $256$ vertices, $256$ triangles; gate positions agree with track truth |
| `dVehicleMotion` | Traversal distance $> 400\text{m}$, speed $> 10\text{ m/s}$, heading travel $> 8\text{ rad}$ |
| `dAnalogInput` | Partial analog throttle and steer values observed in snapshot |
| `dBarrierCollision` | Instanced wall box transforms match collision segments; disk containment verified; blocked steps $> 0$ |
| `dCheckpointProgress` | All $16$ gate crossings recorded in exact sequential order with ascending ticks |
| `dRaceFinish` | Terminal state is `FINISHED`, exactly $2$ laps completed, race ticks $> 600$ |
| `dControlledCamera` | Fixed evaluation camera remains motionless throughout the race |
| `dPageProofSuccess` | Entire in-page proof reports `success: true` |

### Fail-Closed Contract
If `result.dProof.success` is false, `dPageProofSuccess` fails immediately, even if all other named checks evaluate to true.

---

## 24. Lazy Routing and Bundle Purity: Zero Unneeded Payload

To protect runtime purity and download size, Proof D is loaded lazily in `src/browser/main.js`:

```javascript
// Excerpt from src/browser/main.js
if (params.get('proof') === 'd') {
  const { createDViewer } = await import('./d-viewer.js');
  createDViewer(app, { controlled: isControlled });
}
```

Vite splits all racing code into distinct chunk assets (`dist/assets/d-viewer-*.js`, `dist/assets/game-*.js`).

In `tests/racing-browser.test.js`, an automated network audit intercepts all browser requests when loading the Pong route (`/?game=pong&controlled=1`). The test asserts that **zero racing modules, stylesheets, or models are downloaded or executed**.

---

## 25. Static Export: Standalone Execution

Like all earlier proofs, the racing game does not depend on Vite dev server APIs, Node.js runtimes, or Studio tooling.

Running `npm run build` compiles the application into `dist/`. The exported bundle can be hosted on any static HTTP server (GitHub Pages, S3, Nginx) and runs seamlessly.

---

## 26. Complete Resource Lifecycle: Disposal and Memory Hygiene

Under `CONSTITUTION.md`, every created resource must be cleanable and reusable without leaks.

`createDViewer()` exposes an exhaustive `dispose()` method in `src/browser/d-viewer.js`:

```javascript
// Excerpt from src/browser/d-viewer.js
function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frame);
  observer.disconnect();
  window.removeEventListener('resize', resize);
  window.removeEventListener('blur', blur);
  game.input.detach(window);
  view.dispose();
  game.dispose();
  if (window.__PROOF_D_RACING__ === bridge) delete window.__PROOF_D_RACING__;
  app.classList.remove('d-root');
  document.body.classList.remove('d-mode');
  document.documentElement.classList.remove('d-mode');
  app.replaceChildren();
}
```

And in `src/games/racing/renderer.js`:
```javascript
// Excerpt from src/games/racing/renderer.js
dispose() {
  if (disposed) return;
  disposed = true;
  scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  labels.forEach(l => l.element.remove());
  renderer.dispose();
  renderer.domElement.remove();
  scene.clear();
}
```

In `tests/racing-browser.test.js`, a cycle of two consecutive mount-and-dispose cycles is executed. The test instruments `ResizeObserver`, DOM event listeners, and WebGL textures, asserting that:
- $100\%$ of created geometries and materials fire their `dispose` events.
- Zero retained resize observers or window listeners remain.
- Canvas elements are completely removed from the DOM.
- `window.__PROOF_D_RACING__` is cleanly deleted.

---

## 27. Accepted Proof D Evidence: Baseline Metrics

At frozen baseline revision `5fb46b9a3da1a6896530afec86cd205d616e832f`:

- **Node Version**: Pinned consistently to `24.20.0`.
- **Unit Test Suite**: $176/176$ tests PASS across $11$ test suites.
- **Evaluation Harness**: $6/6$ targets PASS, $43/43$ truth checks true, $0$ errors.
- **Deterministic Captures (SHA-256)**:
  - `phase0_boot_fixture`: `8c653d67a60964927145417146fb59d71d9fbb928da730304aee96539d0c7001`
  - `proof_a_pong_fixture`: `897629089a8f187a11f2a2c375247d8ab4c2ab1a31819864ce940e94ddf3eb56`
  - `proof_b1_motion_fixture`: `2077e153e976119d27ad3e7f3f93d353078cc164c8f86e43b363c94a8c47baba`
  - `proof_b2_combat_fixture`: `428ce84e9cdafdc7d2b93f0b3ab03a9d1a96e091967ddf81e19f7fb9677ec2f7`
  - `proof_c_world_fixture`: `16062a2bd13bc616727ed0a39c9a7d93e9b97e3bed81edf572707d3cac433146`
  - `proof_d_racing_fixture`: `736f15b0a0c98755767e7dd9af165e703453f8d148887fe0f22b0fbb1821abaf`
- **Canonical Controlled Track Hash**: `4678b14a62eb7`
- **Controlled Run Execution Truth**:
  - Total steps: $1,822$ ($180$ countdown $+ 1,642$ race ticks at 60 Hz)
  - Elapsed race time: $27.37\text{s}$
  - Traversal distance: $469.86\text{m}$
  - Top speed: $18.12\text{ m/s}$ ($65.2\text{ km/h}$)
  - Barrier collisions: $80$ blocked ticks with minimum clearance $1.250\text{m}$
  - Checkpoints: $16$ ordered gate crossings across $2$ laps
- **Production Build**: $70$ modules transformed, bundle builds in $\sim 163\text{ms}$.
- **Security Audit**: $0$ vulnerabilities via `npm audit`.

---

## 28. What Proof D Does Not Implement: Explicit Non-Goals

To keep the architecture honest and bounded, Proof D explicitly does **not** implement:

- A general vehicle engine or wheel/suspension simulation
- External physics engines (Rapier, Havok, PhysX)
- General "Track Forge" or spline-lofting tools
- Universal camera frameworks
- Tire smoke, particle systems, or skidmark decals
- AI opponent drivers or steering pathfinding
- Multiplayer or network race synchronization
- Dynamic weather, rain, or day/night lighting cycles
- In-game car customizers or tuning menus
- Studio editor integration

Proof D is precisely what it claims to be: **a bounded 3D arcade racer proving that a mechanically different genre can be built cleanly on generic engine substrate without forcing genre-specific mechanics into the engine core.**
