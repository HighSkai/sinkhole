<script lang="ts">
  import type { EdgeProps } from '@xyflow/svelte';
  import { makeWire, wirePath, wires, hover, type WireKind } from './geometry';

  let { id, sourceX, sourceY, targetX, targetY, data }: EdgeProps = $props();

  const w = $derived(makeWire(sourceX, sourceY, targetX, targetY));
  const d = $derived(wirePath(w));
  const kind = $derived(((data?.kind as WireKind) ?? 'client') as WireKind);
  const order = $derived((data?.order as number) ?? 0);

  $effect(() => {
    wires.set(id, w);
  });
  $effect(() => () => {
    wires.delete(id);
    if (hover.edge === id) hover.edge = null;
  });

  let hovered = $state(false);
</script>

<g class="wire {kind}" class:hovered style="--order: {order}">
  <path class="base" {d} pathLength="1" />
  <path class="tint" {d} pathLength="1" />
  <path class="hi" {d} />
  <path
    class="hit"
    {d}
    role="presentation"
    onpointerenter={() => {
      hovered = true;
      hover.edge = id;
    }}
    onpointerleave={() => {
      hovered = false;
      if (hover.edge === id) hover.edge = null;
    }}
  />
</g>

<style>
  .wire path {
    fill: none;
  }
  .wire {
    --kc: #facc15;
  }
  .allow {
    --kc: #4ade80;
  }
  .block {
    --kc: #f87171;
  }
  .up {
    --kc: #60a5fa;
  }
  .base {
    stroke: rgb(255 255 255 / 0.18);
    stroke-width: 1.5;
  }
  .tint {
    stroke: var(--kc);
    stroke-width: 1.5;
    opacity: 0.16;
    transition: opacity 700ms ease;
  }
  :global(.paused) .tint {
    opacity: 0;
  }
  .hi {
    stroke: #fff;
    stroke-width: 1.75;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  .hovered .hi {
    opacity: 0.5;
  }
  .hovered .tint {
    opacity: 0.5;
  }
  .hit {
    stroke: transparent;
    stroke-width: 16;
    pointer-events: stroke;
    cursor: default;
  }

  /* load-in: wires draw themselves after the nodes have landed */
  :global(.intro) .base,
  :global(.intro) .tint {
    stroke-dasharray: 1;
    animation: draw 900ms cubic-bezier(0.65, 0, 0.35, 1) both;
    animation-delay: calc(560ms + var(--order) * 70ms);
  }
  @keyframes draw {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.intro) .base,
    :global(.intro) .tint {
      stroke-dasharray: none;
      animation: fade-in 500ms ease both;
      animation-delay: 200ms;
    }
  }
</style>
