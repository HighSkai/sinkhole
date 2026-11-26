<script lang="ts">
  interface Props {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fill?: boolean;
    stroke?: number;
    dot?: boolean;
    class?: string;
  }
  let { data, width = 64, height = 20, color = '#facc15', fill = true, stroke = 1.25, dot = false, class: cls = '' }: Props =
    $props();
  const uid = $props.id();

  /** Hand-rolled smooth path: Catmull-Rom → cubic bezier, clamped to the box. */
  function build(values: number[], w: number, h: number) {
    const n = values.length;
    if (n < 2) return { line: '', area: '', last: { x: w, y: h } };
    const pad = 2;
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max - min < 1e-6) {
      max += 1;
      min -= 1;
    }
    const pts = values.map((v, i) => ({
      x: (i / (n - 1)) * w,
      y: pad + (1 - (v - min) / (max - min)) * (h - pad * 2)
    }));
    const c = (v: number) => Math.min(h, Math.max(0, v)).toFixed(1);
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];
      d += `C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${c(p1.y + (p2.y - p0.y) / 6)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${c(p2.y - (p3.y - p1.y) / 6)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return { line: d, area: `${d}L${w} ${h}L0 ${h}Z`, last: pts[n - 1] };
  }

  const p = $derived(build(data, width, height));
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" class="block overflow-visible {cls}" aria-hidden="true">
  {#if fill}
    <defs>
      <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={color} stop-opacity="0.3" />
        <stop offset="1" stop-color={color} stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d={p.area} fill="url(#{uid})" />
  {/if}
  <path d={p.line} fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" />
  {#if dot}
    <circle cx={p.last.x} cy={p.last.y} r="1.8" fill={color} />
  {/if}
</svg>
