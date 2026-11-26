<script lang="ts">
  import type { Component } from 'svelte';
  import { ui } from '../state/ui.svelte';
  import { sinkhole } from '../data/store.svelte';
  import type { CmdTab } from './command';
  import { Search, Clock, ListTree, MonitorSmartphone, ChartColumn, Palette, Settings } from '../icons';

  const TABS: { id: CmdTab; label: string; icon: Component }[] = [
    { id: 'history', label: 'History', icon: Clock },
    { id: 'lists', label: 'Lists', icon: ListTree },
    { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
    { id: 'stats', label: 'Stats', icon: ChartColumn },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'settings', label: 'Quick settings', icon: Settings }
  ];

  let tab = $state<CmdTab>('history');
  let open = $state(false);
  let q = $state('');
  let input = $state<HTMLInputElement>();
  let root = $state<HTMLDivElement>();
  let Panel = $state<Component<{ tab: CmdTab; title: string; needle: string; close: () => void }> | null>(null);

  const needle = $derived(q.trim().toLowerCase());
  const title = $derived(TABS.find((t) => t.id === tab)?.label ?? '');

  $effect(() => {
    if (open && !Panel) import('./CommandPanel.svelte').then((m) => (Panel = m.default));
  });

  $effect(() => {
    if (ui.commandFocusToken) input?.focus();
  });

  $effect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  });

  function selectTab(t: CmdTab) {
    if (tab === t && open) open = false;
    else {
      tab = t;
      open = true;
    }
  }

  const close = () => (open = false);

  function submit() {
    if (tab === 'devices') {
      const c = sinkhole.clients.find((c) => !needle || c.name.toLowerCase().includes(needle) || c.ip.includes(needle));
      if (c) {
        ui.openLogFor({ client: c.id });
        close();
      }
      return;
    }
    if (!needle) return;
    ui.openLogFor({ q: needle });
    close();
    input?.blur();
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      input?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }
</script>

<div class="cmd-wrap" bind:this={root}>
  {#if open && Panel}
    <Panel {tab} {title} {needle} {close} />
  {/if}

  <div class="bar glass">
    <label class="search">
      <Search size={15} />
      <input
        bind:this={input}
        bind:value={q}
        type="text"
        placeholder="Search a domain or device…"
        spellcheck="false"
        autocomplete="off"
        aria-label="Search a domain or device"
        onfocus={() => {
          if (tab !== 'history' && tab !== 'lists' && tab !== 'devices') tab = 'history';
          open = true;
        }}
        onkeydown={onkey}
      />
      <kbd class="mono">/</kbd>
    </label>
    <div class="icons" role="tablist" aria-label="Command bar">
      {#each TABS as t (t.id)}
        {@const Icon = t.icon}
        <button
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          aria-label={t.label}
          data-tip={t.label}
          data-tip-side="top"
          class="itab"
          class:active={tab === t.id}
          onclick={() => selectTab(t.id)}
        >
          <Icon size={15} />
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .cmd-wrap {
    position: fixed;
    left: 50%;
    bottom: 20px;
    translate: -50% 0;
    z-index: 45;
    width: min(520px, calc(100vw - 32px));
  }
  .bar {
    border-radius: 20px;
    padding: 8px;
    box-shadow: 0 24px 48px rgb(0 0 0 / 0.5);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 12px;
    border-radius: 14px;
    background: rgb(0 0 0 / 0.22);
    border: 1px solid rgb(255 255 255 / 0.05);
    color: var(--color-muted);
    transition: border-color 160ms ease;
  }
  .search:focus-within {
    border-color: rgb(255 255 255 / 0.16);
  }
  input {
    flex: 1;
    min-width: 0;
    background: transparent;
    outline: none;
    color: var(--color-ink);
    font-size: 14px;
    font-weight: 300;
  }
  input::placeholder {
    color: var(--color-muted);
  }
  kbd {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    font-size: 11px;
    color: var(--color-faint);
    border: 1px solid rgb(255 255 255 / 0.08);
  }
  .icons {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 8px 0 0;
  }
  .itab {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    color: var(--color-muted);
    transition:
      background-color 160ms ease,
      color 160ms ease,
      transform 160ms var(--ease-out-soft);
  }
  .itab:hover {
    color: var(--color-ink);
    background: rgb(255 255 255 / 0.06);
  }
  .itab:active {
    transform: scale(0.92);
  }
  .itab.active {
    background: #f4f4f6;
    color: #111113;
  }
  @media (max-width: 1023px) {
    .cmd-wrap {
      width: min(400px, calc(100vw - 220px));
      bottom: 16px;
    }
    .icons {
      gap: 4px;
    }
  }
  @media (max-width: 860px) {
    .cmd-wrap {
      width: min(440px, calc(100vw - 32px));
    }
  }
</style>
