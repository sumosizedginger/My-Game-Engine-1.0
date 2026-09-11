# GENERAL-ENGINE AUDIT

| Field | Value |
| --- | --- |
| Document class | **AUDIT RECORD** (see `DOCUMENTATION_MAP.md` §2) |
| Authority | **Subordinate to every permanent document.** This file records findings. It does not define architecture. |
| Audit performed | 2026-09-10 |
| Persisted and updated to current truth | 2026-09-11, by GENERAL-ENGINE-DIRECTION-001 |
| Audit basis | repository inspection at `07e555af55f5ee61f8fbef7fbd2da90d6d782419` and its ancestry |
| Canonical repository | `sumosizedginger/My-Game-Engine-1.0` |

## Purpose

An external model reviewed this engine and scored it roughly 38/100 as a general-purpose game engine. This audit exists to determine what is actually true, against repository evidence rather than against that critique or against this project's own optimism.

It is preserved because a later tranche should be able to understand why the general-engine product direction was scoped the way it was, without re-deriving the analysis.

**The critique was input, not authority.** Four of its twenty domain claims are wrong or stale. Three of the most consequential defects in the repository are ones it never identified.

---

# A. REPOSITORY STATE

| Field | Value at audit | Value now |
| --- | --- | --- |
| Accepted `main` | `200ea43a334991e14875b36b35c94e3ddf9c9216` | `07e555af55f5ee61f8fbef7fbd2da90d6d782419` |
| AI-ASSET-FOUNDATION-001 | `798bd89…`, 7 ahead of main, **acceptance OPEN** | `798bd89…`, **ACCEPTED AND MERGED** as `07e555a…` |
| Independent verification | not performed | **PASS** — reproduced from a clean detached worktree |
| Node required | `24.21.0` exact, consistent across `package.json`, `.nvmrc`, `.node-version` | unchanged |
| Tests | 36 files, 7,775 lines; 429 reported by builder | **429 pass / 0 fail**, independently reproduced |
| Evaluator | — | **43 checks, all true** |
| Source size | 15,739 lines across 79 files in `src/` | unchanged |
| Dependencies | `three ^0.185.1`; dev `vite 8.2.2`, `puppeteer-core ^25.10.0` | unchanged |

## A.1 Independent verification of the accepted foundation

Reproduced at `798bd89` on Node v24.21.0 from a clean detached worktree:

```text
npm ci               41 packages, 0 vulnerabilities
npm test             429 pass / 0 fail / 0 skipped / 11 suites
npm run eval         PASS, 43 checks all true
npm run build        succeeded
npm run probe:cinder identical: true, 612,624 bytes byte-for-byte
                     node 1f3c73aa330cbe18 == browser 1f3c73aa330cbe18
```

Repair-specific evidence:

- **Portable structural identity.** Structural hash `01d15dea2c7f4f34` at 960×640, 1680×1180, 720×1280 and 540×1260, and across two real browser surfaces. Observation hashes differed in all four cases, as they must.
- **Asset-relative canonical views.** With `forwardAxis: -Z`, the `front` camera sits at z = −1.2683 and `back` at z = +1.3228. The most −Z part is `muzzle.prongRing`; the most +Z part is `stock.buttPad.rib.00`. Proven generically across six orientations.
- **Camera-relative inspection lighting.** Light count constant at 4 across 18 view switches; six distinct key directions; browser rig matches the shared pure solver to 0.0 component delta.
- **Capture determinism.** Two six-view runs: 0 differing pixels, RMSE 0.0000 on every view.
- **Lifecycle.** No idle RAF, dispose succeeds, double dispose safe, 0 labs and 0 canvases after dispose, same-page recreate reproduces identical structural identity.
- **Browser.** 0 console errors, 0 page errors; predicted draw calls 227 = measured 227.

## A.2 Source inventory

```text
src/games     3,178    src/browser   1,927    src/eval      1,838
src/preview   1,503    src/geometry  2,340    src/character 1,431
src/runtime   1,153    src/motion      832    src/full        344
src/world      ~300    src/material    252    src/render      111
```

Directories that **do not exist**: `audio`, `net`, `physics`, `scene`, `ui`, `save`, `kiln`, `import`, `streaming`, `story`, `timeline`, `anim-graph`.

A keyword sweep of all of `src/` returns **zero** files for `audio`, `multiplayer`, `replication`, `rigidbody`, `localiz`, `accessib`, `chunk`, `LOD`, `batch`, `gltf`, `GLB`, `FBX`, `timeline`, `dialogue`, `storygraph`, `particle` and `postprocess`. Apparent hits for `quest` (`requestAnimationFrame`), `server` (`ResizeObserver`) and `scene` (Three.js `Scene` inside per-proof viewers) are false positives.

---

# B. TWENTY-DOMAIN CRITIQUE MATRIX

| # | Domain | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Scene / World Management | **MISSING** (scene) / **PARTIAL** (bounded world) | No engine-owned scene concept exists. Each proof viewer builds its own `THREE.Scene`. `src/world/` is ~300 lines: recipe, field cache, field query, volume query, terrain, ground cover. No hierarchy, groups, prefabs, instancing, serialization, load/unload or persistent scene IDs. Critique **correct**. |
| 2 | Rendering Pipeline | **PARTIAL** | `src/render/mesh-adapter.js` is 111 lines and is the only engine-owned render module; `src/material/` is 252. No engine control over passes, culling, LOD, instancing, shadows, post, fog or particles. Critique **correct**, but missed Material Forge and the Preview Lab budget/stat system. Open conflict: `CONSTITUTION.md` §20 and `ARCHITECTURE.md` §14 prefer WebGPU; universal `WebGLRenderer` use is recorded as finding 3.12. |
| 3 | Physics / Character Controller | **PARTIAL → MISSING** | `src/runtime/collision.js` is 155 lines exporting `checkAABB` and `createCollisionSystem`. `src/world/volumes.js` is 53. `src/games/world/traversal.js` is project code, not engine. No triggers, overlaps, raycasts, sweeps, layers, masks or rigid bodies. Critique **correct**. |
| 4 | Animation | **PARTIAL — CRITIQUE OUTDATED** | `src/character/` (1,431 lines) and `src/motion/` (832) are real: procedural humanoid geometry, canonical skeleton, procedural skinning, `solveTwoBoneIK`, `computeGaitFootPlacement`, grounding, `commitRootMotionIntent`. No clips, pose representation, state graph, blending, additive layers, attachments or retargeting. Critique **wrong that it is absent, right that there is no animation system**. |
| 5 | Audio | **MISSING** | Zero occurrences in `src/`. `PRD.md` §19 and `ARCHITECTURE.md` §27 document intent. Critique **correct**. |
| 6 | Input | **IMPLEMENTED (bounded) — CRITIQUE WRONG** | `src/runtime/input.js` is 505 lines; `tests/input.test.js` is 429 lines, the largest test file in the repository. Semantic actions, keyboard, gamepad buttons and axes, `selectActiveGamepad`, disconnection hardening. Missing: rebinding API, action maps, contexts, buffering, touch, accessibility remap. |
| 7 | UI | **MISSING (capability) / DEFERRED BY DESIGN (framework)** | `CONSTITUTION.md` §21 sets a DOM-first hybrid law with a clear read-state/emit-action boundary and explicitly declines to prohibit frameworks. No HUD, menu, pause, settings, inventory, subtitle or rebinding module exists. Critique **correct on implementation**, wrong to imply a proprietary UI framework is wanted. |
| 8 | Gameplay Scripting | **PARTIAL — PARTLY DEFERRED BY DESIGN** | `CONSTITUTION.md` §11 makes standard JavaScript the native direction and forbids a proprietary language. `src/runtime/state.js` (161) and `src/runtime/rules.js` (83) provide state, variables and rules. No script lifecycle, coroutines, hot reload or declared reads/writes. Critique **outdated in direction, correct on lifecycle thinness**. |
| 9 | Save / Load | **MISSING (implementation) — ARCHITECTED** | Zero save code. `CONSTITUTION.md` §14 and §15, `ARCHITECTURE.md` §18 and §19, `PRD.md` §17 are written. `EntityHandle(index, generation)` exists with generation bumping and is explicitly non-serializable. Critique **correct on implementation**. |
| 10 | Studio / Tooling | **PARTIAL** | `src/preview/` is 1,503 lines — a genuinely strong Preview Lab with budgets, a canonical view solver, a manifest contract and a versioned inspection rig. No asset browser, entity inspector, graph editor, timeline editor, profiler or console. `CONSTITUTION.md` §26 makes Studio a separate product, so "immature editor" partly measures the wrong repository. |
| 11 | Build / Export | **PARTIAL** | `vite build` works. No asset packaging, compiled-artifact output, or version metadata emission. `ARCHITECTURE.md` §29 documents direction. Critique **correct**. |
| 12 | Automated Testing / Playthrough | **IMPLEMENTED — CRITIQUE WRONG** | 36 test files, 7,775 lines. `src/eval/` is 1,838 lines: headless browser harness, deterministic canonical capture, decoded-pixel PNG comparison, controlled proof routes, exact git revision extraction, cross-runtime byte-equality probe. This exceeds what most shipping engines have. |
| 13 | Debugging / Profiling | **PARTIAL** | Structured diagnostics `{severity, code, step, subsystem, message, data}`. Preview stats report triangles, vertices, parts, materials, drawCalls, **predictedDrawCalls** and renderedTriangles. No frame-time profiler, memory accounting or per-system timing. Critique **mostly correct**. |
| 14 | Extensibility | **PARTIAL — DEFECT THE CRITIQUE MISSED** | `CONSTITUTION.md` §5 and `package.json` give `.`, `./runtime`, `./full`. But `src/full/index.js` states in its own header that Kiln, Geometry Forge room generation, Character Forge, Motion Forge and World Forge are deliberately absent, and `src/browser/main.js` actively asserts Kiln is not exported. **A third-party developer cannot reach most of the engine's implemented capability.** |
| 15 | Platform Abstraction | **DEFERRED BY DESIGN** | Browser-only per `CONSTITUTION.md` §6. `PRD.md` §5 lists mobile-first and native wrappers as non-goals for the initial path. Critique **correct but describes an intentional choice**. |
| 16 | Performance / Optimization | **PARTIAL — SEE SECTION F.2** | `src/preview/budget.js` (177 lines) enforces authoring budgets; predicted and measured draw calls agree. `src/render/mesh-adapter.js` contains the line `// One group per part: part identity maps onto material slots.` No Kiln, batching, instancing or LOD. Critique **correct that optimization infrastructure is absent**. |
| 17 | Asset Import | **MISSING** | Zero glTF/GLB/FBX references. Deferred in `PRD.md` §5, `ARCHITECTURE.md` §37, `ROADMAP.md` §56. Critique **correct** — and public release converts this from non-goal to long-term requirement. |
| 18 | Networking | **MISSING** | Zero references. Deferred in all three documents. Critique **correct**; the MMO consumer converts it to a long-term requirement. |
| 19 | Accessibility / Localization | **MISSING — AND UNDOCUMENTED** | Zero occurrences in `src/`, **and zero in `PRD.md`, `ARCHITECTURE.md` or `ROADMAP.md`, including the deferred registers.** The only domain of the twenty absent from the law as well as the code. Critique **correct, and understated**. |
| 20 | Public Documentation | **PARTIAL** | `docs/learn/` holds 7 documents totalling 4,551 lines and is genuinely strong. No API reference, published schemas, sample-project template or migration docs. Critique **partly wrong, partly right**. |

**Tally.** Implemented 2 · implemented-but-bounded 1 · partial 9 · missing 6 · deferred by design 2. The critique is outdated or wrong on 4 of 20.

Its shape is roughly right and its resolution is poor. It scored the absence of production infrastructure without noticing how much of that absence is deliberate law, and it missed both the strongest asset (evaluation and evidence) and the sharpest real defect (an unreachable public surface).

---

# C. PRODUCT-GAP MATRIX

Gaps between the repository and *a publicly released, AI-native, general-purpose engine capable eventually of MMO-scale games.*

## C.1 Tier 1 — structural blockers

1. **No scene or composition model of any kind.** There is no engine object that says "here is a world made of things." Save, streaming, networking, story graphs, prefabs and Studio inspection all require it. Largest gap in the repository; the critique undersold it.
2. **No Kiln.** `CONSTITUTION.md` §4 is the *Kiln Law*; `ARCHITECTURE.md` §6 marks it an approved future system. The implementation is `src/full/compiler.js` — a 127-line JSON freezer plus a non-cryptographic content hash. Every performance promise routes through a system that does not exist.
3. **`instantiate()` is a stub.** It returns a descriptor object, not a materialized instance. Definition → Artifact → Runtime is declared and half-built.
4. **The public surface excludes the engine's own capability.** See B.14 and E.3.

## C.2 Tier 2 — required for "public"

Audio; runtime UI; save and persistence; asset import; accessibility and localization; API reference documentation; build and export packaging.

## C.3 Tier 3 — required for MMO scale, correctly deferred

Region and chunk model; streaming and residency; LOD/HLOD; server authority; replication; interest management; prediction and reconciliation; network identity; persistent unloaded state.

## C.4 Tier 4 — the Two-Door gap

At audit time the Two-Door principle appeared nowhere in the repository, and **no graph data model existed at all** — no animation graph, story graph, quest graph or timeline. These were not partial; they were unstarted, and the law that would govern them was unwritten.

GENERAL-ENGINE-DIRECTION-001 closed the documentation half of this gap (`PRD.md` §34 and §35, `ARCHITECTURE.md` §45). No implementation exists.

---

# D. DEPENDENCY GRAPH

```text
              [asset foundation accepted and merged]
                             |
     +-----------------------+----------------------+
     |                       |                      |
PERFORMANCE-BASELINE   SCENE / COMPOSITION    hard-surface verbs
     |                  (the keystone)        (bevel, mirror, array,
     v                       |                 smoothing groups)
 measurement                 |
     |            +----------+----------+-------------+
     v            |          |          |             |
 KILN-RENDER   collision/  prefabs/  persistence/  preview IBL /
 only if        triggers/  instances  save+migration  materials
 justified      controller     |          |
                    |          |          |
                    +----+-----+          |
                         |                |
                  animation graph    region/chunk
                  (needs clips +     model + streaming
                   pose repr first)       |
                         |                |
                  story / quest /    networking:
                  timeline graphs    authority -> replication
                  (need graph        -> interest management
                   substrate +            |
                   scene refs + save)     |
                         |                |
                         +-------+--------+
                                 |
                                MMO
```

## D.1 Load-bearing observations

- **Kiln render batching is independent of the scene model** — it transforms MeshIR into render groups *within one asset*. That is why it could proceed while everything else waits. **It therefore only addresses the within-asset case.** Cross-object batching needs the scene model and must not be promised by a within-asset tranche.
- **Scene composition is the keystone.** Seven downstream domains depend on it, and it appears nowhere on the roadmap under any name.
- **glTF import is closer than its "missing" status suggests.** MeshIR, parts, anchors, Previewable, the manifest and the Preview Lab already constitute a normalization target. An import adapter has somewhere to land today. FBX does not share that advantage.
- **Audio, UI completion and input completion are near-independent** and can proceed in parallel with almost anything. The dependency graph does not gate them.
- **Networking depends on persistence, which depends on scene.** Building networking first would violate the guard against foreclosing server authority.
- **The animation graph depends on a pose or clip representation that does not exist.** Motion Forge currently generates motion directly rather than producing sampled poses, so a state graph has nothing to blend between. This prerequisite is not obvious from the outside.

---

# E. ROADMAP RECONCILIATION

Findings against `ROADMAP.md` as it stood at audit time. GENERAL-ENGINE-DIRECTION-001 repaired items 1, 2, 3, 4, 5, 6 and 8.

1. **AI-ASSET-FOUNDATION-001 appeared nowhere in the roadmap.** The tranche existed only in `Next step.md`, an unclassified root document. *Repaired: §61.1 and §61.2.*
2. **No phase carried a status.** §3 defined a nine-term status vocabulary that no phase in the document used. *Repaired: §61.1 status ledger, with an accepted base revision for each proof.*
3. **§61 "CURRENT EXECUTION TARGET" still read "At Repository Bootstrap."** Six proofs and an asset tranche later, this would have actively misdirected a fresh agent. *Repaired.*
4. **Scene and composition appeared nowhere** under any name. *Repaired: §46.2 and §56.1.*
5. **Accessibility and localization appeared nowhere**, not even in the deferred register. *Repaired: §46.4 and §56.1.*
6. **§56 and `PRD.md` §5 deferred what the product target now requires.** Read precisely, `PRD.md` §5 said these were "NOT required for the initial product path and MUST NOT be pulled forward without proof-driven justification" — a deferral, not a prohibition. *Repaired by reclassification in `PRD.md` §5.1 and `ROADMAP.md` §56.1, without rewriting the originals as mistakes.*
7. **§46 "No Sacred Giant Feature Checklist" is the right instinct and was preserved intact.** It is the mechanism that stops an expanded product target from becoming a wishlist.
8. **Governance gap: `Next step.md`.** An 849-line root document declaring itself "the current authorized truth", unclassified by `DOCUMENTATION_MAP.md` §2 and outside the document accounting. *Partly repaired: reclassified as a completed TEMPORARY WORK ORDER with explicit subordinate authority, and a document class added to carry it. Full archival is blocked — see E.2.*

## E.1 Document architecture

The core ceiling of 21 was 18 occupied with three slots remaining, against roughly a dozen domains that might eventually earn specifications. Detailed in section J.

## E.2 Why `Next step.md` could not be archived

Eleven source files and one test file cite `Next step.md` by path for specific numbered Decisions:

```text
src/eval/canonical-capture.js   Decision 9
src/eval/probe-cinder.js        Decision 8, section 11
src/geometry/anchors.js         Decision 1
src/geometry/mesh-codec.js      sections 7.3, Decision 8
src/geometry/mesh-ops.js        section 5 topology law, Decision 5
src/geometry/mesh.js            sections 4, 5, 7.1, Decision 6
src/preview/budget.js           section 7.11
src/preview/manifest.js         Decision 2
src/preview/previewable.js      section 7.9
src/render/mesh-adapter.js      Decision 6
tests/purity.test.js            Decision 6
```

Archiving the file would break all of them, and a documentation tranche may not modify source. Retirement therefore requires a tranche authorized to edit those headers, recorded as `ROADMAP.md` §46.5.

## E.3 Public surface

`src/full/index.js` deliberately excludes Character Forge, Motion Forge, World Forge and Geometry Forge room generation. The choice was made honestly and documented in the file itself. The defect is that it was never revisited once public release became a product requirement — a scheduling failure, not an architectural one.

---

# F. TRANCHE RECOMMENDATIONS

## F.1 Completed

- **Foundation closure.** Independent verification of `798bd89` — **done, PASS.** Accepted and merged as `07e555a`.
- **GENERAL-ENGINE-DIRECTION-001.** Documentation and product-direction reconciliation — this tranche.

## F.2 Next — and the correction that matters most

The original audit named semantic-preserving Kiln render batching as the expected next tranche. **That recommendation was stated too strongly and is corrected here.**

CINDER established:

```text
227 semantic authoring parts -> 227 render groups -> 227 measured draw calls
```

**What that establishes:** a demonstrated render-submission scaling pressure, and a mechanical coupling between two identities that `ARCHITECTURE.md` §48 says should be separable.

**What it does not establish:** that draw calls are the dominant runtime performance cost. No profiling has been performed. The frame-time contribution of render submission in this engine is unmeasured.

The correct sequence is therefore:

```text
PERFORMANCE-BASELINE-001 -> measurement -> decide whether
KILN-RENDER-001 or some other optimization is justified
```

If measurement shows render submission is not the dominant cost, KILN-RENDER-001 is not the next work. That outcome would be a success of this sequencing, not a disappointment. Recorded in `ROADMAP.md` §46.1.

## F.3 Candidate work after that

Scene and composition foundation (`ROADMAP.md` §46.2), then a forcing consumer that beats on it. Public surface reconciliation (§46.3) is independent and can proceed in parallel. None is authorized.

---

# G. FILE PLAN

Executed by GENERAL-ENGINE-DIRECTION-001:

| File | Change |
| --- | --- |
| `CONSTITUTION.md` | §29 only — core ceiling semantics, amendment record under §34 |
| `PRD.md` | §1.1, §5.1, and Part II (§31–§39) |
| `ARCHITECTURE.md` | §37.1, and Part II (§43–§49) |
| `ROADMAP.md` | §46.1–§46.5, §47, §48, §56.1, §61 rewritten |
| `DOCUMENTATION_MAP.md` | authority order, two new document classes, §3, §4, §5.1, §5.2, §34 |
| `DEPENDENCY_POLICY.md` | new §23, external format parsers |
| `TESTING_AND_VALIDATION.md` | new §37, future evidence classes |
| `DEFINITION_OF_DONE.md` | new §28, acceptance direction |
| `README.md` | status, public surfaces, documentation system, authority order |
| `Next step.md` | reclassified as a completed temporary work order |
| `ops/GENERAL_ENGINE_AUDIT.md` | this file |

Untouched, deliberately: `src/**`, `tests/**`, `examples/**`, `docs/learn/**`.

---

# H. EVIDENCE PLAN

- **Unit** — new pure logic only. A documentation tranche adds none.
- **Integration** — `full` surface exports; definition → compile → instantiate round trip once `instantiate` becomes real.
- **Browser** — every render or lifecycle change proved through `tests/*-browser.test.js`, zero console errors, zero page errors, no permanent RAF, correct dispose.
- **Determinism** — canonical byte equality between Node and browser; portable structural hash stable across viewport and aspect.
- **Performance** — for any future batching work: before and after draw-call counts on the same CINDER MeshIR, with triangle count and structural hash unchanged. **If the structural hash moves, the compilation changed the asset and the tranche has failed.**
- **Lifecycle** — dispose and double dispose for every new GPU-resource owner.
- **Visual** — decoded-pixel comparison of the six canonical views. A batching change that alters pixels is a defect, not an optimization.

Future evidence classes for systems that do not yet exist are recorded in `TESTING_AND_VALIDATION.md` §37.

---

# I. STOP CONDITIONS

Any of these requires human architecture review rather than builder judgement:

1. A documentation change would require a constitutional edit beyond §29.
2. An architecture statement conflicts with accepted implementation.
3. Future work cannot preserve `sourcePartId` → compiled-range mapping without changing MeshIR — that would make it an authoring-format change, not a render change.
4. Batching alters any canonical capture's pixels, triangle count or structural hash.
5. A tranche requires a new production dependency.
6. Scene composition design requires changes to entity identity, transform authority or the simulation clock.
7. A domain cannot be implemented without a global singleton that would foreclose server authority.
8. Work would require creating a subsystem specification for something not yet implemented.
9. A tranche grows past one reviewable bounded scope.

---

# J. DOCUMENTATION ARCHITECTURE PRESSURE

## J.1 Counts at audit time

| Measure | Count |
| --- | --- |
| Core canonical (bootstrap) | 12 |
| Earned permanent subsystem specifications | 6 |
| **Canonical total** | **18 of 21** |
| Reserved root slots remaining | 3 |
| Model adapters (outside count) | 2 |
| Learning documents (outside count) | 7, totalling 4,551 lines |
| `ops/` temporary (outside count) | 4 |
| Unclassified root document | 1 — `Next step.md`, 849 lines |

Canonical documentation totalled 13,598 lines. The four largest were `ARCHITECTURE.md` (1,400), `DOCUMENTATION_MAP.md` (1,221), `ROADMAP.md` (1,086) and `CONTEXT.md` (1,047).

## J.2 The pressure

Twelve domains plausibly earn a permanent specification eventually: scene and composition, Kiln, physics, animation graphs, story graphs, timelines, persistence, import, streaming, networking, UI and audio. Three root slots remained.

The arithmetic did not close, and it could not be closed by deleting the ceiling without losing progressive disclosure — an agent working on audio would otherwise face roughly 25,000 lines of mandatory preload.

## J.3 Resolution

`CONSTITUTION.md` §29 was amended so that 21 counts the **core** canonical set, with earned specifications under `docs/spec/` outside it. The number 21 was deliberately **not** reduced, and one core slot is left unallocated as architectural flexibility.

- **`AUDIO_AND_FX.md`** ceased to be a reserved root slot. Audio is subsystem-scoped; it belongs at `docs/spec/audio.md` when earned.
- **`PERFORMANCE_AND_PROFILING.md`** and **`VISUAL_TARGETS_AND_BENCHMARKS.md`** remain reserved at core level, because each is cross-cutting policy read by every tranche touching performance or appearance rather than one subsystem's behavior. Neither was created; neither has been earned.
- **The six existing root Forge specifications were not moved.** Relocating them would churn cross-references across the documentation map, the learning documents and source headers for no routing benefit.

## J.4 Constitutional scope

`CONSTITUTION.md` §29 was the **only** section requiring change. Checked directly against the text:

- **§11** forbids a proprietary scripting *language*, not visual graphs over a JavaScript and data model.
- **§26** already describes `GUI / CLI / AI / Tests → Project Operations → Project Data → Runtime Adapter → Engine`. **The Two-Door Law was already latent in the Studio Boundary Law** and needed articulating, not inventing.
- **§21** explicitly declines to prohibit UI frameworks.
- **§5** permits the runtime/full split that public consumption requires.
- **§6** defers networking, native wrappers and mobile-first "until evidence requires them" — a deferral, not a prohibition.
- **§32** forbids *prebuilding* visual scripting, streaming, import pipelines and advanced physics. It governs implementation, not product intent, and the expanded direction authorizes no implementation.

## J.5 Sprawl risk

The risk is not file count. It is that `docs/spec/` becomes where speculative design goes to look official.

The mitigations are: implementation required before creation, a specification must name its implementing module and tests, delete rather than keep an unbacked specification, and progressive-disclosure guidance that makes an agent justify loading more than two.

Deliberately **not** adopted as law: a hard "maximum two specifications per task" rule and a hard line-count cap. Both were considered and rejected as heuristics wearing architecture's clothes. Work such as networking plus persistence plus streaming can legitimately cross three domains, and a coherent 650-line specification is better evidence than two 330-line documents that force an agent to jump between them. The guidance now asks for justification rather than compliance.

If any of the earned-tier mitigations is dropped, the tier will rot, and the engine's strongest current property — that it does not pretend — degrades with it.

---

# POST-AUDIT UPDATE — 2026-09-11

*Appended, not rewritten. The findings above record what was true at audit time and are left intact; erasing a gap once it is addressed destroys the reasoning that justified addressing it.*

**SCENE-COMPOSITION-001** built the scene and composition foundation that section C.1 named the largest structural blocker and section D called the keystone. It is **ACCEPTED**, verified independently at `922f5a1` and merged at `c8afd65`. Two revisions failed audit first — transform and immutability defects at R1, a unit-quaternion contract defect at R2 (see `docs/spec/scene.md` §12.1).

What changed against this audit's findings:

| Audit finding | Status now |
| --- | --- |
| B.1 / C.1.1 — no engine-owned scene or composition model | **Foundation built.** `src/scene/**`, `docs/spec/scene.md`, forcing consumer SUBTERRA cell. Prefabs, streaming, save, networking and scene transitions remain unbuilt. |
| C.1.2 — no Kiln | **Unchanged.** The scene compiler is a scene compiler, not Kiln. |
| C.1.3 — `instantiate()` is a stub | **Unchanged** for the generic artifact seam. Scenes have their own real instantiation path. |
| C.1.4 / B.14 / E.3 — public surface excludes implemented capability | **Unchanged for the Forges.** Scene composition was given an intentional public surface from the start rather than inheriting the defect. |
| F.2 — measurement before render optimization | **Unchanged and respected.** No batching or profiling work was done. |

One finding this audit did not anticipate, surfaced by the implementation: an `EntityHandle` is scoped to the entity manager that issued it, and two managers each starting from an empty pool produce colliding handle values that no lookup can distinguish. See `docs/spec/scene.md` §2.1. It is a documented limit rather than a defect in the scene layer, and closing it would mean changing runtime identity architecture.

---

# CLOSING

The engine's real position is neither 38/100 nor the picture a sympathetic reading would produce.

It has an unusually strong deterministic foundation, an evaluation and evidence system better than most shipping engines, six accepted proofs across genuinely different genres, and an accepted AI-native asset pipeline that produced a 227-part hard-surface asset entirely through public authoring verbs.

It also has no scene model, no Kiln, a stubbed `instantiate()`, and a public surface that does not expose its own accepted capability.

Both halves are true. This audit exists so that neither gets forgotten.

*As written, 2026-09-10. The scene-model finding was addressed by SCENE-COMPOSITION-001 the following day — see the post-audit update above. The sentence is left standing because a finding that is erased once it is fixed takes its own justification with it.*
