# My Game Engine 1.0 — Constitution

## Status

**Authority:** Highest durable project law below an explicit active instruction from Sumo.

**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

This document defines the product and engineering laws that ordinary implementation work may not silently override. It is intentionally stricter and more durable than the roadmap, temporary work orders, current experiments, or donor code.

If a proposed change violates this document, the change requires an explicit human architecture decision. A builder may not amend the Constitution merely to make an implementation easier to justify.

---

## 1. Repository Identity Law

My Game Engine 1.0 is a **greenfield implementation with an already-designed architecture**.

It is not a conversion, rename, or continuation of `my-engine-2`, original My Engine, My Engine Studio, or any external donor repository.

The canonical machine is:

```text
sumosizedginger/My-Game-Engine-1.0
```

Other repositories are ancestors, donors, experiments, references, or consumers.

Prior implementations receive **evidence priority**, not constitutional priority.

No donor tree may be imported wholesale without an explicit bounded decision.

---

## 2. Code-Reachable Law

A native My Game Engine artifact should be reachable through code.

Where applicable, it must be:

1. constructible through code;
2. inspectable through code;
3. modifiable through code;
4. serializable through code;
5. reproducible from definitions, parameters, and seeds;
6. testable;
7. attributable to the definition and parameters that produced it.

This applies to native systems such as geometry, terrain, materials, procedural textures, characters, skeletons, motion, vegetation, structures, effects, audio, and gameplay definitions as those systems are implemented.

The law does **not** require expensive procedural work to execute every frame. It requires source authority to remain machine-readable and code-reachable.

---

## 3. Definition / Artifact / Runtime Separation

The engine distinguishes source definitions, compiled artifacts, and transient runtime objects.

Canonical direction:

```text
DEFINITION
  -> schema/semantic validation
  -> COMPILER / KILN
  -> COMPILED ARTIFACT
  -> CACHE / BUILD OUTPUT
  -> RUNTIME INSTANCE
```

Definitions are source.

Artifacts are compiled or cacheable products.

Runtime objects are transient execution state.

Do not collapse these layers merely because an early prototype can get away with it.

Do not overbuild them either. Phase 0 establishes seams; proofs determine when each seam needs more machinery.

---

## 4. Kiln Law

The compilation, bake, and cache boundary is named **Kiln**.

Kiln exists to turn deterministic definitions into runtime-ready artifacts.

Potential future products include geometry, skeletons, skin weights, corrective morphs, motion clips, procedural textures, material programs, terrain chunks, vegetation buffers, collision data, and navigation data when navigation exists.

Kiln does **not** bake ordinary gameplay logic into opaque artifacts.

Scripts, rules, state graphs, prefabs, timers, variables, entity creation, and capability configuration remain live/interpreted unless a future explicit architecture decision proves otherwise.

Kiln begins small. Infrastructure is earned by measured needs, not architectural vanity.

---

## 5. Two Entry-Point Law

The engine has one codebase and two intended primary consumption modes:

```text
engine/runtime
```

for ordinary exported games, and:

```text
engine/full
```

for Studio authoring or games that intentionally perform runtime generation requiring compiler/Forge systems.

`engine/full` includes `engine/runtime` plus approved generation/compiler tooling.

A small exported game must not automatically ship the entire authoring/generation toolchain.

The exact package layout is implementation detail until Phase 0 proves it, but the separation of concerns is architectural law.

---

## 6. Browser-First and Static Export Law

The browser is the first-class runtime platform.

Ordinary games should be exportable as static JavaScript/assets/definitions that can boot from a normal static host.

A mandatory application server must not be required simply to run an ordinary exported game.

GitHub Pages or equivalent static hosting should remain a valid target where browser platform restrictions permit.

Native wrappers, mobile-first targets, networking services, and platform-specific packaging are deferred until evidence requires them.

---

## 7. Human + AI Legibility Law

The engine is designed for both human developers and AI agents.

Public concepts should therefore favor:

- explicit names;
- stable terminology;
- deterministic inputs and outputs where material;
- machine-readable diagnostics;
- inspectable definitions;
- small, composable APIs;
- clear ownership boundaries;
- examples that use the real public API.

Do not trade away human comprehensibility for model convenience, or model inspectability for human-only hidden state.

AI should express semantic intent where practical. Deterministic code performs repetitive mathematics.

Prefer:

```text
shoulderWidth += 0.08
```

over thousands of opaque per-vertex edits when a semantic parameter can express the same intent.

---

## 8. Proof-Driven Development Law

Never follow this strategy:

```text
BUILD THE WHOLE ENGINE
-> HOPE GAMES FIT IT
```

Use:

```text
ENGINE CAPABILITY
-> RUNNING GAME PROOF
-> EVIDENCE
-> NEXT CAPABILITY
```

The proof sequence is the primary falsification mechanism for architecture.

Proofs may change implementation details and can expose bad assumptions. They do not automatically authorize abandoning constitutional product laws.

When theory and unrelated running-game evidence conflict, report the conflict and favor evidence unless doing so would violate a higher explicit product law.

If evidence is insufficient, defer rather than invent certainty.

---

## 9. Gameplay Vocabulary Law

The engine provides reusable vocabulary. Games provide the sentence.

Engine-level substrate may include, as proofs earn it:

- entity identity;
- transforms;
- fixed simulation;
- input actions;
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
- save/load;
- diagnostics.

Genre-specific mechanics default to project code.

A concept earns privileged engine capability status only when repeated evidence across unrelated games shows that project-level code is insufficient or wrong.

---

## 10. Capability / Prefab / Rule / Script Law

Use the smallest abstraction that fits the behavior.

**Capability:** reusable engine-level behavior requiring privileged engine access.

**Prefab:** project-owned composition of existing engine/game concepts.

**Rule:** simple declarative wiring of events/conditions/actions. Rules must not grow into an accidental proprietary programming language.

**Script:** ordinary project JavaScript for behavior that needs real programming logic but not privileged engine access.

Decision procedure:

```text
Does it require code?
  no -> prefab/rule

Does it only connect existing concepts?
  yes -> rule

Does it require privileged engine access?
  yes -> capability

Otherwise
  -> project script
```

---

## 11. Standard JavaScript Scripting Law

The native gameplay scripting direction is standard JavaScript modules.

Do not create a proprietary language simply to make scripting appear engine-like.

Script metadata may progressively expose intent such as `id`, lifecycle hooks, persistence, reads, writes, or touched services, but metadata requirements must be justified by consumers of that metadata.

Early proofs should not become paperwork simulators.

Scripts must not create uncontrolled global frame loops, own hidden global engine state, use invisible uncontrolled randomness for deterministic behavior, or retain stale runtime entity handles as though they were persistent identities.

---

## 12. Simulation Clock Law

Gameplay-observable behavior runs on a fixed simulation step.

Rendering may run at a variable rate and interpolate between simulation states.

Conceptual order:

```text
1. input snapshot
2. timers
3. queued events
4. state transitions
5. scripts/capabilities
6. motion
7. movement/collision
8. physics when present
9. authoritative transform commit
10. trigger/overlap evaluation
11. resulting event queue
12. render interpolation
```

The exact order may evolve only through explicit architecture work supported by tests and runtime evidence.

No subsystem may quietly create its own independent gameplay frame loop.

---

## 13. Transform Authority Law

There is one authoritative writer for an entity transform per simulation step.

Animation must not directly write world transforms as an independent authority.

Physics, gameplay, motion, attachments, and teleportation must interact through explicit ownership/intent rules.

Initial conceptual transform modes are:

```text
STATIC
KINEMATIC
SIMULATED
ATTACHED
```

Do not build complex arbitration before real systems compete, but never permit ambiguous multiple-writer behavior as an accidental shortcut.

Root motion conceptually produces pose plus root movement intent. The authoritative movement/transform system commits the resulting transform.

Teleportation is explicit and suppresses inappropriate interpolation for that transition.

---

## 14. Identity Law

Runtime identity and persistent identity are different systems.

Runtime identity uses a generational handle concept:

```text
EntityHandle(index, generation)
```

Runtime handles are fast, ephemeral, stale-reference detectable, and never serialized as durable identity.

Persistent identity uses stable `pid` values in authored/save relationships.

Pooling may reuse runtime slots only by advancing generation so stale handles cannot accidentally target a new occupant.

Temporary bullets, sparks, debris, and similar transient entities need no persistent ID unless a game explicitly makes them persistent.

---

## 15. Save and Replay Law

Save/load is snapshot-first.

Replay is separate.

A save may include durable state such as:

```text
saveFormatVersion
projectId
definitionHash
engineVersion
persistentVariables
persistentEntityState
```

Persistence must be declared. Do not serialize arbitrary runtime objects and call that a save system.

Replay may include:

```text
definitionHash
worldSeed
startSnapshot
inputLog
checkpointHashes
```

Checkpoint divergence must become structured diagnostic evidence.

Definition hashing should be one canonical concept shared where appropriate by Kiln identity, save compatibility, and replay identity rather than three subtly incompatible hash schemes.

---

## 16. Deterministic Randomness Law

Deterministic generation and gameplay use explicit seeded random services.

Do not scatter `Math.random()` through systems whose behavior is expected to reproduce.

If nondeterministic cosmetic randomness is intentionally allowed, expose it through an explicit, named API so its use is visible and auditable.

Determinism means reproducible behavior for a defined engine build/platform class. It does not promise universal floating-point bit identity across every browser, GPU, CPU, and operating system.

---

## 17. Geometry Semantic Law

Semantic identity must not depend on fragile vertex-index ranges.

Geometry systems should use stable higher-level semantics where needed, including concepts such as:

```text
regionId
surfaceId
constraintFlags
SemanticLandmarks
```

SemanticLandmarks are named definition-space points or frames such as wrist, shoulder, weapon socket, door hinge, or tree root.

Topology-changing operations must define how semantics propagate.

Inference may repair missing semantics only when that inference is explicit and diagnosable. Never silently fabricate semantic certainty.

---

## 18. Procedural Forge Law

The approved long-term architecture includes:

- Geometry Forge;
- Character Forge;
- Motion Forge;
- Material Forge;
- World Forge.

These names are architectural directions, not claims that implementations exist at bootstrap.

Each Forge is created and specified only when a proof reaches it.

Do not create empty subsystem empires in advance.

---

## 19. World Query Law

World data separates cheap/bulk field sampling from authoritative 3D spatial truth.

Conceptual categories:

**WorldFieldQuery** for data such as terrain height, moisture, biome, ground normal, and other bulk 2.5D/environment fields.

**WorldVolumeQuery** for authoritative raycasts, sweeps, overlaps, closest surfaces, interiors, caves, stacked floors, and other true 3D geometry interactions.

Anything requiring correctness beneath an overhang or inside multi-level geometry must not pretend a height field is authoritative 3D truth.

---

## 20. Rendering Law

Preferred renderer direction:

```text
RendererFactory
  -> WebGPU preferred
  -> WebGL2 fallback
```

WebGL2 fallback must remain meaningful until a later evidence-backed architecture decision changes the product requirement.

Three.js is the core graphics foundation unless evidence justifies a major change.

Do not combine foundational bootstrap work with gratuitous renderer/dependency churn.

High-end rendering systems such as GI, volumetrics, TAA, clustered lighting, and large shadow architecture are not bootstrap requirements.

---

## 21. Runtime UI Law

Default runtime UI is DOM-first hybrid.

Use DOM/HTML for ordinary HUD, menus, pause screens, dialogue, inventory, game-over screens, and text where that is the right tool.

Use rendered in-world UI when spatial presentation requires it.

Boundary:

```text
UI reads declared gameplay/UI state
UI emits gameplay actions
UI does not mutate hidden engine internals directly
```

Framework choice is secondary to this boundary. Plain DOM is preferred for small runtime builds; no framework prohibition is constitutional.

---

## 22. Input Law

Game logic consumes semantic actions, not hard-coded devices.

Examples:

```text
Move
Look
Jump
Attack
Interact
Pause
```

Bindings may map keyboard, mouse, and controller inputs onto actions.

Controller support is first-class from the architecture level.

Input contexts must be able to distinguish gameplay, menu, dialogue, or other ownership modes as real needs emerge.

---

## 23. Failure and Diagnostics Law

Important failure must not be silent.

Diagnostics should be machine-readable and human-readable.

Canonical shape direction:

```text
{
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

Broad failure behavior:

**FATAL:** engine state cannot be trusted; stop the affected run.

**DEGRADE:** use an explicit visible fallback and continue.

**QUARANTINE:** disable one broken script/capability instance while preserving the rest when safe.

Exact diagnostic APIs are implementation detail until proved.

---

## 24. Dependency Sovereignty Law

Dependencies may assist the machine. They may not secretly become the machine.

External libraries must sit behind engine-owned boundaries when they provide important replaceable implementation services.

No foundational requirement for Blender, Maya, ZBrush, Unity, Unreal, Godot, MetaHuman, MakeHuman, Character Creator, Tripo, Meshy, remote image-to-3D, or downloaded finished hero meshes.

Traditional formats and tools may become optional interoperability paths later. They are not native authority.

Dependency admission follows `DEPENDENCY_POLICY.md`.

---

## 25. Donor Provenance Law

Donor code is adopted only through explicit bounded work.

Every port or substantial adaptation records:

- source repository;
- source path;
- source commit SHA;
- source license;
- classification (`PORT`, `ADAPT`, `REFERENCE`, `DROP`);
- what was copied or derived;
- material changes;
- why it belongs in the new architecture;
- tests/evidence validating it.

Do not create mysterious code ancestry.

---

## 26. Studio Boundary Law

My Engine Studio remains a separate authoring product.

Long-term integration direction:

```text
GUI / CLI / AI / Tests
  -> Project Operations
  -> Project Data
  -> Runtime Adapter
  -> My Game Engine 1.0
  -> Game
```

The engine owns runtime truth and runtime capability contracts.

Studio consumes those contracts; exported games do not require Studio.

Do not duplicate independent capability registries across Studio and engine.

---

## 27. Resource Lifecycle Law

Resource cleanup is correctness.

Anything that owns GPU resources, DOM listeners, timers, workers, audio nodes, subscriptions, or other external/runtime resources must have explicit lifetime and cleanup behavior.

A feature that works once but leaks or survives teardown incorrectly is not complete.

Lifecycle behavior must be testable where practical.

---

## 28. Learning Repository Law

The repository must become understandable by developers and models who did not participate in its construction.

Canonical docs state what is true.

Learning docs teach how to understand and use what is true.

Tutorials never override architecture.

Learning material is extracted from accepted implementation:

```text
DESIGN
-> IMPLEMENT
-> TEST
-> RUN
-> AUDIT
-> REPAIR
-> REVALIDATE
-> ACCEPT
-> EXTRACT LESSON
```

Do not teach unaccepted APIs.

Examples should use public APIs and participate in automated validation where practical.

---

## 29. Documentation Law

The initial canonical knowledge system contains 12 project documents.

The maximum intended **core** canonical durable set is 21 as core subsystem specifications are earned.

Earned permanent subsystem specifications under `docs/spec/` sit outside that core maximum. They are permanent and authoritative within their own subsystem, but they are governed by progressive disclosure, implementation-backed authority, and `DOCUMENTATION_MAP.md` routing rather than by the core count.

The ceiling exists for one reason, and that reason is unchanged: an agent must never be required to load the entire engine's documentation to perform one bounded task. Growing the engine must not grow the mandatory reading set. A core document consumes that attention because core documents govern every task. A subsystem specification that is loaded only when its subsystem is under work does not.

Model adapters, ADRs, learning documents, and community/legal files are outside that count.

Do not exceed the core canonical set casually. Before adding another core authority document, ask whether the information belongs in an existing authority, and whether it is genuinely cross-cutting rather than subsystem-scoped.

A permanent subsystem specification is earned by implementation, never by intention. Do not create speculative or placeholder specifications, at root or under `docs/spec/`.

Temporary work orders, audits, handoffs, and conversations are not permanent architecture.

When temporary discovery becomes durable, encode it in code/tests/schemas/permanent docs and remove obsolete scaffolding.

### 29.1 Amendment Record

Amended under §34 by GENERAL-ENGINE-DIRECTION-001.

**Old law:** "The maximum intended canonical durable set is 21 as subsystem specifications are earned."

**New law:** the maximum of 21 applies to the **core** canonical durable set. Earned permanent subsystem specifications under `docs/spec/` are outside that count.

**Reason and evidence:** the accepted product direction expands this repository toward a publicly released general-purpose engine. A repository-grounded audit found roughly a dozen domains that may eventually earn permanent specifications, against three remaining core slots. One global count therefore forced a false choice between an under-documented engine and one that dilutes every agent's context. Splitting the count preserves the ceiling's actual purpose — bounded mandatory reading — more faithfully than the single number did.

**Affected documents:** `DOCUMENTATION_MAP.md` (document classes, authority order, core count semantics, routing) and `ROADMAP.md` (document roadmap).

**Migration implications:** none mechanical. No existing document moves. `GAMEPLAY_FOUNDATION.md`, `GEOMETRY_FORGE.md`, `CHARACTER_FORGE.md`, `MOTION_FORGE.md`, `MATERIAL_FORGE.md` and `WORLD_FORGE.md` are grandfathered at their current root paths and remain equal in subsystem authority to any future `docs/spec/` specification.

**Does accepted behavior become invalid?** No. No law governing implementation changed. No accepted implementation, test, evidence, public behavior or acceptance decision is affected by this amendment.

---

## 30. Agent Independence Law

No model may materially build, audit, verify, and accept its own work as one uninterrupted process.

Roles are separated:

- builder implements;
- validator audits adversarially;
- repair agent fixes accepted findings;
- verifier independently reproduces/validates the exact revision;
- human integration authority accepts project state.

Small low-risk changes do not require theatrical multi-agent ceremony, but material architecture/runtime work requires independent evidence.

---

## 31. Evidence Law

Claims are not proof.

Runtime features require runtime evidence.

Visual features require visual evidence.

Performance claims require measurements.

Determinism claims require repeatability tests.

Lifecycle claims require teardown/recreation evidence.

Public API claims require actual consumer use.

A code review cannot pass a runtime feature by itself.

---

## 32. No Premature Abstraction Law

Do not build infrastructure solely because a mature engine might eventually need it.

Do not prebuild:

- giant ECS rewrites;
- plugin marketplaces;
- visual scripting systems;
- huge-world streaming;
- large worker farms;
- complex cache databases;
- advanced physics/navigation;
- universal import pipelines;
- elaborate shader graphs;
- massive authoring registries;
- pretty motion DSLs.

A real proof must create the need.

When a simple direct implementation satisfies current architecture and leaves a clean seam for extension, prefer it.

---

## 33. Human Integration Authority

Sumo is the human integration authority.

Models advise, build, audit, repair, and verify. They do not own the project.

If evidence supports multiple viable interpretations, report the alternatives and identify what experiment would distinguish them.

If a model is uncertain, it must say so rather than manufacturing authority.

---

## 34. Constitutional Change Procedure

Change this document only when at least one of the following is true:

1. Sumo explicitly changes a product/architecture law;
2. repeated running evidence demonstrates that a law is internally contradictory or prevents the stated product thesis;
3. a previously unresolved foundational decision is now supported strongly enough to become durable law.

A constitutional change must state:

- the old law;
- the proposed new law;
- evidence/reason;
- affected architecture/docs/tests;
- migration implications;
- whether existing accepted behavior becomes invalid.

Do not perform drive-by constitutional edits inside an unrelated implementation work order.

---

## 35. Final Law

The repository is the machine.

Definitions describe what can be made.

Compilers/Kiln produce artifacts.

Runtime systems execute games.

Tests and proofs establish what actually works.

Canonical docs state accepted truth.

Examples demonstrate the public machine.

Learning material teaches it.

Donor repositories may strengthen the machine, but they do not define it.

Build only what evidence earns, and keep every important part reachable enough that a human or AI can understand what the fuck it is doing.
