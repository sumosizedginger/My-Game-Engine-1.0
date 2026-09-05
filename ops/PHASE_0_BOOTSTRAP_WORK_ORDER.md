# PHASE_0_BOOTSTRAP_WORK_ORDER.md

**Artifact type:** Temporary operational work order; not canonical project law

# ROLE

You are the **Phase 0 Builder** for My Game Engine 1.0.

You implement the repository foundation only.

You are not the auditor.
You are not the verifier.
You are not the final acceptance authority.

# CANONICAL REPOSITORY

`sumosizedginger/My-Game-Engine-1.0`

Default branch:

`main`

This repository is a **greenfield implementation repository with an already-designed architecture**.

It is NOT a conversion of:

- `sumosizedginger/my-engine-2`;
- original `sumosizedginger/My-Engine`;
- My Engine Studio;
- any donor/reference repository.

Do not preserve donor repository structure merely because it exists.

Do not import donor production code during this work order by default.

# PRIMARY OBJECTIVE

Bootstrap the empty canonical repository into the smallest trustworthy foundation from which A0 and Proof A can begin.

The completed Phase 0 repository must:

1. contain the approved permanent bootstrap documentation;
2. pin the approved Node toolchain;
3. install reproducibly;
4. expose clear build/test/dev commands;
5. contain a minimal source/test structure;
6. build successfully;
7. run a minimal browser/dev-server proof;
8. establish the architectural seam/direction for `engine/runtime` and `engine/full` without fabricating future Forge implementations;
9. contain no gameplay feature implementation beyond what is strictly necessary to prove the repository boots;
10. return an exact clean foundation revision for independent audit.

# REQUIRED READING

Read these before implementation:

1. `CONSTITUTION.md`
2. `PRD.md`
3. `ARCHITECTURE.md`
4. `ROADMAP.md`
5. `AGENTS.md`
6. `DEPENDENCY_POLICY.md`
7. `DEFINITION_OF_DONE.md`
8. `TESTING_AND_VALIDATION.md`
9. `DOCUMENTATION_MAP.md`
10. `HANDOFF_PROTOCOL.md`

Use `CONTEXT.md` only for lineage/donor context.

Do not treat `CONTEXT.md` as architecture law.

# STATE DISCIPLINE

Before modifying anything, inspect and preserve for handoff:

```text
branch
HEAD SHA if one exists
worktree state
existing files
existing package/tooling files
```

The repository is expected to be new/empty, but inspect it instead of assuming.

If it is not empty, do not delete or overwrite unexplained human work.

# TOOLCHAIN

Target:

`Node 24.19.0`

unless a concrete incompatibility is demonstrated.

Pin it consistently.

# DOCUMENTATION

The bootstrap must contain exactly these 12 canonical project documents:

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

And these two model adapters:

```text
CLAUDE.md
GEMINI.md
```

Do not create future subsystem specs during this work order.
Do not create speculative learning lessons.
Do not create ADRs unless bootstrap forces a genuinely significant architecture decision.

# MINIMAL REPOSITORY STRUCTURE

Create only structure justified by current implementation.

Conceptual target:

```text
/
├── <14 bootstrap Markdown files>
├── package.json
├── package-lock.json
├── .gitignore
├── .nvmrc
├── .node-version
├── src/
├── tests/
├── examples/
└── docs/
    ├── learn/
    ├── adr/
    └── archive/
```

This is conceptual, not permission to create decorative empty directories.

# PACKAGE / BUILD BASELINE

Choose the smallest browser-first JavaScript/TypeScript tooling that satisfies the canonical docs.

Before adding any package, apply `DEPENDENCY_POLICY.md`.

Do not install a framework merely to display a boot page.
Do not turn Phase 0 into bundler research.
Do not perform unrelated major dependency upgrades.

# REQUIRED PHASE 0 IMPLEMENTATION

Implement only enough to demonstrate:

```text
install
→ test
→ build
→ dev/browser boot
```

The runtime skeleton should be intentionally small.

The architecture must leave a clean direction for:

```text
engine/runtime
engine/full
```

but Phase 0 must not fabricate implementations for:

```text
Kiln
Geometry Forge
Character Forge
Motion Forge
Material Forge
World Forge
```

A clean seam is good.
A forest of placeholder classes is not.

# BROWSER PROOF

Provide a minimal browser-visible proof that the repository boots.

The page may be extremely simple.

Required evidence:

- exact command;
- exact URL/path;
- successful load;
- no fatal browser console error;
- browser/runtime evidence from the tooling selected for Phase 0.

A successful build alone does not prove browser runtime behavior.

# TEST INFRASTRUCTURE

Establish the smallest useful automated test baseline.

At minimum prove:

- a test runner executes;
- a trivial production-facing contract can be tested;
- the test command returns correct success/failure status.

Do not inflate test count with meaningless assertions.

# BUILD INFRASTRUCTURE

Provide one documented production build command.

The build must succeed from a clean install.

Full Proof A static-export behavior is not required yet.

# CI READINESS

Commands should be suitable for later CI use.

Do not build an elaborate CI matrix unless explicitly required.

# ENGINE/RUNTIME AND ENGINE/FULL

The permanent architecture requires two consumption modes.

During Phase 0, establish only the seam/direction necessary to prevent later accidental coupling.

Do not duplicate code between entry points.
Do not make ordinary runtime consumers transitively import future compiler/Forge dependencies.

# FORBIDDEN CHANGES

Do NOT:

- begin A0;
- begin Proof A;
- implement Pong;
- implement gameplay foundation beyond minimal boot needs;
- port Geometry Kernel;
- port canonical humanoid;
- port Skeleton Forge;
- port original My Engine collision/audio/FX;
- implement a real Kiln;
- implement any Forge;
- add Rapier;
- add Recast;
- add Manifold;
- add Super Terrain/Sylva production code;
- build Studio integration;
- create a custom scripting language;
- create ECS infrastructure;
- create save/replay systems;
- create learning curriculum;
- create speculative plugin architecture;
- redesign approved architecture;
- copy donor trees wholesale;
- modify donor repositories.

# DONOR RULE

Donor inspection for evidence is permitted.

If code is copied or materially adapted despite the default prohibition, record:

```text
SOURCE REPOSITORY
SOURCE PATH
SOURCE COMMIT SHA
LICENSE
PORT / ADAPT
WHY IT WAS NECESSARY
MATERIAL CHANGES
ASSOCIATED TESTS
```

If exact provenance cannot be established, do not adopt the code.

# FLASH-MODEL EXECUTION RULE

Do not infer missing requirements.

For major claims, distinguish:

```text
DOCUMENTED
IMPLEMENTED
TESTED
OBSERVED
INFERRED
NOT YET IMPLEMENTED
```

If architecture describes a future system, do not create it unless this work order explicitly requires it.

When multiple choices satisfy Phase 0, choose the smallest one that preserves the documented seams.

Avoid speculative abstraction.

# REQUIRED CHECKS

Run and report the exact available equivalents of:

```text
node --version
npm --version
npm ci
npm test
npm run build
npm run dev
git status
git diff --check
```

For browser proof:

- launch the dev server;
- load the documented URL;
- confirm expected minimal output;
- inspect fatal console/page errors.

Report exact commands and outcomes.

# ACCEPTANCE CRITERIA

Builder pass is complete only when all are true:

1. canonical repository identity is correct;
2. all 14 bootstrap Markdown files are present;
3. no document describes this repo as a conversion of My Engine 2;
4. Node `24.19.0` is pinned unless a concrete incompatibility is documented;
5. clean install succeeds;
6. tests succeed;
7. production build succeeds;
8. minimal browser proof succeeds;
9. no fatal diagnostics remain;
10. runtime/full direction is represented without fabricated future systems;
11. no unapproved donor code was imported;
12. no later proof was started;
13. final worktree state is exact and reported;
14. foundation is committed to one exact revision;
15. complete builder handoff is returned.

# COMMIT

Create one coherent Phase 0 foundation commit after checks pass.

Use a clear commit message.

Report the full resulting SHA.

# STOP RULE

STOP after Phase 0 foundation is complete.

Do not begin A0.
Do not begin Proof A.
Do not keep going merely because capacity remains.

If blocked by an architecture/document conflict, stop and report it.

If a dependency/license question cannot be resolved, stop before adoption.

If unexpected pre-existing human work exists, preserve it and report the discrepancy.

# REQUIRED HANDOFF

Return exactly:

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

For this task:

```text
ROLE:
BUILDER
```

If the builder pass succeeds:

```text
NEXT RECOMMENDED ROLE:
VALIDATOR
```

Include a complete paste-ready validator prompt targeting the exact final SHA.

# FINAL REMINDER

The goal is the **smallest boring trustworthy foundation** on which the real engine proofs can begin.

Build the foundation.
Prove it boots.
Prove it tests.
Freeze the exact state.
Stop.
