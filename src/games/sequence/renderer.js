/**
 * Order Five — project presentation. Reads game snapshots; never authors gameplay.
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 */

import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolatedPosition(transform, alpha) {
  if (!transform) return { x: 0, y: 0, z: 0 };
  const prev = transform.previousPosition || transform.position;
  return {
    x: lerp(prev.x, transform.position.x, alpha),
    y: lerp(prev.y, transform.position.y, alpha),
    z: lerp(prev.z, transform.position.z, alpha)
  };
}

export function createSequenceRenderer(container, game) {
  const scene = new Scene();
  scene.background = new Color('#0b1220');

  const camera = new OrthographicCamera(-11, 11, 11, -11, 0.1, 80);
  camera.up.set(0, 0, -1);
  camera.position.set(0, 28, 0);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setClearColor('#0b1220');
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const geometries = [];
  const materials = [];

  function trackGeometry(geometry) {
    geometries.push(geometry);
    return geometry;
  }

  function trackMaterial(material) {
    materials.push(material);
    return material;
  }

  const arena = game.arena;
  const width = arena.maxX - arena.minX;
  const depth = arena.maxZ - arena.minZ;

  scene.add(new AmbientLight('#93c5fd', 0.55));
  const sun = new DirectionalLight('#fff7ed', 1.6);
  sun.position.set(-8, 18, -6);
  scene.add(sun);

  const floor = new Mesh(
    trackGeometry(new PlaneGeometry(width, depth)),
    trackMaterial(new MeshStandardMaterial({ color: '#1e293b', roughness: 0.92 }))
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMat = trackMaterial(new MeshStandardMaterial({ color: '#334155', roughness: 0.8 }));
  const wallH = 1.4;
  const wallT = 0.4;
  const north = new Mesh(trackGeometry(new BoxGeometry(width + wallT * 2, wallH, wallT)), wallMat);
  north.position.set(0, wallH / 2, arena.minZ - wallT / 2);
  const south = new Mesh(trackGeometry(new BoxGeometry(width + wallT * 2, wallH, wallT)), wallMat);
  south.position.set(0, wallH / 2, arena.maxZ + wallT / 2);
  const west = new Mesh(trackGeometry(new BoxGeometry(wallT, wallH, depth)), wallMat);
  west.position.set(arena.minX - wallT / 2, wallH / 2, 0);
  const east = new Mesh(trackGeometry(new BoxGeometry(wallT, wallH, depth)), wallMat);
  east.position.set(arena.maxX + wallT / 2, wallH / 2, 0);
  scene.add(north, south, west, east);

  const playerMesh = new Mesh(
    trackGeometry(new CylinderGeometry(0.45, 0.45, 0.9, 16)),
    trackMaterial(new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.45, metalness: 0.15 }))
  );
  playerMesh.position.set(0, 0.45, 0);
  scene.add(playerMesh);

  const relicMeshes = game.collectibles.map((item) => {
    const mesh = new Mesh(
      trackGeometry(new CylinderGeometry(0.32, 0.32, 0.55, 8)),
      trackMaterial(new MeshStandardMaterial({
        color: item.artifact.data.color,
        emissive: item.artifact.data.color,
        emissiveIntensity: 0.35,
        roughness: 0.4
      }))
    );
    mesh.position.set(item.artifact.data.initialX, item.artifact.data.initialY, item.artifact.data.initialZ);
    scene.add(mesh);
    return mesh;
  });

  const hazardMeshes = game.hazards.map((item) => {
    const mesh = new Mesh(
      trackGeometry(new BoxGeometry(1.0, 0.9, 1.0)),
      trackMaterial(new MeshStandardMaterial({
        color: item.data.color,
        emissive: '#7f1d1d',
        emissiveIntensity: 0.4,
        roughness: 0.5
      }))
    );
    scene.add(mesh);
    return mesh;
  });

  const inactiveExitMat = trackMaterial(new MeshStandardMaterial({
    color: '#334155',
    emissive: '#0f172a',
    emissiveIntensity: 0.1,
    roughness: 0.85
  }));
  const activeExitMat = trackMaterial(new MeshStandardMaterial({
    color: '#4ade80',
    emissive: '#166534',
    emissiveIntensity: 0.55,
    roughness: 0.35
  }));
  const exitMesh = new Mesh(
    trackGeometry(new BoxGeometry(2.4, 1.1, 1.4)),
    inactiveExitMat
  );
  const exitTransform = game.transformManager.getTransform(game.exitHandle);
  exitMesh.position.set(exitTransform.position.x, exitTransform.position.y, exitTransform.position.z);
  scene.add(exitMesh);

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    const aspect = w / h;
    const view = 11;
    if (aspect >= 1) {
      camera.left = -view * aspect;
      camera.right = view * aspect;
      camera.top = view;
      camera.bottom = -view;
    } else {
      camera.left = -view;
      camera.right = view;
      camera.top = view / aspect;
      camera.bottom = -view / aspect;
    }
    camera.updateProjectionMatrix();
  }

  let disposed = false;

  function render(alpha = 1) {
    if (disposed) return;
    const snap = game.snapshot();
    const playerTransform = game.transformManager.getTransform(game.playerHandle);
    const playerPos = interpolatedPosition(playerTransform, alpha);
    playerMesh.position.set(playerPos.x, playerPos.y, playerPos.z);

    for (let i = 0; i < relicMeshes.length; i++) {
      const item = snap.collectibles[i];
      relicMeshes[i].visible = !item.collected;
      relicMeshes[i].position.set(item.position.x, item.position.y, item.position.z);
      relicMeshes[i].rotation.y = snap.playTicks * 0.04;
    }

    for (let i = 0; i < hazardMeshes.length; i++) {
      const transform = game.transformManager.getTransform(game.hazards[i].handle);
      const pos = interpolatedPosition(transform, alpha);
      hazardMeshes[i].position.set(pos.x, pos.y, pos.z);
    }

    exitMesh.material = snap.exitActive ? activeExitMat : inactiveExitMat;
    renderer.render(scene, camera);
  }

  resize();
  render(1);

  return {
    scene,
    camera,
    renderer,
    render,
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
    }
  };
}
