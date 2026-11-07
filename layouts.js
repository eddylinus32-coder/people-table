// Pure layout maths (no three.js dependency) so it can be unit-tested in Node.
// Each layout returns an array of { pos: [x, y, z], look: [x, y, z] | null }.
// `look` is the point the tile should face; null means "face the camera" (no rotation).

export const TABLE_COLS = 20;
export const TABLE_ROWS = 10;
export const GRID_X = 5;
export const GRID_Y = 4;
export const GRID_Z = 10;

// 20 columns x 10 rows
export function tableLayout(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const col = i % TABLE_COLS;
    const row = Math.floor(i / TABLE_COLS);
    out.push({
      pos: [(col - (TABLE_COLS - 1) / 2) * 140, -(row - (TABLE_ROWS - 1) / 2) * 180, 0],
      look: null
    });
  }
  return out;
}

export function sphereLayout(n) {
  const out = [];
  const radius = 800;
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(-1 + (2 * i) / n);
    const theta = Math.sqrt(n * Math.PI) * phi;
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    out.push({ pos: [x, y, z], look: [x * 2, y * 2, z * 2] });
  }
  return out;
}

// Double helix: even tiles form strand A, odd tiles form strand B (offset by half a turn).
export function helixLayout(n) {
  const out = [];
  const radius = 700;
  const step = 0.25;      // radians between neighbouring tiles on one strand
  const rise = 15;        // vertical drop per tile on one strand
  const perStrand = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const strand = i % 2;
    const k = Math.floor(i / 2);
    const angle = k * step + strand * Math.PI;
    const x = radius * Math.sin(angle);
    const z = radius * Math.cos(angle);
    const y = -(k - (perStrand - 1) / 2) * rise;
    out.push({ pos: [x, y, z], look: [x * 2, y, z * 2] });
  }
  return out;
}

// 5 (x) x 4 (y) x 10 (z)
export function gridLayout(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (i % GRID_X) * 400 - ((GRID_X - 1) / 2) * 400;
    const y = -(Math.floor(i / GRID_X) % GRID_Y) * 400 + ((GRID_Y - 1) / 2) * 400;
    const z = 400 - Math.floor(i / (GRID_X * GRID_Y)) * 800;
    out.push({ pos: [x, y, z], look: null });
  }
  return out;
}
