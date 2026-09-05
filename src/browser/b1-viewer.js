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
  const scene = new Scene();
  scene.background = new Color(0x181a20);

  // 2. Camera setup (positioned to inspect full character height and foot grounding)
  const camera = new PerspectiveCamera(
    45,
    container.clientWidth / (container.clientHeight || 560),
    0.1,
    100
  );
  camera.position.set(0, 1.15, 3.2);
  camera.lookAt(0, 0.90, 0);

  // 3. Renderer setup
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight || 560);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  // 4. Studio Environment: 1-meter Floor Grid
  const gridHelper = new GridHelper(10, 10, 0x475569, 0x334155);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Subtle floor shadow receiver
  const floorGeo = new PlaneGeometry(10, 10);
  const floorMat = new MeshBasicMaterial({ color: 0x14161c, depthWrite: false });
  const floorPlane = new Mesh(floorGeo, floorMat);
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

  const charTransform = { position: { x: 0, y: 0, z: 0 } };
  let lastUpdateResult = null;

  function initCharacter() {
    if (character && character.mesh) {
      scene.remove(character.mesh);
    }
    if (skeletonHelper) {
      scene.remove(skeletonHelper);
    }

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

  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    orbitPhi -= dx * 0.008;
    orbitTheta = Math.max(-0.1, Math.min(1.2, orbitTheta + dy * 0.008));
    updateCameraTransform();
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbitRadius = Math.max(1.2, Math.min(8.0, orbitRadius + e.deltaY * 0.003));
    updateCameraTransform();
  }, { passive: false });

  // 8. Simulation Step
  function step(deltaMs) {
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
    ready: true,
    get characterId() { return character.id; },
    get vertexCount() { return character.geometryData.vertexCount; },
    get triangleCount() { return character.geometryData.triangleCount; },
    get boneCount() { return character.bones.length; },
    get skinningNormalized() { return character.skinning.stats.allNormalized; },
    get maxNormalizationError() { return character.skinning.stats.maxNormalizationError; },
    getPhase: () => evaluator.getPhase(),
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
    getStats: () => ({
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
      if (HUMANOID_PRESETS[preset]) {
        currentCharPreset = preset;
        initCharacter();
        step(0);
      }
    },
    setMotionPreset(preset) {
      if (MOTION_PRESETS[preset]) {
        currentMotionPreset = preset;
        evaluator = createLocomotionEvaluator(character, currentMotionPreset);
        step(0);
      }
    },
    setCameraOrbit(phi, theta, radius) {
      if (phi !== undefined) orbitPhi = phi;
      if (theta !== undefined) orbitTheta = theta;
      if (radius !== undefined) orbitRadius = radius;
      updateCameraTransform();
      if (!running) renderer.render(scene, camera);
    },
    toggleWireframe() {
      isWireframe = !isWireframe;
      if (character && character.material) {
        character.material.wireframe = isWireframe;
      }
      if (!running) renderer.render(scene, camera);
      return isWireframe;
    },
    toggleBones() {
      showBones = !showBones;
      if (skeletonHelper) {
        skeletonHelper.visible = showBones;
      }
      if (!running) renderer.render(scene, camera);
      return showBones;
    },
    toggleSlowMotion() {
      isSlowMotion = !isSlowMotion;
      return isSlowMotion;
    },
    toggleFreeWalk() {
      isFreeWalk = !isFreeWalk;
      if (!isFreeWalk) {
        charTransform.position.x = 0;
        charTransform.position.y = 0;
        charTransform.position.z = 0;
      }
      return isFreeWalk;
    },
    destroy() {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
  };

  window.__PROOF_B1_MOTION__ = viewerApi;
  return viewerApi;
}
