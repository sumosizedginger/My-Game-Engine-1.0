# CINDER_CAPABILITY_BENCHMARK.md

**Artifact type:** Capability benchmark result; not a canonical repository authority

**Canonical repository:** `sumosizedginger/My-Game-Engine-1.0`

**Branch:** `ai-asset-foundation-001`

**Asset revision:** `d07589efa94cd23aafc578b57de6cafd5da0bc1e` (worktree clean)

**Toolchain:** Node `v24.21.0`

---

## 1. What this measures, and what it does not

Two separate questions are kept apart deliberately.

**Pipeline acceptance** asks *does the architecture work correctly?* That is
gated by `tests/cinder.test.js` and the canonical evidence chain, and it was
already satisfied by the 476-triangle iteration zero.

**Capability benchmark** asks *how sophisticated an asset can an AI coding
agent author through the vocabulary that exists today?* That is what this
document reports.

A disappointing benchmark would not invalidate a correct pipeline, and an
attractive screenshot would not excuse a structural failure. Both are reported
on their own terms.

**Not self-certified.** This is BUILDER PASS evidence submitted for independent
re-audit.

---

## 2. Constraints observed

CINDER was authored entirely through the public authoring surface:
`createBoxMesh`, `createCylinderMesh`, `extrudeProfile`, `transformMesh`,
`mergeMeshIR`, plus `createAnchor` and `createMaterialDefinition`.

No DCC application. No downloaded, imported or embedded mesh. No GLB source. No
image-to-3D. No remote generation. No CINDER-specific geometry operation added
to engine core. No bevel, boolean, sweep, loft, inset or mirror introduced. No
vertex touched outside the engine vocabulary.

Profile generators (`roundedRectProfile`, `crownedProfile`, …) and quaternion
helpers live in the example and produce *inputs* to engine verbs. They generate
no vertices themselves. `tests/cinder.test.js` enforces this: the example may
import only `@sumosizedginger/my-game-engine-1.0/full` and its own local files,
may not reference `three` or renderer types, and may not contain typed-array
literals or asset-file references.

---

## 3. Final metrics

| Measure | Value | Budget | Utilisation |
| --- | --- | --- | --- |
| Triangles | 7,236 | 250,000 | **2.9%** |
| Vertices | 11,716 | 500,000 | **2.3%** |
| Semantic parts | 227 | 256 | **88.7%** |
| Predicted draw calls | 227 | 256 | **88.7%** |
| Measured draw calls | 227 | 256 | **88.7%** |
| Material families | 13 | 32 | 40.6% |
| Generation time | 21.9 ms | 2,000 ms | 1.1% |

Predicted and measured draw calls agree exactly, and rendered triangles (7,236)
equal authored triangles.

Other measurements: MeshIR canonical encoding **612,624 bytes**; mesh hash
`1f3c73aa330cbe18`; manifest hash `4aad7de3ff23fee9`; bounds
**0.1040 × 0.4196 × 1.0605 m**; 18 semantic anchors; frame time 43.8–51.0 ms at
660×591 (a cold on-demand render, not a steady-state frame rate — the Preview
Lab holds no idle animation loop).

**The single most important number here is the ratio.** Part count is at 88.7%
of budget while geometry is at 2.9%. The ceiling on authored complexity in this
architecture today is *the per-part draw call*, not triangles, not vertices and
not generation time. That points at compilation work, not modelling work.

### Parts by assembly

| Assembly | Parts | Assembly | Parts |
| --- | --- | --- | --- |
| receiver | 46 | stock | 22 |
| handguard | 43 | grip | 18 |
| barrel | 18 | optic | 15 |
| thermal | 11 | magazine | 11 |
| rail | 11 | muzzle | 10 |
| control | 9 | wear | 7 |
| fastener | 6 | | |

### What was consolidated, and what stayed separate

Kept separate because a consumer needs the identity: every rail tooth, vent,
rib, prong, fastener and status indicator. A game needs to detach an optic,
damage a magazine, or light a status chip independently.

Consolidated: the barrel is one cylinder rather than a stack of sections; the
receiver core is one prism per half rather than per panel; the stock trusses
are three parts rather than three parts plus joint blocks.

Not consolidated further **because part count is the binding budget** — which is
the same finding from the other direction. Given batching, the natural next
step would be more parts, not fewer.

---

## 4. Iteration log

Ten deliberate generate → preview → capture → inspect → diagnose → revise
cycles. Each was evaluated against side silhouette, three-quarter silhouette,
end-on readability, proportion, floating or disconnected pieces, weak
primitive-looking regions, repeated-detail quality, material separation, dead
visual zones, semantic organisation and runtime stats.

| # | Change | Parts | Tris |
| --- | --- | --- | --- |
| 0 | Baseline (pipeline proof) | 16 | 476 |
| 1 | Full rebuild: layered shells, 12 materials, thermal core, skeletal stock, chamfered profiles throughout | 183 | 5,392 |
| 2 | Magazine width/depth transposition fixed; front-end mass added; body widened | 190 | 5,556 |
| 3 | Grip rake reversed; grip and magazine rebuilt in assembly-local frames; trigger guard, foregrip and muzzle prongs enlarged; receiver dead zone filled | 198 | 5,780 |
| 4 | Optic hood stopped swallowing its lens; foregrip rebuilt locally; muzzle prong ring added | 201 | 5,880 |
| 5 | `cinder.void` introduced for openings; grip beavertail and palm swell; heat-bleed vent | 203 | 5,936 |
| 6 | Grip/magazine proportions separated; detail added to the well-lit side | 208 | 6,076 |
| 7 | `roundedRectProfile` / `roundedTaperProfile`: moulded forms replace chamfered boxes | 208 | 6,524 |
| 8 | Rust-brown jacket corrected; prongs protrude past the ring; receiver flank recess and charge gauge | 214 | 6,692 |
| 9 | Grip side ribs replace the single light panel | 220 | 7,052 |
| 10 | Asymmetric wear: armour plate, rivets, scorch marks | 227 | 7,236 |

### What the Preview Lab caught that no unit test would have

Every one of these produced a structurally valid mesh, passed the budget, and
was visibly wrong:

- **An optic hood centred over its own lens.** A 26 mm hood was centred on a
  6 mm lens sitting inside it, so the asset's strongest accent — the emissive
  front lens — was invisible behind a block from every forward view.
- **A magazine with width and depth transposed**, producing a 70 mm slab wider
  than the 60 mm receiver it hung from.
- **A grip raked forward instead of aft**, from `rotationX(90 + rake)` where
  `rotationX(90 - rake)` was meant.
- **A foregrip in three disconnected pieces.** Body, mount and cap were each
  positioned in world space; applying the rake then moved the body's lower end
  25 mm from where the cap had been placed.
- **Near-black everything.** `metalness: 0.92` in a scene with no environment
  map: no diffuse response and nothing to reflect.
- **A rusty-looking handguard**, because faked vents were scorched-alloy brown
  rather than dark enough to pass for shadow.

This is precisely the class of error the tranche was built to surface, and it
is the strongest evidence in this document that the human-preview loop earns
its place.

---

## 5. Iteration zero versus final

| | Iteration 0 | Final |
| --- | --- | --- |
| Parts | 16 | 227 |
| Triangles | 476 | 7,236 |
| Materials | 4 | 13 |
| Anchors | 6 | 18 |
| Value range | 0x16181c–0x4a4f57 | 0x15171a–0x9aa2ad plus emissives |
| Openings | none | 21 framed recesses |
| Repeated detail | 6 rail teeth | 11 rail teeth, 5 ribs, 12 vents, 6 flutes, 3 prongs, 8 grip ribs, 4 mag ribs, 6 stock teeth, 6 fasteners |
| Asymmetry | charging handle only | port side, armour plate, scorch, canted backup sight |
| Emissive | 1 lens | lens, 5 status chips, 2 ammo counters, 2 charge gauges, thermal core, heat bleed |
| Curved forms | 8-sided chamfers | 16-point moulded profiles |

Substantively: iteration zero was a rifle-shaped collection of primitives that
silhouetted as one dark mass. The final asset reads as a layered industrial
assembly with a distinct identity (an exposed glowing thermal exchanger),
legible material hierarchy, and repeated mechanical rhythm along its length.

---

## 6. Remaining weaknesses, classified

Classification is per the work order: **A** AI authoring, **B** engine
vocabulary, **C** material/surface, **D** preview/evidence, **E**
runtime/compilation.

### A — AI authoring limitations (the vocabulary could express it; the agent did not)

**A1. The grip took four iterations to read correctly.** Rake direction, panel
size, side texture and material were each wrong in turn. Nothing about the
vocabulary prevented getting it right the first time.

**A2. Three placement defects were my arithmetic, not the engine's.** The
magazine transposition, the optic hood, and the foregrip disconnect were all
avoidable. Two of the three were fixed by adopting assembly-local authoring —
a *technique* available from the start, not a capability that was added.

**A3. Stacked-slice lofting was never attempted.** The vocabulary can
approximate swept and lofted forms by stacking many thin prisms with
interpolated profiles. That would produce genuinely curved receiver
transitions, a tapered barrel contour and a moulded stock comb. It was not
attempted because part count is the binding budget (see E1) — so this limit is
real, but it is an *interaction* between authoring technique and the draw-call
ceiling rather than a missing operation.

**A4. The asset remains an assembly of discrete prisms.** Nothing flows into
anything else. A more skilful use of the same five verbs would close some of
that gap.

### B — Engine vocabulary limitations

**B1. No bevel or chamfer on assembled edges.** *This is the largest single
visual limitation.* Chamfers exist only where they were designed into an
extrusion profile up front. Wherever two authored forms meet — a proud side
plate against a receiver core, a rib against a shell, the optic mount against
the rail — the intersection is a perfectly sharp 90°, which no manufactured
object has.
*Workaround attempted:* layered profile construction with chamfers generated
directly into every profile.
*Result:* improved silhouette and edge highlights substantially, but cannot
produce a consistent manufactured edge treatment on emergent edges, because the
chamfer cannot follow an edge that only exists after two forms are combined.
*Capability that would unlock it:* **topology-aware bevel/chamfer.**

**B2. No boolean, so no real openings.** Every vent, the ejection port and the
magazine well mouth are faked: a dark plate set slightly proud of the shell,
bracketed by frames set more proud, so the frames cast the shadow a real recess
would. It works in the canonical views and fails at grazing angles, where the
"hole" is visibly a flat panel standing on the surface.
*Capability:* **boolean/CSG**, or the narrower and probably safer **inset +
extrude-inward**.

**B3. Mirroring is refused, so symmetric pairs are authored twice.** This is the
*correct* decision — negative scale flips winding and surface orientation — but
it doubles the source for every left/right pair and creates a real divergence
risk. `pair()` makes the duplication explicit rather than incidental.
*Capability:* **mirror with winding and normal correction.**

**B4. Repeated detail is hand-computed.** Rail teeth, ribs, vents, barrel
flutes, muzzle ports and prongs are explicit loops with manual radial
trigonometry. It works and stays deterministic, but it is exactly where
arithmetic errors appear.
*Capability:* **linear and radial array/pattern operations.**

**B5. Non-convex profiles must be decomposed by hand.** `extrudeProfile` caps
with a triangle fan and correctly refuses a non-convex profile rather than
emitting wrong geometry. The trigger guard is therefore three separate convex
bars. Acceptable here; prohibitive for any genuinely concave silhouette.
*Capability:* **ear-clipping cap triangulation for non-convex profiles.*

**B6. Parts interpenetrate rather than join.** Nothing is welded; shells are
doubled at every overlap. Invisible in preview, but it blocks clean silhouette
extraction, shell-based physics and any future LOD that assumes a manifold.

### C — Material and surface limitations

**C1. Metal cannot be expressed.** The preview scene uses a hemisphere light and
two directional lights with **no environment map and no IBL**. A
`MeshStandardMaterial` at high metalness has almost no diffuse response and
relies entirely on the environment for specular, so `metalness: 0.92` renders
as near-black regardless of base colour. Metal is currently faked with low
metalness (0.28–0.44) and a raised blue-grey albedo.
*This is a recorded workaround, not an art preference.*
*Capability:* **environment lighting / IBL in the preview scene.**

**C2. No surface detail of any kind.** No UV generation, and no texture binding
in the preview path. Every part is one flat colour. There is no wear, no
grime, no stencilling, no serial markings, no edge dirt — all the things that
make a hard-surface asset look manufactured rather than moulded from one
compound. The "scorch" and "hazard" accents in CINDER are *geometry*, because
geometry is the only way to place a coloured mark.
*Capability:* **UV generation plus texture binding.**

**C3. Curved surfaces are visibly faceted.** Normals are per-face across split
vertices, with no smoothing groups or normal control. Raising segment counts
improves the silhouette but never the shading — a 22-segment cylinder still
reads as 22 flat strips.
*Capability:* **smoothing groups / explicit normal control.**

### D — Preview and evidence limitations

**D1. Canonical view names disagree with the declared forward axis.**
`CANONICAL_VIEW_DIRECTIONS.front` is `[0, 0, 1]`, a world-space label, while the
engine declares `forwardAxis: '-Z'`. The consequence is that **CINDER's `front`
capture shows its butt plate and its `back` capture shows its muzzle.** An agent
reasoning over a manifest that says `forwardAxis: -Z` and a capture named
`front` will draw the wrong conclusion. Either the views should be resolved
relative to the declared axes, or the names should be world-relative
(`plusZ`/`minusZ`) so they cannot be misread.

**D2. Three of six canonical views are effectively backlit.** The key light is
fixed at `(3, 5, 4)`, so `front`, `back` and `left` are lit only by the 0.8
fill and return markedly darker evidence than `right` and `threeQuarter`. This
is an asset-independent property of the harness: half the canonical evidence is
systematically less legible than the other half, and an agent has no way to
know that from the manifest.

**D3. The top view is a 7%-wide sliver.** `projectedBoundsOccupancy` reports
`w=0.0764, h=0.8696`. The framing is *correct* for a 10:1 asset, but the view
carries almost no readable detail. Not a defect; a limit worth recording,
because "reads well from the top" is not achievable for this asset shape with a
single canonical framing.

**D4. `projectedBoundsOccupancy` cannot distinguish a full frame from a sparse
one.** It measures the projected axis-aligned bounding box, so CINDER's
skeletal open stock reports exactly what a solid block of the same extent would.
Now named precisely (this tranche's repair), but the stronger measurement does
not exist. *Rendered-pixel occupancy was deliberately not added here.*

**D5. Framing is measured; lighting, contrast and legibility are not.** Nothing
in the manifest would have flagged the near-black iteration-zero render as
unreadable. Every defect in §4 was caught by a human-or-agent looking at a
picture, not by a number.

### E — Runtime and compilation limitations

**E1. Draw calls are the binding budget.** 227 parts produce 227 draw calls
against a ceiling of 256 — **88.7%** — while triangles sit at 2.9%. The asset
cannot get meaningfully more detailed without either surrendering semantic
granularity (merging parts, losing per-part identity in the manifest) or
gaining batching. Every other limitation in this document is downstream of this
one, because the cheapest fix for most of them is *more parts*.
*Capability:* **Kiln-side part-group batching / draw-call compilation**, so
semantic part count and draw-call count stop being the same number.

---

## 7. Capabilities the evidence suggests next

Ranked by evidence from this benchmark, not by general desirability.

1. **Draw-call batching (Kiln).** E1. Unblocks everything else; it is the
   actual ceiling today.
2. **Bevel/chamfer.** B1. Largest single visual gain per unit of engine work.
3. **Smoothing groups / normal control.** C3. Cheap; improves every curved
   surface already authored.
4. **Environment lighting in the preview scene.** C1. Until this exists, metal
   is not expressible and every metallic asset will be authored around a
   workaround.
5. **Mirror with winding correction.** B3. Halves authoring cost for symmetric
   assets and removes a divergence risk.
6. **Linear/radial array.** B4. Removes the arithmetic-error class that
   produced two of this benchmark's defects.
7. **Inset, or boolean/CSG.** B2. Real openings.
8. **UV generation + texture binding.** C2. The largest gain in *apparent*
   quality, but the largest scope.
9. **Ear-clipping cap triangulation.** B5. Small, self-contained, removes
   manual decomposition of concave profiles.
10. **Asset-relative canonical view naming.** D1. Small correction, prevents a
    whole class of agent misreading.

**Explicitly not recommended by this evidence:** sweep, loft, subdivision and
remesh. None of them was reached for during ten iterations, and the forms that
would have used them (A3) were blocked by part count rather than by their
absence.

---

## 8. Stop conditions

Artistic iteration stopped at iteration 10 because **further meaningful
improvement is blocked by missing generic vocabulary** (B1, B2, C1, C2, C3) and
because **additional complexity no longer materially improved the asset** at
88.7% of the part budget.

No architectural violation was required or attempted. No engine operation was
added. No deterministic contract was weakened. Nothing was merged to `main`.

---

## 9. Diagnostics

Zero console errors, zero page errors, zero blocking diagnostics, across every
capture run. No `PREVIEW_DPR_CLAMPED`, no budget degradation, no merge
warnings. The Preview Lab holds no idle animation frame after settling
(`idleFrameScheduled: false`), and dispose is clean and idempotent.

**Unresolved:** D1 (view naming) and D2 (fixed key light) are real findings
against the harness that this tranche did not authorise changing. They are
recorded here rather than fixed.
