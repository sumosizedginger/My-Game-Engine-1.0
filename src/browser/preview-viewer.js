/**
 * My Game Engine 1.0 — Preview Lab Browser Route
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Mounts a generated asset in the human-visible Preview Lab and exposes a
 * driveable handle for automated canonical capture. Human and automated
 * evidence share one canonical view solver, so both see identical framing.
 */

import {
  createPreviewable,
  previewArtifact,
  createAssetPreviewManifest,
  planCanonicalCaptures,
  encodeManifest,
  manifestHash,
  structuralManifest,
  structuralManifestHash,
  encodeMesh,
  CANONICAL_VIEWS
} from '../full/index.js';
import { livePreviewLabCount } from '../preview/lab.js';

/** Assets reachable through this route. */
const ASSET_LOADERS = {
  cinder: async () => {
    const { buildCinder } = await import('../../examples/authoring/cinder-mk1/build.js');
    return { result: buildCinder(), label: 'CINDER MK-I' };
  }
};

/**
 * Mounts the Preview Lab for a named asset.
 *
 * @param {HTMLElement} root
 * @param {object} [options]
 * @param {string} [options.asset='cinder']
 * @returns {Promise<object>} Preview handle, also set on window.__PREVIEW_LAB__.
 */
export async function createPreviewViewer(root, { asset = 'cinder' } = {}) {
  const loader = ASSET_LOADERS[asset];
  if (!loader) throw new Error(`Unknown preview asset "${asset}"`);

  const { result, label } = await loader();

  // Neutralize the shared index.html centring flex layout, which would
  // otherwise size Preview Lab to its content and push the render surface
  // outside the viewport.
  document.documentElement.classList.add('preview-mode');
  document.body.classList.add('preview-mode');
  root.classList.add('preview-host');

  root.innerHTML = `
    <div class="preview-root">
      <header class="preview-header">
        <div>
          <span class="preview-title">Preview Lab</span>
          <span class="preview-asset">${label}</span>
        </div>
        <div class="preview-views" id="preview-views"></div>
      </header>
      <div class="preview-body">
        <div class="preview-stage" id="preview-stage"></div>
        <aside class="preview-inspector">
          <h3>Asset</h3>
          <dl id="preview-stats"></dl>
          <h3>Parts</h3>
          <table id="preview-parts"></table>
          <h3>Anchors</h3>
          <ul id="preview-anchors"></ul>
        </aside>
      </div>
    </div>
  `;

  const stage = root.querySelector('#preview-stage');

  const previewable = createPreviewable({
    mesh: result.meshIR,
    materials: result.materials,
    type: 'weapon',
    source: { definitionId: result.meshIR.id, seed: null },
    generationMs: result.generationMs
  });

  const lab = previewArtifact(previewable, { container: stage });

  // View buttons.
  const viewBar = root.querySelector('#preview-views');
  for (const view of CANONICAL_VIEWS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = view;
    button.textContent = view;
    button.addEventListener('click', () => {
      lab.setView(view);
      renderInspector();
    });
    viewBar.appendChild(button);
  }

  /**
   * Refreshes the inspector panel from measured values only.
   */
  function renderInspector() {
    const stats = lab.getStats();
    const dims = previewable.bounds.dimensions;
    root.querySelector('#preview-stats').innerHTML = [
      ['view', stats.view],
      ['triangles', stats.triangles],
      ['vertices', stats.vertices],
      ['parts', stats.parts],
      ['materials', stats.materials],
      ['draw calls', stats.drawCalls],
      ['dpr', stats.dpr],
      ['generation ms', stats.generationMs === null ? 'n/a' : stats.generationMs.toFixed(2)],
      ['last frame ms', stats.lastFrameMs === null ? 'n/a' : stats.lastFrameMs.toFixed(2)],
      ['size m', dims.map((d) => d.toFixed(3)).join(' x ')]
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    root.querySelector('#preview-parts').innerHTML =
      '<tr><th>part</th><th>tris</th><th>size m</th></tr>' +
      lab.getParts().map((p) =>
        `<tr><td>${p.semanticName}</td><td>${p.triangleCount}</td>` +
        `<td>${p.dimensions.map((d) => d.toFixed(3)).join(' x ')}</td></tr>`
      ).join('');

    root.querySelector('#preview-anchors').innerHTML = previewable.anchors.map((a) =>
      `<li><code>${a.name}</code> ${a.position.map((n) => n.toFixed(3)).join(', ')}</li>`
    ).join('');
  }

  // The view bar was added after the lab mounted, which changes the header
  // height and therefore the stage box. Re-measure before anything reads the
  // surface size.
  lab.resize();

  renderInspector();

  // Plan captures from the MEASURED render surface, so the recorded camera
  // aspect always matches the pixels the capture path actually reads back.
  const surface = lab.getSurfaceSize();
  const captures = planCanonicalCaptures(previewable, {
    aspect: surface.width / surface.height
  }).map((camera) => ({
    name: camera.name,
    cameraPosition: camera.position,
    cameraTarget: camera.target,
    up: camera.up,
    fovDeg: camera.fovDeg,
    aspect: camera.aspect,
    projectedBoundsOccupancy: camera.projectedBoundsOccupancy,
    viewport: { width: surface.width, height: surface.height }
  }));

  const manifest = createAssetPreviewManifest(previewable, { captures });

  const handle = {
    asset,
    label,
    lab,
    previewable,
    manifest,
    manifestJson: encodeManifest(manifest),
    manifestHash: manifestHash(manifest),
    // PORTABLE asset identity. The full manifest carries the observation —
    // camera pose, aspect, viewport — all of which move with the browser
    // window. Only this hash is comparable across machines and window sizes.
    structuralJson: encodeManifest(structuralManifest(manifest)),
    structuralHash: structuralManifestHash(manifest),
    meshHash: previewable.source.meshHash,
    views: CANONICAL_VIEWS,

    /**
     * Snaps to a canonical view and refreshes the inspector.
     *
     * @param {string} view
     */
    setView(view) {
      lab.setView(view);
      renderInspector();
    },

    getStats: () => lab.getStats(),
    getParts: () => lab.getParts(),
    getLighting: () => lab.getLighting(),

    /** Lights currently in the scene. Re-aiming the rig must not grow this. */
    get lightCount() {
      return lab.lightCount;
    },

    getDiagnostics: () => [...previewable.diagnostics, ...lab.getDiagnostics()],

    /** Live Preview Lab instances. Must return to zero after dispose. */
    get liveLabs() {
      return livePreviewLabCount();
    },

    /**
     * Canonical MeshIR bytes as hex, for the cross-runtime determinism probe.
     * Computed on demand: only a divergence investigation needs the payload.
     *
     * @returns {string}
     */
    getMeshBytesHex() {
      const bytes = encodeMesh(result.meshIR);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
      return out;
    },

    get meshByteLength() {
      return encodeMesh(result.meshIR).length;
    },

    get frameScheduled() {
      return lab.frameScheduled;
    },

    get disposed() {
      return lab.disposed && previewable.disposed;
    },

    dispose() {
      lab.dispose();
      previewable.dispose();
    }
  };

  window.__PREVIEW_LAB__ = handle;
  return handle;
}

/**
 * Disposes the mounted preview and builds a fresh one in the SAME page.
 *
 * Lifecycle correctness has to be provable without a reload. A reload discards
 * the entire JavaScript world, so it proves only that the page can boot twice —
 * it cannot show whether dispose released listeners, canvases and GPU
 * resources. Repeated in-page cycles can.
 *
 * @param {HTMLElement} root
 * @param {object} [options]
 * @returns {Promise<object>} The new preview handle.
 */
export async function recreatePreviewViewer(root, options = {}) {
  const existing = window.__PREVIEW_LAB__;
  if (existing && !existing.disposed) {
    existing.dispose();
  }
  window.__PREVIEW_LAB__ = null;
  root.classList.remove('preview-host');
  root.innerHTML = '';
  return createPreviewViewer(root, options);
}
