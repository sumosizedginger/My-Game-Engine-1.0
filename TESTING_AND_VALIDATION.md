# TESTING_AND_VALIDATION.md

## Status

**CANONICAL PROJECT DOCUMENT**

Repository: `sumosizedginger/My-Game-Engine-1.0`

This document defines how My Game Engine 1.0 proves that code, runtime behavior, deterministic systems, visual systems, lifecycle behavior, examples, exports, and public APIs work.

---

## 1. Core Law

> **Use evidence that can actually prove the claim being made.**

Examples:

```text
"the module builds"
→ build proof

"the collision algorithm returns the right result"
→ unit/integration proof

"the game runs"
→ runtime/browser proof

"the character looks right"
→ controlled visual proof

"generation is deterministic"
→ repeatability proof

"resources clean up"
→ lifecycle/repetition proof

"export works"
→ exported-build static-host proof

"the public API is usable"
→ consumer/example/blind API proof
```

No single test type proves everything.

---

## 2. Testing Philosophy

Testing in this project exists for five purposes:

1. protect durable invariants;
2. prove user-visible behavior;
3. catch architecture drift;
4. make model-generated changes falsifiable;
5. keep examples and proof games from silently rotting.

Tests should not fossilize arbitrary implementation details.

A refactor that preserves public behavior and canonical invariants should not fail merely because private file layout changed.

---

## 3. Test Layers

Use the smallest sufficient layer first, then add higher-level proof where the claim crosses boundaries.

### 3.1 Static / Structural Checks

Use for:

- syntax;
- import resolution;
- schema validation;
- forbidden dependency checks;
- project structure invariants;
- link/path checks when introduced;
- package/build configuration.

Static checks do not prove runtime behavior.

### 3.2 Unit Tests

Use for deterministic isolated logic such as:

- math;
- geometry operations;
- entity-handle generation logic;
- rule evaluation;
- state transitions;
- seeded RNG;
- serialization helpers;
- content hashing;
- semantic propagation;
- collision primitives.

Unit tests should be fast and deterministic.

### 3.3 Integration Tests

Use when multiple engine-owned components interact.

Examples:

- script host + events + variables;
- motion intent + movement authority;
- geometry compiler + artifact instantiation;
- save snapshot + persistent identity;
- WorldFieldQuery + consumer;
- renderer factory + runtime scene setup.

### 3.4 Browser / Runtime Tests

Use for behavior that only becomes meaningful in an actual browser/runtime environment.

Examples:

- boot;
- rendering;
- input dispatch;
- requestAnimationFrame integration;
- DOM UI;
- WebGPU/WebGL2 path selection;
- audio initialization when allowed;
- static export;
- lifecycle around browser resources.

A Node-only test cannot prove browser behavior.

### 3.5 Proof-Game Tests

Proof games are architectural integration tests.

They answer questions too broad for isolated suites.

Examples:

- Proof A: can a tiny complete game be built cleanly?
- B1: does procedural character motion actually work visually?
- B2: do generation + motion + materials + gameplay integrate?
- C: do bounded world systems work together?
- D: can a different genre use the engine without rewriting foundations?
- E: can a fresh consumer use the public API?

### 3.6 Independent Validation

A separate model/agent audits the exact builder revision.

This is required for material tranches according to `DEFINITION_OF_DONE.md`.

### 3.7 Independent Verification

A fresh verifier reproduces the accepted proof on the exact audited revision, preferably from a clean checkout/worktree.

---

## 4. Canonical Command Surface

Phase 0 must establish a small, memorable command surface.

The exact package scripts do not exist until Phase 0 implements them, but the target interface should remain conceptually simple.

Prefer conventional commands such as:

```text
npm install / npm ci
npm test
npm run build
npm run dev
```

Additional commands may be earned when needed, for example:

```text
npm run test:unit
npm run test:browser
npm run test:examples
npm run capture
npm run lint
```

Do not create twenty scripts before there are twenty distinct workflows.

Once canonical commands exist, `README.md`, `AGENTS.md`, CI, and learning material must agree on them.

---

## 5. Clean-State Reproduction

Material verification should prefer a clean environment.

At minimum record:

- exact revision;
- Node version;
- dependency install method;
- branch/detached state;
- environment assumptions;
- commands executed.

A verifier should not rely on untracked local files, stale build artifacts, globally installed packages, or hidden environment state.

---

## 6. Exact Revision Rule

Every material audit/verification applies to one exact revision.

If code changes afterward, previous validation does not automatically apply.

Report full commit SHAs where practical.

Do not use vague identifiers such as:

```text
latest
fixed branch
current build
new version
```

---

## 7. Unit Test Design Rules

Prefer tests that state a durable behavior.

Good:

> A stale `EntityHandle` generation does not resolve after a slot is reused.

Bad:

> Internal array element 14 equals object X because today's implementation stores it there.

Good:

> Seed 1234 produces the same accepted procedural result across repeated runs in the supported platform class.

Bad:

> This private helper is called exactly three times unless call count itself is the required behavior.

Tests should allow safe refactoring.

---

## 8. Runtime Evidence Rule

When production runtime behavior changes, execute it.

Report:

```text
COMMAND:
URL / ENTRY POINT:
EXPECTED:
OBSERVED:
CONSOLE / DIAGNOSTICS:
PASS / FAIL:
```

Do not replace runtime evidence with source inspection.

---

## 9. Browser Baseline

My Game Engine 1.0 is browser-first.

Phase 0 should establish a supported browser automation path appropriate to the chosen tooling.

Do not overcommit to a giant compatibility matrix before evidence requires it.

Early development may use one canonical automated browser target plus targeted manual/independent checks.

As renderer/export proofs mature, expand coverage according to `PRD.md` and real compatibility requirements.

---

## 10. WebGPU and WebGL2 Validation

Approved renderer direction:

```text
WebGPU preferred
WebGL2 fallback
```

Do not claim both backends work merely because the factory interface contains both names.

When a proof depends on fallback behavior, validate the actual fallback path.

For renderer-specific work, identify:

- backend requested;
- backend selected;
- fallback reason if any;
- rendered result;
- diagnostics;
- known feature difference.

Exact fallback feature tier is evidence-driven.

---

## 11. Determinism Testing

The target is reproducible behavior for a defined engine build/platform class, not magical universal floating-point identity.

For deterministic systems:

1. fix inputs;
2. fix seed;
3. fix relevant ordering;
4. execute repeatedly;
5. compare meaningful outputs;
6. change one input/seed;
7. confirm controlled change.

Possible comparison surfaces:

- definition hashes;
- artifact keys;
- serialized state;
- geometry counts/topology metadata;
- semantic landmark output;
- event sequence;
- save snapshots;
- replay checkpoint hashes;
- world field samples.

If platform-level numerical tolerance is necessary, define it explicitly in the subsystem test rather than hiding drift.

---

## 12. Randomness Tests

Deterministic gameplay/generation must not rely on uncontrolled `Math.random()`.

Testing should detect or prevent accidental uncontrolled randomness where practical.

For seeded systems verify:

```text
same seed + same definition + same engine build/platform class
→ same accepted result
```

Then verify:

```text
different seed
→ controlled meaningful difference
```

Cosmetic nondeterminism, when explicitly allowed, should remain isolated and identifiable.

---

## 13. Entity Identity Tests

When identity is implemented, test at least:

- handle resolves while entity is alive;
- despawn invalidates the old handle;
- pooled slot reuse increments generation;
- stale handle does not resolve to a new occupant;
- persistent IDs serialize only when appropriate;
- temporary entities do not acquire persistence accidentally.

Identity failures are correctness failures, not polish issues.

---

## 14. Transform Authority Tests

When multiple movement-related systems exist, test the invariant:

> One authoritative writer commits an entity transform per simulation step.

As applicable verify:

- animation does not directly own world transforms;
- root motion is expressed as movement intent/root delta;
- active movement/physics authority commits the result;
- teleport explicitly suppresses inappropriate interpolation for that frame;
- conflicting writers are detected or prevented according to current architecture.

Do not build arbitration complexity before a real conflict exists.

---

## 15. Fixed-Step Simulation Tests

Gameplay-observable behavior runs on the fixed simulation.

As the clock is implemented, test:

- fixed update cadence behavior;
- rendering remains variable/interpolated;
- gameplay systems do not create independent frame loops;
- input snapshot enters simulation predictably;
- event/timer ordering follows accepted architecture;
- pause/time-scale semantics when implemented.

Avoid fragile wall-clock tests where deterministic clock injection can prove behavior more reliably.

---

## 16. Lifecycle and Cleanup Tests

Resource cleanup is part of correctness.

For resources/entities/listeners/workers/caches with lifecycles, test repeated cycles:

```text
create
→ use
→ dispose/despawn
→ recreate
→ repeat
```

Look for:

- stale handles;
- duplicate listeners;
- orphaned animation loops;
- retained GPU resources;
- worker leaks;
- cache ownership errors;
- event subscriptions surviving disposal;
- duplicate DOM bindings.

Use telemetry/probes when ordinary assertions cannot expose the leak.

---

## 17. Geometry Validation

Geometry tests should protect semantic and topological correctness, not merely vertex counts.

As systems exist, test applicable properties such as:

- finite positions/normals/UVs;
- index validity;
- winding consistency;
- expected boundary behavior;
- degenerate triangles;
- normals/orientation;
- manifold expectations when required;
- semantic `regionId` / `surfaceId` propagation;
- `SemanticLandmarks` correctness;
- deterministic output;
- invalid input diagnostics.

A visually plausible mesh can still be invalid geometry.

---

## 18. Kiln Tests

Kiln begins small.

When implemented, test the seam before building industrial caching infrastructure.

Minimum conceptual proof:

```text
definition
→ compile
→ artifact
→ instantiate
```

Verify:

- schema/definition validation where applicable;
- content-derived artifact identity;
- same accepted definition yields same artifact key under the defined rules;
- artifact can instantiate runtime object;
- runtime object does not become the source of truth;
- memory cache behavior if implemented;
- compiler-only code does not leak unnecessarily into runtime-only exports.

Do not require IndexedDB/workers/binary formats before they are implemented.

---

## 19. Save and Replay Tests

When save exists, test snapshot behavior independently of replay.

Save tests may include:

- save format version;
- project/definition identity;
- declared persistent variables;
- declared persistent entity state;
- load reconstruction;
- temporary runtime objects excluded;
- stale/invalid version diagnostics.

Replay tests may include:

- seed/definition identity;
- input log;
- checkpoint hashes;
- divergence report when hashes differ.

Do not make game load require replaying the entire historical session.

---

## 20. World Query Tests

When World Forge exists, distinguish:

### `WorldFieldQuery`

Cheap/bulk 2.5D field information.

Test representative consumers such as vegetation/ecology and grounding where appropriate.

### `WorldVolumeQuery`

Authoritative 3D spatial truth.

Test overhang/interior/cave/staked-floor cases when those features exist.

Anything requiring correctness beneath an overhang must not be "proved" only through height-field queries.

---

## 21. Visual Validation

Visual work requires controlled visual evidence.

Prefer:

- deterministic scene setup;
- deterministic seed;
- fixed camera transform;
- fixed viewport where practical;
- stable lighting/environment;
- explicit expected properties;
- captures tied to exact revision.

Visual review should ask concrete questions.

Examples:

```text
Is the silhouette anatomically plausible?
Are feet visibly grounded?
Does the walk read as weighted rather than sliding?
Are material regions correctly assigned?
Does fallback rendering preserve the required scene meaning?
```

Avoid "looks good" as the only acceptance criterion.

---

## 22. Capture Baselines

A0 establishes the capture/evaluation mechanism required by upcoming proofs.

When captures become canonical evidence:

- tie them to exact revision/scene/config;
- avoid unexplained nondeterminism;
- preserve metadata needed to reproduce them;
- update baselines deliberately;
- do not accept a changed baseline merely to make a test green.

A baseline change should correspond to an accepted visual change.

---

## 23. Performance Validation

Performance claims require measurements.

For a benchmark, record:

```text
REVISION:
ENVIRONMENT:
WORKLOAD:
METRIC:
WARMUP:
SAMPLE METHOD:
BASELINE:
RESULT:
VARIANCE / NOTES:
```

Use representative workloads from proof games rather than synthetic microbenchmarks alone.

Do not define premature universal frame budgets.

Budgets become canonical when enough evidence exists to justify them.

---

## 24. Static Export Validation

When export is in scope:

1. build the game/export;
2. inspect expected output files;
3. serve them through a normal static HTTP server/host path;
4. load the game in browser;
5. verify asset/module paths;
6. verify no hidden dev-server API is required;
7. verify Studio is not required;
8. inspect diagnostics/console;
9. exercise core interaction.

GitHub Pages-style hosting should remain possible for ordinary games.

---

## 25. Public API Validation

Public APIs should be exercised from outside engine internals.

Use:

- examples;
- black-box integration tests;
- proof games;
- eventually blind API tests.

Watch for:

- internal import paths required by normal game code;
- hidden global state;
- excessive setup boilerplate;
- ambiguous lifecycle;
- undocumented ownership;
- physical-key assumptions instead of input actions;
- inability to inspect engine state/diagnostics.

If documentation must explain a bizarre workaround, ask whether the API is wrong.

---

## 26. Example Validation

Examples are first-class tests.

At minimum, important examples should verify:

- build;
- boot;
- required local assets;
- no fatal diagnostics.

Important examples should receive browser tests when practical.

Example code must use current public API.

Do not keep pseudocode disguised as runnable example code.

---

## 27. Learning Documentation Validation

For substantial tutorials:

```text
fresh reader / fresh agent
→ follow only the lesson
→ run documented commands
→ produce expected outcome
```

If that fails, classify the failure:

- lesson error;
- public API defect;
- setup defect;
- engine defect.

Repair the underlying cause.

Do not merely add paragraphs around a broken workflow.

---

## 28. Adversarial Validation

Validators should actively search for cases the builder is unlikely to test.

Depending on the subsystem, examples include:

- empty input;
- malformed definitions;
- extreme but valid parameters;
- repeated create/destroy;
- stale handles;
- reversed geometry;
- unusual orientation;
- seed extremes;
- pause/resume;
- resize;
- fallback renderer;
- missing optional capability;
- disconnected controller;
- export under non-root path;
- dependency absent from runtime-only build.

Adversarial does not mean random chaos.

Choose probes based on known invariants and failure modes.

---

## 29. Validator Behavior

The validator does not primarily ask:

> Can I find something to complain about?

It asks:

> What claims does this revision make, and what evidence would falsify them?

The validator should:

- reproduce important checks;
- inspect exact diff;
- inspect canonical requirements;
- add temporary probes if useful;
- distinguish defect from preference;
- classify severity;
- avoid production repair unless explicitly authorized.

---

## 30. Repair Validation

After repair:

- rerun the failing reproduction;
- rerun affected regression tests;
- rerun broader tests when change risk justifies it;
- inspect for adjacent regressions;
- send material repairs back to validator.

A repaired revision is a new revision.

Previous validation does not automatically transfer.

---

## 31. Independent Verification

Verifier requirements:

- exact audited SHA;
- clean state preferred;
- canonical Node/toolchain;
- documented install;
- documented tests;
- runtime/browser proof;
- required captures/probes;
- no redesign;
- no production fixes.

A verifier returns `PASS`, `FAIL`, `PARTIAL`, or `BLOCKED` with evidence.

---

## 32. CI Direction

CI should automate stable, valuable checks as they emerge.

Potential progression:

```text
Phase 0:
install + tests + build

A0/A:
+ browser smoke/proof

Later:
+ examples
+ deterministic probes
+ selected capture checks
+ static export smoke
+ documentation/link checks
```

Do not build an enormous CI matrix before the repository has enough implementation to justify it.

Local commands and CI commands should agree.

---

## 33. Failure Reporting

When a test fails, preserve:

- exact revision;
- command;
- environment if material;
- expected result;
- observed result;
- diagnostic/error output;
- minimal reproduction if possible;
- whether failure is deterministic;
- whether failure existed at base revision when relevant.

Do not summarize a useful failure into "tests red."

---

## 34. No Silent Skips

If a required test cannot run:

state why.

Examples:

- browser unavailable;
- WebGPU unavailable;
- required fixture missing;
- environment dependency absent;
- test infrastructure itself broken.

A skipped required proof is unresolved evidence, not a PASS.

---

## 35. Flash-Model Validation Procedure

For Gemini Flash / DeepSeek Flash / other fast agents, use this sequence exactly unless a work order overrides it:

```text
1. Confirm canonical repository and exact SHA.
2. Confirm worktree state.
3. Read the task-routed canonical docs.
4. Extract explicit acceptance claims from the work order/handoff.
5. Map each claim to a proof type.
6. Run the cheapest valid proof first.
7. Run runtime/browser proof for runtime claims.
8. Add bounded adversarial probes for high-risk invariants.
9. Check dependency/provenance rules.
10. Check architecture conflicts.
11. Classify findings by severity.
12. Report what remains unproven.
13. Do not repair while acting as validator/verifier.
14. Return the canonical handoff format.
```

Do not infer PASS from builder confidence.

---

## 36. Proof Matrix

Use this as a default mapping:

| Claim | Minimum evidence |
|---|---|
| Package/build configuration works | clean install + build |
| Pure algorithm works | unit tests |
| Engine subsystems integrate | integration tests |
| Browser runtime works | browser execution |
| Visual result is correct | controlled capture + inspection |
| Deterministic generation works | repeated controlled runs |
| Lifecycle is correct | repeated create/destroy + probes |
| Performance improved | baseline + measured result |
| Static export works | exported build on static host |
| Public API is usable | external example/consumer test |
| Learning lesson works | fresh-reader execution |
| Donor port preserved useful behavior | provenance + new-repo regression tests |

Stronger evidence may be required by a subsystem spec.

---

## 37. Final Law

The purpose of testing is not to create a wall of green badges.

It is to make the engine's claims falsifiable.

When the project says a thing works, another human or model should be able to reproduce the evidence on the exact machine state and reach the same conclusion.
