/**
 * Deterministic geometry for the sinkhole mark: a jagged, cracked rim seen at
 * a tilt (so the opening is an ellipse), a far-wall crescent, a deep void and
 * radiating cracks. Shared by the animated Svelte component and the static
 * SVG generator (scripts/gen-assets.ts) so the README logo matches the app.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Crack {
  /** tapered polygon */
  d: string;
  /** rim anchor — cracks scale from here when they retract/extend */
  origin: Pt;
  delay: number;
}

export interface LogoGeometry {
  w: number;
  h: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  lip: string;
  rim: string;
  /** the visible bottom of the pit (shifted down to reveal the far wall) */
  depth: { cx: number; cy: number; rx: number; ry: number };
  cracks: Crack[];
  wedges: { d: string; o: number }[];
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 100) / 100;
const poly = (pts: Pt[]) => 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join('L') + 'Z';

function jagged(cx: number, cy: number, rx: number, ry: number, n: number, amp: number, seed: number): Pt[] {
  const r = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.1;
    const k = 1 + (i % 2 ? -1 : 1) * (amp * 0.45 + r() * amp) + (r() - 0.5) * amp * 0.5;
    pts.push({ x: cx + rx * k * Math.cos(th), y: cy + ry * k * Math.sin(th) });
  }
  return pts;
}

/** Turn a polyline into a sharp tapered sliver. */
function taper(points: Pt[], w0: number): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = (w0 * (1 - i / (n - 1))) / 2;
    left.push({ x: points[i].x + nx * w, y: points[i].y + ny * w });
    right.push({ x: points[i].x - nx * w, y: points[i].y - ny * w });
  }
  return poly([...left, ...right.reverse()]);
}

export function makeLogo(ratio = 0.58, opts: { cracks?: number; seed?: number } = {}): LogoGeometry {
  const seed = opts.seed ?? 11;
  const w = 200;
  const rx = 66;
  const ry = rx * ratio;
  const pad = 26 + ry * 0.35;
  const h = Math.round(ry * 2 + pad * 2);
  const cx = w / 2;
  const cy = h / 2;

  const rimPts = jagged(cx, cy, rx, ry, 34, 0.05, seed);
  const lipPts = jagged(cx, cy + 1.2, rx * 1.09, ry * 1.11, 26, 0.045, seed + 5);

  // Cracks radiate from the rim, projected onto the tilted ground plane.
  const r = rng(seed + 23);
  const angles = [-2.55, -0.62, 0.32, 1.62, 2.72, -1.55].slice(0, opts.cracks ?? 5);
  const cracks: Crack[] = angles.map((a, i) => {
    // nearest rim vertex to this angle
    let best = rimPts[0];
    let bestD = Infinity;
    for (const p of rimPts) {
      const pa = Math.atan2((p.y - cy) / ratio, p.x - cx);
      const d = Math.abs(Math.atan2(Math.sin(pa - a), Math.cos(pa - a)));
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const pts: Pt[] = [{ x: best.x, y: best.y }];
    let dir = a;
    let p = best;
    const segs = [11, 8, 6];
    for (let s = 0; s < segs.length; s++) {
      dir += (s % 2 ? -1 : 1) * (0.28 + r() * 0.3);
      const len = segs[s] * (0.85 + r() * 0.4);
      p = { x: p.x + Math.cos(dir) * len, y: p.y + Math.sin(dir) * len * ratio };
      pts.push(p);
    }
    return { d: taper(pts, 2.3), origin: { x: best.x, y: best.y }, delay: i * 1.3 + r() * 0.8 };
  });

  // Swirl: curved wedges with a two-armed opacity profile ≈ a soft conic gradient.
  const wedges: { d: string; o: number }[] = [];
  const N = 28;
  const R = rx * 1.05;
  const twist = 1.4;
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2;
    const t1 = ((i + 1.08) / N) * Math.PI * 2;
    const edge = (t: number, rev = false) => {
      const out: Pt[] = [];
      for (let k = 0; k <= 6; k++) {
        const rr = (R * k) / 6;
        const th = t + twist * (k / 6);
        out.push({ x: rr * Math.cos(th), y: rr * Math.sin(th) });
      }
      return rev ? out.reverse() : out;
    };
    const a = 0.5 + 0.5 * Math.cos(2 * t0);
    wedges.push({ d: poly([...edge(t0), ...edge(t1, true)]), o: f(0.015 + 0.2 * a * a) });
  }

  return {
    w,
    h,
    cx,
    cy,
    rx,
    ry,
    lip: poly(lipPts),
    rim: poly(rimPts),
    depth: { cx, cy: cy + ry * 0.3, rx: rx * 0.95, ry: ry * 0.84 },
    cracks,
    wedges
  };
}
