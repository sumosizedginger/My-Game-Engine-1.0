# My Game Engine 1.0 — Project Context

## Status

**Document type:** Canonical orientation and historical context  
**Authority:** Informational context; it does not override `CONSTITUTION.md`, `PRD.md`, `ARCHITECTURE.md`, or an applicable accepted subsystem specification  
**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`  
**Implementation state at bootstrap:** Greenfield repository foundation

This document explains what the project is, where its ideas came from, which earlier repositories may contribute technology, which major decisions have already been made, and what is true at the current stage.

It is deliberately written so that a new human or AI can orient itself without access to old conversations, temporary work orders, model transcripts, or abandoned plans.

If this document ever conflicts with a higher-authority canonical document, this document is wrong and must be repaired.

---

## 1. The Project in One Sentence

My Game Engine 1.0 is a browser-first, code-native procedural game engine built for humans and AI to create, inspect, modify, test, and export complete games through deterministic, machine-readable systems.

---

## 2. Permanent Repository Truth

The canonical implementation repository is:

```text
sumosizedginger/My-Game-Engine-1.0
```

This repository is a **new implementation**.

It is not:

- a rename of `sumosizedginger/my-engine-2`;
- a conversion of My Engine Visual Lab;
- a wholesale copy of the original My Engine;
- My Engine Studio;
- a donor-repository aggregation;
- an attempt to preserve prior repository history as the new engine's implementation history.

The correct description is:

> My Game Engine 1.0 is a clean canonical implementation of an already-designed architecture, selectively informed by proven technology and lessons from prior projects.

This distinction is permanent unless the human project owner explicitly changes it.

---

## 3. What "Greenfield With Designed Architecture" Means

The repository begins without accepted engine implementation code, but the project is not conceptually undefined.

A substantial set of product and architecture decisions has already been approved, including:

- the Code-Reachable Law;
- browser-first execution;
- deterministic and machine-editable definitions;
- definitions as source, compiled artifacts as build/cache products, runtime objects as transient instances;
- the Kiln compile/bake/cache seam;
- `engine/runtime` and `engine/full` as two consumption modes of one codebase;
- fixed-step gameplay simulation with variable rendering and interpolation;
- one authoritative transform writer per entity per simulation step;
- generational runtime entity handles plus persistent IDs;
- snapshot-first saves plus a separate replay system;
- seeded deterministic randomness for gameplay and generation;
- capability / prefab / rule / script separation;
- Geometry Forge;
- geometry semantics and `SemanticLandmarks`;
- Character Forge;
- Motion Forge;
- Material Forge;
- World Forge;
- field queries versus authoritative volume queries;
- DOM-first hybrid game UI;
- action-based input with keyboard and controller as first-class bindings;
- WebGPU preferred with meaningful WebGL2 fallback;
- static export as a core capability;
- proof-driven engine development;
- independent build, audit, repair, and verification roles;
- a learning repository that teaches accepted implementation rather than imagined future APIs.

These are **approved directions and contracts**. They are not proof that corresponding production modules already exist.

For implementation status, inspect the repository and current accepted handoff. Never convert architectural nouns into imaginary source files.

---

## 4. Why This Engine Exists

Traditional game-development pipelines often divide creative intent across tools and artifacts that are difficult for code agents to inspect or reproduce directly:

- opaque binary scenes;
- hand-authored DCC files;
- editor-only state;
- large imported asset hierarchies;
- mesh edits expressed as thousands of low-level mutations;
- procedural choices that cannot be reconstructed from source definitions.

My Game Engine 1.0 explores a different native workflow.

Prefer semantic, inspectable intent such as:

```text
shoulderWidth += 0.08
```

instead of thousands of hand-edited vertex coordinates.

Prefer:

```text
forest.seed = 87122
forest.density = 0.63
forest.biome = "temperateMixed"
```

instead of manually placing hundreds of trees.

The human or AI describes meaningful intent. Deterministic engine code performs repetitive mathematics and produces reproducible artifacts.

The project does not require every game to be procedural at every frame. Expensive procedural work may compile through Kiln and become cacheable/exported artifacts.

---

## 5. The Code-Reachable Law

The highest product principle is defined authoritatively in `CONSTITUTION.md`.

In practical terms, a native My Game Engine 1.0 artifact should remain reachable through code:

1. constructible;
2. inspectable;
3. modifiable;
4. serializable;
5. reproducible from definitions, parameters, and seeds where applicable;
6. testable;
7. attributable to the definition and parameters that produced it.

This is the reason the engine favors semantic definitions and deterministic compilers over opaque native production assets.

It is not a ban on interoperability. Traditional formats may eventually be supported as optional import/export boundaries. They are not the native source of truth.

---

## 6. Development Philosophy: Games Discover the Engine

The project rejects this sequence:

```text
build every imagined engine feature
-> someday try to build a game
```

The project uses:

```text
engine capability
-> running game proof
-> evidence
-> architecture correction
-> next capability
```

Proof games are experimental instruments.

They determine whether an abstraction deserves to exist, whether a public API is usable, whether a system is genuinely generic, and whether the engine is becoming easier or harder to build with.

The proof sequence is defined in `ROADMAP.md`.

---

## 7. Canonical Repository Versus Donors

The relationship is:

```text
My-Game-Engine-1.0
        |
        +-- canonical implementation
        +-- permanent documentation
        +-- public API
        +-- tests and runtime evidence
        +-- learning material
        +-- examples
        +-- proof games
        +-- releases

Donors / references
        |
        +-- my-engine-2
        +-- original My Engine
        +-- My Engine Studio
        +-- Super Terrain
        +-- Sylva / realistic-forest
        +-- OpenSmash
        +-- approved libraries and research projects
```

A donor may have excellent working code and still be architecturally wrong for the new engine.

Existing code receives **evidence priority**, not constitutional priority.

Every candidate donor system must be classified:

```text
PORT       use substantially as implemented
ADAPT      reuse meaningful code/design with material changes
REFERENCE  learn from it; write new implementation
DROP       do not carry it forward
```

No entire donor repository is implicitly approved.

---

## 8. High-Value Donor: `sumosizedginger/my-engine-2`

Role:

**technology donor and research reference**

Potentially useful prior work includes:

- Geometry Kernel concepts and implementation;
- procedural geometry;
- cross-sections, curves, and loft generation;
- geometry validation;
- canonical humanoid work;
- humanoid parameterization;
- Skeleton Forge work;
- renderer experiments;
- lifecycle ideas;
- telemetry;
- deterministic capture/debug infrastructure;
- tests encoding durable invariants.

Before using any piece, inspect the actual donor revision and answer:

1. Does it still satisfy the new Constitution and Architecture?
2. Is the behavior genuinely generic?
3. Is the public API appropriate for a clean engine?
4. Do the tests capture durable behavior or only old repository assumptions?
5. Would a fresh implementation now be simpler or clearer?
6. Does the code pull historical architecture baggage into the new engine?
7. Is provenance and license information available?

Do not clone the whole tree into the new engine.

---

## 9. High-Value Donor: Original My Engine

Role:

**runtime/gameplay donor and proof reference**

Potential areas worth inspecting when a proof pulls them:

- swept AABB collision;
- browser game/runtime behavior;
- procedural WebAudio;
- particles;
- smear/trails;
- voxel systems;
- simple procedural actors;
- facing/hitbox primitives;
- selected environment/runtime systems;
- quality-setting ideas.

These systems are candidates, not commitments.

The same `PORT / ADAPT / REFERENCE / DROP` process applies.

---

## 10. My Engine Studio

Role:

**separate authoring product and contract source**

Studio is not part of the runtime repository.

The intended eventual relationship remains:

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

Important architectural lessons that survive from Studio work include:

- stable project identity;
- local-first project data;
- versioned schemas;
- Project Operations as an authoring boundary;
- prefab authoring;
- Play Mode isolation;
- explicit resource ownership;
- separation between authoring state, runtime state, and save-game state.

The engine should eventually own runtime capability truth. Studio consumes that truth rather than maintaining a competing capability registry.

Exported games must run without Studio.

---

## 11. External Donor and Reference Landscape

External projects are evaluated only when a proof makes them relevant. Do not perform deep integration work merely because they appear on this list.

### Super Terrain

Potential role:

- terrain mesh/chunk compilation;
- worker revision control;
- stale-result rejection;
- LOD and streaming ideas when large worlds actually require them;
- residency/memory telemetry.

Do not automatically inherit its editor, React/R3F structure, renderer assumptions, or large-world complexity.

### Sylva / `realistic-forest`

Potential role:

- environmental fields;
- deterministic ecology;
- biome logic;
- tree/vegetation generation and placement;
- moisture, flow, canopy, rock, and growth concepts.

Boundary direction:

```text
Sylva ideas         -> ecology / fields / placement
Terrain technology  -> terrain mesh/chunks/LOD when needed
Engine 1.0          -> lifecycle / Kiln / query contracts
Material Forge      -> appearance
```

### OpenSmash

Potential role:

- staged pipelines;
- deterministic evaluation;
- pose/action tours;
- controlled captures;
- adversarial visual evaluation;
- fresh-eyes verification.

Do not adopt remote mesh generation, Blender dependence, GLB-first authority, or Smash-specific pipeline assumptions as native architecture.

### Three.js

Current intended role:

**core browser graphics foundation**

The engine should use proven scene graph, vector/matrix, skeletal, and browser graphics primitives rather than recreating them for ideological purity.

Major dependency upgrades must be justified separately from engine architecture work.

### Manifold / exact CSG

Candidate for exact solid operations when direct construction is inferior.

Do not integrate merely to check a roadmap box.

### SDF / voxel techniques

Candidate for organic carving, caves, tunnels, and terrain destruction.

### `three-mesh-bvh`

Candidate spatial-query acceleration behind engine-owned interfaces.

### `meshoptimizer`

Optional future optimization dependency. Defer until measurement proves need.

### Rapier

Optional advanced physics. Defer until a proof requires rigid bodies, joints, complex contact behavior, stacks, vehicles, or similar physics.

### Recast navigation

Future navigation candidate. Defer until a generated-world game actually requires pathfinding.

### Ossos / retargeting research / Posecode

Motion and IK references. The native direction remains an engine-owned Motion IR.

### Theatre.js / Kimodo

Possible future authoring/research references, not runtime foundations.

### PlayCanvas / Babylon.js

Previously considered alternative engine foundations. They are not the foundation of My Game Engine 1.0.

---

## 12. Dependency Philosophy

The detailed admission rules live in `DEPENDENCY_POLICY.md`.

The durable principle is:

> Dependencies may assist the machine. They may not secretly become the machine.

A dependency should be hidden behind engine-owned contracts when the engine depends on its semantics.

The project does not reject libraries. It rejects surrendering the native architecture to opaque or replaceability-hostile external systems.

---

## 13. Native Pipeline Direction

The core content relationship is:

```text
Definition
    |
    v
Validation
    |
    v
Kiln.compile()
    |
    v
Compiled Artifact
    |
    +--> cache/build output
    |
    v
Runtime.instantiate()
    |
    v
Transient Runtime Object
```

Definitions are source.

Compiled artifacts are derived.

Runtime objects are transient.

Kiln must begin small. It grows because real expensive work needs compilation, not because the word "pipeline" sounds impressive.

Gameplay logic remains live/interpreted where appropriate instead of being baked into content artifacts.

---

## 14. Two Consumption Modes

Approved architecture provides:

```text
engine/runtime
```

for ordinary exported games, and:

```text
engine/full
```

for Studio or games intentionally performing content generation at runtime.

`engine/full` contains runtime plus Kiln and generation/compiler systems **when those systems have actually been implemented and accepted**.

A tiny game should not automatically ship every Forge and authoring compiler.

---

## 15. Gameplay Foundation Direction

The engine supplies general vocabulary; the game composes it into genre behavior.

Expected engine-level substrate grows toward:

- entity identity;
- transforms;
- fixed simulation;
- action-based input;
- events;
- state primitives;
- timers;
- runtime variables;
- rule evaluation;
- script hosting;
- tags and queries;
- spatial queries;
- spawn/despawn;
- ownership/attribution;
- deterministic RNG;
- scene transitions;
- pause/time scale;
- camera foundation;
- saves/replays when earned;
- diagnostics.

Genre-specific concepts default to project code.

A mechanic does not become engine architecture merely because one game needs it.

---

## 16. Capability / Prefab / Rule / Script

The approved distinction is:

### Capability

Engine-level reusable behavior that genuinely needs privileged access to engine internals.

### Prefab

Project-owned composition of existing engine vocabulary.

### Rule

Simple declarative project wiring between events, conditions, and actions.

Rules must not grow into a disguised proprietary programming language.

### Script

Normal project JavaScript for behavior too specific or complex for simple rules.

Decision procedure:

```text
Does this need code?
  no -> prefab/rule

Does it only connect existing things?
  yes -> rule

Does it require privileged engine internals?
  yes -> candidate capability

Otherwise
  -> project script
```

A capability is promoted only when repeated evidence shows the engine must own it.

---

## 17. Simulation, Transform, and Identity Direction

Three especially important invariants already have architectural approval.

### Fixed simulation

Gameplay-observable behavior uses a fixed simulation step. Rendering may run variably and interpolate between committed simulation states.

No subsystem invents a hidden independent gameplay loop.

### Transform authority

One authoritative writer owns an entity transform per simulation step.

Animation produces pose and movement intent; it does not arbitrarily overwrite world transforms.

### Identity

Runtime identity uses generational handles conceptually equivalent to:

```text
EntityHandle(index, generation)
```

Persistent relationships use persistent IDs.

Runtime handles are ephemeral and never serialized as durable identity.

These principles still require concrete implementation and proof.

---

## 18. Generation Systems: Approved Direction, Not Bootstrap Fact

The following names describe planned architectural domains:

### Geometry Forge

Procedural geometry generation, validation, semantic surfaces/regions, landmarks, and later justified operations such as CSG/SDF/optimization.

### Character Forge

Procedural character definitions, geometry, landmarks, skeleton, skinning, correctives, shape grammar, and related character compilation.

### Motion Forge

Motion IR, phases, contacts, constraints, joint targets, grounding, IK, root motion, blending, and motion compilation.

### Material Forge

Procedural appearance definitions, masks, generated textures, material programs, bake rules, and world/character surface ownership.

### World Forge

Bounded procedural world generation beginning with recipes, fields/cache, terrain, vegetation, and world-query interfaces.

At repository bootstrap, these are **not automatically implemented**.

Their subsystem specifications are created only when their proof phase begins.

---

## 19. Renderer Direction

The target relationship is:

```text
RendererFactory
    +-- WebGPU preferred
    +-- WebGL2 meaningful fallback
```

WebGPU is the primary development target.

WebGL2 must remain a real fallback, with its exact supported feature tier determined through evidence rather than slogans.

The project is not currently prioritizing advanced GI, volumetrics, TAA, clustered lighting, or giant shadow architecture.

Those are later visual decisions pulled by games and benchmarks.

---

## 20. UI and Input Direction

### UI

Default game UI is DOM-first hybrid:

- HUD;
- menus;
- pause;
- dialogue;
- inventory;
- game-over;
- text.

Rendered in-world UI is used when the game needs it.

The architectural boundary matters more than framework choice:

```text
UI reads declared game/UI state
UI emits actions
UI does not mutate hidden engine internals
```

### Input

Game logic consumes semantic actions:

```text
Move
Look
Jump
Attack
Interact
Pause
```

Hardware bindings are separate.

Keyboard and controller are first-class from the beginning of gameplay proofs.

Touch is later unless a proof pulls it forward.

---

## 21. Save and Replay Direction

The approved direction is:

**snapshot-first saves plus a separate replay system**.

The project does not require replaying an entire session merely to load a save.

Persistent state is explicitly declared rather than serializing arbitrary runtime object graphs.

Replay identity should share the same canonical definition-hashing concept used for content identity/versioning rather than inventing unrelated hash semantics.

Save and replay are not required during Phase 0 and need not block Proof A unless the selected proof genuinely requires them.

---

## 22. Diagnostics and Evidence

The engine is intended to be legible to both humans and AI agents.

Important failures should become structured diagnostics rather than invisible console folklore.

The approved conceptual diagnostic shape includes fields such as:

```text
severity
code
step
subsystem
entityPid?
definitionId?
artifactKey?
message
data
```

Failure modes conceptually distinguish:

- **FATAL** — engine state cannot be trusted;
- **DEGRADE** — use a visible/known fallback and continue;
- **QUARANTINE** — disable one broken instance while preserving the rest of the game.

Exact APIs are implementation work.

Runtime evidence matters. Source review alone cannot prove a runtime feature works.

---

## 23. Learning Repository Mission

The repository should become both:

```text
serious game engine
+
learning repository
```

Canonical documentation describes what is true.

Learning documentation explains how to understand and use accepted truth.

The learning workflow is:

```text
BUILD
-> TEST
-> RUN
-> AUDIT
-> REPAIR if required
-> REVALIDATE
-> ACCEPT
-> TEACH
```

Do not teach APIs or subsystems before they exist.

Proof games should become runnable curriculum examples where practical.

Examples should participate in automated validation so tutorials cannot silently rot.

The first learning materials are expected only after Proof A is independently accepted.

---

## 24. Agent Workflow Context

The project owner remains the human integration authority.

The engineering workflow uses distinct roles:

- **orchestrator** — maintains context, scopes work, evaluates evidence, chooses next role;
- **builder** — writes production code within a bounded task;
- **validator/auditor** — independently attacks correctness and architecture claims;
- **repair agent** — fixes accepted findings without expanding scope;
- **verifier** — confirms the exact candidate revision independently, preferably from clean state.

No model may build, audit, verify, and accept its own material change as one uninterrupted act.

The exact handoff format lives in `HANDOFF_PROTOCOL.md`.

This separation is especially important when fast models are used. A confident report is evidence only when commands, revisions, tests, runtime behavior, captures, diagnostics, or independent checks support it.

---

## 25. Documentation System

At repository bootstrap there are twelve canonical project documents:

1. `README.md`
2. `CONSTITUTION.md`
3. `PRD.md`
4. `ARCHITECTURE.md`
5. `CONTEXT.md`
6. `ROADMAP.md`
7. `AGENTS.md`
8. `HANDOFF_PROTOCOL.md`
9. `DEPENDENCY_POLICY.md`
10. `DEFINITION_OF_DONE.md`
11. `TESTING_AND_VALIDATION.md`
12. `DOCUMENTATION_MAP.md`

Model compatibility shims such as `CLAUDE.md` and `GEMINI.md` are not independent authorities.

Additional canonical subsystem specifications are earned by implementation phases, with a maximum intended canonical set of twenty-one documents unless the human owner explicitly changes that policy.

Learning documents and significant ADRs are separate categories and do not count against that ceiling.

---

## 26. Current Stage

At the time this context document is created, the intended current stage is:

# Phase 0 — Repository Foundation

Phase 0 establishes:

- coherent permanent documentation;
- Node/package/toolchain baseline;
- minimal source/test/example/docs structure as actually required;
- test infrastructure;
- browser/dev-server boot;
- build/test/run commands;
- the smallest valid runtime skeleton;
- the `engine/runtime` / `engine/full` package/export direction;
- exact clean repository baseline.

Phase 0 does **not** implement the entire engine.

It does **not** import donor systems by default.

It does **not** begin Proof A unless the active work order explicitly advances the phase after acceptance.

---

## 27. Known Research Risks

The project is designed to expose its risky assumptions through proofs rather than bury them under architecture prose.

Important known risks include:

### Character aesthetic truth

Can code-native procedural topology + skinning + materials + motion produce characters that feel intentional rather than mannequin-like?

Proof B1/B2 must answer this honestly.

Failure narrows the hero-character ambition; it does not invalidate the rest of the engine.

### API ergonomics

Can a fresh human or model build something new using public APIs without internal knowledge?

Proof E answers this.

### WebGL2 fallback

How much of the intended visual/runtime experience can remain meaningful on fallback rendering?

Evidence during real visual proofs decides the tier.

### CSG semantics

If exact CSG becomes necessary, can semantic region/surface identity propagate reliably through the chosen backend?

Do not integrate a backend until a proof makes the question concrete.

### Procedural-world scaling

Can the bounded field/query architecture extend cleanly when a real game needs larger worlds?

Do not solve streaming before bounded worlds work.

### Generality

Can different genres share foundations without turning the engine into either a genre-specific framework or an abstract bureaucracy?

Proof D is designed to attack this assumption.

---

## 28. Explicitly Deferred Areas

Do not interpret omission from current implementation as forgotten work.

The project deliberately defers systems such as:

- advanced GI;
- volumetrics;
- TAA;
- clustered lighting;
- huge-world streaming;
- massive residency systems;
- sculpt-editor stable vertex identity;
- advanced face generation;
- facial performance;
- cloth simulation;
- realistic dynamic hair;
- Rapier integration before physics evidence;
- Recast integration before navigation evidence;
- ECS rewrite;
- plugin marketplace;
- visual scripting;
- GLTF/FBX-first native pipeline;
- universal import/export;
- multiplayer/networking;
- mobile-first architecture;
- native wrappers;
- pretty proprietary motion DSL.

Deferred means **not now**, not necessarily **never**.

---

## 29. Native Shortcuts That Are Not Allowed to Become Foundations

The native engine must not depend fundamentally on:

- Blender;
- Maya;
- ZBrush;
- Unity;
- Unreal;
- Godot;
- MetaHuman;
- MakeHuman;
- Character Creator;
- Tripo;
- Meshy;
- remote image-to-3D services;
- downloaded finished hero meshes.

Optional interoperability may be added later if it does not compromise native code reachability.

---

## 30. Licensing Direction

The intended repository-license direction is MIT unless the human owner changes it before public release.

The intent is to maximize:

- learning;
- forking;
- experimentation;
- contributions;
- commercial game development;
- ecosystem growth.

Brand/trademark rights are a separate matter.

Do not treat this context statement as finalized legal text. License and trademark files require explicit human approval before final public-release language is considered settled.

---

## 31. What a New Agent Must Not Assume

A fresh agent must not assume any of the following without repository evidence:

- a Forge exists because a canonical doc names it;
- donor source has already been imported;
- an old My Engine 2 API remains valid;
- Visual Lab tests are part of this repository;
- the old renderer architecture is canonical;
- old schemas are accepted;
- Studio ships with exported games;
- save/replay already exists;
- world streaming exists;
- advanced physics or navigation exists;
- a planned dependency is installed;
- an architecture decision has implementation proof merely because it appears in documentation.

Inspect first.

---

## 32. What Evidence Changes Context

This document should evolve when durable project context changes, for example:

- a donor system is formally adopted or rejected;
- a proof invalidates a major assumption;
- a major subsystem becomes accepted implementation reality;
- a dependency becomes part of the supported architecture;
- a previously deferred feature becomes active roadmap work;
- the project relationship to Studio changes;
- public-release licensing decisions become final.

Do not update this file for temporary work-order trivia.

Durable behavior belongs in code, tests, canonical specifications, and ADRs when appropriate.

---

## 33. Orientation Checklist

Before contributing materially, a human or agent should be able to answer:

```text
Which repository is canonical?
What phase is active?
Which architecture is required versus merely planned?
Which documents govern this task?
Which code actually exists?
Which donor, if any, is being considered?
What proof is this work serving?
What commands demonstrate success?
Who independently validates the result?
What must be true before the baton moves?
```

If those answers are unclear, resolve the ambiguity before widening implementation scope.

---

## 34. Final Context Rule

The repository is the machine.

Prior repositories are evidence and ancestry.

Canonical documents describe the intended and accepted machine.

Running code and tests prove what has actually been implemented.

Proof games reveal what the engine needs next.

Learning material teaches only what survived that process.

Temporary AI conversations are scaffolding, not project truth.
