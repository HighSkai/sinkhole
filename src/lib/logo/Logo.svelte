<script lang="ts">
  import { makeLogo } from './geometry';

  interface Props {
    width?: number;
    /** vertical squash of the opening — lower = more tilted */
    ratio?: number;
    cracks?: number;
    paused?: boolean;
    /** run idle loops (swirl, crack breathing) */
    idle?: boolean;
    swirl?: number;
    class?: string;
  }

  let { width = 40, ratio = 0.58, cracks = 5, paused = false, idle = true, swirl = 0.6, class: cls = '' }: Props =
    $props();

  const uid = $props.id();
  const g = $derived(makeLogo(ratio, { cracks }));

  let pulseEl = $state<SVGEllipseElement>();
  let cracksEl = $state<SVGGElement>();
  let ripples = $state<SVGEllipseElement[]>([]);
  let rippleIdx = 0;

  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Something fell in: pulse the void, ripple the rim, flicker the cracks. */
  export function fall(strength = 1) {
    if (paused) return;
    pulseEl?.animate([{ opacity: 0 }, { opacity: Math.min(1, 0.85 * strength), offset: 0.3 }, { opacity: 0 }], {
      duration: 200,
      easing: 'ease-out'
    });
    if (reduce) return;
    const r = ripples[rippleIdx++ % ripples.length];
    r?.animate(
      [
        { transform: 'scale(1)', opacity: 0.5 },
        { transform: 'scale(1.32)', opacity: 0 }
      ],
      { duration: 800, easing: 'cubic-bezier(.2,.7,.3,1)' }
    );
    cracksEl?.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }], {
      duration: 240
    });
  }
</script>

<svg
  viewBox="0 0 {g.w} {g.h}"
  width={width}
  height={(width * g.h) / g.w}
  class="logo {cls}"
  class:paused
  class:idle
  aria-hidden="true"
>
  <defs>
    <radialGradient id="{uid}-glow" cx="50%" cy="96%" r="82%">
      <stop offset="0" stop-color="#ff6b9d" />
      <stop offset="0.34" stop-color="#8b5cf6" stop-opacity="0.85" />
      <stop offset="0.66" stop-color="#4da3ff" stop-opacity="0.38" />
      <stop offset="1" stop-color="#4da3ff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-pulse" cx="50%" cy="92%" r="80%">
      <stop offset="0" stop-color="#ffe0ec" />
      <stop offset="0.3" stop-color="#ff6b9d" stop-opacity="0.95" />
      <stop offset="0.62" stop-color="#8b5cf6" stop-opacity="0.55" />
      <stop offset="1" stop-color="#4da3ff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{uid}-gray" cx="50%" cy="96%" r="82%">
      <stop offset="0" stop-color="#8d8d96" stop-opacity="0.6" />
      <stop offset="0.5" stop-color="#4a4a52" stop-opacity="0.35" />
      <stop offset="1" stop-color="#2a2a2e" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="{uid}-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3a44" />
      <stop offset="0.42" stop-color="#1c1c22" />
      <stop offset="1" stop-color="#09090c" />
    </linearGradient>
    <linearGradient id="{uid}-rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.1" />
      <stop offset="0.55" stop-color="#fff" stop-opacity="0.2" />
      <stop offset="1" stop-color="#fff" stop-opacity="0.72" />
    </linearGradient>
    <clipPath id="{uid}-open"><path d={g.rim} /></clipPath>
    <clipPath id="{uid}-depth">
      <ellipse cx={g.depth.cx} cy={g.depth.cy} rx={g.depth.rx} ry={g.depth.ry} />
    </clipPath>
  </defs>

  <!-- ground slab around the opening -->
  <path d={g.lip} fill="#25252c" stroke="rgba(255,255,255,0.06)" stroke-width="0.8" stroke-linejoin="miter" />

  <!-- cracks radiating outward -->
  <g bind:this={cracksEl} class="cracks">
    {#each g.cracks as c, i (i)}
      <g class="crack-r" style="transform-origin: {c.origin.x}px {c.origin.y}px">
        <path
          class="crack-b"
          d={c.d}
          style="transform-origin: {c.origin.x}px {c.origin.y}px; animation-delay: {c.delay}s"
        />
      </g>
    {/each}
  </g>

  <!-- the hole -->
  <g clip-path="url(#{uid}-open)">
    <path d={g.rim} fill="url(#{uid}-wall)" />
    <ellipse cx={g.depth.cx} cy={g.depth.cy} rx={g.depth.rx} ry={g.depth.ry} fill="#07070a" />
    <ellipse class="glow" cx={g.depth.cx} cy={g.depth.cy} rx={g.depth.rx} ry={g.depth.ry} fill="url(#{uid}-glow)" />
    <g clip-path="url(#{uid}-depth)" class="swirl-wrap" style="opacity: {swirl}">
      <g transform="translate({g.depth.cx} {g.depth.cy + g.depth.ry * 0.2}) scale(1 {ratio})">
        <g class="swirl">
          {#each g.wedges as w, i (i)}
            <path d={w.d} fill="#fff" fill-opacity={w.o} />
          {/each}
        </g>
      </g>
    </g>
    <ellipse
      bind:this={pulseEl}
      class="pulse"
      cx={g.depth.cx}
      cy={g.depth.cy}
      rx={g.depth.rx}
      ry={g.depth.ry}
      fill="url(#{uid}-pulse)"
    />
    <ellipse class="gray" cx={g.depth.cx} cy={g.depth.cy} rx={g.depth.rx} ry={g.depth.ry} fill="url(#{uid}-gray)" />
  </g>

  <path d={g.rim} fill="none" stroke="url(#{uid}-rim)" stroke-width="1.1" stroke-linejoin="miter" />

  {#each [0, 1, 2] as i (i)}
    <ellipse bind:this={ripples[i]} class="ripple" cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} />
  {/each}
</svg>

<style>
  .logo {
    display: block;
    overflow: visible;
  }

  .crack-b {
    fill: #5c5c68;
    transform-box: view-box;
    animation: crack-breathe 6.5s ease-in-out infinite;
    animation-play-state: paused;
  }
  .idle .crack-b {
    animation-play-state: running;
  }
  .crack-r {
    transform-box: view-box;
    transition:
      transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 500ms ease;
  }
  .paused .crack-r {
    transform: scale(0.1);
    opacity: 0.35;
    transition:
      transform 520ms cubic-bezier(0.55, 0, 0.75, 0.2),
      opacity 520ms ease;
  }
  @keyframes crack-breathe {
    0%,
    72%,
    100% {
      transform: scale(1);
    }
    80% {
      transform: scale(1.09);
    }
    88% {
      transform: scale(0.99);
    }
  }

  .swirl {
    transform-box: fill-box;
    transform-origin: center;
    animation: swirl 20s linear infinite;
    animation-play-state: paused;
    mix-blend-mode: screen;
  }
  .idle .swirl {
    animation-play-state: running;
  }
  @keyframes swirl {
    to {
      transform: rotate(360deg);
    }
  }

  .glow,
  .gray,
  .swirl-wrap {
    transition: opacity 700ms ease;
  }
  .pulse,
  .gray {
    opacity: 0;
  }
  .paused .glow {
    opacity: 0.12;
  }
  .paused .gray {
    opacity: 1;
  }
  .paused .swirl-wrap {
    opacity: 0.12 !important;
  }

  .ripple {
    fill: none;
    stroke: #fff;
    stroke-width: 0.9;
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .crack-b,
    .swirl {
      animation: none;
    }
    .crack-r,
    .paused .crack-r {
      transform: none;
      transition: opacity 400ms ease;
    }
  }
</style>
