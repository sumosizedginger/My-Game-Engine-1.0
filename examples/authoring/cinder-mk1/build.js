/**
 * CINDER MK-I — Build
 *
 * Generates CINDER entirely through My Game Engine 1.0's public authoring
 * surface. The result is PURE authoring data: MeshIR, MaterialDefinitions and
 * anchors, with no renderer object anywhere. That purity is what lets the same
 * source run in Node and in the browser for the cross-runtime determinism
 * probe.
 *
 * Turning this into something visible is a separate step:
 *   createPreviewable(buildCinder()) -> previewArtifact(...)
 *
 * ---------------------------------------------------------------------------
 * AUTHORING STRATEGY
 * ---------------------------------------------------------------------------
 * The vocabulary is five verbs: box, cylinder, convex extrusion, transform,
 * merge. Everything below is composed from those. Three techniques carry most
 * of the visual weight:
 *
 *   1. CHAMFER EVERYTHING. There is no bevel operation, so chamfers are
 *      generated into the extrusion profile. An exact chamfer beats an absent
 *      one, and it is what stops each form reading as a raw box.
 *
 *   2. PROUD FRAMES INSTEAD OF CUT RECESSES. There is no boolean, so a vent or
 *      an ejection port cannot be subtracted. A darker plate set slightly
 *      proud of the shell, bracketed by frames set MORE proud, reads as a
 *      recess because the frames cast the shadow a real recess would.
 *
 *   3. LAYERED SHELLS. One box reads as a box. A core, a pair of side plates
 *      standing 3.5 mm proud, a crowned top deck and a wrapped rib read as a
 *      machined assembly, because each overlap produces an edge highlight.
 *
 * Left/right pairs are authored twice rather than mirrored: transformMesh
 * refuses negative scale, because mirroring flips winding and surface
 * orientation. `pair()` makes that explicit rather than incidental.
 */

import {
  createBoxMesh,
  createCylinderMesh,
  extrudeProfile,
  transformMesh,
  mergeMeshIR,
  createAnchor
} from '@sumosizedginger/my-game-engine-1.0/full';

import {
  CINDER_PARAMETERS,
  REGION,
  SURFACE,
  createCinderMaterials,
  chamferedRectProfile,
  taperedChamferProfile,
  chamferedTaperProfile,
  roundedRectProfile,
  roundedTaperProfile,
  taperedProfile,
  polygonProfile,
  crownedProfile,
  wedgeProfile
} from './definition.js';

const STEEL = 'cinder.steel';
const STEEL_DARK = 'cinder.steelDark';
const POLYMER = 'cinder.polymer';
const PANEL = 'cinder.polymerLight';
const GRIP_RUBBER = 'cinder.grip';
const SCORCHED = 'cinder.scorched';
const BRASS = 'cinder.brass';
const HAZARD = 'cinder.hazard';
const EMBER = 'cinder.ember';
const EMBER_DIM = 'cinder.emberDim';
const OPTIC_GLASS = 'cinder.optic';
const STATUS = 'cinder.status';
const VOID = 'cinder.void';

const IDENTITY_Q = [0, 0, 0, 1];

// ---------------------------------------------------------------------------
// ROTATION HELPERS
//
// transformMesh takes a unit quaternion; producing one is the caller's job.
// These are authoring maths, not engine vocabulary, and live with the asset.
// ---------------------------------------------------------------------------

/**
 * Quaternion for a rotation about the X axis.
 *
 * @param {number} degrees
 * @returns {number[]} [x, y, z, w]
 */
function rotationX(degrees) {
  const half = (degrees * Math.PI) / 360;
  return [Math.sin(half), 0, 0, Math.cos(half)];
}

/**
 * Quaternion for a rotation about the Y axis.
 *
 * @param {number} degrees
 * @returns {number[]} [x, y, z, w]
 */
function rotationY(degrees) {
  const half = (degrees * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

/**
 * Quaternion for a rotation about the Z axis.
 *
 * @param {number} degrees
 * @returns {number[]} [x, y, z, w]
 */
function rotationZ(degrees) {
  const half = (degrees * Math.PI) / 360;
  return [0, 0, Math.sin(half), Math.cos(half)];
}

/**
 * Hamilton product, then renormalised.
 *
 * transformMesh rejects a quaternion that is not unit length within 1e-6, and
 * a chain of products accumulates float error, so composed rotations are
 * normalised here. Math.sqrt is exactly specified by IEEE 754, so this stays
 * bit-reproducible across runtimes in a way Math.sin and Math.cos are not.
 *
 * @param {number[]} a - Applied second.
 * @param {number[]} b - Applied first.
 * @returns {number[]} Unit quaternion.
 */
function quatMul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  const x = aw * bx + ax * bw + ay * bz - az * by;
  const y = aw * by - ax * bz + ay * bw + az * bx;
  const z = aw * bz + ax * by - ay * bx + az * bw;
  const w = aw * bw - ax * bx - ay * by - az * bz;
  const length = Math.sqrt(x * x + y * y + z * z + w * w);
  return [x / length, y / length, z / length, w / length];
}

// ---------------------------------------------------------------------------
// PLACEMENT HELPERS
//
// Every helper builds its form CENTRED ON THE LOCAL ORIGIN and then transforms
// it, so a rotation is always about the part's own centre. Placing by centre
// rather than by corner is what lets the datum planes in CINDER_PARAMETERS
// actually hold the assembly together.
// ---------------------------------------------------------------------------

/**
 * Convex prism centred on `at`, extruded along its local Z before rotation.
 *
 * @param {object} spec
 * @returns {object} MeshIR
 */
function prism({
  profile, depth, at = [0, 0, 0], rotation = IDENTITY_Q,
  name, material, region = 0, surface = 0, anchors = [],
  capStart = true, capEnd = true
}) {
  const mesh = extrudeProfile({
    profile,
    distance: depth,
    origin: { x: 0, y: 0, z: -depth / 2 },
    capStart,
    capEnd,
    semanticName: name,
    materialId: material,
    regionId: region,
    surfaceId: surface,
    anchors
  });
  return transformMesh(mesh, { translation: at, rotation });
}

/**
 * Chamfered box centred on `at`. The workhorse: nearly every rectangular form
 * in CINDER is one of these rather than a raw box, because the chamfer is what
 * catches the key light along every edge.
 *
 * @param {object} spec
 * @returns {object} MeshIR
 */
function slab({
  width, height, depth, chamfer = 0.0035, at = [0, 0, 0], rotation = IDENTITY_Q,
  name, material, region = 0, surface = 0, anchors = []
}) {
  return prism({
    profile: chamferedRectProfile(width, height, chamfer),
    depth, at, rotation, name, material, region, surface, anchors
  });
}

/**
 * Cylinder whose axis runs along -Z (engine forward) with its base at `at`.
 *
 * createCylinderMesh builds along +Y from its base, so forward-facing tubes
 * are a -90 degree rotation about X.
 *
 * @param {object} spec
 * @returns {object} MeshIR
 */
function tubeZ({
  radiusTop, radiusBottom = radiusTop, length, segments = 16,
  at = [0, 0, 0], name, material, region = 0, surface = 0,
  anchors = [], cappedBottom = true, spin = null
}) {
  const mesh = createCylinderMesh({
    radiusTop, radiusBottom, height: length, radialSegments: segments,
    cappedBottom, semanticName: name, materialId: material,
    regionId: region, surfaceId: surface, anchors
  });
  const rotation = spin ? quatMul(rotationX(-90), rotationY(spin)) : rotationX(-90);
  return transformMesh(mesh, { translation: at, rotation });
}

/**
 * Cylinder whose axis runs along +X with its base at `at`. Used for cross
 * pins, takedown hardware and anything that reads as passing through the
 * receiver.
 *
 * @param {object} spec
 * @returns {object} MeshIR
 */
function tubeX({
  radiusTop, radiusBottom = radiusTop, length, segments = 12,
  at = [0, 0, 0], name, material, region = 0, surface = 0
}) {
  return transformMesh(
    createCylinderMesh({
      radiusTop, radiusBottom, height: length, radialSegments: segments,
      semanticName: name, materialId: material, regionId: region, surfaceId: surface
    }),
    { translation: at, rotation: rotationZ(-90) }
  );
}

/**
 * Cylinder along +Y with its base at `at`.
 *
 * @param {object} spec
 * @returns {object} MeshIR
 */
function tubeY({
  radiusTop, radiusBottom = radiusTop, length, segments = 12,
  at = [0, 0, 0], name, material, region = 0, surface = 0, tilt = null
}) {
  const mesh = createCylinderMesh({
    radiusTop, radiusBottom, height: length, radialSegments: segments,
    semanticName: name, materialId: material, regionId: region, surfaceId: surface
  });
  return transformMesh(mesh, { translation: at, rotation: tilt ?? IDENTITY_Q });
}

/**
 * Authors a left/right pair explicitly.
 *
 * transformMesh refuses negative scale, so a mirrored part cannot be produced
 * by scaling one. The builder is called once per side with the signed X offset
 * and a side suffix, which keeps the symmetry visible in the source instead of
 * hiding it behind an operation the engine does not have.
 *
 * @param {function(number, string): object} build
 * @returns {Array<object>} Two MeshIR.
 */
function pair(build) {
  return [build(1, 'L'), build(-1, 'R')];
}

/**
 * Index suffix with stable width, so `rail.tooth.00` sorts before
 * `rail.tooth.10` in every manifest and every diff.
 *
 * @param {number} index
 * @returns {string}
 */
function ix(index) {
  return String(index).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// ASSEMBLIES
// ---------------------------------------------------------------------------

/**
 * Lower receiver: magazine well, trigger group housing and takedown hardware.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildLowerReceiver(P) {
  const D = P.datum;
  const L = P.lower;
  const out = [];

  const length = D.receiverRearZ - D.receiverFrontZ;
  const midZ = (D.receiverRearZ + D.receiverFrontZ) / 2;
  const coreY = (D.receiverBottomY + L.topY) / 2;

  out.push(prism({
    profile: roundedRectProfile(L.width, L.height, 0.009),
    depth: length,
    at: [0, coreY, midZ],
    name: 'receiver.lower.core',
    material: STEEL_DARK,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE,
    anchors: [createAnchor({
      name: 'weapon.receiver.datum',
      partId: 'receiver.lower.core',
      position: [0, 0, 0]
    })]
  }));

  // Side plates standing proud of the core. The 3.5 mm step is the shadow line
  // that separates "one extruded blank" from "a plated assembly".
  out.push(...pair((sign, side) => slab({
    width: L.plateProud * 2,
    height: L.plateHeight,
    depth: length * 0.86,
    chamfer: 0.0022,
    at: [sign * (L.width / 2), coreY + 0.004, midZ - 0.006],
    name: `receiver.lower.plate.${side}`,
    material: STEEL,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  })));

  // Magazine well: flared toward the bottom so the magazine reads as seated in
  // something, not stuck to a flat face.
  const magwellTopY = D.receiverBottomY + 0.004;
  const magwellHeight = 0.030;
  out.push(prism({
    profile: taperedProfile(L.width + 0.004, L.width + L.magwellFlare, magwellHeight),
    depth: L.magwellLength,
    at: [0, magwellTopY - magwellHeight / 2, L.magwellZ],
    name: 'receiver.lower.magwell',
    material: STEEL_DARK,
    region: REGION.MAGAZINE,
    surface: SURFACE.STRUCTURE
  }));

  out.push(slab({
    width: L.width + L.magwellFlare + 0.005,
    height: 0.007,
    depth: L.magwellLength + 0.005,
    chamfer: 0.003,
    at: [0, magwellTopY - magwellHeight - 0.0035, L.magwellZ],
    name: 'receiver.lower.magwell.lip',
    material: STEEL,
    region: REGION.MAGAZINE,
    surface: SURFACE.MECHANISM,
    anchors: [createAnchor({
      name: 'weapon.magazineSocket',
      partId: 'receiver.lower.magwell.lip',
      position: [0, 0, 0]
    })]
  }));

  // Trigger guard, composed from three convex bars. A closed guard is concave
  // and cannot be one extrusion with caps.
  const guardTopY = D.receiverBottomY;
  const guardBottomY = guardTopY - L.guardDrop;
  const guardFrontZ = 0.046;
  const guardRearZ = guardFrontZ + L.guardBowDepth;

  out.push(slab({
    width: L.guardBowWidth, height: L.guardDrop * 0.70, depth: 0.014, chamfer: 0.003,
    at: [0, guardTopY - L.guardDrop * 0.31, guardFrontZ],
    name: 'receiver.lower.triggerGuard.front',
    material: STEEL_DARK, region: REGION.CONTROLS, surface: SURFACE.STRUCTURE
  }));

  out.push(slab({
    width: L.guardBowWidth, height: 0.014, depth: L.guardBowDepth, chamfer: 0.004,
    at: [0, guardBottomY, guardFrontZ + L.guardBowDepth / 2],
    name: 'receiver.lower.triggerGuard.bow',
    material: STEEL_DARK, region: REGION.CONTROLS, surface: SURFACE.STRUCTURE
  }));

  out.push(prism({
    profile: wedgeProfile(L.guardBowWidth, L.guardDrop * 0.96, 0.016),
    depth: 0.015,
    at: [0, guardTopY - L.guardDrop * 0.48, guardRearZ],
    rotation: rotationY(90),
    name: 'receiver.lower.triggerGuard.rear',
    material: STEEL_DARK, region: REGION.CONTROLS, surface: SURFACE.STRUCTURE
  }));

  out.push(prism({
    profile: wedgeProfile(0.007, 0.030, 0.008),
    depth: 0.009,
    at: [0, guardTopY - 0.019, guardFrontZ + 0.028],
    rotation: rotationY(90),
    name: 'receiver.lower.trigger',
    material: STEEL, region: REGION.CONTROLS, surface: SURFACE.MECHANISM
  }));

  // The lower receiver's flank is the single largest uninterrupted surface on
  // the weapon. A framed recess plus a charge gauge breaks it up and ties the
  // composition together: the gauge, the magazine counter and the optic lens
  // are then three cool accents spaced along the length instead of two.
  out.push(...pair((sign, side) => slab({
    width: 0.005, height: 0.026, depth: 0.082, chamfer: 0.0028,
    at: [sign * (L.width / 2 + 0.0030), coreY + 0.002, 0.150],
    name: `receiver.lower.recess.frame.${side}`,
    material: STEEL_DARK,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  })));
  out.push(...pair((sign, side) => slab({
    width: 0.004, height: 0.018, depth: 0.072, chamfer: 0.002,
    at: [sign * (L.width / 2 + 0.0038), coreY + 0.002, 0.150],
    name: `receiver.lower.recess.panel.${side}`,
    material: VOID,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  })));
  out.push(...pair((sign, side) => slab({
    width: 0.004, height: 0.007, depth: 0.052, chamfer: 0.0012,
    at: [sign * (L.width / 2 + 0.0044), coreY + 0.002, 0.150],
    name: `receiver.lower.chargeGauge.${side}`,
    material: STATUS,
    region: REGION.RECEIVER,
    surface: SURFACE.EMISSIVE
  })));

  // Takedown lugs and the pins through them.
  for (const [tag, z] of [['front', D.receiverFrontZ + 0.030], ['rear', D.receiverRearZ - 0.030]]) {
    out.push(slab({
      width: L.width + 0.006, height: 0.020, depth: 0.020, chamfer: 0.004,
      at: [0, coreY - 0.008, z],
      name: `receiver.lower.lug.${tag}`,
      material: STEEL_DARK, region: REGION.RECEIVER, surface: SURFACE.STRUCTURE
    }));
    out.push(tubeX({
      radiusTop: 0.0055, length: L.width + 0.014, segments: 10,
      at: [-(L.width / 2 + 0.007), coreY - 0.008, z],
      name: `receiver.lower.pin.${tag}`,
      material: BRASS, region: REGION.RECEIVER, surface: SURFACE.FASTENER
    }));
  }

  return out;
}

/**
 * Upper receiver: the crowned spine, ejection port, thermal vents and the
 * flat-top deck that carries the rail.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildUpperReceiver(P) {
  const D = P.datum;
  const U = P.upper;
  const L = P.lower;
  const out = [];

  const length = D.receiverRearZ - D.receiverFrontZ;
  const midZ = (D.receiverRearZ + D.receiverFrontZ) / 2;
  const coreY = (L.topY + D.receiverTopY) / 2;

  // Crowned rather than flat: a domed spine gives the top view something to
  // describe and stops the front view reading as a rectangle.
  out.push(prism({
    profile: crownedProfile(U.width, U.height, U.deckWidth + 0.006),
    depth: length,
    at: [0, coreY, midZ],
    name: 'receiver.upper.core',
    material: STEEL_DARK,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  }));

  out.push(slab({
    width: U.deckWidth, height: U.deckHeight, depth: length + 0.004, chamfer: 0.0028,
    at: [0, D.receiverTopY + U.deckHeight / 2, midZ],
    name: 'receiver.upper.deck',
    material: STEEL,
    region: REGION.RAIL,
    surface: SURFACE.STRUCTURE
  }));

  // Angled flank facets. Thin wedges break the slab sides into two planes that
  // take the key light at different angles.
  out.push(...pair((sign, side) => prism({
    profile: wedgeProfile(0.009, U.flankHeight, 0.006 * sign),
    depth: length * 0.90,
    at: [sign * (U.width / 2 - 0.002), coreY + 0.002, midZ],
    name: `receiver.upper.flank.${side}`,
    material: STEEL,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  })));

  // Ejection port, right side. Frame proud, plate less proud: the frame's
  // shadow is what sells the recess, because nothing here can be subtracted.
  const portX = U.width / 2;
  out.push(slab({
    width: 0.006, height: U.portHeight + 0.010, depth: U.portLength + 0.010, chamfer: 0.003,
    at: [-(portX + 0.001), coreY, U.portZ],
    name: 'receiver.upper.port.frame',
    material: STEEL,
    region: REGION.RECEIVER,
    surface: SURFACE.MECHANISM
  }));
  out.push(slab({
    width: 0.004, height: U.portHeight, depth: U.portLength, chamfer: 0.002,
    at: [-(portX + 0.0015), coreY, U.portZ],
    name: 'receiver.upper.port.recess',
    material: VOID,
    region: REGION.RECEIVER,
    surface: SURFACE.MECHANISM,
    anchors: [createAnchor({
      name: 'weapon.ejectionPort',
      partId: 'receiver.upper.port.recess',
      position: [0, 0, 0]
    })]
  }));
  out.push(prism({
    profile: wedgeProfile(0.016, 0.020, 0.009),
    depth: 0.010,
    at: [-(portX + 0.006), coreY + 0.004, U.portZ + U.portLength / 2 + 0.010],
    rotation: rotationY(90),
    name: 'receiver.upper.port.deflector',
    material: STEEL,
    region: REGION.RECEIVER,
    surface: SURFACE.MECHANISM
  }));

  // Charging race, left side: a raised rail the handle slides in.
  out.push(slab({
    width: 0.007, height: 0.014, depth: 0.100, chamfer: 0.0025,
    at: [portX + 0.001, coreY + 0.008, U.portZ + 0.060],
    name: 'receiver.upper.chargingRace',
    material: STEEL,
    region: REGION.RECEIVER,
    surface: SURFACE.MECHANISM
  }));

  // Thermal vent bank: raised frame, dark louvres inside it.
  out.push(slab({
    width: 0.006, height: 0.024, depth: U.ventCount * (U.ventLength + U.ventGap) + 0.010, chamfer: 0.0025,
    at: [portX + 0.0008, coreY - 0.002, U.ventZ],
    name: 'receiver.upper.ventFrame',
    material: STEEL_DARK,
    region: REGION.THERMAL,
    surface: SURFACE.THERMAL
  }));
  const ventSpan = U.ventCount * (U.ventLength + U.ventGap);
  for (let i = 0; i < U.ventCount; i++) {
    const z = U.ventZ + ventSpan / 2 - (i + 0.5) * (U.ventLength + U.ventGap);
    out.push(slab({
      width: 0.004, height: 0.016, depth: U.ventLength, chamfer: 0.0012,
      at: [portX + 0.0022, coreY - 0.002, z],
      name: `receiver.upper.vent.${ix(i)}`,
      material: VOID,
      region: REGION.THERMAL,
      surface: SURFACE.THERMAL
    }));
  }

  // The ejection-port side carries most of the mechanical interest, but the
  // key light sits at +X, so the canonical `right` view is the one a reviewer
  // can actually read. Detail is added here deliberately so the best-lit view
  // is not the emptiest one.
  out.push(slab({
    width: 0.006, height: 0.026, depth: 0.038, chamfer: 0.0028,
    at: [portX + 0.0010, coreY + 0.001, 0.036],
    name: 'receiver.upper.accessHatch.frame',
    material: STEEL,
    region: REGION.RECEIVER,
    surface: SURFACE.MECHANISM
  }));
  out.push(slab({
    width: 0.004, height: 0.019, depth: 0.030, chamfer: 0.002,
    at: [portX + 0.0018, coreY + 0.001, 0.036],
    name: 'receiver.upper.accessHatch.panel',
    material: PANEL,
    region: REGION.RECEIVER,
    surface: SURFACE.MECHANISM
  }));
  out.push(slab({
    width: 0.004, height: 0.014, depth: 0.034, chamfer: 0.0014,
    at: [portX + 0.0012, coreY - 0.012, 0.226],
    name: 'receiver.upper.serialPlate',
    material: PANEL,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  }));
  for (let i = 0; i < 2; i++) {
    out.push(slab({
      width: 0.0035, height: 0.0055, depth: 0.0055, chamfer: 0.0008,
      at: [portX + 0.0015, coreY + 0.017, 0.030 + i * 0.011],
      name: `receiver.upper.status.R.${ix(i)}`,
      material: STATUS,
      region: REGION.RECEIVER,
      surface: SURFACE.EMISSIVE
    }));
  }

  // The span between the ejection port and the optic was a dead visual zone:
  // 100 mm of unbroken grey on the most-looked-at surface of the weapon. A
  // raised bolt-carrier hump, a lighter data plate and a pair of panel lines
  // give it something to describe without adding a single new operation.
  out.push(prism({
    profile: crownedProfile(U.width - 0.008, 0.014, U.deckWidth - 0.004),
    depth: 0.096,
    at: [0, D.receiverTopY - 0.004, U.portZ + 0.088],
    name: 'receiver.upper.boltHump',
    material: STEEL_DARK,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  }));

  out.push(slab({
    width: 0.005, height: 0.017, depth: 0.048, chamfer: 0.0018,
    at: [-(portX + 0.0012), coreY + 0.001, U.portZ + 0.098],
    name: 'receiver.upper.dataPlate',
    material: PANEL,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  }));

  out.push(...pair((sign, side) => slab({
    width: 0.004, height: 0.005, depth: length * 0.78, chamfer: 0.0009,
    at: [sign * (portX - 0.0015), coreY - 0.014, midZ],
    name: `receiver.upper.panelLine.${side}`,
    material: VOID,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  })));

  out.push(slab({
    width: U.width + 0.004, height: U.height + 0.004, depth: 0.010, chamfer: 0.005,
    at: [0, coreY, D.receiverRearZ + 0.004],
    name: 'receiver.upper.rearCap',
    material: STEEL_DARK,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  }));

  // Status chips. Three small emissive squares are worth more to readability
  // than any amount of extra grey geometry.
  for (let i = 0; i < 3; i++) {
    out.push(slab({
      width: 0.0035, height: 0.0055, depth: 0.0055, chamfer: 0.0008,
      at: [-(portX + 0.0015), coreY + 0.016, U.portZ + 0.052 + i * 0.010],
      name: `receiver.upper.status.${ix(i)}`,
      material: STATUS,
      region: REGION.RECEIVER,
      surface: SURFACE.EMISSIVE
    }));
  }

  return out;
}

/**
 * Thermal core: the exposed heat exchanger that gives CINDER its name.
 *
 * Built as a glowing tube of small radius wrapped by larger finned discs. The
 * core is visible BETWEEN the fins, which is how a heat exchanger reads
 * without any boolean operation to cut fins from a solid.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildThermalCore(P) {
  const T = P.thermal;
  const D = P.datum;
  const out = [];

  out.push(prism({
    profile: polygonProfile(T.coreRadius, 12, 15),
    depth: T.length + 0.014,
    at: [0, D.boreY, T.z],
    name: 'thermal.core',
    material: EMBER,
    region: REGION.THERMAL,
    surface: SURFACE.EMISSIVE,
    anchors: [createAnchor({
      name: 'weapon.thermalCore',
      partId: 'thermal.core',
      position: [0, 0, 0]
    })]
  }));

  const pitch = T.length / T.finCount;
  for (let i = 0; i < T.finCount; i++) {
    const z = T.z + T.length / 2 - (i + 0.5) * pitch;
    // Fins alternate size so the stack has rhythm rather than reading as a
    // uniform comb.
    const radius = T.finRadius - (i % 2 === 0 ? 0 : 0.0055);
    out.push(prism({
      profile: polygonProfile(radius, 8, 22.5),
      depth: T.finThickness,
      at: [0, D.boreY, z],
      name: `thermal.fin.${ix(i)}`,
      material: SCORCHED,
      region: REGION.THERMAL,
      surface: SURFACE.THERMAL
    }));
  }

  for (const [tag, z] of [['rear', T.z + T.length / 2 + 0.010], ['front', T.z - T.length / 2 - 0.010]]) {
    out.push(prism({
      profile: polygonProfile(T.collarRadius, 8, 22.5),
      depth: 0.016,
      at: [0, D.boreY, z],
      name: `thermal.collar.${tag}`,
      material: STEEL_DARK,
      region: REGION.THERMAL,
      surface: SURFACE.STRUCTURE
    }));
  }

  // Heat bleeding into the surrounding structure, as dim emissive wedges.
  out.push(...pair((sign, side) => slab({
    width: 0.004, height: 0.010, depth: T.length * 0.7, chamfer: 0.001,
    at: [sign * (T.collarRadius + 0.002), D.boreY - T.collarRadius + 0.004, T.z],
    name: `thermal.bleed.${side}`,
    material: EMBER_DIM,
    region: REGION.THERMAL,
    surface: SURFACE.EMISSIVE
  })));

  return out;
}

/**
 * Handguard: the longest single mass on the weapon, and therefore the one that
 * most needs repeated detail to avoid reading as a tube.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildHandguard(P) {
  const H = P.handguard;
  const D = P.datum;
  const out = [];

  const length = H.rearZ - H.frontZ;
  const midZ = (H.rearZ + H.frontZ) / 2;

  out.push(prism({
    profile: crownedProfile(H.width, H.height, H.topDeckWidth + 0.008),
    depth: length,
    at: [0, H.centreY, midZ],
    name: 'handguard.shell',
    material: POLYMER,
    region: REGION.HANDGUARD,
    surface: SURFACE.HANDLING
  }));

  out.push(slab({
    width: H.topDeckWidth, height: H.topDeckHeight, depth: length, chamfer: 0.0028,
    at: [0, H.centreY + H.height / 2 + H.topDeckHeight / 2 - 0.001, midZ],
    name: 'handguard.deck',
    material: STEEL,
    region: REGION.RAIL,
    surface: SURFACE.STRUCTURE
  }));

  // Reinforcement ribs wrapping the shell. Repeated mechanical rhythm along
  // the longest axis is the cheapest large readability win available.
  const ribPitch = length / (H.ribCount + 1);
  for (let i = 0; i < H.ribCount; i++) {
    const z = H.rearZ - (i + 1) * ribPitch;
    out.push(prism({
      profile: crownedProfile(H.width + H.ribProud * 2, H.height + H.ribProud * 2, H.topDeckWidth + 0.010),
      depth: H.ribThickness,
      at: [0, H.centreY, z],
      name: `handguard.rib.${ix(i)}`,
      material: STEEL_DARK,
      region: REGION.HANDGUARD,
      surface: SURFACE.STRUCTURE
    }));
  }

  // Vent louvres between the ribs, proud of the shell but inside the ribs, so
  // the ribs bracket them the way a real recess would be bracketed.
  const ventSpan = H.ventCount * (H.ventLength + H.ventGap);
  for (let i = 0; i < H.ventCount; i++) {
    const z = midZ + ventSpan / 2 - (i + 0.5) * (H.ventLength + H.ventGap);
    out.push(...pair((sign, side) => slab({
      width: 0.004, height: H.ventHeight, depth: H.ventLength, chamfer: 0.0015,
      at: [sign * (H.width / 2 - 0.0005), H.centreY - 0.006, z],
      // The vent nearest the thermal core still carries heat, so it glows
      // instead of reading as a plain opening. One material swap in a loop
      // buys a narrative the geometry alone cannot state.
      name: `handguard.vent.${side}.${ix(i)}`,
      material: i === 0 ? EMBER_DIM : VOID,
      region: REGION.THERMAL,
      surface: SURFACE.THERMAL
    })));
  }

  // Bottom accessory rail.
  const railY = H.centreY - H.height / 2;
  for (let i = 0; i < H.railTeeth; i++) {
    out.push(slab({
      width: 0.020, height: 0.005, depth: 0.0105, chamfer: 0.0015,
      at: [0, railY - 0.0025, midZ + 0.050 - i * 0.0175],
      name: `handguard.rail.tooth.${ix(i)}`,
      material: STEEL,
      region: REGION.RAIL,
      surface: SURFACE.STRUCTURE
    }));
  }

  // Angled forward grip, authored in its own frame. Iteration 3 positioned the
  // body, mount and cap independently in world space; the rake then moved the
  // body's lower end 25 mm away from where the cap had been placed and the
  // whole grip read as three disconnected pieces floating under the handguard.
  // Building locally and placing once makes that class of error impossible.
  const foregripLocal = [];
  const fgHalf = H.foregripLength / 2;

  foregripLocal.push(extrudeProfile({
    profile: roundedTaperProfile(0.038, 0.032, 0.046, 0.011),
    distance: H.foregripLength,
    origin: { x: 0, y: 0, z: -fgHalf },
    semanticName: 'handguard.foregrip.body',
    materialId: GRIP_RUBBER,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.HANDLING,
    anchors: [createAnchor({
      name: 'weapon.grip.support',
      partId: 'handguard.foregrip.body',
      position: [0, 0, 0]
    })]
  }));

  for (let i = 0; i < 3; i++) {
    foregripLocal.push(extrudeProfile({
      profile: chamferedRectProfile(0.040, 0.010, 0.002),
      distance: 0.009,
      origin: { x: 0, y: -(0.046 / 2 + 0.001), z: -fgHalf * 0.42 + i * 0.024 },
      semanticName: `handguard.foregrip.groove.${ix(i)}`,
      materialId: GRIP_RUBBER,
      regionId: REGION.GRIP,
      surfaceId: SURFACE.HANDLING
    }));
  }

  foregripLocal.push(extrudeProfile({
    profile: chamferedRectProfile(0.046, 0.052, 0.006),
    distance: 0.012,
    origin: { x: 0, y: 0, z: fgHalf - 0.004 },
    semanticName: 'handguard.foregrip.cap',
    materialId: STEEL_DARK,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.STRUCTURE
  }));

  foregripLocal.push(extrudeProfile({
    profile: chamferedRectProfile(0.044, 0.050, 0.005),
    distance: 0.014,
    origin: { x: 0, y: 0, z: -fgHalf - 0.008 },
    semanticName: 'handguard.foregrip.mount',
    materialId: STEEL_DARK,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.STRUCTURE
  }));

  out.push(transformMesh(mergeMeshIR(foregripLocal, { id: 'cinder.foregrip' }), {
    rotation: rotationX(90 + H.foregripRakeDeg),
    translation: [0, railY - fgHalf + 0.004, H.foregripZ]
  }));

  // Conduit running along the left flank: cable-like construction from
  // cylinder segments and clamps.
  const conduitSpan = length * 0.72;
  for (let i = 0; i < H.cableSegments; i++) {
    const segment = conduitSpan / H.cableSegments;
    out.push(tubeZ({
      radiusTop: 0.0048, radiusBottom: 0.0052, length: segment * 0.86, segments: 10,
      at: [H.width / 2 - 0.003, H.centreY + H.height / 2 - 0.014, midZ + conduitSpan / 2 - i * segment],
      name: `handguard.conduit.${ix(i)}`,
      material: SCORCHED,
      region: REGION.HANDGUARD,
      surface: SURFACE.MECHANISM
    }));
  }
  for (let i = 0; i < 2; i++) {
    out.push(slab({
      width: 0.010, height: 0.012, depth: 0.007, chamfer: 0.002,
      at: [H.width / 2 - 0.003, H.centreY + H.height / 2 - 0.014, midZ + conduitSpan / 2 - (i + 1) * (conduitSpan / 3)],
      name: `handguard.conduit.clamp.${ix(i)}`,
      material: STEEL,
      region: REGION.HANDGUARD,
      surface: SURFACE.FASTENER
    }));
  }

  // Large lighter panels between the ribs. A big shape at a different VALUE
  // does more for readability than any number of small details at the same
  // value, and the handguard is the largest single mass on the weapon.
  out.push(...pair((sign, side) => slab({
    width: 0.005, height: H.height * 0.46, depth: length * 0.30, chamfer: 0.0028,
    at: [sign * (H.width / 2 - 0.0012), H.centreY + 0.012, midZ + length * 0.22],
    name: `handguard.panel.${side}`,
    material: PANEL,
    region: REGION.HANDGUARD,
    surface: SURFACE.STRUCTURE
  })));

  // Hazard accents. Warm chips against a cool grey body are what make an
  // industrial asset look designed rather than merely modelled.
  out.push(...pair((sign, side) => slab({
    width: 0.0035, height: 0.009, depth: 0.042, chamfer: 0.001,
    at: [sign * (H.width / 2 - 0.0005), H.centreY + H.height / 2 - 0.014, H.frontZ + 0.055],
    name: `handguard.hazard.${side}`,
    material: HAZARD,
    region: REGION.HANDGUARD,
    surface: SURFACE.HAZARD
  })));

  out.push(prism({
    profile: crownedProfile(H.width + 0.005, H.height + 0.005, H.topDeckWidth + 0.010),
    depth: 0.012,
    at: [0, H.centreY, H.frontZ + 0.006],
    name: 'handguard.frontCap',
    material: STEEL_DARK,
    region: REGION.HANDGUARD,
    surface: SURFACE.STRUCTURE
  }));

  return out;
}

/**
 * Barrel, gas system and muzzle assembly.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildBarrel(P) {
  const B = P.barrel;
  const M = P.muzzle;
  const D = P.datum;
  const out = [];

  const barrelRearZ = D.receiverFrontZ;
  const barrelLength = barrelRearZ - B.exposedFrontZ;

  out.push(tubeZ({
    radiusTop: B.radius, radiusBottom: B.radius * 1.14, length: barrelLength, segments: B.segments,
    at: [0, D.boreY, barrelRearZ],
    name: 'barrel.shaft',
    material: STEEL,
    region: REGION.BARREL,
    surface: SURFACE.STRUCTURE,
    anchors: [createAnchor({
      name: 'weapon.barrel.tip',
      partId: 'barrel.shaft',
      position: [0, barrelLength, 0]
    })]
  }));

  // Fluting: thin plates arrayed about the bore axis. Rotating a slab about Z
  // and offsetting it radially is how a radial array is expressed with a
  // vocabulary that has no array operation.
  const exposedStart = P.handguard.frontZ - 0.004;
  for (let i = 0; i < B.fluteCount; i++) {
    const angle = (i * 360) / B.fluteCount;
    const rot = rotationZ(angle);
    const radians = (angle * Math.PI) / 180;
    out.push(slab({
      width: B.fluteWidth, height: 0.004, depth: B.fluteLength, chamfer: 0.0009,
      at: [
        -Math.sin(radians) * (B.radius + 0.0012),
        D.boreY + Math.cos(radians) * (B.radius + 0.0012),
        exposedStart - B.fluteLength / 2
      ],
      rotation: rot,
      name: `barrel.flute.${ix(i)}`,
      material: STEEL_DARK,
      region: REGION.BARREL,
      surface: SURFACE.STRUCTURE
    }));
  }

  out.push(prism({
    profile: taperedChamferProfile(B.gasBlockWidth, B.gasBlockHeight, 0.008, 0.004),
    depth: B.gasBlockLength,
    at: [0, D.boreY + 0.004, B.gasBlockZ],
    name: 'barrel.gasBlock',
    material: STEEL_DARK,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM
  }));

  out.push(tubeZ({
    radiusTop: 0.0042, length: 0.070, segments: 10,
    at: [0, D.boreY + B.gasBlockHeight / 2 + 0.002, B.gasBlockZ + 0.056],
    name: 'barrel.gasTube',
    material: BRASS,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM
  }));

  // Front sight post on the gas block. Cheap, and it is the only thing that
  // gives the top view a landmark forward of the optic.
  out.push(slab({
    width: 0.007, height: 0.020, depth: 0.008, chamfer: 0.0018,
    at: [0, D.boreY + B.gasBlockHeight / 2 + 0.012, B.gasBlockZ - 0.010],
    name: 'barrel.frontSight',
    material: STEEL,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM
  }));
  out.push(...pair((sign, side) => prism({
    profile: wedgeProfile(0.006, 0.024, sign * 0.004),
    depth: 0.007,
    at: [sign * 0.013, D.boreY + B.gasBlockHeight / 2 + 0.010, B.gasBlockZ - 0.010],
    rotation: rotationY(90),
    name: `barrel.frontSight.ear.${side}`,
    material: STEEL_DARK,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM
  })));

  // Finned jacket between the gas block and the muzzle. Iteration 1 left this
  // span as a bare 25 mm cylinder, and the whole front end read as a needle.
  const jacketRearZ = B.gasBlockZ - B.gasBlockLength / 2 - 0.002;
  const jacketLength = jacketRearZ - B.exposedFrontZ;
  out.push(prism({
    profile: polygonProfile(B.radius + 0.0075, 8, 22.5),
    depth: jacketLength,
    at: [0, D.boreY, jacketRearZ - jacketLength / 2],
    name: 'barrel.jacket',
    material: STEEL_DARK,
    region: REGION.BARREL,
    surface: SURFACE.STRUCTURE
  }));
  for (let i = 0; i < 3; i++) {
    out.push(prism({
      profile: polygonProfile(B.radius + 0.0135, 8, 22.5),
      depth: 0.005,
      at: [0, D.boreY, jacketRearZ - 0.008 - i * 0.011],
      name: `barrel.jacket.fin.${ix(i)}`,
      material: STEEL_DARK,
      region: REGION.BARREL,
      surface: SURFACE.THERMAL
    }));
  }

  out.push(prism({
    profile: polygonProfile(B.radius + 0.0115, 8, 22.5),
    depth: 0.013,
    at: [0, D.boreY, B.exposedFrontZ + 0.012],
    name: 'barrel.collar',
    material: STEEL_DARK,
    region: REGION.BARREL,
    surface: SURFACE.STRUCTURE
  }));

  out.push(slab({
    width: 0.008, height: 0.008, depth: 0.014, chamfer: 0.0012,
    at: [0, D.boreY + B.radius + 0.0095, B.exposedFrontZ + 0.012],
    name: 'barrel.hazard',
    material: HAZARD,
    region: REGION.BARREL,
    surface: SURFACE.HAZARD
  }));

  // Muzzle brake. The prongs are the single most valuable silhouette element
  // on the weapon: they are the only part of the front end that is not a
  // cylinder, and they read from every view.
  out.push(tubeZ({
    radiusTop: M.bodyRadius * 0.92, radiusBottom: M.bodyRadius, length: M.bodyLength, segments: M.segments,
    at: [0, D.boreY, B.exposedFrontZ],
    name: 'muzzle.body',
    material: STEEL_DARK,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM
  }));

  const muzzleFrontZ = B.exposedFrontZ - M.bodyLength;

  for (let i = 0; i < M.portCount; i++) {
    const angle = 45 + (i * 360) / M.portCount;
    const radians = (angle * Math.PI) / 180;
    out.push(slab({
      width: 0.005, height: 0.006, depth: 0.020, chamfer: 0.0012,
      at: [
        -Math.sin(radians) * (M.bodyRadius - 0.002),
        D.boreY + Math.cos(radians) * (M.bodyRadius - 0.002),
        B.exposedFrontZ - M.bodyLength * 0.5
      ],
      rotation: rotationZ(angle),
      name: `muzzle.port.${ix(i)}`,
      material: VOID,
      region: REGION.BARREL,
      surface: SURFACE.THERMAL
    }));
  }

  for (let i = 0; i < M.prongCount; i++) {
    const angle = (i * 360) / M.prongCount;
    const radians = (angle * Math.PI) / 180;
    const spin = rotationZ(angle);
    // Splay: tilt each prong outward about its own radial tangent, then carry
    // it round to its place on the ring.
    const splay = quatMul(spin, rotationX(-M.prongSplayDeg));
    out.push(prism({
      profile: chamferedTaperProfile(M.prongWidth * 0.6, M.prongWidth, 0.011, 0.002),
      depth: M.prongLength,
      at: [
        -Math.sin(radians) * (M.bodyRadius * 0.98),
        D.boreY + Math.cos(radians) * (M.bodyRadius * 0.98),
        muzzleFrontZ - M.prongLength / 2 + 0.004
      ],
      rotation: quatMul(splay, rotationX(0)),
      name: `muzzle.prong.${ix(i)}`,
      material: STEEL,
      region: REGION.BARREL,
      surface: SURFACE.MECHANISM
    }));
  }

  // Solid ring tying the prong roots together. Without it the prongs read as
  // three loose blades; with it the whole assembly reads as one device.
  out.push(prism({
    profile: polygonProfile(M.crownRadius - 0.005, 12, 15),
    depth: 0.010,
    at: [0, D.boreY, muzzleFrontZ - M.prongLength + 0.006],
    name: 'muzzle.prongRing',
    material: STEEL_DARK,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM
  }));

  out.push(prism({
    profile: polygonProfile(M.crownRadius, 12, 15),
    depth: 0.009,
    at: [0, D.boreY, muzzleFrontZ + 0.005],
    name: 'muzzle.crown',
    material: SCORCHED,
    region: REGION.BARREL,
    surface: SURFACE.MECHANISM,
    anchors: [createAnchor({
      name: 'weapon.muzzle',
      partId: 'muzzle.crown',
      position: [0, 0, -0.005]
    })]
  }));

  return out;
}

/**
 * Stock: deliberately skeletal. An open truss is the strongest silhouette
 * decision available, because it puts background THROUGH the asset and breaks
 * the long horizontal mass that made iteration zero read as a plank.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildStock(P) {
  const S = P.stock;
  const D = P.datum;
  const out = [];

  const frontZ = D.receiverRearZ;
  const rearZ = S.rearZ;
  const length = rearZ - frontZ;
  const midZ = (rearZ + frontZ) / 2;

  out.push(slab({
    width: S.spineWidth, height: S.spineHeight, depth: length * 0.96, chamfer: 0.006,
    at: [0, S.upperY, midZ],
    name: 'stock.spine.upper',
    material: POLYMER,
    region: REGION.STOCK,
    surface: SURFACE.STRUCTURE
  }));

  out.push(prism({
    profile: taperedChamferProfile(S.spineWidth * 0.72, 0.020, 0.004, 0.006),
    depth: length * 0.84,
    at: [0, S.lowerY, midZ + 0.010],
    rotation: rotationX(-7),
    name: 'stock.spine.lower',
    material: POLYMER,
    region: REGION.STOCK,
    surface: SURFACE.STRUCTURE
  }));

  // Diagonal trusses. Alternating lean is what makes it read as a structure
  // rather than as a ladder.
  const trussPitch = (length * 0.78) / S.trussCount;
  for (let i = 0; i < S.trussCount; i++) {
    const z = frontZ + 0.040 + (i + 0.5) * trussPitch;
    const lean = i % 2 === 0 ? 34 : -34;
    out.push(slab({
      width: 0.020, height: 0.011, depth: (S.upperY - S.lowerY) * 1.30, chamfer: 0.003,
      at: [0, (S.upperY + S.lowerY) / 2, z],
      rotation: rotationX(90 + lean),
      name: `stock.truss.${ix(i)}`,
      material: STEEL_DARK,
      region: REGION.STOCK,
      surface: SURFACE.STRUCTURE
    }));
  }

  // Cheek rest: raised comb with a softer pad, and an adjustment rack beneath.
  out.push(prism({
    profile: crownedProfile(S.spineWidth + 0.004, S.combHeight, 0.022),
    depth: S.combLength,
    at: [0, S.upperY + S.spineHeight / 2 + S.combHeight / 2 - 0.003, S.combZ],
    name: 'stock.cheekRest',
    material: PANEL,
    region: REGION.STOCK,
    surface: SURFACE.HANDLING,
    anchors: [createAnchor({
      name: 'weapon.stock.comb',
      partId: 'stock.cheekRest',
      position: [0, S.combHeight / 2, 0]
    })]
  }));

  out.push(slab({
    width: 0.024, height: 0.005, depth: S.combLength * 0.88, chamfer: 0.0018,
    at: [0, S.upperY + S.spineHeight / 2 + S.combHeight - 0.003, S.combZ],
    name: 'stock.cheekRest.pad',
    material: GRIP_RUBBER,
    region: REGION.STOCK,
    surface: SURFACE.HANDLING
  }));

  for (let i = 0; i < 6; i++) {
    out.push(slab({
      width: 0.016, height: 0.005, depth: 0.008, chamfer: 0.0012,
      at: [0, S.upperY - S.spineHeight / 2 - 0.003, S.combZ - 0.052 + i * 0.019],
      name: `stock.adjust.tooth.${ix(i)}`,
      material: STEEL,
      region: REGION.STOCK,
      surface: SURFACE.MECHANISM
    }));
  }

  // Butt assembly.
  out.push(prism({
    profile: taperedChamferProfile(S.buttWidth, S.buttHeight, 0.009, 0.013),
    depth: S.buttThickness,
    at: [0, S.upperY - 0.018, rearZ - S.buttThickness / 2],
    name: 'stock.buttPlate',
    material: POLYMER,
    region: REGION.STOCK,
    surface: SURFACE.STRUCTURE
  }));

  out.push(prism({
    profile: roundedRectProfile(S.buttWidth + 0.004, S.buttHeight + 0.006, 0.014),
    depth: 0.011,
    at: [0, S.upperY - 0.018, rearZ + 0.004],
    name: 'stock.buttPad',
    material: GRIP_RUBBER,
    region: REGION.STOCK,
    surface: SURFACE.HANDLING,
    anchors: [createAnchor({
      name: 'weapon.stock.buttPlate',
      partId: 'stock.buttPad',
      position: [0, 0, 0.006]
    })]
  }));

  for (let i = 0; i < S.padRibs; i++) {
    out.push(slab({
      width: S.buttWidth * 0.82, height: 0.004, depth: 0.005, chamfer: 0.001,
      at: [0, S.upperY - 0.018 + (i - (S.padRibs - 1) / 2) * 0.020, rearZ + 0.010],
      name: `stock.buttPad.rib.${ix(i)}`,
      material: GRIP_RUBBER,
      region: REGION.STOCK,
      surface: SURFACE.HANDLING
    }));
  }

  out.push(tubeX({
    radiusTop: 0.011, length: S.spineWidth + 0.012, segments: 12,
    at: [-(S.spineWidth / 2 + 0.006), S.upperY, frontZ + 0.012],
    name: 'stock.hinge',
    material: STEEL,
    region: REGION.STOCK,
    surface: SURFACE.MECHANISM
  }));

  out.push(slab({
    width: 0.026, height: 0.012, depth: 0.012, chamfer: 0.003,
    at: [0, S.lowerY - 0.006, frontZ + 0.030],
    name: 'stock.slingMount',
    material: STEEL_DARK,
    region: REGION.STOCK,
    surface: SURFACE.FASTENER,
    anchors: [createAnchor({
      name: 'weapon.slingRear',
      partId: 'stock.slingMount',
      position: [0, -0.006, 0]
    })]
  }));

  out.push(slab({
    width: S.spineWidth + 0.002, height: 0.008, depth: 0.034, chamfer: 0.002,
    at: [0, S.upperY + S.spineHeight / 2 - 0.002, frontZ + 0.052],
    name: 'stock.hazard',
    material: HAZARD,
    region: REGION.STOCK,
    surface: SURFACE.HAZARD
  }));

  return out;
}

/**
 * Primary grip.
 *
 * Authored in the grip's OWN frame and placed with a single transform, rather
 * than each piece being positioned in world space and separately rotated.
 * mergeMeshIR keeps the part table intact, so an assembly can be composed
 * locally and then placed as a unit — which is both easier to reason about and
 * impossible to get subtly out of register.
 *
 * Local frame: +Z runs DOWN the grip, +Y is rearward, X is width.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildGrip(P) {
  const G = P.grip;
  const D = P.datum;
  const local = [];
  const halfLength = G.length / 2;

  local.push(extrudeProfile({
    profile: roundedTaperProfile(G.width, G.width * 0.84, G.depth, 0.012),
    distance: G.length,
    origin: { x: 0, y: 0, z: -halfLength },
    semanticName: 'grip.core',
    materialId: POLYMER,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.HANDLING,
    anchors: [createAnchor({
      name: 'weapon.grip.primary',
      partId: 'grip.core',
      position: [0, 0, 0]
    })]
  }));

  // Stacked side ribs rather than one panel. A single lighter rectangle on the
  // side of the grip read as a label on a box; four narrow ribs read as a
  // gripping surface, because repetition at this scale is what the eye uses to
  // identify texture when there are no textures to apply.
  for (let i = 0; i < 4; i++) {
    local.push(...pair((sign, side) => extrudeProfile({
      profile: roundedRectProfile(0.005, G.depth * 0.62, 0.005),
      distance: 0.008,
      origin: { x: sign * (G.width / 2 - 0.0008), y: 0.002, z: -G.length * 0.26 + i * 0.017 },
      semanticName: `grip.rib.${side}.${ix(i)}`,
      materialId: GRIP_RUBBER,
      regionId: REGION.GRIP,
      surfaceId: SURFACE.HANDLING
    })));
  }

  local.push(extrudeProfile({
    profile: chamferedRectProfile(G.width * 0.78, G.strapThickness * 2, 0.002),
    distance: G.length * 0.90,
    origin: { x: 0, y: -(G.depth / 2 - 0.001), z: -G.length * 0.45 },
    semanticName: 'grip.frontStrap',
    materialId: GRIP_RUBBER,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.HANDLING
  }));

  local.push(extrudeProfile({
    profile: chamferedRectProfile(G.width * 0.82, G.strapThickness * 2, 0.002),
    distance: G.length * 0.94,
    origin: { x: 0, y: G.depth / 2 - 0.001, z: -G.length * 0.47 },
    semanticName: 'grip.backStrap',
    materialId: GRIP_RUBBER,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.HANDLING
  }));

  // Finger grooves march down the front strap in the grip's own axis, so the
  // rake never pulls them off the face they belong to.
  for (let i = 0; i < G.fingerCount; i++) {
    local.push(extrudeProfile({
      profile: chamferedRectProfile(G.width * 0.86, 0.010, 0.0022),
      distance: 0.010,
      origin: { x: 0, y: -(G.depth / 2 + 0.001), z: -G.length * 0.22 + i * 0.028 },
      semanticName: `grip.finger.${ix(i)}`,
      materialId: GRIP_RUBBER,
      regionId: REGION.GRIP,
      surfaceId: SURFACE.HANDLING
    }));
  }

  // Beavertail and palm swell. Without them the grip is a tapered box of
  // roughly magazine proportions, and in a three-quarter view the two read as
  // a matched pair of boxes instead of as a grip and a magazine.
  local.push(extrudeProfile({
    profile: roundedRectProfile(G.width * 0.97, G.depth + 0.022, 0.012),
    distance: 0.028,
    origin: { x: 0, y: 0.011, z: -halfLength - 0.005 },
    semanticName: 'grip.beavertail',
    materialId: STEEL_DARK,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.STRUCTURE
  }));

  local.push(extrudeProfile({
    profile: roundedRectProfile(G.width + 0.007, G.depth * 0.84, 0.013),
    distance: 0.042,
    origin: { x: 0, y: 0.002, z: -0.014 },
    semanticName: 'grip.palmSwell',
    materialId: GRIP_RUBBER,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.HANDLING
  }));

  local.push(extrudeProfile({
    profile: chamferedTaperProfile(G.width + 0.009, G.width + 0.004, G.depth + 0.007, 0.004),
    distance: 0.011,
    origin: { x: 0, y: 0, z: halfLength - 0.004 },
    semanticName: 'grip.base',
    materialId: STEEL_DARK,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.STRUCTURE
  }));

  local.push(extrudeProfile({
    profile: chamferedRectProfile(0.014, 0.010, 0.002),
    distance: 0.006,
    origin: { x: 0, y: 0, z: halfLength + 0.006 },
    semanticName: 'grip.plug',
    materialId: HAZARD,
    regionId: REGION.GRIP,
    surfaceId: SURFACE.HAZARD
  }));

  // A real grip rakes so its BASE sits REARWARD of its top. rotationX(90 + rake)
  // produced the opposite lean, which read as a forward-canted paddle.
  const assembly = mergeMeshIR(local, { id: 'cinder.grip' });
  const centreY = D.receiverBottomY - G.length / 2 + 0.012;
  return [transformMesh(assembly, {
    rotation: rotationX(90 - G.rakeDeg),
    translation: [0, centreY, G.z]
  })];
}

/**
 * Magazine. Authored in its own frame for the same reason as the grip.
 *
 * Local frame: +Z runs DOWN the magazine, +Y is rearward, X is width.
 *
 * @param {object} P
 * @returns {Array<object>} MeshIR pieces.
 */
function buildMagazine(P) {
  const M = P.magazine;
  const D = P.datum;
  const local = [];
  const halfLength = M.length / 2;

  // The profile's X is the magazine's WIDTH and its Y is the FRONT-TO-BACK
  // depth; the extrusion runs down its length. Iteration 1 passed these the
  // other way round and produced a slab wider than the receiver above it.
  local.push(extrudeProfile({
    profile: roundedTaperProfile(M.width, M.width * 0.92, M.depth, 0.009),
    distance: M.length,
    origin: { x: 0, y: 0, z: -halfLength },
    semanticName: 'magazine.body',
    materialId: POLYMER,
    regionId: REGION.MAGAZINE,
    surfaceId: SURFACE.STRUCTURE,
    anchors: [createAnchor({
      name: 'weapon.magazine.datum',
      partId: 'magazine.body',
      position: [0, 0, -halfLength]
    })]
  }));

  for (let i = 0; i < M.ribCount; i++) {
    local.push(extrudeProfile({
      profile: roundedTaperProfile(
        M.width + M.ribProud * 2,
        M.width * 0.92 + M.ribProud * 2,
        M.depth + M.ribProud * 2,
        0.009
      ),
      distance: 0.007,
      origin: { x: 0, y: 0, z: -M.length * 0.34 + i * (M.length * 0.165) },
      semanticName: `magazine.rib.${ix(i)}`,
      materialId: STEEL_DARK,
      regionId: REGION.MAGAZINE,
      surfaceId: SURFACE.STRUCTURE
    }));
  }

  // Ammunition counter: a warm-cool accent that reads instantly, costs almost
  // nothing, and gives the lower half of the asset a focal point.
  local.push(...pair((sign, side) => extrudeProfile({
    profile: chamferedRectProfile(0.005, 0.013, 0.0012),
    distance: M.length * 0.58,
    origin: { x: sign * (M.width / 2 - 0.0006), y: -0.012, z: -M.length * 0.24 },
    semanticName: `magazine.counter.${side}`,
    materialId: STATUS,
    regionId: REGION.MAGAZINE,
    surfaceId: SURFACE.EMISSIVE
  })));

  local.push(extrudeProfile({
    profile: chamferedRectProfile(M.width * 0.60, 0.009, 0.002),
    distance: M.length * 0.72,
    origin: { x: 0, y: M.depth / 2 - 0.001, z: -M.length * 0.30 },
    semanticName: 'magazine.spine',
    materialId: STEEL_DARK,
    regionId: REGION.MAGAZINE,
    surfaceId: SURFACE.STRUCTURE
  }));

  local.push(extrudeProfile({
    profile: roundedTaperProfile(M.width + 0.007, M.width + 0.003, M.depth * 0.97, 0.008),
    distance: M.floorHeight,
    origin: { x: 0, y: 0, z: halfLength - 0.003 },
    semanticName: 'magazine.floorPlate',
    materialId: STEEL_DARK,
    regionId: REGION.MAGAZINE,
    surfaceId: SURFACE.STRUCTURE
  }));

  local.push(extrudeProfile({
    profile: chamferedRectProfile(M.width + 0.009, 0.016, 0.002),
    distance: 0.007,
    origin: { x: 0, y: 0, z: halfLength + M.floorHeight - 0.002 },
    semanticName: 'magazine.hazard',
    materialId: HAZARD,
    regionId: REGION.MAGAZINE,
    surfaceId: SURFACE.HAZARD,
    anchors: [createAnchor({
      name: 'weapon.magazine.floor',
      partId: 'magazine.hazard',
      position: [0, 0, 0.004]
    })]
  }));

  const assembly = mergeMeshIR(local, { id: 'cinder.magazine' });
  const centreY = D.receiverBottomY - 0.028 - halfLength;
  const placed = transformMesh(assembly, {
    rotation: rotationX(90 + M.rakeDeg),
    translation: [0, centreY, M.z]
  });

  return [
    placed,
    slab({
      width: 0.016, height: 0.011, depth: 0.010, chamfer: 0.002,
      at: [0, D.receiverBottomY - 0.022, M.z + M.depth / 2 + 0.008],
      name: 'magazine.catch',
      material: STEEL,
      region: REGION.MAGAZINE,
      surface: SURFACE.MECHANISM
    })
  ];
}


/**
 * Optic and its mount.
 *
 * @param {object} P
 * @param {number} railTopY
 * @returns {Array<object>} MeshIR pieces.
 */
function buildOptic(P, railTopY) {
  const O = P.optic;
  const out = [];

  const mountCentreY = railTopY + O.mountHeight / 2;
  const bodyCentreY = railTopY + O.mountHeight + O.bodyHeight / 2;

  out.push(prism({
    profile: taperedChamferProfile(O.mountWidth, O.mountHeight, 0.005, 0.008),
    depth: O.bodyLength * 0.80,
    at: [0, mountCentreY, O.z],
    name: 'optic.mount.base',
    material: STEEL_DARK,
    region: REGION.OPTIC,
    surface: SURFACE.STRUCTURE,
    anchors: [createAnchor({
      name: 'weapon.opticSocket',
      partId: 'optic.mount.base',
      position: [0, -O.mountHeight / 2, 0]
    })]
  }));

  out.push(...pair((sign, side) => slab({
    width: 0.006, height: O.mountHeight + 0.006, depth: 0.016, chamfer: 0.002,
    at: [sign * (O.mountWidth / 2 + 0.001), mountCentreY - 0.002, O.z - O.bodyLength * 0.28],
    name: `optic.mount.clamp.${side}`,
    material: STEEL,
    region: REGION.OPTIC,
    surface: SURFACE.MECHANISM
  })));

  for (let i = 0; i < O.screwCount; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    const z = O.z + (i < 2 ? 0.026 : -0.026);
    out.push(tubeX({
      radiusTop: 0.0038, length: 0.008, segments: 6,
      at: [sign * (O.mountWidth / 2 + 0.001), mountCentreY, z],
      name: `optic.mount.screw.${ix(i)}`,
      material: BRASS,
      region: REGION.OPTIC,
      surface: SURFACE.FASTENER
    }));
  }

  out.push(prism({
    profile: crownedProfile(O.bodyWidth, O.bodyHeight, 0.020),
    depth: O.bodyLength,
    at: [0, bodyCentreY, O.z],
    name: 'optic.body',
    material: STEEL_DARK,
    region: REGION.OPTIC,
    surface: SURFACE.STRUCTURE
  }));

  // The hood must stand PROUD of the lens as a shade ring, not swallow it.
  // Iteration 3 centred a 26 mm hood over a 6 mm lens sitting inside it, so
  // the emissive front lens — the asset's strongest single accent — was
  // completely hidden behind a rust-coloured block from every forward view.
  const hoodFrontZ = O.z - O.bodyLength / 2 - O.hoodLength + 0.004;
  out.push(prism({
    profile: polygonProfile(O.lensRadius + 0.0055, 10, 18),
    depth: O.hoodLength,
    at: [0, bodyCentreY, hoodFrontZ + O.hoodLength / 2],
    name: 'optic.hood',
    material: STEEL_DARK,
    region: REGION.OPTIC,
    surface: SURFACE.STRUCTURE
  }));

  out.push(prism({
    profile: polygonProfile(O.lensRadius, O.lensSegments, 0),
    depth: 0.006,
    at: [0, bodyCentreY, hoodFrontZ - 0.002],
    name: 'optic.lens.front',
    material: OPTIC_GLASS,
    region: REGION.OPTIC,
    surface: SURFACE.GLASS,
    anchors: [createAnchor({
      name: 'weapon.sightLine',
      partId: 'optic.lens.front',
      position: [0, 0, -0.003]
    })]
  }));

  out.push(prism({
    profile: polygonProfile(O.lensRadius * 0.84, O.lensSegments, 0),
    depth: 0.006,
    at: [0, bodyCentreY, O.z + O.bodyLength / 2 + 0.002],
    name: 'optic.lens.rear',
    material: OPTIC_GLASS,
    region: REGION.OPTIC,
    surface: SURFACE.GLASS
  }));

  out.push(tubeY({
    radiusTop: O.turretRadius * 0.86, radiusBottom: O.turretRadius, length: 0.014, segments: 10,
    at: [0, bodyCentreY + O.bodyHeight / 2 - 0.002, O.z - 0.008],
    name: 'optic.turret.top',
    material: STEEL,
    region: REGION.OPTIC,
    surface: SURFACE.MECHANISM
  }));

  out.push(tubeX({
    radiusTop: O.turretRadius * 0.90, radiusBottom: O.turretRadius, length: 0.013, segments: 10,
    at: [O.bodyWidth / 2 - 0.002, bodyCentreY, O.z - 0.008],
    name: 'optic.turret.side',
    material: STEEL,
    region: REGION.OPTIC,
    surface: SURFACE.MECHANISM
  }));

  out.push(slab({
    width: 0.016, height: 0.004, depth: 0.014, chamfer: 0.0012,
    at: [0, bodyCentreY + O.bodyHeight / 2 + 0.012, O.z - 0.008],
    name: 'optic.turret.cap',
    material: HAZARD,
    region: REGION.OPTIC,
    surface: SURFACE.HAZARD
  }));

  // Canted backup sight: deliberately off-axis, because a little asymmetry is
  // what keeps the top view from reading as a mirror diagram.
  out.push(slab({
    width: 0.006, height: 0.024, depth: 0.005, chamfer: 0.0012,
    at: [0.020, railTopY + 0.014, O.z + 0.090],
    rotation: rotationZ(-38),
    name: 'optic.backupSight',
    material: STEEL,
    region: REGION.OPTIC,
    surface: SURFACE.MECHANISM
  }));

  return out;
}

/**
 * Top rail and the discrete controls.
 *
 * @param {object} P
 * @param {number} deckTopY
 * @returns {Array<object>} MeshIR pieces.
 */
function buildRailAndControls(P, deckTopY) {
  const R = P.rail;
  const C = P.controls;
  const D = P.datum;
  const U = P.upper;
  const out = [];

  for (let i = 0; i < R.teeth; i++) {
    out.push(slab({
      width: R.width, height: R.height, depth: R.toothLength, chamfer: 0.0014,
      at: [0, deckTopY + R.height / 2, R.startZ - i * (R.toothLength + R.gap)],
      name: `rail.tooth.${ix(i)}`,
      material: STEEL,
      region: REGION.RAIL,
      surface: SURFACE.STRUCTURE
    }));
  }

  const upperCentreY = (P.lower.topY + D.receiverTopY) / 2;

  out.push(slab({
    width: C.chargingWidth, height: C.chargingHeight, depth: C.chargingLength, chamfer: 0.003,
    at: [U.width / 2 + C.chargingWidth / 2, upperCentreY + 0.008, C.chargingZ],
    name: 'control.charging.shaft',
    material: STEEL,
    region: REGION.CONTROLS,
    surface: SURFACE.MECHANISM
  }));

  out.push(prism({
    profile: wedgeProfile(0.012, 0.022, 0.007),
    depth: 0.009,
    at: [U.width / 2 + 0.018, upperCentreY + 0.008, C.chargingZ - C.chargingLength / 2 + 0.008],
    rotation: rotationY(90),
    name: 'control.charging.latch',
    material: STEEL_DARK,
    region: REGION.CONTROLS,
    surface: SURFACE.MECHANISM,
    anchors: [createAnchor({
      name: 'weapon.chargingHandle',
      partId: 'control.charging.latch',
      position: [0, 0, 0]
    })]
  }));

  out.push(tubeX({
    radiusTop: 0.0055, length: 0.014, segments: 8,
    at: [U.width / 2 + 0.013, upperCentreY + 0.008, C.chargingZ + C.chargingLength / 2 - 0.010],
    name: 'control.charging.knob',
    material: GRIP_RUBBER,
    region: REGION.CONTROLS,
    surface: SURFACE.HANDLING
  }));

  // Selector: a boss plus a lever, authored on both sides because the control
  // is ambidextrous and mirroring is refused by transformMesh.
  out.push(...pair((sign, side) => tubeX({
    radiusTop: C.selectorRadius, length: 0.006, segments: 10,
    at: [sign * (P.lower.width / 2 + 0.003) - (sign > 0 ? 0 : 0.006), -0.014, C.selectorZ],
    name: `control.selector.boss.${side}`,
    material: STEEL_DARK,
    region: REGION.CONTROLS,
    surface: SURFACE.MECHANISM
  })));

  out.push(...pair((sign, side) => slab({
    width: 0.005, height: 0.008, depth: 0.026, chamfer: 0.0015,
    at: [sign * (P.lower.width / 2 + 0.008), -0.014, C.selectorZ + 0.010],
    rotation: rotationX(28),
    name: `control.selector.lever.${side}`,
    material: STEEL,
    region: REGION.CONTROLS,
    surface: SURFACE.MECHANISM,
    anchors: side === 'L'
      ? [createAnchor({ name: 'weapon.selector', partId: 'control.selector.lever.L', position: [0, 0, 0] })]
      : []
  })));

  out.push(slab({
    width: 0.008, height: 0.010, depth: 0.010, chamfer: 0.002,
    at: [-(P.lower.width / 2 + 0.004), -0.010, 0.030],
    name: 'control.magRelease',
    material: STEEL,
    region: REGION.CONTROLS,
    surface: SURFACE.MECHANISM
  }));

  out.push(slab({
    width: 0.007, height: 0.014, depth: 0.016, chamfer: 0.002,
    at: [P.lower.width / 2 + 0.0035, -0.006, 0.046],
    name: 'control.boltRelease',
    material: STEEL_DARK,
    region: REGION.CONTROLS,
    surface: SURFACE.MECHANISM
  }));

  // Fasteners. Six-sided heads at a small radius read as hex bolts and cost
  // 20 triangles each.
  const fastenerSpots = [
    [P.lower.width / 2 + 0.001, -0.032, 0.190],
    [-(P.lower.width / 2 + 0.001), -0.032, 0.190],
    [P.lower.width / 2 + 0.001, -0.032, 0.086],
    [-(P.lower.width / 2 + 0.001), -0.032, 0.086],
    [P.handguard.width / 2 - 0.001, P.handguard.centreY - 0.024, P.handguard.frontZ + 0.028],
    [-(P.handguard.width / 2 - 0.001), P.handguard.centreY - 0.024, P.handguard.frontZ + 0.028]
  ];
  fastenerSpots.forEach((spot, i) => {
    const sign = spot[0] >= 0 ? 1 : -1;
    out.push(tubeX({
      radiusTop: C.fastenerRadius, length: 0.004, segments: C.fastenerSegments,
      at: [spot[0] - (sign > 0 ? 0 : 0.004), spot[1], spot[2]],
      name: `fastener.${ix(i)}`,
      material: BRASS,
      region: REGION.CONTROLS,
      surface: SURFACE.FASTENER
    }));
  });

  // Field repair and heat scarring. Deliberately ASYMMETRIC: up to here CINDER
  // is a mirror diagram about X, and a weapon that has been used should not be.
  // These are also the only parts whose placement is not derived from a datum,
  // because damage does not respect the design.
  out.push(slab({
    width: 0.005, height: 0.030, depth: 0.056, chamfer: 0.0035,
    at: [-(P.lower.width / 2 + 0.0026), -0.020, -0.018],
    name: 'wear.armourPlate',
    material: SCORCHED,
    region: REGION.RECEIVER,
    surface: SURFACE.STRUCTURE
  }));
  for (let i = 0; i < 3; i++) {
    out.push(tubeX({
      radiusTop: 0.0034, length: 0.004, segments: 6,
      at: [-(P.lower.width / 2 + 0.0062), -0.020 + (i - 1) * 0.011, -0.018 + (i - 1) * 0.019],
      name: `wear.armourPlate.rivet.${ix(i)}`,
      material: BRASS,
      region: REGION.RECEIVER,
      surface: SURFACE.FASTENER
    }));
  }

  const scorchSpots = [
    [P.handguard.width / 2 - 0.0008, P.handguard.centreY + 0.020, -0.112, 0.030, 0.024],
    [-(P.handguard.width / 2 - 0.0008), P.handguard.centreY - 0.018, -0.164, 0.022, 0.034],
    [P.upper.width / 2 - 0.0010, 0.040, 0.088, 0.016, 0.028]
  ];
  scorchSpots.forEach((spot, i) => {
    out.push(slab({
      width: 0.004, height: spot[3], depth: spot[4], chamfer: 0.0025,
      at: [spot[0], spot[1], spot[2]],
      name: `wear.scorch.${ix(i)}`,
      material: SCORCHED,
      region: REGION.THERMAL,
      surface: SURFACE.THERMAL
    }));
  });

  out.push(slab({
    width: 0.024, height: 0.010, depth: 0.012, chamfer: 0.003,
    at: [0, P.handguard.centreY - P.handguard.height / 2 - 0.004, P.handguard.frontZ + 0.022],
    name: 'handguard.slingMount',
    material: STEEL,
    region: REGION.HANDGUARD,
    surface: SURFACE.FASTENER,
    anchors: [createAnchor({
      name: 'weapon.slingFront',
      partId: 'handguard.slingMount',
      position: [0, -0.005, 0]
    })]
  }));

  return out;
}

/**
 * Builds CINDER MK-I.
 *
 * @param {object} [options]
 * @param {string} [options.id='cinder-mk1']
 * @returns {object} { meshIR, materials, anchors, generationMs, partCount }
 */
export function buildCinder({ id = 'cinder-mk1' } = {}) {
  const started = globalThis.performance?.now?.() ?? 0;
  const P = CINDER_PARAMETERS;

  const deckTopY = P.datum.receiverTopY + P.upper.deckHeight;
  const railTopY = deckTopY + P.rail.height;

  const pieces = [
    ...buildLowerReceiver(P),
    ...buildUpperReceiver(P),
    ...buildThermalCore(P),
    ...buildHandguard(P),
    ...buildBarrel(P),
    ...buildStock(P),
    ...buildGrip(P),
    ...buildMagazine(P),
    ...buildOptic(P, railTopY),
    ...buildRailAndControls(P, deckTopY)
  ];

  const meshIR = mergeMeshIR(pieces, { id });
  const generationMs = (globalThis.performance?.now?.() ?? 0) - started;

  return {
    meshIR,
    materials: createCinderMaterials(),
    anchors: meshIR.anchors,
    partCount: meshIR.parts.length,
    generationMs
  };
}
