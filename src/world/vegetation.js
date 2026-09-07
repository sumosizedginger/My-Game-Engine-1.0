import { BufferGeometry, Float32BufferAttribute } from 'three';

// Code-native tuft: three tapered, closed blades. Generated once, then instanced.
export function createGroundCoverGeometry() {
  const positions = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI * 2 / 3, c = Math.cos(angle), s = Math.sin(angle);
    const points = [[-0.1, 0, 0], [0.1, 0, 0], [0, 0, 0.11], [0.26, 0.8 + blade * 0.1, 0.1]]
      .map(([x, y, z]) => [c * x + s * z, y, -s * x + c * z]);
    for (const triangle of [[0, 1, 3], [1, 2, 3], [2, 0, 3], [0, 2, 1]]) for (const i of triangle) positions.push(...points[i]);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}
