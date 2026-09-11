/**
 * CINDER MK-I — Definition
 *
 * A fictional hard-surface hero weapon, authored entirely through My Game
 * Engine 1.0's public authoring surface. No DCC, no imported mesh, no
 * pre-generated geometry.
 *
 * CINDER is a forcing consumer for AI-ASSET-FOUNDATION-001, not engine content
 * and not a new Proof. It lives outside src/ deliberately: it exercises the
 * public package export exactly as an external consumer would.
 *
 * Conventions: metres, +Y up, -Z forward. The muzzle points toward -Z.
 *
 * ---------------------------------------------------------------------------
 * MATERIAL NOTE — why nothing here is strongly metallic
 * ---------------------------------------------------------------------------
 * The preview scene lights the asset with a hemisphere light and two
 * directional lights and provides NO environment map. A MeshStandardMaterial
 * at high metalness has almost no diffuse response and relies on the
 * environment for its specular, so `metalness: 0.92` renders as near-black
 * regardless of base colour. CINDER MK-I's first iteration set exactly that
 * and the result was an unreadable silhouette.
 *
 * Until the surface system can express image-based lighting, metal is
 * approximated with LOW metalness and a raised, slightly blue-grey albedo.
 * This is a deliberate, recorded workaround for a material-system limitation,
 * not an art preference. See the capability-pressure report.
 */

import { createMaterialDefinition } from '@sumosizedginger/my-game-engine-1.0/full';

/**
 * Per-vertex semantic region identity. Regions group parts into the assemblies
 * a consumer reasons about (damage, attachment, disassembly) rather than into
 * the pieces the modeller happened to author.
 */
export const REGION = Object.freeze({
  RECEIVER: 1,
  BARREL: 2,
  HANDGUARD: 3,
  STOCK: 4,
  GRIP: 5,
  MAGAZINE: 6,
  OPTIC: 7,
  THERMAL: 8,
  CONTROLS: 9,
  RAIL: 10
});

/**
 * Per-vertex semantic surface identity. Surfaces describe what a face IS to a
 * consumer — something gripped, something structural, something that glows —
 * independently of which material happens to be bound to it today.
 */
export const SURFACE = Object.freeze({
  STRUCTURE: 1,
  HANDLING: 2,
  MECHANISM: 3,
  GLASS: 4,
  EMISSIVE: 5,
  HAZARD: 6,
  FASTENER: 7,
  THERMAL: 8
});

/**
 * Geometric parameters. Every dimension is metres.
 * Kept as data so an authoring agent can revise numbers rather than code.
 *
 * The Z axis runs rear (+Z) to front (-Z):
 *
 *   +0.545 .... +0.255 | +0.255 .... -0.045 | -0.045 .... -0.345 | .... -0.470
 *        stock         |      receiver      |     handguard      |  barrel/muzzle
 */
export const CINDER_PARAMETERS = Object.freeze({
  /** Datum planes shared by every assembly, so nothing floats by accident. */
  datum: Object.freeze({
    receiverRearZ: 0.255,
    receiverFrontZ: -0.045,
    receiverTopY: 0.056,
    receiverBottomY: -0.050,
    /** Bore axis height above the receiver centreline. */
    boreY: 0.020,
    /** Top face of the flat-top rail the optic clamps to. */
    railTopY: 0.0645
  }),

  lower: Object.freeze({
    width: 0.060, height: 0.056, topY: 0.006,
    plateProud: 0.0035, plateHeight: 0.034,
    magwellLength: 0.086, magwellFlare: 0.009, magwellZ: 0.012,
    guardBowWidth: 0.017, guardBowDepth: 0.074, guardDrop: 0.050
  }),

  upper: Object.freeze({
    width: 0.066, height: 0.050,
    deckWidth: 0.034, deckHeight: 0.009,
    flankInset: 0.012, flankHeight: 0.030,
    portWidth: 0.008, portHeight: 0.026, portLength: 0.060, portZ: 0.055,
    ventCount: 5, ventLength: 0.0085, ventGap: 0.006, ventZ: 0.170
  }),

  thermal: Object.freeze({
    z: -0.058, length: 0.052, radius: 0.036,
    finCount: 6, finThickness: 0.0058, finRadius: 0.0385,
    coreRadius: 0.0175, collarRadius: 0.0255
  }),

  handguard: Object.freeze({
    frontZ: -0.345, rearZ: -0.084,
    width: 0.066, height: 0.072, centreY: 0.016,
    topDeckWidth: 0.034, topDeckHeight: 0.008,
    ribCount: 5, ribThickness: 0.0075, ribProud: 0.0035,
    ventCount: 6, ventLength: 0.0175, ventGap: 0.0085, ventHeight: 0.020,
    railTeeth: 6, foregripZ: -0.246, foregripLength: 0.086, foregripRakeDeg: 20,
    cableSegments: 4
  }),

  barrel: Object.freeze({
    radius: 0.0125, segments: 22,
    exposedFrontZ: -0.418,
    gasBlockZ: -0.362, gasBlockWidth: 0.034, gasBlockHeight: 0.036, gasBlockLength: 0.040,
    fluteCount: 6, fluteWidth: 0.0042, fluteLength: 0.060
  }),

  muzzle: Object.freeze({
    bodyLength: 0.054, bodyRadius: 0.0262, segments: 20,
    prongCount: 3, prongLength: 0.032, prongWidth: 0.020, prongSplayDeg: 6,
    portCount: 4, crownRadius: 0.0278
  }),

  stock: Object.freeze({
    rearZ: 0.545, spineHeight: 0.032, spineWidth: 0.044,
    upperY: 0.034, lowerY: -0.030,
    trussCount: 3,
    combLength: 0.150, combHeight: 0.026, combZ: 0.330,
    buttHeight: 0.112, buttWidth: 0.044, buttThickness: 0.016,
    padRibs: 4
  }),

  grip: Object.freeze({
    z: 0.120, length: 0.112, width: 0.038, depth: 0.058, rakeDeg: 19,
    strapThickness: 0.0055, panelProud: 0.0028, fingerCount: 3
  }),

  magazine: Object.freeze({
    z: -0.006, length: 0.188, width: 0.032, depth: 0.062, rakeDeg: 7,
    ribCount: 4, ribProud: 0.0017, floorHeight: 0.012
  }),

  optic: Object.freeze({
    z: 0.118, bodyLength: 0.104, bodyWidth: 0.042, bodyHeight: 0.032,
    mountHeight: 0.020, mountWidth: 0.050,
    lensRadius: 0.0205, lensSegments: 22,
    hoodLength: 0.026, turretRadius: 0.011, screwCount: 4
  }),

  rail: Object.freeze({
    teeth: 11, toothLength: 0.0105, gap: 0.0072, width: 0.024, height: 0.0055,
    startZ: 0.232
  }),

  controls: Object.freeze({
    chargingZ: 0.196, chargingLength: 0.070, chargingWidth: 0.014, chargingHeight: 0.013,
    selectorZ: 0.072, selectorRadius: 0.0105,
    fastenerRadius: 0.0042, fastenerSegments: 6
  })
});

/**
 * Twelve material families. Few families, strongly separated in VALUE, is what
 * makes a hard-surface asset read; many families that are all the same
 * darkness is what makes it read as one blob. Iteration zero used four
 * families spanning 0x16181c..0x4a4f57 — a value range so narrow that the
 * whole weapon silhouetted as a single shape.
 *
 * Authored through Material Forge. CINDER does not construct renderer
 * materials itself.
 *
 * @returns {Array<object>} MaterialDefinitions.
 */
export function createCinderMaterials() {
  return [
    createMaterialDefinition({
      id: 'cinder.steel',
      name: 'CINDER machined steel',
      parameters: { color: 0x9aa2ad, roughness: 0.40, metalness: 0.34 }
    }),
    createMaterialDefinition({
      id: 'cinder.steelDark',
      name: 'CINDER structural steel',
      parameters: { color: 0x5f6773, roughness: 0.53, metalness: 0.28 }
    }),
    createMaterialDefinition({
      id: 'cinder.polymer',
      name: 'CINDER polymer',
      parameters: { color: 0x282c33, roughness: 0.86, metalness: 0.03 }
    }),
    createMaterialDefinition({
      id: 'cinder.polymerLight',
      name: 'CINDER polymer panel',
      parameters: { color: 0x525a66, roughness: 0.80, metalness: 0.04 }
    }),
    createMaterialDefinition({
      id: 'cinder.grip',
      name: 'CINDER grip rubber',
      parameters: { color: 0x1d2126, roughness: 0.96, metalness: 0.02 }
    }),
    createMaterialDefinition({
      id: 'cinder.scorched',
      name: 'CINDER scorched alloy',
      parameters: { color: 0x463a34, roughness: 0.70, metalness: 0.22 }
    }),
    createMaterialDefinition({
      // Openings. With no boolean operation a vent cannot be cut, so it is
      // faked with a plate bracketed by proud frames — and that only reads if
      // the plate is dark enough to pass for shadow. Scorched alloy was used
      // first and the handguard came back looking rusty rather than vented.
      id: 'cinder.void',
      name: 'CINDER shadow void',
      parameters: { color: 0x15171a, roughness: 0.95, metalness: 0.00 }
    }),
    createMaterialDefinition({
      id: 'cinder.brass',
      name: 'CINDER brass hardware',
      parameters: { color: 0xb9884a, roughness: 0.36, metalness: 0.44 }
    }),
    createMaterialDefinition({
      id: 'cinder.hazard',
      name: 'CINDER hazard marking',
      parameters: { color: 0xd96a20, roughness: 0.60, metalness: 0.05 }
    }),
    createMaterialDefinition({
      id: 'cinder.ember',
      name: 'CINDER thermal core',
      parameters: { color: 0xff6a26, roughness: 0.44, metalness: 0.00, emissive: 0xff4a10, emissiveIntensity: 2.6 }
    }),
    createMaterialDefinition({
      id: 'cinder.emberDim',
      name: 'CINDER thermal bleed',
      parameters: { color: 0x8c3a14, roughness: 0.62, metalness: 0.04, emissive: 0x7a2c0a, emissiveIntensity: 1.1 }
    }),
    createMaterialDefinition({
      id: 'cinder.optic',
      name: 'CINDER optic glass',
      parameters: { color: 0x3d7f9e, roughness: 0.14, metalness: 0.30, emissive: 0x1e6f96, emissiveIntensity: 1.7 }
    }),
    createMaterialDefinition({
      id: 'cinder.status',
      name: 'CINDER status indicator',
      parameters: { color: 0x7fe4ff, roughness: 0.30, metalness: 0.00, emissive: 0x35c4ff, emissiveIntensity: 2.2 }
    })
  ];
}

// ---------------------------------------------------------------------------
// PROFILE LIBRARY
//
// extrudeProfile caps with a triangle fan and therefore REQUIRES a convex
// profile. Every generator below returns a convex, counter-clockwise polygon.
// Concave forms (the trigger guard, the skeletal stock, the ejection port
// surround) are composed from several convex prisms instead, which is what the
// operation's own constraint text recommends.
//
// Chamfered profiles are the single most valuable technique available in this
// vocabulary: with no bevel operation, generating the chamfer directly into
// the profile is exact rather than approximated, and it is what stops every
// form reading as a raw box.
// ---------------------------------------------------------------------------

/**
 * Rounded rectangular profile in the XY plane, counter-clockwise.
 *
 * Corners are chamfered rather than filleted: with no bevel operation
 * available in this tranche, chamfer corners are generated directly into the
 * profile, which is correct rather than approximated.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} chamfer
 * @returns {Array<number[]>} Convex profile.
 */
export function chamferedRectProfile(width, height, chamfer) {
  const hw = width / 2;
  const hh = height / 2;
  const c = Math.min(chamfer, hw * 0.9, hh * 0.9);
  return [
    [-hw + c, -hh], [hw - c, -hh],
    [hw, -hh + c], [hw, hh - c],
    [hw - c, hh], [-hw + c, hh],
    [-hw, hh - c], [-hw, -hh + c]
  ];
}

/**
 * Rectangular profile whose top and bottom chamfers differ. Asymmetric
 * chamfers are what make a section read as "manufactured with a top and a
 * bottom" rather than as an extruded blank.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} topChamfer
 * @param {number} bottomChamfer
 * @returns {Array<number[]>} Convex profile.
 */
export function taperedChamferProfile(width, height, topChamfer, bottomChamfer) {
  const hw = width / 2;
  const hh = height / 2;
  const t = Math.min(topChamfer, hw * 0.85, hh * 0.85);
  const b = Math.min(bottomChamfer, hw * 0.85, hh * 0.85);
  return [
    [-hw + b, -hh], [hw - b, -hh],
    [hw, -hh + b], [hw, hh - t],
    [hw - t, hh], [-hw + t, hh],
    [-hw, hh - t], [-hw, -hh + b]
  ];
}

/**
 * Trapezoidal profile, used for the magazine and stock where the silhouette
 * should taper.
 *
 * @param {number} topWidth
 * @param {number} bottomWidth
 * @param {number} height
 * @returns {Array<number[]>} Convex profile.
 */
export function taperedProfile(topWidth, bottomWidth, height) {
  const ht = topWidth / 2;
  const hb = bottomWidth / 2;
  const hh = height / 2;
  return [[-hb, -hh], [hb, -hh], [ht, hh], [-ht, hh]];
}

/**
 * Trapezoid with chamfered corners. The magazine and grip use this so their
 * edges catch light the same way the machined sections do.
 *
 * @param {number} topWidth
 * @param {number} bottomWidth
 * @param {number} height
 * @param {number} chamfer
 * @returns {Array<number[]>} Convex profile.
 */
export function chamferedTaperProfile(topWidth, bottomWidth, height, chamfer) {
  const ht = topWidth / 2;
  const hb = bottomWidth / 2;
  const hh = height / 2;
  const c = Math.min(chamfer, ht * 0.7, hb * 0.7, hh * 0.35);
  return [
    [-hb + c, -hh], [hb - c, -hh],
    [hb, -hh + c], [ht, hh - c],
    [ht - c, hh], [-ht + c, hh],
    [-ht, hh - c], [-hb, -hh + c]
  ];
}

/**
 * Genuinely rounded rectangular profile.
 *
 * A chamfer is one flat per corner; this is `cornerSegments` flats per corner,
 * which is the difference between a machined edge and a MOULDED one. Grips,
 * magazines and butt pads are moulded polymer, and at 8 sides they read as
 * boxes no matter how the materials are tuned.
 *
 * This is where the absence of a bevel operation costs the most: the radius
 * has to be designed into the profile up front, so it cannot follow an edge
 * that emerges from combining several forms.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @param {number} [cornerSegments=3] - Flats per corner. 3 gives 16 points.
 * @returns {Array<number[]>} Convex profile, counter-clockwise.
 */
export function roundedRectProfile(width, height, radius, cornerSegments = 3) {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.95, hh * 0.95);
  const corners = [
    [hw - r, -hh + r, -90],
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, 90],
    [-hw + r, -hh + r, 180]
  ];
  const points = [];
  for (const [cx, cy, startDeg] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const angle = ((startDeg + (i * 90) / cornerSegments) * Math.PI) / 180;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  return points;
}

/**
 * Rounded rectangle whose width tapers from bottom to top.
 *
 * The taper is applied as a per-point scale in X that varies linearly with Y.
 * That is not an affine map, so convexity is not guaranteed for an extreme
 * taper — but extrudeProfile refuses a non-convex cap outright rather than
 * emitting wrong geometry, so an over-aggressive taper fails loudly at build
 * time instead of producing a quietly broken mesh.
 *
 * @param {number} topWidth
 * @param {number} bottomWidth
 * @param {number} height
 * @param {number} radius
 * @param {number} [cornerSegments=3]
 * @returns {Array<number[]>} Convex profile for mild tapers.
 */
export function roundedTaperProfile(topWidth, bottomWidth, height, radius, cornerSegments = 3) {
  const mean = (topWidth + bottomWidth) / 2;
  const half = height / 2;
  return roundedRectProfile(mean, height, radius, cornerSegments).map(([x, y]) => {
    const t = (y + half) / height;
    const target = bottomWidth + (topWidth - bottomWidth) * t;
    return [x * (target / mean), y];
  });
}

/**
 * Regular polygon profile. Used for the thermal housing, fastener heads and
 * anywhere a faceted round section reads better than a smooth one.
 *
 * @param {number} radius
 * @param {number} sides - Minimum 3.
 * @param {number} [phaseDeg=0] - Rotation of the first vertex, degrees.
 * @returns {Array<number[]>} Convex profile.
 */
export function polygonProfile(radius, sides, phaseDeg = 0) {
  const n = Math.max(3, Math.round(sides));
  const phase = (phaseDeg * Math.PI) / 180;
  const points = [];
  for (let i = 0; i < n; i++) {
    const angle = phase + (i * 2 * Math.PI) / n;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

/**
 * Section with a flat bottom and a chamfered, domed top. The handguard and
 * upper receiver use it so the weapon has a readable "spine" from every angle
 * instead of a flat lid.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} crownWidth - Width of the flat at the very top.
 * @returns {Array<number[]>} Convex profile.
 */
export function crownedProfile(width, height, crownWidth) {
  const hw = width / 2;
  const hh = height / 2;
  const hc = Math.min(crownWidth, width * 0.94) / 2;
  const shoulder = hh * 0.34;
  const c = Math.min(hw * 0.24, hh * 0.20);
  return [
    [-hw + c, -hh], [hw - c, -hh],
    [hw, -hh + c], [hw, shoulder],
    [hc, hh], [-hc, hh],
    [-hw, shoulder], [-hw, -hh + c]
  ];
}

/**
 * Right-leaning wedge. Used for brass deflectors, muzzle prongs and the
 * angled struts that keep the stock from reading as a solid block.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} skew - Horizontal offset of the top edge, metres.
 * @returns {Array<number[]>} Convex profile.
 */
export function wedgeProfile(width, height, skew) {
  const hw = width / 2;
  const hh = height / 2;
  return [[-hw, -hh], [hw, -hh], [hw + skew, hh], [-hw + skew, hh]];
}
