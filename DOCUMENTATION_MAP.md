# DOCUMENTATION_MAP.md

## Purpose

This file routes humans and AI agents to the **minimum authoritative context required for the active task** in **My Game Engine 1.0**.

Canonical repository:

`sumosizedginger/My-Game-Engine-1.0`

The repository is a **greenfield implementation** of an already-designed architecture.

This map exists to prevent two failures:

1. agents loading so much context that important rules are diluted;
2. agents acting on one document while missing a higher-authority constraint.

Use progressive disclosure.

Read the smallest complete document set that can govern the task.

---

# 1. Authority Order

If documents conflict, use this order:

```text
1. Active explicit human instruction

2. CONSTITUTION.md

3. PRD.md

4. ARCHITECTURE.md

5. Relevant permanent subsystem specification

6. DEPENDENCY_POLICY.md

7. DEFINITION_OF_DONE.md
   TESTING_AND_VALIDATION.md

8. Accepted running evidence

9. ROADMAP.md

10. CONTEXT.md

11. Temporary work orders, audits, handoffs, notes
```

If permanent documentation and accepted implementation conflict:

**STOP AND REPORT THE CONFLICT.**

Do not silently choose.

Do not rewrite permanent law merely to make existing code look correct.

---

# 2. Document Classes

Every documentation file should belong to one of these classes.

## AUTHORITATIVE SPEC

Defines what the project is, what must be true, or how a subsystem is architecturally constrained.

Examples:

- `CONSTITUTION.md`
- `PRD.md`
- `ARCHITECTURE.md`
- future subsystem specifications

These may govern implementation.

## OPERATIONAL POLICY

Defines how work is performed and accepted.

Examples:

- `AGENTS.md`
- `HANDOFF_PROTOCOL.md`
- `DEPENDENCY_POLICY.md`
- `DEFINITION_OF_DONE.md`
- `TESTING_AND_VALIDATION.md`
- `DOCUMENTATION_MAP.md`

## CONTEXT / ROADMAP

Explains history, current stage, risks, and sequencing.

Examples:

- `CONTEXT.md`
- `ROADMAP.md`

These do not outrank architecture.

## LEARNING

Teaches accepted public behavior.

Location:

`docs/learn/`

Entry points:

- `docs/learn/README.md`
- `docs/learn/BUILDING_A_TINY_GAME.md`

Learning documents do not override canonical architecture.

## ADR

Records a significant architecture decision and its rationale.

Location:

`docs/adr/`

ADRs are created only when a decision is significant enough to preserve.

## ARCHIVE

Historical material that may be worth retaining but is no longer active truth.

Location:

`docs/archive/`

Archived files do not govern implementation.

## MODEL ADAPTER

Tiny tool-specific entry files.

Examples:

- `CLAUDE.md`
- `GEMINI.md`

These route agents to the canonical docs.

They are not independent authorities.

---

# 3. Bootstrap Canonical Set

At repository bootstrap, the canonical project documentation is:

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

Model adapters:

```text
CLAUDE.md
GEMINI.md
```

Total physical Markdown files at bootstrap:

`14`

Canonical project-document count:

`12`

The model adapters do not count toward the canonical maximum.

---

# 4. Future Canonical Subsystem Documents

These are **approved document slots**, not proof that the corresponding implementation exists.

Create them only when implementation reaches the relevant proof.

Potential durable subsystem specifications:

```text
GAMEPLAY_FOUNDATION.md
GEOMETRY_FORGE.md
CHARACTER_FORGE.md
MOTION_FORGE.md
MATERIAL_FORGE.md
WORLD_FORGE.md
AUDIO_AND_FX.md
PERFORMANCE_AND_PROFILING.md
VISUAL_TARGETS_AND_BENCHMARKS.md
```

Maximum intended canonical project-document count:

`21`

Do not create these files early merely to fill the architecture.

A subsystem earns a permanent specification when real implementation makes one useful.

---

# 5. Always-Read Core for Material Work

For material production work, begin with:

```text
CONSTITUTION.md
PRD.md
ARCHITECTURE.md
AGENTS.md
DOCUMENTATION_MAP.md
```

Then load only the task-specific documents below.

For a tiny mechanical edit with no architecture impact, the active work order plus `AGENTS.md` and the directly relevant spec may be enough.

When uncertain, read the higher-authority document rather than guessing.

---

# 6. Phase 0 — Repository Foundation

Status meaning:

Phase 0 establishes the trustworthy greenfield repository foundation.

It does **not** implement the full engine.

Read:

```text
CONSTITUTION.md
PRD.md
ARCHITECTURE.md
ROADMAP.md
AGENTS.md
DEPENDENCY_POLICY.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
HANDOFF_PROTOCOL.md
```

Also read:

```text
CONTEXT.md
```

when inspecting donor lineage or explaining why prior repositories are not canonical.

Phase 0 concerns include:

- Node/toolchain pinning;
- package baseline;
- minimal source/test structure;
- browser/dev-server boot;
- minimal runtime skeleton;
- `engine/runtime` / `engine/full` direction;
- build/test/run commands;
- exact clean baseline.

Do not load future Forge documents because they should not exist yet.

---

# 7. A0 — Evaluation Harness

Read:

```text
CONSTITUTION.md
ARCHITECTURE.md
ROADMAP.md
AGENTS.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
HANDOFF_PROTOCOL.md
```

Focus:

- deterministic captures;
- browser automation;
- runtime diagnostics;
- telemetry;
- exact revision reporting;
- comparison/evaluation infrastructure.

Operational note:
See `TESTING_AND_VALIDATION.md` §22.1 for canonical evaluation operations (`npm run eval`, `artifacts/evaluation-report.json`, `artifacts/captures/`, and `src/eval/*` harness layout).

Do not expand gameplay merely because test infrastructure can support it.

---

# 8. Proof A — Tiny Complete Game

When Proof A begins, create/read:

```text
GAMEPLAY_FOUNDATION.md
```

Required set:

```text
CONSTITUTION.md
PRD.md
ARCHITECTURE.md
GAMEPLAY_FOUNDATION.md
AGENTS.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
DEPENDENCY_POLICY.md
```

Relevant concerns:

- entities;
- transforms;
- input actions;
- movement;
- collision;
- runtime variables;
- state;
- rules;
- scripts if needed;
- DOM UI;
- tiny Kiln seam;
- static export;
- controller/keyboard abstraction.

Operational note:
See `TESTING_AND_VALIDATION.md` §22.1 for evaluation harness operations covering Proof A targets, checks (`pongBoot`, `pongGameplay`, `pongScoring`), and capture fixtures.

Learning note:
See `docs/learn/BUILDING_A_TINY_GAME.md` for the accepted learning extraction and architecture walkthrough of Proof A.

Do not import later character/world complexity.

---

# 9. Proof B1 — Motion Truth

When B1 begins, create/read as earned:

```text
CHARACTER_FORGE.md
MOTION_FORGE.md
```

Also read:

```text
CONSTITUTION.md
ARCHITECTURE.md
AGENTS.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
DEPENDENCY_POLICY.md
```

Relevant concerns:

- canonical procedural humanoid definition;
- semantic landmarks;
- skeleton generation;
- procedural skin weights;
- one parameterized walk;
- grounding;
- minimal IK;
- root motion;
- transform-authority compliance;
- deformation quality;
- deterministic visual evaluation.

Do not hide failed motion behind unrelated effects or environments.

---

# 10. Proof B2 — Procedural Combat Room

Create/read as earned:

```text
GEOMETRY_FORGE.md
CHARACTER_FORGE.md
MOTION_FORGE.md
MATERIAL_FORGE.md
GAMEPLAY_FOUNDATION.md
```

Also read:

```text
CONSTITUTION.md
ARCHITECTURE.md
DEPENDENCY_POLICY.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
```

Relevant concerns:

- generated room;
- geometry semantics;
- surface/region identity;
- procedural character;
- motion;
- minimal materials;
- collision;
- combat;
- audio/FX hooks if required;
- browser/runtime evidence.

Use direct procedural construction when simpler than CSG.

---

# 11. Proof C — Bounded Procedural World

When C begins, create/read:

```text
WORLD_FORGE.md
MATERIAL_FORGE.md
```

Also read relevant:

```text
GAMEPLAY_FOUNDATION.md
CHARACTER_FORGE.md
MOTION_FORGE.md
CONSTITUTION.md
ARCHITECTURE.md
DEPENDENCY_POLICY.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
```

Relevant concerns:

- bounded terrain;
- WorldRecipe;
- WorldFieldCache;
- environmental fields;
- deterministic vegetation;
- WorldFieldQuery;
- WorldVolumeQuery;
- grounding;
- world collision;
- traversal.

Do not prebuild huge-world streaming.

---

# 12. Proof D — Different Genre

Read:

```text
CONSTITUTION.md
PRD.md
ARCHITECTURE.md
GAMEPLAY_FOUNDATION.md
```

Then load only subsystem specs required by the chosen genre.

Primary question:

> Can a mechanically different game be built without rewriting foundational engine laws?

Inspect whether the proof requires fundamental changes to:

- entity identity;
- fixed simulation;
- event dispatch;
- transform ownership;
- state;
- save model;
- public API boundaries.

A genre-specific feature defaults to project code.

Do not promote it into core merely because one proof needs it.

---

# 13. Proof E — Blind API Generality Test

Fresh consumer should receive only the public-facing material necessary to use the engine.

Primary inputs should eventually include:

```text
README.md
public API/reference documentation
docs/learn/
build/run instructions
engine package
```

Do not provide internal architecture reasoning unless the test explicitly targets engine contributors.

Internal validator/orchestrator should read:

```text
PRD.md
ARCHITECTURE.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
```

Purpose:

- expose missing public APIs;
- expose hidden state;
- expose poor naming;
- expose undocumented assumptions;
- expose unnecessary boilerplate.

If users repeatedly need internal access, determine whether the API or documentation is wrong.

Do not merely explain a terrible API more loudly.

---

# 14. Donor Inspection / Porting

When inspecting any donor, read:

```text
CONTEXT.md
CONSTITUTION.md
ARCHITECTURE.md
DEPENDENCY_POLICY.md
AGENTS.md
```

Then inspect the actual donor repository and license.

Classify each candidate:

```text
PORT
ADAPT
REFERENCE
DROP
```

Do not classify entire repositories as one unit when individual systems differ.

Required adoption questions:

```text
Does it match current architecture?

Is it generic enough?

Is the API appropriate?

Are its tests useful?

Would a cleaner greenfield implementation be better?

Does it import unwanted historical baggage?

Is the license compatible?

Can provenance be recorded exactly?
```

Donor code has evidence priority, not constitutional priority.

---

# 15. Dependency Admission

For any new production dependency, read:

```text
DEPENDENCY_POLICY.md
CONSTITUTION.md
ARCHITECTURE.md
```

If the dependency affects tests or evidence, also read:

```text
TESTING_AND_VALIDATION.md
```

Do not add a dependency before checking:

- purpose;
- license;
- maintenance/risk;
- architectural boundary;
- bundle/runtime impact;
- deterministic implications;
- fallback implications;
- whether native code would be simpler.

---

# 16. Runtime / Simulation Changes

Read:

```text
CONSTITUTION.md
ARCHITECTURE.md
GAMEPLAY_FOUNDATION.md
TESTING_AND_VALIDATION.md
DEFINITION_OF_DONE.md
```

when `GAMEPLAY_FOUNDATION.md` exists.

Pay special attention to:

- fixed-step simulation;
- transform authority;
- input snapshot timing;
- events;
- timers;
- state;
- deterministic RNG;
- entity lifetime;
- pause/time scale.

No subsystem creates an independent gameplay frame loop.

---

# 17. Identity / Persistence / Save Work

Read:

```text
CONSTITUTION.md
ARCHITECTURE.md
GAMEPLAY_FOUNDATION.md
TESTING_AND_VALIDATION.md
```

Relevant laws:

- runtime `EntityHandle(index, generation)`;
- handles are not serialized;
- persistent IDs exist for persistent relationships/state;
- pooling increments generations;
- snapshot-first saves;
- replay is separate;
- canonical definition hashing is shared where specified.

---

# 18. Geometry Work

When available, read:

```text
GEOMETRY_FORGE.md
ARCHITECTURE.md
CONSTITUTION.md
DEPENDENCY_POLICY.md
TESTING_AND_VALIDATION.md
```

Relevant concepts:

- definitions are source;
- compiled geometry is artifact;
- semantic identity must not depend on brittle vertex index ranges;
- use `regionId`, `surfaceId`, and appropriate flags;
- use `SemanticLandmarks` for stable named definition-space anchors;
- topology-changing operations must define semantic propagation;
- silent semantic inference is prohibited.

---

# 19. Character Work

When available, read:

```text
CHARACTER_FORGE.md
GEOMETRY_FORGE.md
MOTION_FORGE.md
ARCHITECTURE.md
TESTING_AND_VALIDATION.md
VISUAL_TARGETS_AND_BENCHMARKS.md
```

only when those files have been legitimately created.

Primary questions include:

- anatomy/shape plausibility;
- landmark stability;
- skeleton generation;
- skinning;
- deformation;
- motion quality;
- grounding;
- aesthetic failure criteria.

Do not assume planned files exist.

---

# 20. Motion Work

When available, read:

```text
MOTION_FORGE.md
CHARACTER_FORGE.md
ARCHITECTURE.md
TESTING_AND_VALIDATION.md
```

Motion should operate through semantic representations and compiled/runtime systems.

No LLM computes bones frame-by-frame.

Animation does not bypass transform authority.

---

# 21. Material / Rendering Work

When available, read:

```text
MATERIAL_FORGE.md
ARCHITECTURE.md
DEPENDENCY_POLICY.md
TESTING_AND_VALIDATION.md
VISUAL_TARGETS_AND_BENCHMARKS.md
```

Relevant architecture:

- WebGPU preferred;
- WebGL2 meaningful fallback;
- TSL/shared material logic where useful;
- procedural inputs may be baked through Kiln;
- avoid expensive runtime procedural work merely for philosophical purity.

Do not import a renderer architecture from a donor wholesale.

---

# 22. World Work

When available, read:

```text
WORLD_FORGE.md
MATERIAL_FORGE.md
ARCHITECTURE.md
DEPENDENCY_POLICY.md
TESTING_AND_VALIDATION.md
PERFORMANCE_AND_PROFILING.md
```

only if the performance document has been earned.

World query split:

```text
WorldFieldQuery
→ cheap/bulk 2.5D environmental information

WorldVolumeQuery
→ authoritative 3D spatial truth
```

Anything requiring correctness beneath overhangs, inside caves, or across stacked floors uses volumetric truth.

---

# 23. Audio / FX Work

When the subsystem becomes substantial, read:

```text
AUDIO_AND_FX.md
ARCHITECTURE.md
DEPENDENCY_POLICY.md
TESTING_AND_VALIDATION.md
```

Before the dedicated file exists, architecture plus implementation/tests govern the small system.

Do not create an industrial graph system because the roadmap mentions future effects.

---

# 24. Performance Work

When real performance work begins, create/read:

```text
PERFORMANCE_AND_PROFILING.md
```

Also read:

```text
ARCHITECTURE.md
TESTING_AND_VALIDATION.md
DEFINITION_OF_DONE.md
```

Performance claims require measurements.

Do not invent budgets before a baseline exists.

---

# 25. Visual Quality Work

When a stable visual bar becomes necessary, create/read:

```text
VISUAL_TARGETS_AND_BENCHMARKS.md
```

Also read relevant subsystem specs and:

```text
TESTING_AND_VALIDATION.md
DEFINITION_OF_DONE.md
```

Visual acceptance requires controlled runtime evidence.

Code inspection alone cannot certify appearance.

---

# 26. Static Export Work

Read:

```text
PRD.md
ARCHITECTURE.md
GAMEPLAY_FOUNDATION.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
DEPENDENCY_POLICY.md
```

when applicable.

Required product direction:

```text
Project
→ compile/bake
→ static JS/assets/definitions
→ static host
→ browser
```

Ordinary exported games must not require Studio or a mandatory game server merely to boot.

---

# 27. Studio Integration Work

Read:

```text
CONSTITUTION.md
PRD.md
ARCHITECTURE.md
CONTEXT.md
```

Then inspect the current Studio contract/repository.

Boundary:

```text
GUI / CLI / AI / Tests
→ Project Operations
→ Project Data
→ Runtime Adapter
→ My Game Engine 1.0
→ Game
```

Studio is separate.

Exported games do not depend on Studio.

The engine owns runtime truth.

---

# 28. Learning Extraction

Only after a public behavior/proof is accepted, read:

```text
README.md
DOCUMENTATION_MAP.md
relevant canonical subsystem specification
relevant public API implementation
relevant accepted example/proof
```

Create/update:

```text
docs/learn/
examples/
```

according to actual accepted behavior.

Learning material must:

- use public APIs;
- build/run where applicable;
- state prerequisites;
- produce a real outcome;
- explain why the engine behaves that way;
- avoid temporary build archaeology.

Canonical docs describe the machine.

Lessons teach the machine.

---

# 29. ADR Creation

Create an ADR only for a significant decision worth preserving.

Before creating one, ask:

```text
Will a future maintainer need to know why this architectural choice was made?

Were multiple viable options considered?

Would losing the rationale invite repeated redesign?
```

If no, do not create an ADR.

ADRs should record:

- context;
- decision;
- alternatives;
- consequences;
- status;
- relevant revision/date.

ADRs do not replace current canonical specs.

If a decision changes current architecture, update the authoritative architecture/spec as part of the same accepted tranche.

---

# 30. Validation / Audit

Validator reads:

```text
CONSTITUTION.md
ARCHITECTURE.md
AGENTS.md
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
HANDOFF_PROTOCOL.md
```

plus:

- the task-specific subsystem specs;
- the exact work order;
- the exact target revision.

Validator should not load unrelated future design material.

Validator must separate:

```text
BLOCKING
IMPORTANT
NON-BLOCKING
OPTIONAL
```

---

# 31. Repair Work

Repair agent reads:

```text
the accepted audit findings
the exact audited revision
the relevant canonical specs
TESTING_AND_VALIDATION.md
DEFINITION_OF_DONE.md
HANDOFF_PROTOCOL.md
```

Repair the findings.

Do not reopen the entire design unless the finding proves an architectural contradiction.

After material repair, stop for re-audit.

---

# 32. Independent Verification

Verifier reads:

```text
the exact audited revision
the relevant build/run instructions
DEFINITION_OF_DONE.md
TESTING_AND_VALIDATION.md
HANDOFF_PROTOCOL.md
```

and only enough architecture/spec context to know the required behavior.

Prefer clean checkout/worktree.

Verifier does not redesign or repair.

---

# 33. README Routing

`README.md` is the human entry point.

It should route:

```text
What is this?
→ README.md

What laws govern it?
→ CONSTITUTION.md

What must the product do?
→ PRD.md

How is it organized?
→ ARCHITECTURE.md

What stage are we in?
→ ROADMAP.md

Why does this project exist / where did it come from?
→ CONTEXT.md

How should an agent work here?
→ AGENTS.md

How do I decide what to read?
→ DOCUMENTATION_MAP.md

How is work accepted?
→ DEFINITION_OF_DONE.md
→ TESTING_AND_VALIDATION.md

How do agents pass work?
→ HANDOFF_PROTOCOL.md

Can I add this library?
→ DEPENDENCY_POLICY.md

How do I learn to build with it?
→ docs/learn/README.md
  when learning material exists
```

---

# 34. Do Not Invent Missing Documents

If this map references a future subsystem document that does not yet exist:

that means the subsystem has not yet earned that permanent specification.

Do not fabricate the missing file in the middle of an unrelated task.

If the current work genuinely reaches that subsystem, the orchestrator should explicitly authorize creation of the spec.

---

# 35. Do Not Treat This Map as Architecture

This file routes context.

It does not define subsystem behavior.

If this map and `ARCHITECTURE.md` disagree about architecture:

`ARCHITECTURE.md` wins.

If this map and `CONSTITUTION.md` disagree about project law:

`CONSTITUTION.md` wins.

Fix the map afterward.

---

# 36. Flash-Model Reading Rule

For smaller-context or faster models:

1. read the active work order;
2. read `AGENTS.md`;
3. read this map;
4. load the exact documents named for that task;
5. inspect the relevant code;
6. do not infer missing architecture from filenames or donor repositories.

When reporting work, distinguish explicitly:

```text
DOCUMENTED
IMPLEMENTED
TESTED
OBSERVED
INFERRED
NOT YET IMPLEMENTED
```

This distinction is mandatory whenever ambiguity could cause an agent to mistake future architecture for current code.

---

# 37. Final Routing Law

Use the smallest context that still contains every governing constraint.

Too little context causes architecture drift.

Too much context causes instruction dilution.

`DOCUMENTATION_MAP.md` exists to keep the agent between those two failures.
