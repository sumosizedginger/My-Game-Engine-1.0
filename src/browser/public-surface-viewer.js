/**
 * My Game Engine 1.0 — Public Surface Acceptance Viewer
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Browser acceptance for PUBLIC-SURFACE-001.
 *
 * The cell it mounts imports the engine through the PACKAGE SPECIFIER
 * `@sumosizedginger/my-game-engine-1.0/full`. Node resolving that is one
 * thing; a bundler resolving it is another, and only this route proves the
 * second. If Vite could not resolve the package self-reference, this page
 * would fail to load at all.
 *
 * It renders the generated results so the proof is that the generation
 * actually REACHED the browser, not merely that a module imported. It is not a
 * visual benchmark and makes no attempt to be beautiful.
 *
 * Frames are rendered on demand. An idle page schedules nothing.
 */

import {
  AmbientLight, Color, DirectionalLight, Group, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Scene, WebGLRenderer
} from 'three';
import { buildPublicSurfaceCell } from '../../examples/public-surface-cell/cell.js';
import './public-surface.css';

/**
 * Mounts the acceptance viewer.
 *
 * @param {HTMLElement} app - Mount point.
 * @param {object} [options]
 * @param {number} [options.seed]
 * @returns {object} Driveable handle, also published as window.__PUBLIC_SURFACE__.
 */
export function createPublicSurfaceViewer(app, { seed } = {}) {
  app.innerHTML = `
    <main class="ps-root">
      <div id="ps-stage" class="ps-stage"></div>
      <aside class="ps-panel">
        <header>
          <h1>Public Surface</h1>
          <p class="ps-tranche">PUBLIC-SURFACE-001</p>
        </header>
        <p class="ps-note">Every capability below was reached through
          <code>@sumosizedginger/my-game-engine-1.0/full</code>.</p>
        <dl id="ps-identity" class="ps-identity"></dl>
        <h2>Forges</h2>
        <ol id="ps-forges" class="ps-forges"></ol>
      </aside>
    </main>`;

  const stage = app.querySelector('#ps-stage');
  const identityEl = app.querySelector('#ps-identity');
  const forgesEl = app.querySelector('#ps-forges');

  const cell = buildPublicSurfaceCell(seed === undefined ? {} : { seed });

  const width = () => Math.max(1, stage.clientWidth || 900);
  const height = () => Math.max(1, stage.clientHeight || 620);

  const scene = new Scene();
  scene.background = new Color(0x0f1216);

  const camera = new PerspectiveCamera(48, width() / height(), 0.1, 400);
  camera.position.set(cell.clearing.x + 11, cell.clearing.y + 7.5, cell.clearing.z + 13);
  camera.lookAt(cell.clearing.x, cell.clearing.y + 1, cell.clearing.z);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height());
  renderer.domElement.style.display = 'block';
  stage.appendChild(renderer.domElement);

  scene.add(new AmbientLight(0x8fa4c4, 1.1));
  const key = new DirectionalLight(0xffffff, 2.0);
  key.position.set(24, 40, 18);
  scene.add(key);

  // ---- Present what the Forges generated --------------------------------
  // The viewer OWNS only the materials it creates here. The geometries belong
  // to the cell, which disposes them.
  const presented = new Group();
  presented.name = 'public-surface-results';
  const viewerMaterials = [];

  const terrainMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  viewerMaterials.push(terrainMaterial);
  presented.add(new Mesh(cell.world.terrain, terrainMaterial));

  const roomMaterial = new MeshStandardMaterial({ color: 0x8d95a3, roughness: 0.8, metalness: 0.05 });
  viewerMaterials.push(roomMaterial);
  const roomMesh = new Mesh(cell.room.visual.geometry, roomMaterial);
  roomMesh.position.set(cell.clearing.x, cell.clearing.y, cell.clearing.z);
  presented.add(roomMesh);

  // The character arrives fully built, with its own material from the Forge.
  const occupant = cell.character.mesh;
  occupant.position.set(
    cell.rootTransform.position.x,
    cell.clearing.y,
    cell.rootTransform.position.z
  );
  presented.add(occupant);

  scene.add(presented);

  let disposed = false;
  let frameRequested = false;

  function requestRender() {
    if (disposed || frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      frameRequested = false;
      if (disposed) return;
      renderer.render(scene, camera);
    });
  }

  function renderPanel() {
    const byForge = Object.fromEntries(cell.report.steps.map((s) => [s.forge, s]));
    identityEl.innerHTML = `
      <div><dt>Cell identity</dt><dd><code>${cell.identity}</code></dd></div>
      <div><dt>Seed</dt><dd>${cell.seed}</dd></div>
      <div><dt>Scene source</dt><dd><code>${cell.sceneArtifact.sourceHash}</code></dd></div>
      <div><dt>Diagnostics</dt><dd>${cell.report.diagnostics.length}</dd></div>`;

    forgesEl.innerHTML = [
      ['World Forge', `${byForge.world.trees} trees · ${byForge.world.groundCover} ground cover · field ${byForge.world.fieldHash}`],
      ['Geometry Forge', `${byForge.geometry.preset} · ${byForge.geometry.triangles} triangles · walkable ${byForge.geometry.centreWalkable}`],
      ['Character Forge', `${byForge.character.preset} · ${byForge.character.bones} bones · ${byForge.character.landmarkCount} landmarks`],
      ['Motion Forge', `${byForge.motion.preset} · travelled ${byForge.motion.travelledMetres} m · IK ${byForge.motion.ikFlexionDegrees}°`],
      ['Scene', `${byForge.scene.nodes} nodes · depth ${byForge.scene.maxDepth}`]
    ].map(([name, detail]) => `<li class="ps-forge">
        <span class="ps-forge-name">${name}</span>
        <span class="ps-forge-detail">${detail}</span>
      </li>`).join('');
  }

  const onResize = () => {
    if (disposed) return;
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
    requestRender();
  };

  const observer = new ResizeObserver(onResize);
  observer.observe(stage);
  globalThis.addEventListener?.('resize', onResize);

  renderPanel();
  requestRender();

  const handle = {
    cell,

    get disposed() {
      return disposed;
    },
    get frameScheduled() {
      return frameRequested;
    },

    /** Everything the page can prove, in one serializable record. */
    report() {
      return {
        identity: cell.identity,
        seed: cell.seed,
        steps: cell.report.steps,
        diagnostics: cell.report.diagnostics.length,
        sceneSourceHash: cell.sceneArtifact.sourceHash,
        sceneArtifactHash: cell.sceneArtifact.artifactHash,
        presentedObjects: presented.children.length,
        sceneChildren: scene.children.length
      };
    },

    /** Proof that the package route, not a repository path, supplied these. */
    resolvedThroughPackage() {
      return cell.report.steps.map((s) => s.forge);
    },

    render: requestRender,
    resize: onResize,

    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      globalThis.removeEventListener?.('resize', onResize);

      scene.remove(presented);
      presented.clear();
      for (const material of viewerMaterials) material.dispose();
      // The cell owns the Forge outputs and disposes them.
      cell.dispose();

      renderer.dispose();
      renderer.domElement.remove();
      if (globalThis.__PUBLIC_SURFACE__ === handle) delete globalThis.__PUBLIC_SURFACE__;
      app.replaceChildren();
    }
  };

  globalThis.__PUBLIC_SURFACE__ = handle;
  return handle;
}

/**
 * Disposes any live viewer and mounts a fresh one into the same page.
 *
 * @param {HTMLElement} app
 * @param {object} [options]
 * @returns {object} New handle.
 */
export function recreatePublicSurfaceViewer(app, options = {}) {
  const existing = globalThis.__PUBLIC_SURFACE__;
  if (existing && !existing.disposed) existing.dispose();
  return createPublicSurfaceViewer(app, options);
}
