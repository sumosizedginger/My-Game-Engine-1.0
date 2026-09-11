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

### 1.1 Expanded product target

The engine is additionally intended to become a **publicly released, general-purpose** game engine used by developers other than its owner, capable over time of supporting games from small single-player projects through to large persistent multiplayer worlds.

That target does not change the thesis above and does not weaken the proof-driven discipline that governs implementation. It changes what the finished product must eventually be able to do.

Sections 31 to 39 state the expanded requirements. Everything in those sections is **REQUIRED DIRECTION — NOT YET IMPLEMENTED** unless stated otherwise, and every one of them remains proof-gated: a requirement establishes that the engine must eventually be able to do something, never that it already can.

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

### 5.1 Status of these non-goals after the general-engine direction decision

The list above remains accurate and was not a mistake. Most of its entries are already conditioned on sequence — "during the initial proof sequence", "before the bounded-world proof succeeds", "before project code proves it is needed" — and those conditions were the correct call at the time they were written.

The general-engine product decision changes the **long-term** status of several of them. It does not retroactively invalidate any of them, and it does not authorize implementation.

| Non-goal entry | Status now |
| --- | --- |
| multiplayer/networking during the initial proof sequence | Still a non-goal for the initial path. Networking is now a **LONG-TERM PRODUCT REQUIREMENT — NOT YET EARNED** (§37). |
| universal GLTF/FBX-first asset pipeline | **Unchanged as written.** Foreign formats must never become the native authoring pipeline. Import *interoperability* is a separate and now-required capability (§36). |
| giant-world streaming before the bounded-world proof succeeds | The bounded-world proof (Proof C) has succeeded, so this precondition is satisfied. Large-world capability is now a **LONG-TERM PRODUCT REQUIREMENT — NOT YET EARNED** (§37), still gated by a forcing consumer. |
| visual scripting before project code proves it is needed | **Unchanged as written.** Visual authoring is now required for three specific domains (§35), and each remains gated on a forcing consumer. General-purpose visual scripting is still not a goal. |
| mobile as the primary initial platform | **Unchanged.** The browser remains the first-class platform. Additional targets are earned by evidence. |
| proprietary gameplay scripting language | **Unchanged and permanent.** Standard JavaScript remains the programming substrate. |
| cloning Unity/Unreal/Godot/Blender; native DCC dependence; plugin marketplace; premature ECS rewrite | **Unchanged.** |

Entries not listed in this table are unchanged.

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

---

# PART II — EXPANDED PRODUCT DIRECTION

*Added by GENERAL-ENGINE-DIRECTION-001. Sections 1 to 30 describe the product as originally scoped and remain in force. This part states what the engine must additionally become as a publicly released general-purpose engine.*

*Nothing in this part is implemented. Nothing in this part authorizes implementation. Each requirement is earned by a real forcing consumer and accepted through the normal proof, audit and verification chain.*

---

## 31. Status Vocabulary for Expanded Requirements

Every capability described in this part carries one of these statuses. A capability with no status stated defaults to the first.

```text
REQUIRED DIRECTION — NOT YET IMPLEMENTED
  The product must eventually do this. No implementation exists.
  A forcing consumer must earn it.

APPROVED FUTURE SYSTEM
  The architectural shape is decided and recorded in ARCHITECTURE.md.
  Implementation still requires its own bounded work order.

IMPLEMENTED — ACCEPTED
  Real code exists, has passed audit and independent verification,
  and is named with its accepted revision.
```

A product requirement is not a claim of capability. Documentation in this repository must never let future intent read as current behavior. When in doubt, state the status explicitly.

---

## 32. Public Release and Third-Party Developers

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

My Game Engine 1.0 is intended for public release and for use by developers who did not build it and will not read its internal architecture documents.

That imposes requirements the original single-owner scope did not:

- capabilities intended for external use must be reachable through an intentional supported entry point (§39);
- public API documentation, published schemas and sample projects become release prerequisites;
- breaking changes to public surfaces require migration guidance;
- third-party developers arrive with existing assets and existing habits, and the engine must meet them without surrendering its own source truth (§36);
- accessibility and localization become product requirements rather than optional polish (§38).

Section 3 describes the engine's users. Third-party developers are now a first-class user class, not a hypothetical one.

---

## 33. General-Purpose Engine Scope

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

The engine must eventually provide enough reusable substrate that a developer can build a platformer, a shooter, an RPG, an adventure game, a strategy game, a simulation, a narrative game, a procedural game, a multiplayer game or a large persistent world without replacing half of the engine.

This does not mean every genre-specific mechanic belongs in engine core. The rule from §6 stands and is strengthened here:

> The engine provides reusable vocabulary. Games provide the sentence.

A capability belongs in the engine when more than one genuinely different consumer needs it and the engine can express it generically. A capability that one game needs belongs to that game until a second consumer proves otherwise.

The largest identified structural gap against this scope was the absence of a general engine-owned scene and composition model. SCENE-COMPOSITION-001 built that foundation; it is **awaiting independent validation and has not been accepted**. See `docs/spec/scene.md` for what exists and §11 of that document for what remains future, `ARCHITECTURE.md` §43 for the boundaries, and `ROADMAP.md` for sequencing.

---

## 34. The Two-Door Law

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

Every important authoring system should eventually expose **two doors over one source truth**.

```text
HUMAN DOOR                      AI / CODE DOOR
visual graphs                   definitions
timelines                       schemas
inspectors                      public APIs
scene and world tools           commands
asset browser                   scripts
preview                         structured diagnostics
import UI
              \                /
               \              /
            ONE MACHINE-READABLE
              PROJECT TRUTH
```

Both doors operate on the same underlying project data. A human editing a story graph visually and an AI editing it through code must be editing the same graph.

**Prohibited:** a visual-editor truth plus a separate AI/code truth. Hidden editor state that code cannot read is the specific failure this law exists to prevent, and it is one of the problems named in §2.

The governing principle:

> Everything should be authorable through code, but not everything must be authored by typing code.

"Code-native" describes where truth lives, not how a human must interact with it.

---

## 35. Visual Authoring for Animation, Story and Timeline

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

Visual authoring is required for three specific domains. It is not a general-purpose replacement for programming: standard JavaScript remains the gameplay programming substrate, and `CONSTITUTION.md` §11 still forbids a proprietary scripting language.

**Animation state logic.** Idle, walk, run, aim, attack, reload and their transitions, conditions and blends.

**Story, quest and dialogue.** Events, conditions, choices, branches, quest state, dialogue and encounter triggering.

**Timelines and cinematics.** Camera, animation, dialogue, audio, music, VFX, gameplay events and scene transitions on a time axis.

Each is a graph or timeline *data model* first and an editor second. The data model is the product requirement; the visual editor is one of its two doors (§34). An AI must be able to generate, inspect, test and modify exactly what the human sees.

These three domains were chosen because each is genuinely a state machine or a schedule, which is where visual representation earns its cost. Ordinary game logic is not.

---

## 36. External Asset Interoperability

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

The native workflow remains AI to native definitions to Forges to Kiln to runtime. That is the preferred path and it does not change.

Public developers will nevertheless arrive with existing assets and existing pipelines. The engine must eventually import them.

```text
EXTERNAL FORMAT
      |
      v
IMPORT ADAPTER
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

Formats expected to matter eventually include, at minimum: glTF/GLB, FBX, OBJ, PNG, JPEG, WebP, WAV, practical browser audio formats, and external animation data.

Two rules govern all of them:

1. **A foreign format never becomes permanent internal authority.** It is normalized into engine-owned representation at the boundary, exactly as §5 has always required.
2. **Import is not the native pipeline.** The engine does not become a glTF runtime that happens to have authoring tools attached.

glTF/GLB is the likely first interoperability consumer because the current graphics stack makes it cheapest, and because MeshIR, semantic parts, anchors and the Preview Lab already provide a normalization target. FBX remains a long-term compatibility requirement because public users have large existing pipelines built around it.

No importer is authorized by this section.

---

## 37. Large Worlds, Networking and Persistence

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

There is a planned MMO consumer. Large-world and networked capability are therefore product requirements rather than hypotheticals. Neither is authorized for implementation, and neither may be built before the systems beneath them exist.

### 37.1 Large worlds

```text
WORLD -> REGIONS / ZONES -> CHUNKS / CELLS -> ACTIVE RUNTIME SET
```

Conceptually: load ahead, retain nearby, unload behind.

The binding constraint on present work is negative rather than positive: **do not assume the entire world is permanently loaded.** Persistent identity must survive unloading and reloading where the design requires it.

### 37.2 Persistence

Versioned saves, declared persistent state, migration, resume, persistent entity identity, world state, quest state, inventory and character state are all required eventually. `CONSTITUTION.md` §14 and §15 already govern the identity and save laws that make this possible; runtime entity handles must never become save identity.

### 37.3 Networking

Server authority, client/server separation, replication, interest management, network entity identity, prediction and reconciliation where appropriate, and server restart recovery are all required eventually.

Interest management matters particularly: a client should receive only the state relevant to that client.

The binding constraint on present work is again negative: **do not introduce architecture that requires global singletons incompatible with authoritative server simulation.** A design that works for one local player and forecloses a server is a design defect even while the engine is single-player.

`CONSTITUTION.md` §6 continues to require that an ordinary exported game boot from static hosting without a mandatory application server. A networked game is not an ordinary exported game, and that law is not weakened by this section.

---

## 38. Accessibility and Localization

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

A publicly released engine must let its developers ship accessible and localized games. This was absent from both implementation and product documentation before this tranche.

Required eventually: control remapping, subtitles, text scaling, colour and accessibility modes, localization tables, locale switching, and accessible UI paths.

The near-term obligation is compatibility rather than implementation: public APIs added now should not foreclose these later. An input system with no rebinding concept, or a UI layer that hard-codes strings, creates work that is expensive to undo. No accessibility subsystem is authorized, and none has earned a specification.

---

## 39. Supported Public Surface Requirement

**Status: REQUIRED DIRECTION — NOT YET IMPLEMENTED.**

A repository audit found that significant accepted, implemented capability is not generally reachable through the supported public `engine/full` surface.

The rule this establishes:

```text
IMPLEMENTED
+ ACCEPTED
+ INTENDED FOR EXTERNAL AUTHORING
        |
        v
MUST HAVE A SUPPORTED PUBLIC ROUTE
```

Three clarifications, because this rule is easy to over-read:

1. **Not everything internal should be exposed.** Engine-owned internal boundaries exist deliberately, and `CONSTITUTION.md` §5 requires that an ordinary exported game not ship the whole authoring toolchain.
2. **A deep import is not a public API.** Reaching a capability by importing an internal module path is an unsupported workaround, not a supported route, and it silently freezes internal structure into the public contract.
3. **The gap is a scheduling defect, not an architectural one.** The capabilities exist and are accepted; what is missing is the intentional decision about which of them are public and how.

Reconciling the public surface is future work with its own bounded tranche. This section authorizes no export change.
