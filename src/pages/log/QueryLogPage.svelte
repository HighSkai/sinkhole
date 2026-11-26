<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Spring } from 'svelte/motion';
  import { fly } from 'svelte/transition';
  import { sinkhole } from '../../lib/data/store.svelte';
  import { ui, type StatusFilter } from '../../lib/state/ui.svelte';
  import type { DnsQuery } from '../../lib/data/types';
  import Select from '../../lib/ui/Select.svelte';
  import Toggle from '../../lib/ui/Toggle.svelte';
  import { fmt, fmtClock } from '../../lib/format';
  import { Search, ShieldBan, ShieldCheck, X } from '../../lib/icons';

  const ROW = 44;
  const OVERSCAN = 6;
  const CAP = 10_000;

  /* ---------- filtering (incremental: new queries are matched as they arrive) ---------- */
  let rows = $state.raw<DnsQuery[]>([]); // newest first
  let counts = $state({ all: 0, allowed: 0, blocked: 0, cached: 0 });
  let lastId = 0;
  let live = $state(true);
  let missed = $state(0);
  const mountedAt = Date.now();

  const f = $derived(ui.logFilter);
  const needle = $derived(f.q.trim().toLowerCase());

  function bucket(q: DnsQuery): Exclude<StatusFilter, 'all'> {
    return q.status === 'blocked' ? 'blocked' : q.status === 'cached' ? 'cached' : 'allowed';
  }
  function base(q: DnsQuery) {
    if (f.client !== 'all' && q.client !== f.client) return false;
    if (needle && !q.domain.includes(needle)) return false;
    return true;
  }
  const match = (q: DnsQuery) => base(q) && (f.status === 'all' || bucket(q) === f.status);

  function rebuild() {
    const out: DnsQuery[] = [];
    const c = { all: 0, allowed: 0, blocked: 0, cached: 0 };
    const log = sinkhole.log;
    for (let i = log.length - 1; i >= 0; i--) {
      const q = log[i];
      if (!base(q)) continue;
      c.all++;
      c[bucket(q)]++;
      if ((f.status === 'all' || bucket(q) === f.status) && out.length < CAP) out.push(q);
    }
    lastId = log.at(-1)?.id ?? 0;
    rows = out;
    counts = c;
    missed = 0;
    slide.set(0, { instant: true });
  }

  // refilter whenever the filter changes
  $effect(() => {
    void f.q;
    void f.status;
    void f.client;
    untrack(rebuild);
  });

  // stream new queries in
  $effect(() => {
    void sinkhole.logVersion;
    untrack(ingest);
  });

  function ingest() {
    const log = sinkhole.log;
    const fresh: DnsQuery[] = [];
    for (let i = log.length - 1; i >= 0 && log[i].id > lastId; i--) fresh.push(log[i]);
    if (!fresh.length) return;
    lastId = fresh[0].id;
    const c = { ...counts };
    const add: DnsQuery[] = [];
    for (const q of fresh) {
      if (!base(q)) continue;
      c.all++;
      c[bucket(q)]++;
      if (match(q)) add.push(q);
    }
    counts = c;
    if (!add.length) return;
    if (!live) {
      missed += add.length;
      return;
    }
    rows = add.concat(rows).slice(0, CAP);
    if (viewport && viewport.scrollTop > 4) {
      // reading older rows: keep them still
      viewport.scrollTop += add.length * ROW;
    } else if (ui.fullMotion) {
      slide.set(slide.current - add.length * ROW, { instant: true });
      slide.target = 0;
    }
  }

  function resume() {
    live = true;
    rebuild();
  }

  /* ---------- virtualisation ---------- */
  let viewport = $state<HTMLDivElement>();
  let scrollTop = $state(0);
  let height = $state(600);
  const slide = new Spring(0, { stiffness: 0.14, damping: 0.82 });

  const extra = $derived(Math.ceil(Math.max(0, -slide.current) / ROW));
  const start = $derived(Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN));
  const end = $derived(Math.min(rows.length, Math.ceil((scrollTop + height) / ROW) + OVERSCAN + extra));
  const visible = $derived(rows.slice(start, end));

  onMount(() => {
    const ro = new ResizeObserver(([e]) => (height = e.contentRect.height));
    if (viewport) ro.observe(viewport);
    return () => ro.disconnect();
  });

  /* ---------- labels ---------- */
  const STATUS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'allowed', label: 'Allowed' },
    { id: 'blocked', label: 'Blocked' },
    { id: 'cached', label: 'Cached' }
  ];
  const clientOptions = $derived([
    { value: 'all', label: 'All devices' },
    ...sinkhole.clients.map((c) => ({ value: c.id, label: c.name }))
  ]);
  const statusText = (q: DnsQuery) =>
    q.bypassed ? 'Bypassed' : { allowed: 'Allowed', blocked: 'Blocked', cached: 'Cached', allowlisted: 'Allowlisted' }[q.status];
  const fresh = (q: DnsQuery) => q.ts > mountedAt && sinkhole.now - q.ts < 2500;

  function act(q: DnsQuery) {
    if (q.status === 'blocked') {
      sinkhole.allow(q.domain);
      ui.toast(`Allowed ${q.domain}`, 'good');
    } else {
      sinkhole.block(q.domain);
      ui.toast(`Blocked ${q.domain}`, 'warn');
    }
  }
</script>

<section class="mx-auto flex h-full max-w-[1280px] flex-col gap-4">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-[26px] font-[300] text-ink">Query Log</h1>
      <p class="label mt-1">
        <span class="mono text-soft">{fmt(counts.all)}</span> recent queries
        {#if f.client !== 'all'}from <span class="text-soft">{sinkhole.clientName(f.client)}</span>{/if}
        · {live ? 'streaming live' : 'paused'}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="seg" role="radiogroup" aria-label="Status">
        {#each STATUS as s (s.id)}
          <button
            type="button"
            role="radio"
            aria-checked={f.status === s.id}
            class:on={f.status === s.id}
            onclick={() => (ui.logFilter.status = s.id)}
          >
            {#if s.id !== 'all'}<span class="sdot {s.id}"></span>{/if}
            {s.label}
            <span class="mono n">{fmt(counts[s.id])}</span>
          </button>
        {/each}
      </div>
      <Select label="Device" bind:value={ui.logFilter.client} options={clientOptions} class="w-[140px]" align="right" />
      <label class="search">
        <Search size={14} />
        <input bind:value={ui.logFilter.q} placeholder="Filter domains…" spellcheck="false" aria-label="Filter domains" />
        {#if f.q}
          <button type="button" aria-label="Clear filter" onclick={() => (ui.logFilter.q = '')}><X size={13} /></button>
        {/if}
      </label>
      <div class="flex items-center gap-2 pl-2 text-[12px] text-muted">
        <Toggle bind:checked={live} label="Live stream" tone="green" onchange={(v) => v && resume()} /> Live
      </div>
    </div>
  </header>

  <div class="table surface">
    <div class="thead" role="row">
      <span>Time</span><span>Status</span><span>Domain</span><span class="c-type">Type</span><span>Client</span><span class="c-list">List</span
      ><span class="text-right">Latency</span><span></span>
    </div>

    {#if missed > 0}
      <button type="button" class="missed" onclick={resume} transition:fly={{ y: -6, duration: 160 }}>
        {fmt(missed)} new queries — resume live
      </button>
    {/if}

    <div class="vp" bind:this={viewport} onscroll={() => (scrollTop = viewport!.scrollTop)} role="table" aria-label="Query log" aria-rowcount={rows.length}>
      <div class="spacer" style="height: {rows.length * ROW}px">
        <div class="slide" style="transform: translate3d(0, {slide.current}px, 0)">
          {#each visible as q, i (q.id)}
            <div class="pos" style="transform: translate3d(0, {(start + i) * ROW}px, 0)" role="row">
              <div class="row {q.status}" class:bypassed={q.bypassed} class:fresh={fresh(q)}>
                <span class="mono t">{fmtClock(q.ts)}</span>
                <span><span class="pill {q.bypassed ? 'bypassed' : q.status}">{statusText(q)}</span></span>
                <span class="mono dom truncate" title={q.domain}>{q.domain}</span>
                <span class="mono c-type muted">{q.qtype}</span>
                <span class="truncate">{sinkhole.clientName(q.client)}</span>
                <span class="c-list muted truncate">{sinkhole.listName(q.list) || (q.status === 'cached' ? 'cache' : 'upstream')}</span>
                <span class="mono text-right muted">{q.ms ? `${q.ms} ms` : '—'}</span>
                <span class="act">
                  <button
                    type="button"
                    class="act-btn"
                    aria-label={q.status === 'blocked' ? `Allow ${q.domain}` : `Block ${q.domain}`}
                    data-tip={q.status === 'blocked' ? 'Allow' : 'Block'}
                    data-tip-side="left"
                    onclick={() => act(q)}
                  >
                    {#if q.status === 'blocked'}<ShieldCheck size={14} />{:else}<ShieldBan size={14} />{/if}
                  </button>
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>
      {#if rows.length === 0}
        <p class="empty">No queries match these filters yet.</p>
      {/if}
    </div>
  </div>
</section>

<style>
  .seg {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 12px;
    background: var(--color-card);
    border: 1px solid var(--color-line);
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 400;
    color: var(--color-muted);
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }
  .seg button:hover {
    color: var(--color-ink);
  }
  .seg button.on {
    background: var(--color-pill-hi);
    color: var(--color-ink);
  }
  .seg .n {
    font-size: 10px;
    color: var(--color-faint);
  }
  .sdot {
    width: 6px;
    height: 6px;
    border-radius: 9px;
    background: var(--color-allow);
  }
  .sdot.blocked {
    background: var(--color-block);
  }
  .sdot.cached {
    background: var(--color-up);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    width: 220px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    background: var(--color-pill);
    border: 1px solid rgb(255 255 255 / 0.04);
    color: var(--color-muted);
  }
  .search:focus-within {
    border-color: rgb(255 255 255 / 0.2);
  }
  .search input {
    flex: 1;
    min-width: 0;
    background: transparent;
    outline: none;
    font-size: 12px;
    color: var(--color-ink);
  }
  .search input::placeholder {
    color: var(--color-faint);
  }

  .table {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 360px;
    overflow: hidden;
    padding: 8px;
  }
  .thead,
  .row {
    display: grid;
    grid-template-columns: 112px 104px minmax(160px, 1fr) 64px 110px 120px 72px 36px;
    align-items: center;
    gap: 12px;
    padding: 0 12px 0 16px;
  }
  .thead {
    height: 36px;
    font-size: 11px;
    color: var(--color-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgb(255 255 255 / 0.05);
  }
  .vp {
    position: relative;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    contain: strict;
  }
  .spacer {
    position: relative;
  }
  .slide,
  .pos {
    position: absolute;
    inset: 0 0 auto 0;
    will-change: transform;
  }
  .pos {
    height: 44px;
  }
  .row {
    position: relative;
    height: 40px;
    margin-top: 2px;
    border-radius: 10px;
    font-size: 12.5px;
    color: var(--color-soft);
    transition: background-color 120ms ease;
  }
  .row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 2px;
    background: var(--color-allow);
    box-shadow: 0 0 8px rgb(74 222 128 / 0.5);
  }
  .row.blocked::before {
    background: var(--color-block);
    box-shadow: 0 0 8px rgb(248 113 113 / 0.55);
  }
  .row.cached::before {
    background: var(--color-up);
    box-shadow: 0 0 8px rgb(96 165 250 / 0.5);
  }
  .row.bypassed::before {
    background: #8a8a93;
    box-shadow: none;
  }
  .row:hover {
    background: rgb(255 255 255 / 0.035);
  }
  .row.fresh {
    animation: row-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .row.fresh.blocked {
    animation:
      row-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both,
      shake 360ms ease-in-out 240ms 1;
  }
  @keyframes row-in {
    from {
      opacity: 0;
    }
  }
  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20% {
      transform: translateX(-2px);
    }
    40% {
      transform: translateX(2px);
    }
    60% {
      transform: translateX(-2px);
    }
    80% {
      transform: translateX(1px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .row.fresh,
    .row.fresh.blocked {
      animation: row-in 300ms ease both;
    }
  }
  .t {
    font-size: 11.5px;
    color: var(--color-muted);
  }
  .dom {
    color: var(--color-ink);
  }
  .muted {
    color: var(--color-faint);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 400;
    background: rgb(74 222 128 / 0.1);
    color: #86efac;
  }
  .pill.blocked {
    background: rgb(248 113 113 / 0.12);
    color: #fca5a5;
  }
  .pill.cached {
    background: rgb(96 165 250 / 0.12);
    color: #93c5fd;
  }
  .pill.allowlisted {
    background: rgb(74 222 128 / 0.16);
    color: #bbf7d0;
  }
  .pill.bypassed {
    background: rgb(255 255 255 / 0.06);
    color: var(--color-muted);
  }
  .act {
    display: flex;
    justify-content: flex-end;
  }
  .act-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: var(--color-muted);
    opacity: 0;
    transition:
      opacity 140ms ease,
      background-color 140ms ease;
  }
  .row:hover .act-btn,
  .act-btn:focus-visible {
    opacity: 1;
  }
  .act-btn:hover {
    background: rgb(255 255 255 / 0.08);
    color: var(--color-ink);
  }
  .missed {
    position: absolute;
    top: 52px;
    left: 50%;
    translate: -50% 0;
    z-index: 2;
    height: 30px;
    padding: 0 14px;
    border-radius: 99px;
    background: #f4f4f6;
    color: #111113;
    font-size: 12px;
    font-weight: 400;
    box-shadow: 0 10px 24px rgb(0 0 0 / 0.45);
  }
  .empty {
    position: absolute;
    inset: 40px 0 auto;
    text-align: center;
    font-size: 13px;
    color: var(--color-faint);
  }
  @media (max-width: 1100px) {
    .thead,
    .row {
      grid-template-columns: 100px 96px minmax(140px, 1fr) 96px 64px 32px;
    }
    .c-type,
    .c-list {
      display: none;
    }
  }
</style>
