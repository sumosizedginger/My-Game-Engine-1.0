/**
 * My Game Engine 1.0 — Material Forge: Standard Palettes & Presets
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Deterministic material palettes for architectural surfaces, character clay,
 * and combat state indicators.
 * Follows ARCHITECTURE.md §24 and MATERIAL_FORGE.md.
 */

import { createMaterialDefinition } from './definition.js';

export const MATERIAL_PRESETS = Object.freeze({
  arenaFloor: createMaterialDefinition({
    id: 'mat_arena_floor',
    name: 'Arena Floor Slab',
    color: 0x1e2430,
    roughness: 0.82,
    metalness: 0.12,
    emissive: 0x000000
  }),
  arenaWall: createMaterialDefinition({
    id: 'mat_arena_wall',
    name: 'Arena Perimeter Wall',
    color: 0x141820,
    roughness: 0.90,
    metalness: 0.05,
    emissive: 0x000000
  }),
  arenaPillar: createMaterialDefinition({
    id: 'mat_arena_pillar',
    name: 'Arena Stone Column',
    color: 0x283242,
    roughness: 0.72,
    metalness: 0.18,
    emissive: 0x000000
  }),
  playerClay: createMaterialDefinition({
    id: 'mat_player_clay',
    name: 'Player Athletic Steel-Blue',
    color: 0x3b82f6,
    roughness: 0.50,
    metalness: 0.15,
    emissive: 0x0b1e38,
    emissiveIntensity: 0.4
  }),
  enemyClay: createMaterialDefinition({
    id: 'mat_enemy_clay',
    name: 'Enemy Heavy Crimson',
    color: 0xdc2626,
    roughness: 0.58,
    metalness: 0.10,
    emissive: 0x3b0a0a,
    emissiveIntensity: 0.4
  }),
  hitFlash: createMaterialDefinition({
    id: 'mat_hit_flash',
    name: 'Damage Recoil Flash',
    color: 0xffffff,
    roughness: 0.20,
    metalness: 0.00,
    emissive: 0xff3b30,
    emissiveIntensity: 2.5
  }),
  attackVolume: createMaterialDefinition({
    id: 'mat_attack_volume',
    name: 'Authoritative Attack Volume Indicator',
    color: 0xf59e0b,
    roughness: 1.0,
    metalness: 0.0,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.5,
    wireframe: true
  })
});
