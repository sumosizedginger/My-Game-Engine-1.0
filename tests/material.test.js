/**
 * My Game Engine 1.0 — Material Forge Unit Tests
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial } from 'three';

import {
  createMaterialDefinition,
  compileMaterial,
  MATERIAL_PRESETS
} from '../src/material/index.js';

test('Material Forge — Definition & Parameters', async (t) => {
  await t.test('creates valid MaterialDefinition with default parameters', () => {
    const mat = createMaterialDefinition({ id: 'custom_clay', parameters: { color: 0x4a90e2, roughness: 0.5 } });

    assert.equal(mat.type, 'material');
    assert.equal(mat.id, 'custom_clay');
    assert.equal(mat.data.parameters.color, 0x4a90e2);
    assert.equal(mat.data.parameters.roughness, 0.5);
    assert.equal(mat.data.parameters.metalness, 0.05);
    assert.equal(mat.diagnostics.length, 0);
  });

  await t.test('clamps roughness and metalness to [0.0, 1.0] and records warnings', () => {
    const mat = createMaterialDefinition({
      parameters: {
        roughness: 2.5,  // Exceeds 1.0
        metalness: -0.5  // Below 0.0
      }
    });

    assert.equal(mat.data.parameters.roughness, 1.0);
    assert.equal(mat.data.parameters.metalness, 0.0);
    assert.ok(mat.diagnostics.length >= 2);
    assert.ok(mat.diagnostics.some((d) => d.code === 'MAT_PARAM_CLAMPED_MAX'));
    assert.ok(mat.diagnostics.some((d) => d.code === 'MAT_PARAM_CLAMPED_MIN'));
  });

  await t.test('normalizes diverse color inputs reliably to integer hex values', () => {
    const hexNumMat = createMaterialDefinition({ parameters: { color: 0xff0000 } });
    assert.equal(hexNumMat.data.parameters.color, 0xff0000);

    const shortHexMat = createMaterialDefinition({ parameters: { color: '#0f0' } });
    assert.equal(shortHexMat.data.parameters.color, 0x00ff00);

    const longHexMat = createMaterialDefinition({ parameters: { color: '#4a90e2' } });
    assert.equal(longHexMat.data.parameters.color, 0x4a90e2);

    const invalidMat = createMaterialDefinition({ parameters: { color: 'not_a_color' } });
    assert.equal(invalidMat.data.parameters.color, 0x888888);
    assert.ok(invalidMat.diagnostics.some((d) => d.code === 'MAT_INVALID_COLOR'));
  });

  await t.test('verifies all standard MATERIAL_PRESETS', () => {
    const presetKeys = ['arenaFloor', 'arenaWall', 'arenaPillar', 'playerClay', 'enemyClay', 'hitFlash', 'attackVolume'];
    for (const key of presetKeys) {
      const preset = MATERIAL_PRESETS[key];
      assert.ok(preset, `preset ${key} exists`);
      assert.equal(preset.type, 'material');
      assert.ok(typeof preset.data.parameters.color === 'number');
      assert.ok(preset.data.parameters.roughness >= 0 && preset.data.parameters.roughness <= 1);
      assert.ok(preset.data.parameters.metalness >= 0 && preset.data.parameters.metalness <= 1);
    }
  });
});

test('Material Forge — Three.js Compiler Seam', async (t) => {
  await t.test('compiles MaterialDefinition into Three.js MeshStandardMaterial preserving values', () => {
    const def = createMaterialDefinition({
      id: 'mat_test_stone',
      parameters: {
        color: 0x8899aa,
        roughness: 0.75,
        metalness: 0.15
      }
    });

    const compiled = compileMaterial(def);

    assert.ok(compiled instanceof MeshStandardMaterial, 'compiled result is a MeshStandardMaterial');
    assert.equal(compiled.roughness, 0.75);
    assert.equal(compiled.metalness, 0.15);
    assert.equal(compiled.name, 'mat_test_stone');
    assert.equal(compiled.userData.definitionId, 'mat_test_stone');
    assert.equal(compiled.userData.definitionType, 'material');
    assert.equal(compiled.userData.parameters.color, 0x8899aa);
  });

  await t.test('compiles preset definitions deterministically', () => {
    const floor1 = compileMaterial(MATERIAL_PRESETS.arenaFloor);
    const floor2 = compileMaterial(MATERIAL_PRESETS.arenaFloor);

    assert.equal(floor1.color.getHexString(), floor2.color.getHexString());
    assert.equal(floor1.roughness, floor2.roughness);
    assert.equal(floor1.metalness, floor2.metalness);
  });
});
