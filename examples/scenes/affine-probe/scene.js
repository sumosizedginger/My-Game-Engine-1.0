/**
 * AFFINE PROBE — transform fixture for SCENE-COMPOSITION-001 repair R1.
 *
 * A deliberately minimal scene whose only job is to exercise transform
 * combinations SUBTERRA does not contain. SUBTERRA authors no scale at all, so
 * it can never shear, and a renderer that silently decomposed world placement
 * back into translation/rotation/scale would still look perfectly correct
 * there. This fixture makes that failure visible.
 *
 * It contains the validator's exact reproduction plus a genuinely sheared
 * branch:
 *
 *   probe
 *    +- repro                     scale [2, 1, 1]
 *    |   +- repro.turn            rotation 90 degrees about Z
 *    |       +- repro.marker      translation [1, 0, 0]   -> world [0, 1, 0]
 *    +- shear                     scale [2, 1, 1]
 *    |   +- shear.turn            rotation 45 degrees about Z   -> SHEARED
 *    |       +- shear.block
 *    +- control                   rotation 45 degrees about Z
 *        +- control.scale         scale [2, 1, 1]                -> not sheared
 *            +- control.block
 *
 * `shear` and `control` author the SAME two operations in opposite nesting
 * order. Only one of them shears, which is the whole point: order matters, and
 * an independent-TRS model cannot tell them apart.
 *
 * This is a test fixture, not content. It is not part of the SUBTERRA
 * environment and adds no scene capability.
 */

import {
  createSceneDefinition,
  createSceneNode,
  createBoxMesh,
  createMaterialDefinition
} from '@sumosizedginger/my-game-engine-1.0/full';

/** Scene identity. */
export const AFFINE_PROBE_ID = 'affine.probe.v1';

const rotZ = (radians) => [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];

/**
 * Builds the probe definition.
 *
 * @param {object} [options]
 * @param {string} [options.id]
 * @returns {object} SceneDefinition.
 */
export function buildAffineProbeDefinition({ id = AFFINE_PROBE_ID } = {}) {
  const nodes = [];
  const node = (pid, name, parent, transform, extra = {}) => {
    nodes.push(createSceneNode({ pid, name, parent, transform, ...extra }));
  };

  node('probe', 'Affine Probe', null, {});

  // ---- The validator's reproduction -------------------------------------
  node('repro', 'Repro Root', 'probe',
    { translation: [-2.5, 0, 0], scale: [2, 1, 1] }, { tags: ['repro'] });
  node('repro.turn', 'Repro Turn', 'repro',
    { rotation: rotZ(Math.PI / 2) }, { tags: ['repro'] });
  node('repro.marker', 'Repro Marker', 'repro.turn',
    { translation: [1, 0, 0] }, { asset: 'marker', tags: ['repro'] });

  // ---- Non-uniform scale ABOVE a non-axis-aligned rotation: shears -------
  node('shear', 'Shear Root', 'probe',
    { scale: [2, 1, 1] }, { tags: ['shear'] });
  node('shear.turn', 'Shear Turn', 'shear',
    { rotation: rotZ(Math.PI / 4) }, { tags: ['shear'] });
  node('shear.block', 'Sheared Block', 'shear.turn',
    {}, { asset: 'block', tags: ['shear'] });

  // ---- The same two operations, nested the other way: does NOT shear -----
  node('control', 'Control Root', 'probe',
    { translation: [2.5, 0, 0], rotation: rotZ(Math.PI / 4) }, { tags: ['control'] });
  node('control.scale', 'Control Scale', 'control',
    { scale: [2, 1, 1] }, { tags: ['control'] });
  node('control.block', 'Control Block', 'control.scale',
    {}, { asset: 'block', tags: ['control'] });

  return createSceneDefinition({ id, nodes });
}

/**
 * Builds the probe with everything a presentation layer needs.
 *
 * @param {object} [options]
 * @returns {{ definition: object, assets: Map<string, object>, materials: Array<object> }}
 */
export function buildAffineProbe(options = {}) {
  const block = createBoxMesh({
    width: 1, height: 1, depth: 1,
    semanticName: 'probe.block', materialId: 'probe.surface'
  });
  const marker = createBoxMesh({
    width: 0.25, height: 0.25, depth: 0.25,
    semanticName: 'probe.marker', materialId: 'probe.marker'
  });

  return {
    definition: buildAffineProbeDefinition(options),
    assets: new Map([['block', block], ['marker', marker]]),
    materials: [
      createMaterialDefinition({
        id: 'probe.surface',
        name: 'Affine probe surface',
        parameters: { color: 0x7f8ea3, roughness: 0.6, metalness: 0.05 }
      }),
      createMaterialDefinition({
        id: 'probe.marker',
        name: 'Affine probe marker',
        parameters: {
          color: 0xffb347, roughness: 0.4, metalness: 0.0,
          emissive: 0xff7a1a, emissiveIntensity: 1.4
        }
      })
    ]
  };
}
