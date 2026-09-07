# Building a Bounded Procedural World: The Proof C Architecture Walkthrough

## Status

**ACCEPTED LEARNING MATERIAL**  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Ground truth base revision: `e8fa4f698be684599f3839fec46ac3456b448698`  
Governing specifications: [`WORLD_FORGE.md`](../../WORLD_FORGE.md), [`MATERIAL_FORGE.md`](../../MATERIAL_FORGE.md), [`CHARACTER_FORGE.md`](../../CHARACTER_FORGE.md), [`MOTION_FORGE.md`](../../MOTION_FORGE.md), [`GAMEPLAY_FOUNDATION.md`](../../GAMEPLAY_FOUNDATION.md), [`TESTING_AND_VALIDATION.md`](../../TESTING_AND_VALIDATION.md)  
Primary source implementation: [`src/world/`](../../src/world/), [`src/games/world/`](../../src/games/world/), [`src/browser/c-viewer.js`](../../src/browser/c-viewer.js)

---

## The Central Architectural Thesis

In **My Game Engine 1.0**, Proof C establishes the procedural 3D world pipeline, transitioning from the enclosed, flat arena of Proof B2 into an open, non-flat outdoor landscape.

The central law governing World Forge is:

> **THE WORLD MUST NOT TELL DIFFERENT SYSTEMS DIFFERENT STORIES ABOUT ITSELF.**

In many game engines, visual terrain meshes, physics collision representations, AI path grids, and ecological placement maps drift out of sync because they are exported, converted, or approximated through independent pipelines. 

Proof C eliminates this entire class of defects. In Proof C, one single mathematical recipe produces continuous field caches, which derive visual terrain, ecological vegetation placements, spatial collision volumes, and character grounding:

```text
WorldRecipe ──► WorldFieldCache ──► Terrain Geometry & Vertex Colors
                      │
                      ├──► WorldFieldQuery ──► Vegetation Placement
                      │                    ──► Root & Per-Foot Grounding
                      │                    ──► Slope & World Bounds Checks
                      │
VegetationPlacement ──► Instanced Tree Rendering
                      └──► WorldVolumeQuery ──► Placement Separation & Traversal Collision
```

Every consumer queries and agrees upon the exact same world truth.

---

## 1. World Recipe: Declarative Source Truth

Every world begins as an immutable `WorldRecipe`. The recipe holds the canonical generator parameters and random seed.

### 1.1 Parameter Domain and Normalization
In `src/world/recipe.js`, `WORLD_PARAMETER_BOUNDS` defines the schema bounds for world generation:

```javascript
// From src/world/recipe.js
export const WORLD_PARAMETER_BOUNDS = Object.freeze({
  seed: [0, 4294967295, 87122],
  worldSize: [96, 160, 128],
  terrainResolution: [64, 192, 128],
  heightAmplitude: [0, 8, 5],
  terrainFrequency: [0.006, 0.025, 0.018],
  moistureFrequency: [0.01, 0.06, 0.028],
  forestThreshold: [0.3, 0.7, 0.48],
  treeDensity: [0, 0.06, 0.035],
  groundCoverDensity: [0, 0.6, 0.3],
  treeScaleMin: [0.7, 1.2, 0.85],
  treeScaleMax: [1.2, 1.8, 1.5],
  maxTreeSlope: [0.1, 0.5, 0.32]
});
```

### 1.2 Recipe Factory Contract
`createWorldRecipe(input)` constructs the frozen record:

```javascript
// Excerpt from src/world/recipe.js
export function createWorldRecipe(input = {}) {
  const diagnostics = [];
  const source = input?.parameters ?? input ?? {};
  const parameters = {};
  for (const [name, [min, max, fallback]] of Object.entries(WORLD_PARAMETER_BOUNDS)) {
    const raw = source[name];
    let value = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
    if (name === 'seed' || name === 'terrainResolution') value = Math.floor(value);
    parameters[name] = value;
    if (raw !== undefined && raw !== value) diagnostics.push({
      severity: 'WARN', code: 'WORLD_PARAMETER_NORMALIZED', subsystem: 'world',
      message: `Normalized ${name}`, data: { parameter: name, value }
    });
  }
  return Object.freeze({ type: 'world_recipe', version: 1, parameters: Object.freeze(parameters), diagnostics: Object.freeze(diagnostics) });
}
```

Key rules:
- Non-finite numbers fall back to defaults; strings are not coerced.
- Explicit out-of-bounds parameters emit structured `WORLD_PARAMETER_NORMALIZED` diagnostics.
- The output `{ type: 'world_recipe', version: 1, parameters, diagnostics }` is frozen.
- The recipe is canonical input. Field caches, terrain geometry, placements, and spatial queries are downstream derived products. Changing the recipe means regenerating the world; cached arrays are never mutated in place.

---

## 2. Deterministic Randomness

Proof C adheres strictly to the engine's determinism laws: **zero `Math.random()` in world generation or gameplay simulation**.

In `src/world/recipe.js`, `seededUnit()` provides a fast, 32-bit integer bitwise mixing function returning a pseudo-random floating-point value in $[0, 1)$:

```javascript
// From src/world/recipe.js
export function seededUnit(seed, x, z = 0) {
  let n = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
```

Independent features use distinct deterministic seed channel offsets:
- Terrain base octave: `p.seed`
- Terrain secondary octave: `p.seed + 17`
- Moisture field: `p.seed + 101`
- Tree coordinate channels: `p.seed + 300`, `p.seed + 301`
- Tree acceptance & scale channels: `p.seed + 302`, `p.seed + 303`, `p.seed + 304`
- Ground cover tuft channels: `p.seed + 501` through `p.seed + 505`

The same recipe and seed always produce byte-for-byte identical worlds; changing the seed produces a completely varied landscape.

---

## 3. World Field Cache

Rather than re-evaluating noise equations on the fly across multiple independent systems, `createWorldFieldCache()` samples the world into three contiguous Float32 typed arrays:
1. `height`: Elevation in meters
2. `moisture`: Moisture scalar in $[0, 1]$
3. `forest`: Forest canopy weighting scalar in $[0, 1]$

```javascript
// Excerpt from src/world/fields.js
export function createWorldFieldCache(recipe) {
  const started = performance.now();
  const p = recipe.parameters, n = p.terrainResolution, count = (n + 1) ** 2;
  const height = new Float32Array(count), moisture = new Float32Array(count);
  const forest = new Float32Array(count);
  const spacing = p.worldSize / n, half = p.worldSize / 2;
  for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
    const wx = x * spacing - half, wz = z * spacing - half, i = z * (n + 1) + x;
    height[i] = p.heightAmplitude * (2 * noise(p.seed, wx * p.terrainFrequency, wz * p.terrainFrequency) - 1
      + 0.25 * (2 * noise(p.seed + 17, wx * p.terrainFrequency * 2, wz * p.terrainFrequency * 2) - 1));
    moisture[i] = noise(p.seed + 101, wx * p.moistureFrequency, wz * p.moistureFrequency);
    // A coherent meadow with a soft ecological fringe, also used by terrain color.
    const clearing = Math.exp(-((wx + 12) ** 2 + (wz - 8) ** 2) / 320);
    forest[i] = Math.max(0, Math.min(1, (moisture[i] - p.forestThreshold + 0.25) * 2.4)) * (1 - clearing);
  }
  return { recipe, resolution: n, spacing, half, height, moisture, forest,
    hash: worldDataHash({ height, moisture, forest }), generationMs: performance.now() - started };
}
```

Key features:
- Resolution $N = 128$ yields $129 \times 129 = 16,641$ grid samples.
- Height combines a base value noise layer with a quarter-amplitude octave for fine undulating relief.
- Forest weighting combines moisture thresholding with a fixed clearing centered at $(-12, 8)$ (`clearing = Math.exp(-((wx + 12)**2 + (wz - 8)**2) / 320)`), providing a natural meadow transition.
- The cache produces a deterministic regression checksum verifying cross-process data integrity.

---

## 4. Terrain from Field Truth

Visual terrain geometry is constructed directly from the field cache in `src/world/index.js`:

```javascript
// Excerpt from src/world/index.js
export function createTerrainGeometry(cache) {
  const { resolution: n, spacing, half, height, forest } = cache;
  const positions = new Float32Array(height.length * 3), colors = new Float32Array(height.length * 3), indices = [];
  for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
    const i = z * (n + 1) + x, f = forest[i];
    positions.set([x * spacing - half, height[i], z * spacing - half], i * 3);
    // Linear-space earth/grass palette blended by the same ecological field.
    colors.set([0.20 - 0.11 * f, 0.29 - 0.15 * f, 0.075 - 0.025 * f], i * 3);
    if (x < n && z < n) indices.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
```

The triangle index layout:
`indices.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2)`
establishes the diagonal split for every grid quad. As shown in the next section, field query interpolation uses this **exact same diagonal split**. Visual mesh triangles and spatial query heights match with $< 10^{-5}\text{m}$ precision.

---

## 5. World Field Query: Barycentric Surface Queries

`createWorldFieldQuery(cache)` exposes continuous sampling over the bounded world:

```javascript
// Excerpt from src/world/fields.js
export function createWorldFieldQuery(cache) {
  const { resolution: n, spacing, half } = cache;
  function isInsideWorld(x, z) { return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= half && Math.abs(z) <= half; }
  function sample(x, z) {
    if (!isInsideWorld(x, z)) return null;
    const gx = (x + half) / spacing, gz = (z + half) / spacing;
    const ix = Math.min(n - 1, Math.floor(gx)), iz = Math.min(n - 1, Math.floor(gz));
    const u = gx - ix, v = gz - iz, a = iz * (n + 1) + ix;
    const ids = u + v <= 1 ? [a, a + 1, a + n + 1] : [a + n + 2, a + n + 1, a + 1];
    const weights = u + v <= 1 ? [1 - u - v, u, v] : [u + v - 1, 1 - u, 1 - v];
    const interpolate = field => ids.reduce((s, id, i) => s + field[id] * weights[i], 0);
    const h = cache.height;
    const dx = u + v <= 1 ? (h[a + 1] - h[a]) / spacing : (h[a + n + 2] - h[a + n + 1]) / spacing;
    const dz = u + v <= 1 ? (h[a + n + 1] - h[a]) / spacing : (h[a + n + 2] - h[a + 1]) / spacing;
    const length = Math.hypot(dx, 1, dz), weight = interpolate(cache.forest);
    return { height: interpolate(h), normal: { x: -dx / length, y: 1 / length, z: -dz / length },
      slope: Math.hypot(dx, dz), moisture: interpolate(cache.moisture), forestWeight: weight,
      biome: weight >= 0.45 ? 'forest' : 'meadow' };
  }
  return { sample, isInsideWorld, heightAt: (x, z) => sample(x, z)?.height ?? null };
}
```

Key contracts:
- **Piecewise Planar Interpolation**: `ids` and `weights` evaluate the triangle plane formed by `u + v <= 1`. This is exact triangle plane barycentric math, not bilinear approximation.
- **Surface Normal and Slope**: Computed directly from height gradients $(dx, dz)$ along the active triangle face.
- **Biome Classification**: Evaluated deterministically: `'forest'` when `forestWeight >= 0.45`, else `'meadow'`.
- **Out-of-Bounds**: Returns `null` whenever $X$ or $Z$ falls outside $[-W/2, W/2]$.

---

## 6. Multiple Real Field Query Consumers

`WorldFieldQuery` is not an abstract convenience wrapper; it earned its place through six active production consumers:

1. **Ecology Placement**: Evaluates slope and forest weight to determine tree and ground-cover viability.
2. **Spawn Selection**: `findSpawn()` evaluates path slopes and clearances to pick a scenic, obstacle-free starting point.
3. **Character Root Grounding**: Sets `mesh.position.y = fields.heightAt(position.x, position.z)`.
4. **Per-Foot Grounding Targets**: Samples ground height and normal under left and right foot targets during locomotion.
5. **Traversal Constraints**: `resolveMovement()` queries terrain slope, rejecting movement onto slopes exceeding $0.5$ rise/run.
6. **Live Telemetry & HUD**: Displays current coordinates, elevation, slope degrees, and biome status in real time.

---

## 7. Ecology from World Fields

Vegetation is not uniformly scattered decorative noise. It responds organically to environmental field conditions.

In `generateWorld()` (`src/world/index.js`):
1. **Tree Candidate Budget**: Evaluates candidate locations based on `treeDensity`.
2. **Boundary Margin**: Enforces a 3-meter inset from outer terrain edges (`worldSize - 6`).
3. **Origin Clearing**: Keeps a 3-meter radius around $(0, 0)$ clear of trees.
4. **Slope Rejection**: Any candidate with `slope > maxTreeSlope` ($0.32$) is rejected.
5. **Forest Weight Acceptance**: Candidates are accepted with probability proportional to `s.forestWeight * 0.65`.
6. **Separation Grid**: Before finalizing a tree, `volumes.overlaps()` checks an exclusion radius ($2.4 \times \text{scale}$) against existing trees.
7. **Ground Cover Tufts**: Tufts populate open clearings, thinning out under dense forest weight (`s.forestWeight * 0.6`), and reject steep slopes or overlaps with solid trunks.

---

## 8. Vegetation Grounding & The Buried Trunk Contract

Trees growing on hillsides present a visual artifact if modeled as flat-bottomed cylinders: the uphill side penetrates the ground while the downhill side hovers in mid-air.

Proof C solves this cleanly in `src/world/index.js`:

```javascript
// Excerpt from src/world/index.js (generateWorld)
// Extend the upright trunk below its sloped footprint instead of leaving a gap.
const baseHeights = Array.from({ length: 9 }, (_, side) => {
  const angle = side * Math.PI * 2 / 9 + rotation;
  return fields.heightAt(x + Math.sin(angle) * radius, z + Math.cos(angle) * radius);
});
const baseDepth = Math.max(0.01, s.height - Math.min(...baseHeights) + 0.01);
const tree = Object.freeze({ id: `tree-${i}`, x, y: s.height, z, scale,
  rotation, radius, baseDepth, trunkHeight: 4.8 * scale,
  forestWeight: s.forestWeight, slope: s.slope });
```

The generator samples the field at 9 radial points around the trunk circumference. It computes `baseDepth` to extend the trunk down past the lowest ground point plus $1\text{cm}$ extra margin. When rendered, the trunk base is firmly anchored in the hillside with zero floating edges.

---

## 9. One Placement Record, Multiple Consumers

A critical architectural discipline in Proof C is:

> **THE TREE PLACEMENT RECORD IS SHARED BETWEEN VISUAL RENDERING AND COLLISION QUERIES.**

```text
Tree Placement Record { id, x, y, z, scale, rotation, radius, baseDepth, trunkHeight }
       │
       ├─► InstancedMesh (Trunk rendering: radius, trunkHeight + baseDepth)
       │
       └─► WorldVolumeQuery (Collision: cylinder radius, minY: y - baseDepth, maxY: y + trunkHeight)
```

There is no separate "collision mesh" or secondary proxy authored by hand. When `volumes.add(tree)` registers an obstacle, it indexes the exact same object passed to the instanced renderer.

---

## 10. World Volume Query: Spatial Obstacle Indexing

In `src/world/volumes.js`, `createWorldVolumeQuery(half)` implements a bounded spatial hash grid with 8-meter cells:

```javascript
// Excerpt from src/world/volumes.js
export function createWorldVolumeQuery(half) {
  const records = [], grid = new Map(), cellSize = 8;
  const key = (x, z) => `${x},${z}`;

  function add(record) {
    validate([record.x, record.y, record.z, record.radius, record.trunkHeight], [record.radius, record.trunkHeight]);
    records.push(record);
    for (const k of cells(record.x, record.z, record.radius)) {
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(record);
    }
  }

  function overlaps({ x, z, radius, minY, maxY }) {
    validate([x, z, radius, minY, maxY], [radius, maxY - minY]);
    const candidates = new Set(cells(x, z, radius).flatMap(k => grid.get(k) || []));
    return [...candidates].filter(r => minY < r.y + r.trunkHeight && maxY > r.y - (r.baseDepth || 0)
      && Math.hypot(x - r.x, z - r.z) < radius + r.radius - 1e-8);
  }

  // resolveMovement() ...
  return { records, add, overlaps, resolveMovement };
}
```

### Movement Resolution and Anti-Tunneling
`resolveMovement(from, to, radius, height, fields)` resolves character translation:
- **Subdivided Stepping**: Movement increments are capped at $\min(\text{radius} \times 0.5, 0.1\text{m})$. Even large variable frame spikes cannot tunnel through tree trunks.
- **Sliding Math**: If diagonal movement is blocked, it tests X-only and Z-only translation, allowing characters to slide smoothly along tree bark and boundaries.
- **Slope & Boundary Gating**: Evaluates `s.slope <= 0.5` and clamps within world extents `Math.abs(cx) <= half - radius`.
- **Validation**: Throws structured `RangeError` with code `WORLD_INVALID_VOLUME_QUERY` if non-finite coordinates or non-positive extents are supplied.

---

## 11. Multiple Volume Query Consumers

`WorldVolumeQuery` serves five production consumers:
1. **Tree Placement Separation**: Prevents overlapping tree trunks during generation.
2. **Ground Cover Rejection**: Prevents grass blades from generating inside solid trunks.
3. **Character Traversal Collision**: Stops the player from penetrating tree trunks.
4. **Spawn Corridor Clearance**: `findSpawn()` verifies a 5-meter clear approach path to an observation tree.
5. **Spectator Camera Boom Check**: Verifies sightlines between camera and player.

---

## 12. Character Traversal Loop

In `src/games/world/traversal.js`, `WorldTraversal` executes on fixed simulation steps:

```javascript
// Excerpt from src/games/world/traversal.js
update(dt) {
  if (this.disposed) throw new Error('World traversal disposed');
  const input = this.input.captureSnapshot();
  if (input.isActionActive('Reset')) { this.reset(); return; }

  let x = Number(input.isActionActive('Right')) - Number(input.isActionActive('Left'));
  let z = Number(input.isActionActive('Backward')) - Number(input.isActionActive('Forward'));
  const length = Math.hypot(x, z);
  if (length) { x /= length; z /= length; this.rotation = Math.atan2(x, z); }

  const p = this.transform.position, speed = this.motion.getSpeed();
  const next = this.world.volumes.resolveMovement(p, { x: p.x + x * speed * dt, z: p.z + z * speed * dt }, this.radius, 1.8, this.world.fields);
  const distance = Math.hypot(next.x - p.x, next.z - p.z);
  this.walking = distance > 1e-7;
  if (next.blocked) this.blockedSteps++;

  // Single-writer transform commit
  this.transforms.setIntent(this.handle, { x: (next.x - p.x) / dt, y: (next.y - p.y) / dt, z: (next.z - p.z) / dt });
  this.transforms.commitAll(dt);

  // Gait phase advances strictly with actual resolved travel distance
  this.poseAt(this.transform.position, distance / speed);
}
```

Single-writer transform authority is strictly maintained: `this.transforms.setIntent()` and `commitAll()` own world coordinates. Motion Forge only evaluates bone poses.

---

## 13. Non-Flat Realized Grounding

Proof B1 proved contact grounding on flat ground. Proof C tackles **non-flat terrain grounding**:

```javascript
// Excerpt from src/games/world/traversal.js
poseAt(position, gaitDt = 0) {
  const mesh = this.character.mesh;
  mesh.position.set(position.x, this.world.fields.heightAt(position.x, position.z), position.z);
  mesh.rotation.y = this.rotation;
  mesh.updateMatrixWorld(true);

  const c = Math.cos(this.rotation), s = Math.sin(this.rotation);
  this.pose = this.motion.update(gaitDt, {
    standing: gaitDt === 0 && !this.walking,
    groundAt: (x, z) => {
      const field = this.world.fields.sample(position.x + c * x + s * z, position.z - s * x + c * z);
      if (!field) throw new Error('Foot target outside bounded terrain');
      return {
        height: field.height - mesh.position.y,
        normal: { x: c * field.normal.x - s * field.normal.z, y: field.normal.y, z: s * field.normal.x + c * field.normal.z }
      };
    }
  });
  mesh.updateMatrixWorld(true);
}
```

### Analytic Targets vs. Realized Sole Vertices
Proof C explicitly distinguishes between analytic IK targets and actual realized foot soles:
- **Analytic Target**: The $(X, Y, Z)$ coordinate requested by the kinematic solver.
- **Realized Sole Geometry**: `soleGrounding()` measures the actual deformed vertex positions of the foot sole (`REGIONS.FOOT_L`, `REGIONS.FOOT_R` vertices with $Y \le 0.001\text{m}$) after skeletal skinning matrices are applied:

```javascript
// Excerpt from src/games/world/traversal.js
soleGrounding() {
  const mesh = this.character.mesh, position = mesh.geometry.attributes.position;
  mesh.updateMatrixWorld(true); mesh.skeleton.update();
  return this.soleIndices.map((indices, foot) => {
    let min = Infinity, max = -Infinity;
    for (const index of indices) {
      const p = new Vector3().fromBufferAttribute(position, index);
      mesh.applyBoneTransform(index, p); mesh.localToWorld(p);
      const height = this.world.fields.heightAt(p.x, p.z);
      if (height === null) return { min: -Infinity, max: Infinity, samples: indices.length };
      min = Math.min(min, p.y - height); max = Math.max(max, p.y - height);
    }
    return { min, max, samples: indices.length, inContact: this.pose.contactStates[foot === 0 ? 'left' : 'right'] };
  });
}
```

Validation invariants:
- Sole penetration into terrain: $\le 10\text{mm}$ ($0.01\text{m}$).
- Stance clearance above terrain: $\le 25\text{mm}$ ($0.025\text{m}$).

---

## 14. Blocked / Idle Standing

In naive locomotion implementations, if a character runs into an obstacle, the root stops translating while the walk cycle continues, leaving the character moonwalking into a tree. If movement keys are released, the character freezes with one foot awkwardly floating in mid-air.

Proof C solves this through two contracts:
1. **Travel-Proportional Gait Advancement**: `this.poseAt(..., distance / speed)`. Gait phase advances by actual resolved displacement. If blocked against a tree ($\text{distance} = 0$), the walk cycle stops immediately.
2. **Terrain-Aware Settle**: When `gaitDt === 0 && !this.walking`, `standing: true` is passed to the motion evaluator. Both feet settle firmly under their respective hips on the terrain, maintaining natural stance posture without requiring a complex animation graph.

---

## 15. Bounded World Contract & The 0.55m Inset

Proof C represents a finite, bounded world of size $W \times W$ (default $128\text{m} \times 128\text{m}$), centered at $(0, 0)$.

In `WorldTraversal`:
```javascript
// Enclose the realized natural-gait sole footprint, including the forward toe.
this.radius = 0.55;
```

Why $0.55\text{m}$?
A character's root is at the pelvis. During natural locomotion stride, the forward toe extends $\sim 0.45\text{m}$ ahead of the root. A smaller mover radius (e.g. $0.3\text{m}$) would allow the root to reach the boundary while the swing toe clipped outside the world into undefined void.

At $0.55\text{m}$, the entire sole footprint stays strictly inside the terrain boundary at all times. Automated tests confirm that when walking directly into any of the four perimeter boundaries or corners, realized sole vertices never leave the world.

---

## 16. Deterministic World Hashes

To ensure exact reproducibility across evaluation runs, `generateWorld()` computes four independent checksums via `worldDataHash`:

```javascript
// Excerpt from src/world/index.js
const hashes = {
  fields: cache.hash,
  terrain: worldDataHash({ positions: terrain.attributes.position.array, indices: terrain.index.array }),
  placements: worldDataHash({ trees, cover }),
  volumes: worldDataHash(volumes.records)
};
```

What is hashed:
- Float32 elevation, moisture, and forest values.
- Vertex position and index arrays of visual terrain.
- Placements list with frozen numeric properties.
- Spatial volume records.

What is excluded:
- Three.js internal object UUIDs, pointers, and GPU handles.
- Non-deterministic performance timestamps or DOM references.

Two generations with seed `87122` produce identical hashes. Changing the seed alters all four hashes.

---

## 17. Material Forge Reuse

Proof C builds directly on the material compiler established in Proof B2:
- `world-terrain`: PBR `MeshStandardMaterial` compiled with `vertexColors: true`, blending linear-space earth (`#334a13`) and grass tones.
- `world-bark`: Warm wood bark (`#63503b`, roughness $1.0$).
- `world-canopy` & `world-canopy-light`: Two-tone coniferous foliage (`#496443` and `#668257`).
- `world-ground-cover`: Meadow grass blades (`#85934f`).
- `world-player`: Athletic clay (`#e6a34c`).

Beyond the bounded, opt-in `vertexColors` resolved parameter added for Proof C terrain vertex-color blending (documented in `MATERIAL_FORGE.md` §6), no new shader libraries or pipeline machinery were introduced.

---

## 18. Live Presentation: Spectator Boom

Navigating `http://localhost:5173/?proof=c` loads the full-screen interactive world:
- Responsive rendering: automatically adapts to viewport size with DPR capped at $2.0$.
- Spectator Boom Camera: smoothly trails the character from behind and above.
- Keyboard & Gamepad Support: WASD, arrow keys, or gamepad analog stick / D-pad.
- In-Game Menu: `<details class="c-menu">` allows entering any unsigned 32-bit seed and clicking **Generate world** to rebuild the landscape on the fly.
- Fixed Spectator Perspective: Proof C does not implement free orbit/pan/fly camera controls; camera movement is strictly automatic and spectator-oriented.

---

## 19. Presentation vs. World Truth: Canopy Cutaway

Dense conifer branches can block the player from view. In `src/games/world/renderer.js`, a dynamic cutaway policy prevents sightline obstruction:

```javascript
// Excerpt from src/games/world/renderer.js
function cutaway() {
  const p = game.character.mesh.position, dx = camera.position.x - p.x, dz = camera.position.z - p.z;
  const length2 = dx * dx + dz * dz;
  presentation.cutawayCount = 0;
  game.world.trees.forEach((r, i) => {
    const t = Math.max(0, Math.min(1, ((r.x - p.x) * dx + (r.z - p.z) * dz) / Math.max(0.001, length2)));
    const distance = Math.hypot(r.x - p.x - t * dx, r.z - p.z - t * dz);
    const rayY = p.y + 1 + t * (camera.position.y - p.y - 1);
    const hide = distance < 2.1 * r.scale + 0.8 && rayY < r.y + 8.2 * r.scale + 1;
    if (hide) presentation.cutawayCount++;
    if (hidden[i] !== hide) {
      hidden[i] = hide;
      canopies.forEach((mesh, layer) => { mesh.setMatrixAt(i, hide ? collapsed : originalMatrices[layer][i]); mesh.instanceMatrix.needsUpdate = true; });
    }
  });
}
```

How it works:
- Computes the distance from each tree axis to the camera-player sightline ray segment.
- If an occluding canopy is within the sightline cylinder, its instanced matrix is collapsed to zero scale (`makeScale(0, 0, 0)`).
- **Trunks Remain Solid and Visible**: Trunks are never hidden. Their collision records remain active in `WorldVolumeQuery`.
- **Zero Mutation of World Truth**: Canopy collapse is purely a renderer presentation effect. `WorldRecipe`, field caches, and volume records remain completely untouched.

---

## 20. Overhead Camera Fallback

If the spectator camera boom encounters a solid tree trunk, pulling back or clipping through the wood would destroy immersion.

In `src/games/world/renderer.js`, `blockedBoom(from, to)` tests the sightline against `world.volumes`:

```javascript
// Excerpt from src/games/world/renderer.js
function blockedBoom(from, to) {
  const steps = Math.ceil(from.distanceTo(to) / 0.25), point = new Vector3();
  for (let i = 1; i <= steps; i++) {
    point.lerpVectors(from, to, i / steps);
    if (game.world.volumes.overlaps({ x: point.x, z: point.z, radius: 0.18,
      minY: point.y - 0.18, maxY: point.y + 0.18 }).length) return true;
  }
  return false;
}
```

If a trunk obstructs the normal boom, the camera switches to the character's collision-free overhead column (`desired = new Vector3(p.x, p.y + 12, p.z + 0.1)`), looking down from above. Once the obstacle clears, it smoothly returns to the normal trailing boom.

---

## 21. Live vs. Controlled World Proof

Proof C provides two entry modes:

```text
URL: /?proof=c                        URL: /?proof=c&controlled=1
┌───────────────────────────────┐      ┌───────────────────────────────┐
│ LIVE PRESENTATION             │      │ CONTROLLED FIXTURE            │
│ • Full-screen viewport        │      │ • Fixed 1280x720 canvas       │
│ • Interactive controls        │      │ • Fixed seed 87122            │
│ • Spectator boom camera       │      │ • Fixed camera framing        │
│ • In-game seed regeneration   │      │ • Automated action simulation │
│ • Continuous animation loop   │      │ • Step-driven test runner     │
│ • Dynamic canopy cutaways     │      │ • Deterministic PNG capture   │
└───────────────────────────────┘      └───────────────────────────────┘
```

The evaluation harness uses controlled mode to run a deterministic script:
1. Initialize world with seed `87122`.
2. Teleport to known spawn with clear approach to a real tree.
3. Simulate `Forward` for 340 ticks at 60 Hz $\to$ approach tree until blocked by trunk collision.
4. Verify collision block ($> 20$ blocked ticks, zero volume overlaps, trunk distance within clearance margin).
5. Simulate `Right` 180 ticks, then `Forward` 720 ticks $\to$ navigate around obstacle and traverse across terrain.
6. Verify non-flat elevation delta ($> 0.05\text{m}$), sole grounding errors ($\le 10\text{mm}$ penetration), and boundary safety.
7. Capture deterministic screenshot: `artifacts/captures/proof_c_world_fixture.png`.

---

## 22. Evaluator Integrity & Fail-Closed Validation

In `src/eval/harness.js`, the evaluation harness expands to five targets:
1. `phase0_boot_fixture`
2. `proof_a_pong_fixture`
3. `proof_b1_motion_fixture`
4. `proof_b2_combat_fixture`
5. `proof_c_world_fixture`

The Proof C evaluator verifies eleven distinct truth gates:
- `cBoot`: World canvas boots without console or page errors.
- `cWorldGeneration`: Terrain vertices $> 4,000$ and tree count $> 0$.
- `cFieldDeterminism`: Hashes match identical seeds and differ on new seeds.
- `cTerrainQueryTruth`: Raycasted mesh hits agree with `fields.heightAt()` within $10^{-5}\text{m}$.
- `cVegetationPlacement`: All vegetation rests flush on sampled heights and valid slopes.
- `cVegetationRendering`: Realized instanced trunk transforms match placement records.
- `cWorldVolumeQuery`: Trunk records correctly indexed in spatial grid.
- `cCharacterGrounding`: Root error $< 10^{-6}\text{m}$, ankle error $< 25\text{mm}$, sole penetration $\le 10\text{mm}$.
- `cTraversal`: Character covers $> 9\text{m}$ distance over non-flat elevation range.
- `cCollision`: Character collides with real generated tree trunk without overlapping.
- `cPageProofSuccess`: The in-page proof explicitly reports `success: true`.

> **FAIL-CLOSED PRINCIPLE**: If any single check fails or the in-page proof fails, the evaluation harness returns `status: "FAIL"`.

---

## 23. Resource Ownership & Lifecycle Management

Proof C enforces explicit resource ownership boundaries:

- **`World`**: Owns `terrain` geometry. `world.dispose()` disposes the terrain BufferGeometry. Typed arrays and placement records are released for garbage collection.
- **`WorldTraversal`**: Owns character geometry, player material, skeleton, and handles. `traversal.dispose()` disposes character assets, clears transforms, despawns the handle, and disposes its world.
- **`WorldRenderer`**: Owns compiled materials, vegetation geometries, instanced meshes, and the WebGL renderer. `renderer.dispose()` disposes all geometries, materials, shadow maps, and removes the canvas DOM element.
- **`Viewer`**: Owns animation frame requests, event listeners, and `ResizeObserver`. `viewer.dispose()` disconnects observers, removes listeners, and disposes renderer and game.

When the user regenerates a world via the UI, the previous viewer is completely disposed before the new world is instantiated.

---

## 24. Lazy World Route & Runtime Purity

World Forge is an expansive subsystem, but tiny games (Proof A Pong, Phase 0 Boot) must not pay a bandwidth or startup tax for world generators they do not use.

In `src/browser/main.js`:

```javascript
// Excerpt from src/browser/main.js
if (params.get('proof') === 'c') {
  const { createCViewer } = await import('./c-viewer.js');
  createCViewer(app, { controlled: isControlled, seed: params.has('seed') ? Number(params.get('seed')) : undefined });
} else if (isB2Mode) {
  // ...
}
```

By dynamically importing `./c-viewer.js`, Vite bundles World Forge into a separate lazy chunk (`dist/assets/world-*.js` and `dist/assets/c-viewer-*.js`). Unit tests in `tests/world-browser.test.js` verify that loading the Pong route does not fetch or execute world generation code.

---

## 25. Accepted Proof C Evidence

At frozen baseline SHA `e8fa4f698be684599f3839fec46ac3456b448698`:

- **Node Version**: Pinned consistently to `24.20.0`.
- **Unit Test Suite**: 147/147 tests PASS across 11 test suites.
- **Evaluation Harness**: 5/5 targets PASS, 34/34 truth checks passing.
- **Deterministic Captures (SHA-256)**:
  - `phase0_boot_fixture`: `8c653d67a60964927145417146fb59d71d9fbb928da730304aee96539d0c7001`
  - `proof_a_pong_fixture`: `897629089a8f187a11f2a2c375247d8ab4c2ab1a31819864ce940e94ddf3eb56`
  - `proof_b1_motion_fixture`: `2077e153e976119d27ad3e7f3f93d353078cc164c8f86e43b363c94a8c47baba`
  - `proof_b2_combat_fixture`: `428ce84e9cdafdc7d2b93f0b3ab03a9d1a96e091967ddf81e19f7fb9677ec2f7`
  - `proof_c_world_fixture`: `16062a2bd13bc616727ed0a39c9a7d93e9b97e3bed81edf572707d3cac433146`
- **Vite Production Build**: 63 modules transformed, bundle builds in $< 200\text{ms}$.
- **Security Audit**: 0 vulnerabilities found via `npm audit`.

---

## 26. What Proof C Does Not Implement

Proof C is an architectural milestone, not a completed open-world game. It explicitly does **not** implement:

- Infinite world streaming or chunk paging
- Origin rebasing for planetary coordinates
- Navmesh generation or pathfinding graphs
- Rigid-body physics engines (Rapier, PhysX)
- Voxel or terrain deformation/destruction
- Caves, tunnels, or overhangs
- Water, river, or ocean simulation
- Dynamic ecosystem growth or weather simulation
- Day/night lighting cycles
- Visual world or biome editors
- Studio integration
- User-controlled orbit, pan, or free-flight camera controls
- Multiplayer or network state replication

Proof C is precisely what it claims to be: **a deterministic, bounded procedural world and traversal proof demonstrating that heightfields, ecology, collision, and non-flat character grounding share a single unbroken source of truth.**
