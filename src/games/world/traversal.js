import { Vector3 } from 'three';
import { createSimulationClock } from '../../runtime/clock.js';
import { createEntityManager } from '../../runtime/entities.js';
import { createTransformManager } from '../../runtime/transforms.js';
import { createInputSystem } from '../../runtime/input.js';
import { buildHumanoidCharacter, REGIONS } from '../../character/index.js';
import { createLocomotionEvaluator } from '../../motion/index.js';
import { compileMaterial } from '../../material/index.js';
import { generateWorld } from '../../world/index.js';

export class WorldTraversal {
  constructor(recipe = {}) {
    this.world = generateWorld(recipe);
    this.clock = createSimulationClock();
    this.entities = createEntityManager();
    this.transforms = createTransformManager(this.entities);
    this.handle = this.entities.spawn('world-player');
    this.input = createInputSystem({ actions: ['Forward', 'Backward', 'Left', 'Right', 'Reset'], keyboardBindings: {
      KeyW: 'Forward', ArrowUp: 'Forward', KeyS: 'Backward', ArrowDown: 'Backward',
      KeyA: 'Left', ArrowLeft: 'Left', KeyD: 'Right', ArrowRight: 'Right', KeyR: 'Reset'
    } });
    this.input.bindGamepadAxis(0, 'Left', 'Right', { deadzone: 0.25 });
    this.input.bindGamepadAxis(1, 'Forward', 'Backward', { deadzone: 0.25 });
    for (const [button, action] of [[12, 'Forward'], [13, 'Backward'], [14, 'Left'], [15, 'Right'], [3, 'Reset']]) this.input.bindGamepadButton(button, action);
    this.character = buildHumanoidCharacter('average');
    this.character.material.dispose();
    this.character.mesh.material = compileMaterial({ id: 'world-player', color: '#e6a34c', roughness: 0.85 });
    this.motion = createLocomotionEvaluator(this.character, 'natural');
    // Enclose the realized natural-gait sole footprint, including the forward toe.
    this.radius = 0.55;
    this.spawn = this.findSpawn();
    this.transform = this.transforms.setTransform(this.handle, { position: this.spawn, ownership: 'KINEMATIC' });
    this.rotation = Math.PI;
    this.blockedSteps = 0;
    this.disposed = false;
    this.pose = null;
    this.walking = false;
    // Rest-space sole vertices, evaluated through actual skinning for proof/inspection.
    const { position, region } = this.character.geometry.attributes;
    this.soleIndices = [REGIONS.FOOT_L, REGIONS.FOOT_R].map(id => Array.from({ length: position.count }, (_, i) => i)
      .filter(i => region.getX(i) === id && position.getY(i) <= 0.001));
    this.poseAt(this.transform.position, 0);
  }

  findSpawn() {
    const { world, radius } = this;
    // Select a real generated tree with a clear approach, not an evaluator-only obstacle.
    for (const tree of [...world.trees].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))) {
      if (Math.abs(tree.x) > world.cache.half - 12 || Math.abs(tree.z) > world.cache.half - 12) continue;
      const z = tree.z + 5, y = world.fields.heightAt(tree.x, z);
      let clear = true;
      for (let d = 1.5; d <= 5; d += 0.2) {
        const s = world.fields.sample(tree.x, tree.z + d);
        if (!s || s.slope > 0.3 || world.volumes.overlaps({ x: tree.x, z: tree.z + d, radius, minY: s.height, maxY: s.height + 1.8 }).length) clear = false;
      }
      if (clear && Math.abs(y - world.fields.heightAt(tree.x, tree.z + 1.5)) > 0.15) {
        this.approachTree = tree; return { x: tree.x, y, z };
      }
    }
    return { x: 0, y: world.fields.heightAt(0, 0), z: 0 };
  }

  reset() {
    this.transforms.teleport(this.handle, this.spawn);
    this.rotation = Math.PI; this.motion.reset(); this.blockedSteps = 0;
    this.walking = false;
    this.poseAt(this.transform.position, 0);
  }

  update(dt) {
    if (this.disposed) throw new Error('World traversal disposed');
    const input = this.input.captureSnapshot();
    if (input.isActionActive('Reset')) { this.reset(); return; }
    let x = Number(input.isActionActive('Right')) - Number(input.isActionActive('Left'));
    let z = Number(input.isActionActive('Backward')) - Number(input.isActionActive('Forward'));
    const length = Math.hypot(x, z);
    if (length) { x /= length; z /= length; this.rotation = Math.atan2(x, z); }
    const p = this.transform.position, speed = this.motion.getSpeed();
    const next = this.world.volumes.resolveMovement(p, { x: p.x + x * speed * dt, z: p.z + z * speed * dt }, this.radius, 1.8, this.world.fields);
    const distance = Math.hypot(next.x - p.x, next.z - p.z);
    this.walking = distance > 1e-7;
    if (next.blocked) this.blockedSteps++;
    this.transforms.setIntent(this.handle, { x: (next.x - p.x) / dt, y: (next.y - p.y) / dt, z: (next.z - p.z) / dt });
    this.transforms.commitAll(dt);
    this.poseAt(this.transform.position, distance / speed);
  }

  poseAt(position, gaitDt = 0) {
    const mesh = this.character.mesh;
    mesh.position.set(position.x, this.world.fields.heightAt(position.x, position.z), position.z);
    mesh.rotation.y = this.rotation;
    mesh.updateMatrixWorld(true);
    const c = Math.cos(this.rotation), s = Math.sin(this.rotation);
    this.pose = this.motion.update(gaitDt, { standing: gaitDt === 0 && !this.walking, groundAt: (x, z) => {
      const field = this.world.fields.sample(position.x + c * x + s * z, position.z - s * x + c * z);
      if (!field) throw new Error('Foot target outside bounded terrain');
      return { height: field.height - mesh.position.y, normal: {
        x: c * field.normal.x - s * field.normal.z, y: field.normal.y, z: s * field.normal.x + c * field.normal.z
      } };
    } });
    mesh.updateMatrixWorld(true);
  }

  renderPose(alpha) {
    const a = this.transform.previousPosition, b = this.transform.position;
    this.poseAt({ x: a.x + (b.x - a.x) * alpha, z: a.z + (b.z - a.z) * alpha }, 0);
  }

  grounding() {
    return ['l', 'r'].map((side, i) => {
      const p = this.character.bonesByName[`foot_${side}`].getWorldPosition(new Vector3());
      const ground = this.world.fields.heightAt(p.x, p.z);
      return { side, position: p.toArray(), ground, clearance: p.y - ground - this.character.landmarks['ankle.L'].y,
        inContact: this.pose.contactStates[i === 0 ? 'left' : 'right'] };
    });
  }

  snapshot() {
    return { position: { ...this.transform.position }, sample: this.world.fields.sample(this.transform.position.x, this.transform.position.z),
      feet: this.grounding(), blockedSteps: this.blockedSteps, hashes: this.world.hashes, seed: this.world.recipe.parameters.seed };
  }

  soleGrounding() {
    const mesh = this.character.mesh, position = mesh.geometry.attributes.position;
    mesh.updateMatrixWorld(true); mesh.skeleton.update();
    return this.soleIndices.map((indices, foot) => {
      let min = Infinity, max = -Infinity;
      for (const index of indices) {
        const p = new Vector3().fromBufferAttribute(position, index);
        mesh.applyBoneTransform(index, p); mesh.localToWorld(p);
        const height = this.world.fields.heightAt(p.x, p.z);
        if (height === null) return { min: -Infinity, max: Infinity, samples: indices.length };
        min = Math.min(min, p.y - height); max = Math.max(max, p.y - height);
      }
      return { min, max, samples: indices.length, inContact: this.pose.contactStates[foot === 0 ? 'left' : 'right'] };
    });
  }

  dispose() {
    if (this.disposed) return;
    this.character.geometry.dispose(); this.character.mesh.material.dispose(); this.character.skeleton.dispose();
    this.world.dispose(); this.transforms.clear(); this.entities.despawn(this.handle); this.disposed = true;
  }
}
