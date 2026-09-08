/**
 * Order Five — source definitions for a bounded 3D collection puzzle.
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Definitions compile through the public Kiln seam (compileDefinition).
 */

export const ARENA_DEFINITION = Object.freeze({
  id: 'def_order_five_arena',
  type: 'arena',
  data: Object.freeze({
    halfWidth: 8,
    halfDepth: 8,
    minX: -8,
    maxX: 8,
    minZ: -8,
    maxZ: 8,
    wallHeight: 1.4,
    wallThickness: 0.4,
    floorY: 0
  })
});

export const PLAYER_DEFINITION = Object.freeze({
  id: 'def_order_five_player',
  type: 'prefab',
  data: Object.freeze({
    role: 'player',
    radius: 0.45,
    height: 0.9,
    speed: 7,
    initialX: 0,
    initialY: 0.45,
    initialZ: 0,
    color: '#38bdf8'
  })
});

export const COLLECTIBLE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'def_order_five_relic_1',
    type: 'prefab',
    data: Object.freeze({
      role: 'collectible',
      order: 1,
      radius: 0.35,
      initialX: -6,
      initialY: 0.4,
      initialZ: -6,
      color: '#fbbf24'
    })
  }),
  Object.freeze({
    id: 'def_order_five_relic_2',
    type: 'prefab',
    data: Object.freeze({
      role: 'collectible',
      order: 2,
      radius: 0.35,
      initialX: 6,
      initialY: 0.4,
      initialZ: -6,
      color: '#f59e0b'
    })
  }),
  Object.freeze({
    id: 'def_order_five_relic_3',
    type: 'prefab',
    data: Object.freeze({
      role: 'collectible',
      order: 3,
      radius: 0.35,
      initialX: 6,
      initialY: 0.4,
      initialZ: 6,
      color: '#fb923c'
    })
  }),
  Object.freeze({
    id: 'def_order_five_relic_4',
    type: 'prefab',
    data: Object.freeze({
      role: 'collectible',
      order: 4,
      radius: 0.35,
      initialX: -6,
      initialY: 0.4,
      initialZ: 6,
      color: '#f97316'
    })
  }),
  Object.freeze({
    id: 'def_order_five_relic_5',
    type: 'prefab',
    data: Object.freeze({
      role: 'collectible',
      order: 5,
      radius: 0.35,
      initialX: 0,
      initialY: 0.4,
      initialZ: -6.5,
      color: '#facc15'
    })
  })
]);

export const HAZARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'def_order_five_hazard_a',
    type: 'prefab',
    data: Object.freeze({
      role: 'hazard',
      name: 'hazardA',
      radius: 0.55,
      homeX: 0,
      homeY: 0.45,
      homeZ: 3,
      ampX: 5,
      ampZ: 0,
      omega: 0.05,
      color: '#ef4444'
    })
  }),
  Object.freeze({
    id: 'def_order_five_hazard_b',
    type: 'prefab',
    data: Object.freeze({
      role: 'hazard',
      name: 'hazardB',
      radius: 0.55,
      homeX: -4,
      homeY: 0.45,
      homeZ: 0,
      ampX: 0,
      ampZ: 5,
      omega: 0.037,
      color: '#dc2626'
    })
  })
]);

export const EXIT_DEFINITION = Object.freeze({
  id: 'def_order_five_exit',
  type: 'prefab',
  data: Object.freeze({
    role: 'exit',
    halfWidth: 1.2,
    halfDepth: 0.7,
    initialX: 0,
    initialY: 0.55,
    initialZ: 7.1,
    inactiveColor: '#334155',
    activeColor: '#4ade80'
  })
});

export const MATCH_DEFINITION = Object.freeze({
  id: 'def_order_five_match',
  type: 'rules',
  data: Object.freeze({
    collectibleCount: 5,
    requiredOrder: Object.freeze([1, 2, 3, 4, 5])
  })
});
