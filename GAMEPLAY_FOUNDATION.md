# GAMEPLAY_FOUNDATION.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **Proof A — Tiny Complete Game (Pong)**

This document defines the durable gameplay foundation architecture of My Game Engine 1.0. It documents the contracts, data flow, and runtime primitives established and evidenced by Proof A.

---

## 1. Core Architectural Laws

1. **Browser-First Execution**: Gameplay logic executes deterministically in modern standards-compliant web environments without requiring native runtime wrappers or server-side game servers.
2. **Fixed Gameplay Simulation**: Gameplay state advances on a discrete, fixed-timestep simulation cadence independent of variable display refresh rates.
3. **One Authoritative Transform Writer**: Exactly one subsystem or capability may commit an entity's authoritative world transform during a single simulation step.
4. **Action-Based Input**: Gameplay code queries semantic actions (e.g. `MoveUp`, `MoveDown`, `Pause`), never physical keys or controller hardware indices directly.
5. **Generational Entity Handles**: Runtime entity references are generational handles (`index`, `generation`). Reusing an entity slot increments its generation, invalidating stale handles and preventing silent reference bugs.
6. **Zero External Physics Engine for Foundational Mechanics**: Simple bounding volumes and deterministic arithmetic handle arcade-scale collisions. External solvers (e.g. Rapier) are not foundational engine dependencies.
7. **Definition / Artifact / Runtime Separation**: Game objects and court configurations originate as validated definitions, compile via the Kiln seam into immutable artifacts, and instantiate as transient runtime objects.

---

## 2. Entity Identity

Runtime entities use an index-and-generation slot architecture.

### 2.1 `EntityHandle` Contract

An `EntityHandle` is an immutable, lightweight value object representing an active entity instance:

```text
EntityHandle {
  index: number       // Non-negative integer index in the entity pool
  generation: number  // Monotonically increasing generation count for that slot
}
```

### 2.2 Slot Lifecycle & Stale Reference Prevention

```text
Pool: [Slot 0 (gen 1: ALIVE)] -> despawn(handle) -> [Slot 0 (gen 2: FREE)] -> spawn() -> [Slot 0 (gen 2: ALIVE)]
```

When an entity is destroyed:
1. The slot is marked free and queued for recycling.
2. The slot's generation counter increments.
3. Old handles carrying the previous generation fail `isValid(handle)` and return `null` on `getEntity(handle)`.
4. Runtime handles are ephemeral and never serialized as persistent IDs.

---

## 3. Transform Authority

Entities participating in the simulation carry a `Transform` record:

```text
Transform {
  position: { x: number, y: number, z?: number }
  velocity: { x: number, y: number, z?: number }
  previousPosition: { x: number, y: number, z?: number }
  ownership: 'STATIC' | 'KINEMATIC' | 'SIMULATED' | 'ATTACHED'
}
```

### 3.1 Ownership Models

- **`STATIC`**: Immovable scenery or arena boundary. Cannot be mutated by movement or simulation.
- **`KINEMATIC`**: Driven directly by gameplay control or AI intent (e.g. paddles). Velocity reflects control intent; collisions constrain or clamp movement.
- **`SIMULATED`**: Driven by integration and physical collision deflection (e.g. ball).
- **`ATTACHED`**: Derives world transform hierarchically from a parent entity.

### 3.2 Commit Rule

During each fixed simulation step, only the designated authority commits the transform:
- Systems write movement intent into velocity or pending offsets.
- Collision resolution verifies and clamps movement intent.
- The authoritative transform committer writes final `position` and records `previousPosition` for rendering interpolation.
- Animation and cosmetic effects may produce pose or root intent, but must not directly mutate world transforms.

---

## 4. Simulation Clock & Fixed-Step Scheduling

Gameplay simulation advances via a fixed-timestep accumulator loop:

```text
accumulatedTime += frameDeltaTime
while (accumulatedTime >= fixedDeltaTime) {
  stepSimulation(fixedDeltaTime)
  accumulatedTime -= fixedDeltaTime
}
```

### 4.1 Fixed Timestep

The default simulation rate is **60 Hz** (`fixedDelta = 1/60s ≈ 0.016667s`).

### 4.2 Standard Simulation Step Order

Within each fixed step, systems execute in strict deterministic sequence:

1. **Capture Input Snapshot**: Sample active hardware bindings into an immutable action snapshot.
2. **Advance Timers & Resolve State**: Update state machines and active game phase.
3. **Evaluate Movement Intent**: Compute paddle motion intent and AI trajectory tracking.
4. **Collision Detection & Resolution**: Test bounding volumes (AABB) against arena boundaries and dynamic entities.
5. **Commit Authoritative Transforms**: Finalize entity positions and velocities.
6. **Evaluate Rules & Triggers**: Trigger declarative rules (e.g. score rules, win condition checks).
7. **Queue Events & Synchronize UI**: Emit frame events and update DOM HUD state.

---

## 5. Action-Based Input System

### 5.1 Architecture

```text
Physical Devices (Keyboard, Gamepad)
         |
         v
   Binding Layer (Key codes, axes, gamepad buttons)
         |
         v
   Input Snapshot (Immutable map: Action -> boolean / scalar)
         |
         v
   Gameplay Logic (queries isActionActive('MoveUp'))
```

### 5.2 Canonical Actions in Proof A

- `MoveUp`: Move paddle upward (positive Y).
- `MoveDown`: Move paddle downward (negative Y).
- `Pause`: Toggle simulation pause state.
- `Reset`: Reset round or match.

### 5.3 Device Bindings (Proof A Defaults)

- **Keyboard**:
  - `MoveUp`: `KeyW`, `ArrowUp`
  - `MoveDown`: `KeyS`, `ArrowDown`
  - `Pause`: `KeyP`, `Space`
  - `Reset`: `KeyR`
- **Gamepad / Controller**:
  - `MoveUp`: Left Stick Up (`axis 1 < -0.4`), D-Pad Up (`button 12`)
  - `MoveDown`: Left Stick Down (`axis 1 > 0.4`), D-Pad Down (`button 13`)
  - `Pause`: Start / Options (`button 9`), Button South (`button 0`)
  - `Reset`: Button North (`button 3`), Back / Select (`button 8`)
- **Programmatic Simulation**:
  - Headless test and evaluation harness injects actions directly (`simulateAction(action, active)`) without requiring physical hardware.

### 5.4 Generic Controller Binding Interface

The action-based input system exposes a generic binding layer for standard W3C Gamepad devices:

- `bindGamepadButton(buttonIndex, action)`: Binds a physical button index (e.g. 0 for South/A) to a declared semantic action. Passing `null` unbinds the button.
- `bindGamepadAxis(axisIndex, negativeAction, positiveAction, { deadzone })`: Binds an analog axis to bidirectional semantic actions (e.g. axis 0 for Left/Right, axis 1 for Forward/Backward) with a configurable deflection deadzone (default 0.4).
- `setGamepad(mockGamepad)`: Injects a Gamepad-like object for headless test validation.
- **Contract Enforcement**: Binding attempts to undeclared actions are strictly rejected with an error.

### 5.5 Canonical Actions & Controller Mappings in Proof B2

B2 declares combat actions: `MoveForward`, `MoveBackward`, `MoveLeft`, `MoveRight`, `Attack`, `Reset`.

> **Note on Directional Semantics**: The semantic action names `MoveForward` and `MoveBackward` are world/gameplay-direction names (+Z towards camera/enemy, -Z away from camera into the arena). For Proof B2's spectator camera (positioned at +Z looking toward -Z), the default input bindings are intentionally screen-space oriented:
> - Pushing Up / away on screen binds to `MoveBackward` (character moves upward/away from camera on screen, -Z).
> - Pushing Down / toward camera on screen binds to `MoveForward` (character moves downward/toward camera on screen, +Z).

- **Keyboard**:
  - `MoveBackward` (Up / away on screen): `KeyW`, `ArrowUp`
  - `MoveForward` (Down / toward camera on screen): `KeyS`, `ArrowDown`
  - `MoveLeft`: `KeyA`, `ArrowLeft`
  - `MoveRight`: `KeyD`, `ArrowRight`
  - `Attack`: `Space`, `KeyJ`
  - `Reset`: `KeyR`
- **Gamepad / Controller** (Deadzone: `0.25` for B2 axes):
  - `MoveBackward`: Left Stick Y negative / pushed up (`axis 1 < -0.25`), D-Pad Up (`button 12`)
  - `MoveForward`: Left Stick Y positive / pushed down (`axis 1 > +0.25`), D-Pad Down (`button 13`)
  - `MoveLeft`: Left Stick Left (`axis 0 < -0.25`), D-Pad Left (`button 14`)
  - `MoveRight`: Left Stick Right (`axis 0 > +0.25`), D-Pad Right (`button 15`)
  - `Attack`: Button South / A / Cross (`button 0`)
  - `Reset`: Button North / Y / Triangle (`button 3`), Back / Select (`button 8`)

---

### 5.6 Generic scalar actions (Proof D implementation)

The additive scalar channel preserves magnitude before immutable snapshot capture.
Existing boolean bindings, `simulateAction`, `isActionActive` and boolean values
from `getAllActions()` remain compatible. Existing games need no migration.

- `bindScalarKey(code, action, value = 1)` maps a key to a finite signed value,
  clamped to [-1, 1]. Null action removes that scalar binding.
- `bindScalarAxis(index, action, { deadzone = 0.15 })` preserves signed axis
  magnitude. Deadzone must be finite in [0, 1). Inside it the value is zero;
  outside it magnitude is `(abs(axis) - deadzone) / (1 - deadzone)`.
- `bindScalarButton(index, action)` reads button magnitude in [0, 1], falling
  back to `pressed` only when an object has no value. Null action unbinds either
  scalar device binding. Undeclared actions and invalid indices are rejected.
- Nonfinite or absent hardware values become zero; finite hardware values clamp.
  Disconnected injected pads contribute no scalar values. Navigator discovery
  retains the existing sparse-slot and reconnect policy.
- Snapshot `getActionValue(action)` returns a number, or zero for unknown actions.
  `getAllActionValues()` returns a frozen map. Boolean-only actions read as 0/1.
  A nonzero scalar also makes the corresponding boolean action active.
- Keyboard aliases contributing the same scalar count once. Distinct held-key
  values sum and clamp, so opposite digital steering cancels. Sources then merge
  by greatest absolute magnitude. Ties retain the earlier source: legacy boolean,
  scalar keyboard, scalar axes in binding order, scalar buttons in binding order.
- `simulateActionValue(action, value)` sets a finite, clamped scalar override,
  including zero. Legacy boolean simulation remains an additive boolean source.
  Scalar overrides do not suppress an independently active legacy boolean action.
  `clear()` and `detach()` remove simulated scalar overrides.

This channel is generic input substrate. Racing actions and bindings remain in
`src/games/racing/game.js`; gameplay never reads raw controller state. Camera
orbit uses the same semantic channel but is consumed only by project presentation.
Coverage: legacy `tests/input.test.js`, plus `tests/racing.test.js` and
`tests/racing-browser.test.js`.

## 6. Deterministic Collision

Proof A establishes 2D Axis-Aligned Bounding Box (AABB) and arena boundary collision:

```text
Box {
  x: number       // Center X
  y: number       // Center Y
  halfWidth: number
  halfHeight: number
}
```

### 6.1 Collision Contracts

- **Arena Boundaries**: Top and bottom walls constrain the ball and paddles to the arena. Ball inverts Y velocity upon collision; paddles clamp position to arena bounds.
- **Dynamic Paddle Collision**: When the ball intersects a paddle's AABB:
  - Ball X position is placed outside the paddle boundary to prevent sticking.
  - Ball X velocity reverses with a slight speed multiplier.
  - Ball Y velocity reflects the impact point relative to the paddle center:
    $$\Delta Y = \frac{\text{ball.y} - \text{paddle.y}}{\text{paddle.halfHeight}} \times \text{deflectionSpeed}$$
- Zero external physics engine is used. Arithmetic is deterministic.

---

## 7. Runtime Variables, State, and Rules

### 7.1 Runtime Variables

A key-value variable registry tracks match metadata:
- `score.player1`: Score of player 1 (left).
- `score.player2`: Score of player 2 (right).
- `score.max`: Points required to win match (default: 5).
- `match.status`: Current state name.

### 7.2 Finite State Primitives

The game state machine operates across explicit phases:
- `SERVE`: Ball stationary; waiting for serve or timer.
- `PLAYING`: Active rally in progress.
- `ROUND_OVER`: Point scored; resetting positions.
- `GAME_OVER`: Winning score reached; match concluded.
- `PAUSED`: Simulation suspended.

### 7.3 Declarative Rules Engine

Rules connect events, conditions, and actions without custom procedural boilerplate:

```text
WHEN 'BALL_OUT_OF_BOUNDS'
IF ball.x < arena.minX
DO scorePoint('player2')

WHEN 'SCORE_UPDATED'
IF score.player1 >= score.max OR score.player2 >= score.max
DO transitionState('GAME_OVER')
```

---

## 8. Kiln Seam Integration

Proof A establishes the legitimate definition-to-artifact compile seam:

1. **Definition**: `PongArenaDefinition`, `PaddlePrefabDefinition`, `BallPrefabDefinition` (declarative objects defining dimensions, speeds, colors, and capabilities).
2. **Compiler Step**: `compileDefinition(definition)` validates required fields, recursively copies and freezes JSON-compatible configuration data, normalizes omitted data to an empty object, computes a deterministic pure-JS content fingerprint, and emits a frozen `Artifact`.
   - **Non-Cryptographic Fingerprint**: The current implementation computes a fast, deterministic pure-JS hexadecimal content fingerprint. It is **not** SHA-256 and is **non-cryptographic**. It provides deterministic content identity within current Proof A scope without introducing browser async `crypto.subtle` requirements or Node-specific dependencies into the synchronous compiler seam.
   - **Metadata Separation**: The `compiledAt` timestamp is runtime compile metadata and is explicitly excluded from the deterministic content fingerprint, preserving stable identity across identical definition compilations.
   - **Cryptographic Provenance**: Cryptographic artifact provenance and integrity hashing (e.g. SHA-256) is **future work** and should only be introduced when a later proof or export distribution workflow actually requires it.
3. Instantiate Step: `runtime.instantiate(artifact, context)` currently returns a transient runtime instance record with `instanceId`, `artifactId`, `type`, `data`, `instantiatedAt`, and `context`. For compiled configuration objects, `data` references `artifact.data`; the optional context defaults to an empty object. This operation does not automatically spawn an entity, register a transform, attach renderable state, or realize game-specific components.
4. Explicit Gameplay Realization: Proof A separately calls `entityManager.spawn(...)` with fields derived from `artifact.data`, then `transformManager.setTransform(handle, ...)` with position, velocity, and ownership. Rendering remains project-specific. See [Building a Tiny Game, section 3](docs/learn/BUILDING_A_TINY_GAME.md#3-definition--artifact--instantiate) for the construction sequence.

These separate operations preserve Definition / Artifact / Runtime separation. They describe the accepted minimal seam, not a final universal prefab or component-instantiation architecture.

Purity invariant: `compileDefinition` is isolated to the full/authoring seam and does not pollute `engine/runtime`.

---

## 9. DOM-First UI & Static Build Target

- **Score HUD**: High-contrast DOM overlay rendering scores, current match state badge, and control hints.
- **DOM Independence**: Simulation logic updates variables; HUD syncs from state. HUD rendering never dictates simulation truth.
- **Static Export**: Proof A builds cleanly via `vite build` to `dist/`, runnable from any standard static HTTP server with zero server-side engine processes.
