/**
 * My Game Engine 1.0 — Proof B1 Motion Viewer
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Isolated studio environment for evaluating procedural character motion truth.
 * Features 1-meter floor grid, studio lighting (key/fill/rim), wireframe/bones
 * overlays, slow-motion toggle, and deterministic headless stepping.
 * Exposes window.__PROOF_B1_MOTION__ for automated evaluation.
 * Follows PRD.md §16.4, ARCHITECTURE.md §20.3 & §22, and MOTION_FORGE.md.
 */

import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Color,
  AmbientLight,
  DirectionalLight,
  GridHelper,
  SkeletonHelper,
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh,
  Vector3
} from 'three';

import { buildHumanoidCharacter, HUMANOID_PRESETS } from '../character/index.js';
import { createLocomotionEvaluator, MOTION_PRESETS, commitRootMotionIntent } from '../motion/index.js';

export function createB1Viewer({ container, isControlled = false }) {
  // 1. Scene setup
  let scene = new Scene();
  scene.background = new Color(0x181a20);

  // 2. Camera setup (positioned to inspect full character height and foot grounding)
  let camera = new PerspectiveCamera(
    45,
    container.clientWidth / (container.clientHeight || 560),
    0.1,
    100
  );
  camera.position.set(0, 1.15, 3.2);
  camera.lookAt(0, 0.90, 0);

  // 3. Renderer setup
  let renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight || 560);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  // 4. Studio Environment: 1-meter Floor Grid
  let gridHelper = new GridHelper(10, 10, 0x475569, 0x334155);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Subtle floor shadow receiver
  let floorPlane = new Mesh(
    new PlaneGeometry(10, 10),
    new MeshBasicMaterial({ color: 0x14161c, depthWrite: false })
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.y = -0.001;
  scene.add(floorPlane);

  // 5. Isolated Studio Lighting (no post-processing or distractions)
  const ambientLight = new AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const keyLight = new DirectionalLight(0xfff8f0, 1.25);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  const fillLight = new DirectionalLight(0xd0e0f8, 0.55);
  fillLight.position.set(-3, 3, 2);
  scene.add(fillLight);

  const rimLight = new DirectionalLight(0xf0f4ff, 0.85);
  rimLight.position.set(0, 4, -4);
  scene.add(rimLight);

  // 6. Character and Locomotion state
  let currentCharPreset = 'average';
  let currentMotionPreset = 'natural';
  let character = null;
  let evaluator = null;
  let skeletonHelper = null;
  let isWireframe = false;
  let showBones = false;
  let isSlowMotion = false;
  let isFreeWalk = false;
  let running = !isControlled;
  let lastTime = performance.now();
  let animationFrameId = null;
  let disposed = false;

  const charTransform = { position: { x: 0, y: 0, z: 0 } };
  let lastUpdateResult = null;

  function requireAlive() {
    if (disposed) throw new Error('B1 viewer has been destroyed');
  }

  // Only used for hierarchies constructed and exclusively owned by this viewer.
  function disposeOwnedObject(object) {
    const resources = new Set();
    object.traverse(child => {
      if (child.geometry) resources.add(child.geometry);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) if (material) resources.add(material);
      if (child.isSkinnedMesh) resources.add(child.skeleton);
    });
    object.removeFromParent();
    for (const resource of resources) resource.dispose();
  }

  function disposeCurrentCharacter() {
    if (skeletonHelper) disposeOwnedObject(skeletonHelper);
    if (character) disposeOwnedObject(character.mesh);
    skeletonHelper = null;
    character = null;
    evaluator = null;
    lastUpdateResult = null;
  }

  function initCharacter() {
    requireAlive();
    disposeCurrentCharacter();

    character = buildHumanoidCharacter(currentCharPreset, {
      wireframe: isWireframe
    });
    scene.add(character.mesh);

    skeletonHelper = new SkeletonHelper(character.mesh);
    skeletonHelper.visible = showBones;
    scene.add(skeletonHelper);

    evaluator = createLocomotionEvaluator(character, currentMotionPreset);
    charTransform.position.x = 0;
    charTransform.position.y = 0;
    charTransform.position.z = 0;
  }

  initCharacter();

  // 7. Interactive Orbit Camera Controls
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let orbitPhi = 0; // horizontal angle
  let orbitTheta = 0.22; // vertical elevation angle
  let orbitRadius = 3.2;

  function updateCameraTransform() {
    const cy = 0.90;
    const x = orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
    const y = cy + orbitRadius * Math.sin(orbitTheta);
    const z = orbitRadius * Math.cos(orbitPhi) * Math.cos(orbitTheta);
    camera.position.set(x, y, z);
    camera.lookAt(0, cy, 0);
  }

  let canvas = renderer.domElement;
  function onMouseDown(e) {
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    orbitPhi -= dx * 0.008;
    orbitTheta = Math.max(-0.1, Math.min(1.2, orbitTheta + dy * 0.008));
    updateCameraTransform();
  }

  function onWheel(e) {
    e.preventDefault();
    orbitRadius = Math.max(1.2, Math.min(8.0, orbitRadius + e.deltaY * 0.003));
    updateCameraTransform();
  }
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);

  // 8. Simulation Step
  function step(deltaMs) {
    requireAlive();
    const deltaSec = deltaMs * 0.001;
    const effectiveDelta = isSlowMotion ? deltaSec * 0.25 : deltaSec;

    lastUpdateResult = evaluator.update(effectiveDelta);

    // Commit root motion intent respecting single-writer transform authority
    commitRootMotionIntent(
      lastUpdateResult.rootMotionIntent,
      charTransform,
      isFreeWalk ? 'forward' : 'in_place'
    );

    if (character.mesh) {
      character.mesh.position.set(
        charTransform.position.x,
        charTransform.position.y,
        charTransform.position.z
      );
    }

    if (skeletonHelper && skeletonHelper.visible && typeof skeletonHelper.update === 'function') {
      skeletonHelper.update();
    }

    renderer.render(scene, camera);
    updateHUD();
    return lastUpdateResult;
  }

  // 9. HUD live updates
  function updateHUD() {
    const phaseEl = document.getElementById('b1-stat-phase');
    const speedEl = document.getElementById('b1-stat-speed');
    const contactEl = document.getElementById('b1-stat-contact');
    const pelvisEl = document.getElementById('b1-stat-pelvis');

    if (!lastUpdateResult) return;

    if (phaseEl) {
      phaseEl.textContent = `${(lastUpdateResult.phase * 100).toFixed(1)}%`;
    }
    if (speedEl) {
      speedEl.textContent = `${lastUpdateResult.rootMotionIntent.speed.toFixed(2)} m/s`;
    }
    if (contactEl) {
      const l = lastUpdateResult.contactStates.left ? 'STANCE' : 'SWING';
      const r = lastUpdateResult.contactStates.right ? 'STANCE' : 'SWING';
      contactEl.textContent = `L: ${l} | R: ${r}`;
    }
    if (pelvisEl) {
      const bMm = (lastUpdateResult.pelvisState.bounceY * 1000).toFixed(1);
      const sMm = (lastUpdateResult.pelvisState.swayX * 1000).toFixed(1);
      pelvisEl.textContent = `Bounce: ${bMm}mm | Sway: ${sMm}mm`;
    }
  }

  // 10. Animation Loop
  function loop(currentTime) {
    if (!running) return;
    const delta = Math.min(currentTime - lastTime, 100);
    lastTime = currentTime;

    step(delta);
    animationFrameId = requestAnimationFrame(loop);
  }

  if (!isControlled) {
    animationFrameId = requestAnimationFrame(loop);
  } else {
    // Perform initial deterministic step at phase 0
    step(16.67);
  }

  // 11. Window Resize Handler
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 560;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (!running) renderer.render(scene, camera);
  }
  window.addEventListener('resize', onResize);

  // 12. Public API and Contract for Evaluation
  const viewerApi = {
    get ready() { return !disposed; },
    get characterId() { return character?.id ?? null; },
    get vertexCount() { return character?.geometryData.vertexCount ?? 0; },
    get triangleCount() { return character?.geometryData.triangleCount ?? 0; },
    get boneCount() { return character?.bones.length ?? 0; },
    get skinningNormalized() { return character?.skinning.stats.allNormalized ?? false; },
    get maxNormalizationError() { return character?.skinning.stats.maxNormalizationError ?? null; },
    getPhase: () => evaluator?.getPhase() ?? null,
    getRealizedFootPositions() {
      if (!character || !character.bonesByName) return null;
      const leftVec = new Vector3();
      const rightVec = new Vector3();
      if (character.bonesByName.foot_l) character.bonesByName.foot_l.getWorldPosition(leftVec);
      if (character.bonesByName.foot_r) character.bonesByName.foot_r.getWorldPosition(rightVec);
      return {
        left: { x: leftVec.x, y: leftVec.y, z: leftVec.z },
        right: { x: rightVec.x, y: rightVec.y, z: rightVec.z }
      };
    },
    getStats: () => disposed ? null : ({
      phase: evaluator.getPhase(),
      speed: evaluator.getSpeed(),
      parameters: evaluator.getParameters(),
      contactStates: lastUpdateResult ? lastUpdateResult.contactStates : null,
      pelvisState: lastUpdateResult ? lastUpdateResult.pelvisState : null,
      charPreset: currentCharPreset,
      motionPreset: currentMotionPreset,
      isWireframe,
      showBones,
      isSlowMotion
    }),
    step,
    setCharPreset(preset) {
      requireAlive();
      if (HUMANOID_PRESETS[preset]) {
        currentCharPreset = preset;
        initCharacter();
        step(0);
      }
    },
    setMotionPreset(preset) {
      requireAlive();
      if (MOTION_PRESETS[preset]) {
        currentMotionPreset = preset;
        evaluator = createLocomotionEvaluator(character, currentMotionPreset);
        step(0);
      }
    },
    setCameraOrbit(phi, theta, radius) {
      requireAlive();
      if (phi !== undefined) orbitPhi = phi;
      if (theta !== undefined) orbitTheta = theta;
      if (radius !== undefined) orbitRadius = radius;
      updateCameraTransform();
      if (!running) renderer.render(scene, camera);
    },
    toggleWireframe() {
      requireAlive();
      isWireframe = !isWireframe;
      if (character && character.material) {
        character.material.wireframe = isWireframe;
      }
      if (!running) renderer.render(scene, camera);
      return isWireframe;
    },
    toggleBones() {
      requireAlive();
      showBones = !showBones;
      if (skeletonHelper) {
        skeletonHelper.visible = showBones;
      }
      if (!running) renderer.render(scene, camera);
      return showBones;
    },
    toggleSlowMotion() {
      requireAlive();
      isSlowMotion = !isSlowMotion;
      return isSlowMotion;
    },
    toggleFreeWalk() {
      requireAlive();
      isFreeWalk = !isFreeWalk;
      if (!isFreeWalk) {
        charTransform.position.x = 0;
        charTransform.position.y = 0;
        charTransform.position.z = 0;
      }
      return isFreeWalk;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      running = false;
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      isDragging = false;
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      disposeCurrentCharacter();
      disposeOwnedObject(gridHelper);
      disposeOwnedObject(floorPlane);
      scene.clear();
      renderer.dispose();
      canvas.remove();
      gridHelper = floorPlane = scene = camera = renderer = canvas = null;
      if (window.__PROOF_B1_MOTION__ === viewerApi) delete window.__PROOF_B1_MOTION__;
    }
  };

  window.__PROOF_B1_MOTION__ = viewerApi;
  return viewerApi;
}
