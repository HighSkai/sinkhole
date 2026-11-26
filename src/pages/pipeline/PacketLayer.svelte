<script lang="ts">
  import { onMount } from 'svelte';
  import type { Viewport } from '@xyflow/svelte';
  import { queryBus } from '../../lib/data/bus';
  import { sinkhole } from '../../lib/data/store.svelte';
  import { ui } from '../../lib/state/ui.svelte';
  import type { DnsQuery } from '../../lib/data/types';
  import { wires, pointAt, hover, sinkTarget, fallBus } from './geometry';

  let { getViewport, active }: { getViewport: () => Viewport; active: boolean } = $props();

  const MAX_PACKETS = 200;
  const SAMPLE_QPS = 40; // above this rate, sample so the canvas stays readable
  const SPEED = 230; // flow px / s
  const DWELL = 0.09; // s spent "inside" a node between wires
  const SPIRAL = 1.15; // s

  type Col = 'y' | 'g' | 'r' | 'b' | 'w';
  interface Packet {
    route: string[];
    cols: [Col, Col][];
    seg: number;
    dist: number;
    phase: 'wire' | 'dwell' | 'approach' | 'spiral' | 'fade';
    t: number;
    end: 'up' | 'sink' | 'cache';
    ax: number;
    ay: number;
  }
  interface Flash {
    x: number;
    y: number;
    c: Col;
    t: number;
    life: number;
    big?: boolean;
  }

  const COLORS: Record<Col, string> = {
    y: '#facc15',
    g: '#4ade80',
    r: '#f87171',
    b: '#60a5fa',
    w: '#c9c9d0'
  };

  let canvas = $state<HTMLCanvasElement>();
  let ctx: CanvasRenderingContext2D | null = null;
  let dpr = 1;
  let W = 0;
  let H = 0;
  const packets: Packet[] = [];
  const flashes: Flash[] = [];
  const sprites = {} as Record<Col, HTMLCanvasElement>;
  let raf = 0;
  let last = 0;
  const tmp = { x: 0, y: 0 };

  const running = $derived(active && ui.motion);

  function makeSprites() {
    for (const [k, c] of Object.entries(COLORS) as [Col, string][]) {
      const s = document.createElement('canvas');
      s.width = s.height = 48;
      const g = s.getContext('2d')!;
      const grd = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.16, c);
      grd.addColorStop(0.42, c + '55');
      grd.addColorStop(1, c + '00');
      g.fillStyle = grd;
      g.fillRect(0, 0, 48, 48);
      sprites[k] = s;
    }
  }

  function routeFor(q: DnsQuery): Pick<Packet, 'route' | 'cols' | 'end'> | null {
    const c = `e-c-${q.client}`;
    if (!wires.has(c)) return null;
    const paused = sinkhole.paused;
    if (q.bypassed || paused) {
      return { route: [c, 'e-q-dc', 'e-dc-up'], cols: [['w', 'w'], ['w', 'w'], ['w', 'w']], end: 'up' };
    }
    switch (q.status) {
      case 'blocked':
        return { route: [c, 'e-q-bl', 'e-bl-dc', 'e-dc-sk'], cols: [['y', 'y'], ['y', 'y'], ['y', 'r'], ['r', 'r']], end: 'sink' };
      case 'allowlisted':
        return { route: [c, 'e-q-al', 'e-al-dc', 'e-dc-up'], cols: [['y', 'y'], ['y', 'y'], ['y', 'g'], ['g', 'g']], end: 'up' };
      case 'cached':
        return { route: [c, 'e-q-dc'], cols: [['y', 'y'], ['y', 'b']], end: 'cache' };
      default:
        return { route: [c, 'e-q-dc', 'e-dc-up'], cols: [['y', 'y'], ['y', 'g'], ['g', 'g']], end: 'up' };
    }
  }

  function endPoint(id: string) {
    const w = wires.get(id);
    return w ? { x: w.tx, y: w.ty } : null;
  }

  function spawn(batch: DnsQuery[]) {
    if (!running || !batch.length) return;
    const prob = sinkhole.qps > SAMPLE_QPS ? SAMPLE_QPS / sinkhole.qps : 1;
    for (const q of batch) {
      if (packets.length >= MAX_PACKETS) break;
      if (prob < 1 && Math.random() > prob) continue;
      const r = routeFor(q);
      if (!r) continue;

      if (ui.reducedMotion) {
        // no travel: a soft fade at the destination instead
        const p =
          r.end === 'sink'
            ? sinkTarget.ready
              ? { x: sinkTarget.x, y: sinkTarget.y }
              : endPoint('e-dc-sk')
            : endPoint(r.route[r.route.length - 1]);
        if (p) flashes.push({ x: p.x, y: p.y, c: r.end === 'sink' ? 'r' : r.end === 'cache' ? 'b' : r.cols.at(-1)![1], t: 0, life: 0.7, big: true });
        if (r.end === 'sink') fallBus.emit();
        continue;
      }
      packets.push({ ...r, seg: 0, dist: 0, phase: 'wire', t: 0, ax: 0, ay: 0 });
    }
    kick();
  }

  function kick() {
    if (!raf && running) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function step(p: Packet, dt: number): boolean {
    p.t += dt;
    if (p.phase === 'wire') {
      const id = p.route[p.seg];
      const w = wires.get(id);
      if (!w) return false;
      p.dist += SPEED * dt * (hover.edge === id ? 2 : 1);
      if (p.dist >= w.len) {
        flashes.push({ x: w.tx, y: w.ty, c: p.cols[p.seg][1], t: 0, life: 0.32 });
        if (p.seg < p.route.length - 1) {
          p.seg++;
          p.dist = 0;
          p.phase = 'dwell';
          p.t = 0;
        } else if (p.end === 'sink' && sinkTarget.ready) {
          p.phase = 'approach';
          p.t = 0;
          p.ax = w.tx;
          p.ay = w.ty;
        } else if (p.end === 'cache') {
          flashes.push({ x: w.tx, y: w.ty, c: 'b', t: 0, life: 0.5, big: true });
          return false;
        } else {
          if (p.end === 'sink') fallBus.emit();
          return false;
        }
      }
    } else if (p.phase === 'dwell') {
      if (p.t >= DWELL) {
        p.phase = 'wire';
        p.t = 0;
      }
    } else if (p.phase === 'approach') {
      if (p.t >= 0.42) {
        p.phase = 'spiral';
        p.t = 0;
      }
    } else if (p.phase === 'spiral') {
      if (p.t >= SPIRAL) {
        fallBus.emit();
        return false;
      }
    }
    return true;
  }

  function draw(p: Packet, zoomSize: number) {
    if (!ctx) return;
    if (p.phase === 'dwell') return;
    const pair = p.cols[Math.min(p.seg, p.cols.length - 1)];
    if (p.phase === 'wire') {
      const w = wires.get(p.route[p.seg]);
      if (!w) return;
      const k = p.dist / w.len;
      // fade in/out at the ports so hops read as "through the node"
      const edgeA = Math.min(1, p.dist / 14, (w.len - p.dist) / 10 + 0.25);
      for (let g = 3; g >= 0; g--) {
        const d = p.dist - g * 7;
        if (d < 0) continue;
        pointAt(w, d, tmp);
        const a = edgeA * (g === 0 ? 1 : 0.42 - g * 0.11);
        const s = zoomSize * (g === 0 ? 1 : 0.8 - g * 0.12);
        blit(pair, k, tmp.x, tmp.y, s, a);
      }
      return;
    }
    const T = sinkTarget;
    if (p.phase === 'approach') {
      const u = easeInOut(Math.min(1, p.t / 0.42));
      const ex = T.x - T.rx * 0.96;
      const ey = T.y;
      const cx = p.ax + (ex - p.ax) * 0.75;
      const cy = p.ay;
      const x = (1 - u) * (1 - u) * p.ax + 2 * (1 - u) * u * cx + u * u * ex;
      const y = (1 - u) * (1 - u) * p.ay + 2 * (1 - u) * u * cy + u * u * ey;
      blit(['r', 'r'], 1, x, y, zoomSize, 1);
      return;
    }
    // spiral into the void, shrinking and fading
    const t = Math.min(1, p.t / SPIRAL);
    const th = Math.PI + 2.4 * Math.PI * 2 * easeIn(t);
    const r = 1 - Math.pow(t, 0.75);
    const x = T.x + Math.cos(th) * T.rx * 0.96 * r;
    const y = T.y + Math.sin(th) * T.ry * 0.96 * r;
    const a = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    blit(['r', 'r'], 1, x, y, zoomSize * (1 - 0.72 * t), a);
  }

  function blit(pair: [Col, Col], k: number, x: number, y: number, s: number, a: number) {
    if (!ctx || a <= 0) return;
    const h = s / 2;
    if (pair[0] === pair[1] || k <= 0.02) {
      ctx.globalAlpha = a;
      ctx.drawImage(sprites[pair[0]], x - h, y - h, s, s);
    } else {
      ctx.globalAlpha = a * (1 - k);
      ctx.drawImage(sprites[pair[0]], x - h, y - h, s, s);
      ctx.globalAlpha = a * k;
      ctx.drawImage(sprites[pair[1]], x - h, y - h, s, s);
    }
  }

  const easeIn = (t: number) => t * t;
  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function frame(now: number) {
    raf = 0;
    if (!ctx || !running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    for (let i = packets.length - 1; i >= 0; i--) if (!step(packets[i], dt)) packets.splice(i, 1);
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].t += dt;
      if (flashes[i].t >= flashes[i].life) flashes.splice(i, 1);
    }

    const vp = getViewport();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * vp.zoom, 0, 0, dpr * vp.zoom, dpr * vp.x, dpr * vp.y);
    ctx.globalCompositeOperation = 'lighter';

    const size = Math.max(16, 11 / vp.zoom);
    for (const f of flashes) {
      const k = f.t / f.life;
      const s = (f.big ? 26 : 12) * (1 + k * 1.4) * (size / 16);
      blit([f.c, f.c], 0, f.x, f.y, s, (f.big ? 0.9 : 0.55) * (1 - k));
    }
    for (const p of packets) draw(p, size);
    ctx.globalAlpha = 1;

    if (packets.length || flashes.length) raf = requestAnimationFrame(frame);
  }

  function clearAll() {
    packets.length = 0;
    flashes.length = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
    }
  }

  // stop everything when the tab hides, animations are toggled off, or the page is left
  $effect(() => {
    if (!running) clearAll();
  });

  onMount(() => {
    ctx = canvas!.getContext('2d');
    makeSprites();
    const ro = new ResizeObserver(([e]) => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.round(e.contentRect.width * dpr);
      H = Math.round(e.contentRect.height * dpr);
      canvas!.width = W;
      canvas!.height = H;
    });
    ro.observe(canvas!);
    const off = queryBus.on(spawn);
    return () => {
      off();
      ro.disconnect();
      clearAll();
    };
  });
</script>

<canvas bind:this={canvas} class="packets" aria-hidden="true"></canvas>

<style>
  .packets {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
  }
</style>
