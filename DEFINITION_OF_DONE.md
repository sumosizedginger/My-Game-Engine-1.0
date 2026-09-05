# DEFINITION_OF_DONE.md

## Status

**CANONICAL PROJECT DOCUMENT**

Repository: `sumosizedginger/My-Game-Engine-1.0`

This document defines what **DONE**, **PASS**, **ACCEPTED**, and **FROZEN** mean for My Game Engine 1.0.

It exists because "the code is written" is not the same thing as "the work is correct."

---

## 1. Core Law

> **Implementation is not acceptance.**

A builder finishing a coding pass proves only that the builder finished a coding pass.

Material work is accepted only after the evidence required for its risk has been produced and independent review has closed blocking findings.

---

## 2. Completion Vocabulary

Use these terms precisely.

### IMPLEMENTED

The intended code/doc/config change has been written.

No claim is made yet about independent correctness.

### BUILDER PASS

The builder completed the assigned scope and its required self-checks pass.

This is implementation evidence.

It is not final acceptance.

### VALIDATED

An independent validator audited the exact revision and found no unresolved `BLOCKING` findings.

Important findings may still require repair depending on the work order and human decision.

### VERIFIED

An independent verifier reproduced the required proof on the exact audited revision, preferably from a clean state.

### ACCEPTED

The orchestrator/human accepts the exact revision after required build, audit, repair/re-audit, and verification evidence is complete.

### FROZEN

The accepted revision is the baseline for the next tranche.

Later changes require a new evidence chain.

---

## 3. Normal Material Acceptance Chain

For material work:

```text
DEFINE
→ IMPLEMENT
→ BUILDER TEST
→ RUNTIME PROOF
→ VALIDATOR AUDIT
→ REPAIR IF REQUIRED
→ VALIDATOR RE-AUDIT
→ INDEPENDENT VERIFICATION
→ HUMAN / ORCHESTRATOR ACCEPTANCE
→ FREEZE
```

Not every trivial edit needs this entire chain.

Architectural, runtime, deterministic, lifecycle, public-API, export, dependency, or visually significant work normally does.

---

## 4. Universal Done Conditions

A material tranche is not DONE unless all applicable items below are satisfied.

### Repository State

- exact canonical repository confirmed;
- exact base revision recorded;
- exact final revision recorded;
- branch identified;
- worktree state known;
- unrelated human changes preserved;
- no unexplained generated or temporary files committed.

### Scope

- assigned objective completed;
- forbidden work not performed;
- no unapproved next-phase implementation;
- no speculative subsystem added merely for future use.

### Build

- approved install path works;
- required build command succeeds;
- required artifacts are produced;
- no hidden local-machine dependency is required.

### Tests

- all task-required tests pass;
- relevant existing regression tests pass;
- new behavior has appropriate regression coverage;
- tests verify behavior rather than merely implementation shape.

### Runtime

When runtime behavior changed:

- the actual runtime was executed;
- expected behavior was observed;
- required browser proof passed;
- fatal diagnostics are absent;
- known degradations are explicit.

### Architecture

- no unresolved conflict with canonical documents;
- no accidental donor architecture inheritance;
- runtime/full split respected;
- identity/transform/determinism/lifecycle laws preserved where applicable;
- public API boundaries remain intentional.

### Dependencies

- new dependencies passed `DEPENDENCY_POLICY.md`;
- licenses/provenance were verified where required;
- no prohibited native-pipeline shortcut was introduced;
- dependency scope is correct (`runtime`, `full`, development, optional).

### Evidence

- claims are matched to evidence;
- exact commands/results are reported;
- visual claims have visual evidence;
- performance claims have measurements;
- determinism claims have repeatability evidence;
- export claims have exported-runtime evidence.

### Handoff

- `HANDOFF_PROTOCOL.md` is satisfied;
- unresolved items are explicit;
- next role is identified;
- material next-step prompt is complete.

---

## 5. What Does Not Count as Done

None of the following is sufficient by itself:

```text
"It compiles."
"Unit tests pass."
"I reviewed the code."
"It should work."
"The screenshot looks fine."
"The builder says it is done."
"The validator fixed it while auditing."
"It worked before the last commit."
"The same model re-ran its own test."
```

Each may be useful evidence.

None replaces the required proof chain.

---

## 6. Finding Severity and Acceptance

Validators classify findings as:

```text
BLOCKING
IMPORTANT
NON-BLOCKING
OPTIONAL
```

### BLOCKING

Must be closed before acceptance.

Examples include:

- required behavior does not work;
- required test fails;
- architecture law is violated;
- runtime evidence is missing for runtime work;
- deterministic path is nondeterministic beyond accepted limits;
- resource/lifecycle bug makes state unreliable;
- static export requirement is broken;
- prohibited dependency/shortcut introduced;
- wrong canonical repository or wrong revision audited;
- public API requires unintended private/internal access.

### IMPORTANT

Normally repaired before freeze unless the human explicitly accepts deferral.

### NON-BLOCKING

A real issue that does not invalidate the current proof.

Track it if it has future cost.

### OPTIONAL

Preference, polish, or speculative improvement.

Optional findings must not be disguised as mandatory architecture.

---

## 7. Phase 0 — Repository Foundation DoD

Phase 0 is a greenfield bootstrap phase.

Phase 0 is DONE only when:

- canonical documentation is coherent;
- repository identity is correct everywhere;
- Node target is pinned consistently unless a verified incompatibility changed it;
- package/install baseline exists;
- minimal source structure exists only as needed;
- test infrastructure runs;
- build infrastructure runs;
- browser/dev-server boot works;
- minimal runtime skeleton boots;
- the architectural direction for `engine/runtime` and `engine/full` is represented without pretending later systems exist;
- no large donor subsystem was imported without explicit authorization;
- the exact clean foundation revision is recorded;
- independent validation verifies that bootstrap claims are true.

Phase 0 is NOT DONE merely because fourteen Markdown files exist.

Documentation is necessary foundation, not the engine itself.

---

## 8. A0 — Evaluation Harness DoD

A0 is DONE only when the project has enough evaluation infrastructure to make later claims meaningful.

As applicable, establish and prove:

- deterministic or controlled capture path;
- browser automation path;
- diagnostics query/inspection;
- runtime telemetry needed by upcoming proofs;
- exact revision reporting;
- capture comparison or equivalent evaluation mechanism where visual work requires it;
- clean commands documented for future agents.

Do not turn A0 into an observability platform.

It only needs to support the next proofs honestly.

---

## 9. Proof A — Tiny Complete Game DoD

Proof A is DONE only when a Pong/Lunar-Lander-scale game demonstrates the complete cheap game-production spine.

Required evidence includes the accepted implementation of the minimum needed for:

- entity identity;
- transforms;
- action-based input;
- movement;
- collision;
- runtime variable;
- rule;
- state;
- DOM UI;
- tiny Kiln compile/artifact/instantiate seam;
- static build/export;
- browser execution from a normal static-host path.

Also measure or report:

- game file count;
- game LOC or equivalent complexity measure;
- boilerplate/friction observations;
- boot behavior;
- diagnostics;
- export simplicity.

Proof A must remain a regression instrument after later phases.

If later engine growth makes Proof A materially harder to build or run, investigate engine rot.

---

## 10. Proof B1 — Motion Truth DoD

B1 is not accepted merely because a procedural humanoid technically animates.

It must honestly test the character thesis using enough implementation to evaluate:

- procedural skin weights;
- one parameterized walk;
- grounding;
- minimal IK;
- root-motion path if used;
- deformation under motion;
- deterministic/reproducible generation where promised.

Visual evaluation must answer:

> Does the character read as a moving character rather than a procedural mannequin?

A negative answer may still produce a successful research result if evidence is honest and the architecture adjusts accordingly.

Do not hide B1 weakness behind combat, scenery, or post-processing.

---

## 11. Proof B2 — Procedural Combat Room DoD

B2 is DONE when accepted runtime evidence proves the minimum integration of:

- generated room/geometry;
- geometry semantics;
- procedural character;
- motion;
- minimum Material Forge behavior;
- gameplay collision;
- combat/gameplay script behavior;
- useful audio/FX hooks where included;
- diagnostics;
- browser rendering.

The proof must show integration quality, not merely that each subsystem has an isolated unit test.

Do not require exact CSG if direct procedural construction satisfies the proof more cleanly.

---

## 12. Proof C — Bounded Procedural World DoD

Proof C must demonstrate a bounded world before large-world architecture is admitted.

Expected evidence includes, as earned by the implementation:

- deterministic world recipe/seed behavior;
- terrain;
- environmental fields;
- world field cache;
- procedural vegetation;
- material integration;
- traversal;
- world-query interfaces with multiple real consumers;
- character grounding/collision behavior;
- browser runtime proof;
- measured performance relevant to the bounded scene.

Massive streaming is not a hidden acceptance criterion.

Do not build it unless a later proof requires it.

---

## 13. Proof D — Different Genre DoD

Proof D is designed to attack overfitting.

It is DONE only when a mechanically different game can be built primarily through:

- project scripts;
- rules;
- prefabs;
- definitions;
- justified reusable capabilities.

The proof should not require fundamental rewrites of established engine invariants such as:

- entity identity;
- event dispatch;
- simulation clock;
- transform authority;
- state primitive;
- save model where applicable.

Inspect the literal diff.

A hidden core rewrite is a failed generality result even if the new game runs.

---

## 14. Proof E — Blind API Test DoD

Proof E evaluates whether the engine is usable without internal project archaeology.

A fresh model/developer receives only approved public-facing material and is asked to build an unplanned small game.

The proof is successful when the fresh consumer can build the target without:

- reading private orchestration history;
- modifying engine internals unnecessarily;
- discovering undocumented mandatory state;
- relying on private test helpers;
- rewriting core architecture.

Failures must be classified:

```text
API DEFECT
DOCUMENTATION DEFECT
BOTH
USER ERROR / OUT-OF-SCOPE
```

Do not paper over a terrible API with more tutorial prose if the API should be repaired.

---

## 15. Public API Change DoD

A public API change is not DONE until:

- behavior is implemented;
- API shape agrees with architecture;
- regression tests exist;
- examples/learning docs affected by the change are identified;
- stale examples are updated in the same accepted tranche or an immediately scheduled learning extraction pass;
- blind-consumer friction is considered;
- internal implementation details are not accidentally exposed as stable contract.

---

## 16. Donor Port / Adaptation DoD

A donor port is not DONE until:

- source repository identified;
- source path identified;
- source commit SHA identified;
- license verified;
- `PORT` or `ADAPT` classification recorded;
- imported behavior mapped to current architecture;
- obsolete donor assumptions removed;
- tests prove the behavior in the new repo;
- public API reviewed independently of donor API shape;
- provenance is durable.

"It already worked in the old engine" is not acceptance evidence for the new engine.

---

## 17. Dependency Addition DoD

A material dependency addition is not DONE until:

- current proof/requirement justifies it;
- dependency class is identified;
- runtime/full/development placement is explicit;
- license is verified;
- engine-owned seam exists where appropriate;
- deterministic implications are understood;
- bundle/build impact is understood at the necessary depth;
- tests cover the boundary;
- replacement/removal path is plausible;
- validator finds no blocking dependency-policy violation.

---

## 18. Runtime Feature DoD

A runtime feature requires runtime proof.

Minimum applicable evidence:

- unit/integration tests;
- actual engine/game execution;
- browser proof;
- diagnostics inspection;
- lifecycle behavior where resources/entities are created and destroyed;
- deterministic behavior where promised;
- cleanup on repeated use where applicable.

Code review alone cannot pass runtime behavior.

---

## 19. Visual Feature DoD

A visual feature is not DONE until the result is actually seen under controlled conditions.

As applicable:

- deterministic scene setup;
- deterministic camera;
- capture produced;
- expected visual property stated;
- observed visual property evaluated;
- regressions compared against baseline;
- renderer fallback behavior checked when in scope;
- console/runtime diagnostics checked.

Do not certify visual quality from source code.

---

## 20. Performance Work DoD

Performance work is not DONE because code "looks faster."

Require:

- defined metric;
- reproducible workload;
- baseline;
- changed result;
- environment/hardware when material;
- no unacceptable correctness regression;
- interpretation of noise/variance;
- threshold only when a real threshold has been established.

Do not invent budgets before measurement exists.

---

## 21. Determinism Work DoD

Where deterministic behavior is required, prove it with repeated controlled runs.

Depending on the system, compare:

- hashes;
- serialized definitions;
- generated topology/counts;
- state checkpoints;
- capture metadata;
- replay checkpoints;
- ordered event outputs.

A deterministic claim must state its intended scope/platform class.

---

## 22. Lifecycle / Resource Ownership DoD

Resource cleanup is correctness.

For work involving reusable/disposable resources, test:

- create;
- use;
- destroy;
- recreate;
- repeated cycles;
- stale-handle rejection where relevant;
- no accidental ownership leak;
- no duplicate frame loops/listeners/subscriptions;
- telemetry or explicit probes when useful.

A feature that works once but leaks every cycle is not DONE.

---

## 23. Static Export DoD

A static-export capability is DONE only when:

1. project/game build completes;
2. output is produced without hidden development-server assumptions;
3. output is served from a normal static host/path;
4. browser boots the game;
5. required assets resolve;
6. no mandatory Studio connection exists;
7. no mandatory game server exists merely to boot;
8. runtime/full dependency boundary behaves as designed for the target.

Opening an output file directly from the build directory is not necessarily sufficient proof.

---

## 24. Learning Lesson DoD

A learning lesson is DONE only if:

- it teaches accepted behavior;
- commands are current;
- code runs/compiles where applicable;
- public API names are correct;
- prerequisites are explicit;
- expected result is visible or testable;
- architectural explanation agrees with canonical docs;
- it contains no obsolete agent/build archaeology;
- linked example works;
- a fresh reader can follow it.

Learning docs are not allowed to make planned APIs look implemented.

---

## 25. Example Project DoD

An example is DONE only if:

- it builds;
- it runs;
- it demonstrates a clear concept;
- it uses public API unless explicitly an internals example;
- it has no hidden local dependency;
- it has no fatal diagnostics;
- relevant learning material links to it;
- it remains small enough to understand;
- automated validation covers it where practical.

Examples are first-class regression instruments.

---

## 26. Documentation Change DoD

A canonical documentation change is DONE only when:

- repository identity is correct;
- authority level is clear;
- current implementation vs approved future architecture is distinguished;
- no stale donor/Visual-Lab language remains unless explicitly historical;
- cross-links resolve;
- terminology agrees across canonical docs;
- no new competing authority document was created unnecessarily;
- `DOCUMENTATION_MAP.md` is updated if routing changed.

Documentation cannot claim implementation that does not exist.

---

## 27. Flash-Model Acceptance Checklist

Before a Flash model reports `PASS`, it must explicitly verify:

```text
[ ] I worked in sumosizedginger/My-Game-Engine-1.0.
[ ] I recorded the exact base revision.
[ ] I know whether the initial worktree was clean or dirty.
[ ] I read the required canonical docs for this task.
[ ] I stayed inside the work order.
[ ] I did not assume planned systems already exist.
[ ] I did not silently import donor architecture.
[ ] I ran every required command I claim passed.
[ ] Runtime claims have runtime evidence.
[ ] Visual claims have visual evidence.
[ ] Determinism claims have repeatability evidence.
[ ] New dependencies satisfy DEPENDENCY_POLICY.md.
[ ] Donor code has provenance.
[ ] I listed known limitations and unresolved items.
[ ] I reported the exact final revision/worktree state.
[ ] I did not self-accept material work.
```

If any applicable box cannot be checked, do not report unqualified PASS.

---

## 28. Final Law

DONE means the machine earned the claim.

Not that an agent sounded confident.

Not that the diff was large.

Not that tests were green in isolation.

The repository advances only on evidence tied to an exact state.
