# MATERIAL_FORGE.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **Proof B2 — Procedural Combat Room**

This document defines the durable procedural material architecture of My Game Engine 1.0. It documents the contracts, data structures, and compiler seams established and evidenced by Proof B2.

---

## 1. Core Architectural Laws

1. **Code-Native Definitions**: Material specifications are declarative, serializable objects with deterministic parameters. External texture downloads or third-party shader node graphs are not foundational requirements.
2. **Compiler Seam Separation**: `MaterialDefinition` is persistent source truth; Three.js `MeshStandardMaterial` is a transient compiled runtime artifact. Three.js classes never serve as the persistent project representation.
3. **Strict Parameter Bounding**: Physical parameters (roughness, metalness, emissive intensity) are clamped to valid physical bounds, logging structured `WARN` diagnostics when inputs exceed schema limits.
4. **Color Normalization**: Colors normalize deterministically into canonical 24-bit integer values (`0x000000` to `0xffffff`), supporting hex numbers, 3-digit hex strings (`#rgb`), and 6-digit hex strings (`#rrggbb`).
5. **Runtime Provenance**: Compiled Three.js materials preserve origin attribution by storing `definitionId`, `definitionType`, and input parameter records in `material.userData`.
6. **Package Purity**: Material Forge lives in `src/material/` and is not prematurely exported through `engine/runtime` or `engine/full`.

---

## 2. Parameter Domain & Schema

Material parameters are validated against the `MATERIAL_PARAMETER_BOUNDS` domain.

### 2.1 Bounded Parameter Domain

```text
Parameter           Min       Max       Default    Unit
-----------------------------------------------------------------
roughness           0.0       1.0       0.65       scalar [0=mirror, 1=diffuse]
metalness           0.0       1.0       0.05       scalar [0=dielectric, 1=metallic]
emissiveIntensity   0.0       10.0      1.00       scalar
wireframe           false     true      false      boolean
color               0x000000  0xffffff  0x888888   24-bit RGB integer
emissive            0x000000  0xffffff  0x000000   24-bit RGB integer
```

---

## 3. Curated Palettes & Presets

Proof B2 establishes a curated, harmonious PBR material palette for both the procedural room and dynamic characters:

### 3.1 Arena Environment Materials

- **`arenaFloor`**: Dark slate flagstone (`color: 0x1e2430`, `roughness: 0.82`, `metalness: 0.12`, `emissive: 0x000000`).
- **`arenaWall`**: Deep charcoal perimeter wall (`color: 0x141820`, `roughness: 0.90`, `metalness: 0.05`, `emissive: 0x000000`).
- **`arenaPillar`**: Weathered basalt column (`color: 0x283242`, `roughness: 0.72`, `metalness: 0.18`, `emissive: 0x000000`).

### 3.2 Dynamic Character Materials

- **`playerClay`**: Athletic vibrant cobalt clay (`color: 0x3b82f6`, `roughness: 0.50`, `metalness: 0.15`, `emissive: 0x0b1e38`, `emissiveIntensity: 0.4`).
- **`enemyClay`**: Heavy brute crimson clay (`color: 0xdc2626`, `roughness: 0.58`, `metalness: 0.10`, `emissive: 0x3b0a0a`, `emissiveIntensity: 0.4`).

### 3.3 Visual Diagnostic Materials

- **`hitFlash`**: High-intensity impact flash (`color: 0xffffff`, `roughness: 0.20`, `metalness: 0.00`, `emissive: 0xff3b30`, `emissiveIntensity: 2.5`).
- **`attackVolume`**: Translucent debug attack volume indicator (`color: 0xf59e0b`, `roughness: 1.0`, `metalness: 0.0`, `emissive: 0xf59e0b`, `emissiveIntensity: 1.5`, `wireframe: true`).

---

## 4. Compiler Seam Architecture

```text
   ┌───────────────────────┐
   │  MaterialDefinition   │  (Pure JSON-serializable definition)
   └───────────┬───────────┘
               │
               ▼
     ┌───────────────────┐
     │  compileMaterial  │  (Three.js Compiler Seam)
     └─────────┬─────────┘
               │
               ▼
┌──────────────────────────────┐
│  MeshStandardMaterial (3D)   │
├──────────────────────────────┤
│ • color = new Color(...)     │
│ • roughness = 0.55           │
│ • metalness = 0.05           │
│ • userData.definitionId      │
│ • userData.parameters        │
└──────────────────────────────┘
```

The compiler guarantees:
- Pure functional transformation from input definition to runtime material.
- Complete decoupling of gameplay simulation from WebGL rendering.
- Deterministic repeatability: compiling the same definition multiple times produces identical material properties.

---

## 5. Verification & Acceptance Criteria

Every compliant Material Forge implementation must demonstrate:

1. **Parameter Clamping**: Values exceeding `[0.0, 1.0]` for roughness or metalness are clamped and log `MAT_PARAM_CLAMPED_*` warnings.
2. **Color Normalization**: Integer hex, 3-char hex strings, and 6-char hex strings normalize into matching RGB integer values.
3. **Compiler Determinism**: `compileMaterial` creates valid Three.js `MeshStandardMaterial` instances with correct properties and `userData` provenance.
4. **Unit Tests**: Full coverage in `tests/material.test.js`.
