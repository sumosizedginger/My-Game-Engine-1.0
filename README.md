# My Game Engine 1.0

**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

My Game Engine 1.0 is a browser-first, code-native procedural game engine built for humans and AI to create, inspect, modify, test, and export complete games through deterministic, machine-readable systems.

This repository is a **greenfield implementation with an already-designed architecture**. It is informed by earlier prototypes and donor repositories, but it is not a conversion of those repositories and does not inherit their implementation history as canonical truth.

## Product Thesis

The engine asks a specific question:

> How far can humans and AI push complete game creation when the engine's native artifacts remain reachable, understandable, reproducible, and alterable through code?

The engine therefore treats definitions as source, compiled artifacts as build products, and runtime objects as transient instances.

```text
Definition
  -> compileDefinition()
  -> immutable artifact
  -> runtime.instantiate()
  -> transient runtime instance record
```

Gameplay realization is explicit: project code uses compiled configuration to spawn entities, register transforms, and render the game. The current minimal instantiation seam returns a record; it does not perform those steps automatically.

A native engine artifact should be constructible, inspectable, modifiable, serializable, reproducible, testable, and attributable to the definition/parameters/seed that produced it.

## Current Status

Accepted implementation now includes:

- Phase 0: repository and runtime foundation.
- A0: evaluation harness.
- Proof A: Pong, a tiny complete game.
- Proof B1: Motion Truth.
- Proof B2: Procedural Combat Room.
- Proof C: Bounded Procedural World.
- Proof D: Different Genre, a bounded 3D arcade racer.

Proof E is active: blind public-API usability and generality testing. It has not yet passed. Approved future architecture remains distinct from implemented public behavior.

Proofs pull architecture. We do not build the entire engine first and hope a game eventually fits it.

## Quick Start

Use Node 24.20.0. From this repository's root, run:

```bash
npm ci
npm test
npm run eval
npm run build
npm run dev
```

These commands install dependencies, run the test suite and six-target browser evaluator, build static output in `dist/`, and start the development server. Open [Pong](http://localhost:5173/?game=pong) to play the first complete game, or the [arcade racer](http://localhost:5173/?proof=d) for the 3D example. See the [learning index](docs/learn/README.md) for all documented game routes.

### Public Package Surfaces

The export contracts in [package.json](package.json) are:

| Import name | Current surface |
| --- | --- |
| `@sumosizedginger/my-game-engine-1.0` | Defaults to the runtime exports for ordinary game consumption. |
| `@sumosizedginger/my-game-engine-1.0/runtime` | Runtime and Gameplay Foundation primitives, without the definition compiler. |
| `@sumosizedginger/my-game-engine-1.0/full` | Runtime exports plus the accepted authoring/compiler seam: `compileDefinition` and `createEngineFull`. |

For example, project code in this repository can import:

```javascript
import { createRuntime, createEntityManager, createTransformManager }
  from '@sumosizedginger/my-game-engine-1.0/runtime';
import { compileDefinition }
  from '@sumosizedginger/my-game-engine-1.0/full';
```

These names describe package exports, not npm publication status. The current `/full` export does not re-export every generation subsystem; use the relevant public lesson for the implemented generation APIs.

### Build Your First Game

1. Follow [Building a Tiny Game](docs/learn/BUILDING_A_TINY_GAME.md), starting with section 3's explicit definition, artifact, runtime-record, entity, and transform construction.
2. Consult [Gameplay Foundation](GAMEPLAY_FOUNDATION.md) for the entity, transform, fixed-step, input, and state contracts used by that game.
3. Continue with [Building a Different Genre](docs/learn/BUILDING_A_DIFFERENT_GENRE.md) for scalar keyboard/controller input and the bounded 3D example.

## Repository Truth

`sumosizedginger/My-Game-Engine-1.0` is the machine.

Other repositories may be donors, references, experiments, or consumers. Donor code is never authoritative merely because it already exists. Candidate donor systems are classified individually as:

```text
PORT
ADAPT
REFERENCE
DROP
```

Any port or substantial adaptation must record source repository, source path, source commit SHA, license, what changed, why it was adopted, and associated tests.

## Core Architecture Direction

One codebase has two primary consumption modes:

```text
engine/runtime
```

For ordinary exported games. It contains what a game needs to instantiate compiled artifacts, run gameplay, render, handle input, run audio/FX, save/load when present, and use included runtime systems.

```text
engine/full
```

For Studio authoring or games that intentionally generate content at runtime. It includes `engine/runtime` plus Kiln and authoring/runtime generation compilers such as the Forges when those systems exist.

A tiny exported game should not ship the entire authoring/compiler toolchain by accident.

## First-Class Constraints

- Browser-first.
- Static-host export must remain a valid target for ordinary games.
- Keyboard and controller support are first-class; game logic consumes actions, not hard-coded physical keys.
- Fixed gameplay simulation plus variable rendering and interpolation.
- One authoritative transform writer per entity per simulation step.
- Runtime entity handles are generational and ephemeral; persistent IDs are serialized separately.
- Save/load is snapshot-first; replay is a separate deterministic debugging/recording system.
- Deterministic generation/gameplay uses explicit seeded randomness.
- Important failures emit machine-readable diagnostics and never disappear silently.
- DOM-first hybrid UI is preferred for ordinary HUD/menu/dialogue surfaces.
- WebGPU is the preferred rendering target; WebGL2 remains a meaningful fallback unless evidence changes that decision.
- Traditional DCC tools and remote finished-asset generators are not foundational native requirements.

## Toolchain

The required toolchain version is:

```text
Node 24.20.0
```

Use the commands in [Quick Start](#quick-start) to install, validate, build, and run the current repository.

## Documentation System

The initial repository contains 12 canonical project documents plus two thin model adapters.

Canonical authority:

- `README.md`
- `CONSTITUTION.md`
- `PRD.md`
- `ARCHITECTURE.md`
- `CONTEXT.md`
- `ROADMAP.md`
- `AGENTS.md`
- `HANDOFF_PROTOCOL.md`
- `DEPENDENCY_POLICY.md`
- `DEFINITION_OF_DONE.md`
- `TESTING_AND_VALIDATION.md`
- `DOCUMENTATION_MAP.md`

Model adapters:

- `CLAUDE.md`
- `GEMINI.md`

Model adapters are routing shims, not independent sources of truth.

The canonical durable set may grow to at most 21 project documents as real implementation earns subsystem specifications. Learning documentation, ADRs, and community/legal files are outside that canonical count.

Use `DOCUMENTATION_MAP.md` to read the smallest authoritative set required for the active task.

## Authority Order

When information conflicts, resolve it in this order:

1. Active explicit human instruction.
2. `CONSTITUTION.md`.
3. `PRD.md`.
4. `ARCHITECTURE.md`.
5. Applicable permanent subsystem specification.
6. `DEPENDENCY_POLICY.md`.
7. `DEFINITION_OF_DONE.md` and `TESTING_AND_VALIDATION.md`.
8. Accepted running evidence: tests, captures, proof games, diagnostics.
9. `ROADMAP.md`.
10. `CONTEXT.md`.
11. Temporary work orders, audits, and handoffs.

If permanent documentation and accepted implementation disagree, stop and report the conflict. Do not silently rewrite law to justify code and do not silently ignore accepted runtime evidence.

## Learning Repository Mission

The repository should eventually teach a new developer how the machine works while they use it.

Learning follows accepted reality:

```text
BUILD
-> TEST
-> RUN
-> AUDIT
-> REPAIR
-> REVALIDATE
-> ACCEPT
-> TEACH
```

Do not write speculative tutorials for APIs that do not exist.

Accepted proof games become curriculum examples. Where practical, examples participate in automated validation so tutorials double as regression pressure on the public API.

## Development Discipline

For material work:

```text
DEFINE
-> BUILD
-> TEST
-> RUN
-> CAPTURE
-> DIAGNOSE
-> AUDIT
-> REPAIR
-> REVALIDATE
-> FREEZE
```

No model may build, audit, verify, and accept its own material work in one uninterrupted act.

A builder saying `DONE` is not project acceptance.

## What Not To Do

Do not:

- describe this repository as a conversion of `my-engine-2`;
- clone a donor repository wholesale into the canonical tree;
- pre-create fake subsystem architecture to make the repo look complete;
- treat donor APIs as constitutional law;
- build speculative systems before a proof requires them;
- hide important runtime behavior behind opaque external services;
- introduce a proprietary gameplay scripting language when ordinary JavaScript can do the job;
- scatter uncontrolled `Math.random()` through deterministic systems;
- allow animation, physics, and gameplay to write the same transform without explicit authority;
- preserve temporary AI conversation history as permanent project truth;
- make learners read the entire architecture before seeing a first game run.

## Start Here

Game developers: start with [Quick Start](#quick-start) and [Build Your First Game](#build-your-first-game).

Product and architecture background: read `CONSTITUTION.md`, `PRD.md`, and the current section of `ROADMAP.md` as needed.

Coding/audit agents: read `AGENTS.md`, then use `DOCUMENTATION_MAP.md` to load task-specific authority.

Architecture work: read `CONSTITUTION.md`, `PRD.md`, `ARCHITECTURE.md`, and the applicable task-specific specification.

Validation work: read `DEFINITION_OF_DONE.md` and `TESTING_AND_VALIDATION.md` in addition to the active work order.

The repository is the machine. The docs describe it. The tests protect it. The examples demonstrate it. The lessons teach it.
