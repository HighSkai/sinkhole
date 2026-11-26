<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Logo from '../logo/Logo.svelte';
  import Popover from '../ui/Popover.svelte';
  import Caret from '../ui/Caret.svelte';
  import { ui, PAGES } from '../state/ui.svelte';
  import { prefetch } from '../state/pages';
  import { sinkhole } from '../data/store.svelte';
  import { exportStats } from '../export';
  import { fmtCountdown } from '../format';
  import {
    Pause,
    Play,
    RefreshCw,
    Menu,
    ChevronLeft,
    ChevronRight,
    X,
    Check,
    Keyboard,
    Info,
    Layers,
    Download,
    Scan
  } from '../icons';

  let pauseOpen = $state(false);
  let menuOpen = $state(false);

  /* ---------- profile tabs ---------- */
  let openProfiles = $state<string[]>([]);
  let dir = $state(1);
  $effect(() => {
    if (sinkhole.profiles.length && !openProfiles.length) openProfiles = sinkhole.profiles.map((p) => p.id);
  });
  const idx = $derived(Math.max(0, openProfiles.indexOf(sinkhole.profile.id)));

  function cycle(d: number) {
    if (openProfiles.length < 2) return;
    dir = d;
    sinkhole.switchProfile(openProfiles[(idx + d + openProfiles.length) % openProfiles.length]);
  }
  function closeProfile() {
    if (openProfiles.length < 2) return;
    const name = sinkhole.profile.name;
    const i = idx;
    openProfiles = openProfiles.filter((p) => p !== sinkhole.profile.id);
    dir = 1;
    sinkhole.switchProfile(openProfiles[Math.min(i, openProfiles.length - 1)]);
    ui.toast(`Closed ${name} — reopen it from the menu`);
  }
  function openProfile(id: string) {
    if (!openProfiles.includes(id)) openProfiles = [...openProfiles, id];
    dir = openProfiles.indexOf(id) >= idx ? 1 : -1;
    sinkhole.switchProfile(id);
    menuOpen = false;
  }

  /* ---------- blocking ---------- */
  const PAUSES = [
    { label: '30 seconds', ms: 30_000 },
    { label: '5 minutes', ms: 300_000 },
    { label: '1 hour', ms: 3_600_000 },
    { label: 'Until re-enabled', ms: null }
  ];
  const remaining = $derived(sinkhole.pausedUntil ? sinkhole.pausedUntil - sinkhole.now : null);

  function pauseFor(ms: number | null, label: string) {
    sinkhole.pause(ms);
    pauseOpen = false;
    ui.toast(ms ? `Blocking paused for ${label.toLowerCase()}` : 'Blocking paused until re-enabled', 'warn');
  }
  function resume() {
    sinkhole.resume();
    pauseOpen = false;
    ui.toast('Blocking resumed', 'good');
  }

  async function updateLists() {
    const r = await sinkhole.updateLists();
    ui.toast(`Lists updated · +${r.added} domains`, 'good');
  }
  function doExport() {
    exportStats('csv');
    ui.toast('Exported stats as CSV', 'good');
  }
</script>

<header class="topbar">
  <!-- left: brand + page tabs -->
  <div class="area-left flex min-w-0 items-center gap-4">
    <a href="#/pipeline" class="brand" aria-label="sinkhole home">
      <Logo width={40} paused={sinkhole.paused} idle={ui.motion} swirl={0.7} />
      <span class="wordmark">sinkhole</span>
    </a>
    <nav class="tabs" aria-label="Pages">
      {#each PAGES as p (p.id)}
        <button
          type="button"
          class="tab"
          class:active={ui.page === p.id}
          aria-current={ui.page === p.id ? 'page' : undefined}
          onclick={() => ui.go(p.id)}
          onpointerenter={() => prefetch(p.id)}
          onfocus={() => prefetch(p.id)}
        >
          {p.label}
        </button>
      {/each}
    </nav>
  </div>

  <!-- center: profile breadcrumb -->
  <div class="area-center flex flex-col items-center">
    <div class="crumb">
      <button type="button" class="crumb-arrow" aria-label="Previous profile" onclick={() => cycle(-1)} disabled={openProfiles.length < 2}>
        <ChevronLeft size={14} />
      </button>
      <div class="crumb-tab">
        <span class="crumb-dot" class:paused={sinkhole.paused}></span>
        <span class="crumb-name">
          {#key sinkhole.profile.id}
            <span
              class="block"
              in:fly={{ x: 10 * dir, duration: ui.reducedMotion ? 0 : 220, easing: cubicOut }}
            >
              {sinkhole.profile.name}
            </span>
          {/key}
        </span>
        <button type="button" class="crumb-x" aria-label="Close profile" onclick={closeProfile} disabled={openProfiles.length < 2}>
          <X size={12} />
        </button>
      </div>
      <button type="button" class="crumb-arrow" aria-label="Next profile" onclick={() => cycle(1)} disabled={openProfiles.length < 2}>
        <ChevronRight size={14} />
      </button>
    </div>
    <div class="subtitle mono">sinkhole v1.0</div>
  </div>

  <!-- right: actions -->
  <div class="area-right flex items-center justify-end gap-2">
    <div class="icon-group">
      <Popover bind:open={pauseOpen} width={232}>
        {#snippet trigger()}
          <button
            type="button"
            class="pause-btn"
            class:paused={sinkhole.paused}
            aria-haspopup="menu"
            aria-expanded={pauseOpen}
            aria-label={sinkhole.paused ? 'Blocking paused — resume or change' : 'Pause blocking'}
            data-tip={sinkhole.paused ? 'Blocking paused' : 'Pause blocking'}
            onclick={() => (pauseOpen = !pauseOpen)}
          >
            {#if sinkhole.paused}
              <Play size={15} />
              {#if remaining !== null}<span class="mono text-[11px]">{fmtCountdown(remaining)}</span>{/if}
            {:else}
              <Pause size={15} />
            {/if}
            <Caret size={7} />
          </button>
        {/snippet}
        {#if sinkhole.paused}
          <button type="button" class="pop-item" onclick={resume}><Play size={14} /> Resume blocking</button>
          <div class="pop-sep"></div>
        {/if}
        <div class="pop-label">Pause blocking for</div>
        {#each PAUSES as p (p.label)}
          <button type="button" class="pop-item" onclick={() => pauseFor(p.ms, p.label)}>{p.label}</button>
        {/each}
      </Popover>

      <button
        type="button"
        class="icon-btn"
        aria-label="Refresh"
        data-tip="Refresh"
        onclick={() => sinkhole.refresh()}
      >
        <span class="inline-grid" class:spin={sinkhole.refreshing}><RefreshCw size={15} /></span>
      </button>

      <Popover bind:open={menuOpen} width={248}>
        {#snippet trigger()}
          <button
            type="button"
            class="icon-btn"
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-tip="Menu"
            onclick={() => (menuOpen = !menuOpen)}
          >
            <Menu size={15} />
          </button>
        {/snippet}
        <div class="pop-label">Profiles</div>
        {#each sinkhole.profiles as p (p.id)}
          <button type="button" class="pop-item" onclick={() => openProfile(p.id)}>
            {p.name}
            {#if p.id === sinkhole.profile.id}<span class="ml-auto"><Check size={14} /></span>{/if}
          </button>
        {/each}
        <div class="pop-sep"></div>
        <button
          type="button"
          class="pop-item"
          onclick={() => {
            menuOpen = false;
            ui.go('pipeline');
            ui.flow?.resetLayout();
          }}
        >
          <Scan size={14} /> Reset layout
        </button>
        <button type="button" class="pop-item" onclick={() => ((menuOpen = false), (ui.overlay = 'shortcuts'))}>
          <Keyboard size={14} /> Keyboard shortcuts <span class="kbd">?</span>
        </button>
        <button type="button" class="pop-item" onclick={() => ((menuOpen = false), (ui.overlay = 'about'))}>
          <Info size={14} /> About sinkhole
        </button>
      </Popover>
    </div>

    <button type="button" class="btn btn-ghost" onclick={updateLists} disabled={sinkhole.updatingLists} aria-label="Update lists">
      <span class="inline-grid" class:spin={sinkhole.updatingLists}><Layers size={14} /></span>
      <span class="btn-text">{sinkhole.updatingLists ? 'Updating…' : 'Update Lists'}</span>
    </button>
    <button type="button" class="btn btn-primary" onclick={doExport} aria-label="Export stats">
      <Download size={14} />
      <span class="btn-text">Export Stats</span>
    </button>
  </div>
</header>

<style>
  .topbar {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 40;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-areas: 'left center right';
    align-items: center;
    gap: 16px;
    padding: 16px 24px 0;
    pointer-events: none;
  }
  .topbar > * {
    pointer-events: auto;
  }
  .area-left {
    grid-area: left;
  }
  .area-center {
    grid-area: center;
  }
  .area-right {
    grid-area: right;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 4px;
  }
  .wordmark {
    font-size: 20px;
    font-weight: 300;
    letter-spacing: -0.01em;
    color: var(--color-ink);
    line-height: 1;
    padding-bottom: 2px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgb(28 28 31 / 0.85);
    border: 1px solid var(--color-line);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
  }
  .tab {
    height: 32px;
    padding: 0 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 400;
    color: var(--color-muted);
    white-space: nowrap;
    transition:
      background-color 180ms ease,
      color 180ms ease;
  }
  .tab:hover {
    color: var(--color-ink);
  }
  .tab.active {
    background: var(--color-pill-hi);
    color: var(--color-ink);
  }

  .crumb {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .crumb-arrow {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    color: var(--color-muted);
    transition:
      color 150ms ease,
      background-color 150ms ease;
  }
  .crumb-arrow:hover:not(:disabled) {
    color: var(--color-ink);
    background: rgb(255 255 255 / 0.05);
  }
  .crumb-arrow:disabled,
  .crumb-x:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .crumb-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px 0 14px;
    border-radius: 999px;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
    font-size: 13px;
    font-weight: 400;
  }
  .crumb-name {
    display: grid;
    min-width: 96px;
    overflow: hidden;
    white-space: nowrap;
  }
  .crumb-name > :global(span) {
    grid-area: 1 / 1;
  }
  .crumb-dot {
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: var(--color-allow);
    box-shadow: 0 0 8px rgb(74 222 128 / 0.7);
    transition:
      background-color 300ms ease,
      box-shadow 300ms ease;
  }
  .crumb-dot.paused {
    background: #77777f;
    box-shadow: none;
  }
  .crumb-x {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 99px;
    color: var(--color-muted);
  }
  .crumb-x:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.08);
    color: var(--color-ink);
  }
  .subtitle {
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-faint);
    letter-spacing: 0.02em;
  }

  .icon-group {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: 12px;
    background: rgb(28 28 31 / 0.85);
    border: 1px solid var(--color-line);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
  }
  .pause-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    color: var(--color-soft);
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }
  .pause-btn:hover {
    background: rgb(255 255 255 / 0.06);
    color: var(--color-ink);
  }
  .pause-btn.paused {
    background: rgb(248 113 113 / 0.14);
    color: #fca5a5;
  }

  @media (max-width: 1180px) {
    .topbar {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        'left right'
        'center center';
      row-gap: 10px;
      padding: 16px 16px 0;
    }
    .btn-text {
      display: none;
    }
    .btn {
      width: 36px;
      padding: 0;
      justify-content: center;
    }
  }
  @media (max-width: 900px) {
    .wordmark {
      display: none;
    }
    .tab {
      padding: 0 10px;
    }
  }
</style>
