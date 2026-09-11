/**
 * SUBTERRA CELL — Asset Library
 * Forcing consumer for SCENE-COMPOSITION-001.
 *
 * A scene node references geometry through an opaque `asset` KEY. The scene
 * layer never interprets that key, which is what keeps a SceneDefinition
 * renderer-independent and serializable. This module is the other half of that
 * bargain: it resolves keys to MeshIR.
 *
 * Every mesh here is built through the public authoring verbs — no private
 * imports, no external files, no downloaded geometry. The engine constructs
 * this room itself.
 *
 * Geometry is authored in its OWN LOCAL FRAME, centred on the node's origin.
 * Placement is the scene's job, not the mesh's. A wall panel does not know
 * where the wall is.
 */

import {
  createBoxMesh,
  createCylinderMesh,
  mergeMeshIR,
  transformMesh,
  createMaterialDefinition
} from '@sumosizedginger/my-game-engine-1.0/full';

/** Cell dimensions in metres. One source of truth for assets and scene alike. */
export const CELL = Object.freeze({
  width: 6.0,
  height: 3.2,
  length: 9.0,
  wallThickness: 0.25,
  slabThickness: 0.3
});

/** Per-vertex semantic region identity for the cell. */
export const REGION = Object.freeze({
  SHELL: 1,
  ACCESS: 2,
  LIGHTING: 3,
  SERVICES: 4,
  STRUCTURE: 5,
  EQUIPMENT: 6
});

/** Surface classes, for consumers that reason about material response. */
export const SURFACE = Object.freeze({
  CONCRETE: 1,
  STEEL: 2,
  PAINTED: 3,
  EMISSIVE: 4,
  GLASS: 5
});

const rotationY = (radians) => {
  const half = radians / 2;
  return [0, Math.sin(half), 0, Math.cos(half)];
};

const rotationZ = (radians) => {
  const half = radians / 2;
  return [0, 0, Math.sin(half), Math.cos(half)];
};

/**
 * Material families for the cell.
 *
 * Metalness is kept deliberately low. The Preview Lab lights with punctual
 * lights and no environment map, and a high-metalness surface renders near
 * black under those conditions — a finding recorded by the CINDER benchmark.
 *
 * @returns {Array<object>} MaterialDefinitions.
 */
export function createSubterraMaterials() {
  return [
    createMaterialDefinition({
      id: 'subterra.concrete',
      name: 'SUBTERRA cast concrete',
      parameters: { color: 0x6f7276, roughness: 0.92, metalness: 0.02 }
    }),
    createMaterialDefinition({
      id: 'subterra.concreteDark',
      name: 'SUBTERRA shadowed concrete',
      parameters: { color: 0x4a4d52, roughness: 0.95, metalness: 0.02 }
    }),
    createMaterialDefinition({
      id: 'subterra.steel',
      name: 'SUBTERRA structural steel',
      parameters: { color: 0x8c929b, roughness: 0.48, metalness: 0.30 }
    }),
    createMaterialDefinition({
      id: 'subterra.steelDark',
      name: 'SUBTERRA blackened steel',
      parameters: { color: 0x4c5158, roughness: 0.55, metalness: 0.26 }
    }),
    createMaterialDefinition({
      id: 'subterra.hazard',
      name: 'SUBTERRA hazard paint',
      parameters: { color: 0xc8912f, roughness: 0.70, metalness: 0.05 }
    }),
    createMaterialDefinition({
      id: 'subterra.lamp',
      name: 'SUBTERRA service lamp',
      parameters: {
        color: 0xdfe8ff, roughness: 0.30, metalness: 0.0,
        emissive: 0xbfd4ff, emissiveIntensity: 2.2
      }
    }),
    createMaterialDefinition({
      id: 'subterra.screen',
      name: 'SUBTERRA console display',
      parameters: {
        color: 0x14323a, roughness: 0.25, metalness: 0.0,
        emissive: 0x37e0b4, emissiveIntensity: 1.6
      }
    }),
    createMaterialDefinition({
      id: 'subterra.rubber',
      name: 'SUBTERRA conduit sleeve',
      parameters: { color: 0x2b2d31, roughness: 0.88, metalness: 0.03 }
    })
  ];
}

// ---------------------------------------------------------------------------
// Asset builders. Each returns MeshIR centred on its own local origin.
// ---------------------------------------------------------------------------

function floorSlab() {
  const slab = createBoxMesh({
    width: CELL.width, height: CELL.slabThickness, depth: CELL.length,
    semanticName: 'floor.slab', materialId: 'subterra.concrete',
    regionId: REGION.SHELL, surfaceId: SURFACE.CONCRETE
  });
  // Two shallow drainage channels, proud rather than cut: the engine has no
  // boolean operation, so a recess is expressed as flanking raised strips.
  const lip = (side, index) => transformMesh(createBoxMesh({
    width: 0.10, height: 0.05, depth: CELL.length - 0.6,
    semanticName: `floor.channelLip.${index}`, materialId: 'subterra.concreteDark',
    regionId: REGION.SHELL, surfaceId: SURFACE.CONCRETE
  }), { translation: [side * 0.34, CELL.slabThickness / 2 + 0.025, 0] });
  return mergeMeshIR([slab, lip(-1, '00'), lip(1, '01')], { id: 'subterra.floor' });
}

function ceilingPanel() {
  const panel = createBoxMesh({
    width: CELL.width, height: CELL.slabThickness * 0.7, depth: CELL.length,
    semanticName: 'ceiling.panel', materialId: 'subterra.concreteDark',
    regionId: REGION.SHELL, surfaceId: SURFACE.CONCRETE
  });
  const ribs = [];
  for (let i = 0; i < 5; i++) {
    ribs.push(transformMesh(createBoxMesh({
      width: CELL.width - 0.2, height: 0.12, depth: 0.18,
      semanticName: `ceiling.rib.${String(i).padStart(2, '0')}`,
      materialId: 'subterra.steelDark',
      regionId: REGION.STRUCTURE, surfaceId: SURFACE.STEEL
    }), { translation: [0, -CELL.slabThickness * 0.35 - 0.06, -3.2 + i * 1.6] }));
  }
  return mergeMeshIR([panel, ...ribs], { id: 'subterra.ceiling' });
}

function wallPanel() {
  const panel = createBoxMesh({
    width: CELL.wallThickness, height: CELL.height, depth: CELL.length,
    semanticName: 'wall.panel', materialId: 'subterra.concrete',
    regionId: REGION.SHELL, surfaceId: SURFACE.CONCRETE
  });
  // A waist-height rail band reads as constructed rather than extruded.
  const band = transformMesh(createBoxMesh({
    width: 0.06, height: 0.14, depth: CELL.length - 0.4,
    semanticName: 'wall.band', materialId: 'subterra.hazard',
    regionId: REGION.SHELL, surfaceId: SURFACE.PAINTED
  }), { translation: [CELL.wallThickness / 2 + 0.03, -0.35, 0] });
  const studs = [];
  for (let i = 0; i < 4; i++) {
    studs.push(transformMesh(createBoxMesh({
      width: 0.08, height: CELL.height - 0.3, depth: 0.16,
      semanticName: `wall.stud.${String(i).padStart(2, '0')}`,
      materialId: 'subterra.steelDark',
      regionId: REGION.STRUCTURE, surfaceId: SURFACE.STEEL
    }), { translation: [CELL.wallThickness / 2 + 0.04, 0, -3.0 + i * 2.0] }));
  }
  return mergeMeshIR([panel, band, ...studs], { id: 'subterra.wall' });
}

function endWall() {
  const panel = createBoxMesh({
    width: CELL.width, height: CELL.height, depth: CELL.wallThickness,
    semanticName: 'wall.end.panel', materialId: 'subterra.concrete',
    regionId: REGION.SHELL, surfaceId: SURFACE.CONCRETE
  });
  return mergeMeshIR([panel], { id: 'subterra.endWall' });
}

function framePost() {
  const post = createBoxMesh({
    width: 0.16, height: 2.3, depth: 0.3,
    semanticName: 'frame.post', materialId: 'subterra.steel',
    regionId: REGION.ACCESS, surfaceId: SURFACE.STEEL
  });
  const plate = transformMesh(createBoxMesh({
    width: 0.22, height: 0.18, depth: 0.36,
    semanticName: 'frame.post.footPlate', materialId: 'subterra.steelDark',
    regionId: REGION.ACCESS, surfaceId: SURFACE.STEEL
  }), { translation: [0, -1.06, 0] });
  return mergeMeshIR([post, plate], { id: 'subterra.framePost' });
}

function frameHeader() {
  const header = createBoxMesh({
    width: 1.6, height: 0.22, depth: 0.3,
    semanticName: 'frame.header', materialId: 'subterra.steel',
    regionId: REGION.ACCESS, surfaceId: SURFACE.STEEL
  });
  const stripe = transformMesh(createBoxMesh({
    width: 1.4, height: 0.07, depth: 0.05,
    semanticName: 'frame.header.stripe', materialId: 'subterra.hazard',
    regionId: REGION.ACCESS, surfaceId: SURFACE.PAINTED
  }), { translation: [0, 0, 0.17] });
  return mergeMeshIR([header, stripe], { id: 'subterra.frameHeader' });
}

function doorLeaf() {
  const leaf = createBoxMesh({
    width: 1.28, height: 2.05, depth: 0.10,
    semanticName: 'door.leaf', materialId: 'subterra.steelDark',
    regionId: REGION.ACCESS, surfaceId: SURFACE.STEEL
  });
  const ribs = [];
  for (let i = 0; i < 3; i++) {
    ribs.push(transformMesh(createBoxMesh({
      width: 1.1, height: 0.09, depth: 0.05,
      semanticName: `door.rib.${String(i).padStart(2, '0')}`,
      materialId: 'subterra.steel',
      regionId: REGION.ACCESS, surfaceId: SURFACE.STEEL
    }), { translation: [0, -0.55 + i * 0.55, 0.07] }));
  }
  const handle = transformMesh(createCylinderMesh({
    radiusTop: 0.035, radiusBottom: 0.035, height: 0.34, radialSegments: 10,
    semanticName: 'door.handle', materialId: 'subterra.steel',
    regionId: REGION.ACCESS, surfaceId: SURFACE.STEEL
  }), { translation: [0.48, -0.17, 0.09], rotation: rotationZ(0) });
  return mergeMeshIR([leaf, ...ribs, handle], { id: 'subterra.doorLeaf' });
}

function fixtureHousing() {
  const shell = createBoxMesh({
    width: 0.9, height: 0.16, depth: 0.28,
    semanticName: 'fixture.housing', materialId: 'subterra.steelDark',
    regionId: REGION.LIGHTING, surfaceId: SURFACE.STEEL
  });
  const hanger = (side, index) => transformMesh(createCylinderMesh({
    radiusTop: 0.018, radiusBottom: 0.018, height: 0.26, radialSegments: 8,
    semanticName: `fixture.hanger.${index}`, materialId: 'subterra.steel',
    regionId: REGION.LIGHTING, surfaceId: SURFACE.STEEL
  }), { translation: [side * 0.34, 0.08, 0] });
  return mergeMeshIR([shell, hanger(-1, '00'), hanger(1, '01')], { id: 'subterra.fixtureHousing' });
}

function fixtureLamp() {
  const lamp = createBoxMesh({
    width: 0.78, height: 0.05, depth: 0.2,
    semanticName: 'fixture.lamp', materialId: 'subterra.lamp',
    regionId: REGION.LIGHTING, surfaceId: SURFACE.EMISSIVE
  });
  return mergeMeshIR([lamp], { id: 'subterra.fixtureLamp' });
}

function pipeRun() {
  const pipe = transformMesh(createCylinderMesh({
    radiusTop: 0.085, radiusBottom: 0.085, height: 7.6, radialSegments: 14,
    semanticName: 'pipe.run', materialId: 'subterra.steel',
    regionId: REGION.SERVICES, surfaceId: SURFACE.STEEL
  }), { rotation: [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)], translation: [0, 0, 0] });
  const collars = [];
  for (let i = 0; i < 4; i++) {
    collars.push(transformMesh(createCylinderMesh({
      radiusTop: 0.105, radiusBottom: 0.105, height: 0.12, radialSegments: 14,
      semanticName: `pipe.collar.${String(i).padStart(2, '0')}`, materialId: 'subterra.rubber',
      regionId: REGION.SERVICES, surfaceId: SURFACE.STEEL
    }), {
      rotation: [Math.sin(Math.PI / 4), 0, 0, Math.cos(Math.PI / 4)],
      translation: [0, 0, -2.85 + i * 1.9]
    }));
  }
  return mergeMeshIR([pipe, ...collars], { id: 'subterra.pipeRun' });
}

function bracket() {
  const arm = createBoxMesh({
    width: 0.34, height: 0.06, depth: 0.08,
    semanticName: 'bracket.arm', materialId: 'subterra.steelDark',
    regionId: REGION.SERVICES, surfaceId: SURFACE.STEEL
  });
  const foot = transformMesh(createBoxMesh({
    width: 0.07, height: 0.2, depth: 0.12,
    semanticName: 'bracket.foot', materialId: 'subterra.steelDark',
    regionId: REGION.SERVICES, surfaceId: SURFACE.STEEL
  }), { translation: [-0.17, -0.1, 0] });
  return mergeMeshIR([arm, foot], { id: 'subterra.bracket' });
}

function supportColumn() {
  const shaft = createBoxMesh({
    width: 0.36, height: CELL.height - 0.4, depth: 0.36,
    semanticName: 'column.shaft', materialId: 'subterra.concreteDark',
    regionId: REGION.STRUCTURE, surfaceId: SURFACE.CONCRETE
  });
  const cap = transformMesh(createBoxMesh({
    width: 0.52, height: 0.14, depth: 0.52,
    semanticName: 'column.cap', materialId: 'subterra.steelDark',
    regionId: REGION.STRUCTURE, surfaceId: SURFACE.STEEL
  }), { translation: [0, (CELL.height - 0.4) / 2 + 0.07, 0] });
  const base = transformMesh(createBoxMesh({
    width: 0.52, height: 0.14, depth: 0.52,
    semanticName: 'column.base', materialId: 'subterra.steelDark',
    regionId: REGION.STRUCTURE, surfaceId: SURFACE.STEEL
  }), { translation: [0, -(CELL.height - 0.4) / 2 - 0.07, 0] });
  return mergeMeshIR([shaft, cap, base], { id: 'subterra.column' });
}

function consoleBody() {
  const desk = createBoxMesh({
    width: 1.5, height: 0.1, depth: 0.7,
    semanticName: 'console.desk', materialId: 'subterra.steel',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.STEEL
  });
  const pedestal = transformMesh(createBoxMesh({
    width: 1.32, height: 0.82, depth: 0.56,
    semanticName: 'console.pedestal', materialId: 'subterra.steelDark',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.STEEL
  }), { translation: [0, -0.46, 0] });
  const vents = [];
  for (let i = 0; i < 4; i++) {
    vents.push(transformMesh(createBoxMesh({
      width: 1.1, height: 0.035, depth: 0.03,
      semanticName: `console.vent.${String(i).padStart(2, '0')}`,
      materialId: 'subterra.rubber',
      regionId: REGION.EQUIPMENT, surfaceId: SURFACE.STEEL
    }), { translation: [0, -0.22 - i * 0.14, 0.29] }));
  }
  return mergeMeshIR([desk, pedestal, ...vents], { id: 'subterra.consoleBody' });
}

function consoleScreen() {
  const bezel = createBoxMesh({
    width: 1.0, height: 0.62, depth: 0.07,
    semanticName: 'console.screen.bezel', materialId: 'subterra.steelDark',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.STEEL
  });
  const glass = transformMesh(createBoxMesh({
    width: 0.88, height: 0.5, depth: 0.02,
    semanticName: 'console.screen.glass', materialId: 'subterra.screen',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.EMISSIVE
  }), { translation: [0, 0, 0.045] });
  return mergeMeshIR([bezel, glass], { id: 'subterra.consoleScreen' });
}

function supplyCrate() {
  const body = createBoxMesh({
    width: 0.78, height: 0.6, depth: 0.62,
    semanticName: 'crate.body', materialId: 'subterra.steelDark',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.STEEL
  });
  const lid = transformMesh(createBoxMesh({
    width: 0.82, height: 0.08, depth: 0.66,
    semanticName: 'crate.lid', materialId: 'subterra.steel',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.STEEL
  }), { translation: [0, 0.34, 0] });
  const strap = (side, index) => transformMesh(createBoxMesh({
    width: 0.05, height: 0.62, depth: 0.66,
    semanticName: `crate.strap.${index}`, materialId: 'subterra.hazard',
    regionId: REGION.EQUIPMENT, surfaceId: SURFACE.PAINTED
  }), { translation: [side * 0.26, 0, 0] });
  return mergeMeshIR([body, lid, strap(-1, '00'), strap(1, '01')], { id: 'subterra.crate' });
}

/**
 * Builds the asset library.
 *
 * Keys are the opaque strings scene nodes reference. Each is built once and
 * shared: a scene that places the same crate twice does not build two crates.
 *
 * @returns {Map<string, object>} asset key -> MeshIR.
 */
export function createSubterraAssets() {
  return new Map([
    ['floor.slab', floorSlab()],
    ['ceiling.panel', ceilingPanel()],
    ['wall.panel', wallPanel()],
    ['wall.end', endWall()],
    ['frame.post', framePost()],
    ['frame.header', frameHeader()],
    ['door.leaf', doorLeaf()],
    ['fixture.housing', fixtureHousing()],
    ['fixture.lamp', fixtureLamp()],
    ['pipe.run', pipeRun()],
    ['bracket', bracket()],
    ['column', supportColumn()],
    ['console.body', consoleBody()],
    ['console.screen', consoleScreen()],
    ['crate', supplyCrate()]
  ]);
}

export { rotationY, rotationZ };
