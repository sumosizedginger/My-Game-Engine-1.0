# My Game Engine 1.0 — Roadmap

## Status

**Document type:** Canonical proof and phase roadmap  
**Authority:** Scheduling and sequencing authority beneath `CONSTITUTION.md`, `PRD.md`, `ARCHITECTURE.md`, and applicable subsystem specifications  
**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

This roadmap defines **what should be proved next and what gates movement between phases**.

It does not provide calendar promises.

It does not claim that future systems already exist.

It does not authorize a builder to work beyond the active bounded work order.

---

## 1. Roadmap Law

My Game Engine 1.0 is developed through running games and falsifiable proofs.

Do not use:

```text
build the entire engine
-> build a game later
```

Use:

```text
DEFINE
-> BUILD
-> TEST
-> RUN
-> CAPTURE when relevant
-> DIAGNOSE
-> AUDIT
-> REPAIR
-> REVALIDATE
-> ACCEPT
-> TEACH when public behavior is stable
```

Then advance to the next bounded proof.

A phase exists to answer a question, not to accumulate features.

---

## 2. Canonical Sequence

The intended proof sequence is:

```text
PHASE 0 — Repository Foundation
        |
        v
A0 — Evaluation Harness
        |
        v
A — Tiny Complete Game
        |
        +----------------------+
        |                      |
        v                      v
B1 — Motion Truth       A regression rerun
        |
        v
B2 — Procedural Combat Room
        |
        v
C — Bounded Procedural World
        |
        v
D — Different Genre
        |
        v
E — Blind API Generality Test
        |
        v
Evidence-driven later systems
```

B1 may proceed partly independently after Phase 0/A0 infrastructure is sufficient, but parallel work must not create two competing foundations.

Proof A is rerun after major proofs so increasing engine complexity cannot silently destroy beginner/game-production ergonomics.

---

## 3. Phase Status Vocabulary

Every phase/proof must use one of these statuses:

```text
NOT STARTED
ACTIVE
BUILT — AWAITING AUDIT
REPAIR REQUIRED
AWAITING REVALIDATION
AWAITING INDEPENDENT VERIFICATION
ACCEPTED
BLOCKED
DEFERRED
```

Do not use vague labels such as:

```text
mostly done
basically finished
should work
```

If the exact accepted revision is unknown, the phase is not safely frozen.

---

# PHASE 0 — REPOSITORY FOUNDATION

## 4. Question

> Can an empty canonical repository become a trustworthy, minimal, buildable foundation without prematurely importing the old engines or pretending future architecture is already implemented?

## 5. Starting State

Canonical repository:

```text
sumosizedginger/My-Game-Engine-1.0
```

Repository premise:

```text
new implementation
+
already-designed architecture
```

Prior repositories are donors/references only.

## 6. Required Outcomes

Phase 0 establishes only the minimum dependable machine required for later proofs:

1. permanent documentation truth;
2. canonical repository identity;
3. Node/package/tooling baseline;
4. Node `24.21.0` pin unless concrete incompatibility is demonstrated;
5. minimal source/test/example/docs structure as actually needed;
6. package scripts with stable build/test/run entry points;
7. unit-test infrastructure;
8. browser/dev-server boot;
9. CI-ready command structure where practical;
10. smallest valid runtime skeleton;
11. initial `engine/runtime` and `engine/full` consumption/export direction;
12. clear diagnostics for bootstrap failure where appropriate;
13. exact repository revision and clean worktree evidence;
14. independent validation before acceptance.

## 7. Required Bootstrap Documentation

Twelve canonical project documents:

```text
README.md
CONSTITUTION.md
PRD.md
ARCHITECTURE.md
CONTEXT.md
ROADMAP.md
AGENTS.md
HANDOFF_PROTOCOL.md
DEPENDENCY_POLICY.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
DOCUMENTATION_MAP.md
```

Two model adapters:

```text
CLAUDE.md
GEMINI.md
```

Model adapters are routing shims, not independent authorities.

## 8. Phase 0 Must Not

Do not:

- implement the full gameplay foundation;
- start building a large engine framework because the repository is empty;
- import My Engine 2 wholesale;
- import original My Engine wholesale;
- create empty Forge directories just to mirror future architecture;
- integrate advanced physics;
- integrate navigation;
- build world streaming;
- build character systems;
- build advanced rendering;
- create speculative learning lessons;
- create a giant plugin architecture;
- begin Proof A unless the accepted Phase 0 handoff explicitly moves the baton.

## 9. Phase 0 Gate

Phase 0 can be accepted only when:

```text
fresh install works
build command works
test command works
browser/dev command boots the minimal runtime
runtime/full package direction is represented without fake subsystem code
canonical docs agree on repository identity and current status
no stale "convert My Engine 2" language remains
no donor code has entered without explicit authorization/provenance
exact revision is recorded
worktree state is known
independent validation reports no blocking findings
```

## 10. Learning Impact

Normally:

```text
LEARNING IMPACT: NONE
```

Phase 0 may create the `docs/learn/` location if useful, but it should not manufacture curriculum for systems that do not yet exist.

---

# A0 — EVALUATION HARNESS

## 11. Question

> Before we trust increasingly complex engine work, can we observe and reproduce what the runtime actually did?

A0 is not a game-feature phase.

It establishes evidence infrastructure.

## 12. Candidate Scope

Build or prove the minimum useful evaluation stack for upcoming work:

- deterministic or controlled browser captures;
- browser automation;
- stable capture scenes/views where applicable;
- diagnostic query/reporting;
- runtime telemetry needed by near-term proofs;
- exact revision reporting in generated evidence;
- comparison tooling appropriate to deterministic visual/runtime checks;
- lifecycle/leak checks when relevant.

Do not build a general observability platform.

Every piece of A0 infrastructure must answer a concrete later-proof validation need.

## 13. A0 Acceptance Questions

An independent verifier should be able to answer:

```text
Which revision produced this result?
Can the runtime be started repeatably?
Can the proof state be reached repeatably?
Can relevant diagnostics be queried?
Can a visual/runtime result be captured repeatably enough to compare?
Can failures be distinguished from harness failure?
```

## 14. A0 Gate

A0 is accepted when the evaluation harness is itself tested and independently demonstrated on the exact candidate revision.

A harness that only claims it can test future work is not enough.

---

# PROOF A — TINY COMPLETE GAME

## 15. Question

> Can My Game Engine 1.0 build, run, and export a complete tiny browser game without bypassing its own architecture?

Use a Pong/Lunar-Lander-scale game or another equivalently small proof selected by the active work order.

The point is not originality.

The point is to traverse the entire game-production spine cheaply.

## 16. Required Capabilities

Proof A should pull only enough implementation to demonstrate:

- entity identity;
- transform ownership;
- fixed-step gameplay;
- action-based input;
- keyboard and controller binding path;
- movement;
- simple collision;
- runtime variable;
- state primitive;
- event or rule wiring;
- project script path if the proof requires it;
- DOM game UI;
- minimal scene/game boot;
- tiny Kiln compile/artifact/instantiate seam;
- static build/export;
- normal URL/static-host execution;
- structured enough diagnostics to identify meaningful failures.

Save/load is not required unless the chosen tiny game genuinely needs meaningful persistence.

## 17. Proof A Architecture Pressure

Proof A is where `GAMEPLAY_FOUNDATION.md` becomes justified.

That subsystem specification should define only architecture actually needed or strongly evidenced by the proof, while preserving already-approved durable laws.

Do not turn Proof A into implementation of every possible capability, rule action, state-machine feature, save system, physics system, or input device.

## 18. Proof A Measurements

Record evidence such as:

- game source file count;
- game LOC or similarly useful complexity measure;
- boilerplate required to create entities/game state;
- boot path;
- build/export command count;
- diagnostics at startup and during play;
- keyboard path;
- controller path;
- static-host behavior;
- runtime failures;
- performance measurements appropriate to the tiny proof.

The purpose is to establish an ergonomics baseline.

## 19. Proof A Gate

Proof A is accepted only when:

```text
game builds
game boots from supported browser/dev path
game plays through its core loop
action input works
controller path is tested where required
collision/movement behave according to proof
game state/UI update correctly
static export runs from an ordinary static URL/host
required tests pass
runtime diagnostics contain no unexplained fatal failures
architecture audit finds no blockers
exact revision is independently verified
```

## 20. Learning Extraction After A

Only after Proof A acceptance, perform a bounded learning extraction.

Expected first candidates:

```text
docs/learn/README.md
docs/learn/01-getting-started.md
docs/learn/02-first-game.md
examples/pong/  (or selected Proof A example)
```

Exact lesson boundaries follow the accepted implementation rather than being fixed in advance.

Important example/tutorial code should participate in CI or browser validation where practical.

---

# PROOF A REGRESSION RULE

## 21. Keep the Tiny Game Alive

After each major accepted proof, rerun Proof A or its canonical regression equivalent.

Ask:

```text
Did the game still build?
Did the public API become harder to use?
Did bundle/runtime requirements inflate unnecessarily?
Did engine/full leak into runtime-only exports?
Did new architecture force genre-specific concepts into the tiny game?
Did diagnostics or boot behavior regress?
```

If the simple game gets materially harder to build as the engine grows, treat that as architecture pressure, not harmless complexity.

---

# PROOF B1 — MOTION TRUTH

## 22. Question

> Can the code-native procedural character pipeline produce motion that reads as a living intentional character rather than a rigid procedural mannequin?

B1 is an explicit research proof.

Do not hide poor motion behind combat, elaborate environments, expensive post-processing, or camera tricks.

## 23. Candidate Inputs

The first task is to inspect donor character/geometry systems rather than assuming they should be copied.

High-value donor evidence may include:

- canonical humanoid work;
- Geometry Kernel;
- Skeleton Forge;
- geometry validation;
- parameter sweeps;
- accepted visual tests.

Each donor candidate receives:

```text
PORT
ADAPT
REFERENCE
DROP
```

with provenance.

## 24. Minimum B1 Scope

Add only enough accepted implementation to test:

- a procedural humanoid definition;
- topology/geometry suitable for the test;
- semantic landmarks;
- skeleton generation;
- procedural skin weights;
- one parameterized walk or locomotion motion;
- grounding;
- minimal IK where required;
- root-motion/movement-intent path if used;
- deterministic/controlled capture tour;
- deformation and motion diagnostics.

## 25. Documents Earned at B1

Likely canonical subsystem documents:

```text
CHARACTER_FORGE.md
MOTION_FORGE.md
```

Create/rewrite them when B1 begins, based on accepted architecture and inspected implementation evidence.

Do not write them months earlier as speculative encyclopedias.

## 26. B1 Failure Is Allowed

Before visual evaluation, define failure criteria.

If the character remains clearly mannequin-like after technically correct geometry, skinning, and motion:

- report it;
- preserve the evidence;
- determine which layer failed;
- narrow the research thesis if necessary.

Do not redefine "good" after seeing the result.

A failed hero-character thesis does not invalidate the engine's gameplay, geometry, world, materials, audio, FX, or stylized-character value.

## 27. B1 Gate

Technical correctness and visual truth are separate requirements.

Acceptance requires both:

- runtime/test correctness for the implemented subsystem;
- explicit visual/motion evaluation against predefined criteria.

A builder saying "animation plays" is not evidence that the motion succeeds aesthetically.

---

# PROOF B2 — PROCEDURAL COMBAT ROOM

## 28. Question

> Can generated geometry, generated character, generated motion, generated appearance, and gameplay combine into something that reads as an actual game rather than disconnected technical demos?

## 29. Candidate Scope

Use a small bounded room/arena.

Pull only enough implementation for:

- procedural room geometry;
- meaningful geometry semantics;
- Material Forge minimum;
- accepted B1 character/motion foundation;
- collision;
- combat/gameplay scripting;
- basic audio/FX where they materially improve proof quality;
- deterministic capture/evaluation;
- runtime diagnostics.

Direct procedural construction should be preferred when it is simpler than exact CSG.

Do not integrate Manifold merely to claim CSG support.

## 30. Documents Earned at B2

Likely:

```text
GEOMETRY_FORGE.md   (if not already earned earlier)
MATERIAL_FORGE.md
```

An audio specification is created only if the subsystem has become substantial enough to deserve permanent independent authority. Since §48.2 it belongs at `docs/spec/audio.md` rather than at a reserved root slot.

## 31. B2 Gate

The proof should demonstrate a coherent playable combat loop using the new public engine systems, not a pile of engine-internal test hooks.

Validation must cover both technical correctness and visual/game-feel failure criteria appropriate to the proof.

---

# PROOF C — BOUNDED PROCEDURAL WORLD

## 32. Question

> Can the engine generate a bounded world whose terrain, ecology, materials, queries, collision, and traversal agree on the same deterministic world truth?

Do **not** turn this into huge-world streaming research.

## 33. Candidate Scope

Build only enough for a bounded forest/world proof:

- `WorldRecipe` direction;
- `WorldFieldCache` direction;
- bounded terrain generation;
- environmental fields;
- two or three biomes only if useful to the proof;
- procedural vegetation/trees;
- ground cover where useful;
- Material Forge integration;
- `WorldFieldQuery`;
- `WorldVolumeQuery` or the minimum authoritative volume-query implementation required by traversal/collision;
- deterministic seeds;
- character grounding;
- traversal/gameplay collision;
- diagnostics and captures.

## 34. Multiple-Consumer Requirement

Do not create abstract world-query interfaces used by only one contrived caller.

World-query contracts should earn their abstraction through multiple real consumers, for example:

```text
vegetation placement
character grounding
gameplay collision/query
```

## 35. Document Earned at C

```text
WORLD_FORGE.md
```

Potential performance documentation may also become justified if real profiling work begins.

## 36. C Gate

The accepted proof must establish deterministic bounded-world behavior, meaningful traversal, and agreement between generated visual world and gameplay/world queries.

Large-world streaming remains deferred until bounded-world evidence creates a real requirement.

---

# PROOF D — DIFFERENT GENRE

## 37. Question

> Does the engine remain genuinely general when a mechanically different game applies pressure to it?

Candidate proofs include:

- Voxel Shooter;
- racing;
- another bounded genre with substantially different mechanics.

The exact game is chosen when D begins.

## 38. What D Is Allowed to Add

A different genre may add:

- project scripts;
- rules;
- prefabs;
- definitions;
- new capabilities justified by privileged engine access;
- narrow reusable engine improvements supported by cross-game evidence.

## 39. What D Should Not Rewrite Without Failure Evidence

The different genre should not casually require foundational rewrites of:

- entity identity;
- fixed simulation;
- event dispatch fundamentals;
- transform ownership;
- state primitive;
- save model when already accepted;
- project/runtime separation.

If it does, inspect the literal requirement and diff.

A rewrite may be justified if the existing foundation genuinely failed. It is not forbidden to learn; it is forbidden to rewrite foundations because a new builder prefers a different pattern.

## 40. Engine-Promotion Test

When D discovers a missing behavior, ask:

```text
Can project code solve it cleanly?
  yes -> keep it project-level

Does it require privileged engine access?
  no -> keep it project-level

Has unrelated game evidence shown this is reusable engine substrate?
  no -> do not promote yet

Otherwise
  -> capability candidate
```

## 41. Learning Extraction After D

D should eventually support an advanced lesson around:

> How do I build something the engine did not anticipate without stuffing genre mechanics into the core?

Write that lesson only after D is accepted.

---

# PROOF E — BLIND API GENERALITY TEST

## 42. Question

> Can a fresh user build a game using the public engine without internal architecture knowledge or privileged handholding?

E is an ergonomics and generality attack.

## 43. Blind Test Inputs

A fresh participant receives only material an actual new developer should receive, such as:

- public package/API;
- public API documentation;
- documented install/build/run instructions;
- accepted learning material where appropriate.

Do not give them hidden architecture reasoning or old implementation transcripts.

Ideally test with both:

1. a fresh AI agent;
2. a human developer.

They reveal different failures.

## 44. Failure Classification

When the fresh user fails, determine whether the root cause is:

```text
API defect
documentation defect
tooling defect
diagnostics defect
missing public capability
unreasonable task assumption
```

Do not automatically "fix documentation" to explain a terrible API.

If the API is the real problem, repair the API and update lessons afterward.

## 45. E Gate

Strong evidence of generality exists when a fresh user can build an unplanned game without:

- rewriting the engine core;
- using private module paths;
- relying on hidden state;
- bypassing transform/identity/lifecycle contracts;
- receiving undocumented setup instructions.

Proof E is not a claim that the engine supports every genre. It tests whether the public architecture is coherent and extensible.

---

# LATER SYSTEMS — EVIDENCE-DRIVEN ONLY

## 46. No Sacred Giant Feature Checklist

After E, or earlier only when a current proof concretely requires them, consider systems such as:

- larger-world streaming;
- advanced physics/Rapier;
- navigation/Recast;
- larger vegetation/residency systems;
- advanced AI;
- structure generation;
- expanded audio;
- larger FX systems;
- renderer upgrades;
- Studio integration expansion;
- richer save/replay tooling;
- compatibility import/export.

Each must enter through a bounded requirement and its own evidence.

That rule is unchanged and is the reason the sections below are ordered rather than listed. GENERAL-ENGINE-DIRECTION-001 recorded an expanded product target in `PRD.md` Part II. It did not convert this roadmap into a feature checklist, and future tranches must not either.

---

## 46.1 Performance: measure before optimizing

**Nothing here is authorized. This section records sequencing, not permission.**

The CINDER MK-I benchmark established a measured fact:

```text
227 semantic authoring parts -> 227 render groups -> 227 measured draw calls
```

`src/render/mesh-adapter.js` emits one render group per MeshIR part, so semantic authoring granularity currently determines render-submission granularity. `ARCHITECTURE.md` §48 records why those are different identities that should be separable.

**What this establishes:** a demonstrated scaling pressure, and a coupling that architecture says should not be automatic.

**What this does NOT establish:** that draw calls are the dominant runtime performance cost. No profiling has been performed. The frame-time contribution of render submission in this engine is unmeasured.

Documentation and work orders must therefore not claim that render batching is the proven next bottleneck. The correct sequence is:

```text
PERFORMANCE-BASELINE-001
        |
        v
    measurement
        |
        v
determine whether KILN-RENDER-001 or some other optimization
is actually justified by the evidence
```

A baseline would plausibly measure CPU frame time, render time where observable, draw-call scaling, part-count scaling, triangle scaling, multiple-instance scaling, resource counts, and browser or GPU behavior. Budgets are not invented before a baseline exists (§24 of `DOCUMENTATION_MAP.md`, and `CONSTITUTION.md` §31).

If measurement shows render submission is not the dominant cost, KILN-RENDER-001 is not the next work, and that outcome is a success of this sequencing rather than a disappointment.

Kiln remains the architecturally correct home for any future decoupling: `CONSTITUTION.md` §4 and `ARCHITECTURE.md` §6 already make compiling rich authoring state into cheap runtime state its stated purpose. Whenever that work happens, source semantics must survive compilation (`ARCHITECTURE.md` §48.3).

---

## 46.2 Scene and composition

**Not authorized. Recorded because it is the largest identified structural gap.**

There is no general engine-owned scene or composition model. Each proof assembles its own renderer scene, which was correct for bounded proofs and is insufficient for a general-purpose engine.

`ARCHITECTURE.md` §43 records the boundaries. Seven accepted future requirements sit on top of it: prefabs and instancing, save and persistence, story and quest references to world objects, Studio inspection, streaming, networking, and MMO persistence.

It therefore sits early in any general-engine sequence. It must not be designed before a forcing consumer exists: a constructed playable environment is the natural first consumer, and a renderer demonstration is not.

---

## 46.3 Public surface reconciliation

**Not authorized. Recorded as a scheduling defect against the public-release target.**

Accepted implemented capability — including Character Forge, Motion Forge and World Forge — is not generally reachable through the supported public `engine/full` surface. `src/full/index.js` states this deliberately; what was never revisited is whether that choice still holds now that public release is a product requirement.

`PRD.md` §39 states the rule and `ARCHITECTURE.md` §49 states the constraints. A deep import is not a public API, and not everything internal should become public. Reconciliation needs its own bounded tranche.

---

## 46.4 Accessibility and localization

**Not authorized. Recorded because it was missing from implementation and documentation alike.**

`PRD.md` §38 makes this a public-product requirement. The near-term obligation is compatibility rather than implementation: public APIs added now should not foreclose control remapping, subtitles, text scaling, colour modes or locale switching.

No accessibility subsystem has earned a specification, and none should be created.

---

## 46.5 Retiring the completed asset-foundation work order

**Not authorized in a documentation-only tranche.**

`Next step.md` is a completed temporary work order, reclassified as historical by GENERAL-ENGINE-DIRECTION-001. It cannot yet be archived to `docs/archive/` because eleven source files and one test file cite its path for specific numbered Decisions — for example `src/render/mesh-adapter.js` (Decision 6), `src/preview/manifest.js` (Decision 2), `src/geometry/mesh-ops.js` (the topology law in section 5).

Retiring it requires a tranche authorized to edit those source headers, which must either relocate the reasoning into the relevant permanent specifications or repoint the citations. `CONSTITUTION.md` §29 requires that durable content move into permanent documents and obsolete scaffolding be removed, so this is a real obligation rather than housekeeping.

Section 13 of that file also recorded six documentation reconciliation items. Their status after this tranche:

| Item | Status |
| --- | --- |
| AI-native laws reconciled into `CONSTITUTION.md` and `PRD.md` | **Partly closed.** §29 amended; `PRD.md` Part II added. A full reconciliation of section 1.4 was not attempted. |
| `README.md` describes `/full` and Forge reachability accurately | **Closed** by this tranche. |
| WebGPU preference versus universal `WebGLRenderer` use (finding 3.12) | **OPEN.** Needs a rendering tranche, not a documentation edit. |
| `GEOMETRY_FORGE.md` should record the topology law and authoring-versus-render geometry separation | **OPEN.** |
| `CHARACTER_FORGE.md` and `MATERIAL_FORGE.md` should record finding 3.7 | **OPEN.** |
| Finding 3.6, silent merge drop, recorded as a known defect with an owner | **OPEN.** |

---

# DOCUMENT ROADMAP

## 47. Bootstrap Canonical Set

Phase 0 begins with twelve canonical documents.

The canonical set may grow as real subsystems earn independent durable specifications.

Intended maximum without explicit human approval:

```text
21 CORE canonical project documents
```

Amended by `CONSTITUTION.md` §29.1: the ceiling counts **core** documents. Earned permanent subsystem specifications under `docs/spec/` sit outside it. See §48.

## 48. Earned Subsystem Documents

`CONSTITUTION.md` §29 was amended by GENERAL-ENGINE-DIRECTION-001. The ceiling of 21 now applies to the **core** canonical set. Earned permanent subsystem specifications under `docs/spec/` sit outside that count.

### 48.1 Core subsystem specifications — earned and grandfathered

```text
13 GAMEPLAY_FOUNDATION.md   (Proof A)
14 GEOMETRY_FORGE.md        (Proof B2)
15 CHARACTER_FORGE.md       (Proof B1)
16 MOTION_FORGE.md          (Proof B1)
17 MATERIAL_FORGE.md        (Proof B2)
18 WORLD_FORGE.md           (Proof C)
```

These remain at repository root. They are not moved: relocating them would churn cross-references across `DOCUMENTATION_MAP.md`, the learning documents and source file headers for no routing benefit.

### 48.2 Reserved core slots

```text
19 PERFORMANCE_AND_PROFILING.md      reserved, not created
20 VISUAL_TARGETS_AND_BENCHMARKS.md  reserved, not created
21 (intentionally unallocated)
```

Both reserved documents stay at core level because each is cross-cutting policy read by every tranche touching performance or appearance, rather than one subsystem's behavior. Neither may be created before implementation evidence earns it. The unallocated slot is deliberate flexibility.

`AUDIO_AND_FX.md` is no longer a reserved root slot. Audio is subsystem-scoped, so when audio implementation earns a specification it belongs at `docs/spec/audio.md`.

### 48.3 Future earned specifications

```text
docs/spec/<domain>.md
```

Outside the core count, created only after real accepted implementation makes one useful. See `DOCUMENTATION_MAP.md` §4.3.

Do not pre-create any of them as empty shells. Do not create `docs/spec/` itself until its first earned document exists.

## 49. Learning Documents

Learning material is separate from the canonical-document ceiling.

Workflow:

```text
accepted public behavior
-> learning-impact check
-> bounded learning extraction
-> fresh-reader verification
-> accepted lesson/example
```

Do not set an arbitrary maximum learning-document count.

Do reject tiny fragmented lessons that do not teach a meaningful concept.

## 50. ADRs

Architecture Decision Records are created only for significant decisions whose context and consequences are worth preserving.

They are not progress trophies.

A decision that is already obvious from the Constitution or Architecture and needs no historical rationale does not require an ADR merely for ceremony.

---

# DONOR INTAKE ROADMAP

## 51. Donor Code Enters Only When Pulled

Do not perform a giant donor-inventory implementation pass before proofs begin.

When a proof needs candidate donor technology:

1. identify exact need;
2. inspect the exact donor repository/revision;
3. identify candidate files/tests;
4. classify `PORT / ADAPT / REFERENCE / DROP`;
5. verify license/provenance;
6. compare with clean implementation cost;
7. define bounded intake work order;
8. port/adapt only authorized scope;
9. preserve or rewrite durable tests;
10. independently audit the result.

## 52. Provenance Requirement

For ported or substantially adapted code, preserve at least:

```text
source repository
source path
source commit SHA
license
classification: PORT or ADAPT
what was reused
material changes
reason for adoption
associated tests/checks
```

The exact durable storage mechanism may be chosen during implementation under `DEPENDENCY_POLICY.md`.

Do not allow provenance to exist only in chat history.

---

# REGRESSION AND FREEZE POLICY

## 53. What "Freeze" Means

A frozen phase means:

- exact accepted revision known;
- required checks pass;
- relevant runtime proof exists;
- independent validation has no unresolved blocker;
- canonical docs do not lie about the accepted state;
- known limitations are explicit.

Freeze does not mean "never change this code again."

Later evidence may require change.

When it does, reopen the relevant invariant deliberately and rerun affected proofs.

## 54. Regression Matrix

As the engine grows, each accepted proof becomes a regression target.

Conceptually:

```text
After A   -> rerun A
After B1  -> rerun B1 + A
After B2  -> rerun B2 + B1-relevant checks + A
After C   -> rerun C + affected earlier proofs + A
After D   -> rerun D + affected earlier proofs + A
After E   -> rerun E-relevant API checks + affected proof suite
```

Do not blindly rerun every expensive visual test for every typo. `TESTING_AND_VALIDATION.md` defines proportional validation.

---

# PARALLELISM RULES

## 55. Parallel Work Is Conditional

Parallel work is useful only when ownership and foundations are independent enough to avoid merge-by-architecture-war.

Potential example:

B1 character/motion research can progress partly independently once Phase 0/A0 gives it required geometry/render/capture foundations.

Bad parallelism:

- two agents independently designing entity identity;
- two agents both establishing package layout;
- one agent replacing renderer ownership while another builds against the old renderer;
- a world team creating its own transform/physics truth;
- a tutorial writer documenting APIs still being redesigned.

When two tasks touch the same architecture seam, serialize them unless an explicit integration plan exists.

---

# DEFERRED WORK REGISTER

## 56. Explicitly Not Current Roadmap Work

Unless a proof creates concrete evidence otherwise, defer:

### Rendering

- GI;
- volumetrics;
- TAA;
- clustered lighting;
- major shadow research.

### World

- huge-world streaming;
- massive residency frameworks;
- sculpt-editor stable editable vertex identity.

### Characters

- high-end face generation;
- facial performance;
- cloth simulation;
- realistic dynamic hair.

### Physics

- advanced rigid-body library integration before a proof requires it.

### Navigation

- navmesh stack before pathfinding is required.

### Architecture/Product

- ECS rewrite;
- plugin marketplace;
- visual scripting;
- proprietary general-purpose scripting language;
- GLTF/FBX-first native production pipeline;
- universal asset import/export ecosystem;
- runtime editor undo architecture unless Studio/runtime evidence requires it.

### Platform

- multiplayer/networking;
- mobile-first architecture;
- native wrappers.

### Motion

- pretty text DSL before Motion IR has proven semantics.

Deferred items remain visible so future agents do not repeatedly "rediscover" them as urgent opportunities.

## 56.1 Reclassification by the general-engine product decision

GENERAL-ENGINE-DIRECTION-001 changed the **long-term** status of several entries above. The list itself was not wrong, and this is not a correction of it. Most entries were already conditioned on sequence, and those conditions were the right call.

The new status is:

```text
LONG-TERM PRODUCT REQUIREMENT
NOT YET EARNED
PROOF-GATED
```

That means the finished product must eventually do it, no implementation exists, and a real forcing consumer must still earn it. It is not an authorization, and it does not move anything out of the deferred list for present work.

| Entry | New long-term status |
| --- | --- |
| multiplayer/networking | Long-term product requirement (`PRD.md` §37.3). Boundary in `ARCHITECTURE.md` §47. Deferred for implementation. |
| huge-world streaming | Long-term product requirement (`PRD.md` §37.1). Boundary in `ARCHITECTURE.md` §46. Deferred for implementation. |
| GLTF/FBX-first native production pipeline | **Unchanged and still deferred permanently.** Foreign formats never become the native pipeline. Import *interoperability* is separate and is now required (`PRD.md` §36, `ARCHITECTURE.md` §44). |
| universal asset import/export ecosystem | A universal ecosystem stays deferred. Bounded import adapters are long-term requirements. |
| visual scripting | Now required for three specific domains — animation state logic, story/quest/dialogue, timelines (`PRD.md` §35, `ARCHITECTURE.md` §45). General-purpose visual programming stays deferred permanently. |
| mobile-first architecture, native wrappers | **Unchanged.** Browser remains first-class. Additional targets are earned by evidence. |
| proprietary general-purpose scripting language | **Unchanged and permanent.** Standard JavaScript remains the substrate. |
| ECS rewrite, plugin marketplace | **Unchanged.** Still deferred. |
| GI, volumetrics, TAA, clustered lighting, shadow research | **Unchanged.** Still deferred. |
| advanced physics, navmesh stack | **Unchanged.** Still deferred. |
| high-end face generation, facial performance, cloth, dynamic hair | **Unchanged.** Still deferred. |
| sculpt-editor stable editable vertex identity, editor undo architecture | **Unchanged.** Still deferred. |
| Motion DSL before Motion IR proves semantics | **Unchanged.** Still deferred. |

Two additions to the deferred register, neither previously recorded:

| Addition | Status |
| --- | --- |
| accessibility and localization systems | Long-term product requirement (`PRD.md` §38). No implementation. No specification earned. |
| general scene and composition model | Long-term requirement and the largest identified structural gap (`ARCHITECTURE.md` §43, §46.2 above). Needs a forcing consumer. |

---

# ROADMAP CHANGE CONTROL

## 57. Evidence Can Change the Roadmap

The proof sequence is strong guidance, not a religious ritual.

Change it when evidence shows the sequence no longer minimizes risk.

A roadmap change should identify:

```text
what evidence changed
which assumption failed
what new order is proposed
which accepted work is affected
which documents/tests must change
whether an ADR is justified
```

Do not reorder work merely because a builder finds another subsystem more interesting.

## 58. Human Authority

The human project owner may explicitly change scope, sequence, product direction, or priority.

When that happens:

1. identify which canonical documents are affected;
2. update those documents coherently;
3. do not leave contradictory old authority active;
4. preserve significant decision rationale in an ADR when useful;
5. adjust tests/proofs accordingly.

---

# ORCHESTRATOR CHECKPOINT AFTER EVERY MATERIAL RESULT

## 59. Required Questions

After a builder, validator, repair agent, or verifier returns, the orchestrator asks:

```text
What did this actually prove?
What did it only claim?
What exact revision/state was tested?
Did implementation exceed the active phase?
Did architecture drift?
Did donor code enter, and is provenance complete?
Did public behavior change?
Did an existing proof regress?
What remains unresolved?
Does learning material now need an update?
Which role should receive the baton next?
```

A builder completion report normally advances to independent validation, not acceptance.

---

# LEARNING IMPACT CHECK

## 60. After Accepted Public Work

For every major accepted proof/subsystem, record one of:

```text
LEARNING IMPACT: NONE

UPDATE EXISTING LESSON:
<lesson path>

NEW LESSON JUSTIFIED:
<concept>

NEW EXAMPLE JUSTIFIED:
<example>
```

Learning extraction happens after accepted reality exists.

It does not block urgent repairs and does not pre-author future APIs.

---

# CURRENT EXECUTION TARGET

## 61. Phase Status Ledger and Current Target

This section was stale until GENERAL-ENGINE-DIRECTION-001 repaired it. It previously still named Phase 0 as the first implementation target, long after Proofs A through E and the AI-native asset foundation had been accepted. A fresh agent reading it would have been actively misdirected.

**Whoever moves the baton next updates this section in the same tranche.** A roadmap that does not know where the project is provides no sequencing authority at all.

### 61.1 Accepted phases

Statuses use the vocabulary in §3. Each is supported by an accepted base revision, not by inference.

| Phase | Status | Accepted revision | Evidence |
| --- | --- | --- | --- |
| Phase 0 — Repository Foundation | **ACCEPTED** | superseded by later accepted work | repository exists, toolchain pinned, `engine/runtime` and `engine/full` split live |
| A0 — Evaluation Harness | **ACCEPTED** | superseded by later accepted work | `npm run eval`, `artifacts/evaluation-report.json`, `src/eval/*` |
| Proof A — Tiny Complete Game | **ACCEPTED** | `2c73c29450ed2412638a334bd90fb8919c1220a0` | `docs/learn/BUILDING_A_TINY_GAME.md`; evaluator checks `pongBoot`, `pongGameplay`, `pongScoring` |
| Proof B1 — Motion Truth | **ACCEPTED** | `52eb3b3c91d725e9a73ebb1ea658b393a12029b4` | `docs/learn/BUILDING_A_WALKING_CHARACTER.md`; `b1*` evaluator checks |
| Proof B2 — Procedural Combat Room | **ACCEPTED** | `3990f55858cab8c4e574f9f29ddb954e70919c77` | `docs/learn/BUILDING_A_PROCEDURAL_COMBAT_ROOM.md`; `b2*` evaluator checks |
| Proof C — Bounded Procedural World | **ACCEPTED** | `e8fa4f698be684599f3839fec46ac3456b448698` | `docs/learn/BUILDING_A_BOUNDED_PROCEDURAL_WORLD.md`; `c*` evaluator checks |
| Proof D — Different Genre | **ACCEPTED** | `5fb46b9a3da1a6896530afec86cd205d616e832f` | `docs/learn/BUILDING_A_DIFFERENT_GENRE.md`; `d*` evaluator checks |
| Proof E — Blind API Generality | **ACCEPTED** | `c62975dbf68c2305e38c00b9cdc1ed5707777d4a` | `docs/learn/BUILDING_AN_UNPLANNED_GAME.md` |
| AI-ASSET-FOUNDATION-001 | **ACCEPTED** | `798bd89c006f20f0b9a9f20b05443b6493436d14` | merged as `07e555af55f5ee61f8fbef7fbd2da90d6d782419` after independent verification |

Acceptance evidence for the six proofs is the accepted learning material in `docs/learn/`, which §28 of `DOCUMENTATION_MAP.md` permits only after a proof is accepted, together with the base revision each lesson names.

### 61.2 AI-ASSET-FOUNDATION-001

Accepted and merged. It delivered engine-owned MeshIR with a canonical byte codec, the initial modeling verbs, generic semantic anchors and parts, the Previewable contract, the Preview Lab, the canonical view solver, `AssetPreviewManifest` with portable structural identity, deterministic canonical capture, and the CINDER MK-I capability benchmark.

Independent verification at the accepted revision reproduced: Node v24.21.0, 429 tests passing, 43 evaluator checks passing, production build passing, 612,624 MeshIR bytes identical between Node and browser, portable structural identity across multiple viewport and aspect sizes, asset-relative canonical front and back views, deterministic camera-relative inspection lighting, correct lifecycle, and two six-view captures with zero differing pixels.

### 61.3 Current target

```text
GENERAL-ENGINE-DIRECTION-001
  documentation and product-direction reconciliation
  no implementation
```

That is this tranche. It updates permanent product and architecture documentation so that future implementation can be designed toward the general-engine target without abandoning proof-driven discipline.

### 61.4 What is NOT authorized

No implementation tranche is currently authorized. In particular, none of the following may begin without its own bounded work order and human authorization:

```text
PERFORMANCE-BASELINE-001        see 46.1
KILN-RENDER-001                 see 46.1 - requires the baseline first
SCENE / COMPOSITION FOUNDATION  see 46.2
public surface reconciliation   see 46.3
```

The baton still moves only after evidence and independent validation justify it.

---

# 62. Final Roadmap Rule

Build the smallest thing that can answer the current architectural question.

Make it run.

Make failure visible.

Attack the result.

Repair what the evidence actually broke.

Freeze the exact accepted state.

Teach what survived.

Then ask the next harder question.
