# MY GAME ENGINE 1.0 — COMPLETED WORK ORDER (HISTORICAL)

## AI-NATIVE CONTENT PIPELINE — AI-ASSET-FOUNDATION-001

| Field | Value |
| --- | --- |
| Document class | **TEMPORARY WORK ORDER** (see `DOCUMENTATION_MAP.md` §2) |
| Document status | **COMPLETE — RETAINED FOR REFERENCE** |
| Authority | **Subordinate to every permanent document.** This file does not define architecture. |
| Supersedes | The architecture-alignment audit request formerly held at this path (preserved in git history) |
| Audit gate | **SATISFIED** — the A–G repository audit was delivered and accepted |
| Tranche | **AI-ASSET-FOUNDATION-001** |
| Implementation status | **COMPLETE, INDEPENDENTLY VERIFIED, HUMAN ACCEPTED AND MERGED** |
| Accepted implementation revision | `798bd89c006f20f0b9a9f20b05443b6493436d14` |
| Accepted merge commit | `07e555af55f5ee61f8fbef7fbd2da90d6d782419` |
| Canonical repository | `sumosizedginger/My-Game-Engine-1.0` |
| Last revised | 2026-09-11 (reclassified by GENERAL-ENGINE-DIRECTION-001) |

---

## READ THIS FIRST — AUTHORITY NOTICE

**This file is a completed temporary work order. It is not current authorized truth, and it does not outrank permanent documentation.**

Its tranche, AI-ASSET-FOUNDATION-001, was implemented, independently verified and accepted. The work it authorized is done.

Authority order, per `DOCUMENTATION_MAP.md` §1:

```text
CONSTITUTION.md > PRD.md > ARCHITECTURE.md
  > permanent subsystem specifications
  > DEPENDENCY_POLICY.md
  > DEFINITION_OF_DONE.md / TESTING_AND_VALIDATION.md
  > accepted evidence
  > ROADMAP.md
  > CONTEXT.md
  > THIS FILE
```

Where this file and any permanent document disagree, **the permanent document wins**. Where this file and accepted implementation disagree, the implementation and its tests are the evidence.

### Why it is still here

Eleven source files and one test file cite this path for specific numbered Decisions — for example `src/render/mesh-adapter.js` cites Decision 6, `src/preview/manifest.js` cites Decision 2, and `src/geometry/mesh-ops.js` cites the topology law in section 5. Those citations are load-bearing explanations of why the code is shaped as it is.

Moving or deleting this file would break every one of them. Retiring it therefore requires a tranche authorized to edit source headers, which this documentation tranche is not. That retirement is recorded as future work in `ROADMAP.md`.

### What remains open

Section 13 of this file recorded six documentation reconciliation items. GENERAL-ENGINE-DIRECTION-001 did not close all of them. Their current status is tracked in `ROADMAP.md`, not here.

### For a fresh agent

Read `AGENTS.md`, then `DOCUMENTATION_MAP.md`, then the permanent documents that map routes you to. Read this file only when you need the reasoning behind a Decision that source code cites, or the history of the AI-native asset tranche.

Do not treat anything below this notice as an instruction to act.

---

*Everything below this line is preserved as written when the tranche was authorized. It is historical record. Its forward-looking language — "not authorized", "next action", "stop" — refers to the state of the work in September 2026 and no longer describes anything current.*

---

## 1. MISSION AND ARCHITECTURAL INTENT

My Game Engine 1.0 is a browser-first, **AI-native**, code-authored game engine in which native game content can be generated, inspected, revised, compiled, reproduced, and tested through deterministic code and machine-readable definitions **without requiring a traditional DCC workflow**.

AI is not merely another consumer of the engine. **AI-authored code is the native content-production medium.**

```text
HUMAN CREATIVE DIRECTION
        |
AI AUTHORING AGENT
        |
ENGINE-OWNED CODE + MACHINE-READABLE DEFINITIONS
        |
AUTHORING FORGES
        |
SEMANTIC GENERATED CONTENT
        |
VALIDATION
        |
        +---- PREVIEW PATH ----> HUMAN + AI INSPECTION
        |                               |
        |                           REVISION
        |                               |
        +---------------------- AI AUTHORING
        |
KILN
        |
OPTIMIZED SHIP ARTIFACT
        |
RUNTIME
```

The human directs, previews, evaluates, rejects, approves, and requests revisions. **The AI does the authoring work.**

### 1.1 This does NOT mean

- build a Blender clone;
- build a manual mesh editor;
- build vertex/edge/face editing UI;
- build a human UV editor;
- build a manual animation timeline;
- build a node-based DCC;
- integrate Blender as a required tool;
- depend on Maya, ZBrush, Unity, Unreal, Godot, MetaHuman, MakeHuman, Character Creator, Tripo, Meshy, or another finished-asset generator.

The engine may eventually achieve many of the content-production capabilities for which developers traditionally use Blender. It must **not** duplicate Blender's editor-centric interaction model as the native workflow.

**The AI needs modeling OPERATIONS, not modeling BUTTONS.**

```text
GOOD                            NOT REQUIRED
extrudeProfile(...)             face selection mode
bevelGeometry(...)              bevel gizmo
sweepProfile(...)               manual topology editor
generateSkinWeights(...)        UV dragging interface
createMotionDefinition(...)
```

### 1.2 Native pipeline target

The native pipeline must eventually be capable of producing, entirely through code: weapons, props, characters, creatures, vehicles, structures, interiors, environments, terrain, vegetation, materials, textures, rigs, skin weights, animations, VFX, collision, and navigation-related semantic data.

Interoperability with traditional asset formats may eventually exist. It is **not** the native authoring authority.

### 1.3 Product laws to preserve

- Definition / Artifact / Runtime separation.
- Kiln as the engine-owned compile/bake/cache boundary.
- `engine/runtime` vs `engine/full` separation.
- Browser-first runtime.
- Static export capability.
- Semantic geometry.
- Transform authority.
- Determinism where material.
- Dependency sovereignty.
- Explicit lifecycle/resource cleanup.
- Evidence-driven development.
- No Premature Abstraction.
- Human integration authority.

### 1.4 AI-native laws

**AI-NATIVE AUTHORING LAW.** Native assets must be capable of end-to-end authorship through code and machine-readable definitions. A traditional manual DCC step may be optional interoperability, but it must not be required to complete a native asset.

**NATIVE ASSET COMPLETION LAW.** A native pipeline cannot claim end-to-end completion if the resulting asset still requires mandatory external manual repair of geometry, UVs, materials, rigging, skin weights, animation, or other essential content.

**PREVIEW LAW.** Every generated visual asset must have an engine-native human-viewable preview path. Compilation success is not visual acceptance.

**VISUAL FEEDBACK LAW.** Generated content must support deterministic visual inspection suitable for the human creative director, for automated evaluation, and for AI vision analysis.

```text
GENERATE -> RENDER -> INSPECT -> DIAGNOSE -> REVISE SOURCE -> REBUILD
```

**AUTHORING/RUNTIME COMPLEXITY LAW.** Complex construction during generation is acceptable. Unbounded complexity every runtime frame is not.

```text
120 authoring pieces -> compile / merge / instance / optimize -> 6 meaningful runtime meshes
```

**HUMAN ROLE.** The human is the creative director. The human may describe, prompt, inspect, compare, approve, reject, request revisions, debug, and profile. The native pipeline must **not** require the human to manually push vertices, paint weights, drag UV islands, keyframe bones, sculpt meshes, or repair AI-generated geometry in a traditional DCC.

---

## 2. AUDIT STATUS

**SATISFIED.** The A–G repository audit requested by the previous revision of this document has been delivered and accepted. Its findings are recorded below and must not be deleted merely because the gate is closed.

Repository state at time of audit:

- 213 tests pass, 0 fail (`npm test`).
- Accepted through Proof E (Phase 0, A0, Proof A Pong, B1 Motion Truth, B2 Combat Room, C Bounded World, D Racer, E Blind API Generality).
- Approximately 11,000 lines of source. `src/games` (3,458 lines) exceeds every Forge combined.
- `three@0.185.1` installed. Upstream r186 released 2026-09-08.

---

## 3. AUDIT FINDINGS — REPOSITORY-GROUNDED

These are confirmed against code, not inferred from roadmap text.

### 3.1 engine/full is not an authoring surface

`src/full/` totals 162 lines. `src/full/index.js` re-exports the runtime and adds `compileDefinition` plus `createEngineFull`. **Zero Forges are reachable through the public `/full` export.** Geometry, Material, Character, Motion, and World Forge are repository-internal only.

### 3.2 The compiler seam is a definition seam, not a Kiln

`compileDefinition` (`src/full/compiler.js:106`) performs clone, recursive freeze, and a non-cryptographic content hash. This correctly establishes the Definition to Artifact boundary and is not to be disparaged. It performs no domain compilation, no optimization, no baking, and has no PREVIEW/SHIP intent distinction.

### 3.3 Geometry Forge vocabulary is confirmed minimal

`src/geometry/index.js` exposes exactly: `buildBoxGeometry`, `buildCylinderGeometry`, `mergeSemanticGeometries`, `generateProceduralRoom`, plus room definition and semantics constants. The historical assumption recorded in the previous work order is **still true today**, not stale.

### 3.4 THE STRUCTURAL FINDING — there is no engine-owned mesh representation

Geometry Forge emits `THREE.BufferGeometry` directly, carrying semantics as **per-vertex float attributes** (`regionId`, `surfaceId`) — `src/geometry/primitives.js:25`. Character geometry's `rawData` is flat typed arrays with no topology and no part table — `src/character/geometry.js:637`.

Consequences:

1. **There is no part table.** A per-vertex float can assert "these vertices are region 3." It cannot assert "this is the magazine, its bounds are X, it attaches at socket Y." After merge, part identity survives only as a scannable vertex attribute.
2. **Three.js is currently the canonical geometry model**, not a rendering backend behind a seam. This is in tension with dependency sovereignty.
3. **A BufferGeometry is a runtime object, not a serializable artifact.** `AGENTS.md` requires a native artifact be *serializable through code*. The mesh representation gap is therefore **non-compliance with existing law**, not new architecture.

### 3.5 Split-vertex geometry defeats adjacency recovery

`src/geometry/primitives.js:40` carries the comment *"6 faces \* 4 vertices = 24 vertices."* Every box face holds its own corner vertices so it can carry a distinct normal and UV. **There is not one shared edge in that index buffer.** Six disconnected quads in index space.

Adjacency is therefore not derivable from the index buffer. It requires **position welding first**, and welding is not a mechanical operation:

- the float tolerance becomes a hidden determinism input;
- welding across a `regionId` boundary merges two semantically distinct parts, which is precisely the silent semantic destruction this project forbids;
- the weld result is not stable under transform.

See section 5 for the resulting topology law.

### 3.6 Silent semantic destruction exists today

`src/geometry/primitives.js:258` contains `if (!pos || !idx) continue;`. `mergeSemanticGeometries` silently discards any geometry lacking a position attribute or index, emitting no diagnostic. This is a live violation of the project's own semantic-truth rule.

### 3.7 Character Forge bypasses Material Forge

`src/character/index.js:61` constructs a `MeshStandardMaterial` directly rather than calling `compileMaterial` (`src/material/compiler.js`). Definition to compiled-material separation is broken on the character path.

**Logged as an architectural finding. Explicitly OUT OF SCOPE for AI-ASSET-FOUNDATION-001.** See Decision 4.

### 3.8 Semantic landmarks are humanoid-bound

`computeSemanticLandmarks` (`src/character/landmarks.js:17`) derives from `params.height` and humanoid proportion constants. There is no generic engine concept for named semantic points on an arbitrary generated asset.

### 3.9 The existing hash contract cannot hash binary geometry

`computeDeterministicHash` (`src/full/compiler.js:82`) is built on `serializeJsonValue` (`src/full/compiler.js:64`), a JSON string walk. Handed a `Float32Array` it produces either an object keyed by numeric strings or nonsense. **The existing compile seam cannot meaningfully hash a mesh representation.** A second, separate hash contract is required.

### 3.10 Capture infrastructure exists but is proof-specific

`src/eval/browser.js` performs real deterministic headless capture. `src/eval/harness.js:90` (`saveCapture`) writes PNGs with a revision-stamped record. Waiting logic is hardcoded per proof (`window.__PROOF_C_WORLD__`, `window.__PROOF_D_RACING__`, and so on). Captures are single-view fixtures. **There is no canonical view solver anywhere in the repository**, confirmed by search. Camera pose, bounds, part measurements, and geometry statistics are not emitted with captures.

This infrastructure is to be **generalized, not replaced**.

### 3.11 Viewers exist and demonstrate correct lifecycle

`src/browser/b1-viewer.js` (399 lines) demonstrates correct ownership and teardown (`dispose` at `src/browser/b1-viewer.js:375`). There is no generic previewable contract; each viewer is proof-specific.

### 3.12 Documented WebGPU preference vs implemented WebGL

`AGENTS.md:336` and `ARCHITECTURE.md:590-591` state *"WebGPU preferred, WebGL2 meaningful fallback."* Every renderer in the repository constructs `WebGLRenderer`:

- `src/browser/b1-viewer.js:46`
- `src/games/combat/renderer.js:44`
- `src/games/racing/renderer.js:9`
- `src/games/sequence/renderer.js:43`
- `src/games/world/renderer.js:9`

**Recorded as a documented-vs-implemented conflict. Not scheduled in this tranche.** Do not resolve it opportunistically. It is, however, an additional argument for an engine-owned geometry representation: an IR can feed either backend, whereas BufferGeometry-first work encodes WebGL-era assumptions.

### 3.13 External research corroborating the direction

Recorded because it materially shaped the authorized scope.

- **3DHarnessBench** (arXiv 2609.06535, September 2026): *"API surface design and feedback quality substantially determine whether additional access benefits model performance."* Agent-directed camera control produced up to **+16% for the strongest agent and -17% for the weakest**. Normalized viewport screenshots improved a weak model more than reasoning changes did. **Camera pose metadata produced the largest gains; explicit bounding boxes and dimensions consistently helped; part-level measurements produced the best topology results.**
- **3DCodeBench** (arXiv 2606.01057): failures *"mostly arise from API mismatches"*, and successful renders still *"suffer from disconnected or floating 3D geometric components."*
- **a16z, code as the visual medium**: with diffusion, more test-time compute yields more samples; with code it **converges**, because the model is debugging a program in a closed-loop verifiable environment.

**Implication adopted as design input:** a capture is not a PNG. A capture is pixels **plus** camera pose, bounds, units, orientation, and per-part measurement. The engine's advantage over "an LLM scripting a DCC" is that these semantics are engine-owned. **The moat is in the harness, not the vocabulary.**

---

## 4. AUTHORING GEOMETRY VS RENDER GEOMETRY

The conceptual separation that justifies this tranche:

```text
AUTHORING GEOMETRY
preserves construction truth / topology / semantics
          |
     KILN / ADAPTER
          |
RENDER GEOMETRY
optimized for GPU requirements
```

These are **not necessarily the same representation**. GPU geometry frequently *wants* duplicated vertices, because UV seams, hard normals, tangent discontinuities, and material boundaries demand them. The AI authoring representation wants preserved construction truth and shared identity.

The architecture may therefore legitimately become:

```text
MeshIR  ->  render compilation    ->  BufferGeometry
MeshIR  ->  shipping compilation  ->  optimized artifact / GLB / whatever wins
```

This replaces the current arrangement, in which a single `THREE.BufferGeometry` is simultaneously asked to be modeling kernel, semantic database, serialization format, and runtime GPU mesh.

---

## 5. TOPOLOGY LAW

Recorded as an architectural conclusion:

> Split-vertex render geometry is not a trustworthy canonical source for topology-aware authoring.
>
> Current box geometry intentionally duplicates corners for face-specific normals and UVs. Adjacency recovery therefore requires position welding. Welding may require tolerance decisions, may cross semantic boundaries, may alter seams, and may lose source topology.
>
> Therefore: **topology-aware authoring operations must eventually operate on an engine-owned representation that preserves the connectivity those operations require, rather than reconstructing it lossily from renderer geometry.**

This generalizes past bevel to boolean, subdivision, remesh, and UV projection.

**Do NOT implement general bevel, boolean, subdivision, or remesh in this tranche.**

**MeshIR v1 does NOT need to become a complete half-edge kernel** unless the authorized verbs in section 7.4 genuinely require it. If they do, stop and report (section 11).

---

## 6. DECISIONS RESULTING FROM THE AUDIT

### DECISION 1 — Generic semantic anchors are IN for v1, and are NOT character landmarks

The capability is included in manifest v1. It must use a **generic engine concept**, `SemanticAnchor` / `SemanticFrame`, rather than overloading the humanoid-specific `SemanticLandmark` implementation. The concept must work for any generated asset.

```text
{
  name: "weapon.grip.R",
  partId: "receiver",
  position: [x, y, z],
  orientation: [x, y, z, w]   // optional
}
```

Further examples: `weapon.grip.L`, `weapon.muzzle`, `weapon.magazineSocket`, `weapon.chargingHandle`, `door.hinge`, `vehicle.driverSeat`, `vehicle.wheel.FL`, `character.hand.R`, `character.head`, `character.eyeLine`.

Requirements:

- stable semantic name;
- position required;
- orientation optional;
- associated `partId` optional where appropriate;
- deterministic serialization;
- survives merge and transform correctly;
- **transform operations must transform anchors**;
- **merge operations must preserve anchors and their owning identity**.

**MeshIR must NOT depend on Character Forge.** Character Forge may later map its humanoid `SemanticLandmarks` into the same generic contract.

This is the seam that will eventually permit `character.hand.R -> weapon.grip.R` without any weapon-specific engine architecture.

### DECISION 2 — Two determinism standards

**STRUCTURAL / MANIFEST EVIDENCE: STRICT.** For identical source, seed, engine version, and declared build mode:

- canonical MeshIR encoding must be byte deterministic;
- MeshIR hash must be identical;
- `AssetPreviewManifest` canonical encoding must be byte identical;
- bounds, statistics, part tables, and anchors must be identical.

> **Clarified after independent re-audit.** Implementation showed that "the
> manifest" is two things. Its capture records are an OBSERVATION — camera
> pose, aspect, viewport — and the camera solve fits the asset to the live
> viewport aspect, so a resized browser window changed those bytes. A UI
> viewport is not asset identity.
>
> The strict contract above applies to **portable structural identity**:
> `structuralManifest` / `structuralManifestHash`, which exclude captures and
> measured performance. The full manifest remains byte identical for identical
> source AND identical capture setup, and `manifestHash` is unchanged in
> meaning. This is a clarification of what the decision always intended, not a
> relaxation of it.

**RENDERED IMAGE EVIDENCE: TOLERANCE-BASED.** Do **not** require cross-machine PNG byte identity. That is not a reliable portable graphics contract across GPU vendors, drivers, browser versions, renderer implementations, or color pipelines.

Use tolerance-based visual comparison, with explicit recorded thresholds. Record enough capture metadata to make the evidence meaningful: engine revision, browser and version where available, renderer backend, viewport, DPR, camera transform, projection parameters, asset bounds, capture name.

Exact PNG hashes may be recorded as supplementary **same-environment** evidence, but must not become the portable acceptance contract.

### DECISION 3 — This document is rewritten in place, and is now tracked

`Next step.md` is the current authorized work order. A fresh agent must see current truth, not an obsolete gate. Audit findings are retained (section 3) rather than deleted.

**Correction of record.** At audit time this file was **not tracked by git** — it was excluded via `.git/info/exclude`, a local-only mechanism invisible to collaborators and to a fresh clone. The file whose purpose is to let a fresh agent recover project intent was not reaching a fresh agent at all. That exclusion has been removed and this file is now tracked (finding 3.13).

The obsolete audit-request prompt was **deliberately not committed** to manufacture git history. Its durable replacement is `ops/AI_NATIVE_ASSET_AUDIT.md`, which carries the findings, the research consulted, the decisions, and the architectural conclusion. The raw prompt is retained only as a personal backup and is not canonical engine documentation.

### DECISION 4 — Character Forge material repair is deferred

Finding 3.7 is real and logged. It is **not** repaired in this tranche. CINDER MK-I must use Material Forge; the Character Forge bypass waits for a Character Forge tranche. Do not drag SUMO repair into AI-ASSET-FOUNDATION-001.

### DECISION 5 — The authoring-surface descriptor must not be a second registry

A machine-readable descriptor of the public authoring surface is authorized (section 7.14), because API mismatch is the measured primary failure mode (finding 3.13). It **must be generated from, exported beside, or otherwise share source-of-truth metadata with the actual public operations.** A manually maintained duplicate API registry will drift and is forbidden.

### DECISION 6 — `src/render/mesh-adapter.js` is approved; the law is NARROW

`src/render/mesh-adapter.js` is the designated MeshIR to Three.js render-geometry boundary.

**Do NOT establish a repository-wide law that only `src/render/` may import Three.js.** The current engine legitimately uses Three.js elsewhere — Character Forge, Motion Forge, world and game renderers. A blanket rule would be an accidental constitutional rewrite.

The narrow law is:

> The engine-owned MeshIR authoring layer must be renderer-independent. Translation between MeshIR and Three.js render geometry occurs only through an explicitly designated adapter boundary.

Machine-checked minimum — these modules **must not** import `three`:

```text
src/geometry/mesh.js
src/geometry/mesh-ops.js
src/geometry/mesh-codec.js
src/geometry/anchors.js
```

`src/render/mesh-adapter.js` may. Existing legitimate Three.js use elsewhere in the engine is **not part of this tranche** and must not be disturbed.

### DECISION 7 — CINDER lives outside engine core

```text
examples/
  authoring/
    cinder-mk1/
      definition.js
      build.js
```

CINDER is an acceptance/forcing consumer, not engine-core content. **Do not introduce `src/assets/`** as an engine-owned content bucket. **Do not call CINDER a new Proof.**

CINDER must exercise the **public** authoring surface rather than deep-importing private geometry implementation. Where technically feasible it consumes `@sumosizedginger/my-game-engine-1.0/full`. If package self-reference through Vite becomes problematic, solve the minimum package-resolution issue — **do not deep-import internals and report that the public API worked.**

This establishes the eventual structure `examples/authoring/{cinder-mk1,subterra,sumo-sized-ginger}`.

### DECISION 8 — Float determinism is probed by evidence, not assumed or pre-weakened

`Math.sin` and `Math.cos` are not bit-pinned by the ECMAScript specification. `createCylinderMesh` and `extrudeProfile` will use them, while the MeshIR hash operates over exact encoded bytes. Cross-runtime byte identity is therefore **an open question, not an assumption**.

Add a cross-runtime probe:

```text
Generate accepted CINDER source in Node     -> canonical encoding -> hash A
Generate same CINDER source in browser      -> canonical encoding -> hash B
A === B ?
```

**Do NOT pre-emptively weaken the contract to "same engine family."** If the hashes diverge: **STOP FOR ARCHITECTURAL REVIEW** (section 11).

Preferred first direction to evaluate, if divergence occurs:

```text
FULL-PRECISION MeshIR IN MEMORY
        |
CANONICAL CODEC
   normalizes -0
   rejects NaN / Infinity
   optionally quantizes floats to a declared precision
        |
CANONICAL BYTES -> HASH
```

**Do NOT implement custom trigonometric approximations** unless evidence later proves them necessary. Any float quantization policy must be explicit, versioned, tested, and documented. **No silent rounding.**

The distinction this establishes: *deterministic artifact identity belongs to the canonical encoder, not necessarily to raw IEEE-754 intermediates produced during generation.*

### DECISION 9 — Node-only evaluation machinery must not reach `engine/full`

`src/eval/browser.js` uses `puppeteer-core`, `node:fs`, and a local Chrome/Edge binary. Those are evaluation and build-side concerns. `import '@sumosizedginger/my-game-engine-1.0/full'` must **not** drag headless-browser machinery into a browser authoring bundle.

```text
PUBLIC AUTHORING API          EVALUATION TOOLING
  CANONICAL_VIEWS               renderCanonicalViews(...)
  solveCanonicalView(...)       browser launch
  createPreviewable(...)        PNG capture
  preview contracts             visual comparison
  MeshIR
  modeling operations
```

The **canonical view solver is the shared contract**; Puppeteer is not:

```text
            solveCanonicalView()
                    |
          +---------+---------+
          |                   |
    Preview Lab          Eval Capture
    (browser UI)         (Puppeteer)
```

### DECISION 10 — The Three.js adapter is not automatically public

The adapter must exist. Whether `toBufferGeometry` belongs in the public AI authoring surface is **earned, not assumed**.

The intended AI workflow is:

```text
definitions / code -> MeshIR -> Previewable -> preview / compile
```

not:

```text
MeshIR -> THREE.BufferGeometry -> THREE.Mesh
```

Exposing the adapter by default teaches ordinary asset authors to manipulate renderer representation, which is precisely what this architecture exists to escape. Keep it an engine-owned internal boundary. **If CINDER genuinely needs public adapter access, report the concrete requirement before exposing it.**

---

## 7. AUTHORIZED SCOPE — AI-ASSET-FOUNDATION-001

**Goal.** Establish the smallest complete vertical slice proving:

```text
AI-authored source
  -> engine-owned geometry representation
  -> engine-native rendering adapter
  -> human-visible preview
  -> deterministic structured capture evidence
  -> revision-ready source
```

**CINDER MK-I is the forcing consumer.**

### 7.1 Engine-owned MeshIR

Add an engine-owned geometry representation that **does not import Three.js**.

The in-memory representation **may use typed arrays**. Naive `JSON.stringify` compatibility is **not** required.

Required conceptual information: positions; normals where present; UVs where present; indices; semantic attributes; parts; anchors; bounds; version.

Part record minimum: `id`; `semanticName`; `regionId` where applicable; `surfaceId` where applicable; stable index range (`indexStart` / `indexCount` or equivalent); `bounds`.

**`semanticName` is REQUIRED at the asset part boundary.** Do not silently create `part_0`, `part_1`, `part_2`. Meaningful generated names (`receiver`, `handguard`, `optic`, `magazine`, `stock`) or hierarchical names (`receiver.vent.03`) are acceptable. **Merge must refuse missing required semantic identity with structured diagnostics.**

### 7.2 Topology law

As recorded in section 5. No bevel, boolean, subdivision, or remesh in this tranche.

### 7.3 Serialization and hash contract

Preserve the existing `DefinitionHash` contract unchanged. Add a **separate** MeshIR deterministic encoding and hash contract.

```text
DefinitionHash  ->  canonical definition representation   (exists, unchanged)
MeshIRHash      ->  versioned canonical MeshIR encoding   (new)
```

The encoder defines ordering. Tests must prove: same MeshIR, same bytes, same hash. Typed arrays are allowed in memory; serialization is a separate concern.

### 7.4 Initial authoring verbs

Implement **only** the minimum generic operations CINDER requires:

```text
createBoxMesh
createCylinderMesh
extrudeProfile
transformMesh
mergeMeshIR
```

Names may differ where repository naming convention justifies it.

**Not in this tranche:** bevel, boolean, sweep, loft, lathe, SDF, voxel, or any weapon-specific geometry API.

Operations must preserve or deliberately transform parts, semantic attributes, anchors, and bounds, with structured diagnostics on unsupported or lossy cases.

### 7.5 Three.js adapter boundary

Add exactly **one** intentional boundary converting MeshIR into Three.js render geometry.

```text
MeshIR -> toBufferGeometry() -> renderer
```

Three.js must not become the canonical authoring representation for the new pipeline.

Location: `src/render/mesh-adapter.js`. The governing law is **narrow** — see Decision 6. The new authoring modules must be renderer-independent; no repository-wide restriction on Three.js use is established, and existing legitimate Three.js use elsewhere must not be disturbed.

The adapter is **not automatically part of the public authoring surface** — see Decision 10.

**Do NOT rewrite the accepted legacy Geometry Forge primitives.** The new path runs alongside the existing proof path.

### 7.6 Legacy conformance test

Add conformance evidence, beginning with box geometry: prove that `toBufferGeometry(createBoxMesh(parameters))` is numerically equivalent to the accepted legacy `buildBoxGeometry(parameters)` for the attributes expected to match.

This test exists so that eventual migration is evidence-based. **Do not migrate the legacy implementation yet.**

### 7.7 Minimal engine/full authoring export

This cannot remain deferred, because CINDER may not depend on private deep imports.

Expose **only** the public authoring capabilities this tranche requires: MeshIR creation and types; the initial modeling verbs; generic anchors; the Previewable contract and preview entry point; the canonical view solver and its view constants.

Two exclusions are binding:

- **Node-only evaluation machinery must not be exported** (Decision 9). `renderCanonicalViews` and anything touching `puppeteer-core`, `node:fs`, or a local browser binary stays in evaluation tooling. The shared contract is the **view solver**, not the capture driver.
- **The Three.js adapter is not automatically public** (Decision 10). Report a concrete CINDER requirement before exposing it.

Do not expose internal implementation helpers. Do not export every Forge merely because it exists. **The surface is earned by CINDER's actual requirements.**

### 7.8 Material policy

CINDER must use Material Forge definitions and compilation rather than inventing another private material pathway. The `AssetPreviewManifest` must identify material assignment per part.

Do **not** repair Character Forge's direct `MeshStandardMaterial` construction in this tranche (Decision 4).

### 7.9 Generic Previewable contract

Create the smallest useful generic preview contract, allowing Preview Lab to discover: `id`; `type`; visual/renderable representation; bounds; parts; anchors; materials; stats; diagnostics; source identity; dispose/lifecycle behavior.

Do not build a universal asset ontology. Do not require every future game object to implement this contract. It exists for **generated visual authoring artifacts**.

### 7.10 Minimal Preview Lab

A **human** must be able to see the generated asset. Provide an actual browser-visible preview.

Minimum: orbit; zoom; front; back; left; right; top; three-quarter; stats display; safe teardown.

Static asset preview must **not** run a permanent RAF while idle. Render on demand for: initial display; camera changes; resize; inspection changes. If motion is later previewed, animation may justify RAF.

**Preview must use the same canonical camera-view solver used by automated capture. Human and AI evidence must not use separate framing algorithms.**

### 7.11 Preview safety budget

**The preview budget must FAIL CLOSED, not merely warn.**

Initial thresholds are explicit implementation configuration, **not** constitutional universal constants. Potentially governed dimensions: DPR; triangles; draw calls; materials; lights; shadow lights; instances; generation time.

If a requested preview exceeds a hard budget, return a structured diagnostic and refuse the dangerous path, or deliberately degrade through an explicitly defined safe policy. Do not silently attempt arbitrary generated complexity.

*Historical justification: a previous external procedural graphics experiment produced enough runtime complexity to severely degrade or freeze Chrome.*

### 7.12 Canonical capture

Generalize the existing evaluation infrastructure (`src/eval/browser.js`, `src/eval/harness.js`). **Do not create a second, unrelated screenshot system.**

Add a canonical view solver shared by the human Preview Lab and automated `renderCanonicalViews()`.

**The solver is engine-side and public. The capture driver is evaluation-side and is not** (Decision 9). `renderCanonicalViews` lives in evaluation tooling and consumes the same solver the browser preview uses.

Minimum deterministic views: front; back; left; right; top; three-quarter.

Capture evidence must include camera metadata.

### 7.13 AssetPreviewManifest v1

Create a deterministic manifest. Minimum conceptual schema:

```text
source:
  definitionId
  sourceHash
  meshHash
  seed if applicable

scene:
  units
  upAxis
  forwardAxis

bounds:
  min
  max
  center
  dimensions

geometry:
  triangles
  vertices
  partCount
  runtimeMeshCount where known

parts[]:
  id
  semanticName
  bounds
  triangleCount
  materialId
  regionId where applicable
  surfaceId where applicable

anchors[]:
  name
  partId where applicable
  position
  orientation where present

materials[]

captures[]:
  name
  cameraPosition
  cameraTarget
  projection / FOV
  viewport

performance:
  generationMs
  other measurements actually available

diagnostics[]
```

**Do not fabricate unavailable telemetry.** Manifest canonical encoding must be byte deterministic.

### 7.14 Machine-readable authoring surface

Include a **small** machine-readable descriptor of the public authoring capabilities exposed in this tranche, describing where practical: verb name; parameter names; units; bounds and constraints; semantic behavior.

Subject to Decision 5, it must share source-of-truth metadata with the actual public operations. No manually maintained duplicate registry.

Purpose: AI discoverability, and reducing the API-mismatch failure mode recorded in finding 3.13.

---

## 8. ACCEPTANCE CRITERIA

### 8.1 CINDER pipeline acceptance — GATES THIS TRANCHE

**Architecture acceptance MUST NOT depend on subjective final art quality.**

CINDER MK-I lives at `examples/authoring/cinder-mk1/` (Decision 7) and must contain at least **6 semantically named parts**. Example categories: receiver, barrel, handguard, stock, magazine, optic. Exact artistic decomposition is project-owned.

Every accepted part must appear in the manifest with: semantic name; bounds; triangle count; material identity.

CINDER must:

- be authored through the public engine authoring path;
- contain no embedded pre-generated final geometry;
- require no traditional DCC;
- render in Preview Lab;
- support all canonical views;
- produce deterministic MeshIR encoding and hash;
- produce a byte-identical portable structural manifest across repeated clean runs, and across differing viewport and aspect;
- produce zero unresolved BLOCKING diagnostics;
- stay within the declared preview safety budget;
- cleanly dispose and recreate.

### 8.2 CINDER art acceptance — DOES NOT GATE THIS TRANCHE

Art acceptance is separate. After the pipeline passes, human-directed CINDER iteration may continue using the loop:

```text
preview -> critique -> AI source revision -> preview
```

That ongoing iteration is itself evidence that the pipeline is useful. A later CINDER-specific work slice may establish a higher visual quality bar.

### 8.3 Regression

All 213 currently passing tests must remain passing. No accepted proof may be broken.

---

## 9. FORCING ASSET ORDER

Explicit, and reflecting **technical dependency, not creative importance**:

**1. CINDER MK-I** — forces MeshIR, hard-surface code authoring, parts, materials, anchors, preview, capture.

*Question: can My Engine generate a professional hard-surface hero asset entirely through code?*

**2. SUBTERRA** — forces repetition, instancing, assemblies, constructed environments, environment semantics, larger preview complexity.

*Question: can My Engine generate a rich playable environment entirely through code while keeping runtime complexity bounded?*

**3. SUMO SIZED GINGER** — forces organic shape and identity, clothing, hair and beard, skinning, rigging, motion, equipment attachment.

*Question: can My Engine generate, rig, skin, animate and equip a recognizable professional stylized hero character entirely through code?*

By the time SUMO arrives, he sits on infrastructure already beaten to death by the other two.

If the three assets require unrelated ad hoc pipelines, the architecture has failed. All three must pull from shared systems: Geometry Forge, Material Forge, Character Forge, Motion Forge, World Forge, Semantics, Preview Lab, Kiln, Runtime.

---

## 10. DEFERRED

Explicitly out of scope for AI-ASSET-FOUNDATION-001:

- general bevel / chamfer;
- boolean / CSG;
- sweep; loft; lathe;
- half-edge editing kernel, unless newly required by authorized verbs;
- GLB export / import;
- Kiln ship serialization beyond the minimal current seam;
- Kiln PREVIEW/SHIP intent split;
- Character Forge identity work;
- Character Forge Material Forge repair (finding 3.7);
- WebGPU migration (finding 3.12);
- general animation expansion;
- constructed World Forge expansion;
- SUBTERRA;
- SUMO SIZED GINGER;
- huge-world streaming;
- manual DCC / editor tooling;
- constitutional amendment (see section 13).

---

## 11. STOP CONDITIONS

**STOP and return for architectural review if:**

- the new path requires breaking an accepted proof;
- MeshIR cannot represent the required CINDER construction without introducing an unplanned topology system;
- semantic parts cannot survive transform or merge deterministically;
- anchors cannot survive transform or merge correctly;
- deterministic MeshIR encoding cannot be achieved;
- manifest determinism cannot be achieved;
- Preview Lab requires a second renderer architecture;
- safe preview limits cannot be enforced;
- public `/full` exposure requires leaking substantial private implementation;
- CINDER requires one-off weapon-specific core engine APIs;
- implementation begins expanding into bevel, CSG, GLB, or similar merely to improve the demo;
- anything added or extended changes hashes used by accepted world or character tests;
- **the cross-runtime float determinism probe diverges** — the same CINDER source generated in Node and in the browser produces different canonical MeshIR bytes or hashes (Decision 8). Do not weaken the contract to resolve this; stop and return;
- CINDER cannot be built without public access to the Three.js adapter (Decision 10) — report the concrete requirement rather than exposing it unilaterally;
- making CINDER consume the public package export requires deep-importing internals (Decision 7) — solve the package-resolution problem or stop; do not fake a public-API result.

---

## 12. BUILDER PASS REQUIREMENTS

Obey `CONSTITUTION.md`, `DEFINITION_OF_DONE.md`, `TESTING_AND_VALIDATION.md`, `DEPENDENCY_POLICY.md`, and `HANDOFF_PROTOCOL.md`.

- Builder completion is **BUILDER PASS at most**. Do not claim ACCEPTED.
- Real browser testing is authoritative for visual and runtime behavior.
- Do not hide failures.
- Do not fake screenshots.
- Do not claim a visual PASS based on code inspection.
- Do not claim performance without measurements.
- Do not claim deterministic behavior without repeated evidence.
- Do not claim cleanup without destroy/recreate evidence.
- Report exact files changed and exact revision/worktree state.
- A builder does not self-accept material work. No model may perform BUILD + AUDIT + VERIFY + ACCEPT as one uninterrupted self-certification process.

---

## 13. DOCUMENTATION RECONCILIATION

The durable audit record is `ops/AI_NATIVE_ASSET_AUDIT.md` (tracked). It holds the findings, the research consulted, the decisions, and the architectural conclusion, so this work order can be superseded later without losing the reasoning.

Canonical documents are **not** amended by this work order. Recorded for a later documentation tranche, once AI-ASSET-FOUNDATION-001 produces evidence:

1. The AI-native laws in section 1.4 need minimum-correct reconciliation into `CONSTITUTION.md` and `PRD.md`. Determine the smallest correct change; do not paste this document's language wholesale.
2. `README.md` currently states that `/full` is runtime plus `compileDefinition`, and that Forges are internal rather than package subpath exports. Section 7.7 will make that stale. Update **after** the export lands, not before.
3. `AGENTS.md:336` and `ARCHITECTURE.md:590-591` WebGPU preference vs universal `WebGLRenderer` use (finding 3.12).
4. `GEOMETRY_FORGE.md` should record the topology law (section 5) and the authoring-vs-render-geometry separation (section 4).
5. `CHARACTER_FORGE.md` and `MATERIAL_FORGE.md` should record finding 3.7 as a known open conflict.
6. Finding 3.6 (silent merge drop) should be recorded as a known defect with an owner.

---

## 14. NEXT ACTION

**Implementation of source code is NOT authorized.**

The authorized next step is to return an implementation plan for separate human approval:

- changed documentation summary;
- exact proposed source files;
- exact proposed tests;
- public API proposal;
- MeshIR v1 schema proposal;
- `AssetPreviewManifest` v1 schema proposal;
- identified risks.

Then **STOP.**

---

## ARCHITECTURAL PHILOSOPHY

```text
THE HUMAN DIRECTS.
THE AI AUTHORS.
THE ENGINE VALIDATES.
PREVIEW MAKES THE RESULT VISIBLE.
SEMANTICS MAKE GENERATED CONTENT COHERENT.
KILN TURNS AUTHORING COMPLEXITY INTO RUNTIME-EFFICIENT ARTIFACTS.
THE RUNTIME EXECUTES.
```

And the most important constraint:

**NO MANUAL DCC STEP IS REQUIRED FOR A NATIVE ASSET.**

My Game Engine 1.0 is not trying to put an AI chat box on top of Blender. It is attempting something more fundamental:

**CODE IS THE AUTHORING MEDIUM.**

The AI writes the content. The engine provides the vocabulary. The human judges the result. The compiler makes it cheap enough to ship.
