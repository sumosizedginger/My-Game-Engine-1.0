/**
 * My Game Engine 1.0 — Minimal Preview Lab
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * The human must be able to SEE anything the AI generated. Compilation success
 * is not visual acceptance.
 *
 * This is NOT a DCC editor. It views, inspects and reports. There is no scene
 * graph editing, no material editing and no gizmos.
 *
 * Safety rules that are not optional:
 *   - a static asset runs NO permanent requestAnimationFrame loop; frames are
 *     rendered on demand for init, camera change, resize and view change;
 *   - device pixel ratio is bounded;
 *   - every owned resource is disposed explicitly.
 *
 * Camera framing comes from the shared canonical view solver, so the human and
 * the evaluation capture path see identically framed geometry.
 */

import {
  Scene, Color, PerspectiveCamera, WebGLRenderer,
  HemisphereLight, DirectionalLight, Vector3
} from 'three';
import {
  CANONICAL_VIEWS, solveCanonicalView, boundingRadius,
  INSPECTION_RIG, inspectionLightFrame
} from './views.js';
import { PREVIEW_BUDGET_DEFAULTS, resolveDevicePixelRatio } from './budget.js';

/**
 * Neutral studio ground for canonical inspection.
 *
 * Deliberately mid-tone: silhouette contrast must hold for dark and light
 * assets alike, because capture legibility is the evidence quality the whole
 * feedback loop depends on.
 */
export const PREVIEW_GROUND_COLOR = 0x6f757d;

/**
 * Number of Preview Lab instances currently holding resources and listeners.
 *
 * Repeated create/dispose cycles must return this to zero. A page reload proves
 * nothing about lifecycle correctness — it discards the whole JavaScript world
 * — so this counter is the evidence that dispose actually released what create
 * acquired, within one page.
 */
let liveLabs = 0;

/**
 * @returns {number} Live Preview Lab instances.
 */
export function livePreviewLabCount() {
  return liveLabs;
}

/**
 * Mounts a Previewable into a container element.
 *
 * The Previewable is NOT owned by the lab: the caller disposes it. The lab
 * disposes only the renderer, lights and scene resources it created itself.
 *
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.previewable
 * @param {object} [options.budget=PREVIEW_BUDGET_DEFAULTS]
 * @param {string} [options.initialView='threeQuarter']
 * @returns {object} Preview Lab handle.
 */
export function createPreviewLab({
  container,
  previewable,
  budget = PREVIEW_BUDGET_DEFAULTS,
  initialView = 'threeQuarter'
}) {
  if (!container) throw new TypeError('createPreviewLab requires a container element');
  if (!previewable) throw new TypeError('createPreviewLab requires a previewable');

  /**
   * Measures the container. Rounded down so the canvas can never exceed its
   * box and force the page to overflow.
   *
   * @returns {{width: number, height: number}}
   */
  function measureContainer() {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width || container.clientWidth || 960)),
      height: Math.max(1, Math.floor(rect.height || container.clientHeight || 640))
    };
  }

  const { width, height } = measureContainer();

  const scene = new Scene();
  // Neutral mid-tone studio ground. A dark ground hides dark assets: the side
  // view of a gunmetal-and-polymer asset became nearly indistinguishable from
  // the background, which fails the Visual Feedback Law for both human and AI
  // inspection. Mid-neutral gives silhouette contrast against dark AND light
  // assets, and is a harness decision rather than an art-direction one.
  scene.background = new Color(PREVIEW_GROUND_COLOR);

  const camera = new PerspectiveCamera(35, width / height, 0.01, 100);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  // DPR is explicit safe degradation, not refusal. Both the requested and the
  // effective value are reported, with a diagnostic when a clamp occurred.
  const dprResolution = resolveDevicePixelRatio(globalThis.devicePixelRatio || 1, budget);
  const dpr = dprResolution.effectiveDpr;
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height);
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  // Inspection lighting is CAMERA-RELATIVE, not world-fixed.
  //
  // Fixed world lights at (3,5,4) and (-4,2,-3) meant a view facing toward the
  // key returned bright evidence and a view facing away returned dark evidence,
  // for the same asset. Half the canonical captures were systematically less
  // legible than the other half and nothing in the manifest said so, which is a
  // harness defect rather than a property of any asset.
  //
  // The rig is now defined in view space (see INSPECTION_RIG) and re-aimed
  // whenever the canonical view changes. The light OBJECTS are created once
  // here and only ever re-aimed, so switching views can never accumulate
  // lights, and disposal has a fixed set to clean up.
  const hemi = new HemisphereLight(
    INSPECTION_RIG.hemisphere.sky,
    INSPECTION_RIG.hemisphere.ground,
    INSPECTION_RIG.hemisphere.intensity
  );
  const rigLights = INSPECTION_RIG.lights.map((spec) => {
    const light = new DirectionalLight(spec.color, spec.intensity);
    light.name = `inspection.${spec.name}`;
    // A directional light aims at its target object. The asset centre is not
    // the world origin, so the default target would skew every light.
    light.target.position.set(...previewable.bounds.center);
    return light;
  });

  scene.add(hemi, previewable.object3D);
  for (const light of rigLights) scene.add(light, light.target);

  /** Distance at which rig lights are parked. Directional, so only aim matters. */
  const rigRadius = Math.max(boundingRadius(previewable.bounds) * 4, 1);

  /**
   * Re-aims the rig for a solved canonical camera.
   *
   * Mutates the existing lights; never creates or removes any.
   *
   * @param {object} cameraRecord
   */
  function aimInspectionLights(cameraRecord) {
    const frame = inspectionLightFrame(cameraRecord);
    const [cx, cy, cz] = previewable.bounds.center;
    frame.lights.forEach((light, index) => {
      const target = rigLights[index];
      if (!target) return;
      target.position.set(
        cx + light.direction[0] * rigRadius,
        cy + light.direction[1] * rigRadius,
        cz + light.direction[2] * rigRadius
      );
    });
  }

  let disposed = false;
  let frameRequested = false;
  let currentView = initialView;
  let orbitYaw = 0;
  let orbitPitch = 0;
  let zoomFactor = 1;
  let lastFrameMs = null;

  const target = new Vector3(...previewable.bounds.center);
  /** View options shared by every solve, so framing and axes never diverge. */
  const viewOptions = () => ({
    upAxis: previewable.mesh.upAxis,
    forwardAxis: previewable.mesh.forwardAxis
  });

  let baseCamera = solveCanonicalView(currentView, previewable.bounds, {
    ...viewOptions(),
    aspect: width / height
  });
  aimInspectionLights(baseCamera);

  /**
   * Positions the camera from the canonical solve plus orbit and zoom offsets.
   */
  function applyCamera() {
    const offset = new Vector3(
      baseCamera.position[0] - baseCamera.target[0],
      baseCamera.position[1] - baseCamera.target[1],
      baseCamera.position[2] - baseCamera.target[2]
    );
    const radius = offset.length() * zoomFactor;
    const basePitch = Math.asin(Math.max(-1, Math.min(1, offset.y / (offset.length() || 1))));
    const baseYaw = Math.atan2(offset.x, offset.z);

    const yaw = baseYaw + orbitYaw;
    const pitch = Math.max(-1.5, Math.min(1.5, basePitch + orbitPitch));

    camera.position.set(
      target.x + radius * Math.cos(pitch) * Math.sin(yaw),
      target.y + radius * Math.sin(pitch),
      target.z + radius * Math.cos(pitch) * Math.cos(yaw)
    );
    camera.up.set(...baseCamera.up);
    camera.lookAt(target);
    // Depth range from the asset's own extent, so orbiting and zooming keep
    // the whole asset inside the frustum without clipping near geometry.
    const assetRadius = boundingRadius(previewable.bounds) || radius * 0.1;
    camera.near = Math.max(radius - assetRadius * 2, radius / 10000);
    camera.far = radius + assetRadius * 4;
    camera.updateProjectionMatrix();
  }

  /**
   * Renders exactly one frame. There is no persistent animation loop.
   */
  function renderFrame() {
    frameRequested = false;
    if (disposed) return;
    const started = globalThis.performance?.now?.() ?? 0;
    applyCamera();
    renderer.render(scene, camera);
    lastFrameMs = (globalThis.performance?.now?.() ?? 0) - started;
  }

  /**
   * Schedules a single frame. Repeated calls within one frame coalesce.
   */
  function requestRender() {
    if (disposed || frameRequested) return;
    frameRequested = true;
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(renderFrame);
    } else {
      renderFrame();
    }
  }

  // Pointer orbit.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging) return;
    orbitYaw -= (event.clientX - lastX) * 0.01;
    orbitPitch += (event.clientY - lastY) * 0.01;
    lastX = event.clientX;
    lastY = event.clientY;
    requestRender();
  };
  const onPointerUp = (event) => {
    dragging = false;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  };
  const onWheel = (event) => {
    event.preventDefault();
    zoomFactor = Math.max(0.2, Math.min(5, zoomFactor * (event.deltaY > 0 ? 1.1 : 0.9)));
    requestRender();
  };
  const onResize = () => {
    if (disposed) return;
    const size = measureContainer();
    renderer.setSize(size.width, size.height);
    camera.aspect = size.width / size.height;
    baseCamera = solveCanonicalView(currentView, previewable.bounds, { ...viewOptions(), aspect: camera.aspect });
    aimInspectionLights(baseCamera);
    requestRender();
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  globalThis.addEventListener?.('resize', onResize);
  liveLabs += 1;

  requestRender();

  return {
    /** Canonical view names this lab can show. */
    views: CANONICAL_VIEWS,

    /**
     * Snaps to a canonical view, clearing orbit and zoom offsets.
     *
     * @param {string} view
     */
    setView(view) {
      if (disposed) throw new Error('Preview Lab has been disposed');
      if (!CANONICAL_VIEWS.includes(view)) {
        throw new Error(`Unknown canonical view "${view}"`);
      }
      currentView = view;
      orbitYaw = 0;
      orbitPitch = 0;
      zoomFactor = 1;
      const size = measureContainer();
      baseCamera = solveCanonicalView(view, previewable.bounds, { ...viewOptions(), aspect: size.width / size.height });
      aimInspectionLights(baseCamera);
      requestRender();
    },

    /**
     * Re-measures the container and resizes the render surface.
     *
     * Call this after any surrounding chrome is finished assembling: the lab
     * may be mounted before sibling UI has taken its final height, and a canvas
     * larger than its box would overflow the page.
     */
    resize() {
      onResize();
    },

    /**
     * The measured render-surface box. Canonical capture frames from this, so
     * the recorded camera aspect always matches the pixels produced.
     *
     * @returns {{width: number, height: number}}
     */
    getSurfaceSize() {
      return measureContainer();
    },

    get canvas() {
      return renderer.domElement;
    },

    get currentView() {
      return currentView;
    },

    /**
     * The illumination that produced the current frame.
     *
     * Recorded into capture evidence so another agent can tell whether a dark
     * region is a dark asset or a dark view. `rigVersion` names the versioned
     * Preview Lab illumination contract; the directions are that contract
     * resolved for the active canonical camera.
     *
     * @returns {object}
     */
    getLighting() {
      const frame = inspectionLightFrame(baseCamera);
      return {
        rigVersion: frame.version,
        cameraRelative: true,
        view: currentView,
        hemisphere: { ...INSPECTION_RIG.hemisphere },
        lights: frame.lights.map((light) => ({
          name: light.name,
          direction: [...light.direction],
          color: light.color,
          intensity: light.intensity
        }))
      };
    },

    /**
     * Live count of lights in the scene. Switching canonical views re-aims the
     * rig; it must never add to it.
     *
     * @returns {number}
     */
    get lightCount() {
      return scene.children.filter((child) => child.isLight === true).length;
    },

    /**
     * Reports measured preview telemetry. Values that were not measured are
     * reported as null rather than estimated.
     *
     * @returns {object|null}
     */
    getStats() {
      if (disposed) return null;
      return {
        ...previewable.stats,
        // predictedDrawCalls comes from the Previewable's pre-render budget
        // check; drawCalls is what the renderer actually issued.
        predictedDrawCalls: previewable.stats.drawCalls,
        drawCalls: renderer.info.render.calls,
        renderedTriangles: renderer.info.render.triangles,
        geometriesInMemory: renderer.info.memory.geometries,
        texturesInMemory: renderer.info.memory.textures,
        requestedDpr: dprResolution.requestedDpr,
        effectiveDpr: dprResolution.effectiveDpr,
        dprClamped: dprResolution.clamped,
        dpr,
        surfaceWidth: renderer.domElement.clientWidth,
        surfaceHeight: renderer.domElement.clientHeight,
        drawingBufferWidth: renderer.domElement.width,
        drawingBufferHeight: renderer.domElement.height,
        lastFrameMs,
        view: currentView
      };
    },

    /**
     * Part names and measurements, for on-screen inspection.
     *
     * @returns {Array<object>}
     */
    getParts() {
      return previewable.parts.map((p) => ({
        id: p.id,
        semanticName: p.semanticName,
        triangleCount: p.indexCount / 3,
        dimensions: [...p.bounds.dimensions],
        materialId: p.materialId
      }));
    },

    requestRender,

    /**
     * Diagnostics the lab itself produced, such as an applied DPR clamp.
     *
     * @returns {Array<object>}
     */
    getDiagnostics() {
      return dprResolution.diagnostic ? [dprResolution.diagnostic] : [];
    },

    get frameScheduled() {
      return frameRequested;
    },

    get disposed() {
      return disposed;
    },

    /**
     * Releases everything the lab owns. The Previewable is the caller's to
     * dispose. Idempotent.
     */
    dispose() {
      if (disposed) return;
      disposed = true;
      liveLabs -= 1;
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      globalThis.removeEventListener?.('resize', onResize);

      scene.remove(previewable.object3D);
      hemi.dispose();
      for (const light of rigLights) {
        scene.remove(light, light.target);
        light.dispose();
      }
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

/**
 * Convenience entry point: mounts a Previewable into a container.
 *
 * This is the public preview verb. Asset authors work in MeshIR and
 * Previewable; they do not construct renderer objects themselves.
 *
 * @param {object} previewable
 * @param {object} options
 * @returns {object} Preview Lab handle.
 */
export function previewArtifact(previewable, { container, ...rest } = {}) {
  return createPreviewLab({ container, previewable, ...rest });
}
