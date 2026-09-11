# SCENE AND COMPOSITION

| Field | Value |
| --- | --- |
| Document class | **EARNED SUBSYSTEM SPECIFICATION** (see `DOCUMENTATION_MAP.md` §2) |
| Authority | Authoritative within scene composition. Below `CONSTITUTION.md`, `PRD.md` and `ARCHITECTURE.md`. |
| Earned by | **SCENE-COMPOSITION-001** |
| Status | **BUILT — AWAITING VALIDATION.** Not yet independently validated or human-accepted. |
| Implementing modules | `src/scene/definition.js`, `src/scene/validation.js`, `src/scene/codec.js`, `src/scene/compiler.js`, `src/scene/instance.js`, `src/scene/index.js` |
| Presentation adapter | `src/render/scene-presentation.js` |
| Tests | `tests/scene.test.js`, `tests/subterra-cell.test.js`, `tests/scene-browser.test.js` |
| Forcing consumer | `examples/scenes/subterra-cell/` |
| Canonical repository | `sumosizedginger/My-Game-Engine-1.0` |

This is the first document in the earned tier created under `CONSTITUTION.md` §29.1. It exists because scene composition is implemented, not because it is planned.

---

## 1. What a scene is

**A scene is engine data. It is not a renderer scene graph.**

A `SceneDefinition` describes what a composed space contains, how its parts relate, and where they sit. It holds no geometry, no renderer objects and no runtime handles. Rendering **consumes** a scene; it never owns one.

```text
SceneDefinition  ->  compileScene()  ->  SceneArtifact  ->  instantiateScene()  ->  SceneInstance
    source              compile            artifact              runtime              transient
```

This is the Definition / Artifact / Runtime separation `CONSTITUTION.md` §3 requires, applied to composition.

The test that keeps this honest: a scene compiled without ever touching the renderer is a complete scene. It simply is not on screen. `tests/purity.test.js` asserts that no module under `src/scene/` imports Three.js.

---

## 2. Identity

Two identities meet here and must never be confused.

| | Owned by | Stable across | Serialized |
| --- | --- | --- | --- |
| `pid` — persistent authored id | the **source** | compile, serialize, unload, reload | **yes** |
| `EntityHandle(index, generation)` — runtime id | an **instance** | nothing; reallocated every instantiation | **never** |

`CONSTITUTION.md` §14 forbids serializing runtime handles. `tests/scene.test.js` checks this at the byte level: the canonical scene text must contain no `index`, no `generation`, and no mention of a handle.

Unloading and reinstantiating an artifact yields **the same pids and different handles**. That is the property future streaming, save and networking work depends on, and it is asserted directly rather than assumed.

### 2.1 Known limit — handles are pool-scoped

An `EntityHandle` is meaningful only with the entity manager that issued it. Two managers each starting from an empty pool both allocate `{index: 0, generation: 1}`: the values collide while referring to different entities, and a handle value carries no pool identity, so **no lookup can tell them apart.**

A `SceneInstance` therefore stamps a unique `instanceId` into the entity data it creates and checks it in `pidFor()` and `owns()`. That makes ownership decidable when instances **share** an entity manager — the realistic multi-scene shape — and it cannot help across separate pools.

Making handle values globally unique would mean changing runtime identity architecture, which was outside this tranche. **Scenes that must interoperate should share one entity manager**, which `instantiateScene` supports directly.

---

## 3. SceneDefinition v1

```text
SceneDefinition {
  version:      1
  id:           string
  units:        'm'
  upAxis:       '+Y'
  forwardAxis:  '-Z'
  nodes:        SceneNode[]
}

SceneNode {
  pid:        string        persistent authored identity, unique per scene
  name:       string        semantic name; anonymous nodes are refused
  parent:     string|null   parent pid, or null for a root
  transform:  LocalTRS      LOCAL, relative to the parent
  tags:       string[]      lightweight authored metadata, sorted
  asset:      string|null   OPAQUE presentation key; the scene never interprets it
}

LocalTRS {
  translation: [x, y, z]
  rotation:    [x, y, z, w]   quaternion
  scale:       [x, y, z]
}
```

The TRS representation is **the one the engine already owns** for geometry (`transformMesh` in `src/geometry/mesh-ops.js`). Reusing it rather than inventing a second convention is deliberate: a node's world placement must agree with what the same TRS would have done to a mesh.

### 3.1 Why `asset` is an opaque string

A node references geometry by key. The scene layer never resolves it. This is what keeps a definition renderer-independent and serializable, and it is why `examples/scenes/subterra-cell/` returns its definition and its asset library as two separate things.

---

## 4. Validation

`validateSceneDefinition(definition) -> { valid, diagnostics }`, matching the `validateMesh` contract. Every defect is reported, not just the first.

| Code | Refused |
| --- | --- |
| `SCENE_VERSION`, `SCENE_ID`, `SCENE_CONVENTION` | malformed header |
| `SCENE_PID_INVALID` | missing or malformed persistent id |
| `SCENE_DUPLICATE_PID` | two nodes sharing an identity |
| `SCENE_NAME_REQUIRED` | anonymous node |
| `SCENE_MISSING_PARENT` | parent not present in this scene |
| `SCENE_SELF_PARENT` | node parented to itself |
| `SCENE_CYCLE` | hierarchy ring; a scene is a forest, not a graph |
| `SCENE_TRANSFORM_INVALID` | non-finite translation, rotation or scale |
| `SCENE_ROTATION_DEGENERATE` | zero-length quaternion |
| `SCENE_SCALE_INVALID` | zero or negative scale |
| `SCENE_TOO_LARGE` | over `SCENE_MAX_NODES` (4096) |
| `SCENE_ASSET_INVALID`, `SCENE_TAGS_INVALID` | malformed metadata |

**No silent correction.** A structurally ambiguous hierarchy is refused with a diagnostic naming what is wrong. Guessing what an author meant is how editor-only truth gets established.

One defect produces one diagnostic: a self-parent is not also reported as a missing parent and a cycle, and a three-node ring is one `SCENE_CYCLE`, not three.

---

## 5. Compilation

`compileScene(definition) -> SceneArtifact` (frozen).

The compiler validates, establishes canonical order, derives world transforms and freezes. It does **not** render, own GPU resources, run gameplay or hold state between calls. It is not Kiln: Kiln is the engine-wide compile/bake system (`ARCHITECTURE.md` §6) and remains unbuilt.

### 5.1 Canonical order

Every parent precedes its children; siblings keep authored order. The order is a pure function of the definition, so the same definition always compiles to the same artifact, and sibling order is preserved because it is authoring intent.

### 5.2 World transform composition

Same order `transformMesh` uses for geometry — scale, then rotate, then translate:

```text
worldScale       = parentScale * localScale
worldRotation    = parentRotation * localRotation
worldTranslation = parentTranslation + rotate(parentRotation, parentScale * localTranslation)
```

Quaternions are renormalized at each composition, because a deep chain accumulates magnitude drift. `Math.sqrt` is IEEE-754 exact per the ECMAScript specification, so this stays deterministic across conforming runtimes.

### 5.3 Artifact identity

- `sourceHash` — canonical scene text through the engine's existing `hashBytes`.
- `artifactHash` — covers the **compiled result**, including derived world transforms, so a compiler change that alters composition is visible even when the source is untouched.

Canonical serialization ignores incidental ordering: two authorings of one scene that differ only in object key order or tag order produce identical bytes.

---

## 6. Runtime instantiation

`instantiateScene(artifact, { entityManager, transformManager }) -> SceneInstance`

Managers are optional and must be supplied **together or not at all** — a borrowed entity manager with a fresh transform manager would silently split transform authority across two stores. When omitted, the instance creates and owns them.

### 6.1 Transform authority

| Node | Ownership | Why |
| --- | --- | --- |
| root | `STATIC` | immovable scenery |
| parented | `ATTACHED` | `GAMEPLAY_FOUNDATION.md` §3.1 already defines `ATTACHED` as "derives world transform hierarchically from a parent entity" |

Composition introduces **no new ownership mode and no second per-tick writer**. It publishes the derived world *position* into the existing transform manager once, at instantiation. Neither `STATIC` nor `ATTACHED` is moved by `commitAll`, which `tests/scene.test.js` verifies by ticking the clock and asserting positions are unchanged.

### 6.2 Rotation and scale are not in the runtime transform

The runtime `Transform` record owns position and velocity only. Scene composition does **not** extend it. Consumers needing full placement read `worldTransformOf(pid)`, which is derived artifact data rather than a competing mutable transform store.

### 6.3 Queries

```text
handleFor(pid)          pidFor(handle)        owns(handle)
nodeFor(pid)            worldTransformOf(pid) localTransformOf(pid)
childrenOf(pid)         parentOf(pid)         roots()
members()               getDiagnostics()      size / disposed / instanceId
```

Deliberately not a query language and not ECS selectors. These are the questions the forcing consumer actually asked.

### 6.4 Lifecycle

`dispose()` despawns every entity this instance created, which bumps each slot generation so every handle it issued becomes permanently stale. Borrowed managers keep serving other consumers; owned managers are cleared. Repeated disposal is safe. A disposed instance **throws** on runtime queries rather than answering stale ones.

---

## 7. Public API

| Surface | Exports | Why |
| --- | --- | --- |
| `engine/runtime` | `instantiateScene`, `liveSceneInstanceCount` | an exported game instantiates and queries compiled scenes |
| `engine/full` | definition, validation, codec, compiler | authoring and compilation are not shipped with a game |

This split is `CONSTITUTION.md` §5: a small exported game must not carry the whole authoring toolchain. `tests/purity.test.js` asserts that `compileScene`, `createSceneDefinition`, `encodeScene` and friends are absent from `engine/runtime`.

`tests/subterra-cell.test.js` asserts the forcing consumer imports **only** the public package — no deep import into `src/`, no renderer types.

---

## 8. Presentation adapter

`src/render/scene-presentation.js` is the one-way boundary between an instantiated scene and Three.js. It reads a scene and produces renderer objects; nothing upstream knows it exists.

**Flat object tree.** Nodes are added as siblings, each at its already-derived world transform, rather than mirrored into a nested `Object3D` hierarchy. The compiler has already composed the hierarchy; rebuilding it in the renderer would create a second place where composition happens and therefore a second chance for the two to disagree.

**Resource sharing.** Geometry is shared per asset key and materials per id, so a cell placing the same crate twice uploads one crate. This is resource sharing, **not draw-call batching** — render compilation is a separate concern and is not started here.

Renderer objects carry `userData.scenePid`, so a picked mesh resolves back to its authored node without a side table.

---

## 9. Forcing consumer — SUBTERRA cell

`examples/scenes/subterra-cell/` is a bounded constructed underground service cell, built entirely through public authoring verbs. Its job is to put pressure on the scene model, not to be beautiful.

```text
37 authored nodes · depth 3 · 1 root · 15 assets · 8 materials · 25 renderer objects
```

It exercises: assemblies whose children are placed in the parent's frame (a raised doorway carries its posts and header); a door leaf three levels deep and yawed within its assembly; a console yawed a quarter turn whose display is tilted within the console's own frame; one wall asset placed twice with one rotated a half turn; repeated crates and brackets sharing uploaded geometry.

Two placement defects were found only by looking at real renders — a console display floating above its desk and a crate hovering above the one below it. Neither was detectable from source inspection or from a green test suite.

---

## 10. Evidence

| Kind | Where |
| --- | --- |
| Unit and contract | `tests/scene.test.js` — 43 tests |
| Forcing consumer | `tests/subterra-cell.test.js` — 11 tests |
| Real browser | `tests/scene-browser.test.js` — 13 subtests |
| Evaluator target | `?scene=subterra&controlled=1`, checks `sceneBoot`, `sceneComposition`, `sceneHierarchy`, `sceneWorldTransforms`, `scenePresentation`, `sceneUnload`, `sceneReloadIdentity`, `sceneHandleRenewal`, `sceneNoLeak`, `scenePageProofSuccess` |
| Visual | `artifacts/captures/scene_subterra_cell_fixture.png` |

Browser evidence covers what unit tests cannot: that the scene reaches the screen, that renderer objects sit at composed world transforms, that unload releases what load acquired, that five lifecycle cycles change no resource count, that no permanent animation frame is scheduled, and that dispose and double-dispose are safe.

---

## 11. Boundaries — what this subsystem does NOT do

| Not implemented | Why |
| --- | --- |
| **Prefabs** | hierarchy alone was enough for this tranche. `SceneDefinition` does not foreclose a later `PrefabDefinition` instantiating into a scene. |
| **Reparenting** | nothing required it. A mature editor having it is not evidence. |
| **Scene transitions** | orchestration belongs to later runtime and game work. |
| **Streaming and chunking** | this tranche proves only that an instance can be created and destroyed cleanly, which is streaming's first prerequisite. |
| **Save games** | scene serialization is **source** serialization, not player save data. Future save state will *reference* persistent scene identity; it is not this. |
| **Networking** | nothing here requires a global mutable scene singleton, and that is the whole obligation for now. |
| **Render batching** | `ARCHITECTURE.md` §48 and `ROADMAP.md` §46.1. Measurement precedes optimization. |
| **Rotation/scale in the runtime transform** | the runtime `Transform` owns position and velocity. Extending it is transform-architecture work. |

No global scene singleton exists. Two independent `SceneInstance`s can coexist, and `tests/scene.test.js` proves disposing one does not disturb the other.

---

## 12. Known limitations

1. **Handles are pool-scoped** (§2.1). Cross-pool handle values can collide and are indistinguishable.
2. **World transforms are derived once, at compile time.** Moving a node after compilation is not supported; there is no live hierarchy update. A scene is currently static composition.
3. **`asset` keys are unvalidated by the scene layer.** A key with no library entry is reported by the presentation adapter as `unresolvedKeys`, not refused at compile time, because the scene layer deliberately does not know what assets exist.
4. **The presentation adapter emits one renderer object per asset-bearing node**, which is the same authoring-granularity-equals-render-granularity coupling `ARCHITECTURE.md` §48 records for MeshIR parts. It is not addressed here.
5. **No spatial index.** `nodeFor(pid)` is a linear scan over the artifact's nodes. Fine at 37 nodes and at the 4096-node ceiling it is not; a real world will need indexing.

---

## 13. Routing

Load this document for scene composition, hierarchy, scene serialization or scene lifecycle work. It does not govern rendering, geometry authoring or runtime simulation. See `DOCUMENTATION_MAP.md` for the full routing rules and `CONSTITUTION.md` §29 for why this tier exists.
