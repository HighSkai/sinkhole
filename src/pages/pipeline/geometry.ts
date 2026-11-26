/**
 * Shared, non-reactive geometry for the pipeline: every wire registers its
 * bezier here so the packet canvas can move dots along the exact same curves
 * the SVG draws, at constant speed (arc-length parametrised).
 */

export type WireKind = 'client' | 'allow' | 'block' | 'up';

export interface Wire {
  sx: number;
  sy: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  tx: number;
  ty: number;
  len: number;
  lut: Float32Array;
}

const N = 40;

function bez(a: number, b: number, c: number, d: number, t: number) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

export function makeWire(sx: number, sy: number, tx: number, ty: number): Wire {
  const dx = Math.max(Math.abs(tx - sx) * 0.5, 60);
  const w: Wire = { sx, sy, c1x: sx + dx, c1y: sy, c2x: tx - dx, c2y: ty, tx, ty, len: 0, lut: new Float32Array(N + 1) };
  let px = sx;
  let py = sy;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const x = bez(sx, w.c1x, w.c2x, tx, t);
    const y = bez(sy, w.c1y, w.c2y, ty, t);
    w.lut[i] = w.lut[i - 1] + Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  w.len = w.lut[N];
  return w;
}

export const wirePath = (w: Wire) =>
  `M${w.sx},${w.sy} C${w.c1x},${w.c1y} ${w.c2x},${w.c2y} ${w.tx},${w.ty}`;

/** Point at arc-length `dist` along the wire, written into `out`. */
export function pointAt(w: Wire, dist: number, out: { x: number; y: number }) {
  const d = Math.max(0, Math.min(w.len, dist));
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (w.lut[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = w.lut[hi] - w.lut[lo] || 1;
  const t = (lo + (d - w.lut[lo]) / seg) / N;
  out.x = bez(w.sx, w.c1x, w.c2x, w.tx, t);
  out.y = bez(w.sy, w.c1y, w.c2y, w.ty, t);
  return out;
}

export const wires = new Map<string, Wire>();

export const hover = { edge: null as string | null };

/** Hole centre (flow coords) published by the Sinkhole node. */
export const sinkTarget = { x: 0, y: 0, rx: 60, ry: 40, ready: false };

/** Fired when a packet finishes falling into the hole. */
export const fallBus = {
  listeners: new Set<() => void>(),
  on(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  },
  emit() {
    for (const fn of this.listeners) fn();
  }
};
