<script lang="ts">
  import { ViewportPortal, type Node } from '@xyflow/svelte';

  let { nodes, selected, dim = false }: { nodes: Node[]; selected: string; dim?: boolean } = $props();

  function center(id: string) {
    const n = nodes.find((x) => x.id === id);
    if (!n) return { x: 0, y: 0 };
    const w = n.measured?.width ?? n.width ?? 280;
    const h = n.measured?.height ?? n.height ?? 300;
    return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
  }

  // the core glow always sits behind Decision; a second pair drifts to the selected node
  const core = $derived(center('decision'));
  const follow = $derived(center(selected));
</script>

<ViewportPortal target="back">
  <div class="aurora" class:dim aria-hidden="true">
    <div class="anchor" style="transform: translate3d({core.x}px, {core.y}px, 0)">
      <div class="blob a"></div>
      <div class="blob b"></div>
      <div class="blob c"></div>
    </div>
    <div class="anchor follow" style="transform: translate3d({follow.x}px, {follow.y}px, 0)">
      <div class="blob d"></div>
      <div class="blob e"></div>
    </div>
  </div>
</ViewportPortal>

<style>
  .aurora {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    transition: opacity 900ms ease;
  }
  .aurora.dim {
    opacity: 0.3;
  }
  .anchor {
    position: absolute;
    left: 0;
    top: 0;
    will-change: transform;
  }
  .follow {
    transition: transform 1600ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  /* Pre-rendered radial gradients — no live blur filters. */
  .blob {
    position: absolute;
    width: 620px;
    height: 620px;
    left: -310px;
    top: -310px;
    border-radius: 50%;
    will-change: transform;
    animation: drift-a 26s ease-in-out infinite alternate;
  }
  .a {
    background: radial-gradient(closest-side, color-mix(in srgb, var(--aurora-b) 34%, transparent), transparent);
  }
  .b {
    width: 480px;
    height: 480px;
    left: -240px;
    top: -240px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--aurora-a) 28%, transparent), transparent);
    animation-name: drift-b;
    animation-duration: 22s;
  }
  .c {
    width: 520px;
    height: 520px;
    left: -260px;
    top: -260px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--aurora-c) 26%, transparent), transparent);
    animation-name: drift-c;
    animation-duration: 29s;
  }
  .d {
    width: 440px;
    height: 440px;
    left: -220px;
    top: -220px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--aurora-a) 18%, transparent), transparent);
    animation-name: drift-b;
    animation-duration: 24s;
  }
  .e {
    width: 400px;
    height: 400px;
    left: -200px;
    top: -200px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--aurora-c) 16%, transparent), transparent);
    animation-name: drift-c;
    animation-duration: 27s;
  }
  @keyframes drift-a {
    0% {
      transform: translate3d(-70px, -40px, 0) scale(1);
    }
    50% {
      transform: translate3d(40px, 30px, 0) scale(1.1);
    }
    100% {
      transform: translate3d(-10px, 60px, 0) scale(0.94);
    }
  }
  @keyframes drift-b {
    0% {
      transform: translate3d(90px, 40px, 0) scale(0.95);
    }
    50% {
      transform: translate3d(-30px, -60px, 0) scale(1.08);
    }
    100% {
      transform: translate3d(60px, -20px, 0) scale(1);
    }
  }
  @keyframes drift-c {
    0% {
      transform: translate3d(-40px, 80px, 0) scale(1.05);
    }
    50% {
      transform: translate3d(70px, 10px, 0) scale(0.92);
    }
    100% {
      transform: translate3d(-60px, -50px, 0) scale(1.06);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .blob {
      animation: none;
    }
    .follow {
      transition: none;
    }
  }
</style>
