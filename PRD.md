# My Game Engine 1.0 — Product Requirements Document

## Status

**Document type:** Canonical product requirements  
**Authority:** Below `CONSTITUTION.md`, above implementation details and roadmap sequencing  
**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

This document defines **what the product must become** and what outcomes count as success. It does not claim that future subsystems already exist.

When this document uses **MUST**, the requirement is product-level unless explicitly marked as a phase-specific target. When it uses **SHOULD**, deviation requires evidence and explanation. When it uses **MAY**, the choice is intentionally left to implementation evidence.

---

## 1. Product Summary

My Game Engine 1.0 is a browser-first, code-native procedural game engine built for humans and AI to create, inspect, modify, test, and export complete games through deterministic, machine-readable systems.

The engine is a **new implementation** in a clean canonical repository. Earlier My Engine repositories, My Engine Studio, and external open-source projects may provide proven techniques or bounded donor code, but they are not the canonical implementation.

The product thesis is:

> Humans and AI should be able to express game intent through stable, inspectable definitions and code while deterministic engine systems perform the repetitive mathematics and runtime work.

---

## 2. Problem Statement

Modern game development often depends on opaque or manually authored artifacts that are difficult for AI agents to inspect, reproduce, or modify safely.

Common failure modes include:

- important game state trapped in editor-only scenes;
- assets that cannot be reproduced from source definitions;
- object relationships encoded through hidden editor state;
- animation, geometry, terrain, and materials authored through disconnected tools;
- procedural systems that cannot explain what generated an output;
- export paths that pull in unnecessary authoring machinery;
- APIs that work for one prototype but collapse when a second genre appears;
- model-generated code that can build something impressive once but cannot reliably inspect, repair, or extend it later.

My Game Engine 1.0 addresses those problems by making the native game-making surface code-reachable, machine-readable, deterministic where material, and testable.

---

## 3. Primary Users

### 3.1 Human game creators

Developers who want to build browser games without requiring a traditional DCC-centered workflow for native engine content.

They need to:

- understand what the engine is doing;
- build small games quickly;
- modify generated content through semantic parameters;
- debug failures without reverse-engineering hidden state;
- export games that run independently of the authoring environment.

### 3.2 AI-assisted builders

AI agents operating under human direction.

They need:

- explicit architecture boundaries;
- stable public APIs;
- deterministic behavior where possible;
- machine-readable diagnostics;
- small, discoverable documentation sets;
- testable outputs;
- provenance for imported or compiled artifacts;
- enough runtime introspection to diagnose failures without guessing.

### 3.3 Engine contributors

Developers extending the engine itself.

They need:

- clear subsystem ownership;
- contribution pressure toward reusable capabilities instead of genre-specific core code;
- proof games that expose architectural regressions;
- tests that encode durable invariants;
- learning material that explains both usage and relevant internals.

---

## 4. Product Goals

My Game Engine 1.0 MUST eventually provide the following product outcomes.

### G1 — Complete browser games

A user can build a complete, playable browser game with engine-owned runtime systems and project-owned gameplay code.

### G2 — Code-reachable native content

Native generated content can be created, inspected, modified, serialized, reproduced, and tested through code and machine-readable definitions.

### G3 — Deterministic procedural generation

Generation systems that materially affect game content accept explicit seeds and stable definitions so the same defined build/platform class can reproduce expected outputs.

### G4 — Static export

Ordinary games can export to static files and run from a normal static host without requiring My Game Engine Studio or a mandatory application server.

### G5 — Small runtime footprint path

Games that only consume compiled artifacts can use the runtime entry point without automatically shipping authoring/compiler systems.

### G6 — Runtime generation path

Games that intentionally generate content at runtime can use the full entry point and approved compiler/Forge systems.

### G7 — Keyboard and controller parity at the gameplay layer

Game logic consumes semantic input actions instead of hard-coding physical keyboard keys.

### G8 — Machine-readable failure reporting

Material engine failures emit structured diagnostics with sufficient context for humans and AI to locate the failing subsystem, entity, definition, or artifact where available.

### G9 — Proof-driven generality

The engine survives multiple mechanically different game proofs without repeatedly rewriting its foundational identity, simulation, transform, event, or state contracts.

### G10 — Learnable repository

A fresh developer can clone the repo, run it, inspect it, modify it, and learn the accepted public API from maintained examples and lessons.

---

## 5. Non-Goals

The following are NOT required for the initial product path and MUST NOT be pulled forward without proof-driven justification.

- cloning Unity, Unreal, Godot, Blender, or another editor-centric engine;
- native dependence on Blender, Maya, ZBrush, Unity, Unreal, Godot, MetaHuman, MakeHuman, Character Creator, Tripo, Meshy, or remote finished-asset generators;
- building a full ECS rewrite before evidence requires it;
- building multiplayer/networking during the initial proof sequence;
- making mobile the primary initial platform;
- requiring native desktop wrappers for ordinary use;
- creating a proprietary gameplay scripting language;
- building visual scripting before project code proves it is needed;
- building a plugin marketplace;
- building a universal GLTF/FBX-first asset pipeline;
- building giant-world streaming before the bounded-world proof succeeds;
- advanced GI, volumetrics, TAA, clustered lighting, or large shadow research before visual proof requirements pull them in;
- realistic facial performance, advanced cloth simulation, or realistic dynamic hair as early blockers;
- integrating Rapier, Recast, Manifold, meshoptimizer, or other optional dependencies merely because they may be useful later;
- preserving earlier repository architecture for historical reasons.

---

## 6. Product Principles

The following requirements derive from `CONSTITUTION.md` and should be visible in product behavior.

### 6.1 Definitions are source

Where the engine owns procedural content, the editable definition is the source of truth.

Compiled artifacts are derived products and may be cached or exported.

Runtime objects are transient.

### 6.2 Semantic intent beats repetitive low-level mutation

Public APIs SHOULD expose meaningful parameters and structures instead of forcing humans or models to manipulate huge amounts of low-level geometry or animation data directly.

### 6.3 Games pull engine capability

A new reusable capability should be justified by running-game evidence, not by speculative completeness.

### 6.4 Runtime evidence beats claims

A feature is not considered product-complete because code exists. It must be runnable and validated according to `DEFINITION_OF_DONE.md` and `TESTING_AND_VALIDATION.md`.

### 6.5 The engine remains understandable

Architecture should prefer explicit ownership and small composable systems over hidden magic.

---

## 7. Required Product Architecture Outcomes

This PRD requires the architecture to support the following outcomes. Detailed ownership belongs in `ARCHITECTURE.md`.

### 7.1 Two engine entry points

The package direction MUST support:

```text
engine/runtime
```

for ordinary game runtime consumption, and:

```text
engine/full
```

for Studio or games that intentionally need runtime generation/compiler systems.

The exact package/export syntax may evolve during implementation. The separation of concerns must remain.

### 7.2 Kiln seam

The architecture MUST support:

```text
Definition
-> validate
-> Kiln.compile()
-> Artifact
-> instantiate
```

Phase 0 only establishes the seam. Cache layers, workers, persistent artifact stores, and binary formats are added only when a proof requires them.

### 7.3 Fixed simulation

Gameplay-observable systems MUST operate on a fixed simulation step. Rendering MAY run variably and interpolate.

### 7.4 Transform ownership

An entity MUST have one authoritative transform writer per simulation step.

### 7.5 Identity split

Runtime identity MUST support stale-reference detection, conceptually through generational handles.

Persistent identity MUST be serializable separately from ephemeral runtime handles.

### 7.6 Deterministic randomness services

Engine-owned deterministic behavior MUST NOT depend on uncontrolled scattered `Math.random()` calls.

### 7.7 Structured diagnostics

Material failures MUST surface through a structured diagnostic model rather than console-text-only failure reporting.

---

## 8. Gameplay Foundation Requirements

The engine MUST grow a general gameplay substrate through proofs rather than prebuilding every feature.

The intended substrate includes, when earned:

- entity identity;
- transforms;
- fixed simulation;
- semantic input actions;
- events;
- state primitives;
- timers;
- runtime variables;
- rules;
- script hosting;
- tags and queries;
- spatial entity queries;
- spawn/despawn;
- deterministic RNG;
- scene transitions;
- pause/time scale;
- camera foundation;
- save/load;
- diagnostics.

### 8.1 Capability / prefab / rule / script split

The public design MUST preserve these conceptual roles:

- **Capability:** engine-level behavior requiring privileged engine access.
- **Prefab:** project-owned composition.
- **Rule:** simple event/condition/action wiring.
- **Script:** ordinary project JavaScript for real behavior that does not require privileged engine access.

Genre-specific mechanics default to project-level code.

### 8.2 Project scripting

The engine SHOULD use normal JavaScript modules for project scripting.

The scripting surface must not require a proprietary language to express ordinary gameplay.

---

## 9. Input Requirements

### 9.1 Action-oriented gameplay input

Game code MUST consume semantic actions such as:

```text
Move
Look
Jump
Attack
Interact
Pause
```

Physical bindings are separate configuration.

### 9.2 Controller support

Controller support is first-class and MUST be exercised by proof games where applicable.

### 9.3 Context ownership

The architecture MUST eventually distinguish input contexts such as gameplay, menu, and dialogue so the same physical input is not ambiguously consumed by multiple layers.

---

## 10. Rendering Requirements

### 10.1 Browser rendering

Three.js is the intended graphics foundation unless an explicit later architecture decision changes it.

### 10.2 Renderer targets

The intended renderer strategy is:

```text
WebGPU preferred
WebGL2 meaningful fallback
```

The exact WebGL2 fallback feature tier is not declared complete until runtime proof establishes it.

### 10.3 Rendering scope discipline

The initial proof sequence must favor visible, testable game requirements over speculative rendering research.

---

## 11. Geometry Requirements

As Geometry Forge is earned by proofs, the engine SHOULD support code-native generation techniques such as:

- primitives;
- profiles;
- curves;
- extrusion;
- sweep;
- loft;
- lathe;
- voxel generation;
- parametric construction;
- exact CSG where useful;
- SDF/voxel carving where useful;
- validation;
- optimization when measured.

### 11.1 Semantic geometry

Semantic meaning MUST NOT depend solely on transient vertex index ranges.

The design direction includes face/surface semantics such as:

```text
regionId
surfaceId
constraintFlags
```

and definition-space `SemanticLandmarks` for named points/frames that can survive remeshing.

Inference used to repair missing semantics must be explicit and diagnosable, not silent.

---

## 12. Character Requirements

Character Forge is an approved future subsystem, not a bootstrap assumption.

When B1 earns it, the target pipeline is conceptually:

```text
Character Definition
-> Geometry
-> Semantic Landmarks
-> Skeleton
-> Skinning
-> Correctives
-> Shape Grammar
-> Materials
-> Motion
```

The engine MUST treat visual quality as falsifiable. If procedural hero characters fail the accepted visual/motion bar, the engine may narrow that technique without invalidating unrelated engine systems.

---

## 13. Motion Requirements

Motion Forge SHOULD begin from a semantic Motion IR rather than a decorative text DSL.

The intended conceptual data includes:

- phases;
- timing;
- contacts;
- constraints;
- joint targets;
- root motion;
- additive layers;
- events.

Animation/motion must respect transform authority.

Root motion produces movement intent; it does not become an independent world-transform writer.

---

## 14. Material Requirements

Material Forge should eventually own reusable procedural appearance for generated characters, terrain, vegetation, structures, and props.

Potential inputs include:

- palettes;
- gradients;
- masks;
- procedural textures;
- generated normals;
- roughness;
- dirt;
- wetness;
- moss;
- snow;
- wear.

Procedural inputs MAY be baked through Kiln. The product does not require permanent expensive procedural evaluation merely to claim procedural purity.

---

## 15. World Requirements

World Forge begins bounded.

Proof C should establish only what a bounded procedural world requires, likely including:

- `WorldRecipe`;
- `WorldFieldCache`;
- terrain;
- environmental fields;
- procedural vegetation;
- world query interfaces;
- deterministic seeds.

Massive streaming, giant residency systems, and sculpt-editor infrastructure are deferred until a running game proves they are required.

### 15.1 World query split

The architecture SHOULD distinguish:

**WorldFieldQuery** for cheap/bulk 2.5D/environmental sampling, and

**WorldVolumeQuery** for authoritative 3D spatial truth.

Anything requiring correctness beneath overhangs, inside caves, or across stacked floors must use the authoritative volumetric query path.

---

## 16. Collision and Physics Requirements

Early games may use simple deterministic collision sufficient for their mechanics.

Advanced rigid-body physics is optional and should be introduced only when a proof genuinely requires contacts, joints, stacks, vehicles, impulses, or equivalent behavior.

The architecture must not force an advanced physics engine into every exported game by default.

---

## 17. Save and Replay Requirements

### 17.1 Save model

The default direction is snapshot-first save/load.

Persistent state is declared and serialized intentionally. Random runtime object graphs are not serialized by convenience.

Save identity should include enough information to detect incompatible project/definition versions.

### 17.2 Replay model

Replay is a separate system using deterministic inputs, seeds, snapshots/checkpoints, and hashes where useful.

A replay divergence should produce structured debugging evidence instead of silently drifting.

### 17.3 Shared definition identity

Kiln artifact identity, save definition versioning, and replay definition identity SHOULD share one canonical definition-hashing concept rather than inventing incompatible hash schemes.

---

## 18. UI Requirements

The default runtime strategy is DOM-first hybrid UI.

Use ordinary DOM/HTML where appropriate for:

- HUD;
- menus;
- pause;
- dialogue;
- inventory;
- game-over;
- text-heavy surfaces.

Rendered in-world UI remains available when genuinely needed.

UI reads declared gameplay/UI state and emits gameplay actions. UI must not directly mutate privileged engine internals.

No constitutional ban exists on React/Vue/etc.; framework choice is secondary to preserving the boundary.

---

## 19. Audio and FX Requirements

The engine should eventually support code-native/procedural audio and FX where useful.

Potential systems include:

- procedural/synthesized SFX;
- spatial emitters;
- ambience;
- sequencing;
- particles;
- trails/smears;
- sparks;
- smoke;
- weather effects;
- debris.

The product does not require a giant graph-based audio/FX authoring environment before proof games need one.

---

## 20. Diagnostics Requirements

Engine diagnostics MUST be machine-readable.

The intended record shape is conceptually:

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

At minimum, the failure policy must distinguish:

- **FATAL** — engine state cannot be trusted; stop affected execution.
- **DEGRADE** — continue using an explicit visible/known fallback.
- **QUARANTINE** — disable an isolated broken script/capability instance while allowing unaffected game execution to continue.

Nothing material fails silently.

---

## 21. Determinism Requirements

The product target is reproducible behavior for a defined engine build/platform class.

Do not promise universal floating-point bit identity across every browser, GPU, CPU, and operating system.

Preserve deterministic inputs and ordering where they materially affect:

- content generation;
- gameplay simulation;
- tests;
- replays;
- artifact identity.

Nondeterministic cosmetic randomness, if allowed, must be routed through an explicit named service so its presence is inspectable.

---

## 22. Static Export Requirements

A normal game export MUST be capable of producing a static-hostable build.

Conceptual path:

```text
Project
-> validate/compile
-> static JavaScript + assets + definitions/artifacts
-> static host
-> browser
```

Exported games must not require My Engine Studio.

Games using only precompiled content should use the runtime path. Games intentionally generating content at runtime may use the full path.

---

## 23. Learning Repository Requirements

The repository is both a serious engine and a learning repository.

Learning content MUST follow accepted implementation reality:

```text
BUILD
-> TEST
-> AUDIT
-> REPAIR
-> REVALIDATE
-> ACCEPT
-> TEACH
```

Learning documents do not override canonical architecture.

Examples should use public APIs and should participate in automated validation where practical.

The first curriculum material is earned after Proof A is accepted.

Do not pre-create fake lessons for systems that do not exist.

---

## 24. Donor and Dependency Requirements

All donor systems are evaluated individually as:

```text
PORT
ADAPT
REFERENCE
DROP
```

Before adoption, evaluate:

- architecture fit;
- API quality;
- generic usefulness;
- license;
- provenance;
- tests;
- maintenance burden;
- whether a clean implementation is preferable.

Ported/adapted code must record source repository, source path, source commit SHA, source license, material changes, reason for adoption, and associated tests.

Detailed admission rules live in `DEPENDENCY_POLICY.md`.

---

## 25. Toolchain Requirements

Unless proven incompatible during bootstrap, use:

```text
Node 24.21.0
```

and pin it consistently through repository configuration.

Phase 0 must establish working commands for:

- install;
- build;
- test;
- development/browser boot.

Documentation must not claim commands work until the implementation proves them.

---

## 26. Proof Program

The product is validated through the following sequence.

### Phase 0 — Repository Foundation

Purpose: create a trustworthy empty-repo foundation.

Required outcomes:

- permanent documentation installed;
- Node/tooling pinned;
- minimal package/build structure;
- minimal test infrastructure;
- browser/dev-server boot;
- two-entry-point direction represented without speculative subsystem bulk;
- clean exact baseline commit.

Phase 0 does not implement the engine feature set.

### A0 — Evaluation Harness

Purpose: make future evidence trustworthy.

Required direction:

- deterministic capture path;
- browser automation;
- diagnostic querying;
- runtime telemetry;
- exact revision reporting;
- comparison tooling appropriate to later proofs.

### Proof A — Tiny Complete Game

Use a Pong/Lunar-Lander-scale game to prove the minimum production spine.

Required product concepts:

- entity;
- transform;
- semantic input action;
- movement;
- collision;
- runtime variable;
- rule;
- state;
- DOM UI;
- tiny Kiln seam;
- static build/export.

Measure game LOC, file count, boilerplate, boot behavior, diagnostics, and export simplicity.

Re-run Proof A after later major proofs. If this game becomes harder to build or maintain, the architecture is degrading.

### Proof B1 — Motion Truth

Use one procedural humanoid to test the character/motion thesis honestly.

Minimum experiment:

- procedural skin weights;
- one parameterized walk;
- grounding;
- minimal IK;
- root motion path if used.

Primary question:

> Does the character move convincingly enough to justify the approach, or does it still read as a mannequin?

### Proof B2 — Procedural Combat Room

Combine generated room geometry, semantic geometry, minimum materials, procedural character, minimum motion, collision, combat, and useful audio/FX.

Primary question:

> Can generated geometry, character, motion, materials, and gameplay combine into something that feels like a game rather than a technology demo?

### Proof C — Bounded Procedural World

Build bounded terrain and vegetation with environmental fields and world queries.

World-query abstractions must serve multiple real consumers, such as vegetation placement, character grounding, and gameplay/collision.

Do not introduce huge-world streaming merely to make the system look complete.

### Proof D — Different Genre

Build a mechanically different game.

The new genre may add project scripts, rules, prefabs, definitions, and justified capabilities.

It should not require fundamental rewrites of identity, event dispatch, simulation clock, transform ownership, save model, or state primitives.

Inspect the literal engine diff.

### Proof E — Blind API Test

A fresh model or developer receives only public API documentation, engine package, and build/run instructions.

Ask them to build an unplanned game.

Use failures to distinguish:

- missing API;
- bad API;
- bad documentation;
- hidden architecture dependence.

---

## 27. Acceptance Metrics

The following are product-level signals, not all immediate Phase 0 requirements.

### 27.1 Boot and export

- documented install/build/test/run commands succeed on the accepted revision;
- ordinary exported game boots from a normal URL/static host;
- no Studio dependency exists in exported runtime.

### 27.2 API ergonomics

- a tiny game does not require excessive boilerplate;
- examples use public APIs rather than internal shortcuts;
- fresh-agent/fresh-developer failures can be diagnosed from docs and structured diagnostics.

### 27.3 Determinism

- seeded procedural proofs reproduce expected results within the defined platform/build class;
- deterministic tests detect ordering or identity regressions;
- replay/checkpoint mechanisms can report divergence when implemented.

### 27.4 Architecture stability

- later proofs do not repeatedly rewrite foundational contracts;
- new genre requirements default to project code unless privileged engine access is genuinely justified;
- runtime-only consumers do not unintentionally import full authoring/compiler systems.

### 27.5 Learning quality

- accepted tutorial code matches the public API;
- examples build and boot;
- fresh readers can complete major learning paths from the repo alone.

---

## 28. Release Direction

The current intended code-license direction is MIT, pending explicit human approval of final legal text before public release.

Trademark/brand rights remain a separate decision.

Do not fabricate legal certainty inside implementation work orders.

---

## 29. Product Failure Conditions

The project must treat the following as meaningful warning signs rather than papering them over:

- Proof A requires large amounts of engine-specific boilerplate;
- a second genre requires foundational rewrites;
- generated artifacts cannot explain their provenance;
- deterministic generation depends on invisible environmental state;
- runtime/full split proves impossible without major coupling;
- public tutorials require internal engine hacks;
- multiple systems can mutate the same transform unpredictably;
- stale runtime handles can silently refer to reused entities;
- diagnostics exist only as unstructured console text;
- donor code enters without provenance or architecture review;
- procedural character/motion quality repeatedly fails honest visual evaluation.

A failed research thesis should narrow the affected feature. It should not automatically invalidate unrelated successful engine architecture.

---

## 30. Final Product Standard

My Game Engine 1.0 succeeds when a human or AI can build a real game by expressing understandable intent, inspect the machine when something goes wrong, reproduce important results, extend the project without casually rewriting the engine core, and export the result without carrying the authoring environment with it.

The engine is not complete because it has many systems.

It is complete when those systems form a small enough, clear enough, proven-enough machine that multiple different games can rely on them.
