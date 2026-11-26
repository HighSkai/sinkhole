<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { fade } from 'svelte/transition';
  import TopBar from './lib/shell/TopBar.svelte';
  import RightToolbar from './lib/shell/RightToolbar.svelte';
  import CommandBar from './lib/shell/CommandBar.svelte';
  import LiveStats from './lib/shell/LiveStats.svelte';
  import Toasts from './lib/ui/Toasts.svelte';
  import Logo from './lib/logo/Logo.svelte';
  import { ui, PAGES, type Page } from './lib/state/ui.svelte';
  import { loadPage, prefetch } from './lib/state/pages';
  import { sinkhole } from './lib/data/store.svelte';

  // The pipeline stays mounted once loaded (keeps viewport + avoids replaying the intro);
  // other pages mount on demand.
  let Pipeline = $state<Component<{ active?: boolean }> | null>(null);
  let Other = $state<Component | null>(null);
  let otherId = $state<Page | null>(null);
  let Overlays = $state<Component | null>(null);

  $effect(() => {
    if (ui.overlay && !Overlays) import('./lib/shell/Overlays.svelte').then((m) => (Overlays = m.default));
  });

  $effect(() => {
    const p = ui.page;
    if (p === 'pipeline') {
      if (!Pipeline) loadPage('pipeline').then((c) => (Pipeline = c as Component<{ active?: boolean }>));
    } else {
      loadPage(p).then((c) => {
        if (ui.page === p) {
          Other = c;
          otherId = p;
        }
      });
    }
  });

  onMount(() => {
    sinkhole.start();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => PAGES.forEach((p) => prefetch(p.id)));
    return () => sinkhole.stop();
  });

  function onkey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '4') ui.go(PAGES[+k - 1].id);
    else if (k === '/') {
      e.preventDefault();
      ui.commandFocusToken++;
    } else if (k === 'p') sinkhole.paused ? sinkhole.resume() : sinkhole.pause(null);
    else if (k === 'a') ui.animations = !ui.animations;
    else if (k === 'm') ui.minimap = !ui.minimap;
    else if (k === 'f') ui.flow?.fitView();
    else if (k === '+' || k === '=') ui.flow?.zoomIn();
    else if (k === '-') ui.flow?.zoomOut();
    else if (k === '?') ui.overlay = 'shortcuts';
  }

  const booting = $derived(!sinkhole.ready || (ui.page === 'pipeline' && !Pipeline));
</script>

<svelte:window onkeydown={onkey} />

<div class="app" class:motion-off={!ui.motion} class:paused={sinkhole.paused} data-palette={ui.palette}>
  {#if Pipeline && sinkhole.ready}
    <div class="layer" class:hidden-layer={ui.page !== 'pipeline'} inert={ui.page !== 'pipeline'}>
      <Pipeline active={ui.page === 'pipeline'} />
    </div>
  {/if}

  {#if ui.page !== 'pipeline' && Other && sinkhole.ready}
    {#key otherId}
      <main class="layer page dot-grid" in:fade={{ duration: ui.reducedMotion ? 0 : 180 }}>
        <Other />
      </main>
    {/key}
  {/if}

  {#if booting}
    <div class="boot" out:fade={{ duration: 300 }}>
      <Logo width={96} idle={true} />
    </div>
  {/if}

  <TopBar />
  <RightToolbar />
  <LiveStats />
  <CommandBar />
  <Toasts />
  {#if Overlays}<Overlays />{/if}
</div>

<style>
  .app {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--color-canvas);
  }
  .layer {
    position: absolute;
    inset: 0;
  }
  .hidden-layer {
    visibility: hidden;
    pointer-events: none;
  }
  .page {
    z-index: 10;
    overflow-y: auto;
    padding: 96px 24px 160px;
  }
  @media (max-width: 1180px) {
    .page {
      padding: 140px 16px 150px;
    }
  }
  .hidden-layer :global(*) {
    animation-play-state: paused !important;
  }
  .boot {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: var(--color-canvas);
  }
</style>
