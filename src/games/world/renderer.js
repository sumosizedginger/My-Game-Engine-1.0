import { Scene, Color, Fog, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  Mesh, InstancedMesh, CylinderGeometry, ConeGeometry, Object3D, Vector3, Quaternion, Matrix4 } from 'three';
import { compileMaterial } from '../../material/index.js';
import { createGroundCoverGeometry } from '../../world/vegetation.js';

export function createWorldRenderer(container, game, controlled) {
  const scene = new Scene(); scene.background = new Color('#b3c9c5'); scene.fog = new Fog('#b3c9c5', 55, 160);
  const camera = new PerspectiveCamera(48, 1, 0.1, 260);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.domElement.style.display = 'block'; container.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  const materials = [], geometries = [];
  const material = (id, parameters) => { const m = compileMaterial({ id, parameters }); materials.push(m); return m; };
  const terrain = new Mesh(game.world.terrain, material('world-terrain', { color: '#ffffff', vertexColors: true, roughness: 1 }));
  terrain.receiveShadow = true; scene.add(terrain);
  scene.add(new HemisphereLight('#dfebdc', '#504836', 2));
  const sun = new DirectionalLight('#fff1d0', 2.5); sun.position.set(-30, 65, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 150 });
  sun.shadow.bias = -0.0002; scene.add(sun);
  const object = new Object3D(), up = new Vector3(0, 1, 0);
  function instances(geometry, mat, records, transform) {
    geometries.push(geometry);
    const mesh = new InstancedMesh(geometry, mat, records.length);
    records.forEach((r, i) => { object.position.set(r.x, r.y, r.z); object.quaternion.identity(); object.scale.set(1, 1, 1); transform(r, object); object.updateMatrix(); mesh.setMatrixAt(i, object.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh); return mesh;
  }
  // Radius, top height and buried base come directly from each solid record.
  const trunks = instances(new CylinderGeometry(1, 1, 1, 9), material('world-bark', { color: '#63503b', roughness: 1 }), game.world.trees,
    (r, o) => { o.position.y += (r.trunkHeight - r.baseDepth) / 2; o.scale.set(r.radius, r.trunkHeight + r.baseDepth, r.radius); o.rotation.y = r.rotation; });
  trunks.userData.placementIds = game.world.trees.map(r => r.id);
  const lowerCanopy = instances(new ConeGeometry(1, 1, 9), material('world-canopy', { color: '#496443', roughness: 1 }), game.world.trees,
    (r, o) => { o.position.y += 4.7 * r.scale; o.scale.set(2.1 * r.scale, 4.7 * r.scale, 2.1 * r.scale); o.rotation.y = r.rotation; });
  const upperCanopy = instances(new ConeGeometry(1, 1, 8), material('world-canopy-light', { color: '#668257', roughness: 1 }), game.world.trees,
    (r, o) => { o.position.y += 6.4 * r.scale; o.scale.set(1.4 * r.scale, 3.5 * r.scale, 1.4 * r.scale); o.rotation.y = r.rotation + 0.4; });
  const coverGeometry = createGroundCoverGeometry();
  instances(coverGeometry, material('world-ground-cover', { color: '#85934f', roughness: 1 }), game.world.cover,
    (r, o) => { o.quaternion.setFromUnitVectors(up, new Vector3().copy(r.normal)); o.quaternion.multiply(new Quaternion().setFromAxisAngle(up, r.rotation)); o.scale.setScalar(r.scale); });
  scene.add(game.character.mesh); game.character.mesh.castShadow = true;
  const start = game.spawn;
  camera.position.set(start.x + 7, start.y + 10, start.z + 13);
  camera.lookAt(start.x, start.y + 1, start.z - 6);
  const canopies = [lowerCanopy, upperCanopy];
  const originalMatrices = canopies.map(mesh => game.world.trees.map((_, i) => { const m = new Matrix4(); mesh.getMatrixAt(i, m); return m; }));
  const hidden = game.world.trees.map(() => false), collapsed = new Matrix4().makeScale(0, 0, 0);
  const presentation = { cutawayCount: 0 };
  function cutaway() {
    const p = game.character.mesh.position, dx = camera.position.x - p.x, dz = camera.position.z - p.z;
    const length2 = dx * dx + dz * dz;
    presentation.cutawayCount = 0;
    game.world.trees.forEach((r, i) => {
      const t = Math.max(0, Math.min(1, ((r.x - p.x) * dx + (r.z - p.z) * dz) / Math.max(0.001, length2)));
      const distance = Math.hypot(r.x - p.x - t * dx, r.z - p.z - t * dz);
      const rayY = p.y + 1 + t * (camera.position.y - p.y - 1);
      const hide = distance < 2.1 * r.scale + 0.8 && rayY < r.y + 8.2 * r.scale + 1;
      if (hide) presentation.cutawayCount++;
      if (hidden[i] !== hide) {
        hidden[i] = hide;
        canopies.forEach((mesh, layer) => { mesh.setMatrixAt(i, hide ? collapsed : originalMatrices[layer][i]); mesh.instanceMatrix.needsUpdate = true; });
      }
    });
  }
  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  function blockedBoom(from, to) {
    const steps = Math.ceil(from.distanceTo(to) / 0.25), point = new Vector3();
    for (let i = 1; i <= steps; i++) {
      point.lerpVectors(from, to, i / steps);
      if (game.world.volumes.overlaps({ x: point.x, z: point.z, radius: 0.18,
        minY: point.y - 0.18, maxY: point.y + 0.18 }).length) return true;
    }
    return false;
  }
  function render() {
    if (!controlled) {
      const p = game.character.mesh.position;
      const groundBehind = game.world.fields.heightAt(p.x, Math.min(game.world.cache.half, p.z + 10)) ?? p.y;
      const target = new Vector3(p.x, p.y + 1, p.z);
      let desired = new Vector3(p.x, Math.max(p.y + 7, groundBehind + 4), p.z + 11);
      // An upright trunk can obstruct the boom even after foliage cutaway.
      // The player's collision-free column provides a simple overhead fallback.
      presentation.overhead = blockedBoom(target, desired);
      if (presentation.overhead) desired = new Vector3(p.x, p.y + 12, p.z + 0.1);
      camera.position.lerp(desired, 0.12);
      if (blockedBoom(target, camera.position)) camera.position.copy(desired);
      camera.lookAt(target);
    }
    // Deterministic spectator cutaway affects foliage only. Solid trunks stay visible.
    cutaway(); renderer.render(scene, camera);
  }
  let disposed = false;
  return { renderer, scene, camera, trunks, presentation, render, resize,
    dispose() { if (disposed) return; disposed = true; geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove(); scene.clear(); } };
}
