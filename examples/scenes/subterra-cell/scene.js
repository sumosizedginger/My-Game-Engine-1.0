/**
 * SUBTERRA CELL — Scene Composition
 * Forcing consumer for SCENE-COMPOSITION-001.
 *
 * A bounded constructed underground service cell. Its job is not to be
 * beautiful; its job is to put pressure on the scene model:
 *
 *   - four levels of hierarchy, authored because the space is built that way
 *     rather than to inflate a test count;
 *   - assemblies whose children are placed in the PARENT's frame, so a rotated
 *     or offset parent visibly carries its children with it;
 *   - repeated assets at different placements, proving a scene composes
 *     instances rather than owning geometry;
 *   - a door leaf nested inside a door assembly inside the cell, so world
 *     transform composition has to survive three multiplications.
 *
 * Everything is authored through the public engine surface. Nothing is
 * imported, downloaded or generated outside the engine.
 *
 * Hierarchy:
 *
 *   subterra.cell
 *    +- architecture
 *    |   +- floor, ceiling, wall.left, wall.right, wall.end
 *    +- doorway                (rotated assembly at the end wall)
 *    |   +- frame.left, frame.right, frame.header
 *    |   +- door.leaf          (child of the doorway, not of the cell)
 *    +- lighting
 *    |   +- fixture.a  -> housing, lamp
 *    |   +- fixture.b  -> housing, lamp
 *    +- services
 *    |   +- conduit    -> pipe, bracket.fore, bracket.aft
 *    |   +- return     -> pipe, bracket.fore, bracket.aft
 *    +- structure
 *    |   +- column.left, column.right
 *    +- props
 *        +- console    -> body, screen
 *        +- crate.a, crate.b
 */

import { createSceneDefinition, createSceneNode } from '@sumosizedginger/my-game-engine-1.0/full';
import { CELL, rotationY, createSubterraAssets, createSubterraMaterials } from './assets.js';

/** Scene identity. Stable: it is part of the scene's source identity. */
export const SUBTERRA_CELL_ID = 'subterra.cell.v1';

const HALF_W = CELL.width / 2;
const HALF_L = CELL.length / 2;

/**
 * Builds the SUBTERRA cell scene definition.
 *
 * Node transforms are LOCAL — relative to the parent — throughout. A child of
 * `doorway` is positioned in the doorway's frame, so moving or rotating the
 * doorway moves the whole assembly. That is the property this cell exists to
 * prove.
 *
 * @param {object} [options]
 * @param {string} [options.id] - Override the scene id.
 * @returns {object} SceneDefinition.
 */
export function buildSubterraCellDefinition({ id = SUBTERRA_CELL_ID } = {}) {
  const nodes = [];
  const node = (pid, name, parent, transform, extra = {}) => {
    nodes.push(createSceneNode({ pid, name, parent, transform, ...extra }));
  };

  // ---- Root -------------------------------------------------------------
  node('cell', 'Subterra Service Cell', null, {});

  // ---- Architecture -----------------------------------------------------
  node('architecture', 'Cell Shell', 'cell', {}, { tags: ['group', 'shell'] });

  node('floor', 'Floor Slab', 'architecture',
    { translation: [0, -CELL.slabThickness / 2, 0] },
    { asset: 'floor.slab', tags: ['walkable', 'shell'] });

  node('ceiling', 'Ceiling Panel', 'architecture',
    { translation: [0, CELL.height, 0] },
    { asset: 'ceiling.panel', tags: ['shell'] });

  node('wall.left', 'Left Wall', 'architecture',
    { translation: [-HALF_W - CELL.wallThickness / 2, CELL.height / 2, 0] },
    { asset: 'wall.panel', tags: ['shell', 'collider'] });

  // The right wall is the same asset rotated a half turn, so its band and
  // studs face into the room. One asset, two placements.
  node('wall.right', 'Right Wall', 'architecture',
    {
      translation: [HALF_W + CELL.wallThickness / 2, CELL.height / 2, 0],
      rotation: rotationY(Math.PI)
    },
    { asset: 'wall.panel', tags: ['shell', 'collider'] });

  node('wall.end', 'End Bulkhead', 'architecture',
    { translation: [0, CELL.height / 2, -HALF_L - CELL.wallThickness / 2] },
    { asset: 'wall.end', tags: ['shell', 'collider'] });

  // ---- Door assembly ----------------------------------------------------
  // The whole doorway is one assembly placed once. Its children know nothing
  // about where the end wall is.
  node('doorway', 'Doorway Assembly', 'cell',
    { translation: [0, 1.15, -HALF_L + 0.05] },
    { tags: ['group', 'access'] });

  node('doorway.frame.left', 'Frame Post Left', 'doorway',
    { translation: [-0.78, 0, 0] },
    { asset: 'frame.post', tags: ['access'] });

  node('doorway.frame.right', 'Frame Post Right', 'doorway',
    { translation: [0.78, 0, 0] },
    { asset: 'frame.post', tags: ['access'] });

  node('doorway.frame.header', 'Frame Header', 'doorway',
    { translation: [0, 1.26, 0] },
    { asset: 'frame.header', tags: ['access'] });

  // Depth three from the root, and swung ajar so a validator can see that a
  // child rotation composes with its parent rather than replacing it.
  node('doorway.leaf', 'Blast Door Leaf', 'doorway',
    { translation: [-0.34, -0.1, 0.22], rotation: rotationY(-0.55) },
    { asset: 'door.leaf', tags: ['access', 'interactive'] });

  // ---- Lighting ---------------------------------------------------------
  node('lighting', 'Lighting Runs', 'cell', {}, { tags: ['group', 'lighting'] });

  for (const [suffix, z] of [['a', -2.4], ['b', 2.4]]) {
    node(`lighting.fixture.${suffix}`, `Service Fixture ${suffix.toUpperCase()}`, 'lighting',
      { translation: [0, CELL.height - 0.42, z] },
      { tags: ['lighting'] });

    node(`lighting.fixture.${suffix}.housing`, `Fixture ${suffix.toUpperCase()} Housing`,
      `lighting.fixture.${suffix}`, {},
      { asset: 'fixture.housing', tags: ['lighting'] });

    // Sits below its own housing, in the housing's parent frame.
    node(`lighting.fixture.${suffix}.lamp`, `Fixture ${suffix.toUpperCase()} Lamp`,
      `lighting.fixture.${suffix}`,
      { translation: [0, -0.1, 0] },
      { asset: 'fixture.lamp', tags: ['lighting', 'emissive'] });
  }

  // ---- Services ---------------------------------------------------------
  node('services', 'Service Conduits', 'cell', {}, { tags: ['group', 'services'] });

  node('services.conduit', 'Primary Conduit', 'services',
    { translation: [-HALF_W + 0.55, CELL.height - 0.66, 0] },
    { tags: ['services'] });

  node('services.conduit.pipe', 'Conduit Pipe', 'services.conduit', {},
    { asset: 'pipe.run', tags: ['services'] });

  node('services.conduit.bracket.fore', 'Conduit Bracket Fore', 'services.conduit',
    { translation: [-0.2, 0.2, -2.6] },
    { asset: 'bracket', tags: ['services'] });

  node('services.conduit.bracket.aft', 'Conduit Bracket Aft', 'services.conduit',
    { translation: [-0.2, 0.2, 2.6] },
    { asset: 'bracket', tags: ['services'] });

  // A second run down the opposite wall, lower and mirrored. A service cell
  // with exactly one conduit would not need a grouping node at all, and a
  // group wrapping a single child is hierarchy for its own sake.
  node('services.return', 'Return Conduit', 'services',
    { translation: [HALF_W - 0.55, CELL.height - 1.15, 0], rotation: rotationY(Math.PI) },
    { tags: ['services'] });

  node('services.return.pipe', 'Return Pipe', 'services.return', {},
    { asset: 'pipe.run', tags: ['services'] });

  node('services.return.bracket.fore', 'Return Bracket Fore', 'services.return',
    { translation: [-0.2, 0.2, -1.7] },
    { asset: 'bracket', tags: ['services'] });

  node('services.return.bracket.aft', 'Return Bracket Aft', 'services.return',
    { translation: [-0.2, 0.2, 1.7] },
    { asset: 'bracket', tags: ['services'] });

  // ---- Structure --------------------------------------------------------
  node('structure', 'Support Structure', 'cell', {}, { tags: ['group', 'structure'] });

  node('structure.column.left', 'Support Column Left', 'structure',
    { translation: [-HALF_W + 0.95, CELL.height / 2 - 0.2, 1.1] },
    { asset: 'column', tags: ['structure', 'collider'] });

  node('structure.column.right', 'Support Column Right', 'structure',
    { translation: [HALF_W - 0.95, CELL.height / 2 - 0.2, 1.1] },
    { asset: 'column', tags: ['structure', 'collider'] });

  // ---- Props ------------------------------------------------------------
  node('props', 'Cell Props', 'cell', {}, { tags: ['group', 'props'] });

  node('props.console', 'Operations Console', 'props',
    { translation: [HALF_W - 1.15, 0.92, -1.6], rotation: rotationY(-Math.PI / 2) },
    { tags: ['props', 'interactive'] });

  node('props.console.body', 'Console Body', 'props.console', {},
    { asset: 'console.body', tags: ['props'] });

  // Rotated and raised within the console's own frame: the screen tilts back
  // relative to the desk, and the whole thing then turns with the console.
  // Seated so the bezel meets the desk surface rather than hovering above it.
  node('props.console.screen', 'Console Display', 'props.console',
    { translation: [0, 0.37, -0.15], rotation: [Math.sin(-0.16), 0, 0, Math.cos(-0.16)] },
    { asset: 'console.screen', tags: ['props', 'emissive'] });

  node('props.crate.a', 'Supply Crate A', 'props',
    { translation: [-HALF_W + 1.0, 0.3, 3.1], rotation: rotationY(0.24) },
    { asset: 'crate', tags: ['props', 'collider'] });

  // Stacked squarely on crate A: its body base meets A's lid, so the pair
  // reads as stacked rather than hovering.
  node('props.crate.b', 'Supply Crate B', 'props',
    { translation: [-HALF_W + 1.02, 0.98, 3.14], rotation: rotationY(-0.12) },
    { asset: 'crate', tags: ['props', 'collider'] });

  return createSceneDefinition({ id, nodes });
}

/**
 * Builds the definition together with everything a presentation layer needs to
 * show it.
 *
 * The scene and the assets are returned SEPARATELY on purpose. The definition
 * is renderer-independent data; the asset library is the presentation-side
 * resolution of its opaque keys. Keeping them apart is the contract.
 *
 * @param {object} [options]
 * @returns {{ definition: object, assets: Map<string, object>, materials: Array<object> }}
 */
export function buildSubterraCell(options = {}) {
  return {
    definition: buildSubterraCellDefinition(options),
    assets: createSubterraAssets(),
    materials: createSubterraMaterials()
  };
}
