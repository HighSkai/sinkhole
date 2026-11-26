<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui } from '../state/ui.svelte';
  import { sinkhole } from '../data/store.svelte';
  import { fmt, fmtUptime } from '../format';
  import Logo from '../logo/Logo.svelte';
  import Odometer from '../ui/Odometer.svelte';
  import { X } from '../icons';
  import { fallBus } from '../../pages/pipeline/geometry';

  const SHORTCUTS: [string, string][] = [
    ['1 – 4', 'Switch page'],
    ['/', 'Search a domain or device'],
    ['P', 'Pause / resume blocking'],
    ['A', 'Toggle animations'],
    ['M', 'Toggle minimap'],
    ['F', 'Fit view'],
    ['+ / −', 'Zoom in / out'],
    ['Esc', 'Close panels'],
    ['?', 'This sheet']
  ];

  let bigLogo = $state<ReturnType<typeof Logo>>();
  $effect(() => {
    if (ui.overlay !== 'sinkhole') return;
    return fallBus.on(() => bigLogo?.fall(1.1));
  });

  const max = $derived(sinkhole.topBlocked[0]?.[1] ?? 1);
  const dur = $derived(ui.reducedMotion ? 0 : 200);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && ui.overlay && (ui.overlay = null)} />

{#if ui.overlay}
  <div class="scrim" transition:fade={{ duration: dur }} onclick={() => (ui.overlay = null)} role="presentation"></div>
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-label={ui.overlay}>
    <div class="modal surface" class:wide={ui.overlay === 'sinkhole'} transition:scale={{ start: 0.97, duration: dur * 1.2, easing: cubicOut }}>
      <button type="button" class="icon-btn close" aria-label="Close" onclick={() => (ui.overlay = null)}><X size={16} /></button>

      {#if ui.overlay === 'shortcuts'}
        <h2>Keyboard shortcuts</h2>
        <dl class="keys">
          {#each SHORTCUTS as [k, v] (k)}
            <div><dt class="mono">{k}</dt><dd>{v}</dd></div>
          {/each}
        </dl>
      {:else if ui.overlay === 'about'}
        <div class="flex items-center gap-4">
          <Logo width={88} paused={sinkhole.paused} idle={ui.motion} />
          <div>
            <h2 class="mb-1!">sinkhole <span class="mono text-[12px] text-muted">v1.0.0</span></h2>
            <p class="text-sm text-muted">Self-hosted, network-wide DNS ad blocking — visualised as a live pipeline.</p>
          </div>
        </div>
        <dl class="keys mt-6">
          <div><dt>Data source</dt><dd class="mono">{sinkhole.sourceLabel}</dd></div>
          <div><dt>Profile</dt><dd>{sinkhole.profile.name}</dd></div>
          <div><dt>Uptime</dt><dd class="mono">{fmtUptime(sinkhole.now - sinkhole.startedAt)}</dd></div>
          <div><dt>Blocklist domains</dt><dd class="mono">{fmt(sinkhole.totalDomains)}</dd></div>
          <div><dt>License</dt><dd>MIT</dd></div>
        </dl>
      {:else if ui.overlay === 'sinkhole'}
        <div class="big">
          <div class="big-hole">
            <div class="glow-bg"></div>
            <Logo bind:this={bigLogo} width={420} ratio={0.7} cracks={6} paused={sinkhole.paused} idle={ui.motion} swirl={0.75} />
          </div>
          <div class="big-side">
            <span class="label">Blocked today</span>
            <Odometer value={sinkhole.blockedToday} class="text-[40px] font-[400] tracking-tight" />
            <span class="label mt-1">{sinkhole.blockedPct.toFixed(1)}% of {fmt(sinkhole.totalToday)} queries</span>
            <h3 class="label mt-6 mb-2">Top blocked</h3>
            <ol class="bars">
              {#each sinkhole.topBlocked.slice(0, 8) as [d, n], i (d)}
                <li>
                  <span class="mono rank">{String(i + 1).padStart(2, '0')}</span>
                  <span class="mono truncate">{d}</span>
                  <span class="mono n">{fmt(n)}</span>
                  <span class="bar" style="transform: scaleX({n / max})"></span>
                </li>
              {/each}
            </ol>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgb(8 8 10 / 0.62);
  }
  .modal-wrap {
    position: fixed;
    inset: 0;
    z-index: 91;
    display: grid;
    place-items: center;
    padding: 24px;
    pointer-events: none;
  }
  .modal {
    position: relative;
    width: min(440px, 100%);
    padding: 24px;
    pointer-events: auto;
  }
  .modal.wide {
    width: min(920px, 100%);
  }
  .close {
    position: absolute;
    top: 12px;
    right: 12px;
  }
  h2 {
    font-size: 18px;
    font-weight: 400;
    margin-bottom: 16px;
  }
  .keys {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .keys > div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 8px 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.05);
    font-size: 13px;
  }
  .keys dt {
    color: var(--color-muted);
  }
  .big {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 24px;
    align-items: center;
  }
  .big-hole {
    position: relative;
    display: grid;
    place-items: center;
    padding: 32px 0;
    border-radius: 14px;
    background: var(--color-inset);
    overflow: hidden;
  }
  .glow-bg {
    position: absolute;
    inset: 15%;
    border-radius: 50%;
    background: radial-gradient(circle, rgb(139 92 246 / 0.28), transparent 65%);
  }
  .big-side {
    display: flex;
    flex-direction: column;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bars li {
    position: relative;
    display: grid;
    grid-template-columns: 22px 1fr auto;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
    border-radius: 8px;
    overflow: hidden;
  }
  .rank {
    color: var(--color-faint);
  }
  .n {
    color: var(--color-soft);
  }
  .bar {
    position: absolute;
    inset: 0;
    z-index: -1;
    transform-origin: left;
    background: linear-gradient(90deg, rgb(248 113 113 / 0.18), rgb(248 113 113 / 0.05));
    transition: transform 600ms var(--ease-out-soft);
  }
  @media (max-width: 860px) {
    .big {
      grid-template-columns: 1fr;
    }
  }
</style>
