# DEPENDENCY_POLICY.md

## Status

**CANONICAL PROJECT DOCUMENT**

Repository: `sumosizedginger/My-Game-Engine-1.0`

This document governs admission, use, replacement, provenance, and removal of third-party dependencies and donor code in **My Game Engine 1.0**.

It is intentionally strict because a code-native engine can lose its defining architecture without anyone noticing if critical behavior is quietly outsourced to opaque or unsuitable dependencies.

---

## 1. Core Law

> **Dependencies may assist the machine. They may not secretly become the machine.**

A dependency is acceptable when it provides a bounded capability behind an engine-owned seam and does not make the project's native artifacts opaque, unreachable, untestable, or dependent on an external authoring pipeline.

A dependency is not acceptable merely because it is popular, convenient, impressive, or already used by a donor repository.

---

## 2. Canonical Repository

The canonical implementation repository is:

`sumosizedginger/My-Game-Engine-1.0`

This is a greenfield implementation informed by prior prototypes and research.

The following are **donors or references**, not canonical source trees:

- `sumosizedginger/my-engine-2`;
- the original `sumosizedginger/My-Engine`;
- My Engine Studio;
- Super Terrain;
- Sylva / `realistic-forest`;
- OpenSmash;
- other repositories explicitly approved for investigation.

Do not copy a donor dependency graph into the new engine by default.

---

## 3. Dependency Classes

Every external technology considered for the project must be classified before adoption.

### 3.1 Foundation Dependency

A dependency intentionally used as a major technical foundation.

Current approved direction:

- **Three.js** as the browser graphics foundation.

A foundation dependency still sits behind My Game Engine-owned APIs and contracts where practical.

Foundation status does not authorize unrelated packages from that ecosystem.

### 3.2 Bounded Runtime Dependency

A library used for one contained runtime capability.

Potential future examples, only when a proof requires them:

- `three-mesh-bvh` for spatial acceleration;
- Rapier for advanced physics;
- `recast-navigation-js` for navigation.

These are not automatically approved merely because they appear in architecture planning.

### 3.3 Build / Development Dependency

A package used for:

- build tooling;
- tests;
- linting;
- browser automation;
- development server;
- type checking if introduced;
- packaging.

Development convenience does not excuse excessive dependency weight or hidden runtime coupling.

### 3.4 Optional Compiler / Forge Dependency

A library used by `engine/full`, Kiln, or a Forge to produce compiled artifacts.

Examples may eventually include exact CSG or mesh optimization tools.

A normal exported game that only needs compiled artifacts should not automatically ship compiler dependencies.

### 3.5 Donor Code

Code copied or materially adapted from another repository.

Donor code is not treated as an ordinary package dependency. It is governed by the provenance rules in this document.

### 3.6 Reference Only

A project, paper, library, or codebase studied for ideas while no code is imported and no runtime/build dependency is created.

Reference status creates no architectural authority.

---

## 4. Admission Test

Before adding a new dependency, answer all of the following.

```text
1. What exact problem does it solve?
2. Which current proof or accepted requirement needs that problem solved now?
3. Can project code solve the problem simply enough without the dependency?
4. Is the dependency browser-compatible where required?
5. Does it preserve the Code-Reachable Law?
6. Can it be isolated behind an engine-owned boundary?
7. Does it create a mandatory server, cloud service, account, or proprietary tool?
8. Does it introduce a traditional DCC pipeline as a native requirement?
9. Is its license compatible with the project's intended distribution?
10. Is the package maintained enough for the risk it introduces?
11. What is the runtime/build-size cost?
12. What is the removal or replacement path?
13. What tests will prove our boundary around it works?
```

If these questions cannot be answered, defer the dependency.

---

## 5. Evidence-Pulled Adoption

Dependencies are pulled by running proofs.

Do not implement the roadmap by installing every library that might someday be useful.

Examples:

- Do not integrate Rapier before a real proof needs rigid bodies, joints, impulses, or complex contact behavior.
- Do not integrate Recast before a generated-world proof actually needs navigation.
- Do not integrate Manifold merely because exact CSG is architecturally contemplated.
- Do not add `meshoptimizer` before measurements show that its optimization solves a real problem.
- Do not add huge-world streaming dependencies before a bounded world proves the basic world architecture.

The question is not:

> Could we use this someday?

The question is:

> What accepted requirement or failing proof justifies this dependency now?

---

## 6. Engine-Owned Boundary Rule

Major third-party systems must not leak uncontrollably through public engine APIs.

Prefer:

```text
Game / Studio / Tests
        ↓
My Game Engine API
        ↓
Engine-owned adapter or service boundary
        ↓
Third-party library
```

Avoid:

```text
Game code
→ imports third-party internals everywhere
→ engine cannot replace or constrain them
```

The exact amount of wrapping should remain proportional to the risk. Do not build abstraction for abstraction's sake.

---

## 7. Runtime vs Full-Engine Boundary

The approved architecture has two consumption modes:

```text
engine/runtime
engine/full
```

`engine/runtime` is for ordinary exported games using already-compiled content and runtime services.

`engine/full` includes runtime generation/compiler capability such as Kiln and the Forges as those systems are implemented.

A compiler-only dependency should not automatically enter the runtime bundle.

When admitting a dependency, explicitly state whether it belongs to:

```text
RUNTIME
FULL ONLY
DEVELOPMENT ONLY
OPTIONAL / LAZY
```

Do not blur this boundary because bundling is convenient.

---

## 8. Native Pipeline Restrictions

The native My Game Engine 1.0 pipeline must not acquire a foundational requirement for:

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

Traditional formats or tools may later exist as optional interoperability paths.

They do not define the native architecture.

A feature that only works by requiring one of these tools does not satisfy the native code-reachable product thesis.

---

## 9. Network and Cloud Rule

Ordinary exported games must not require a mandatory project server merely to boot.

Static hosting, including GitHub Pages-style deployment, remains a core target.

A dependency that requires:

- account authentication;
- proprietary cloud execution;
- remote compilation;
- remote asset generation;
- permanent hosted APIs

must be treated as an optional integration unless the human explicitly changes product scope.

Do not make a cloud service foundational by accident.

---

## 10. Determinism Rule

Dependencies used in deterministic generation or gameplay paths must be evaluated for deterministic behavior under the project's defined platform/build class.

If a dependency introduces nondeterminism:

1. identify where it enters;
2. determine whether that path is gameplay-observable;
3. isolate it if possible;
4. provide deterministic input/ordering where needed;
5. test repeatability;
6. document accepted limitations.

Do not promise universal bit-for-bit identity across every browser, GPU, CPU, and operating system.

Do require reproducibility where the engine claims it.

---

## 11. Licensing Rule

Current intended repository licensing direction is **MIT**, unless the human project owner changes it before public release.

Do not assume a dependency or donor is license-compatible.

Before adoption, verify:

- package/repository identity;
- license name;
- source of the license information;
- obligations relevant to source and distribution;
- whether bundled assets or examples have different terms;
- whether notices or attribution are required.

If licensing is unclear:

**STOP BEFORE ADOPTION.**

Do not invent legal conclusions.

Flag ambiguity for human review.

---

## 12. Donor Classification

Every donor candidate must be classified:

```text
PORT
ADAPT
REFERENCE
DROP
```

### PORT

Code is suitable enough to bring over substantially intact.

Still requires:

- provenance;
- license verification;
- compatibility review;
- tests in the new repository;
- API review.

### ADAPT

The donor contains useful implementation but must be reshaped for the new architecture.

Document material changes.

### REFERENCE

Study concepts/tests/algorithms, but implement independently.

Do not claim independently written code was ported.

Do not claim materially copied code was merely "inspired by".

### DROP

The system does not belong in the new engine.

Reasons may include:

- obsolete architecture;
- wrong API shape;
- licensing problem;
- dependency burden;
- poor determinism;
- unnecessary complexity;
- proof no longer needs it.

---

## 13. Provenance Record

Whenever code is ported or materially adapted, preserve at minimum:

```text
SOURCE REPOSITORY:
SOURCE PATH:
SOURCE COMMIT SHA:
SOURCE LICENSE:
CLASSIFICATION: PORT | ADAPT
WHAT WAS TAKEN:
WHY:
MATERIAL CHANGES:
ASSOCIATED TESTS:
```

The record may live in:

- the relevant ADR;
- an approved subsystem document;
- another permanent provenance mechanism established later.

Do not create a swarm of temporary provenance Markdown files unless needed.

The durable requirement is that future humans and models can determine where imported code came from.

---

## 14. Donor Test Rule

Tests may be as valuable as donor code.

A donor test can encode a durable invariant even when the donor implementation is rejected.

When reusing a test idea:

- verify the invariant still belongs in the new architecture;
- rewrite paths/API assumptions as needed;
- do not preserve an obsolete internal structure merely to keep an old test green.

Tests protect current law, not historical implementation trivia.

---

## 15. No Wholesale Merge Rule

Do not:

- copy an entire donor source tree;
- merge an entire donor repository;
- import donor config wholesale;
- inherit donor package manifests without review;
- reproduce donor directory structure merely because it already exists.

A greenfield repository is valuable precisely because each adopted system must earn its place.

---

## 16. Version Policy

Use explicit package versions according to the package manager's lockfile semantics established during Phase 0.

Commit the lockfile.

Do not perform unrelated major-version upgrades during bounded feature work.

A version upgrade is its own engineering change when it materially affects:

- runtime behavior;
- rendering;
- build output;
- browser compatibility;
- public API;
- deterministic output;
- tests.

---

## 17. Node Toolchain

Unless a verified incompatibility requires change, use:

`Node 24.20.0`

Pin it consistently using the repository mechanisms established during Phase 0.

If a dependency cannot support the pinned toolchain, do not silently change Node.

Report the incompatibility and evaluate the tradeoff explicitly.

---

## 18. Security and Supply-Chain Checks

For material dependencies, inspect at least:

- package origin;
- maintainer/repository identity;
- recent maintenance state when relevant;
- transitive dependency burden;
- known security advisories available through the chosen toolchain;
- install/build scripts that execute code;
- browser/runtime permissions or network behavior.

The depth of review should match the dependency's privilege and importance.

Do not treat a tiny test helper and a foundational runtime library as equal risk.

---

## 19. Dependency Removal

Dependencies are not sacred once admitted.

Remove or replace a dependency when evidence shows:

- it no longer solves a real requirement;
- its boundary is more expensive than native implementation;
- it blocks determinism;
- it prevents static export;
- it bloats `engine/runtime` without justification;
- it is unmaintained at unacceptable risk;
- its license becomes incompatible;
- a simpler implementation now exists.

Removal must preserve required behavior through tests/proofs.

---

## 20. Dependency Decision Handoff

Any work order adding a material dependency must return:

```text
DEPENDENCY:
VERSION:
CLASS:
CURRENT PROOF / REQUIREMENT:
WHY NATIVE CODE IS NOT PREFERRED:
BOUNDARY:
RUNTIME OR FULL:
LICENSE:
BUNDLE / COST IMPACT:
DETERMINISM IMPACT:
REPLACEMENT PATH:
TESTS:
PROVENANCE:
```

A validator should challenge weak answers.

---

## 21. Pre-Approved Research Direction Is Not Pre-Approved Installation

Architecture planning has identified possible technologies such as:

- Manifold;
- `three-mesh-bvh`;
- `meshoptimizer`;
- Rapier;
- `recast-navigation-js`;
- SDF / voxel techniques;
- Posecode concepts;
- Ossos concepts;
- retargeting references;
- Theatre.js concepts.

Their mention in planning means:

> worth investigating when a proof creates the need.

It does **not** mean:

> install now.

---

## 22. Flash-Model Decision Procedure

When an agent is uncertain whether to add a dependency, use this exact procedure:

```text
A. Is the capability required by the current work order?
   NO → do not add it.
   YES → continue.

B. Can existing project code solve it clearly and cheaply?
   YES → prefer project code unless evidence favors dependency.
   NO → continue.

C. Is there an approved candidate?
   NO → research bounded alternatives and report.
   YES → continue.

D. Can the dependency sit behind an engine-owned seam?
   NO → stop and report architectural risk.
   YES → continue.

E. Is license/provenance acceptable and verified?
   NO / UNKNOWN → stop.
   YES → continue.

F. Can required tests prove the boundary?
   NO → define tests before adoption.
   YES → dependency may be admitted within work-order scope.
```

Do not skip steps because the package appears convenient.

---

## 23. Final Law

Third-party code is leverage.

It is not authority.

My Game Engine 1.0 must remain understandable as **its own machine**, with its architecture, public contracts, deterministic behavior, and native code-reachable pipeline intact even when carefully chosen libraries help implement the mathematics underneath.
