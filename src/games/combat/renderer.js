/**
 * My Game Engine 1.0 — Proof B2: 3D Combat Room Renderer
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Assembles the Three.js scene for the combat room using Material Forge compiled
 * materials, Geometry Forge procedural geometry, and Character Forge skinned meshes.
 * Follows B2 work order and ARCHITECTURE.md §14.
 */

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  AmbientLight,
  DirectionalLight,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial
} from 'three';

import { compileMaterial, MATERIAL_PRESETS } from '../../material/index.js';

export function createCombatRenderer({ container, game, isControlled = false }) {
  // 1. Scene
  const scene = new Scene();
  scene.background = new Color(0x10141c);

  // 2. Camera Setup
  const width = container.clientWidth || 960;
  const height = container.clientHeight || 540;
  const camera = new PerspectiveCamera(48, width / height, 0.1, 100);

  // Deterministic camera framing for controlled captures
  if (isControlled) {
    camera.position.set(0, 8.0, 10.5);
    camera.lookAt(0, 0.9, 0.5);
  } else {
    camera.position.set(0, 6.5, 9.5);
    camera.lookAt(0, 0.9, 0);
  }

  // 3. WebGL Renderer
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (!isControlled) {
    renderer.domElement.style.display = 'block';
  }
  container.appendChild(renderer.domElement);

  // 4. Studio Lighting
  const ambient = new AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const keyLight = new DirectionalLight(0xfff0e0, 1.30);
  keyLight.position.set(6, 10, 8);
  scene.add(keyLight);

  const fillLight = new DirectionalLight(0xa0c4ff, 0.50);
  fillLight.position.set(-6, 8, -6);
  scene.add(fillLight);

  const rimLight = new DirectionalLight(0xffffff, 0.70);
  rimLight.position.set(0, 5, -9);
  scene.add(rimLight);

  // 5. Room Meshes (Compiled via Material Forge)
  const floorMat = compileMaterial(MATERIAL_PRESETS.arenaFloor);
  const wallMat = compileMaterial(MATERIAL_PRESETS.arenaWall);
  const pillarMat = compileMaterial(MATERIAL_PRESETS.arenaPillar);

  // Floor
  const floorMesh = new Mesh(game.room.visual.parts.floor, floorMat);
  scene.add(floorMesh);

  // Perimeter Walls
  const northWall = new Mesh(game.room.visual.parts.northWall, wallMat);
  const southWall = new Mesh(game.room.visual.parts.southWall, wallMat);
  const eastWall = new Mesh(game.room.visual.parts.eastWall, wallMat);
  const westWall = new Mesh(game.room.visual.parts.westWall, wallMat);
  // The live spectator camera looks from +Z: cut away the near (north) wall.
  // Keep the generated WALL geometry and authoritative collision intact.
  // Controlled captures retain the complete enclosure.
  northWall.visible = isControlled;
  scene.add(northWall, southWall, eastWall, westWall);

  // Pillars
  const pillarMeshes = [];
  game.room.visual.parts.pillars.forEach((p) => {
    const pMesh = new Mesh(p.geometry, pillarMat);
    scene.add(pMesh);
    pillarMeshes.push(pMesh);
  });

  // 6. Character Skinned Meshes
  if (game.player.character?.mesh) {
    scene.add(game.player.character.mesh);
  }
  if (game.enemy.character?.mesh) {
    scene.add(game.enemy.character.mesh);
  }

  // 7. Authoritative Attack Volume Debug/Indicator Mesh
  const attackVolMat = compileMaterial(MATERIAL_PRESETS.attackVolume);
  const attackVolGeo = new SphereGeometry(0.8, 16, 12);
  const attackVolMesh = new Mesh(attackVolGeo, attackVolMat);
  attackVolMesh.visible = false;
  scene.add(attackVolMesh);

  // 8. Hit Impact Spark Mesh
  const hitSparkMat = new MeshBasicMaterial({ color: 0xffe066, wireframe: true });
  const hitSparkGeo = new SphereGeometry(0.35, 8, 6);
  const hitSparkMesh = new Mesh(hitSparkGeo, hitSparkMat);
  hitSparkMesh.visible = false;
  scene.add(hitSparkMesh);

  let hitSparkTimer = 0;

  function render() {
    // Attack Volume Visual Indicator (derived from single authoritative volume)
    const attackVol = game.combatStats.lastAttackVolume;
    if (attackVol && attackVol.active && attackVol.center) {
      attackVolMesh.position.set(attackVol.center.x, attackVol.center.y, attackVol.center.z);
      attackVolMesh.scale.setScalar(attackVol.radius / 0.8);
      attackVolMesh.visible = true;
    } else {
      attackVolMesh.visible = false;
    }

    // Hit Spark Visual Indicator
    if (game.combatStats.lastHitPoint) {
      const pt = game.combatStats.lastHitPoint;
      hitSparkMesh.position.set(pt.x, pt.y, pt.z);
      hitSparkMesh.visible = true;
      hitSparkTimer = 0.20; // Show for 200ms
      game.combatStats.lastHitPoint = null; // Consume
    } else if (hitSparkTimer > 0) {
      hitSparkTimer -= 0.016;
      if (hitSparkTimer <= 0) {
        hitSparkMesh.visible = false;
      }
    }

    // Interactive camera smooth framing (in non-controlled mode)
    if (!isControlled) {
      const pPos = game.player.transform.position;
      const ePos = game.enemy.transform.position;
      const midX = (pPos.x + ePos.x) / 2;
      const midZ = (pPos.z + ePos.z) / 2;
      const dist = Math.hypot(pPos.x - ePos.x, pPos.z - ePos.z);

      const targetCamZ = midZ + 6.5 + Math.min(dist * 0.4, 4.0);
      const targetCamY = 5.5 + Math.min(dist * 0.3, 3.0);
      const targetCamX = midX * 0.35;

      camera.position.x += (targetCamX - camera.position.x) * 0.06;
      camera.position.y += (targetCamY - camera.position.y) * 0.06;
      camera.position.z += (targetCamZ - camera.position.z) * 0.06;
      camera.lookAt(midX, 1.0, midZ);
    }

    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth || 960;
    const h = container.clientHeight || 540;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
  }

  function destroy() {
    renderer.dispose();
    floorMat.dispose();
    wallMat.dispose();
    pillarMat.dispose();
    attackVolMat.dispose();
    hitSparkMat.dispose();
    if (renderer.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return {
    scene,
    camera,
    renderer,
    render,
    resize,
    destroy
  };
}
