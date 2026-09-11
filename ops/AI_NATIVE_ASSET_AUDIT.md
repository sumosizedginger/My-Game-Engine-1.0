# AI_NATIVE_ASSET_AUDIT.md

**Artifact type:** Architecture alignment audit; not a canonical repository authority

**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

**Audited revision:** `200ea43` (`main`, clean tree)

**Audit date:** 2026-09-10

**Audit gate:** SATISFIED

**Resulting authorized tranche:** AI-ASSET-FOUNDATION-001 (see `Next step.md`)

---

## Purpose

This document is the durable record of the AI-native content pipeline architecture audit. The audit request that produced it was a temporary work-order prompt and is not preserved as canonical documentation.

`Next step.md` holds the current authorized work order. This file holds the findings and the reasoning that produced it, so that a later agent can understand *why* AI-ASSET-FOUNDATION-001 is scoped the way it is without re-deriving the analysis.

This document does not amend canonical law. Documentation reconciliation is tracked in `Next step.md` section 13.

---

## Verdict

**The AI-native content authoring direction is architecturally sound and is blocked by one structural gap.**

The engine has a disciplined runtime, a real evidence harness, and five accepted proofs. It does not yet have an engine-owned geometry representation. Every AI-native authoring capability in the intended roadmap — topology-aware modeling operations, part-level semantics, serializable native mesh artifacts, structured visual feedback — depends on that representation existing first.

---

## Repository State at Audit

- 213 tests pass, 0 fail (`npm test`).
- Accepted through Proof E (Phase 0, A0, Proof A Pong, B1 Motion Truth, B2 Combat Room, C Bounded World, D Racer, E Blind API Generality).
- Approximately 11,000 lines of source. `src/games` (3,458 lines) exceeds every Forge combined.
- `three@0.185.1` installed. Upstream r186 released 2026-09-08.

---

## Findings

Confirmed against code, not inferred from roadmap text. Findings are reproduced in `Next step.md` section 3 with the same numbering.

### 3.1 engine/full is not an authoring surface

`src/full/` totals 162 lines. `src/full/index.js` re-exports the runtime and adds `compileDefinition` plus `createEngineFull`. Zero Forges are reachable through the public `/full` export.

**Classification:** APPROVED BUT NOT IMPLEMENTED.

### 3.2 The compiler seam is a definition seam, not a Kiln

`compileDefinition` (`src/full/compiler.js:106`) performs clone, recursive freeze, and a non-cryptographic content hash. It correctly establishes the Definition to Artifact boundary. It performs no domain compilation, no optimization, no baking, and has no PREVIEW/SHIP intent distinction.

**Classification:** PARTIAL, and correct for its stated scope.

### 3.3 Geometry Forge vocabulary is confirmed minimal

`src/geometry/index.js` exposes exactly `buildBoxGeometry`, `buildCylinderGeometry`, `mergeSemanticGeometries`, `generateProceduralRoom`, plus room definition and semantics constants.

**Classification:** IMPLEMENTED, minimal. The historical assumption recorded in the audit request was still true at audit time, not stale.

### 3.4 THE STRUCTURAL FINDING — there is no engine-owned mesh representation

Geometry Forge emits `THREE.BufferGeometry` directly, carrying semantics as per-vertex float attributes (`regionId`, `surfaceId`) — `src/geometry/primitives.js:25`. Character geometry's `rawData` is flat typed arrays with no topology and no part table — `src/character/geometry.js:637`.

1. There is no part table. A per-vertex float can assert "these vertices are region 3." It cannot assert "this is the magazine, its bounds are X, it attaches at socket Y." After merge, part identity survives only as a scannable vertex attribute.
2. Three.js is currently the canonical geometry model, not a rendering backend behind a seam. This is in tension with dependency sovereignty.
3. A `BufferGeometry` is a runtime object, not a serializable artifact. `AGENTS.md` requires a native artifact be *serializable through code*. The gap is therefore non-compliance with existing law, not new architecture.

**Classification:** MISSING. Root cause of the tranche.

### 3.5 Split-vertex geometry defeats adjacency recovery

`src/geometry/primitives.js:40` carries the comment *"6 faces \* 4 vertices = 24 vertices."* Every box face holds its own corner vertices so it can carry a distinct normal and UV. There is not one shared edge in that index buffer — six disconnected quads in index space.

Adjacency is therefore not derivable from the index buffer. It requires position welding first, and welding is not a mechanical operation:

- the float tolerance becomes a hidden determinism input;
- welding across a `regionId` boundary merges two semantically distinct parts, which is precisely the silent semantic destruction this project forbids;
- the weld result is not stable under transform.

**Classification:** CONFLICTING. Produced the topology law in `Next step.md` section 5.

### 3.6 Silent semantic destruction exists today

`src/geometry/primitives.js:258` contains `if (!pos || !idx) continue;`. `mergeSemanticGeometries` silently discards any geometry lacking a position attribute or index, emitting no diagnostic.

**Classification:** DEFECT. Live violation of the project's own semantic-truth rule. Not repaired in AI-ASSET-FOUNDATION-001; the new `mergeMeshIR` refuses rather than silently drops.

### 3.7 Character Forge bypasses Material Forge

`src/character/index.js:61` constructs a `MeshStandardMaterial` directly rather than calling `compileMaterial` (`src/material/compiler.js`). Definition to compiled-material separation is broken on the character path.

**Classification:** CONFLICTING. Explicitly deferred to a later Character Forge tranche.

### 3.8 Semantic landmarks are humanoid-bound

`computeSemanticLandmarks` (`src/character/landmarks.js:17`) derives from `params.height` and humanoid proportion constants. There is no generic engine concept for named semantic points on an arbitrary generated asset.

**Classification:** PARTIAL. Resolved generically by `SemanticAnchor` in the authorized tranche.

### 3.9 The existing hash contract cannot hash binary geometry

`computeDeterministicHash` (`src/full/compiler.js:82`) is built on `serializeJsonValue` (`src/full/compiler.js:64`), a JSON string walk. Handed a `Float32Array` it produces either an object keyed by numeric strings or nonsense.

**Classification:** MISSING. Requires a second, separate MeshIR hash contract.

### 3.10 Capture infrastructure exists but is proof-specific

`src/eval/browser.js` performs real deterministic headless capture. `src/eval/harness.js:90` (`saveCapture`) writes PNGs with a revision-stamped record. Waiting logic is hardcoded per proof (`window.__PROOF_C_WORLD__`, `window.__PROOF_D_RACING__`, and so on). Captures are single-view fixtures. There is no canonical view solver anywhere in the repository, confirmed by search. Camera pose, bounds, part measurements, and geometry statistics are not emitted with captures.

**Classification:** PARTIAL. To be generalized, not replaced.

### 3.11 Viewers exist and demonstrate correct lifecycle

`src/browser/b1-viewer.js` (399 lines) demonstrates correct ownership and teardown (`dispose` at `src/browser/b1-viewer.js:375`). There is no generic previewable contract; each viewer is proof-specific.

**Classification:** PARTIAL, and a good foundation.

### 3.12 Documented WebGPU preference vs implemented WebGL

`AGENTS.md:336` and `ARCHITECTURE.md:590-591` state *"WebGPU preferred, WebGL2 meaningful fallback."* Every renderer in the repository constructs `WebGLRenderer`:

- `src/browser/b1-viewer.js:46`
- `src/games/combat/renderer.js:44`
- `src/games/racing/renderer.js:9`
- `src/games/sequence/renderer.js:43`
- `src/games/world/renderer.js:9`

**Classification:** CONFLICTING. Documented-vs-implemented. Not scheduled. Must not be resolved opportunistically.

### 3.13 Next step.md was not tracked by git

At audit time, `Next step.md` was excluded from version control via `.git/info/exclude` line 7. The file whose stated purpose is to let a fresh agent recover project intent was invisible to a fresh clone, and the exclusion was local-only — not shared, and not visible to collaborators.

**Classification:** DEFECT. Repaired: the exclusion was removed and the authorized work order is now tracked. The obsolete audit-request prompt was deliberately not committed to manufacture history; this document is its durable replacement.

---

## External Research Consulted

Recorded because it materially shaped the authorized scope.

- **3DHarnessBench** (arXiv 2609.06535, September 2026). *"API surface design and feedback quality substantially determine whether additional access benefits model performance."* Agent-directed camera control produced up to +16% for the strongest agent and -17% for the weakest. Normalized viewport screenshots improved a weak model more than reasoning changes did. Camera pose metadata produced the largest gains; explicit bounding boxes and dimensions consistently helped; part-level measurements produced the best topology results.
- **3DCodeBench** (arXiv 2606.01057). Failures *"mostly arise from API mismatches"*, and successful renders still *"suffer from disconnected or floating 3D geometric components."*
- **a16z, code as the visual medium.** With diffusion, more test-time compute yields more samples; with code it converges, because the model is debugging a program in a closed-loop verifiable environment.

**Adopted implication.** A capture is not a PNG. A capture is pixels plus camera pose, bounds, units, orientation, and per-part measurement. The engine's advantage over "an LLM scripting a DCC" is that these semantics are engine-owned. The moat is in the harness, not the vocabulary.

---

## Decisions Resulting From This Audit

Recorded in full in `Next step.md` section 6. Summarized here:

1. Generic `SemanticAnchor` is included in manifest v1, and must not overload the humanoid-specific `SemanticLandmark` implementation.
2. Two determinism standards: structural and manifest evidence is strict byte identity; rendered-image evidence is tolerance-based.
3. `Next step.md` is rewritten in place as the authorized work order, and is now tracked. This document is the durable audit record.
4. Character Forge material repair (3.7) is deferred.
5. The machine-readable authoring-surface descriptor must share source of truth with the actual operations, never a hand-maintained duplicate registry.
6. `src/render/mesh-adapter.js` is the designated MeshIR to Three.js boundary. The law is narrow: the new authoring modules must be renderer-independent. No repository-wide restriction on Three.js use is established.
7. CINDER MK-I lives at `examples/authoring/cinder-mk1/` and consumes the public authoring surface. It is a forcing consumer, not engine content, and is not a new Proof.
8. Float determinism across JS runtimes is an open risk and a stop condition. It is probed by evidence before any contract is weakened.
9. Node-only evaluation machinery must not be exported through `engine/full`.
10. The MeshIR to Three.js adapter is not automatically public.

---

## Architectural Conclusion

The intended arrangement separates two representations that the repository currently conflates:

```text
AUTHORING GEOMETRY
preserves construction truth / topology / semantics
          |
     KILN / ADAPTER
          |
RENDER GEOMETRY
optimized for GPU requirements
```

GPU geometry frequently wants duplicated vertices, because UV seams, hard normals, tangent discontinuities, and material boundaries demand them. The AI authoring representation wants preserved construction truth and shared identity. A single `THREE.BufferGeometry` cannot correctly serve as modeling kernel, semantic database, serialization format, and runtime GPU mesh simultaneously.

The resulting target loop:

```text
AI SOURCE
   |
ENGINE-OWNED AUTHORING GEOMETRY
   |
SEMANTIC PARTS + ANCHORS
   |
CANONICAL ARTIFACT IDENTITY
   |
RENDER ADAPTER
   |
SHARED CAMERA SOLVER
   |
   +--------------- HUMAN PREVIEW
   |
   +--------------- AI / EVAL CAPTURE
   |
STRUCTURED EVIDENCE
   |
AI REVISION
```

---

## Status

This audit is closed. Implementation of AI-ASSET-FOUNDATION-001 requires separate human authorization, tracked in `Next step.md` section 14.
