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

// ---------------------------------------------------------------------------
// Tetrahedron (4-face pyramid). One vertex points up; the four triangular faces
// each carry ~n/4 tiles laid out in rows that widen from the apex to the base.
// Tiles face outward, and `up` keeps the text upright along each face.
// ---------------------------------------------------------------------------
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => vmul(a, 1 / (vlen(a) || 1));

// Split m tiles over R rows with counts proportional to row width (1..R), summing to exactly m.
export function pyramidRowCounts(m, R) {
  const total = (R * (R + 1)) / 2;
  const raw = Array.from({ length: R }, (_, r) => (m * (r + 1)) / total);
  const counts = raw.map(Math.floor);
  let rest = m - counts.reduce((a, b) => a + b, 0);
  const order = raw.map((v, r) => [v - Math.floor(v), r]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % R, rest--) counts[order[k][1]]++;
  return counts;
}

export function pyramidLayout(n) {
  const S = 1950;                          // edge length
  const R = (S * Math.sqrt(6)) / 4;        // circumradius (centre to vertex)
  const top = [0, R, 0];
  const base = [90, 210, 330].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const rho = (R * Math.sqrt(8)) / 3;
    return [rho * Math.cos(a), -R / 3, rho * Math.sin(a)];
  });
  const [b0, b1, b2] = base;
  // [apex, left, right] per face. A base corner points at the camera (+z), so two faces show at once.
  const faces = [
    [top, b1, b0],
    [top, b2, b1],
    [top, b0, b2],
    [b0, b1, b2]                           // bottom face
  ];

  const out = new Array(n);
  const per = Math.floor(n / 4);
  const extra = n % 4;
  let next = 0;
  faces.forEach(([A, B, C], f) => {
    const m = per + (f < extra ? 1 : 0);
    if (!m) return;
    const rows = Math.max(1, Math.ceil(Math.sqrt(2 * m)) - 1);
    const counts = pyramidRowCounts(m, rows);
    const centroid = vmul(vadd(vadd(A, B), C), 1 / 3);
    const normal = vnorm(centroid);        // tetrahedron is centred on the origin
    const up = vnorm(vsub(A, vmul(vadd(B, C), 0.5)));
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.5) / rows;
      const left = vadd(A, vmul(vsub(B, A), t));
      const right = vadd(A, vmul(vsub(C, A), t));
      for (let j = 0; j < counts[r]; j++) {
        const u = (j + 0.5) / counts[r];
        const raw = vadd(left, vmul(vsub(right, left), u));
        const pos = vadd(centroid, vmul(vsub(raw, centroid), 0.92)); // inset from the edges
        out[next++] = { pos, look: vadd(pos, vmul(normal, 1000)), up };
      }
    }
  });
  return out;
}
