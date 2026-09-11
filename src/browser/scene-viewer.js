/**
 * My Game Engine 1.0 — Scene Composition Viewer
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Human-visible and automation-driveable acceptance surface for
 * SCENE-COMPOSITION-001.
 *
 * This viewer is PRESENTATION. It composes nothing: it asks the engine for an
 * instantiated scene and shows what came back. Unload and reload are real —
 * they dispose the SceneInstance and its renderer objects and build new ones —
 * so what a human watches disappear and reappear is the same lifecycle a
 * future streaming system will drive.
 *
 * There is no permanent animation loop. Frames are rendered on demand, so an
 * idle page schedules nothing.
 */

import {
  Color, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer
} from 'three';
import { compileScene } from '../scene/compiler.js';
import { instantiateScene, liveSceneInstanceCount } from '../scene/instance.js';
import { createEntityManager } from '../runtime/entities.js';
import { createTransformManager } from '../runtime/transforms.js';
import { createScenePresentation, liveScenePresentationCount } from '../render/scene-presentation.js';
import { buildSubterraCell } from '../../examples/scenes/subterra-cell/scene.js';
import { buildAffineProbe } from '../../examples/scenes/affine-probe/scene.js';
import './scene.css';

/**
 * Scenes this viewer can show.
 *
 * `affineProbe` is a transform FIXTURE, not content. SUBTERRA authors no
 * scale and therefore cannot shear, so it cannot detect a renderer that
 * decomposes world placement back into translation/rotation/scale. The probe
 * can.
 */
const SCENE_BUILDERS = {
  subterra: buildSubterraCell,
  affineProbe: buildAffineProbe
};

const GROUND_COLOR = 0x14161a;

/**
 * Mounts the scene viewer.
 *
 * @param {HTMLElement} app - Mount point.
 * @param {object} [options]
 * @param {string} [options.scene='subterra']
 * @returns {object} Driveable handle, also published as window.__SCENE_LAB__.
 */
export function createSceneViewer(app, { scene: sceneKey = 'subterra' } = {}) {
  const builder = SCENE_BUILDERS[sceneKey];
  if (!builder) {
    throw new Error(`Unknown scene "${sceneKey}". Known scenes: ${Object.keys(SCENE_BUILDERS).join(', ')}`);
  }

  app.innerHTML = `
    <main class="scene-root">
      <div id="scene-stage" class="scene-stage"></div>
      <aside class="scene-panel">
        <header>
          <h1>Scene Composition</h1>
          <p class="scene-tranche">SCENE-COMPOSITION-001</p>
        </header>
        <dl id="scene-identity" class="scene-identity"></dl>
        <div class="scene-actions">
          <button id="scene-unload" type="button">Unload</button>
          <button id="scene-reload" type="button">Reload</button>
        </div>
        <p id="scene-lifecycle" class="scene-lifecycle"></p>
        <h2>Hierarchy</h2>
        <ol id="scene-tree" class="scene-tree"></ol>
      </aside>
    </main>`;

  const stage = app.querySelector('#scene-stage');
  const identityEl = app.querySelector('#scene-identity');
  const treeEl = app.querySelector('#scene-tree');
  const lifecycleEl = app.querySelector('#scene-lifecycle');

  // ---- Source and artifact are built ONCE. Unload/reload re-instantiates the
  // same immutable artifact, which is precisely the property under test.
  const { definition, assets, materials } = builder();
  const artifact = compileScene(definition);

  // THE RUNTIME WORLD OUTLIVES THE SCENE.
  //
  // This viewer owns one entity pool for the life of the page, and scenes are
  // loaded into it. That is the shape a real game has, and it is what makes
  // the reload evidence meaningful: a scene that instantiated into a fresh
  // pool every time would restart handle allocation and hand back the same
  // {index, generation} values, so "handles were renewed" would be true by
  // accident rather than by the generational invariant.
  const worldEntities = createEntityManager();
  const worldTransforms = createTransformManager(worldEntities);

  const surfaceWidth = () => Math.max(1, stage.clientWidth || 960);
  const surfaceHeight = () => Math.max(1, stage.clientHeight || 640);

  const renderScene = new Scene();
  renderScene.background = new Color(GROUND_COLOR);

  // Framed from just outside the cell's open end, looking down its length at
  // the door assembly. Chosen by inspecting real renders: an exterior
  // three-quarter view puts a wall between the camera and everything worth
  // seeing, which is exactly the kind of thing only a real render reveals.
  const camera = new PerspectiveCamera(52, surfaceWidth() / surfaceHeight(), 0.05, 200);
  camera.position.set(1.15, 1.95, 7.4);
  camera.lookAt(0, 1.3, -3.0);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setSize(surfaceWidth(), surfaceHeight());
  renderer.domElement.style.display = 'block';
  stage.appendChild(renderer.domElement);

  // Fixed inspection lighting, created once and never recreated by a reload.
  const hemi = new HemisphereLight(0xc9d6ff, 0x23262b, 1.15);
  const key = new DirectionalLight(0xffffff, 1.9);
  key.position.set(6, 9, 7);
  const fill = new DirectionalLight(0x9fb4d8, 0.7);
  fill.position.set(-7, 3, -5);
  const lightRig = new Group();
  lightRig.add(hemi, key, fill);
  renderScene.add(lightRig);

  let instance = null;
  let presentation = null;
  let disposed = false;
  let frameRequested = false;
  let lifecycleCycles = 0;

  /** Renders exactly one frame. There is no persistent animation loop. */
  function requestRender() {
    if (disposed || frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      if (disposed) return;
      renderer.render(renderScene, camera);
    });
  }

  function renderIdentity() {
    const loaded = instance !== null;
    identityEl.innerHTML = `
      <div><dt>Scene id</dt><dd>${artifact.id}</dd></div>
      <div><dt>Source hash</dt><dd><code>${artifact.sourceHash}</code></dd></div>
      <div><dt>Artifact hash</dt><dd><code>${artifact.artifactHash}</code></dd></div>
      <div><dt>Authored nodes</dt><dd>${artifact.nodeCount}</dd></div>
      <div><dt>Max depth</dt><dd>${artifact.maxDepth}</dd></div>
      <div><dt>Sheared nodes</dt><dd>${artifact.shearedNodeCount}</dd></div>
      <div><dt>Runtime entities</dt><dd>${loaded ? instance.size : 0}</dd></div>
      <div><dt>Renderer objects</dt><dd>${loaded ? presentation.objectCount : 0}</dd></div>
      <div><dt>Uploaded geometries</dt><dd>${loaded ? presentation.geometryCount : 0}</dd></div>
      <div><dt>State</dt><dd class="${loaded ? 'is-loaded' : 'is-unloaded'}">${loaded ? 'LOADED' : 'UNLOADED'}</dd></div>`;

    lifecycleEl.textContent = loaded
      ? `Live instances ${liveSceneInstanceCount()} · presentations ${liveScenePresentationCount()} · cycles ${lifecycleCycles}`
      : `Unloaded. Live instances ${liveSceneInstanceCount()} · presentations ${liveScenePresentationCount()} · cycles ${lifecycleCycles}`;
  }

  function renderTree() {
    if (!instance) {
      treeEl.innerHTML = '<li class="scene-empty">Scene unloaded. No runtime entities exist.</li>';
      return;
    }
    treeEl.innerHTML = instance.members().map((member) => {
      const handle = member.handle;
      const t = member.world.translation;
      return `<li class="scene-node" data-depth="${member.depth}" style="--depth:${member.depth}">
        <span class="scene-node-name">${member.name}</span>
        <span class="scene-node-pid">${member.pid}</span>
        <span class="scene-node-meta">handle ${handle.index}:${handle.generation} · world ${t.map((n) => n.toFixed(2)).join(', ')}</span>
      </li>`;
    }).join('');
  }

  function refresh() {
    renderIdentity();
    renderTree();
    requestRender();
  }

  /** Instantiates the artifact and builds its renderer representation. */
  function load() {
    if (disposed || instance) return;
    instance = instantiateScene(artifact, {
      entityManager: worldEntities,
      transformManager: worldTransforms
    });
    presentation = createScenePresentation({ instance, assets, materials });
    renderScene.add(presentation.root);
    refresh();
  }

  /** Disposes the instance and its renderer objects. The artifact survives. */
  function unload() {
    if (!instance) return;
    presentation.dispose();
    instance.dispose();
    presentation = null;
    instance = null;
    lifecycleCycles += 1;
    refresh();
  }

  function reload() {
    unload();
    load();
  }

  const onResize = () => {
    if (disposed) return;
    const w = surfaceWidth();
    const h = surfaceHeight();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    requestRender();
  };

  const unloadButton = app.querySelector('#scene-unload');
  const reloadButton = app.querySelector('#scene-reload');
  unloadButton.addEventListener('click', unload);
  reloadButton.addEventListener('click', reload);

  const observer = new ResizeObserver(onResize);
  observer.observe(stage);
  globalThis.addEventListener?.('resize', onResize);

  load();

  const handle = {
    sceneKey,
    artifact,
    definition,

    get loaded() {
      return instance !== null;
    },
    get instance() {
      return instance;
    },
    get presentation() {
      return presentation;
    },
    get disposed() {
      return disposed;
    },
    get frameScheduled() {
      return frameRequested;
    },
    get lifecycleCycles() {
      return lifecycleCycles;
    },

    /** Live counters, for leak evidence within one page. */
    get liveInstances() {
      return liveSceneInstanceCount();
    },

    /**
     * Entities alive in the shared runtime world.
     *
     * Must return to zero when the scene is unloaded: a scene that leaves
     * entities behind has not really been released, however empty the screen
     * looks.
     */
    get worldEntityCount() {
      return worldEntities.count();
    },
    get livePresentations() {
      return liveScenePresentationCount();
    },

    load,
    unload,
    reload,
    render: requestRender,
    resize: onResize,

    /**
     * Points the inspection camera somewhere else.
     *
     * Presentation only: the camera is not scene state and moving it changes
     * no identity, no transform and no runtime entity.
     *
     * @param {Array<number>} position - [x, y, z].
     * @param {Array<number>} [target=[0, 1.3, 0]] - Look-at point.
     */
    setCamera(position, target = [0, 1.3, 0]) {
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(target[0], target[1], target[2]);
      requestRender();
    },

    /** Scene identity, independent of any instantiation. */
    identity() {
      return {
        sceneId: artifact.id,
        sourceHash: artifact.sourceHash,
        artifactHash: artifact.artifactHash,
        nodeCount: artifact.nodeCount,
        maxDepth: artifact.maxDepth,
        shearedNodeCount: artifact.shearedNodeCount,
        artifactVersion: artifact.artifactVersion,
        roots: [...artifact.roots]
      };
    },

    /** Authored hierarchy paired with current runtime handles. */
    hierarchy() {
      if (!instance) return [];
      return instance.members().map((member) => ({
        pid: member.pid,
        name: member.name,
        parent: member.parent,
        depth: member.depth,
        asset: member.asset,
        handle: member.handle ? { index: member.handle.index, generation: member.handle.generation } : null,
        world: {
          // The matrix is authoritative; translation is read out of it. There
          // is no rotation or scale, because a sheared placement has none.
          matrix: [...member.world.matrix],
          translation: [...member.world.translation],
          sheared: member.world.sheared
        }
      }));
    },

    /** Renderer-side counts, for lifecycle evidence. */
    presentationStats() {
      return {
        objectCount: presentation ? presentation.objectCount : 0,
        geometryCount: presentation ? presentation.geometryCount : 0,
        materialCount: presentation ? presentation.materialCount : 0,
        unresolvedKeys: presentation ? presentation.unresolvedKeys : [],
        sceneChildren: renderScene.children.length,
        rootChildren: presentation ? presentation.root.children.length : 0
      };
    },

    getSurfaceSize() {
      return { width: surfaceWidth(), height: surfaceHeight() };
    },

    /**
     * Controlled acceptance proof for the evaluator.
     *
     * Exercises the real lifecycle rather than inspecting state: it records a
     * baseline, unloads, reloads, and checks that authored identity survived
     * while runtime identity did not, and that nothing accumulated.
     *
     * @returns {object} { success, checks, detail }
     */
    runProof() {
      const checks = {};
      const detail = {};

      try {
        if (!instance) load();

        const baseline = {
          nodes: instance.size,
          objects: presentation.objectCount,
          geometries: presentation.geometryCount,
          worldEntities: worldEntities.count(),
          instances: liveSceneInstanceCount(),
          presentations: liveScenePresentationCount()
        };
        detail.baseline = baseline;

        // Composition produced a real scene with real runtime entities.
        checks.sceneComposition =
          baseline.nodes === artifact.nodeCount &&
          baseline.nodes > 0 &&
          baseline.worldEntities === artifact.nodeCount;

        // Hierarchy is nested, rooted and complete.
        const members = instance.members();
        checks.sceneHierarchy =
          members.length === artifact.nodeCount &&
          artifact.roots.length > 0 &&
          artifact.maxDepth >= 2 &&
          members.every((m) => m.handle !== null) &&
          members.every((m) => m.parent === null || artifact.order.includes(m.parent));

        // A child of a transformed parent is NOT at its own local transform:
        // composition actually happened.
        const composed = members.filter((m) => m.parent !== null).some((m) => {
          const local = instance.localTransformOf(m.pid);
          return local.translation.some((v, i) => Math.abs(m.world.translation[i] - v) > 1e-9);
        });
        checks.sceneWorldTransforms = composed;
        detail.composedChildren = composed;

        // Every node with an asset reached the renderer, and repeats share.
        checks.scenePresentation =
          presentation.objectCount > 0 &&
          presentation.unresolvedKeys.length === 0 &&
          presentation.geometryCount < presentation.objectCount;
        detail.presentation = {
          objects: presentation.objectCount,
          geometries: presentation.geometryCount,
          materials: presentation.materialCount
        };

        const beforeHandles = members.map((m) => `${m.pid}@${m.handle.index}:${m.handle.generation}`);

        // ---- Unload -----------------------------------------------------
        unload();
        checks.sceneUnload =
          instance === null &&
          presentation === null &&
          worldEntities.count() === 0 &&
          liveSceneInstanceCount() === baseline.instances - 1 &&
          liveScenePresentationCount() === baseline.presentations - 1;
        detail.afterUnload = {
          worldEntities: worldEntities.count(),
          instances: liveSceneInstanceCount(),
          presentations: liveScenePresentationCount()
        };

        // ---- Reload -----------------------------------------------------
        load();
        const reloaded = instance.members();
        checks.sceneReloadIdentity =
          reloaded.length === artifact.nodeCount &&
          reloaded.every((m, i) => m.pid === artifact.order[i]) &&
          instance.sourceHash === artifact.sourceHash;

        const afterHandles = reloaded.map((m) => `${m.pid}@${m.handle.index}:${m.handle.generation}`);
        checks.sceneHandleRenewal = afterHandles.every((h, i) => h !== beforeHandles[i]);
        detail.handleSample = { before: beforeHandles[0], after: afterHandles[0] };

        // ---- Repeated cycles leak nothing --------------------------------
        for (let i = 0; i < 3; i++) reload();
        checks.sceneNoLeak =
          instance.size === baseline.nodes &&
          presentation.objectCount === baseline.objects &&
          presentation.geometryCount === baseline.geometries &&
          worldEntities.count() === baseline.worldEntities &&
          liveSceneInstanceCount() === baseline.instances &&
          liveScenePresentationCount() === baseline.presentations;
        detail.afterCycles = {
          nodes: instance.size,
          objects: presentation.objectCount,
          geometries: presentation.geometryCount,
          worldEntities: worldEntities.count(),
          instances: liveSceneInstanceCount(),
          presentations: liveScenePresentationCount(),
          cycles: lifecycleCycles
        };

        // NOTE: the absence of a permanent animation frame is deliberately NOT
        // checked here. Proving it requires awaiting two real frames, which a
        // synchronous proof cannot do, and a check that cannot fail is worse
        // than no check. tests/scene-browser.test.js asserts it properly.
        detail.frameScheduledDuringProof = frameRequested;

        detail.identity = {
          sceneId: artifact.id,
          sourceHash: artifact.sourceHash,
          artifactHash: artifact.artifactHash,
          nodeCount: artifact.nodeCount,
          maxDepth: artifact.maxDepth
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
          checks,
          detail
        };
      }

      return {
        success: Object.values(checks).every(Boolean),
        checks,
        detail,
        diagnosticsRecords: instance ? instance.getDiagnostics() : []
      };
    },

    /** Releases everything this viewer created. Repeated calls are safe. */
    dispose() {
      if (disposed) return;
      disposed = true;
      unloadButton.removeEventListener('click', unload);
      reloadButton.removeEventListener('click', reload);
      observer.disconnect();
      globalThis.removeEventListener?.('resize', onResize);

      if (presentation) presentation.dispose();
      if (instance) instance.dispose();
      presentation = null;
      instance = null;
      worldTransforms.clear();
      worldEntities.clear();

      renderScene.remove(lightRig);
      hemi.dispose?.();
      key.dispose?.();
      fill.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();

      if (globalThis.__SCENE_LAB__ === handle) delete globalThis.__SCENE_LAB__;
      app.replaceChildren();
    }
  };

  globalThis.__SCENE_LAB__ = handle;
  return handle;
}

/**
 * Disposes any live viewer and mounts a fresh one into the same page.
 *
 * Same-page recreation is the lifecycle a page reload cannot test.
 *
 * @param {HTMLElement} app
 * @param {object} [options]
 * @returns {object} New handle.
 */
export function recreateSceneViewer(app, options = {}) {
  const existing = globalThis.__SCENE_LAB__;
  if (existing && !existing.disposed) existing.dispose();
  return createSceneViewer(app, options);
}
