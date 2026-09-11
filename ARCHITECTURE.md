# My Game Engine 1.0 — Architecture

## Status

**Document type:** Canonical technical architecture  
**Authority:** Below `CONSTITUTION.md` and `PRD.md`; above implementation-local conventions  
**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

This document defines the approved structural model of My Game Engine 1.0.

It intentionally distinguishes:

- **REQUIRED ARCHITECTURE** — a durable contract the implementation must preserve;
- **PHASE 0 FOUNDATION** — the minimum repository/runtime skeleton to establish now;
- **APPROVED FUTURE SYSTEM** — designed direction that must not be treated as implemented until a proof earns it;
- **DEFERRED** — explicitly not part of current implementation scope.

A model reading this file must never infer that a named subsystem already exists merely because its architecture is described here.

---

## 1. Canonical System Diagram

The long-term engine relationship is:

```text
Humans / AI / CLI / Studio / Tests
              |
              v
      Public Game/Authoring API
              |
      +-------+--------+
      |                |
      v                v
engine/runtime      engine/full
      |                |
      |                +-> Kiln
      |                +-> Geometry Forge
      |                +-> Character Forge
      |                +-> Motion Forge
      |                +-> Material Forge
      |                +-> World Forge
      |                +-> future approved compilers
      |                         |
      +-----------+-------------+
                  v
          Runtime Foundation
                  |
     +------------+------------+
     |            |            |
 Gameplay      Rendering    Diagnostics
     |            |            |
     +------------+------------+
                  |
                  v
                 Game
```

This diagram is architectural direction, not a claim that every box exists at Phase 0.

---

## 2. Repository State Model

### 2.1 Canonical repository

The only canonical implementation repository is:

```text
sumosizedginger/My-Game-Engine-1.0
```

It begins as a greenfield implementation.

### 2.2 Donor repositories

Prior repositories may supply code or lessons, but never automatic authority.

Candidate donor code is evaluated as:

```text
PORT
ADAPT
REFERENCE
DROP
```

Imported code must preserve provenance according to `DEPENDENCY_POLICY.md`.

### 2.3 No hidden historical inheritance

Do not assume:

- Visual Lab directory structure;
- old package boundaries;
- old tests;
- old schemas;
- old renderer ownership;
- old lifecycle rules;
- old naming;

unless the new repository explicitly adopts them through accepted work.

---

## 3. Architecture Layers

The intended ownership model is:

```text
PROJECT / GAME CODE
    |
    | scripts, rules, prefabs, definitions
    v
PUBLIC ENGINE API
    |
    +-----------------------------+
    |                             |
    v                             v
GAMEPLAY FOUNDATION          GENERATION API
    |                             |
    |                             v
    |                           KILN
    |                             |
    |                   compiled artifacts
    |                             |
    +--------------+--------------+
                   v
             RUNTIME CORE
                   |
        +----------+-----------+
        |          |           |
    RENDERING   INPUT/AUDIO   QUERIES
        |          |           |
        +----------+-----------+
                   v
                BROWSER
```

Studio remains a separate product and eventually consumes the public authoring/generation contracts rather than becoming part of the runtime repository.

---

## 4. Entry-Point Architecture

### REQUIRED ARCHITECTURE

One codebase exposes two conceptual consumption modes.

### 4.1 `engine/runtime`

Purpose: ordinary exported games.

It should include only what the game needs to:

- instantiate compiled artifacts;
- create and destroy runtime entities;
- run fixed-step gameplay;
- process input actions;
- render;
- run runtime audio/FX systems when present;
- query the world;
- use persistence/replay facilities when implemented;
- consume machine-readable diagnostics.

It must not automatically import every compiler/Forge.

### 4.2 `engine/full`

Purpose: Studio authoring and games that intentionally generate content at runtime.

Conceptually:

```text
engine/full
= engine/runtime
+ Kiln
+ approved generation/compiler systems
```

### PHASE 0 FOUNDATION

Phase 0 should create the smallest package/module seams necessary to prove that runtime-only and full imports can remain separable.

Phase 0 must **not** fabricate empty Forge implementations merely to populate `engine/full`.

---

## 5. Definition / Artifact / Instance Architecture

### REQUIRED ARCHITECTURE

Native generated content follows this lifecycle:

```text
Definition
    |
    | validate / normalize
    v
Compiler / Kiln step
    |
    v
Artifact
    |
    | cache/export optional
    v
Runtime instantiate
    |
    v
Runtime Instance
```

### 5.1 Definition

Machine-editable source intent.

Properties:

- serializable where appropriate;
- deterministic inputs where material;
- stable semantic names;
- provenance-capable;
- hashable through the canonical definition-identity function once introduced.

### 5.2 Artifact

Derived compiled data optimized for runtime use.

Examples later may include:

- typed geometry buffers;
- skeleton data;
- skin weights;
- motion clips;
- procedural textures;
- material programs;
- terrain chunks;
- vegetation instance buffers;
- collision data.

Artifacts are not source authority.

### 5.3 Runtime instance

Transient object participating in a running game.

Runtime instances may be pooled, destroyed, recreated, interpolated, or otherwise optimized without changing persistent source identity.

---

## 6. Kiln Architecture

### APPROVED FUTURE SYSTEM

Kiln is the engine-owned compile/bake/cache seam.

Conceptual API direction:

```text
Kiln.compile(definition, options)
  -> artifact

Runtime.instantiate(artifact, context)
  -> runtime instance
```

The exact function names/types are not frozen by this example.

### 6.1 Responsibilities

Kiln eventually coordinates:

- validation/normalization;
- compiler selection;
- canonical artifact identity;
- deterministic compilation;
- artifact diagnostics;
- cache interaction when justified;
- build/export integration.

### 6.2 Non-responsibilities

Kiln does not become:

- the gameplay scripting runtime;
- a global service locator;
- a hidden asset database with undocumented state;
- an excuse to prebuild persistent caches before cost justifies them.

### PHASE 0 FOUNDATION

Represent the seam only. A memory-level trivial compile/instantiate demonstration is sufficient if needed to prove module direction.

---

## 7. Runtime Core

### APPROVED ARCHITECTURE, IMPLEMENTED INCREMENTS THROUGH PROOFS

The runtime core will own the smallest reusable machinery required by games.

It is expected to grow into:

- entity lifetime/identity;
- fixed-step scheduling;
- transforms;
- input snapshots/actions;
- events;
- state primitives;
- variables;
- timers;
- rules;
- script lifecycle;
- queries;
- deterministic RNG;
- diagnostics;
- scene/pause/time behavior;
- save/replay services.

Proof A decides the first real implementation set.

Phase 0 must not pre-implement the entire list.

---

## 8. Entity Identity

### REQUIRED ARCHITECTURE

Use two identity domains.

### 8.1 Runtime identity

Conceptually:

```text
EntityHandle(index, generation)
```

Properties:

- fast lookup;
- ephemeral;
- not serialized;
- stale references detectable;
- slot reuse increments generation.

A runtime slot reused for another entity must not make an old handle silently point to the new entity.

### 8.2 Persistent identity

Conceptually:

```text
pid
```

Properties:

- serialized where persistence requires it;
- stable across save/load where intended;
- used for persistent relationships;
- distinct from runtime slots.

Runtime-created persistent entities should derive identity from stable spawn context when deterministic persistence requires it.

Transient bullets, sparks, debris, and equivalent effects need not receive persistent IDs.

---

## 9. Transform Architecture

### REQUIRED ARCHITECTURE

One authoritative writer may commit an entity's world transform in one simulation step.

Conceptual transform ownership modes begin as:

```text
STATIC
KINEMATIC
SIMULATED
ATTACHED
```

The exact names may change only through explicit architecture work.

### 9.1 Movement intent

Systems such as gameplay, motion, or physics may produce movement intent/results according to ownership rules.

They must not all independently mutate world transforms in arbitrary order.

### 9.2 Animation

Animation/motion produces pose and, where applicable, root movement intent.

It does not independently own the world transform.

### 9.3 Attachments

Attached entities derive transforms through their attachment relationship rather than competing as independent writers.

### 9.4 Teleport

Teleport is explicit and must suppress inappropriate render interpolation for the transition.

### Implementation restraint

Do not build a complex arbitration marketplace before two real systems actually compete. Early code may enforce simple exclusive ownership.

---

## 10. Simulation Clock

### REQUIRED ARCHITECTURE

Gameplay uses a fixed simulation step. Rendering may vary and interpolate.

Initial conceptual order:

```text
1. capture input snapshot
2. advance timers
3. process queued events
4. resolve state transitions
5. run scripts/capabilities
6. evaluate motion
7. movement/collision
8. physics if present
9. commit authoritative transforms
10. evaluate triggers/overlaps
11. queue resulting events
12. render interpolated state
```

This order is a starting architectural contract. Evidence may justify bounded revisions, but no subsystem may quietly create an independent gameplay frame loop.

The simulation rate may initially target 60 Hz but remains configurable/evidence-driven.

---

## 11. Events, State, Variables, Timers

### APPROVED FUTURE FOUNDATION

These systems should remain intentionally small.

### 11.1 Events

Events communicate facts that occurred. They should have deterministic processing order where gameplay-visible.

Avoid an uncontrolled global event soup with unknown ordering.

### 11.2 State

Provide a general state primitive that project code can use without inventing a genre-specific state engine.

### 11.3 Runtime variables

Provide declared values that rules/UI/save systems can inspect where appropriate.

### 11.4 Timers

Gameplay timers advance from the fixed simulation clock, not ad hoc browser timers for simulation-critical behavior.

---

## 12. Capability / Prefab / Rule / Script Architecture

### REQUIRED ARCHITECTURE

The engine separates privileged reusable behavior from project composition and project logic.

### 12.1 Capability

Engine-owned behavior that requires privileged access to runtime internals.

Possible future examples:

- Renderable;
- Collider;
- Trigger;
- CharacterController;
- Motion;
- AudioEmitter;
- Camera;
- Light;
- ParticleEmitter;
- ScriptHost.

This is not a frozen capability list.

### 12.2 Prefab

Project-owned composition of entities/capabilities/definitions.

Examples:

- door;
- enemy;
- chest;
- checkpoint;
- vehicle.

### 12.3 Rule

Simple declarative wiring:

```text
WHEN event
IF condition
DO action
```

Rules must stay small enough that they do not become an accidental programming language.

### 12.4 Script

Normal project JavaScript for behavior that requires programming but not privileged engine access.

Conceptual script shape may eventually resemble:

```js
defineScript({
  id,
  on,
  persist,
  reads,
  writes,
  touches,
  update(ctx) {},
  onEvent(ctx, event) {}
});
```

Only fields with real consumers should become mandatory.

---

## 13. Input Architecture

### REQUIRED ARCHITECTURE

Physical devices bind to semantic actions.

```text
keyboard/mouse/controller
        |
        v
binding layer
        |
        v
input snapshot
        |
        v
semantic actions
        |
        v
gameplay
```

Game code should ask for `Jump`, not whether `Space` is currently pressed.

### Input contexts

The architecture must support explicit context ownership as complexity grows:

```text
gameplay
menu
dialogue
other explicit contexts
```

A UI overlay must not accidentally allow gameplay and UI to consume the same action without policy.

---

## 14. Rendering Architecture

### APPROVED DIRECTION

Three.js is the initial graphics foundation.

Renderer direction:

```text
RendererFactory
  +-> WebGPU preferred
  +-> WebGL2 fallback
```

The exact implementation and fallback tier are earned by runtime proofs.

### Rendering ownership

Rendering consumes runtime state. It does not become the canonical gameplay state owner.

### Material portability

Where practical, shared material logic should favor mechanisms that can target both renderer paths. TSL/node-based approaches may be used when they reduce duplicate logic and survive actual runtime validation.

---

## 15. UI Architecture

### REQUIRED DIRECTION

Use a DOM-first hybrid strategy.

```text
runtime state
    |
    v
UI view model / declared readable state
    |
    v
DOM UI
    |
    v
semantic gameplay actions
```

UI may render game state and emit actions.

UI must not mutate privileged engine internals directly.

In-world rendered UI remains available where a game needs it.

---

## 16. Diagnostics Architecture

### REQUIRED ARCHITECTURE

Diagnostics are structured data first, human-readable text second.

Conceptual record:

```text
Diagnostic {
  severity,
  code,
  step,
  subsystem,
  entityPid?,
  definitionId?,
  artifactKey?,
  message,
  data
}
```

Severity/policy categories:

```text
FATAL
DEGRADE
QUARANTINE
```

A console message may accompany a diagnostic, but console text alone is not the architecture.

Diagnostic streams should be queryable by tests and evaluation tools.

---

## 17. Randomness and Determinism

### REQUIRED ARCHITECTURE

Deterministic systems receive seeded random services.

Do not scatter `Math.random()` across engine-owned deterministic behavior.

Conceptually distinguish:

```text
ctx.random()           // seeded / deterministic stream
ctx.unseededRandom()   // explicit nondeterministic use if allowed
```

The exact API is not frozen by these names.

Deterministic claims apply to a defined engine build/platform class, not universal cross-device bit identity.

---

## 18. Save Architecture

### APPROVED FUTURE SYSTEM

Default model: snapshot-first persistence.

Conceptual save content:

```text
saveFormatVersion
projectId
definitionHash
engineVersion
persistentVariables
persistentEntityState
```

Only declared persistent state is serialized.

Runtime entity handles are never save identifiers.

Load reconstructs runtime state from definitions/artifacts plus persisted state rather than serializing arbitrary runtime objects.

---

## 19. Replay Architecture

### APPROVED FUTURE SYSTEM

Replay remains separate from save/load.

Conceptual replay:

```text
definitionHash
worldSeed
startSnapshot
inputLog
checkpointHashes
```

Divergence should produce a structured report identifying the first known mismatch where practical.

The canonical definition-hashing mechanism should be shared across Kiln identity, save compatibility, and replay identity.

---

## 20. Geometry Architecture

### APPROVED FUTURE SYSTEM — GEOMETRY FORGE

Geometry Forge grows from proof needs.

Potential generator families:

- primitives;
- profiles;
- curves;
- extrusion;
- sweep;
- loft;
- lathe;
- voxels;
- parametric generators;
- exact CSG;
- SDF-based operations.

### 20.1 Semantic geometry

Topological meaning must not depend only on vertex number ranges.

Primary semantic direction:

```text
triangle/face:
  regionId
  surfaceId
  constraintFlags
```

### 20.2 SemanticLandmarks

Definition-space named points/frames such as:

- wrist;
- shoulder;
- weapon socket;
- door hinge;
- tree root.

Landmarks are designed to survive remeshing because they are not tied to one arbitrary vertex index.

### 20.3 Topology-changing operations

Any operation that changes topology must define how semantics propagate.

If semantics are inferred after loss, inference must be marked and diagnosable.

---

## 21. CSG and Spatial Technique Split

### APPROVED DIRECTION

Use the technique that matches the problem.

```text
Exact architectural solids
  -> Manifold candidate when direct construction is insufficient

Caves / tunnels / destructible terrain
  -> SDF / voxel techniques

Spatial acceleration / raycast / closest-point
  -> three-mesh-bvh candidate behind engine boundaries
```

No optional library is admitted until `DEPENDENCY_POLICY.md` requirements and a real proof justify it.

Direct procedural construction should beat boolean operations when it is simpler and more stable.

---

## 22. Character Architecture

### APPROVED FUTURE SYSTEM — CHARACTER FORGE

Conceptual pipeline:

```text
CharacterDefinition
  -> geometry
  -> SemanticLandmarks
  -> skeleton
  -> skinning
  -> correctives
  -> shape grammar
  -> materials
  -> motion
```

Prior procedural humanoid/Skeleton Forge work is donor evidence only until deliberately ported/adapted.

B1 establishes whether the character approach is visually and mechanically credible.

Character Forge must not become a prerequisite for ordinary non-character games.

---

## 23. Motion Architecture

### APPROVED FUTURE SYSTEM — MOTION FORGE

Motion starts from semantic intermediate representation, not from a pretty DSL.

Conceptual `MotionDefinition` fields:

```text
phases
timing
contacts
constraints
jointTargets
rootMotion
additiveLayers
events
```

Conceptual execution:

```text
Motion Definition
  -> Motion Compiler
  -> Pose
     + IK
     + grounding
     + look-at
     + rootDelta
```

`rootDelta` becomes movement intent and passes through transform authority.

An LLM does not calculate every bone transform each frame.

---

## 24. Material Architecture

### APPROVED FUTURE SYSTEM — MATERIAL FORGE

Material Forge owns procedural appearance definitions for generated engine content.

Potential data sources:

- semantic surface IDs;
- palettes;
- gradients;
- masks;
- deterministic procedural texture functions;
- generated normal/roughness data;
- environmental modifiers such as wetness, snow, moss, dirt, wear.

Expensive procedural work may compile/bake through Kiln.

Material Forge must not force permanent per-fragment procedural evaluation when a compiled result is the better runtime artifact.

---

## 25. World Architecture

### APPROVED FUTURE SYSTEM — WORLD FORGE

Proof C begins bounded.

Conceptual world source:

```text
WorldRecipe
  -> deterministic fields
  -> WorldFieldCache
  -> terrain/vegetation definitions
  -> compiled artifacts
  -> runtime world
```

### 25.1 WorldFieldQuery

For cheap/bulk 2.5D or environmental sampling.

Possible operations:

```text
sampleField()
sampleFieldGrid()
groundHeight()
groundNormal()
```

Typical consumers:

- ecology;
- vegetation;
- ambience;
- biome selection;
- weather.

### 25.2 WorldVolumeQuery

For authoritative 3D spatial truth.

Possible operations:

```text
raycast()
sweep()
overlap()
closestSurface()
columnSpans()
```

Typical consumers:

- gameplay;
- physics;
- grounding;
- navigation;
- interiors;
- caves;
- stacked floors.

Anything requiring correctness under overhangs uses `WorldVolumeQuery` rather than pretending a height field is sufficient.

### 25.3 Donor boundaries

If Super Terrain/Sylva ideas are adopted later, preserve ownership:

```text
world/ecology donor concepts
  -> environmental fields / placement ideas

terrain donor concepts
  -> terrain compilation / chunking / LOD ideas when required

Engine 1.0
  -> query contracts / lifecycle / Kiln ownership

Material Forge
  -> appearance ownership
```

Donor renderers/editors never become engine authority by accident.

---

## 26. Collision and Physics Architecture

### APPROVED INCREMENTAL DIRECTION

Proof A begins with simple collision sufficient for a tiny complete game.

Advanced physics enters only when evidence requires it.

If a third-party physics library such as Rapier is later admitted, hide it behind engine-owned boundaries so project code depends on engine contracts rather than a vendor API throughout the game.

Physics must respect the fixed clock and transform-authority model.

---

## 27. Audio and FX Architecture

### APPROVED FUTURE SYSTEM

Audio and FX remain modular runtime capabilities rather than mandatory heavyweight authoring graphs.

Potential audio direction:

- procedural synthesis;
- sample playback if later supported;
- spatial emitters;
- ambience;
- sequencing.

Potential FX direction:

- particles;
- trails/smears;
- sparks;
- smoke;
- rain/snow;
- lightning;
- debris.

Donor implementations may be ported/adapted only after architecture/provenance review.

---

## 28. Studio Boundary

### REQUIRED ARCHITECTURE

My Engine Studio remains a separate authoring product.

Conceptual relationship:

```text
GUI / CLI / AI / Tests
        |
        v
Project Operations
        |
        v
Project Data
        |
        v
Runtime Adapter
        |
        v
My Game Engine 1.0
        |
        v
Game
```

Engine 1.0 owns runtime capability truth and reusable schemas/contracts that Studio consumes.

Studio must not maintain an incompatible duplicate engine capability registry.

Exported games must not require Studio.

---

## 29. Static Build and Export Architecture

### REQUIRED ARCHITECTURE

Ordinary project export:

```text
Project Definitions + Project Code
             |
             v
       validate / compile
             |
             v
 static JS + artifacts + assets
             |
             v
        static hosting
             |
             v
           browser
```

The build may use Node tooling. The exported game should not require a Node application server merely to boot.

Games that use only compiled content consume `engine/runtime`.

Games that intentionally generate content during play may consume `engine/full`.

---

## 30. Public API Boundary

### REQUIRED ARCHITECTURE

Project code should depend on stable engine-owned public contracts.

Avoid teaching or requiring:

- deep internal module imports;
- mutable renderer internals;
- private lifecycle state;
- test-only helpers;
- donor-library APIs directly throughout project code.

When an example or tutorial cannot avoid internal access, treat that as API pressure and ask whether the public surface is missing a legitimate capability.

---

## 31. Evaluation Architecture

### A0 APPROVED SYSTEM

Evaluation infrastructure exists to make later proof claims falsifiable.

It should grow to provide:

- browser automation;
- deterministic capture setup;
- capture comparison;
- diagnostics query/collection;
- runtime telemetry;
- exact revision/build reporting;
- stable proof fixtures.

Evaluation tooling may live outside production runtime bundles where appropriate.

It must not become a second hidden engine implementation.

---

## 32. Test Architecture

Detailed requirements live in `TESTING_AND_VALIDATION.md`.

Architecturally, tests should cover boundaries rather than only local functions.

Expected layers include:

```text
unit
integration
browser/runtime
proof-game regression
determinism
lifecycle
visual/capture
performance when measurable
adversarial validation
```

Examples should become test inputs where practical.

A runtime feature cannot be accepted solely from static code review.

---

## 33. Learning Architecture

Learning documentation is separate from canonical architecture authority.

```text
canonical docs -> state what is true
examples       -> demonstrate accepted behavior
lessons        -> teach accepted behavior
ADRs           -> preserve reasons for significant decisions
```

Learning content follows accepted implementation and uses public APIs.

`docs/learn/README.md` is created when the first accepted lessons exist, not as an empty curriculum monument during Phase 0.

---

## 34. Proposed Physical Repository Shape

### PHASE 0 FOUNDATION

The repository may begin conceptually as:

```text
/
├── README.md
├── CONSTITUTION.md
├── PRD.md
├── ARCHITECTURE.md
├── CONTEXT.md
├── ROADMAP.md
├── AGENTS.md
├── HANDOFF_PROTOCOL.md
├── DEPENDENCY_POLICY.md
├── DEFINITION_OF_DONE.md
├── TESTING_AND_VALIDATION.md
├── DOCUMENTATION_MAP.md
├── CLAUDE.md
├── GEMINI.md
├── package.json
├── package-lock.json
├── .gitignore
├── .nvmrc
├── .node-version
├── src/
├── tests/
├── examples/
└── docs/
    ├── learn/
    ├── adr/
    └── archive/
```

This is a shape, not permission to add empty subsystem directories.

Only create directories/files that have current use.

---

## 35. Dependency Boundaries

External libraries may provide implementation help but must remain behind engine-owned seams where practical.

Examples of intended relationships:

```text
Three.js
  -> graphics/math foundation

three-mesh-bvh (if admitted)
  -> spatial acceleration behind engine queries

Manifold (if admitted)
  -> exact solid operations behind Geometry Forge

Rapier (if admitted)
  -> advanced physics behind engine physics/collision contracts

Recast (if admitted)
  -> navigation implementation behind engine navigation contracts
```

Do not let a dependency's architecture become the public engine architecture merely because integration is convenient.

---

## 36. Provenance Architecture

Substantially ported donor code must be traceable.

At minimum preserve:

```text
source repository
source commit SHA
source path
license
classification: PORT or ADAPT
reason for adoption
material changes
associated tests
```

The exact storage mechanism may be a dedicated provenance record, source headers where appropriate, or another documented repository convention selected during implementation.

Do not scatter provenance into ephemeral chat history.

---

## 37. Deferred Architecture

The following are intentionally deferred and must not be interpreted as missing Phase 0 work:

- huge-world streaming;
- advanced residency management;
- stable editable terrain-vertex identity for sculpt tools;
- advanced physics;
- navigation;
- multiplayer/networking;
- mobile-first runtime;
- native desktop wrappers;
- plugin marketplace;
- visual scripting;
- universal asset import/export ecosystem;
- advanced GI;
- volumetrics;
- TAA;
- clustered lighting;
- realistic face generation/performance;
- cloth simulation;
- realistic dynamic hair;
- decorative Motion DSL;
- runtime editor undo/redo infrastructure.

A proof or explicit human decision can promote deferred work later.

### 37.1 Promotion by the general-engine product decision

GENERAL-ENGINE-DIRECTION-001 promoted several entries above from *deferred* to **long-term product requirement, architecture recorded, implementation not yet earned**.

Promotion changes what the architecture must not foreclose. It does not authorize implementation, and it does not remove anything from this deferred list for present work.

| Entry | Status after promotion |
| --- | --- |
| huge-world streaming | Boundary recorded in §46. Implementation deferred. |
| multiplayer/networking | Boundary recorded in §47. Implementation deferred. |
| visual scripting | Scoped to three domains and recorded in §45. General-purpose visual scripting remains deferred permanently. |
| universal asset import/export ecosystem | Import *normalization boundary* recorded in §44. A universal ecosystem remains deferred. |
| advanced physics, navigation, mobile-first, native wrappers, plugin marketplace, advanced GI, volumetrics, TAA, clustered lighting, realistic face/cloth/hair, decorative Motion DSL, editor undo infrastructure | Unchanged. Still deferred. |

See `PRD.md` §31 to §39 for the product requirements these boundaries serve.

---

## 38. Proof-to-Architecture Mapping

```text
PHASE 0
  -> repo/module seams
  -> package/build/test/browser foundation

A0
  -> diagnostics/capture/telemetry/evaluation seams

PROOF A
  -> entity/transform/input/events/state/variables/rules/scripts
  -> simple collision
  -> DOM UI
  -> tiny Kiln seam
  -> static export

PROOF B1
  -> Character Forge minimum
  -> Motion Forge minimum
  -> skinning/grounding/IK/root-motion truth

PROOF B2
  -> Geometry Forge expansion
  -> Material Forge minimum
  -> combat integration
  -> audio/FX minimum where useful

PROOF C
  -> World Forge minimum
  -> fields/cache/terrain/vegetation/world queries

PROOF D
  -> pressure test foundation with different genre

PROOF E
  -> public API/documentation generality test
```

Do not implement later rows simply because they appear in this table.

---

## 39. Architecture Change Procedure

A material architecture change must identify:

1. the observed problem;
2. the accepted evidence;
3. the current canonical rule affected;
4. competing options;
5. why the selected option best fits product law;
6. migration/compatibility impact;
7. tests/proofs that distinguish success from failure;
8. whether an ADR is warranted;
9. which permanent docs must change.

Builders may propose architecture changes. They may not silently enact constitutional changes inside unrelated implementation work.

---

## 40. Conflict Rule

If code, tests, or runtime behavior disagree with permanent documentation:

```text
STOP
-> identify the exact conflict
-> determine which evidence is accepted
-> determine whether code is wrong or architecture must change
-> obtain the required human/architecture decision
-> update code and docs together
```

Do not quietly choose the easier side.

---

## 41. Phase 0 Architectural Acceptance

Phase 0 should be considered architecturally successful when the clean repository proves:

- canonical docs can orient humans and agents without old repository context;
- Node/tooling is pinned;
- package install/build/test commands work;
- browser/dev-server boot works;
- a minimal runtime skeleton exists without pretending to be the whole engine;
- runtime/full entry-point separation is represented cleanly;
- no donor repository has been wholesale imported;
- no future Forge is falsely presented as implemented;
- repository state is clean and exactly identified;
- later Proof A can begin without first undoing bootstrap architecture.

That is enough.

Phase 0 must not become a disguised engine implementation phase.

---

## 42. Final Architecture Rule

The architecture exists to make game creation more reachable, inspectable, reproducible, and extensible—not to maximize the number of subsystems.

Every major abstraction must eventually justify itself in a running game.

If a simpler design survives the same proofs and preserves the Constitution, prefer the simpler design.

---

# PART II — CROSS-SYSTEM BOUNDARIES FOR THE EXPANDED ENGINE

*Added by GENERAL-ENGINE-DIRECTION-001. Sections 1 to 42 describe the architecture as originally scoped and remain in force, including §42.*

*This part records **boundaries**, not designs. Its purpose is to stop present work from accidentally foreclosing accepted future product requirements. It deliberately does not specify APIs, node types, message formats, file parsers or schemas: those belong in earned subsystem specifications under `docs/spec/`, created only after implementation earns them.*

*Nothing in this part is implemented. Nothing in this part authorizes implementation.*

---

## 43. Scene and Composition Architecture

### FOUNDATION BUILT — AWAITING RE-AUDIT

SCENE-COMPOSITION-001 implemented the foundation. Successive independent audits failed it twice — two blocking defects repaired at R1, and a unit-quaternion source-contract defect repaired at R2 (see `docs/spec/scene.md` §12.1). It has **not** been re-audited or human-accepted, and must not be described as ACCEPTED until it is.

**What now exists.** `SceneDefinition` (source) compiles to a deep-frozen `SceneArtifact` and instantiates into a `SceneInstance`: persistent authored identity, hierarchy, local transforms, derived world composition as affine matrices, deterministic canonical serialization, immutable artifact identity, runtime entity mapping, clean unload and reload, independent instances, structured diagnostics, and a supported public API split across `engine/runtime` and `engine/full`. Its forcing consumer is the SUBTERRA cell, a 37-node constructed environment. The subsystem specification is `docs/spec/scene.md`.

**What remains future**, and is deliberately absent: prefabs, reparenting, scene transitions, streaming and chunking, save-game persistence, networking, live hierarchy mutation after compilation, and spatial indexing. See `docs/spec/scene.md` §11.

The gap this closed was real. There was previously no engine-owned scene or composition model at all: each proof assembled its own renderer scene independently, which was correct for a bounded proof and insufficient for a general engine.

Seven accepted future requirements depend on this model existing first: prefabs and instancing, save and persistence, story and quest references to world objects, Studio inspection, world streaming, networking, and MMO persistence. It is therefore a keystone rather than one feature among many, and the foundation was built first for that reason.

### 43.1 Concepts the model must eventually carry

```text
scene / level identity
parent-child hierarchy
local and world transform relationships
collections / groups
prefabs / templates
instances
persistent IDs
serialization
loading and unloading
chunk / region ownership
world state
```

### 43.2 Boundaries that must hold

- **No monolithic scene singleton.** A global mutable scene forecloses both server-authoritative simulation (§47) and partial world residency (§46).
- **Runtime identity is not persistent identity.** §8 and `CONSTITUTION.md` §14 already govern this. A scene model must not reintroduce serialized runtime handles through a side door.
- **Transform authority is unchanged.** §9 and `CONSTITUTION.md` §13 continue to govern who may write a transform. A hierarchy does not create a second writer.
- **Composition does not own rendering.** What exists in a scene and what is submitted to the GPU are separate questions (§48).

### 43.3 Implementation notes that became architecture

Two findings from SCENE-COMPOSITION-001 are durable enough to record here rather than only in the subsystem specification.

**`ATTACHED` was already the right mechanism.** `GAMEPLAY_FOUNDATION.md` §3.1 defines `TRANSFORM_OWNERSHIP.ATTACHED` as "derives world transform hierarchically from a parent entity". It existed and was unused. Scene composition uses it for parented nodes and `STATIC` for roots, so hierarchy introduced no new ownership mode and no second per-tick transform writer. The scene publishes derived world *position* into the existing transform manager once, at instantiation.

**Rotation and scale stayed out of the runtime transform.** The runtime `Transform` record owns position and velocity. Scene composition did not extend it; full placement is read from derived artifact data instead. Extending the runtime transform is transform-architecture work and needs its own authorization.

**A composed world placement is an affine matrix, not a TRS.** This is durable architecture rather than a scene detail, because it constrains every future consumer of composed placement — streaming, physics, Studio inspection and networking all inherit it.

```text
localMatrix      = T * R * S
worldMatrix      = parentWorldMatrix * localMatrix
```

Local authoring stays TRS, because that is how a human or an AI describes a placement. Composed placement cannot: nesting a non-uniform scale above a rotation produces shear, which has no translation/rotation/scale decomposition. An engine that stores composed placement as TRS is wrong for those hierarchies and cannot be made right without changing the representation. The convention (column vectors, column-major storage) is documented in `src/scene/affine.js` and asserted by test rather than left to be inferred.

The corollary binds the renderer too: a presentation layer must **install** the composed matrix rather than decompose it, or correct compiler math is discarded at the last step and the visible bug survives.

### 43.4 What must not be done yet

Do not widen the scene API before a forcing consumer earns it. Over-specifying this model before a real game pulls on it is precisely the failure `CONSTITUTION.md` §32 exists to prevent, and the boundaries in `docs/spec/scene.md` §11 are deliberate rather than incidental.

---

## 44. External Asset Normalization Boundary

### APPROVED FUTURE SYSTEM — NOT IMPLEMENTED

`PRD.md` §36 makes external asset interoperability a long-term product requirement. This section records the only architectural commitment that requirement makes.

```text
EXTERNAL FORMAT
      |
      v
IMPORT ADAPTER          <- format knowledge lives here and nowhere else
      |
      v
ENGINE-OWNED NORMALIZED REPRESENTATION
      |
      v
PREVIEW / SEMANTICS / KILN
      |
      v
RUNTIME
```

### 44.1 The boundary rule

**A foreign format never becomes internal authority.** Format knowledge is confined to its adapter. Nothing downstream of the adapter may branch on which format an asset came from.

The practical test: deleting an importer must remove the ability to *ingest* that format and must not break anything already ingested.

### 44.2 Normalization targets already exist

MeshIR, its canonical codec, semantic parts, semantic anchors, Material Forge definitions, the Previewable contract and the Preview Lab are engine-owned normalized representations accepted at revision `798bd89`. An import adapter has somewhere to land today. This is why glTF/GLB is the cheapest first interoperability consumer, and it is an observation about cost, not an authorization.

### 44.3 Provenance

An imported asset carries provenance: what it came from, which adapter produced it, and at which revision. §36 already governs provenance architecture and applies unchanged. An asset whose origin cannot be explained is the failure mode named in `PRD.md` §2.

### 44.4 Dependencies

A format parser may be admitted as a dependency only through `DEPENDENCY_POLICY.md`, only behind its adapter, and never as a type that appears in engine-owned representation.

---

## 45. Visual Graph Source-Truth Architecture

### APPROVED FUTURE SYSTEM — NOT IMPLEMENTED

`PRD.md` §34 establishes the Two-Door Law and §35 scopes visual authoring to animation state logic, story/quest/dialogue, and timelines/cinematics.

### 45.1 The single-truth rule

```text
        HUMAN DOOR                 AI / CODE DOOR
      visual editor                public API
             \                        /
              \                      /
               v                    v
          ONE MACHINE-READABLE GRAPH
             (project data)
                    |
                    v
        compile / validate / execute
```

A visual editor is a **view and an input method** over a data model that exists independently of it. The data model is the architecture; the editor is not.

### 45.2 Boundaries that must hold

- **No editor-only state.** Any state that affects behavior must be in the data model and readable through the code door. Purely cosmetic editor state — node screen positions, collapsed groups, colour tags — may exist, must be clearly separated, and must never affect execution or identity.
- **Determinism.** Graph evaluation follows `CONSTITUTION.md` §12 and §16. A graph does not create its own frame loop and does not use uncontrolled randomness.
- **Transform authority.** A graph that drives motion commits through the transform owner (§9). It does not write transforms directly.
- **Standard JavaScript is not replaced.** §12 and `CONSTITUTION.md` §11 stand. Graphs express state machines and schedules; scripts express computation.

### 45.3 Scope discipline

Three domains earn graph representation because each is genuinely a state machine or a schedule. General gameplay logic is not, and a general-purpose visual programming system remains deferred permanently (§37.1).

---

## 46. Large-World Composition Boundary

### APPROVED FUTURE SYSTEM — NOT IMPLEMENTED

```text
WORLD
  |
  +-- REGIONS / ZONES
        |
        +-- CHUNKS / CELLS
              |
              +-- ACTIVE RUNTIME SET
```

Behavior: load ahead, retain nearby, unload behind.

### 46.1 The binding constraint is negative

Present work is not required to implement residency. It is required not to assume its absence:

- **Do not assume the entire world is permanently loaded.** Code that iterates "all entities" or "all objects in the world" as a correctness requirement forecloses streaming.
- **Persistent state must survive unloading.** An object that is unloaded and reloaded is the same object. This requires persistent identity (§48) and is why scene composition (§43) must precede streaming.
- **Residency is not visibility.** Culling and level-of-detail are rendering concerns; residency is a simulation and memory concern. Conflating them produces a system that cannot simulate an unloaded region and cannot unload a visible one.

### 46.2 Deferred within this boundary

Chunk compilation, LOD/HLOD generation, terrain and object streaming, NPC activation, background simulation, navigation regions, audio regions, lighting regions and world-origin strategy are all deferred. Each needs its own evidence, and several need a forcing consumer that does not yet exist.

---

## 47. Client/Server Authority Boundary

### APPROVED FUTURE SYSTEM — NOT IMPLEMENTED

`PRD.md` §37.3 makes networking a long-term product requirement because of the planned MMO consumer. No networking is authorized.

### 47.1 The binding constraint is negative

```text
DO NOT introduce architecture that requires a global singleton
incompatible with authoritative server simulation.
```

Concretely, present work should avoid:

- module-level mutable state that assumes exactly one world, one player or one simulation per process;
- systems that can only be driven by input polled from a browser device;
- simulation that reads presentation state, which does not exist on a server;
- identity that is only meaningful inside one client process (§48).

### 47.2 What this does not require

It does not require present code to be network-aware, to carry a transport abstraction, or to separate client and server today. It requires that doing so later is a change rather than a rewrite.

### 47.3 Static export is unaffected

`CONSTITUTION.md` §6 requires that an ordinary exported game boot from static hosting with no mandatory application server. A networked game is not an ordinary exported game. Both remain true.

---

## 48. Identity Model — Authoring, Gameplay, Render Group, Persistent, Network

### PARTLY IMPLEMENTED — BOUNDARY RECORDED HERE

The CINDER MK-I capability benchmark (accepted at revision `798bd89`) surfaced a distinction that was previously implicit and is now explicit architecture.

```text
AUTHORING / EVIDENCE PART IDENTITY
  What the asset source declares and what evidence can name.
  CINDER: 227 semantic parts.
  IMPLEMENTED — MeshIR part table, semantic anchors.

GAMEPLAY OBJECT IDENTITY
  What the game treats as a thing that can be addressed, hit, carried,
  destroyed or saved.
  NOT the same as authoring parts. A rail tooth is not a game object.

RUNTIME RENDER-GROUP IDENTITY
  What the renderer submits as one unit of work.
  CINDER: 227 render groups, 227 measured draw calls.

PERSISTENT IDENTITY
  What survives a save, a reload and an unload/reload cycle.
  Governed by CONSTITUTION.md Sections 14 and 15.

NETWORK IDENTITY
  What a server and a client agree refers to the same thing.
  NOT IMPLEMENTED.
```

### 48.1 These are five identities, not one

They coincide today only because the engine is small. Treating them as one concept is the mistake this section exists to prevent. In particular, **authoring granularity must not be assumed to equal gameplay granularity or render granularity.** Nothing requires every decorative rivet, rail tooth or vent to be a separately addressable game object or a separate GPU submission.

### 48.2 The measured coupling

`src/render/mesh-adapter.js` currently emits one render group per MeshIR part. Semantic authoring granularity therefore determines render-submission granularity, mechanically and without a decision having been made.

The CINDER measurement is:

```text
227 semantic authoring parts -> 227 render groups -> 227 measured draw calls
```

**What this establishes:** a demonstrated scaling pressure, and a coupling between two identities that architecture says should be separable.

**What this does not establish:** that draw calls are the dominant runtime performance cost. No profiling has been performed. The frame-time contribution of render submission in this engine is currently unmeasured.

The correct sequence is therefore measurement before optimization. See `ROADMAP.md` for the recorded ordering. Kiln (§6) is the architecturally correct home for a future decoupling — compiling rich authoring state into cheaper runtime state is its stated purpose — but the decision to build that decoupling requires evidence that does not yet exist.

### 48.3 Semantics survive compilation

Whenever a future compilation step does reduce render groups, source semantics must survive it. A compiled artifact must retain a mapping from each source authoring part to its compiled location, so diagnostics, gameplay and evidence can still identify authored pieces without requiring an independent GPU submission per piece. Destroying semantic source identity to optimize rendering is prohibited.

---

## 49. Supported Public Surface Boundary

### REQUIRED DIRECTION — RECONCILIATION NOT YET PERFORMED

`CONSTITUTION.md` §5 establishes two entry points. §30 establishes the public API boundary. This section records an audit finding against them.

### 49.1 The finding

Significant accepted, implemented capability — including Character Forge, Motion Forge and World Forge — is not generally reachable through the supported public `engine/full` surface. `src/full/index.js` states this deliberately and accurately; the defect is that the deliberate choice has never been revisited against the public-release product target.

### 49.2 The rule

```text
IMPLEMENTED + ACCEPTED + INTENDED FOR EXTERNAL AUTHORING
        -> MUST HAVE A SUPPORTED PUBLIC ROUTE
```

### 49.3 Constraints on satisfying it

- **A deep import is not a public API.** Importing an internal module path is an unsupported workaround that silently freezes internal structure into the public contract.
- **Exposure is a decision, not a default.** Not every internal module should be public. §5 requires that an ordinary exported game not ship the entire authoring toolchain, and that constraint is unchanged.
- **Reconciliation is its own tranche.** No export change is authorized here.
