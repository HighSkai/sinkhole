<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui, type Palette } from '../state/ui.svelte';
  import { sinkhole } from '../data/store.svelte';
  import { fmt, fmtAgo } from '../format';
  import Toggle from '../ui/Toggle.svelte';
  import Odometer from '../ui/Odometer.svelte';
  import Sparkline from '../ui/Sparkline.svelte';
  import ClientIcon from '../ui/ClientIcon.svelte';
  import { Settings, ShieldBan, ShieldCheck, ArrowUpRight } from '../icons';
  import type { CmdTab } from './command';

  // Loaded on first open so the bar itself stays in the tiny initial chunk.
  let { tab, title, needle, close }: { tab: CmdTab; title: string; needle: string; close: () => void } = $props();

  const history = $derived.by(() => {
    void sinkhole.logVersion;
    if (tab !== 'history') return [];
    const seen = new Set<string>();
    const out = [];
    for (let i = sinkhole.log.length - 1; i >= 0 && out.length < 40; i--) {
      const e = sinkhole.log[i];
      if (seen.has(e.domain)) continue;
      if (needle && !e.domain.includes(needle) && !sinkhole.clientName(e.client).toLowerCase().includes(needle)) continue;
      seen.add(e.domain);
      out.push(e);
    }
    return out;
  });

  const listHits = $derived.by(() => {
    if (tab !== 'lists') return [];
    const out: { domain: string; list: string; listId: string; blocked: boolean }[] = [];
    for (const d of sinkhole.allowlist) out.push({ domain: d, list: 'Allowlist', listId: 'allowlist', blocked: false });
    for (const l of sinkhole.lists) for (const e of l.entries) out.push({ domain: e, list: l.name, listId: l.id, blocked: true });
    for (const [d] of sinkhole.topBlocked)
      if (!out.some((o) => o.domain === d)) out.push({ domain: d, list: 'StevenBlack', listId: 'stevenblack', blocked: true });
    return out.filter((o) => !needle || o.domain.includes(needle)).slice(0, 40);
  });

  const devices = $derived(
    sinkhole.clients.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.ip.includes(needle))
  );

  const PALETTES: { id: Palette; name: string; colors: string[] }[] = [
    { id: 'aurora', name: 'Aurora', colors: ['#ff6b9d', '#8b5cf6', '#4da3ff'] },
    { id: 'ember', name: 'Ember', colors: ['#ff8a5c', '#f43f5e', '#a855f7'] },
    { id: 'glacier', name: 'Glacier', colors: ['#22d3ee', '#4da3ff', '#6366f1'] }
  ];

  const looksLikeDomain = $derived(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(needle));

  function pickDomain(d: string) {
    ui.openLogFor({ q: d });
    close();
  }
  function pickDevice(id: string) {
    ui.openLogFor({ client: id });
    close();
  }
</script>

<div
  class="panel glass"
  role="dialog"
  aria-label={title}
  transition:fly={{ y: 8, duration: ui.reducedMotion ? 0 : 200, easing: cubicOut }}
>
  <div class="panel-head">
    <span>{title}</span>
    {#if needle && (tab === 'history' || tab === 'lists' || tab === 'devices')}<span class="mono">“{needle}”</span>{/if}
  </div>

  {#if tab === 'history'}
    {#each history as e (e.id)}
      <button type="button" class="row" onclick={() => pickDomain(e.domain)}>
        <span class="sdot {e.status}"></span>
        <span class="mono truncate">{e.domain}</span>
        <span class="meta">{sinkhole.clientName(e.client)} · {fmtAgo(e.ts, sinkhole.now)}</span>
      </button>
    {:else}
      <p class="empty">No recent queries match.</p>
    {/each}
  {:else if tab === 'lists'}
    {#if looksLikeDomain && !listHits.some((h) => h.domain === needle)}
      <div class="quick">
        <button type="button" class="btn btn-ghost h-8!" onclick={() => (sinkhole.block(needle), ui.toast(`Blocked ${needle}`, 'warn'))}>
          <ShieldBan size={14} /> Block {needle}
        </button>
        <button type="button" class="btn btn-ghost h-8!" onclick={() => (sinkhole.allow(needle), ui.toast(`Allowed ${needle}`, 'good'))}>
          <ShieldCheck size={14} /> Allow
        </button>
      </div>
    {/if}
    {#each listHits as h (h.listId + h.domain)}
      <div class="row">
        <span class="sdot {h.blocked ? 'blocked' : 'allowed'}"></span>
        <span class="mono truncate">{h.domain}</span>
        <span class="meta">{h.list}</span>
        <button type="button" class="mini" onclick={() => pickDomain(h.domain)} aria-label="Show in query log"><ArrowUpRight size={13} /></button>
      </div>
    {:else}
      {#if !looksLikeDomain}<p class="empty">No list entries match.</p>{/if}
    {/each}
  {:else if tab === 'devices'}
    {#each devices as c (c.id)}
      <button type="button" class="row" onclick={() => pickDevice(c.id)}>
        <span class="text-client"><ClientIcon kind={c.kind} size={14} /></span>
        <span class="truncate">{c.name}</span>
        <span class="meta mono">{c.ip}</span>
        <span class="meta mono">{fmt(c.queries)} q · {fmt(c.blocked)} blk</span>
      </button>
    {:else}
      <p class="empty">No devices match.</p>
    {/each}
  {:else if tab === 'stats'}
    <div class="stat-grid">
      <div class="stat"><span class="label">Queries today</span><Odometer value={sinkhole.totalToday} class="text-[15px]" /></div>
      <div class="stat"><span class="label">Blocked today</span><Odometer value={sinkhole.blockedToday} class="text-[15px] text-block" /></div>
      <div class="stat"><span class="label">Blocked share</span><span class="mono text-[15px]">{sinkhole.blockedPct.toFixed(1)}%</span></div>
      <div class="stat"><span class="label">Cache hits</span><span class="mono text-[15px]">{sinkhole.cacheHitPct.toFixed(1)}%</span></div>
      <div class="stat"><span class="label">Upstream</span><span class="mono text-[15px] text-up">{sinkhole.latency} ms</span></div>
      <div class="stat">
        <span class="label">Q/s · 60s</span>
        <Sparkline data={sinkhole.qpsSpark} width={120} height={22} color="#facc15" />
      </div>
    </div>
  {:else if tab === 'theme'}
    <div class="swatches">
      {#each PALETTES as p (p.id)}
        <button type="button" class="swatch" class:on={ui.palette === p.id} onclick={() => (ui.palette = p.id)}>
          <span class="chips">{#each p.colors as c (c)}<span style="background:{c}"></span>{/each}</span>
          {p.name}
        </button>
      {/each}
    </div>
    <p class="empty text-left!">Aurora glows behind the active node pick up the palette.</p>
  {:else if tab === 'settings'}
    <div class="setting"><span>Animations</span><Toggle bind:checked={ui.animations} label="Animations" /></div>
    <div class="setting"><span>Minimap</span><Toggle bind:checked={ui.minimap} label="Minimap" /></div>
    <div class="setting">
      <span>Blocking</span>
      <Toggle checked={!sinkhole.paused} tone="green" label="Blocking" onchange={(v) => (v ? sinkhole.resume() : sinkhole.pause(null))} />
    </div>
    <button type="button" class="row" onclick={() => (close(), ui.go('settings'))}>
      <Settings size={14} /> <span>All settings</span><span class="meta"><ArrowUpRight size={13} /></span>
    </button>
  {/if}
</div>

<style>
  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 10px);
    max-height: min(340px, 50vh);
    overflow-y: auto;
    border-radius: 18px;
    padding: 8px;
    box-shadow: 0 24px 48px rgb(0 0 0 / 0.5);
  }
  .panel-head {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px 8px;
    font-size: 11px;
    color: var(--color-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border-radius: 10px;
    font-size: 13px;
    color: var(--color-soft);
    text-align: left;
    transition: background-color 120ms ease;
  }
  .row:hover {
    background: rgb(255 255 255 / 0.06);
    color: var(--color-ink);
  }
  .row .mono {
    font-size: 12px;
  }
  .meta {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--color-faint);
  }
  .meta + .meta {
    margin-left: 0;
  }
  .mini {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    color: var(--color-muted);
  }
  .mini:hover {
    background: rgb(255 255 255 / 0.08);
    color: var(--color-ink);
  }
  .sdot {
    width: 6px;
    height: 6px;
    border-radius: 9px;
    flex-shrink: 0;
    background: var(--color-allow);
  }
  .sdot.blocked {
    background: var(--color-block);
  }
  .sdot.cached {
    background: var(--color-up);
  }
  .empty {
    padding: 12px 10px;
    font-size: 12px;
    color: var(--color-faint);
    text-align: center;
  }
  .quick {
    display: flex;
    gap: 8px;
    padding: 4px 6px 10px;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border-radius: 12px;
    background: rgb(0 0 0 / 0.2);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .swatch {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: rgb(0 0 0 / 0.2);
    border: 1px solid transparent;
    font-size: 13px;
    text-align: left;
    color: var(--color-soft);
    transition: border-color 160ms ease;
  }
  .swatch.on {
    border-color: rgb(255 255 255 / 0.4);
    color: var(--color-ink);
  }
  .chips {
    display: flex;
  }
  .chips span {
    width: 18px;
    height: 18px;
    border-radius: 99px;
    margin-right: -5px;
    border: 2px solid #1c1c1f;
  }
  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 10px;
    font-size: 13px;
    color: var(--color-soft);
  }
</style>
