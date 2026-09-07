/** Bounded, deterministic cylinder queries. Records are the vegetation source records. */
export function createWorldVolumeQuery(half) {
  const records = [], grid = new Map(), cellSize = 8;
  const key = (x, z) => `${x},${z}`;
  function validate(values, positive) {
    if (!values.every(Number.isFinite) || !positive.every(v => v > 0)) {
      const error = new RangeError('World volume query requires finite coordinates and positive extents');
      error.code = 'WORLD_INVALID_VOLUME_QUERY'; throw error;
    }
  }
  function cells(x, z, radius) {
    const keys = [];
    for (let iz = Math.floor((z - radius) / cellSize); iz <= Math.floor((z + radius) / cellSize); iz++)
      for (let ix = Math.floor((x - radius) / cellSize); ix <= Math.floor((x + radius) / cellSize); ix++) keys.push(key(ix, iz));
    return keys;
  }
  function add(record) {
    validate([record.x, record.y, record.z, record.radius, record.trunkHeight], [record.radius, record.trunkHeight]);
    records.push(record);
    for (const k of cells(record.x, record.z, record.radius)) {
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(record);
    }
  }
  function overlaps({ x, z, radius, minY, maxY }) {
    validate([x, z, radius, minY, maxY], [radius, maxY - minY]);
    const candidates = new Set(cells(x, z, radius).flatMap(k => grid.get(k) || []));
    return [...candidates].filter(r => minY < r.y + r.trunkHeight && maxY > r.y - (r.baseDepth || 0)
      && Math.hypot(x - r.x, z - r.z) < radius + r.radius - 1e-8);
  }
  function resolveMovement(from, to, radius, height, fields) {
    validate([from.x, from.z, to.x, to.z, radius, height], [radius, height]);
    let x = from.x, z = from.z, blocked = false;
    const dx = to.x - x, dz = to.z - z;
    // Subdivide motion so even a large caller step cannot tunnel through a trunk.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.min(radius * 0.5, 0.1)));
    const valid = (cx, cz) => {
      if (Math.abs(cx) > half - radius || Math.abs(cz) > half - radius) return false;
      const s = fields.sample(cx, cz);
      return s && s.slope <= 0.5 && overlaps({ x: cx, z: cz, radius, minY: s.height, maxY: s.height + height }).length === 0;
    };
    for (let i = 0; i < steps; i++) {
      if (valid(x + dx / steps, z + dz / steps)) { x += dx / steps; z += dz / steps; }
      else {
        blocked = true;
        if (valid(x + dx / steps, z)) x += dx / steps;
        if (valid(x, z + dz / steps)) z += dz / steps;
      }
    }
    return { x, y: fields.heightAt(x, z), z, blocked };
  }
  return { records, add, overlaps, resolveMovement };
}
