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
  createCinderMaterials,
  chamferedRectProfile,
  taperedProfile
} from './definition.js';

const STEEL = 'cinder.steel';
const POLYMER = 'cinder.polymer';
const GRIP = 'cinder.grip';
const OPTIC = 'cinder.optic';

/** Barrel axis height above the receiver centreline, metres. */
const BARREL_AXIS_Y = 0.014;

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
 * Builds CINDER MK-I.
 *
 * @param {object} [options]
 * @param {string} [options.id='cinder-mk1']
 * @returns {object} { meshIR, materials, anchors, generationMs, partCount }
 */
export function buildCinder({ id = 'cinder-mk1' } = {}) {
  const started = globalThis.performance?.now?.() ?? 0;
  const P = CINDER_PARAMETERS;
  const pieces = [];

  // --- Receiver: the spine everything else registers against. ---
  const receiverFrontZ = P.receiver.rearZ - P.receiver.length;
  pieces.push(extrudeProfile({
    profile: chamferedRectProfile(P.receiver.width, P.receiver.height, 0.011),
    distance: P.receiver.length,
    origin: { x: 0, y: 0, z: receiverFrontZ },
    semanticName: 'receiver',
    materialId: STEEL
  }));

  // --- Barrel: cylinders are built along +Y from their base, so a forward
  // --- facing barrel is a -90 degree rotation about X (+Y becomes -Z).
  const barrelTipLocalY = P.barrel.length;
  pieces.push(transformMesh(
    createCylinderMesh({
      radiusTop: P.barrel.radius,
      radiusBottom: P.barrel.radius * 1.12,
      height: P.barrel.length,
      radialSegments: P.barrel.segments,
      semanticName: 'barrel',
      materialId: STEEL,
      anchors: [createAnchor({
        name: 'weapon.barrel.tip',
        partId: 'barrel',
        position: [0, barrelTipLocalY, 0]
      })]
    }),
    { rotation: rotationX(-90), translation: [0, BARREL_AXIS_Y, receiverFrontZ] }
  ));

  const muzzleZ = receiverFrontZ - P.barrel.length;
  pieces.push(transformMesh(
    createCylinderMesh({
      radiusTop: P.muzzleBrake.radius * 0.92,
      radiusBottom: P.muzzleBrake.radius,
      height: P.muzzleBrake.length,
      radialSegments: P.muzzleBrake.segments,
      semanticName: 'muzzleBrake',
      materialId: STEEL,
      anchors: [createAnchor({
        name: 'weapon.muzzle',
        partId: 'muzzleBrake',
        position: [0, P.muzzleBrake.length, 0]
      })]
    }),
    { rotation: rotationX(-90), translation: [0, BARREL_AXIS_Y, muzzleZ] }
  ));

  // --- Handguard: wraps the barrel. Extrusions always run along +Z with a
  // --- positive distance; the far end is placed via origin.z.
  pieces.push(extrudeProfile({
    profile: chamferedRectProfile(P.handguard.width, P.handguard.height, 0.013),
    distance: P.handguard.length,
    origin: { x: 0, y: BARREL_AXIS_Y, z: receiverFrontZ - P.handguard.length },
    semanticName: 'handguard',
    materialId: POLYMER,
    anchors: [createAnchor({
      name: 'weapon.grip.L',
      partId: 'handguard',
      position: [0, BARREL_AXIS_Y - P.handguard.height / 2, receiverFrontZ - P.handguard.length * 0.55]
    })]
  }));

  // --- Stock. ---
  pieces.push(extrudeProfile({
    profile: taperedProfile(P.stock.width * 0.78, P.stock.width, P.stock.height),
    distance: P.stock.length,
    origin: { x: 0, y: -0.004, z: P.receiver.rearZ },
    semanticName: 'stock',
    materialId: POLYMER,
    anchors: [createAnchor({
      name: 'weapon.stock.buttPlate',
      partId: 'stock',
      position: [0, -0.004, P.receiver.rearZ + P.stock.length]
    })]
  }));

  // --- Grip: extruded along +Z, then rotated so +Z points down, plus rake. ---
  pieces.push(transformMesh(
    extrudeProfile({
      profile: taperedProfile(P.grip.width, P.grip.width * 0.88, P.grip.depth),
      distance: P.grip.length,
      semanticName: 'grip',
      materialId: GRIP,
      anchors: [createAnchor({
        name: 'weapon.grip.R',
        partId: 'grip',
        position: [0, 0, P.grip.length * 0.45]
      })]
    }),
    { rotation: rotationX(90 + P.grip.rakeDeg), translation: [0, -P.receiver.height / 2, 0.075] }
  ));

  // --- Magazine. ---
  pieces.push(transformMesh(
    extrudeProfile({
      profile: taperedProfile(P.magazine.depth, P.magazine.depth * 0.86, P.magazine.width * 2.1),
      distance: P.magazine.length,
      semanticName: 'magazine',
      materialId: POLYMER,
      anchors: [createAnchor({
        name: 'weapon.magazineSocket',
        partId: 'magazine',
        position: [0, 0, 0]
      })]
    }),
    { rotation: rotationX(90 + P.magazine.rakeDeg), translation: [0, -P.receiver.height / 2, -0.012] }
  ));

  // --- Picatinny rail: one geometry, repeated by transform. This is the
  // --- repetition pattern SUBTERRA will need at environment scale.
  const railTopY = P.receiver.height / 2;
  const railStartZ = 0.14;
  for (let i = 0; i < P.rail.teeth; i++) {
    pieces.push(createBoxMesh({
      width: P.rail.width,
      height: P.rail.height,
      depth: P.rail.toothLength,
      origin: {
        x: 0,
        y: railTopY + P.rail.height / 2,
        z: railStartZ - i * (P.rail.toothLength + P.rail.gap)
      },
      semanticName: `rail.tooth.${String(i).padStart(2, '0')}`,
      materialId: STEEL
    }));
  }

  // --- Optic. ---
  const opticBaseY = railTopY + P.rail.height;
  pieces.push(createBoxMesh({
    width: P.optic.bodyWidth,
    height: P.optic.bodyHeight,
    depth: P.optic.bodyLength,
    origin: { x: 0, y: opticBaseY + P.optic.bodyHeight / 2, z: 0.105 },
    semanticName: 'optic.body',
    materialId: STEEL,
    anchors: [createAnchor({
      name: 'weapon.opticSocket',
      partId: 'optic.body',
      position: [0, opticBaseY, 0.105]
    })]
  }));

  pieces.push(transformMesh(
    createCylinderMesh({
      radiusTop: P.optic.tubeRadius,
      radiusBottom: P.optic.tubeRadius,
      height: P.optic.bodyLength * 0.82,
      radialSegments: P.optic.tubeSegments,
      semanticName: 'optic.tube',
      materialId: OPTIC,
      anchors: [createAnchor({
        name: 'weapon.sightLine',
        partId: 'optic.tube',
        position: [0, P.optic.bodyLength * 0.82, 0]
      })]
    }),
    {
      rotation: rotationX(-90),
      translation: [0, opticBaseY + P.optic.bodyHeight + P.optic.tubeRadius * 0.72, 0.145]
    }
  ));

  // --- Charging handle. ---
  pieces.push(createBoxMesh({
    width: P.chargingHandle.width,
    height: P.chargingHandle.height,
    depth: P.chargingHandle.length,
    origin: { x: P.receiver.width / 2 + P.chargingHandle.width / 2, y: 0.026, z: 0.188 },
    semanticName: 'chargingHandle',
    materialId: STEEL,
    anchors: [createAnchor({
      name: 'weapon.chargingHandle',
      partId: 'chargingHandle',
      position: [P.receiver.width / 2 + P.chargingHandle.width, 0.026, 0.188]
    })]
  }));

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
