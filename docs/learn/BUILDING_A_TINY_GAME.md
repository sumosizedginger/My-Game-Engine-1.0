# Building a Tiny Game: The Proof A Architecture Walkthrough

## Status

**ACCEPTED LEARNING MATERIAL**  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Ground truth base revision: `2c73c29450ed2412638a334bd90fb8919c1220a0`  
Governing specification: [`GAMEPLAY_FOUNDATION.md`](file:///GAMEPLAY_FOUNDATION.md)  
Primary source implementation: [`src/games/pong/`](file:///src/games/pong/) and [`src/runtime/`](file:///src/runtime/)

---

## 1. What Proof A Proves

**Proof A** establishes the first complete, playable game-production spine of **My Game Engine 1.0**.

Rather than jumping straight to complex 3D environments, skeletal animation, or large worlds, the engine builds its foundation on an arcade-scale game: **Pong**. 

Proof A proves that the engine can:
1. **Represent entities safely** using generational runtime handles without raw memory pointers or object-identity leaks.
2. **Enforce transform authority** so that only one designated system commits position and velocity during each simulation step.
3. **Advance simulation on a fixed-timestep clock** (60 Hz accumulator) decoupled from variable display refresh rates.
4. **Abstract player input into semantic actions**, decoupling game mechanics from physical hardware and enabling identical execution for keyboard, controller, and headless evaluation.
5. **Resolve 2D collisions deterministically** without relying on heavyweight third-party physics solvers.
6. **Track runtime state and match variables** cleanly using centralized registries and finite state machines.
7. **Orchestrate game logic through declarative rules** (`WHEN / IF / DO`) instead of tangled procedural spaghetti.
8. **Drive high-performance rendering** via Canvas2D with interpolated transforms alongside high-contrast DOM overlays.
9. **Separate definitions from runtime objects** via an authoring compile seam (`Definition → Artifact → Instantiate`).
10. **Build into a self-contained static web bundle** that runs in any standard browser without an engine server or Studio editor.
11. **Verify gameplay determinism automatically** using a headless browser evaluation harness producing bit-for-bit identical visual captures.

---

## 2. Where the Pong Implementation Lives

All source files for Proof A are organized under clean architectural seams:

```text
My-Game-Engine-1.0/
├── src/
│   ├── games/
│   │   └── pong/
│   │       ├── definitions.js    # Declarative source definitions (arena, paddles, ball, rules)
│   │       ├── game.js           # Game coordinator wiring subsystems together
│   │       ├── renderer.js       # Canvas2D court renderer & DOM HUD sync
│   │       └── index.js          # Public game entry point
│   ├── runtime/                  # Foundational gameplay runtime (pure, zero compiler dependencies)
│   │   ├── entities.js           # Generational entity handles & pool recycling
│   │   ├── transforms.js         # Authoritative transform records & single-writer commits
│   │   ├── clock.js              # Fixed-step 60 Hz accumulator clock
│   │   ├── input.js              # Semantic action input, keyboard/gamepad bindings, test simulation
│   │   ├── collision.js          # Deterministic AABB math, paddle deflection, boundary clamps
│   │   ├── state.js              # Runtime variable registry & finite state machine
│   │   ├── rules.js              # Declarative WHEN/IF/DO rule engine
│   │   └── index.js              # Baseline runtime entry point
│   ├── full/
│   │   ├── compiler.js           # Minimal authoring compile seam (compileDefinition)
│   │   └── index.js              # Full engine entry point
│   ├── browser/
│   │   └── main.js               # Browser boot script supporting both Phase 0 and Pong routes
│   └── eval/                     # Headless browser evaluation harness (Puppeteer)
│       ├── harness.js            # Orchestrates server lifecycle, multi-target checks, and captures
│       ├── browser.js            # Browser driver inspecting window.__PROOF_A_PONG__
│       └── run.js                # CLI runner for `npm run eval`
└── tests/
    ├── entities.test.js          # Generational handle lifecycle & stale reference tests
    ├── clock.test.js             # Fixed-step accumulator timing tests
    ├── input.test.js             # Action mapping, keyboard, gamepad, and simulation tests
    ├── collision.test.js         # AABB intersection, wall bounce, and paddle deflection tests
    ├── state-rules.test.js       # State machine transitions and declarative rule tests
    └── pong.test.js              # End-to-end headless game coordinator integration tests
```

---

## 3. Definition → Artifact → Instantiate

A core law of My Game Engine 1.0 ([`CONSTITUTION.md`](file:///CONSTITUTION.md) §3 and [`ARCHITECTURE.md`](file:///ARCHITECTURE.md) §5) is the strict separation of asset phases:

```text
Definition (Source) ──[ compileDefinition ]──> Artifact (Immutable) ──[ runtime.instantiate ]──> Runtime Object (Transient)
```

- **Definition**: Plain, serializable JavaScript objects defining properties, dimensions, speeds, and rules. Definitions are the source of truth.
- **Artifact**: The immutable product of compilation. Contains validated configuration, compile metadata, and a deterministic content fingerprint.
- **Runtime Object**: Transient runtime entities and components created when an artifact is instantiated into the active simulation.

### 3.1 Defining Game Objects
In [`src/games/pong/definitions.js`](file:///src/games/pong/definitions.js), the court and actors are expressed as plain, frozen definitions:

```javascript
// From src/games/pong/definitions.js
export const PLAYER_PADDLE_DEFINITION = Object.freeze({
  id: 'def_paddle_player',
  type: 'prefab',
  data: {
    role: 'player',
    halfWidth: 8,
    halfHeight: 40,
    initialX: -360,
    initialY: 0,
    speed: 360,
    color: '#38bdf8'
  }
});
```

### 3.2 The Compiler Seam
The compiler lives exclusively in [`src/full/compiler.js`](file:///src/full/compiler.js) and is never bundled into the standalone runtime.

```javascript
// From src/full/compiler.js
export function compileDefinition(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('Invalid definition');
  if (!definition.id || !definition.type) throw new Error('Definition requires id and type');

  const payload = definition.data ? { ...definition.data } : {};
  const hash = computeDeterministicHash({ id: definition.id, type: definition.type, data: payload });

  return Object.freeze({
    id: definition.id,
    type: definition.type,
    data: Object.freeze(payload),
    hash,
    compiledAt: Date.now()
  });
}
```

> [!IMPORTANT]
> **Artifact Content Fingerprint Contract**:
> The `hash` emitted by `compileDefinition` is a fast, deterministic, **pure-JavaScript non-cryptographic content fingerprint** (~48-bit hex string). It is **not** SHA-256. 
> - It ensures synchronous, browser-compatible content identity without requiring asynchronous WebCrypto (`crypto.subtle`) or Node-specific crypto modules.
> - The `compiledAt` timestamp is runtime compilation metadata and is **explicitly excluded** from the deterministic content fingerprint, preserving identical hashes across recompilations of unchanged definitions.
> - Cryptographic artifact provenance is deferred to future distribution pipelines.

### 3.3 Runtime Instantiation
In [`src/games/pong/game.js`](file:///src/games/pong/game.js), the compiled artifact is instantiated into the runtime:

```javascript
// From src/games/pong/game.js
const playerArtifact = compileDefinition(PLAYER_PADDLE_DEFINITION);
runtime.instantiate(playerArtifact);
```

---

## 4. Runtime Entity Handles and Generations

Direct object references (e.g. holding raw JavaScript objects across frames) lead to memory leaks, stale mutations, and phantom bugs when entities are deleted and re-allocated.

In [`src/runtime/entities.js`](file:///src/runtime/entities.js), the engine implements **generational entity handles**:

```javascript
// The EntityHandle structure
class EntityHandle {
  constructor(index, generation) {
    this.index = index;             // Slot index in the pool
    this.generation = generation;   // Monotonically increasing generation
    Object.freeze(this);
  }
}
```

### 4.1 How Slot Recycling Works

```text
Spawn Entity A   -> Allocates Slot 0 at Generation 1 -> Handle(0, 1) [ALIVE]
Despawn Entity A -> Marks Slot 0 free, increments Generation to 2
Spawn Entity B   -> Reuses Slot 0 at Generation 2    -> Handle(0, 2) [ALIVE]
```

If a system still holds a reference to `Handle(0, 1)`, any call to `entityManager.isValid(handle)` or `entityManager.get(handle)` immediately returns `false` / `null`:

```javascript
// From tests/entities.test.js
const handle1 = em.spawn({ name: 'Paddle' }); // Handle(0, 1)
em.despawn(handle1);

const handle2 = em.spawn({ name: 'Ball' });   // Handle(0, 2)
assert.strictEqual(em.isValid(handle1), false); // Stale handle rejected!
assert.strictEqual(em.get(handle1), null);
assert.strictEqual(em.isValid(handle2), true);
```

Entity handles are transient runtime values; they are never serialized directly into save state.

---

## 5. Transforms and Single-Writer Authority

Every dynamic actor carries a `Transform` record managed by [`src/runtime/transforms.js`](file:///src/runtime/transforms.js):

```javascript
// From src/runtime/transforms.js
Transform {
  handle,
  position: { x, y, z },
  velocity: { x, y, z },
  previousPosition: { x, y, z },
  ownership: 'STATIC' | 'KINEMATIC' | 'SIMULATED' | 'ATTACHED'
}
```

### 5.1 Ownership Models
- **`STATIC`**: Immovable geometry (e.g. court boundary walls).
- **`KINEMATIC`**: Entities driven directly by gameplay input or AI intent (e.g. paddles).
- **`SIMULATED`**: Entities driven by physical velocity integration and collision bounce math (e.g. the ball).
- **`ATTACHED`**: Hierarchical children deriving world transforms from a parent.

### 5.2 The Single-Writer Rule
[`GAMEPLAY_FOUNDATION.md`](file:///GAMEPLAY_FOUNDATION.md) §3 mandates that **only one authoritative subsystem may commit an entity's transform per simulation step**.

In Pong:
1. Player input and AI compute **movement intent** (`transformManager.setIntent(handle, intent)`).
2. Collision resolution checks and modifies or clamps that intent.
3. The transform manager commits all changes at once via `transformManager.commitAll(dt)`:
   - Sets `previousPosition` to the old `position`.
   - Integrates position: `position += velocity * dt`.
4. Renderers use `previousPosition` and `position` for smooth visual interpolation, but **never** mutate the authoritative transform.
5. To prevent external mutations from corrupting internal state, `game.getState()` returns deep clones of position and velocity vectors.

---

## 6. Fixed-Step Simulation Clock

Display monitors run at varying refresh rates (60 Hz, 120 Hz, 144 Hz, 240 Hz, or variable refresh). Advancing game physics or rules inside variable render callbacks (`requestAnimationFrame`) results in non-deterministic gameplay, speed glitches, and collision tunneling.

[`src/runtime/clock.js`](file:///src/runtime/clock.js) solves this using a **fixed-timestep accumulator**:

```text
Render Loop (requestAnimationFrame) -> deltaMs (e.g. 16.6ms, 33.3ms, 8.3ms)
      │
      ▼
accumulatedTime += deltaMs
while (accumulatedTime >= 1/60s) {
    stepSimulation(1/60s);         <── Fixed 60 Hz simulation step
    accumulatedTime -= 1/60s;
}
alpha = accumulatedTime / (1/60s);  <── Interpolation fraction (0.0 to 1.0)
render(alpha);
```

```javascript
// From src/games/pong/game.js
const clockResult = clock.advance(deltaMs, (fixedDt) => {
  stepSimulation(fixedDt);
});

// Render using alpha for sub-frame smoothness
renderer.render(scene, clockResult.alpha);
```

If a frame takes 33.3ms due to a temporary slowdown, the simulation advances **exactly two 60 Hz steps** so gameplay progress remains perfectly constant.

---

## 7. Action-Based Input

Gameplay systems must never listen directly to browser events (`window.addEventListener('keydown')`) or hardcode specific keys (`if (e.key === 'w')`). That tightly couples gameplay logic to physical hardware and makes automated headless testing impossible.

[`src/runtime/input.js`](file:///src/runtime/input.js) decouples controls into **semantic actions**:
- `'MoveUp'`
- `'MoveDown'`
- `'Pause'`
- `'Reset'`

### 7.1 Input Snapshots
At the beginning of each fixed simulation step, the engine samples an immutable snapshot of all active actions:

```javascript
// From src/games/pong/game.js
function stepSimulation(dt) {
  const snapshot = input.captureSnapshot();

  if (snapshot.isActionActive('MoveUp')) {
    playerIntentY = playerPaddleData.speed;
  } else if (snapshot.isActionActive('MoveDown')) {
    playerIntentY = -playerPaddleData.speed;
  }
}
```

### 7.2 Programmatic Test Simulation
Because input operates on semantic actions, test suites and headless evaluation scripts can inject actions directly without creating fake browser DOM events:

```javascript
// From tests/pong.test.js
game.simulateAction('MoveUp', true);
game.stepOnce(50); // Advance simulation by 50ms
const state = game.getState();
assert.ok(state.entities.player.position.y > 0);
```

---

## 8. Keyboard and Controller Bindings

[`src/runtime/input.js`](file:///src/runtime/input.js) maps physical hardware inputs into semantic actions through a multi-device binding layer:

```javascript
// Default Keyboard Bindings
'MoveUp'   <- ['KeyW', 'ArrowUp']
'MoveDown' <- ['KeyS', 'ArrowDown']
'Pause'    <- ['KeyP', 'Space']
'Reset'    <- ['KeyR']

// Standard Gamepad Bindings (HTML5 Gamepad API)
'MoveUp'   <- Left Stick Up (axis 1 < -0.4) OR D-Pad Up (button 12)
'MoveDown' <- Left Stick Down (axis 1 > 0.4) OR D-Pad Down (button 13)
'Pause'    <- Start / Options (button 9) OR Button South (button 0)
'Reset'    <- Button North / Y (button 3) OR Select / Back (button 8)
```

The game coordinator queries actions identically regardless of whether the player pressed `W`, tapped the gamepad D-Pad, or pushed the left analog stick.

---

## 9. Deterministic 2D Collision

Proof A deliberately avoids external physics dependencies like Rapier or Box2D. Standard arcade interactions require only deterministic bounding volumes and straightforward math in [`src/runtime/collision.js`](file:///src/runtime/collision.js).

### 9.1 Axis-Aligned Bounding Boxes (AABB)
Collisions use center-coordinate half-extents:

```javascript
// From src/runtime/collision.js
export function checkAABB(boxA, boxB) {
  return (
    Math.abs(boxA.x - boxB.x) < boxA.halfWidth + boxB.halfWidth &&
    Math.abs(boxA.y - boxB.y) < boxA.halfHeight + boxB.halfHeight
  );
}
```

### 9.2 Wall Bounce & Boundary Clamping
When the ball hits the top or bottom wall, its Y velocity inverts, and its position is clamped to prevent penetrating the wall:

```javascript
// From src/runtime/collision.js
export function resolveArenaWalls(ballTransform, ballRadius, arena) {
  if (ballTransform.position.y + ballRadius >= arena.maxY) {
    ballTransform.position.y = arena.maxY - ballRadius;
    ballTransform.velocity.y = -Math.abs(ballTransform.velocity.y);
  } else if (ballTransform.position.y - ballRadius <= arena.minY) {
    ballTransform.position.y = arena.minY + ballRadius;
    ballTransform.velocity.y = Math.abs(ballTransform.velocity.y);
  }
}
```

### 9.3 Paddle Deflection Angle
When the ball hits a paddle:
1. The ball's X position is placed outside the paddle face to prevent sticking.
2. The ball's X velocity reverses and accelerates slightly.
3. The ball's Y velocity is computed based on **where** it struck relative to the paddle center:

$$\Delta Y = \left( \frac{\text{ball.y} - \text{paddle.y}}{\text{paddle.halfHeight}} \right) \times \text{deflectionSpeed}$$

Hitting the edge of the paddle produces an aggressive vertical cut, giving the player tactical control over ball trajectory.

---

## 10. Runtime Variables

Global and match-specific state is tracked via a centralized key-value variable registry in [`src/runtime/state.js`](file:///src/runtime/state.js):

```javascript
// From src/games/pong/game.js
const state = createStateManager({
  initialVars: {
    'score.player1': 0,
    'score.player2': 0,
    'score.max': 5,
    'match.winner': null
  }
});

// Manipulating variables
state.incrementVar('score.player1');
const currentScore = state.getVar('score.player1', 0);
```

Variables support subscription listeners (`state.onVarChange(key, callback)`), enabling UI overlays and analytics to respond immediately when match state evolves.

---

## 11. State Transitions (Finite State Machine)

To prevent undefined game states (such as scoring a goal while paused, or paddles moving after game over), [`src/runtime/state.js`](file:///src/runtime/state.js) enforces explicit state transitions:

```text
[ SERVE ] ──(serveTimer or input)──> [ PLAYING ] ──(point scored)──> [ SERVE ]
   │                                     │                              │
(pause)                               (pause)                     (score >= max)
   ▼                                     ▼                              ▼
[ PAUSED ] <───────────────────────> [ PAUSED ]                  [ GAME_OVER ]
```

```javascript
// From src/games/pong/game.js
const state = createStateManager({
  initialState: 'SERVE',
  validStates: ['SERVE', 'PLAYING', 'ROUND_OVER', 'GAME_OVER', 'PAUSED']
});

state.transition('PLAYING'); // OK
state.transition('INVALID'); // Throws Error: Invalid state transition
```

---

## 12. Declarative Rule Engine

Hardcoding game event chains (e.g. goal scored -> add point -> check win -> reset serve) inside procedural loops creates brittle code.

[`src/runtime/rules.js`](file:///src/runtime/rules.js) introduces a declarative `WHEN / IF / DO` rule system:

```javascript
// From src/games/pong/game.js

// Rule 1: Handle point scored
rules.addRule({
  name: 'on_point_scored',
  event: 'POINT_SCORED',
  action: (payload) => {
    const varKey = payload.side === 'right' ? 'score.player1' : 'score.player2';
    state.incrementVar(varKey);
    rules.trigger('CHECK_WIN_CONDITION', payload);
  }
});

// Rule 2: Check match conclusion
rules.addRule({
  name: 'check_game_over',
  event: 'CHECK_WIN_CONDITION',
  condition: () => {
    return state.getVar('score.player1', 0) >= 5 || state.getVar('score.player2', 0) >= 5;
  },
  action: () => {
    const winner = state.getVar('score.player1', 0) >= 5 ? 'Player 1' : 'Player 2';
    state.setVar('match.winner', winner);
    state.transition('GAME_OVER');
  }
});
```

When a goal occurs, collision detection simply calls `rules.trigger('POINT_SCORED', { side: 'right' })`. The rule engine coordinates all consequences automatically.

---

## 13. DOM UI and Canvas2D Hybrid Rendering

The engine implements a hybrid rendering pattern ([`GAMEPLAY_FOUNDATION.md`](file:///GAMEPLAY_FOUNDATION.md) §9):

```text
┌─────────────────────────────────────────────────────────────┐
│ High-Contrast DOM HUD (Scores, Match Status, Control Hints)  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Canvas2D Court (Court Boundaries, Net, Interpolated Actors) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

In [`src/games/pong/renderer.js`](file:///src/games/pong/renderer.js):
- **Canvas2D**: Handles 60fps actor rendering. Uses transform interpolation (`alpha`) to render paddles and the ball smoothly between fixed simulation steps:
  $$\text{renderX} = \text{prevX} + (\text{currentX} - \text{prevX}) \times \alpha$$
- **DOM Overlay**: Displays player scores and match badges (`SERVE`, `PLAYING`, `PAUSED`, `PLAYER 1 WINS`).
- **DOM Independence**: The DOM is strictly an output surface. HUD rendering reads from state variables; DOM state **never** drives simulation truth.

---

## 14. How the Evaluation Harness Proves the Game

The A0 Evaluation Harness in [`src/eval/`](file:///src/eval/) provides automated, headless real-browser validation (`npm run eval`).

When executed:
1. **Server Management**: Tests `http://localhost:5173/`. If no dev server is listening, it automatically spawns a transient local Vite server and shuts it down upon completion.
2. **Phase 0 Validation**: Loads `http://localhost:5173/?controlled=1` and captures `artifacts/captures/phase0_boot_fixture.png`.
3. **Proof A Pong Validation**: Loads `http://localhost:5173/?game=pong&controlled=1`:
   - `pongBoot`: Verifies HTTP 200, canvas attachment, and exposure of `window.__PROOF_A_PONG__`.
   - `pongGameplay`: Simulates `'MoveUp'` action programmatically, steps simulation, and validates paddle position change and transition to `'PLAYING'`.
   - `pongScoring`: Triggers goal detection, evaluates scoring rules, and verifies DOM HUD updates.
   - Captures `artifacts/captures/proof_a_pong_fixture.png`.
4. **Deterministic Visual Evidence**: The `?controlled=1` URL parameter forces stable timestamp rendering, ensuring the emitted PNG screenshots maintain 100% bit-for-bit identical SHA-256 hashes across consecutive evaluation runs.

---

## 15. How the Static Production Build Proves Export Independence

Under [`CONSTITUTION.md`](file:///CONSTITUTION.md) §7, exported games must run without Studio or mandatory server processes:

```bash
npm run build
```

The Vite build compiles the entire engine and Pong game into static output in `dist/`:
- `dist/index.html` (~0.77 kB)
- `dist/assets/index-*.js` (~28 kB total bundle, ~9 kB gzipped)

Running a plain static HTTP server against `dist/` confirms that Pong boots and plays with zero backend dependencies, proving complete static export viability.

---

## 16. What Proof A Deliberately Does NOT Implement

To maintain architectural focus and avoid premature complexity, Proof A deliberately omits:
- **Full Entity Component System (ECS)**: Handled cleanly via index-and-generation handles and dedicated managers.
- **Kiln Tooling**: Only the minimal synchronous `compileDefinition` seam exists.
- **Procedural Character Generation / Skinning**: Deferred to **Proof B1** ([`MOTION_FORGE.md`](file:///MOTION_FORGE.md)).
- **Constructive Solid Geometry (CSG) / Procedural Meshes**: Deferred to **Proof B2** ([`GEOMETRY_FORGE.md`](file:///GEOMETRY_FORGE.md)).
- **WebGPU Shaders / Procedural Materials**: Deferred to **Proof B2 / Material Forge**.
- **World Generation / Terrains**: Deferred to **Proof C** ([`WORLD_FORGE.md`](file:///WORLD_FORGE.md)).
- **External 3D Physics Solvers**: Rapier or Box2D are not foundational dependencies.
- **Audio / Sound FX**: Audio architecture is deferred to later proofs.
- **Save / Replay Persistence Systems**: State variables exist, but disk serialization and replay mechanics are future work.
- **Embedded Scripting Languages**: Mechanics are implemented in clean ES module JavaScript.

---

## Summary

Proof A proves the spine: definitions compile into immutable artifacts, instantiate into generational runtime handles with authoritative transforms, simulate on a 60 Hz fixed clock, respond to action-based inputs, collide deterministically, advance through declarative rules, and render smoothly to Canvas2D and DOM — all verifiable via headless real-browser evaluation and static export.
