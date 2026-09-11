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
- Proof E: Blind API Generality Test (Order Five, a bounded 3D collection/puzzle game).

- AI-ASSET-FOUNDATION-001: engine-owned AI-native asset authoring.
- SCENE-COMPOSITION-001: scene and composition foundation.
- PUBLIC-SURFACE-001: accepted Forge capability reachable through the package — **built, awaiting validation**.

Proof E is accepted: a fresh blind participant successfully built Order Five through the documented public engine surface without core engine modification or private API bypass. This provides strong evidence of runtime and compiler public coherence, though it represents generality evidence rather than universal genre support.

AI-ASSET-FOUNDATION-001 is accepted at revision `798bd89`, merged as `07e555a` after independent verification. It delivered engine-owned MeshIR with a canonical byte codec, generic modeling verbs, semantic parts and anchors, Material Forge definitions, the Previewable contract, the Preview Lab, an asset-relative canonical view solver, `AssetPreviewManifest` with portable structural identity, and deterministic canonical capture. Its forcing consumer, the CINDER MK-I capability benchmark, produced 227 semantic parts, 7,236 triangles and 13 materials entirely through the public authoring verbs.

Proofs pull architecture. We do not build the entire engine first and hope a game eventually fits it.

### Where this is going

The engine is additionally intended to become a **publicly released, general-purpose** browser engine usable by other developers, capable over time of supporting games from small single-player projects to large persistent worlds.

That target is recorded in [PRD.md](PRD.md) Part II and its cross-system boundaries in [ARCHITECTURE.md](ARCHITECTURE.md) Part II.

**Almost none of it is implemented.** Physics, animation graphs, story and quest graphs, timelines, audio, runtime UI, save and persistence, asset import, streaming, networking and accessibility are product *direction*, not capability. Scene composition is the first of them to have an accepted foundation, merged at `c8afd65` after independent verification. Each is earned by a real forcing consumer and accepted through the normal proof, audit and verification chain. Nothing in this repository should be read as advertising a system that does not exist.

## Quick Start

Use Node 24.21.0. From this repository's root, run:

```bash
npm ci
npm test
npm run eval
npm run build
npm run dev
```

These commands install dependencies, run the test suite and six-target browser evaluator, build static output in `dist/`, and start the development server. Open [Pong](http://localhost:5173/?game=pong) to play the first complete game, the [arcade racer](http://localhost:5173/?proof=d) for the 3D racing proof, or [Order Five](http://localhost:5173/?game=sequence) for the blind public-API collection puzzle. See the [learning index](docs/learn/README.md) for all documented game routes.

### Public Package Surfaces

The export contracts in [package.json](package.json) are:

| Import name | Current surface |
| --- | --- |
| `@sumosizedginger/my-game-engine-1.0` | Defaults to the runtime exports for ordinary game consumption. |
| `@sumosizedginger/my-game-engine-1.0/runtime` | Runtime and Gameplay Foundation primitives, without the definition compiler. Includes `instantiateScene` for loading compiled scenes. |
| `@sumosizedginger/my-game-engine-1.0/full` | Runtime exports plus the full accepted authoring surface — see below. |

For example, project code in this repository can import:

```javascript
import { createRuntime, createEntityManager, createTransformManager }
  from '@sumosizedginger/my-game-engine-1.0/runtime';
import { compileDefinition }
  from '@sumosizedginger/my-game-engine-1.0/full';
```

These package export names resolve under Node and Vite package self-reference. When developing games inside this repository, importing the same public barrel files by repository-relative path (for example, `../../runtime/index.js` or `../../full/index.js`) is also legitimate, because those files are the direct implementation targets of the public package exports.

These names describe package exports, not npm publication status.

### What `/full` provides

| Area | Capability |
| --- | --- |
| Definition seam | `compileDefinition`, `createEngineFull` |
| AI-native assets | MeshIR and its canonical codec, the modeling verbs, semantic anchors, the Previewable contract, the Preview Lab, the canonical view solver, `AssetPreviewManifest` |
| Scene composition | `createSceneDefinition`, `validateSceneDefinition`, `compileScene`, `encodeScene` / `decodeScene`, affine primitives |
| Geometry Forge | `createRoomDefinition`, `generateProceduralRoom`, `ROOM_PRESETS`, `ROOM_PARAMETER_BOUNDS`, and the semantic vocabulary (`SURFACE_TYPES`, `CONSTRAINT_FLAGS`, `GEOMETRY_REGIONS`) |
| Character Forge | `createCharacterDefinition`, `buildHumanoidCharacter`, `computeSemanticLandmarks`, `HUMANOID_PRESETS`, `HUMANOID_PARAMETER_BOUNDS`, `CHARACTER_REGIONS` |
| Motion Forge | `createMotionDefinition`, `createLocomotionEvaluator`, `solveTwoBoneIK`, `computeGaitFootPlacement`, `commitRootMotionIntent`, `MOTION_PRESETS` |
| World Forge | `createWorldRecipe`, `generateWorld`, `createWorldFieldQuery`, `createWorldVolumeQuery`, `worldDataHash`, `WORLD_PARAMETER_BOUNDS` |
| Material Forge | `createMaterialDefinition`, `MATERIAL_PRESETS`, `MATERIAL_PARAMETER_BOUNDS` |

`AUTHORING_SURFACE.forges` describes each subsystem — its capabilities, presets, parameter bounds, conventions and deliberate exclusions — as machine-readable data, so a tool or an agent can discover the surface instead of guessing at it.

### What `/full` deliberately does NOT provide

Renderer primitives stay internal so the presentation layer remains replaceable: `toBufferGeometry`, `buildBoxGeometry`, `createTerrainGeometry` and `compileMaterial` are not exported. A Forge result may *carry* renderer output — `generateWorld` returns a terrain geometry, `buildHumanoidCharacter` returns a skinned mesh — but the builders that produced it are not part of the contract.

Node-only evaluation machinery is never public. Character assembly steps and the canonical bone table are internal or deferred; a built character already exposes `bonesByName`.

**Results that own renderer resources must be disposed by their consumer.** `generateWorld(...).dispose()`, and the geometry and material on a built character.

### Authoring is not runtime

The generation capability above lives in `/full` only. An exported game instantiates compiled content through `/runtime` and does not carry the generators — `CONSTITUTION.md` §5. `examples/public-surface-cell/` is a worked example that uses nothing but the package specifier.

### Build Your First Game

1. Follow [Building a Tiny Game](docs/learn/BUILDING_A_TINY_GAME.md), starting with section 3's explicit definition, artifact, runtime-record, entity, and transform construction.
2. Consult [Gameplay Foundation](GAMEPLAY_FOUNDATION.md) for the entity, transform, fixed-step, input, and state contracts used by that game.
3. Continue with [Building a Different Genre](docs/learn/BUILDING_A_DIFFERENT_GENRE.md) for scalar keyboard/controller input and the bounded 3D example.
4. Study [Building an Unplanned Game](docs/learn/BUILDING_AN_UNPLANNED_GAME.md) to see how a fresh participant built an unplanned 3D game using only public documentation and package exports.

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
Node 24.21.0
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

The **core** canonical durable set may grow to at most 21 project documents as real implementation earns subsystem specifications. Six have been earned so far — `GAMEPLAY_FOUNDATION.md`, `GEOMETRY_FORGE.md`, `CHARACTER_FORGE.md`, `MOTION_FORGE.md`, `MATERIAL_FORGE.md` and `WORLD_FORGE.md` — and they remain at repository root.

Earned subsystem specifications live under `docs/spec/` and are **outside** the core count, so the engine can grow subsystems without growing the set of documents every task must read. It currently holds one document, [docs/spec/scene.md](docs/spec/scene.md), earned by SCENE-COMPOSITION-001. Learning documentation, ADRs, model adapters, and community and legal files are also outside the core count.

See `CONSTITUTION.md` §29 for the law and `DOCUMENTATION_MAP.md` §4 for the routing.

Use `DOCUMENTATION_MAP.md` to read the smallest authoritative set required for the active task.

## Authority Order

When information conflicts, resolve it in this order:

1. Active explicit human instruction.
2. `CONSTITUTION.md`.
3. `PRD.md`.
4. `ARCHITECTURE.md`.
5. Applicable permanent subsystem specification — the grandfathered root specifications and any earned specification under `docs/spec/`, equal in authority within their own subsystem.
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
