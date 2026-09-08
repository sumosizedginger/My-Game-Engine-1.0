# Building an Unplanned Game Through the Public API

## The Proof E Architecture Walkthrough: Order Five and Blind Engine Generality

### Status

**ACCEPTED LEARNING MATERIAL**  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Implementation base revision: `c62975dbf68c2305e38c00b9cdc1ed5707777d4a`  
Governing specifications: [`ROADMAP.md`](../../ROADMAP.md), [`GAMEPLAY_FOUNDATION.md`](../../GAMEPLAY_FOUNDATION.md), [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`TESTING_AND_VALIDATION.md`](../../TESTING_AND_VALIDATION.md), [`DOCUMENTATION_MAP.md`](../../DOCUMENTATION_MAP.md)  
Primary source implementation: [`src/games/sequence/`](../../src/games/sequence/), [`src/browser/sequence-viewer.js`](../../src/browser/sequence-viewer.js), [`src/runtime/`](../../src/runtime/), [`src/full/`](../../src/full/), [`tests/sequence.test.js`](../../tests/sequence.test.js)

---

## The Central Architectural Thesis

In **My Game Engine 1.0**, Proof E answers a question that internal roadmap proofs cannot answer on their own:

> **Can a fresh participant build a working, mechanically unplanned game using only the engine's public surface, without internal architecture knowledge or privileged handholding?**

Earlier proofs (A through D) validated foundational capabilities:
- **Proof A (Pong)** proved 2D deterministic simulation, discrete state machines, and the definition-to-artifact compile seam.
- **Proof B1 (Motion Truth)** proved procedural humanoid synthesis, 22-bone skeletal kinematics, and contact-grounded locomotion.
- **Proof B2 (Procedural Combat Room)** proved procedural room geometry, PBR materials, single hit authority, and fixed-step combat.
- **Proof C (Bounded Procedural World)** proved procedural terrain generation from fields, volume queries, and non-flat realized foot grounding.
- **Proof D (Different Genre / Arcade Racer)** proved continuous vehicle kinematics, scalar analog input, ordered track gates, and track boundary containment.

Each of those proofs was designed alongside the engine systems built to support it. The builders knew the internal plumbing because they wrote both the engine and the game.

Proof E broke that loop. It introduced an **unplanned game specification** (*Order Five*—a bounded 3D top-down collection and hazard puzzle) and gave it to a **fresh, blind participant** with access only to the public documentation and package exports.

The central lesson of Proof E is:

```text
PUBLIC ENGINE SURFACE (@sumosizedginger/my-game-engine-1.0)
  ├── Public Runtime: createRuntime, createEntityManager, createTransformManager,
  │                   TRANSFORM_OWNERSHIP, createSimulationClock, createInputSystem,
  │                   checkAABB, createStateManager, createRuleEngine
  └── Public Full / Authoring: compileDefinition
         +
DOCUMENTED ONBOARDING PATH
  └── README.md ──► docs/learn/ ──► GAMEPLAY_FOUNDATION.md
         +
PROJECT-LEVEL GAMEPLAY REALIZATION (src/games/sequence/)
  ├── Game definitions & Kiln compilation (definitions.js)
  ├── 3D kinematic player & arena boundary clamp (game.js)
  ├── Ordered collectible sequence authority (game.js)
  ├── Harmonic moving hazard trajectories (game.js)
  ├── Inactive vs. active exit completion trigger (game.js)
  ├── XZ planar overlap adapter (game.js)
  └── Direct Three.js orthographic presentation (renderer.js)
         │
         ▼
WORKING UNPLANNED 3D GAME WITHOUT CORE MODIFICATIONS OR PRIVILEGED BYPASS
```

Proof E proved that the engine's public interface is coherent enough to build an unplanned 3D game without patching the core runtime, without importing private modules, and without leaking presentation into gameplay truth.

---

## 1. What Proof E Tested: Blind Public-API Generality

### 1.1 The Difference Between Internal Proofs and Blind Generality

When an engine team builds games to prove its own engine, a subtle bias inevitably creeps in:
1. **Privileged Knowledge**: The implementer knows which internal file exports a helper, even if the public barrel omitted it.
2. **Co-Design of Mechanics**: Mechanics are shaped around what the engine already does easily, avoiding painful edge cases.
3. **Implicit Conventions**: Undocumented rules (e.g., how time increments, how entities relate to transforms, how state defaults behave) are known by heart.

Proof E eliminates these crutches by enforcing a strict protocol:

```text
Fresh Participant
       │
       ▼
Reads Public Documentation (README, GAMEPLAY_FOUNDATION, docs/learn/)
       │
       ▼
Consumes Public Package Surfaces (/runtime, /full)
       │
       ▼
Builds Unplanned Game (Order Five)
       │
       ▼
ZERO Core Code Changes  •  ZERO Private Module Imports  •  ZERO Privileged By-Passes
```

If the participant requires an unexported helper, the engine has failed. If the participant must read internal engine architecture documents to understand how to move an entity, the documentation has failed. If the game cannot be built without modifying `src/runtime/`, the engine has failed generality.

### 1.2 The Strict Evidence Boundary

We must state the exact evidence boundary with complete rigor:

> [!IMPORTANT]
> **Proof E Evidence Boundary**: The accepted successful blind participant in Proof E was a **fresh AI agent** operating with no prior memory of this codebase, receiving only the public repository surface and an unplanned game brief.
> 
> While `ROADMAP.md` notes that testing both human and AI participants is ideal, the accepted Proof E evidence in this repository **does not include a separate fresh human blind build**.
> 
> Furthermore, Order Five proves that **this specific bounded 3D collection puzzle** can be composed cleanly through the public API. It does **not** prove universal genre support, does not prove every conceivable game fits the engine, and does not prove that the engine is ready for advanced 3D physics, navmeshes, or networking.

Teaching the truth of what was proven—and what was *not* proven—is a fundamental engine law.

---

## 2. What Order Five Is: The Accepted Game Mechanics

Order Five is a bounded 3D top-down puzzle game where the player must collect five numbered relics in exact ascending order while evading moving hazards, then reach an exit that unlocks only upon full sequence completion.

Interactive route:
```text
http://localhost:5173/?game=sequence
```

```text
┌─────────────────────────────────────────────────────────────┐
│                       ARENA (16m x 16m)                     │
│                                                             │
│   [Relic 1] (-6,-6)                     [Relic 2] (+6,-6)   │
│           \                             /                   │
│            \        [Hazard A]         /                    │
│             \     ◄───(0, +3)───►     /                     │
│              \                       /                      │
│               ▲                     ▲                       │
│    [Hazard B] │      [Player]       │                       │
│     (-4, 0)   │       (0, 0)        │                       │
│        ▼      ▼                     ▼                       │
│                                                             │
│   [Relic 4] (-6,+6)                     [Relic 3] (+6,+6)   │
│                                                             │
│                      [Relic 5] (0, -6.5)                    │
│                                                             │
│                      [Exit Gate] (0, +7.1)                  │
│                     (Inactive until 5/5)                    │
└─────────────────────────────────────────────────────────────┘
```

Mechanically, the game implements:
- **Bounded 3D Arena**: A $16\text{m} \times 16\text{m}$ room with perimeter walls ($[-8, 8]$ in X and Z).
- **Kinematic Player**: Radius $0.45\text{m}$, speed $7.0\text{ m/s}$, clamped strictly within the perimeter walls.
- **Five Ordered Relics**: Positioned strategically around the arena. Each relic has an assigned order ($1 \dots 5$).
- **Wrong-Order Rejection**: Touching relic 3 when relic 1 is expected is rejected: the relic remains in the world, the score does not advance, and `sequence.rejected` increments.
- **Two Harmonic Hazards**: Moving obstacles oscillating along fixed axes using continuous sine functions.
- **Hazard Reset**: Contact with either hazard immediately resets the current attempt (player to center, relics restored, hazard clocks zeroed, state back to `READY`).
- **Inactive vs. Active Exit**: Touching the exit with $< 5$ relics increments `exit.inactiveContacts` without finishing. Touching the active exit with all 5 relics transitions the match to `COMPLETE`.
- **State Machine**: Clean progression: `READY` $\to$ `PLAYING` $\to$ `COMPLETE`.
- **Fixed-Step Clock**: Simulation updates in fixed 60 Hz steps ($dt = 1/60\text{s}$). Gameplay timer tracks `playTicks * (1/60)`.
- **Semantic Input**: `MoveX`, `MoveZ`, and `Reset` actions mapped to WASD, arrow keys, analog sticks, D-pad, and gamepad buttons.
- **Three.js Presentation**: Direct orthographic top-down projection reading game snapshots; rendering never mutates gameplay state.
- **DOM HUD**: Real-time status cards showing state, current objective, collection count ($0/5$), elapsed time, and controller connection status.

---

## 3. The Public Discovery Path: Onboarding Without Privileged Knowledge

A critical outcome of Proof E was verifying that a developer can discover how to build a game by following the documented reading order rather than guessing internal file locations.

The validated onboarding path is:

```text
1. README.md
   ├── Understands core product thesis (definitions as source, compiled artifacts, explicit realization)
   ├── Discovers public package surfaces (@sumosizedginger/my-game-engine-1.0/runtime and /full)
   └── Sees how to run tests and start the dev server
         │
         ▼
2. docs/learn/README.md
   ├── Learns that lessons are extracted from accepted, tested code
   └── Identifies relevant walkthroughs (Tiny Game for 2D/lifecycle, Different Genre for 3D/input)
         │
         ▼
3. docs/learn/BUILDING_A_TINY_GAME.md
   ├── Learns the 7-step construction pattern: Definition -> compileDefinition -> instantiate -> spawn -> setTransform
   ├── Learns how SimulationClock and fixed-step simulation work
   └── Learns how createStateManager and createRuleEngine cooperate
         │
         ▼
4. GAMEPLAY_FOUNDATION.md
   ├── Checks exact constructor signatures and options
   ├── Reads transform ownership contracts (KINEMATIC vs STATIC)
   ├── Notes that createStateManager requires explicit state contracts for new games
   └── Inspects semantic input binding APIs (bindScalarKey, bindScalarAxis)
         │
         ▼
5. docs/learn/BUILDING_A_DIFFERENT_GENRE.md
   ├── Sees how to map 3D movement and continuous velocity through the runtime
   └── Discovers the Engine-Promotion Test: keep game mechanics in project code!
```

This onboarding sequence allowed the blind participant to construct Order Five without needing internal architectural blueprints (`ARCHITECTURE.md`, `CONSTITUTION.md`, or private sub-specs).

---

## 4. Public Package & Barrel Discipline: What Project Code May Import

### 4.1 The Public Surface Contracts

`package.json` defines three public package entry points:

| Export | Path | Purpose |
|---|---|---|
| `@sumosizedginger/my-game-engine-1.0` | `src/index.js` | Default runtime entry point (re-exports `./runtime/index.js`) |
| `@sumosizedginger/my-game-engine-1.0/runtime` | `src/runtime/index.js` | Explicit runtime entry point |
| `@sumosizedginger/my-game-engine-1.0/full` | `src/full/index.js` | Runtime + definition compiler (`compileDefinition`) |

### 4.2 In-Repository Project Code vs. External Packages

When writing a game inside the engine repository (such as `src/games/sequence/game.js`), project code imports from the barrel files using relative paths:

```javascript
// Excerpt from src/games/sequence/game.js
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
```

> [!NOTE]
> **The Barrel Rule**: Importing `../../runtime/index.js` or `../../full/index.js` is fully legitimate for in-repo project code because those files are the exact implementation files pointed to by the public package exports.
> 
> **Never** import individual private modules like `../../runtime/transforms.js`, `../../runtime/entities.js`, or `../../runtime/clock.js`. Importing internal implementation modules bypasses public barrel encapsulation and breaks if internal file structures change.

---

## 5. The Construction Seam: Definition $\to$ Artifact $\to$ Runtime Record $\to$ Realization

My Game Engine 1.0 enforces a clean boundary between data definitions and runtime execution. Order Five adheres strictly to this 7-step lifecycle.

```text
1. Source Definition (definitions.js)
   └── Plain JSON-serializable object (id, type, data)
         │
         ▼
2. compileDefinition() (from full/index.js)
   └── Validates schema, stamps deterministic content fingerprint, freezes immutable artifact
         │
         ▼
3. runtime.instantiate() (from runtime/index.js)
   └── Validates artifact and returns a transient runtime instance record
         │
         ▼
4. entityManager.spawn()
   └── Allocates generational EntityHandle with gameplay role metadata
         │
         ▼
5. transformManager.setTransform()
   └── Registers entity in TransformManager with initial position and ownership
         │
         ▼
6. Gameplay Coordination (game.js)
   └── Wires rules, state variables, contacts, and fixed-step simulation
         │
         ▼
7. Project Rendering (renderer.js)
   └── Instantiates Three.js visual meshes reading transform data
```

### 5.1 Concrete Order Five Example

In `src/games/sequence/definitions.js`, definitions describe the objects declaratively:

```javascript
// Excerpt from src/games/sequence/definitions.js
export const PLAYER_DEFINITION = Object.freeze({
  id: 'def_order_five_player',
  type: 'prefab',
  data: Object.freeze({
    role: 'player',
    radius: 0.45,
    height: 0.9,
    speed: 7,
    initialX: 0,
    initialY: 0.45,
    initialZ: 0,
    color: '#38bdf8'
  })
});
```

In `src/games/sequence/game.js`, the game compiles, instantiates, and realizes the entity explicitly:

```javascript
// Excerpt from src/games/sequence/game.js (createSequenceGame)
// 1. Compile definition through the public compiler seam
const playerArtifact = compileDefinition(PLAYER_DEFINITION);

// 2. Create transient runtime instance record
runtime.instantiate(playerArtifact);

// 3. Spawn generational entity handle
const playerData = playerArtifact.data;
const playerHandle = entityManager.spawn({
  name: 'Player',
  role: playerData.role,
  radius: playerData.radius,
  speed: playerData.speed,
  color: playerData.color
});

// 4. Register transform authority
transformManager.setTransform(playerHandle, {
  position: { x: playerData.initialX, y: playerData.initialY, z: playerData.initialZ },
  velocity: { x: 0, y: 0, z: 0 },
  ownership: TRANSFORM_OWNERSHIP.KINEMATIC
});
```

> [!IMPORTANT]
> **No Magic Instantiation**: Calling `runtime.instantiate(artifact)` does **not** create scene-graph nodes, does not spawn entity IDs, and does not allocate physics colliders. It returns an instance record. Project code remains in full control of entity spawning, transform registration, and rendering realization.

---

## 6. Entity & Transform Authority: Kinematic vs. Static in 3D

Order Five follows the engine's core transform law:

> **EXACTLY ONE SYSTEM COMMITS AN ENTITY'S WORLD TRANSFORM PER SIMULATION STEP.**

Entities declare their ownership model when registered with `transformManager`:

| Entity | Transform Ownership | Movement Mechanism |
|---|---|---|
| **Arena** | `STATIC` | Immovable datum at $(0, 0, 0)$ |
| **Relics (1–5)** | `STATIC` | Immovable targets until collected |
| **Exit Gate** | `STATIC` | Immovable trigger volume at $(0, 0.55, 7.1)$ |
| **Player** | `KINEMATIC` | Position updated via velocity intent resolved against arena bounds |
| **Hazards (A, B)** | `KINEMATIC` | Position updated via velocity intent pointing to harmonic targets |

### 6.1 The Single-Writer Commit Cycle

During each 60 Hz tick, movement systems do not directly set `transform.position`. They set **intent**:

```javascript
// Excerpt from src/games/sequence/game.js
// 1. Compute target position within bounds
const nextX = clamp(transform.position.x + mx * playerData.speed * dt, arena.minX + radius, arena.maxX - radius);
const nextZ = clamp(transform.position.z + mz * playerData.speed * dt, arena.minZ + radius, arena.maxZ - radius);

// 2. Express as velocity intent
transformManager.setIntent(playerHandle, {
  x: (nextX - transform.position.x) / dt,
  y: 0,
  z: (nextZ - transform.position.z) / dt
});

// 3. Commit all transforms once at the end of the step
transformManager.commitAll(dt);
```

By funneling all position changes through `setIntent()` and `commitAll(dt)`, the game ensures that previous positions are preserved for interpolation, velocities are mathematically coherent, and no two systems fight over an entity's coordinates.

---

## 7. Fixed-Step Gameplay and Simulation Time

Order Five decouples simulation truth from rendering frames:

```text
Browser requestAnimationFrame (Variable delta)
                   │
                   ▼
       SimulationClock.advance(deltaMs)
                   │
         Accumulates elapsed time
         Consumes in fixed 1/60s chunks
                   │
                   ├─► game.step(1/60) ──► stepSimulation()
                   ├─► game.step(1/60) ──► stepSimulation()
                   ▼
       view.render(alpha)  (Alpha = remainder / fixedDt)
```

### 7.1 Play Ticks vs. Hazard Ticks

Order Five maintains two distinct tick counters:
- **`hazardTicks`**: Increments every simulation step while the match is not complete. Hazards continue their harmonic patrol even when the player is idle in the `READY` state.
- **`playTicks`**: Increments **only** when the game state is `PLAYING`. The gameplay timer (`playTicks * FIXED_DT`) measures active puzzle solving time, freezing when `COMPLETE` or `READY`.

```javascript
// Excerpt from src/games/sequence/game.js (stepSimulation)
const phase = state.getState();
if (phase === 'READY' && move.mag > 0) {
  state.transition('PLAYING');
  // ... update objective
}

const playing = state.getState() === 'PLAYING';
if (playing) {
  playTicks += 1;
}

hazardTicks += 1;
resolveHazardIntents(dt);
```

---

## 8. Semantic Input: Multi-Modal Control Without Hardware Leaks

Gameplay logic never inspects `window.addEventListener` or queries `navigator.getGamepads()` directly. It reads an immutable snapshot of declared semantic actions.

### 8.1 Input Declarations and Bindings

In `src/games/sequence/game.js`, `createSequenceInput()` configures scalar actions for both keyboard and gamepad:

```javascript
// Excerpt from src/games/sequence/game.js (createSequenceInput)
export function createSequenceInput() {
  const input = createInputSystem({
    actions: ['MoveX', 'MoveZ', 'MoveLeft', 'MoveRight', 'MoveUp', 'MoveDown', 'Reset'],
    keyboardBindings: {
      KeyR: 'Reset'
    }
  });

  // Keyboard scalar bindings: -1 or +1 deflection
  input.bindScalarKey('KeyA', 'MoveX', -1);
  input.bindScalarKey('ArrowLeft', 'MoveX', -1);
  input.bindScalarKey('KeyD', 'MoveX', 1);
  input.bindScalarKey('ArrowRight', 'MoveX', 1);
  input.bindScalarKey('KeyW', 'MoveZ', -1);
  input.bindScalarKey('ArrowUp', 'MoveZ', -1);
  input.bindScalarKey('KeyS', 'MoveZ', 1);
  input.bindScalarKey('ArrowDown', 'MoveZ', 1);

  // Gamepad analog stick bindings with deadzone filtering
  input.bindScalarAxis(0, 'MoveX', { deadzone: 0.25 });
  input.bindScalarAxis(1, 'MoveZ', { deadzone: 0.25 });

  // Gamepad D-pad button bindings
  input.bindGamepadButton(14, 'MoveLeft');
  input.bindGamepadButton(15, 'MoveRight');
  input.bindGamepadButton(12, 'MoveUp');
  input.bindGamepadButton(13, 'MoveDown');

  // Gamepad Reset buttons (Y / Triangle or Back / View)
  input.bindGamepadButton(3, 'Reset');
  input.bindGamepadButton(8, 'Reset');

  return input;
}
```

### 8.2 Input Resolution and Vector Clamping

When reading the input snapshot, the game aggregates continuous stick deflection with digital button states and clamps the resulting movement vector so diagonal travel does not exceed maximum speed:

```javascript
// Excerpt from src/games/sequence/game.js (readMove)
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
```

---

## 9. Ordered Collection Authority: Deterministic Sequence Rules

The core mechanic of Order Five is that relics must be collected in strict ascending order ($1 \to 2 \to 3 \to 4 \to 5$). This is implemented using the engine's declarative `createRuleEngine`.

### 9.1 Rules Engine vs. Hardcoded Conditions

Using declarative rules keeps game logic modular and testable:

```javascript
// Excerpt from src/games/sequence/game.js (createSequenceGame)
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
```

### 9.2 Invariant Guarantees
1. **No Skipping**: Relic 2 cannot be collected until Relic 1 has set `sequence.expected = 2`.
2. **No Double-Counting**: Once a relic has `collectible.<order>.collected = true`, contact checks skip it entirely.
3. **No Accidental Destruction**: Touching a relic out of order does not remove it from the arena or penalize the player beyond tracking `sequence.rejected`.

---

## 10. Deterministic Hazards: Project-Level Harmonic Motion

Order Five features two moving hazards:
- **Hazard A**: Patrols horizontally along the X-axis at $Z = 3.0\text{m}$.
- **Hazard B**: Patrols vertically along the Z-axis at $X = -4.0\text{m}$.

### 10.1 Closed-Form Harmonic Trajectory

Hazard positions are evaluated using a closed-form analytic function of simulation ticks:

$$\mathbf{P}(t) = \mathbf{P}_{\text{home}} + \sin(\omega \cdot t) \cdot \mathbf{A}$$

```javascript
// Excerpt from src/games/sequence/game.js
export function hazardPose(tick, data) {
  const phase = tick * data.omega;
  return {
    x: data.homeX + Math.sin(phase) * data.ampX,
    y: data.homeY,
    z: data.homeZ + Math.sin(phase) * data.ampZ
  };
}
```

Parameters from `definitions.js`:
- `hazardA`: $\mathbf{P}_{\text{home}} = (0, 0.45, 3)$, $\mathbf{A} = (5, 0, 0)$, $\omega = 0.05\text{ rad/tick}$
- `hazardB`: $\mathbf{P}_{\text{home}} = (-4, 0.45, 0)$, $\mathbf{A} = (0, 0, 5)$, $\omega = 0.037\text{ rad/tick}$

### 10.2 Why Closed-Form Trajectories Matter
1. **100% Deterministic**: Tick count $t$ uniquely determines hazard position. Two simulation runs on different machines with the same tick count produce bit-exact coordinates.
2. **Zero Accumulation Drift**: Numerical integration error does not compound over time.
3. **Instant Reset**: Teleporting to tick $0$ returns the hazard precisely to its initial starting point.

---

## 11. Reset as a Real Architectural Contract

In many indie engines, "resetting" a level involves reloading the web page or tearing down the entire scene graph. In My Game Engine 1.0, **reset is a first-class gameplay contract**:

```javascript
// Excerpt from src/games/sequence/game.js (resetAttempt)
function resetAttempt() {
  // 1. Reset player position and velocity
  transformManager.teleport(playerHandle, {
    x: playerData.initialX,
    y: playerData.initialY,
    z: playerData.initialZ
  });
  transformManager.setIntent(playerHandle, { x: 0, y: 0, z: 0 });
  transformManager.setVelocity(playerHandle, { x: 0, y: 0, z: 0 });

  // 2. Reset collectible transforms
  for (const collectible of collectibles) {
    transformManager.teleport(collectible.handle, {
      x: collectible.artifact.data.initialX,
      y: collectible.artifact.data.initialY,
      z: collectible.artifact.data.initialZ
    });
  }

  // 3. Reset hazard ticks and poses
  hazardTicks = 0;
  playTicks = 0;
  for (const hazard of hazards) {
    const pose = hazardPose(0, hazard.data);
    transformManager.teleport(hazard.handle, pose);
    transformManager.setIntent(hazard.handle, { x: 0, y: 0, z: 0 });
    transformManager.setVelocity(hazard.handle, { x: 0, y: 0, z: 0 });
  }

  // 4. Reset simulation clock and state variables
  clock.reset();
  state.reset('READY', createInitialVars());
}
```

Because reset is instantaneous, deterministic, and lightweight:
- Touching a hazard triggers `resetAttempt()` immediately without dropped frames.
- Pressing `KeyR` or Gamepad Y restarts the puzzle instantly.
- Headless evaluation tests can run hundreds of consecutive play cycles in milliseconds.

---

## 12. Exit & Completion Authority: Inactive vs. Active Triggers

The exit gate occupies the south boundary ($Z = 7.1\text{m}$). It exhibits two distinct states governed by rules:

```javascript
// Excerpt from src/games/sequence/game.js
// Rule 1: Inactive exit contact is recorded but does not finish
rules.addRule({
  name: 'inactive_exit_ignored',
  event: 'EXIT_CONTACT',
  condition: () => state.getVar('exit.active', false) !== true,
  action: () => {
    state.incrementVar('exit.inactiveContacts');
  }
});

// Rule 2: Active exit contact completes the game
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
```

Upon entering `COMPLETE`:
- Player and hazard velocities are zeroed.
- The gameplay timer freezes.
- The DOM HUD changes state styling to victory colors.
- Subsequent inputs do not move the character.

---

## 13. State Management: Declaring Custom State Contracts

In `src/games/sequence/game.js`, the state manager is initialized explicitly:

```javascript
// Excerpt from src/games/sequence/game.js
const state = createStateManager({
  initialState: 'READY',
  validStates: ['READY', 'PLAYING', 'COMPLETE'],
  initialVars
});
```

> [!WARNING]
> **Explicit State Configuration Required**: Calling `createStateManager()` with no arguments retains historical Pong-compatible defaults (`initialState: 'SERVE'`, `validStates: ['SERVE', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'PAUSED']`).
> 
> New games should **always explicitly declare** `initialState` and `validStates` matching their specific game loop. Attempting to transition to an unlisted state throws an error, protecting the game against invalid lifecycle transitions.

---

## 14. Three.js as Project Presentation: Viewers Without Privileged Forges

In Proof B2, arena geometry and materials were compiled using internal repository systems: Geometry Forge (`src/geometry/`) and Material Forge (`src/material/`).

A key question for Proof E was:

> *Does an ordinary project need to import or understand Geometry Forge and Material Forge just to render a 3D game?*

The answer is **no**.

### 14.1 Direct Three.js Presentation is Legitimate Project Code

In `src/games/sequence/renderer.js`, the game creates meshes, lights, and materials directly through Three.js:

```javascript
// Excerpt from src/games/sequence/renderer.js
export function createSequenceRenderer(container, game) {
  const scene = new Scene();
  scene.background = new Color('#0b1220');

  // Top-down orthographic spectator camera
  const camera = new OrthographicCamera(-11, 11, 11, -11, 0.1, 80);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 28, 0);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setClearColor('#0b1220');
  container.appendChild(renderer.domElement);
  // ...
}
```

### 14.2 The Unidirectional Presentation Seam

The renderer observes engine truth; it never dictates it:

```text
Game Simulation (Fixed 60 Hz)
       │
       ▼  game.snapshot()
Renderer.render(alpha)
       │
       ├── Reads player position & interpolates with previous frame
       ├── Toggles relic mesh visibility based on item.collected
       ├── Swaps exit material between active and inactive presets
       └── Draws frame to WebGL canvas
```

The renderer does not track whether relics were collected, does not calculate collision, and does not alter velocity. If the renderer is destroyed or disconnected, the headless game continues running identically.

---

## 15. Planar XZ Overlap: Adapting 2D Collision Primitives

My Game Engine 1.0 provides a public 2D axis-aligned bounding box test:

```javascript
import { checkAABB } from '@sumosizedginger/my-game-engine-1.0/runtime';
// Contract: checkAABB(boxA, boxB) where box = { x, y, halfWidth, halfHeight }
```

Order Five takes place in a 3D world on the horizontal $(X, Z)$ ground plane ($Y \approx 0$).

### 15.1 The Project-Level Adapter

Rather than petitioning for an engine-level 3D physics engine or creating speculative 3D collider systems, Order Five writes two simple adapter functions in project code:

```javascript
// Excerpt from src/games/sequence/game.js
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
```

This maps 3D horizontal coordinates $(x, z)$ directly onto the 2D collision primitive's $(x, y)$ fields:

```javascript
// Excerpt from src/games/sequence/game.js (evaluateContacts)
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
```

> [!IMPORTANT]
> **Boundary of the Adapter**: This is planar 2D overlap testing applied to objects resting on a flat floor datum ($Y = 0$).
> 
> It is **not** volumetric 3D collision, does not handle 3D slopes or vertical stacking, and does not replace the continuous line-segment swept testing used in Proof D's racing barriers. It is a clean, minimal project-level solution for top-down games.

---

## 16. Project-Level First: The Engine-Promotion Test

One of the most vital architecture laws taught across all engine lessons is the **Engine-Promotion Test** (`ROADMAP.md` §40):

```text
                  Does project code solve it cleanly?
                               │
                ┌──────────────┴──────────────┐
               YES                            NO
                │                              │
Does it require privileged access?             ▼
                │                    Candidate for core engine
        ┌───────┴───────┐
       NO              YES
        │               │
        ▼               ▼
KEEP PROJECT-LEVEL   Promote to Engine Substrate
```

Proof E provides concrete examples of applying this test:

| Feature in Order Five | Handled In | Why Not Core Engine? |
|---|---|---|
| **Ordered Collection Sequence** | `src/games/sequence/game.js` | Solved with standard `createRuleEngine` rules. No core engine changes needed. |
| **Harmonic Hazard Trajectories** | `src/games/sequence/game.js` | Simple sine function in project code. Other games may use paths, physics, or navmeshes. |
| **Exit Activation Mechanics** | `src/games/sequence/game.js` | Project rule switching `exit.active` state. |
| **XZ Planar Collision Adapter** | `src/games/sequence/game.js` | 8-line helper adapting 3D $(x, z)$ to 2D `checkAABB`. |
| **Orthographic Renderer** | `src/games/sequence/renderer.js` | Project-level Three.js scene. Pong is 2D Canvas, Racing is 3D chase camera. |

Resisting the urge to promote every project-level helper into the core engine keeps the engine lean, focused, and free of single-game baggage.

---

## 17. What Friction Means: Diagnostics and Failure Classification

When a blind user encounters difficulty using an engine, `ROADMAP.md` §44 classifies the friction into six distinct categories:

```text
1. API Defect: Engine code produces incorrect results or throws unexpected errors.
2. Documentation Defect: Engine works correctly, but documentation gives wrong examples or signatures.
3. Tooling Defect: Build, test, or evaluation tools fail or report false negatives.
4. Diagnostics Defect: Something fails silently without a clear error code or message.
5. Missing Public Capability: The engine genuinely lacks an essential foundation layer.
6. Unreasonable Task Assumption: The user expected the engine to do something outside its defined scope.
```

### Inconvenience Is Not a Missing Engine Capability

A crucial realization during blind testing is that **inconvenience does not equal an engine defect**.

If a developer wishes the engine had an automatic `createPatrollingEnemy()` helper, that is not a missing engine capability. The engine provides entity handles, transform management, kinematic velocity intent, and fixed-step simulation. Writing the patrol trajectory in project code is normal game programming.

---

## 18. Documentation Is Part of the API Surface

Proof E reinforced a profound engineering lesson:

> **A mechanically correct engine can still fail a blind user if public documentation points at incorrect behavior.**

During the initial phase of blind testing, the engine code was technically functional, but minor documentation discrepancies caused friction:
- Documentation in `GAMEPLAY_FOUNDATION.md` gave an outdated example of state machine configuration that did not match the accepted game loop.
- Certain docs suggested that calling `runtime.instantiate()` automatically spawned entity scene objects.

These were not engine runtime bugs; they were **documentation defects**.

Public documentation is not marketing material or an afterthought. For a developer or AI relying exclusively on the public interface, **the documentation is the interface**. When docs and source diverge, the engine is broken. Maintaining 100% fidelity between documentation and accepted source is as critical as passing unit tests.

---

## 19. Testing Order Five: Verifying Project-Level Contracts

Order Five is validated by 10 focused automated tests in `tests/sequence.test.js`. These tests prove that the public engine contracts hold under automated testing.

The current repository contains **186 tests across 11 suites**. Order Five contributes 10 focused tests:

```text
tests/sequence.test.js
├── 1. constructs through public runtime and compile surfaces
├── 2. player movement and arena containment
├── 3. keyboard and controller semantic input move the player
├── 4. wrong collectible order is rejected and does not remove the relic
├── 5. correct order advances and collected relics cannot double-count
├── 6. moving hazards are deterministic from reset
├── 7. hazard collision resets the attempt
├── 8. inactive exit does not complete; active exit does
├── 9. reset restores initial gameplay truth
└── 10. public AABB overlap and lifecycle disposal
```

### 19.1 Key Test Examples

Testing deterministic hazard trajectories:
```javascript
// Excerpt from tests/sequence.test.js
test('sequence game: moving hazards are deterministic from reset', () => {
  const a = createSequenceGame({ env: 'test' });
  const b = createSequenceGame({ env: 'test' });
  for (let i = 0; i < 90; i++) {
    a.step();
    b.step();
  }
  const sa = a.getState();
  const sb = b.getState();
  // Exact state parity across independent instances
  assert.deepEqual(sa.hazards, sb.hazards);
  assert.equal(sa.hazardTicks, 90);

  // Exact agreement with mathematical closed-form prediction
  const predicted = hazardPose(sa.hazardTicks, HAZARD_DEFINITIONS[0].data);
  assert.ok(Math.abs(sa.hazards[0].position.x - predicted.x) < 1e-9);

  a.dispose();
  b.dispose();
});
```

Testing lifecycle disposal and entity cleanup:
```javascript
// Excerpt from tests/sequence.test.js
test('sequence game: public AABB overlap and lifecycle disposal', () => {
  const game = createSequenceGame({ env: 'test' });
  assert.ok(game.entityManager.count() >= 9);
  game.dispose();
  assert.equal(game.entityManager.count(), 0);
  assert.throws(() => game.step(), /SEQUENCE_GAME_DISPOSED/);
});
```

---

## 20. Evaluation Boundary: Legacy Targets vs. Project Tests

It is vital to understand where Order Five sits in the evaluation architecture:

- `npm run eval` executes the **A0 evaluation harness** (`src/eval/harness.js`).
- The evaluation harness tests **six historical targets**:
  1. `phase0_boot_fixture`
  2. `proof_a_pong_fixture`
  3. `proof_b1_motion_fixture`
  4. `proof_b2_combat_fixture`
  5. `proof_c_world_fixture`
  6. `proof_d_racing_fixture`

All six legacy capture hashes remain bit-for-bit identical:

| Fixture | Expected SHA-256 |
|---|---|
| `phase0_boot_fixture.png` | `8c653d67a60964927145417146fb59d71d9fbb928da730304aee96539d0c7001` |
| `proof_a_pong_fixture.png` | `897629089a8f187a11f2a2c375247d8ab4c2ab1a31819864ce940e94ddf3eb56` |
| `proof_b1_motion_fixture.png` | `2077e153e976119d27ad3e7f3f93d353078cc164c8f86e43b363c94a8c47baba` |
| `proof_b2_combat_fixture.png` | `428ce84e9cdafdc7d2b93f0b3ab03a9d1a96e091967ddf81e19f7fb9677ec2f7` |
| `proof_c_world_fixture.png` | `16062a2bd13bc616727ed0a39c9a7d93e9b97e3bed81edf572707d3cac433146` |
| `proof_d_racing_fixture.png` | `736f15b0a0c98755767e7dd9af165e703453f8d148887fe0f22b0fbb1821abaf` |

Order Five is **not** an evaluator target and does not produce a seventh capture hash. It is an independent, complete project proof tested via `tests/sequence.test.js` and playable via `/?game=sequence`.

---

## 21. What Proof E Did Not Earn: Explicit Non-Goals

To maintain strict architectural discipline, we explicitly state what Proof E **did not earn**:

1. **No Universal Route Registry**: Routing in `src/browser/main.js` continues to use explicit `if/else` checks. Proof E did not create a speculative dynamic plugin router.
2. **No Volumetric 3D Physics Engine**: The `xzBox` adapter solved planar overlap. Proof E did not earn Rapier, PhysX, or complex 3D rigid-body dynamics.
3. **No Forge Export Expansion**: Proof E confirmed that Geometry Forge and Material Forge do not need to be exported in package barrels for games to render 3D visuals.
4. **No Rewritten State Machine Architecture**: `createStateManager` remains a minimal finite state machine.
5. **No Universal Genre Claim**: Passing one blind collection puzzle does not prove the engine can run real-time strategy games, MMOs, or flight simulators without further evolution.

---

## 22. Why Blind Generality Matters

An engine architecture is easy to believe in when the people who designed it are the only ones building games with it. They know where the rough edges are and instinctively steer around them.

The true test of an abstraction is whether a developer who never saw the engine's internal debates, who never read its planning notes, and who has access only to the public documentation and package barrels can sit down and build a complete, fun, working game.

Proof E provided concrete evidence that **My Game Engine 1.0 has achieved real public-API generality**.

By keeping the core runtime focused on universal foundations (entities, transforms, fixed clocks, semantic input, state, and rules) and leaving genre-specific mechanics to project code, the engine empowers developers to build games the engine itself never anticipated.
