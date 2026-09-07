# World Forge

Proof C builder implementation. Independent audit and human visual acceptance remain required.

## Implemented boundary

World Forge generates one bounded square heightfield world. `src/world/index.js` is the code entry point. `generateWorld(recipe)` produces inspectable field arrays, terrain geometry, ecological placements and solid trunk volumes. `src/games/world` owns the traversal proof and presentation. Runtime-only exports do not import these modules.

```text
WorldRecipe -> WorldFieldCache -> terrain geometry and ecological material colors
                             -> WorldFieldQuery -> vegetation placement
                                                -> root and foot grounding
                                                -> slope/bounds traversal checks
VegetationPlacement -> instanced tree rendering
                    -> WorldVolumeQuery -> placement rejection and traversal collision
```

Recipe parameters plus seed and generator version are source. Arrays, geometry, checksums and runtime objects are derived products. Changing a recipe means regenerating its world; do not mutate cached arrays or placement records to edit source truth. There is no global world singleton or disk cache.

## WorldRecipe

`createWorldRecipe(rawParameters)` also accepts its serialized `{type, version, parameters}` output. Current output type is `world_recipe`, version is `1`. Parameters and the outer record are frozen. Explicit invalid numeric parameters produce stable `WORLD_PARAMETER_NORMALIZED` warnings containing the parameter name and normalized value. Missing parameters use defaults. Values must be finite numbers; strings are not coerced. Seed and resolution are floored after clamping.

| Parameter | Default | Inclusive bounds | Meaning |
| --- | --- | --- | --- |
| seed | 87122 | 0..4294967295 | Unsigned integer seed |
| worldSize | 128 | 96..160 | Side length in meters, centered at origin |
| terrainResolution | 128 | 64..192 | Cells per side |
| heightAmplitude | 5 | 0..8 | Base height amplitude in meters |
| terrainFrequency | 0.018 | 0.006..0.025 | Base lattice frequency per meter |
| moistureFrequency | 0.028 | 0.01..0.06 | Moisture lattice frequency |
| forestThreshold | 0.48 | 0.3..0.7 | Moisture threshold for forest weighting |
| treeDensity | 0.035 | 0..0.06 | Candidate budget per square meter, multiplied by three before rejection |
| groundCoverDensity | 0.3 | 0..0.6 | Tuft candidate budget per square meter |
| treeScaleMin | 0.85 | 0.7..1.2 | Lower tree scale bound |
| treeScaleMax | 1.5 | 1.2..1.8 | Upper tree scale bound |
| maxTreeSlope | 0.32 | 0.1..0.5 | Maximum rise/run for trees and tufts |

Bounds are `[-worldSize/2, worldSize/2]` on X and Z. Height combines base value noise and a quarter-amplitude octave; the amplitude parameter is not a strict maximum elevation. The recipe format is local to this bounded generator, not a new universal definition identity or migration framework.

## Fields and terrain

`createWorldFieldCache(recipe)` samples seeded, smooth value noise into three Float32 arrays: `height`, `moisture`, and `forest`. Each has `(resolution + 1)^2` entries, with X varying fastest. Height uses two spatial frequencies. Moisture and a fixed soft clearing centered at (-12, 8) produce forest weights from zero to one. Clearing position is generator policy, not an additional authored biome.

`createTerrainGeometry(cache)` uses those exact heights as vertex Y coordinates. Each cell has two upward-facing triangles with the same diagonal used by field interpolation. A single indexed grid has no chunk seams. Vertex colors interpolate an explicit earth/grass palette using cached forest weights. Render normals are averaged vertex normals; query normals are exact triangle-plane normals. Their purposes differ while their surface positions agree.

`createWorldFieldQuery(cache)` exposes:

- `isInsideWorld(x,z)`: finite coordinates within inclusive world bounds.
- `sample(x,z)`: height, unit upward normal, slope (rise/run), moisture, forestWeight and biome.
- `heightAt(x,z)`: sampled height.

Outside bounds, `sample` and `heightAt` return `null`. Interpolation is triangle barycentric, not bilinear height interpolation. Biome is `forest` for weight at least 0.45 and `meadow` otherwise. Normals and slope are derived cheaply from the same three heights rather than duplicated cached truth. Multiple real consumers are ecology placement, root grounding, individual foot targets, movement slope checks, spawn selection and HUD inspection.

## Ecology and vegetation

Trees prefer higher forest weight, reject excessive slopes and leave a small clear origin. Placement candidates use independently mixed deterministic hash channels for coordinates, acceptance, scale and rotation. The volume grid rejects nearby trees before adding another record. Tufts reject excessive slopes and trunk overlaps, and become sparser under high forest weight.

A frozen tree placement contains stable candidate ID, X/Y/Z, scale, rotation, radius, baseDepth, trunkHeight, forestWeight and slope. Y comes from `WorldFieldQuery`. The lower rim samples the nine trunk vertices against the field; baseDepth buries the cylinder below that footprint with 1 cm cover. That same object becomes the cylinder query record. There is no separately authored collision tree.

The renderer instances a nine-sided trunk and two cone canopy tiers. Trunk radius and height come directly from its placement. Trunks stay upright, with an anchor on the sampled surface and a buried lower rim so sloping ground does not expose a floating base. Collision uses the same lower extent and unchanged top extent. Tufts are code-generated three-blade geometry, aligned to the sampled normal and varied by deterministic scale and yaw. One geometry per vegetation representation is shared by its instances. Small finite footprints can straddle triangle changes; this is not conformal root/foliage deformation.

## WorldVolumeQuery and traversal

`createWorldVolumeQuery(half)` owns a bounded spatial grid with eight-meter cells. `add(record)` indexes a cylinder record. `overlaps({x,z,radius,minY,maxY})` returns cylinder records intersecting the horizontal disc and vertical interval. The generator uses it for separation and tuft rejection; traversal uses it for solid trunk collision.

`resolveMovement(from,to,radius,height,fields)` subdivides displacement into at most 0.1-meter increments (or half the mover radius). It tests full motion, then X/Z sliding, so long valid caller steps do not jump across trunks. It also enforces the square boundary inset by mover radius and a maximum traversable slope of 0.5. It returns resolved X/Y/Z plus `blocked`. Invalid nonfinite coordinates or nonpositive extents throw a RangeError with code `WORLD_INVALID_VOLUME_QUERY`.

This is an upright-cylinder traversal approximation. It is not rigid-body physics, arbitrary mesh collision, overhang support, a navmesh or capsule dynamics. Canopies and grass are nonsolid. Their absence from solid queries is deliberate. Tree trunks and terrain boundaries are solid traversal constraints.

## Character and transform authority

`WorldTraversal` reuses average Character Forge geometry, natural Motion Forge locomotion, action input, the fixed clock, entity handles and KINEMATIC transforms. Input direction proposes displacement at the accepted gait speed. Volume and field queries constrain it. The coordinator supplies one resolved intent and commits through the transform manager once per step. Animation never commits entity coordinates.

Gait phase advances with actual resolved travel distance, so a blocked character does not continue walking in place. Renderer interpolation samples field height at interpolated X/Z. Each local foot target is rotated into world coordinates and independently samples the same field. The optional Motion Forge ground callback aligns soles with terrain, corrects ankle clearance for the plane, disables flat-ground toe roll and lowers the pelvis toward the downhill foot to retain reach. B1/B2 callers omit this callback and keep the accepted path.

C uses a 0.55 m traversal radius to enclose the natural-gait sole footprint as well
as the body. A smaller root-only radius allowed swing toes beyond the bounded
terrain despite the root remaining inside. The all-edge semantic traversal test
checks actual soles after movement stops at each boundary and a corner.

Idle/blocked traversal supplies the terrain-only standing option: both feet settle
under their hips while gait phase is retained. The stop/start transition is abrupt;
it does not leave a swing foot suspended indefinitely or introduce an animation graph.

`grounding()` measures actual foot-bone world positions. `soleGrounding()` skins the lowest rest-space foot-region vertices and compares their realized world Y against the field under each vertex. These are realized-position checks, not analytic target certification. The finite foot footprint can cross terrain triangle boundaries; checks allow at most 10 mm sole penetration and 25 mm stance clearance, while the controlled route measures substantially tighter values. This is not foot locking on arbitrary abrupt terrain or continuous turning animation.

## Live and controlled presentation

`?proof=c` lazily loads the full-viewport world viewer. Keyboard WASD/arrows and controller left stick/D-pad use the same semantic actions. R or controller Y resets traversal. A compact menu can regenerate from a seed. Physical discovery is the accepted input implementation, unchanged.

`?proof=c&controlled=1` uses seed 87122, the default recipe, fixed starting state and fixed camera. No live input attachment or animation loop runs. The evaluator fixes 1280x720 and drives the same coordinator through Forward 340 ticks, Right 180, Forward 720 at 60 Hz. This approaches a real generated tree along a clear sloped route, blocks, then traverses around it. No sequence teleport occurs after initial reset.

Both views use an explicit spectator canopy cutaway: foliage instances between the camera and player collapse from presentation while obstructing that sightline, then restore. Solid trunks remain rendered and collidable. HUD reports the cutaway count. The policy is deterministic from camera/player/placement data and does not mutate world records. It exposes terrain and trunk contact for review; it does not repair or conceal collision truth.

ResizeObserver and window resize use actual container dimensions, update camera aspect/projection and size the drawing buffer with DPR capped at two. Controlled dimensions belong to the evaluator, not to live CSS.

The live camera checks its short spectator boom against authoritative trunk volumes.
When a solid trunk blocks it, the camera uses the player's collision-free overhead
column. This avoids hiding a collidable trunk to obtain camera visibility. Camera
interpolation is also checked so its transition does not pass through a trunk.
This is a bounded player-camera consumer of volume queries, not mesh-wide raycasting.

## Determinism and inspection

`world.hashes` contains `fields`, `terrain`, `placements`, and `volumes` checksums. Canonical object keys are sorted and typed arrays become numeric arrays. Checksums exclude Three.js object IDs, timing and GPU state. `worldDataHash` is a noncryptographic regression checksum, not canonical Kiln/save/replay identity. Same recipe, generator build and supported platform class must reproduce exact canonical data; cross-device screenshot identity is not promised.

The bridge `window.__PROOF_C_WORLD__` exposes game/world data, renderer, snapshot, raw frame intervals, semantic simulation, controlled `runProof` and disposal. The world reports field-cache and total generation timing. Snapshot exposes seed, checksums, root, current field sample, realized feet and collision-blocked ticks. Field extrema, bounds, triangle count, placement count and volumes are directly inspectable from named arrays/records. Page proof returns structured checks, metrics and INFO/ERROR diagnostic records; every required C check and page success gate evaluator PASS.

## Ownership and lifecycle

- World owns terrain geometry; `world.dispose()` releases it once. Field arrays and placement/grid records are garbage collected when their world is released.
- Traversal owns the character geometry, compiled player material, skeleton, handles and transform records. It disposes/releases them once, then disposes its world.
- Renderer owns compiled terrain/vegetation materials, shared vegetation geometries, instance resources, lights/shadow target and WebGL renderer/canvas. It borrows world terrain and character resources.
- Viewer owns the frame request, DOM, input attachment, resize listener and observer. Dispose cancels/detaches them before disposing renderer and game. Regeneration disposes the previous viewer first.

## Donor inspection and provenance

Both inspections preceded production terrain/vegetation work. No donor code, assets, packages or architecture were copied. Local field generation, query interpolation, placement, collision and vegetation geometry are native implementations.

| Repository | Exact source SHA | Inspected paths | License | Decision and reason |
| --- | --- | --- | --- | --- |
| [vibe-stack/super-terrain](https://github.com/vibe-stack/super-terrain) | b82e82397fb95ccafcf4f5398c8b5af4d1063c71 | LICENSE; selected field-construction sections of src/terrain/compiler/heightField.ts and src/forest/forestField.ts | MIT, alightinastorm | REFERENCE: shared sampled fields and ecological coverage informed the seam. Its streaming, workers, R3F, editor and WebGPU architecture exceed C. |
| [Token-Gremlin/realistic-forest](https://github.com/Token-Gremlin/realistic-forest) | 4a0c7ec8c81dcc5c50dadf8ffae557b3878debb8 | LICENSE; src/world/Forest.js | MIT, Token Gremlin | REFERENCE: map consumers and forest composition were relevant. Global map/render/streaming systems were not adopted. |

Material changes to donor code: none, because nothing was ported/adapted. Integration evidence belongs to the native `tests/world.test.js` and `tests/world-browser.test.js` contracts. `sumosizedginger/my-engine-2` and original `My-Engine` were not inspected for this proof; neither is an implementation source.

## Failure criteria and limitations

Fail visual review for terrain cracks/holes/inversion, floating or deeply sunk vegetation, impossible-slope placement, visual trunk/collision disagreement, trunk penetration, escaping bounds, materially detached feet, material/ecology disagreement, ineffective seed variation, nonrepeatable data, obstructed inspection, or disconnected terrain plus arbitrary scatter. Automated checks do not substitute for human visual acceptance.

Current appearance is deliberately simple faceted conifers, grass blades and vertex-colored terrain. Canopy removal/restoration is abrupt. There is one procedural average player, fixed screen-relative movement, no camera orbit and no touch claim. There are no imported assets or new dependencies. No streaming, paging, origin rebasing, networking, saves, weather, water, ecosystem simulation, physics engine, editor or Proof D systems exist here.
