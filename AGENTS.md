# AGENTS.md

## Purpose

This file is the short operational map for coding, auditing, repair, and verification agents working on **My Game Engine 1.0**.

Canonical repository:

`sumosizedginger/My-Game-Engine-1.0`

This repository is a **greenfield implementation** of an already-designed architecture.

Do not treat `my-engine-2`, original `My-Engine`, My Engine Studio, or any donor/reference repository as the canonical implementation.

If a donor disagrees with current canonical documentation, the donor loses unless the human explicitly changes the architecture.

---

## Read Order

Before changing production code, read only the documents relevant to the task.

Always read:

1. `CONSTITUTION.md`
2. `PRD.md`
3. `ARCHITECTURE.md`
4. `DOCUMENTATION_MAP.md`
5. this file

Then use `DOCUMENTATION_MAP.md` to load only the task-specific permanent documents required for the active work.

Also read, when applicable:

- `DEPENDENCY_POLICY.md`
- `DEFINITION_OF_DONE.md`
- `TESTING_AND_VALIDATION.md`
- relevant subsystem specification
- relevant ADRs
- current work order

Do not load every document by default.

---

## Authority Order

If instructions conflict, use this order:

1. active explicit human instruction;
2. `CONSTITUTION.md`;
3. `PRD.md`;
4. `ARCHITECTURE.md`;
5. relevant permanent subsystem specification;
6. `DEPENDENCY_POLICY.md`;
7. `DEFINITION_OF_DONE.md` and `TESTING_AND_VALIDATION.md`;
8. accepted running evidence;
9. `ROADMAP.md`;
10. `CONTEXT.md`;
11. temporary work orders, audits, and handoffs.

If permanent documentation and accepted implementation disagree:

**STOP AND REPORT THE CONFLICT.**

Do not silently choose one.
Do not rewrite permanent law merely to justify existing code.

---

## Current Repository Truth

The canonical implementation is:

`sumosizedginger/My-Game-Engine-1.0`

It begins as a clean repository.

Earlier repositories are donors and references only.

Potential donors include:

- `sumosizedginger/my-engine-2`;
- original `sumosizedginger/My-Engine`;
- My Engine Studio;
- Super Terrain;
- Sylva / realistic-forest;
- OpenSmash;
- other explicitly approved libraries or references.

Donor code must be classified before adoption:

```text
PORT
ADAPT
REFERENCE
DROP
```

No wholesale donor merge is permitted.

---

## Core Product Law

Native engine artifacts should remain reachable through code.

A native artifact should be:

- constructible through code;
- inspectable through code;
- modifiable through code;
- serializable through code;
- reproducible from definitions, parameters, and seeds;
- testable;
- attributable to the definition that produced it.

Definitions are source.
Compiled artifacts are products of compilation/cache.
Runtime objects are transient.

---

## Approved Architecture Does Not Mean Implemented Architecture

The documentation contains systems that are architecturally approved but may not exist yet.

Examples include:

- Kiln;
- Geometry Forge;
- Character Forge;
- Motion Forge;
- Material Forge;
- World Forge;
- `engine/runtime`;
- `engine/full`.

Before referencing a system in code, verify that the implementation actually exists in the current repository.

Never infer implementation from roadmap text.

---

## Development Law

Meaningful work follows:

```text
DEFINE
→ BUILD
→ TEST
→ RUN
→ CAPTURE
→ DIAGNOSE
→ AUDIT
→ REPAIR
→ REVALIDATE
→ FREEZE
```

Not every small edit requires every step.

Architectural, runtime, visual, deterministic, lifecycle, dependency, or export work requires evidence appropriate to the risk.

A builder does not self-accept material work.

---

## Role Separation

### Builder

May change production code within the assigned work order.

Must:

- inspect current repository state;
- read assigned permanent docs;
- stay within scope;
- run required tests/checks;
- produce runtime evidence when applicable;
- report exact files changed;
- report exact revision/worktree state.

Builder does not certify final acceptance.

### Validator

Audits a specific revision.

Normally does not modify production code.

Classifies findings:

```text
BLOCKING
IMPORTANT
NON-BLOCKING
OPTIONAL
```

Audits:

- correctness;
- architecture;
- determinism;
- lifecycle;
- tests;
- runtime behavior;
- evidence quality;
- dependencies;
- shortcuts;
- scope drift.

### Repair Agent

Repairs accepted findings only.
Must not smuggle in adjacent features.
After material repair, stop for re-audit.

### Verifier

Independently verifies the exact audited revision.
Prefer a clean checkout/worktree.
Runs the documented proof.
Does not redesign or repair unless explicitly authorized.

---

## Non-Negotiable Separation Rule

No model may perform:

```text
BUILD
+
AUDIT
+
VERIFY
+
ACCEPT
```

as one uninterrupted self-certification process.

Implementation is not acceptance.

---

## Greenfield Rule

This repository is not a conversion of My Engine 2.

Do not:

- preserve old repository structure for historical reasons;
- import old architecture by default;
- copy large donor trees wholesale;
- treat prior tests as canonical baseline tests;
- describe new work as migration from Visual Lab;
- create fake subsystem directories before implementation needs them.

The new repo owns its own history.

---

## Donor Provenance Rule

Whenever code is ported or materially adapted from a donor, record:

- source repository;
- source path;
- source commit SHA;
- source license;
- what was copied or adapted;
- why it was selected;
- material changes;
- associated tests.

If provenance is unknown, do not present copied code as native original work.

Use an ADR or other approved permanent location when provenance is architecturally durable.
Do not create temporary archaeology files unless the work order requires them.

---

## Dependency Rule

Before adding a dependency, follow `DEPENDENCY_POLICY.md`.

A dependency must not secretly become the engine.
The engine must own the architectural seam around major third-party systems.
Do not add packages merely because they are convenient.

---

## Native Pipeline Restrictions

Do not introduce a foundational requirement for:

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
- remote image-to-3D;
- downloaded finished hero meshes.

Optional interoperability may be considered later.
These are not the native architecture.

---

## Runtime Principles

Preserve these unless explicitly changed by higher authority:

- browser-first;
- fixed gameplay simulation;
- variable rendering with interpolation;
- one authoritative transform writer per entity per simulation step;
- controller and keyboard through action-based input;
- generational runtime handles;
- persistent IDs only where persistence is required;
- deterministic RNG for deterministic systems;
- snapshot-first saves;
- replay as a separate system;
- DOM-first hybrid runtime UI;
- WebGPU preferred, WebGL2 meaningful fallback;
- exported games run without Studio;
- static hosting remains a valid target.

---

## Randomness

Do not scatter `Math.random()` through deterministic engine/gameplay systems.
Use explicit seeded random services.

If genuinely nondeterministic cosmetic randomness is allowed, use an explicit named API so its use is visible and searchable.

---

## Transform Authority

One authoritative writer owns an entity transform during a simulation step.
Animation must not directly mutate world transforms.
Motion may produce pose data and root movement intent.
Movement/collision/physics authority commits the transform according to the active ownership model.

Do not invent a complex arbitration framework until multiple real systems require it.

---

## Scripts, Rules, Capabilities, Prefabs

Default decision procedure:

```text
Does it require code?
    no → prefab or rule

Does it only connect existing systems?
    yes → rule

Does it require privileged engine access?
    yes → capability

Otherwise
    → project script
```

Genre-specific mechanics default to project-level code.
Do not promote a game-specific mechanic into the engine without repeated cross-game evidence.

---

## Diagnostics

Important failures must be machine-readable.

Prefer structured fields such as:

```text
severity
code
step
subsystem
entityPid
definitionId
artifactKey
message
data
```

Nothing important fails silently.

---

## Tests and Evidence

A code diff is not runtime proof.

For runtime work, run the required browser or execution proof.
For visual work, capture deterministic evidence.
For deterministic work, demonstrate repeatability.
For lifecycle work, test cleanup/reuse.
For export work, boot the exported result from a normal static-host path.
For public API work, prefer tests and examples that use the public API rather than internal shortcuts.

Follow `TESTING_AND_VALIDATION.md`.

---

## Scope Rule

Do the assigned work.

Do not helpfully:

- redesign neighboring systems;
- upgrade unrelated dependencies;
- perform style rewrites;
- create speculative abstractions;
- add future-proofing with no current consumer;
- implement later roadmap phases;
- rewrite canonical docs outside authorization.

If a neighboring issue blocks the task, report it.

---

## Temporary Files

Temporary artifacts may be created for debugging, testing, or audit work.
Do not commit them unless they are intentionally part of the machine.

The repository is the machine, not a museum of every agent thought.

---

## Learning Material

Learning documentation follows accepted implementation.

```text
BUILD
→ TEST
→ AUDIT
→ ACCEPT
→ TEACH
```

Do not teach speculative APIs.
Examples should use the public API and should be validated so they do not silently rot.
Learning documents never override canonical architecture.

---

## Initial Toolchain Direction

Unless a verified incompatibility requires change:

- Node: `24.20.0`
- canonical branch: `main`

Pin the Node version consistently.
Do not perform unrelated major dependency upgrades during bootstrap.

---

## Required Pre-Change Checks

Before changing code, record:

- current branch;
- current HEAD SHA;
- worktree state;
- relevant package scripts;
- relevant tests;
- relevant current implementation.

Do not assume a clean worktree.
Do not overwrite unrelated human changes.

---

## Required Post-Change Checks

Before handoff, report:

- final branch;
- final HEAD SHA if committed;
- worktree state;
- files changed;
- tests/checks run;
- runtime/browser proof where relevant;
- diagnostics;
- known failures;
- architecture findings;
- unresolved items.

Use `HANDOFF_PROTOCOL.md`.

---

## Stop Rule

Stop when the assigned acceptance criteria are satisfied.
Do not continue into the next roadmap phase.

If blocked, stop and return evidence of the blocker.
If permanent documentation conflicts with implementation, stop.
If donor licensing/provenance is unclear, stop before adoption.
If the work order requires independent audit, stop after builder evidence and hand off.

---

## Required Handoff Skeleton

For material work, return:

```text
STATUS:
TASK:
ROLE:
REVISION / SHA:
WORKTREE STATE:

CHANGES:
FILES:

TESTS / CHECKS:
RUNTIME / BROWSER EVIDENCE:
VISUAL EVIDENCE:
PERFORMANCE EVIDENCE:
DIAGNOSTICS:

WHAT WORKS:
WHAT DOES NOT:

ARCHITECTURAL FINDINGS:
VALIDATION FINDINGS:
UNRESOLVED:
DEPENDENCY / SHORTCUT CHECK:
PROVENANCE:
LEARNING IMPACT:

NEXT RECOMMENDED ROLE:
WHY:

PASTE THIS NEXT:
```

Do not return only `done`, `passes`, or a prose summary.
