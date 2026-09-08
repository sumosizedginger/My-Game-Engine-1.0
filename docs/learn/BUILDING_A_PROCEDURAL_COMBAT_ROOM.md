# Building a Procedural Combat Room: The Proof B2 Architecture Walkthrough

## Status

**ACCEPTED LEARNING MATERIAL**  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Ground truth base revision: `3990f55858cab8c4e574f9f29ddb954e70919c77`  
Governing specifications: [`GEOMETRY_FORGE.md`](../../GEOMETRY_FORGE.md), [`MATERIAL_FORGE.md`](../../MATERIAL_FORGE.md), [`CHARACTER_FORGE.md`](../../CHARACTER_FORGE.md), [`MOTION_FORGE.md`](../../MOTION_FORGE.md), [`GAMEPLAY_FOUNDATION.md`](../../GAMEPLAY_FOUNDATION.md), [`TESTING_AND_VALIDATION.md`](../../TESTING_AND_VALIDATION.md)  
Primary source implementation: [`src/geometry/`](../../src/geometry/), [`src/material/`](../../src/material/), [`src/games/combat/`](../../src/games/combat/), [`src/runtime/input.js`](../../src/runtime/input.js), [`src/browser/`](../../src/browser/)

---

## 1. The B2 Proof Question: What Proof B2 Proves

**Proof B2 (Procedural Combat Room)** establishes the first integrated 3D gameplay experience for **My Game Engine 1.0**.

While Proof A proved foundational 2D deterministic simulation and state machines, and Proof B1 proved procedural humanoid synthesis and contact-grounded locomotion in an isolated studio, Proof B2 answers the core architectural question:

> *Can generated 3D geometry, procedural PBR materials, synthesized characters, procedural locomotion, action-based input, deterministic AI, single hit authority, and browser presentation coexist as one coherent, playable game running on fixed-step simulation?*

Proof B2 proves this affirmatively. It demonstrates that the engine's modular code-native forges compose seamlessly into an interactive game without requiring external binary asset pipelines (e.g. glTF, FBX, Blender models, or downloaded hero meshes).

Proof B2 is intentionally bounded: it is a **one-room, one-enemy integration proof**. It does not attempt to be an entire RPG or open-world game; its purpose is to prove that every foundational subsystem connects with mathematical rigor and clean architectural seams.

---

## 2. Where the Combat Room Implementation Lives

All source files for Proof B2 reside in decoupled packages under `src/`:

```text
My-Game-Engine-1.0/
├── src/
│   ├── geometry/                 # Geometry Forge: Procedural Room & Semantic Primitives
│   │   ├── definition.js         # Bounded room & pillar parameters, presets (combat_arena)
│   │   ├── primitives.js         # Box and cylinder construction with semantic attributes
│   │   ├── semantics.js          # SURFACE_TYPES, CONSTRAINT_FLAGS, GEOMETRY_REGIONS
│   │   ├── room.js               # Procedural room generator & shared collision derivation
│   │   └── index.js              # Barrel exports
│   ├── material/                 # Material Forge: Declarative PBR Definitions & Compiler
│   │   ├── definition.js         # Material schema, parameter bounds, color normalization
│   │   ├── palettes.js           # Curated presets (arenaFloor, playerClay, enemyClay, etc.)
│   │   ├── compiler.js           # Pure compiler seam: MaterialDefinition -> Three.js material
│   │   └── index.js              # Barrel exports
│   ├── character/                # Character Forge (Reused from B1)
│   │   └── index.js              # buildHumanoidCharacter('athletic' | 'heavy')
│   ├── motion/                   # Motion Forge (Reused from B1)
│   │   └── index.js              # createLocomotionEvaluator(char, 'natural' | 'stroll')
│   ├── games/combat/             # Proof B2 Combat Coordination Game
│   │   ├── definitions.js        # Combat parameters, timings, states, FSM enum
│   │   ├── ai.js                 # Deterministic 5-state Enemy AI state machine
│   │   ├── attack-motion.js      # Upper-body procedural attack pose & authoritative volume
│   │   ├── combat.js             # testAttackHit query & sampleFistCoherence diagnostic
│   │   ├── arena-game.js         # ArenaCombatGame coordinator (fixed-step simulation)
│   │   ├── renderer.js           # Responsive Three.js renderer, lighting, cutaway wall
│   │   └── index.js              # Barrel exports
│   ├── runtime/
│   │   └── input.js              # Action-based input system & gamepad discovery
│   ├── browser/
│   │   ├── b2-viewer.js          # Browser viewer, game loop, HUD bridge, cleanup
│   │   ├── b2-presentation.js    # Live full-viewport DOM presentation
│   │   ├── b2-live.css           # Live mode presentation styles
│   │   └── main.js               # Route dispatcher (?proof=b2 vs ?proof=b2&controlled=1)
│   └── eval/
│       ├── browser.js            # Evaluator driver executing B2 verification steps
│       └── harness.js            # 4-target test harness (Phase 0, Pong, B1, B2)
└── tests/
    ├── geometry.test.js          # Room bounds, primitives, collision derivation
    ├── material.test.js          # Material bounding, color parsing, compiler seam
    ├── combat.test.js            # ArenaCombatGame lifecycle, AI FSM, hit resolution
    └── input.test.js             # Generic gamepad bindings, deadzones, slot discovery
```
> [!NOTE]
> **Repository Engine Systems vs. Package Exports**: Geometry Forge (`src/geometry/`) and Material Forge (`src/material/`) are accepted repository-level engine systems used in these integration examples. They are **not** currently package subpath exports (such as `@sumosizedginger/my-game-engine-1.0/runtime` or `/full`). Ordinary project code does not require them merely to create 3D presentation; direct Three.js meshes, materials, and geometries in project code remain fully legitimate where procedural forge compilation is not required.

---

## 3. Room Definitions & Geometry Forge: Single-Truth Construction

In My Game Engine 1.0, geometry begins as a declarative, serializable definition.

### 3.1 Bounded Parameter Domain
In `src/geometry/definition.js`, `ROOM_PARAMETER_BOUNDS` and `PILLAR_PARAMETER_BOUNDS` strictly define the mathematical domain for rooms:

```javascript
// Excerpt from src/geometry/definition.js
export const ROOM_PARAMETER_BOUNDS = Object.freeze({
  width: { min: 8.0, max: 48.0, default: 16.0 },
  depth: { min: 8.0, max: 48.0, default: 16.0 },
  wallHeight: { min: 2.0, max: 8.0, default: 3.5 },
  wallThickness: { min: 0.2, max: 1.5, default: 0.4 },
  floorThickness: { min: 0.1, max: 1.0, default: 0.3 }
});

export const PILLAR_PARAMETER_BOUNDS = Object.freeze({
  radius: { min: 0.3, max: 2.0, default: 0.75 },
  height: { min: 1.0, max: 8.0, default: 3.5 }
});
```

The canonical `combat_arena` preset produces a 16x16m hall with 3.5m perimeter walls and two interior structural stone pillars positioned at `(-3.5, -2.5)` and `(+3.5, +2.5)`.

### 3.2 The Single-Truth Architectural Law
The central architectural law of Geometry Forge is:

> **THE ROOM DEFINITION IS THE SINGLE SHARED TRUTH.**  
> Visual geometry and gameplay collision must derive from the exact same `RoomDefinition`. They must never be independently hand-authored copies.

```text
       ┌────────────────────────┐
       │     RoomDefinition     │
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌────────────────────────┐
│ Visual Geometry  │ │  Gameplay Collision    │
├──────────────────┤ ├────────────────────────┤
│ • Floor slab     │ │ • Inner bounds [min/max│
│ • Perimeter walls│ │ • Pillar circles (x,z) │
│ • Column meshes  │ │ • resolvePosition()    │
│ • regionId attr  │ │ • isWalkable()         │
│ • surfaceId attr │ │ • getFloorY() -> 0.000 │
└──────────────────┘ └────────────────────────┘
```

In `src/geometry/room.js`, `generateProceduralRoom()` consumes the parameters once to construct both visual meshes and spatial collision math:

```javascript
// Excerpt from src/geometry/room.js
export function generateProceduralRoom(roomInput = 'combat_arena') {
  const definition = (roomInput && roomInput.type === 'geometry_room')
    ? roomInput
    : createRoomDefinition(typeof roomInput === 'string' ? { preset: roomInput } : roomInput);

  const { width, depth, wallHeight, wallThickness, floorThickness, pillars } = definition.data.parameters;

  // 1. Visual Geometry Construction
  // Floor slab: top surface sits precisely at Y = 0.000m
  const floorGeom = buildBoxGeometry({
    width, height: floorThickness, depth,
    origin: { x: 0, y: -floorThickness / 2, z: 0 },
    regionId: GEOMETRY_REGIONS.ARENA_FLOOR,
    surfaceId: SURFACE_TYPES.FLOOR
  });

  // Perimeter walls (north, south, east, west) ...
  // Pillars ...

  // 2. Gameplay Collision Representation (Derived from the SAME parameters)
  const innerBounds = {
    minX: -width / 2 + wallThickness,
    maxX: width / 2 - wallThickness,
    minZ: -depth / 2 + wallThickness,
    maxZ: depth / 2 - wallThickness
  };

  function resolvePosition(x, z, radius = 0.4) {
    let resolvedX = Math.max(innerBounds.minX + radius, Math.min(innerBounds.maxX - radius, x));
    let resolvedZ = Math.max(innerBounds.minZ + radius, Math.min(innerBounds.maxZ - radius, z));
    // Resolve circles against cylindrical interior pillars...
    return { x: resolvedX, z: resolvedZ, collided };
  }

  return { definition, visual: { ... }, collision: { innerBounds, resolvePosition, ... } };
}
```

### 3.3 The Cylinder Open-Bottom Contract
In `src/geometry/primitives.js`, `buildCylinderGeometry()` defaults to `cappedBottom: false`. Pillars rest directly flush against the floor slab datum ($Y = 0.000\text{m}$). Omitting the bottom circular cap eliminates redundant hidden polygons and prevents coplanar z-fighting with the floor, while a closed bottom cap remains an explicit option (`cappedBottom: true`) if columns ever span voids.

Direct procedural construction is used instead of heavy runtime CSG boolean operations, guaranteeing numerical stability, zero compilation non-determinism, and zero external binary dependencies.

---

## 4. Geometry Semantics: Surface Types & Regions

In **My Game Engine 1.0**, semantic identity is **never** based on arbitrary vertex index ranges. Vertex counts change when tessellation changes; semantics must not break.

Instead, every generated vertex buffer carries immutable numeric attributes: `regionId` and `surfaceId`.

```javascript
// From src/geometry/semantics.js
export const SURFACE_TYPES = Object.freeze({
  FLOOR: 1,      // Walkable horizontal floor slab
  WALL: 2,       // Solid vertical barrier
  PILLAR: 3,     // Cylindrical interior structural column
  OBSTACLE: 4,   // General gameplay barrier
  CEILING: 5     // Overhead boundary surface
});

export const CONSTRAINT_FLAGS = Object.freeze({
  NONE: 0,
  WALKABLE: 1 << 0,     // Characters can traverse (e.g. floor)
  SOLID: 1 << 1,        // Blocks translation and projectiles
  PERIMETER: 1 << 2,    // Defines enclosing room boundary
  CLIMBABLE: 1 << 3,    // Traversable vertical surface
  DESTRUCTIBLE: 1 << 4  // Targetable breakable barrier
});

export const GEOMETRY_REGIONS = Object.freeze({
  ARENA_FLOOR: 10,
  ARENA_WALL_NORTH: 20,
  ARENA_WALL_SOUTH: 21,
  ARENA_WALL_EAST: 22,
  ARENA_WALL_WEST: 23,
  ARENA_PILLAR_1: 30,
  ARENA_PILLAR_2: 31,
  ARENA_FEATURE: 40
});
```

Downstream systems (audio physics, footstep materials, AI path planning, camera occlusion) query surfaces and regions directly through semantic tags rather than guessing mesh topology. Note that while `CEILING: 5` is defined in the durable specification, the Proof B2 combat arena is an open-top arena and deliberately does not generate a ceiling mesh.

---

## 5. Material Forge: Declarative Definitions & The Compiler Seam

Material specifications follow the engine's asset lifecycle:

```text
MaterialDefinition (Source Truth) ───> compileMaterial() ───> Three.js MeshStandardMaterial (Transient)
```

Three.js materials are transient runtime objects. They are **never** serialized or used as persistent project representations.

```javascript
// Excerpt from src/material/compiler.js
export function compileMaterial(definition) {
  const params = definition.data.parameters;
  const mat = new MeshStandardMaterial({
    color: new Color(params.color),
    roughness: params.roughness,
    metalness: params.metalness,
    emissive: new Color(params.emissive),
    emissiveIntensity: params.emissiveIntensity,
    wireframe: params.wireframe
  });

  mat.userData = {
    definitionId: definition.id,
    definitionType: definition.type,
    parameters: { ...params }
  };
  return mat;
}
```

Proof B2 establishes a curated PBR palette:
- **`arenaFloor`**: Dark slate flagstone (`color: 0x1e2430`, `roughness: 0.82`, `metalness: 0.12`)
- **`arenaWall`**: Deep charcoal perimeter wall (`color: 0x141820`, `roughness: 0.90`, `metalness: 0.05`)
- **`arenaPillar`**: Weathered basalt column (`color: 0x283242`, `roughness: 0.72`, `metalness: 0.18`)
- **`playerClay`**: Athletic cobalt clay (`color: 0x3b82f6`, `roughness: 0.50`, `metalness: 0.15`)
- **`enemyClay`**: Heavy brute crimson clay (`color: 0xdc2626`, `roughness: 0.58`, `metalness: 0.10`)
- **`attackVolume`**: Translucent wireframe volume indicator (`color: 0xf59e0b`, `wireframe: true`)

---

## 6. Reusing Character Forge & Motion Forge

Proof B2 does **not** invent a new character or animation system. It directly reuses the accepted procedural character synthesis and locomotion pipelines established in Proof B1:

- Procedural humanoid synthesis (`buildHumanoidCharacter`)
- Semantic anatomical landmarks
- Canonical 22-bone skeletal hierarchy
- Normalized skin weights ($\sum w_i = 1.0$)
- Analytical 2-bone IK solver
- Contact-grounded locomotion evaluator (`createLocomotionEvaluator`)

In `src/games/combat/arena-game.js`:
- **Player**: Synthesized with the `'athletic'` character preset and bound to the `'natural'` locomotion evaluator (cadence: 112 spm).
- **Enemy**: Synthesized with the `'heavy'` character preset and bound to the `'stroll'` locomotion evaluator (cadence: 92 spm).

```javascript
// Excerpt from src/games/combat/arena-game.js (_initEntities)
const playerChar = buildHumanoidCharacter('athletic', { color: playerMat.color.getHex() });
playerChar.mesh.material = playerMat;

const enemyChar = buildHumanoidCharacter('heavy', { color: enemyMat.color.getHex() });
enemyChar.mesh.material = enemyMat;

const playerEvaluator = createLocomotionEvaluator(playerChar, 'natural');
const enemyEvaluator = createLocomotionEvaluator(enemyChar, 'stroll');
```

This architectural reuse proves that systems built in earlier phases function as stable, composable foundation layers.

---

## 7. Action-Based Input System & Browser Gamepad Discovery

Hardware keys and gamepad sticks must not leak directly into gameplay code. Gameplay reads immutable semantic action snapshots.

### 7.1 Declared Semantic Actions
Proof B2 declares six combat actions:
- `MoveForward`
- `MoveBackward`
- `MoveLeft`
- `MoveRight`
- `Attack`
- `Reset`

### 7.2 Generic Gamepad Binding Interface
In `src/runtime/input.js`, the input system provides explicit APIs for binding physical buttons and axes with deadzones:

```javascript
// Excerpt from src/games/combat/arena-game.js (_configureDefaultInputBindings)
this.input.bindGamepadButton(0, 'Attack');        // South / A / Cross
this.input.bindGamepadButton(3, 'Reset');         // North / Y / Triangle
this.input.bindGamepadButton(8, 'Reset');         // Back / Select
this.input.bindGamepadButton(12, 'MoveBackward'); // D-pad Up
this.input.bindGamepadButton(13, 'MoveForward');  // D-pad Down
this.input.bindGamepadButton(14, 'MoveLeft');     // D-pad Left
this.input.bindGamepadButton(15, 'MoveRight');    // D-pad Right

this.input.bindGamepadAxis(0, 'MoveLeft', 'MoveRight', { deadzone: 0.25 });
this.input.bindGamepadAxis(1, 'MoveBackward', 'MoveForward', { deadzone: 0.25 });
```

### 7.3 Real Browser Controller Discovery
Live browser gamepads are accessed via `navigator.getGamepads()`. Browsers often return sparse arrays (e.g. `[null, Gamepad, null]`). `selectActiveGamepad()` handles real-world hardware behavior:
1. **Slot Scanning**: Scans all slots, safely skipping `null` or disconnected entries.
2. **Stickiness / Stability**: Retains the currently active gamepad index while it remains connected, preventing erratic device switching.
3. **Reconnection**: Automatically discovers newly plugged-in controllers without requiring page reload.
4. **Mock Gamepad Injection**: `setGamepad(mockGamepad)` allows headless unit and evaluation tests to validate gamepad logic without physical hardware.

---

## 8. Screen-Space Control Mapping for Spectator Perspective

A critical human-factors and architectural truth in Proof B2 is screen-space mapping:

> **Directional Semantics**: The action names `MoveForward` (+Z) and `MoveBackward` (-Z) represent world/gameplay coordinate directions. Because Proof B2 uses a spectator camera positioned at +Z looking toward -Z, default physical bindings are intentionally mapped to **screen space**:
> - Pushing **Up** on physical controls moves the character **upward/away** on the screen (`MoveBackward`, -Z).
> - Pushing **Down** on physical controls moves the character **downward/toward** on the screen (`MoveForward`, +Z).

| Control Device | Input | Semantic Action | Screen Movement |
|---|---|---|---|
| **Keyboard** | `KeyW` / `ArrowUp` | `MoveBackward` | Upward / away from camera (-Z) |
| **Keyboard** | `KeyS` / `ArrowDown` | `MoveForward` | Downward / toward camera (+Z) |
| **Keyboard** | `KeyA` / `ArrowLeft` | `MoveLeft` | Leftward on screen (-X) |
| **Keyboard** | `KeyD` / `ArrowRight` | `MoveRight` | Rightward on screen (+X) |
| **Gamepad** | Left Stick Y Negative (`< -0.25`) | `MoveBackward` | Upward / away from camera (-Z) |
| **Gamepad** | Left Stick Y Positive (`> +0.25`) | `MoveForward` | Downward / toward camera (+Z) |
| **Gamepad** | D-Pad Up (`button 12`) | `MoveBackward` | Upward / away from camera (-Z) |
| **Gamepad** | D-Pad Down (`button 13`) | `MoveForward` | Downward / toward camera (+Z) |
| **Gamepad** | Button South / A (`button 0`) | `Attack` | Execute punch strike |
| **Gamepad** | Button North / Y (`button 3`) | `Reset` | Reset match |

---

## 9. Fixed-Step Gameplay & ArenaCombatGame Coordination

`ArenaCombatGame` does **not** manage its own frame clock.

Instead, the browser animation loop passes variable delta times (`requestAnimationFrame`) to an accepted `SimulationClock` accumulator. The clock consumes accumulated time in fixed 16.666ms steps:

```text
Browser rAF Frame (variable delta)
       │
       ▼
SimulationClock Accumulator
       │
       ├─► fixed step 16.666ms ──► ArenaCombatGame.update(dt)
       ├─► fixed step 16.666ms ──► ArenaCombatGame.update(dt)
       ▼
Renderer.render() + updateHUD()
```

Each simulation step executes the canonical pipeline in strict sequence:
1. Capture input snapshot
2. Gather player movement and combat intent
3. Gather enemy AI movement and combat intent
4. **Commit transforms through Single-Writer Authority**
5. Evaluate authoritative combat hit volumes and resolve damage
6. Synchronize procedural locomotion and attack poses
7. Commit mesh scene node transforms

---

## 10. One Authoritative Transform Writer

One of the most important architectural laws in My Game Engine 1.0 is:

> **EXACTLY ONE SYSTEM COMMITS AN ENTITY'S WORLD TRANSFORM PER STEP.**

Locomotion generators, procedural bone kinematics, and AI state machines do **not** write to entity positions. They produce **intent**:
- Player input produces velocity intent: $(v_x, v_z)$.
- Enemy AI produces velocity intent: $(v_x, v_z)$.
- Attack motion produces upper-body bone rotation offsets.

Only the gameplay coordinator computes the candidate position and resolves it against the room's collision geometry:

```javascript
// Excerpt from src/games/combat/arena-game.js (update)
// 1. Candidate position from movement intent
const candPlayerX = this.player.transform.position.x + this.player.velocity.x * dt;
const candPlayerZ = this.player.transform.position.z + this.player.velocity.z * dt;

// 2. Authoritative room collision resolution
const resPlayer = this.room.collision.resolvePosition(candPlayerX, candPlayerZ, pCfg.collisionRadius);

// 3. Single authoritative commit
this.player.transform.position.x = resPlayer.x;
this.player.transform.position.z = resPlayer.z;
```

This guarantees that animation, physics, and AI never fight for control over character position, eliminating jitter, clipping, and frame-rate-dependent drift.

---

## 11. Deterministic Enemy AI State Machine

The enemy brute is governed by a deterministic, bounded 5-state finite state machine (FSM):

```text
         ┌──────────────┐
         │     IDLE     │
         └──────┬───────┘
                │ dist <= aggroRadius (9m)
                ▼
         ┌──────────────┐
  ┌─────►│    CHASE     │◄─────┐
  │      └──────┬───────┘      │
  │             │              │
  │ dist <= 1.4m│              │ recoilTimer <= 0
  │             ▼              │
  │      ┌──────────────┐      │
  │      │    ATTACK    │      │
  │      └──────┬───────┘      │
  │             │ complete     │
  │             ▼              │
  │      ┌──────────────┐      │
  └──────┤     HURT     ├──────┘
         └──────┬───────┘
                │ hp <= 0
                ▼
         ┌──────────────┐
         │     DEAD     │ (Terminal)
         └──────────────┘
```

- **`IDLE`**: Stands in place facing -Z. Transitions to `CHASE` when player distance $\le 9.0\text{m}$.
- **`CHASE`**: Advances toward the player at $2.0\text{ m/s}$. Transitions to `ATTACK` when distance $\le 1.4\text{m}$ and cooldown $\le 0$.
- **`ATTACK`**: Plants feet ($\text{speed} = 0$) and executes a strike. Transitions back to `CHASE` on completion with a $1.2\text{s}$ cooldown.
- **`HURT`**: Recoils backward away from the player ($0.8\text{ m/s}$) for $0.25\text{s}$ when struck.
- **`DEAD`**: Terminal state when $\text{HP} \le 0$. Zero translation, zero attacks.

The AI uses **zero `Math.random()`** and requires no heavy navmesh, ensuring 100% deterministic repeatability across evaluation runs.

---

## 12. Procedural Attack Motion Layering

Attack motion in Proof B2 is procedural and layered directly onto the character's skeletal pose:

```text
Time: 0.00s         0.10s                  0.22s              0.35s
      ├─── Windup ───┼────── Active ────────┼─── Recovery ────┤
      │ Anticipation │ Authoritative Hit    │ Follow-through  │
      │ Arm draws    │ Fist strikes apex    │ Arm returns     │
      │ back tightly │ Active volume live   │ to neutral      │
```

In `src/games/combat/attack-motion.js`, `applyProceduralAttackPose()` modifies only upper-body joints:
- `shoulder_r` pitch
- `upperarm_r` pitch, yaw, roll
- `forearm_r` flexion
- `spine` and `chest` torso lean

Lower-body bones (`pelvis`, `thigh`, `shin`, `foot`) remain under the control of the locomotion evaluator, allowing characters to plant or step naturally during attacks. Attack motion never mutates world transforms.

---

## 13. Single Hit Authority & Authoritative Attack Volume

A primary failure mode in game engines is split hit authority—where visual particle effects, physics colliders, and animation triggers disagree on whether a blow connected.

Proof B2 strictly enforces **Single Hit Authority**:

> **ONE AUTHORITATIVE QUERY DETERMINES COMBAT DAMAGE.**

```javascript
// Excerpt from src/games/combat/arena-game.js
// 1. Authoritative volume computed strictly from timing and attacker transform
const attackVolume = getAuthoritativeAttackVolume(this.player.transform, this.player.attackTimer);

// 2. Damage resolved ONLY during active window and latch prevents duplicate hits
if (attackVolume.active && !this.player.attackHasHit && this.enemy.hp > 0) {
  const hitResult = testAttackHit(attackVolume, this.enemy.transform, COMBAT_CONFIG.enemy.collisionRadius);
  if (hitResult.hit) {
    this.player.attackHasHit = true;  // Latch: exactly 1 hit per swing
    this.enemy.hp = Math.max(0, this.enemy.hp - pCfg.attackDamage);
    // Trigger hurt state and diagnostics...
  }
}
```

Key principles:
1. **Active Window Only**: Hits only register during the active phase ($0.10\text{s} \le t < 0.22\text{s}$).
2. **One Hit Per Swing**: The `attackHasHit` boolean latch guarantees a single strike never damages the enemy across multiple consecutive frames.
3. **Fist Coherence is Diagnostic, Not Authority**: `sampleFistCoherence()` measures the distance between the rendered hand bone and the attack volume center. It serves as visual quality telemetry, never as a second damage authority.
4. **Debug Volume Derivation**: The rendered amber debug sphere derives its position directly from `attackVolume.center`, visualizing the exact mathematical volume used for combat resolution.

---

## 14. Game State Lifecycle, Health, and Victory Resolution

The match follows a clean lifecycle:

```text
READY ──► ENGAGED ──► VICTORY (Enemy HP <= 0)
   ▲          │
   │          └───► DEFEAT  (Player HP <= 0)
   │                    │
   └─────── RESET ──────┘
```

- Starting state: `READY`.
- Moving or attacking transitions state to `ENGAGED`.
- Player deals 25 damage per hit; Enemy has 100 HP (defeated in 4 hits).
- When `enemy.hp <= 0`, state becomes `VICTORY`, logging structured diagnostic `B2_VICTORY`.
- Activating `Reset` (`KeyR`, gamepad North/Y) resets all transforms, HP, AI states, and diagnostics back to `READY`.

---

## 15. Responsive 3D Rendering & Lifecycle Management

In `src/games/combat/renderer.js`, the renderer binds cleanly to its DOM container:

```javascript
// Excerpt from src/games/combat/renderer.js
function resize() {
  const w = container.clientWidth || 960;
  const h = container.clientHeight || 540;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
}
```

- **Device Pixel Ratio (DPR) Cap**: Clamped to $\min(\text{devicePixelRatio}, 2)$ to preserve fillrate performance on ultra-high-density mobile and desktop displays.
- **Lifecycle Cleanup**: The destroy path disposes the WebGL renderer and compiled materials, removes the canvas, and disconnects `ResizeObserver` and window resize listeners.

---

## 16. World Truth vs. Presentation: The Wall Cutaway Principle

Proof B2 illustrates a vital architectural distinction:

> **PRESENTATION MAY OMIT AN OCCLUDING SURFACE WITHOUT ALTERING GAMEPLAY WORLD TRUTH.**

The spectator camera sits at $+Z$, looking into the room toward $-Z$. The near north wall would normally obstruct the human player's view of the arena.

```javascript
// Excerpt from src/games/combat/renderer.js
const northWall = new Mesh(game.room.visual.parts.northWall, wallMat);
// The live spectator camera looks from +Z: cut away the near (north) wall.
// Keep the generated WALL geometry and authoritative collision intact.
// Controlled captures retain the complete enclosure.
northWall.visible = isControlled;
scene.add(northWall, southWall, eastWall, westWall);
```

- In **live play** (`!isControlled`), `northWall.visible = false` provides an unobstructed spectator view.
- In **world truth**, the north wall remains solid: its collision boundary clamped in `innerBounds.maxZ`, blocking player and enemy movement.
- In **controlled fixture mode** (`isControlled`), `northWall.visible = true` ensures the deterministic capture tests the fully enclosed room.

---

## 17. DOM HUD Ownership: Reactive View Over Engine State

The HUD is built with DOM elements overlaid on the WebGL canvas.

Under the engine's architectural rules:
- The DOM HUD is a **read-only reflection** of engine state.
- The HUD does **not** store or arbitrate HP, scores, or combat state.
- `updateHUD()` reads `game.getStateSnapshot()` and updates DOM elements (health bars, status banners, combat stats, live gamepad diagnostics).

---

## 18. Live Interactive vs. Controlled Evaluation Presentation

Proof B2 defines two distinct presentation policies dispatched in `src/browser/main.js`:

```text
URL: /?proof=b2                        URL: /?proof=b2&controlled=1
┌───────────────────────────────┐      ┌───────────────────────────────┐
│ LIVE PRESENTATION             │      │ CONTROLLED FIXTURE            │
│ • Full viewport immersion     │      │ • Fixed 960x500px container   │
│ • Responsive flex layout      │      │ • Fixed camera framing        │
│ • Cutaway spectator camera    │      │ • Fully enclosed room         │
│ • Live gamepad diagnostics    │      │ • Headless step-driven eval   │
│ • Continuous requestAnimation │      │ • Deterministic PNG captures  │
└───────────────────────────────┘      └───────────────────────────────┘
```

> **CRITICAL LAW**: The test fixture must not dictate the live game's presentation.

Interactive users enjoy a full-screen, responsive, cutaway experience. The evaluation harness tests a fixed, bounded, reproducible fixture.

---

## 19. Automated Testing & Real Hardware Verification

Proof B2 establishes a clear separation between automated mock testing and physical verification:

1. **Automated Unit & Evaluator Tests**:
   - `input.setGamepad(mockGamepad)` validates button mappings, axis deadzones, and sparse slot selection headlessly.
   - Evaluator runs automate movement, attacks, damage accumulation, and victory states.
2. **Physical Human Verification**:
   - Automated injection proves logic, but **does not replace physical hardware evidence**.
   - Real standard gamepads (Xbox, PlayStation, standard W3C controllers) must be physically verified by human testers to confirm live polling, deadzone comfort, and input responsiveness.

---

## 20. Evaluator Integrity & Fail-Closed Validation

In `src/eval/harness.js`, the four-target evaluation harness tests:
1. `phase0_boot_fixture`
2. `proof_a_pong_fixture`
3. `proof_b1_motion_fixture`
4. `proof_b2_combat_fixture`

The B2 evaluation suite validates eight distinct truth gates:
- `b2Boot`: Canvas and page load successfully without console errors.
- `b2RoomGeneration`: Floor, perimeter walls, and pillars are constructed.
- `b2MaterialGeneration`: PBR materials compile with valid parameters.
- `b2CharacterIntegration`: Both athletic and heavy skinned meshes bind skeletons.
- `b2PlayerMovement`: Player advances $\Delta Z > 1.5\text{m}$ through action simulation.
- `b2CombatExecution`: Player lands melee attacks with single hit authority.
- `b2WinState`: Enemy HP drops to 0 and match transitions to `VICTORY`.
- `b2PageProofSuccess`: Page's internal proof reports `success: true`.

> **FAIL-CLOSED INTEGRITY PRINCIPLE**: The harness must never report `PASS` if the evaluated page itself reports failure. `b2PageProofSuccess` and `b2PlayerMovement` strictly gate overall test status.

---

## 21. Accepted Proof B2 Evidence

At frozen baseline SHA `3990f55858cab8c4e574f9f29ddb954e70919c77`:

- **Unit Tests**: 121/121 passing across 11 test suites.
- **Evaluation Harness**: 4/4 targets PASS, 23/23 truth checks passing.
- **Deterministic Capture Fixture (SHA-256)**:
  `428ce84e9cdafdc7d2b93f0b3ab03a9d1a96e091967ddf81e19f7fb9677ec2f7`
- **Vite Build**: Production bundle builds cleanly in $< 200\text{ms}$.
- **Security Audit**: 0 vulnerabilities found via `npm audit`.
- **Physical Verification**: Confirmed with live gamepad controls and responsive viewport resizing.

---

## 22. What Proof B2 Deliberately Does Not Implement

To maintain architectural focus, Proof B2 deliberately omits features reserved for later roadmap phases:

- **No Multi-Room Streaming / Terrains**: Reserved for Proof C.
- **No Complex Navmeshes / Behavior Trees**: B2 uses a bounded 5-state FSM.
- **No Heavy Physics Engines (PhysX/Rapier)**: B2 uses deterministic AABB/circle geometry collision.
- **No Complex Animation Graphs / Motion Matching**: B2 layers single procedural upper-body attack poses over procedural locomotion.
- **No Inventory, Loot, or RPG Progression Systems**: Pure combat mechanics proof.
- **No Multiplayer / Netcode**: Local single-player evaluation.
- **No Studio Asset Editor / Visual Node Graphs**: Pure code-native generation.

Proof B2 is precisely what it claims to be: **a rock-solid, verified, code-native procedural combat room proving that geometry, materials, characters, motion, and fixed-step combat coexist seamlessly in the browser.**
