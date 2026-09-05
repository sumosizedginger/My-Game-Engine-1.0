# HANDOFF_PROTOCOL.md

## Purpose

This document defines how material work moves between humans, builders, validators, repair agents, and independent verifiers in **My Game Engine 1.0**.

Canonical repository:

`sumosizedginger/My-Game-Engine-1.0`

A handoff is not ceremony. It preserves exact state, evidence, unresolved risk, and the next bounded action.

The workflow must never depend on a model remembering another chat.

---

## Core Principle

Every material handoff must answer:

```text
WHAT WAS THE TASK?
WHAT EXACT REPOSITORY STATE WAS USED?
WHAT CHANGED?
WHAT WAS ACTUALLY TESTED?
WHAT DID THE TESTS PROVE?
WHAT REMAINS UNPROVEN?
WHAT ARCHITECTURAL ISSUES WERE FOUND?
WHAT SHOULD HAPPEN NEXT?
WHO SHOULD DO IT?
```

A claim without evidence is only a claim.

---

## Canonical Handoff Format

Use this format for material builder, validator, repair, and verifier work:

```text
STATUS:
TASK:
ROLE:
REVISION / SHA:
PARENT / BASE REVISION:
BRANCH:
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

A field may say `N/A` when genuinely not applicable.
Do not silently omit important fields.

---

## STATUS Vocabulary

Use one of:

```text
PASS
FAIL
PARTIAL
BLOCKED
```

### PASS

The assigned role completed its task and the evidence satisfies that role's acceptance criteria.

`PASS` does not automatically mean the subsystem is accepted.
A builder may PASS its implementation pass while independent audit is still required.

### FAIL

The task was completed far enough to show required acceptance criteria are not satisfied.

### PARTIAL

Meaningful progress was made, but the role's required task is incomplete.
State exactly what remains.

### BLOCKED

The agent cannot safely continue because a required dependency, repository condition, ambiguity, conflict, license issue, or missing evidence prevents progress.
State the blocker precisely.

---

## TASK

Restate the bounded task actually executed.
Do not rewrite it into something broader after the fact.

Good:

> Implement Phase 0 minimal browser boot and test harness only.

Bad:

> Improve the engine foundation.

---

## ROLE

Use a clear role such as:

```text
BUILDER
VALIDATOR
REPAIR
VERIFIER
LEARNING EXTRACTION
```

Material work should preserve role separation.

---

## REVISION / SHA

Report the exact revision being handed off.
Prefer a full commit SHA.

If work is intentionally uncommitted, state that explicitly and identify the base revision.

Never rely on phrases like:

```text
latest
current version
my branch
the fixed build
```

without an exact revision.

---

## PARENT / BASE REVISION

Report the revision the work started from.
This allows later agents to inspect the exact diff.

For an audit, identify the exact revision under audit.

---

## BRANCH

Report the branch when relevant.
The canonical default branch is `main`.

Do not infer branch identity from a folder name.

---

## WORKTREE STATE

State whether the worktree is:

```text
CLEAN
DIRTY
```

If dirty, list every known modified/untracked file or provide exact status output.

Distinguish pre-existing changes from changes made by the current agent.
Never silently overwrite unrelated human work.

---

## CHANGES

Summarize what materially changed.
Describe behavior and architecture, not only file operations.

Good:

> Added a minimal runtime entry point and dev-server boot path. No gameplay systems were added.

Bad:

> Edited 7 files.

---

## FILES

List exact files added, modified, deleted, or moved.
For large changes, group by subsystem while preserving exact paths.

---

## TESTS / CHECKS

Report exact commands and results.

Example:

```text
npm test
PASS — 12/12 tests

npm run build
PASS
```

Do not say `tests passed` without identifying what ran.
If a required check was not run, say why.

---

## RUNTIME / BROWSER EVIDENCE

Required when the task changes browser runtime behavior.

Report:

- launch command;
- target URL/path;
- browser if material;
- what was observed;
- whether console/runtime diagnostics were clean;
- automated browser result if applicable.

A successful build is not proof browser runtime behavior works.

---

## VISUAL EVIDENCE

Required for visually significant work.

Report:

- deterministic scene/camera if applicable;
- capture path/artifact;
- expected visual property;
- observed result;
- known defects.

Do not certify visual quality from code review alone.

---

## PERFORMANCE EVIDENCE

Required only when performance is part of the task or acceptance criteria.

Report:

- hardware/environment if material;
- metric definition;
- measurement method;
- baseline;
- result;
- threshold if one exists.

Do not invent performance budgets.

---

## DIAGNOSTICS

Report important diagnostics emitted during validation.
Distinguish expected warnings, accepted degradations, fatal errors, and unexpected console noise.

`Works on my machine` is not a diagnostic report.

---

## WHAT WORKS

State behavior demonstrated by evidence.
Do not expand beyond what was actually tested.

---

## WHAT DOES NOT

State known failures, intentionally missing behavior, and out-of-scope systems.
This field is important even on PASS.

A Phase 0 PASS should explicitly state that later engine systems are not yet implemented.

---

## ARCHITECTURAL FINDINGS

Report tension with:

- `CONSTITUTION.md`;
- `PRD.md`;
- `ARCHITECTURE.md`;
- subsystem specifications;
- dependency boundaries;
- runtime/full split;
- transform authority;
- identity;
- determinism;
- Studio separation;
- static export;
- Code-Reachable Law.

If none:

```text
ARCHITECTURAL FINDINGS:
NONE
```

Green tests do not erase architecture violations.

---

## VALIDATION FINDINGS

Validators classify findings as:

```text
BLOCKING
IMPORTANT
NON-BLOCKING
OPTIONAL
```

### BLOCKING

Acceptance cannot proceed.

Examples:

- architecture violation;
- incorrect runtime behavior;
- failing required test;
- missing mandatory evidence;
- silent data corruption;
- determinism violation in a deterministic path;
- invalid lifecycle/resource ownership;
- prohibited dependency;
- stale donor architecture copied into the canonical repo.

### IMPORTANT

Should be repaired before the tranche is frozen unless the human explicitly accepts deferral.

### NON-BLOCKING

A real issue that does not invalidate the current proof.

### OPTIONAL

An improvement or preference, not a defect.

Validators must distinguish defects from taste.

---

## UNRESOLVED

List anything still unknown or intentionally deferred.

Tag each item as one of:

```text
BLOCKS NEXT STEP
DEFERRED BY DESIGN
NEEDS HUMAN DECISION
NEEDS FUTURE PROOF
```

Do not let unresolved questions disappear between agents.

---

## DEPENDENCY / SHORTCUT CHECK

Explicitly report:

- new dependencies;
- removed dependencies;
- prohibited native-pipeline shortcuts;
- internal/private API shortcuts;
- direct donor-tree copying;
- unapproved global state;
- uncontrolled randomness;
- independent gameplay frame loops;
- transform-authority bypasses;
- hidden server requirements for ordinary exported games.

If none:

```text
DEPENDENCY / SHORTCUT CHECK:
No new dependencies or prohibited shortcuts found.
```

---

## PROVENANCE

Required whenever code is ported or materially adapted from another repository.

Record:

```text
SOURCE REPOSITORY:
SOURCE PATH:
SOURCE COMMIT:
LICENSE:
PORT / ADAPT / REFERENCE:
MATERIAL CHANGES:
ASSOCIATED TESTS:
```

If no donor code was used:

```text
PROVENANCE:
No donor code ported or materially adapted in this task.
```

Do not confuse conceptual inspiration with literal code copying.

---

## LEARNING IMPACT

Use one of:

```text
NONE

UPDATE EXISTING LESSON:
<path>

NEW LESSON JUSTIFIED:
<concept>

NEW EXAMPLE JUSTIFIED:
<example>
```

Learning work normally happens after implementation has survived acceptance.
Do not write speculative tutorials because a feature is merely planned.

---

## NEXT RECOMMENDED ROLE

Recommend the next role, not merely a model name.

Examples:

```text
VALIDATOR
REPAIR
VERIFIER
LEARNING EXTRACTION
HUMAN DECISION
```

The human/orchestrator chooses the actual model.

---

## WHY

Explain why the baton should move to that role.
Keep it concrete.

---

## PASTE THIS NEXT

For material workflow transitions, provide a complete paste-ready prompt for the next role.

It must include:

- role;
- objective;
- canonical repository;
- exact revision;
- required permanent docs;
- current evidence;
- allowed scope;
- forbidden changes;
- tests/checks;
- acceptance criteria;
- stop rule;
- required handoff format.

Do not write merely `please review this`.
The next agent should be able to operate from the prompt plus the repository.

---

# Builder Handoff Requirements

A builder must return:

- exact base revision;
- exact final revision or explicit uncommitted state;
- exact worktree status;
- changed files;
- commands run;
- test results;
- runtime evidence where required;
- known limitations;
- architecture concerns;
- dependencies/provenance;
- next recommended role.

Builder success means the implementation pass is complete.
It does not mean the subsystem is accepted.

---

# Validator Handoff Requirements

A validator must:

1. inspect the exact target revision;
2. inspect relevant permanent docs;
3. reproduce required checks where practical;
4. inspect implementation against architecture;
5. identify missing evidence;
6. classify findings;
7. avoid production repair unless explicitly authorized.

A validator may create temporary audit scripts or probes.
Do not commit them unless the work order explicitly makes them permanent tests.

A validator must not quietly fix what it is supposed to audit.

---

# Repair Handoff Requirements

A repair agent receives accepted findings.

It must:

- repair those findings;
- add or strengthen regression tests where appropriate;
- avoid unrelated scope;
- rerun affected checks;
- report exact revision;
- stop for re-audit after material changes.

---

# Verifier Handoff Requirements

The verifier independently confirms the exact audited state.

Prefer:

- clean checkout or clean detached worktree;
- documented install;
- documented Node version;
- documented build/test commands;
- fresh browser proof;
- exact capture procedure where relevant.

The verifier does not redesign.
If verification fails, return FAIL with reproduction evidence.
Do not fix while verifying.

---

# Acceptance Chain

For material work, the normal chain is:

```text
IMPLEMENTATION
→ VALIDATOR AUDIT
→ REPAIR IF NEEDED
→ VALIDATOR RE-AUDIT
→ INDEPENDENT VERIFICATION
→ HUMAN / ORCHESTRATOR ACCEPTANCE
```

Not every small change requires the full chain.
Major architectural, runtime, deterministic, visual, export, lifecycle, or public-API work normally does.

---

# Exact-State Rule

Every audit and verification task must identify the exact revision.

If a builder changes code after audit begins, the audit no longer applies to the new revision.

If a verifier tests a different revision than the audited revision, that verification does not close the audited state.

Do not hand-wave SHA drift.

---

# Evidence Rule

Different claims require different evidence.

```text
"builds"
→ build command

"unit behavior correct"
→ unit tests

"runs in browser"
→ browser proof

"looks correct"
→ deterministic capture / visual inspection

"deterministic"
→ repeated equivalent runs / hashes / controlled output

"cleans up resources"
→ lifecycle test / telemetry / explicit probe

"exports statically"
→ produced export booted through normal static hosting path

"public API is usable"
→ example or blind-consumer test
```

Use the cheapest evidence that actually proves the claim.

---

# No Self-Certification

An agent may report its own tests pass.
That is implementation evidence.
It is not independent acceptance.

No single model may silently act as builder, auditor, verifier, and final authority for the same material tranche.

---

# Human Integration Authority

The human project owner is the final integration authority.
Agents may recommend.
They do not redefine project law merely because their implementation preference differs.

If an active human instruction conflicts with permanent docs, report the conflict and identify which documents now require update.

---

# Handoff Compression Rule

Keep handoffs dense and factual.
Do not paste enormous reasoning transcripts.

Preserve:

- decisions;
- evidence;
- exact state;
- unresolved findings;
- next action.

Discard conversational archaeology.

---

# Example Builder Handoff

```text
STATUS:
PASS

TASK:
Bootstrap Phase 0 minimal browser/test foundation.

ROLE:
BUILDER

REVISION / SHA:
0123456789abcdef...

PARENT / BASE REVISION:
fedcba9876543210...

BRANCH:
main

WORKTREE STATE:
CLEAN

CHANGES:
Added minimal package/tooling baseline, browser entry point, and test harness.
No gameplay or Forge systems implemented.

FILES:
package.json
src/...
tests/...

TESTS / CHECKS:
npm test — PASS
npm run build — PASS

RUNTIME / BROWSER EVIDENCE:
npm run dev
Browser loaded expected minimal boot page.
No fatal console diagnostics.

VISUAL EVIDENCE:
N/A

PERFORMANCE EVIDENCE:
N/A

DIAGNOSTICS:
No fatal diagnostics.

WHAT WORKS:
Repository installs, builds, tests, and boots in browser.

WHAT DOES NOT:
Proof A gameplay systems are not implemented.

ARCHITECTURAL FINDINGS:
NONE

VALIDATION FINDINGS:
N/A — builder pass only.

UNRESOLVED:
Independent audit required.

DEPENDENCY / SHORTCUT CHECK:
No prohibited native-pipeline shortcuts.

PROVENANCE:
No donor code ported.

LEARNING IMPACT:
NONE

NEXT RECOMMENDED ROLE:
VALIDATOR

WHY:
The foundation now has builder evidence but has not been independently audited.

PASTE THIS NEXT:
<complete validator prompt>
```

---

# Final Rule

A good handoff should let a fresh agent answer:

> What exact machine state am I looking at, what has actually been proven, and what am I allowed to do next?

If it cannot, the handoff is incomplete.
