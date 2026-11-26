<script lang="ts">
  import { sinkhole } from '../../lib/data/store.svelte';
  import { ui, type Palette } from '../../lib/state/ui.svelte';
  import { BLOCKING_MODES, TTL_OPTIONS, UPSTREAMS, type DecisionConfig } from '../../lib/data/types';
  import { WS_STORAGE_KEY, configuredStreamUrl } from '../../lib/data/source';
  import Select from '../../lib/ui/Select.svelte';
  import Stepper from '../../lib/ui/Stepper.svelte';
  import Toggle from '../../lib/ui/Toggle.svelte';
  import Logo from '../../lib/logo/Logo.svelte';
  import { fmt, fmtUptime } from '../../lib/format';
  import { Globe, ShieldBan, Sparkles, Radio, Info } from '../../lib/icons';

  const CACHE_STEPS = [0, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const PROTOCOLS = [
    { value: 'udp' as const, label: 'Plain UDP', hint: ':53' },
    { value: 'dot' as const, label: 'DNS-over-TLS', hint: ':853' },
    { value: 'doh' as const, label: 'DNS-over-HTTPS', hint: ':443' }
  ];
  const PALETTES: { id: Palette; name: string; colors: string[] }[] = [
    { id: 'aurora', name: 'Aurora', colors: ['#ff6b9d', '#8b5cf6', '#4da3ff'] },
    { id: 'ember', name: 'Ember', colors: ['#ff8a5c', '#f43f5e', '#a855f7'] },
    { id: 'glacier', name: 'Glacier', colors: ['#22d3ee', '#4da3ff', '#6366f1'] }
  ];

  const set = (patch: Partial<DecisionConfig>) => {
    sinkhole.setConfig(patch);
    ui.toast('Setting saved', 'good');
  };

  let wsUrl = $state(configuredStreamUrl() ?? '');
  function connect(e: SubmitEvent) {
    e.preventDefault();
    try {
      const u = new URL(wsUrl);
      if (!/^wss?:$/.test(u.protocol)) throw new Error();
      localStorage.setItem(WS_STORAGE_KEY, u.href);
      location.reload();
    } catch {
      ui.toast('Enter a ws:// or wss:// URL', 'warn');
    }
  }
  function useMock() {
    try {
      localStorage.removeItem(WS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    location.reload();
  }
</script>

{#snippet row(label: string, hint: string)}
  <div class="min-w-0">
    <div class="text-[13px] text-ink">{label}</div>
    <div class="text-[12px] text-faint">{hint}</div>
  </div>
{/snippet}

<section class="mx-auto flex max-w-[1080px] flex-col gap-6">
  <header>
    <h1 class="text-[26px] font-[300] text-ink">Settings</h1>
    <p class="label mt-1">Changes apply to <span class="text-soft">{sinkhole.profile.name}</span> immediately.</p>
  </header>

  <div class="grid gap-4 md:grid-cols-2">
    <article class="surface card">
      <h2><span class="ico"><Globe size={15} /></span>Resolver</h2>
      <div class="inset rows">
        <div class="r">
          {@render row('Upstream DNS', 'Where allowed queries are forwarded')}
          <Select
            label="Upstream DNS"
            value={sinkhole.config.upstream}
            options={UPSTREAMS.map((u) => ({ value: u.value, label: u.label, hint: u.ip.split('#')[0] }))}
            align="right"
            class="w-[200px]"
            onchange={(v) => set({ upstream: v })}
          />
        </div>
        <div class="r">
          {@render row('Transport', 'Encryption to the upstream')}
          <Select label="Transport" value={sinkhole.config.protocol} options={PROTOCOLS} align="right" class="w-[200px]" onchange={(v) => set({ protocol: v })} />
        </div>
        <div class="r">
          {@render row('DNSSEC', 'Validate signed responses')}
          <Toggle checked={sinkhole.config.dnssec} label="DNSSEC" tone="green" onchange={(v) => set({ dnssec: v })} />
        </div>
        <div class="r">
          {@render row('Cache size', 'Entries kept in memory')}
          <Stepper label="Cache size" value={sinkhole.config.cacheSize} values={CACHE_STEPS} format={fmt} onchange={(v) => set({ cacheSize: v })} />
        </div>
      </div>
    </article>

    <article class="surface card">
      <h2><span class="ico"><ShieldBan size={15} /></span>Blocking</h2>
      <div class="inset rows">
        <div class="r">
          {@render row('Blocking', sinkhole.paused ? 'Paused — queries pass straight through' : 'Active on every list')}
          <Toggle checked={!sinkhole.paused} label="Blocking" tone="green" onchange={(v) => (v ? sinkhole.resume() : sinkhole.pause(null))} />
        </div>
        <div class="r">
          {@render row('Blocking mode', 'How blocked names are answered')}
          <Select
            label="Blocking mode"
            value={sinkhole.config.mode}
            options={BLOCKING_MODES.map((m) => ({ value: m.value, label: m.label, hint: m.hint }))}
            align="right"
            class="w-[200px]"
            onchange={(v) => set({ mode: v })}
          />
        </div>
        <div class="r">
          {@render row('Block TTL', 'Seconds clients cache a blocked answer')}
          <Select label="TTL" value={sinkhole.config.ttl} options={TTL_OPTIONS} align="right" class="w-[200px]" onchange={(v) => set({ ttl: v })} />
        </div>
        <div class="r">
          {@render row('Blocklists', `${sinkhole.activeLists.length} of ${sinkhole.lists.length} enabled`)}
          <button type="button" class="btn btn-ghost h-8!" onclick={() => ui.go('lists')}>Manage</button>
        </div>
      </div>
    </article>

    <article class="surface card">
      <h2><span class="ico"><Sparkles size={15} /></span>Interface</h2>
      <div class="inset rows">
        <div class="r">
          {@render row('Animations', 'Packets, aurora drift and counters')}
          <Toggle bind:checked={ui.animations} label="Animations" />
        </div>
        <div class="r">
          {@render row('Minimap', 'Overview in the pipeline corner')}
          <Toggle bind:checked={ui.minimap} label="Minimap" />
        </div>
        <div class="r">
          {@render row('Reduced motion', ui.reducedMotion ? 'On (system) — motion swapped for fades' : 'Follows your system setting')}
          <span class="mono text-[12px] text-muted">{ui.reducedMotion ? 'on' : 'off'}</span>
        </div>
        <div class="r col">
          {@render row('Aurora palette', 'Glow behind the active node')}
          <div class="swatches">
            {#each PALETTES as p (p.id)}
              <button type="button" class="swatch" class:on={ui.palette === p.id} onclick={() => (ui.palette = p.id)}>
                <span class="chips">{#each p.colors as c (c)}<span style="background:{c}"></span>{/each}</span>
                {p.name}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </article>

    <article class="surface card">
      <h2><span class="ico"><Radio size={15} /></span>Data source</h2>
      <div class="inset rows">
        <div class="r">
          {@render row('Connected to', sinkhole.connected ? 'Streaming' : 'Reconnecting…')}
          <span class="mono text-right text-[12px] text-soft">{sinkhole.sourceLabel}</span>
        </div>
        <form class="r col" onsubmit={connect}>
          {@render row('Backend stream', 'A WebSocket that speaks the Sinkhole event protocol (see README)')}
          <div class="flex gap-2">
            <input class="field mono flex-1" placeholder="wss://dns.lan/api/stream" bind:value={wsUrl} aria-label="WebSocket URL" spellcheck="false" />
            <button type="submit" class="btn btn-primary h-8!">Connect</button>
          </div>
          {#if sinkhole.sourceKind === 'websocket'}
            <button type="button" class="btn btn-ghost h-8! self-start" onclick={useMock}>Use mock data</button>
          {/if}
        </form>
      </div>
    </article>
  </div>

  <article class="surface card about">
    <Logo width={72} paused={sinkhole.paused} idle={ui.motion} />
    <div class="flex-1">
      <h2 class="mb-1!"><span class="ico"><Info size={15} /></span>sinkhole <span class="mono text-[12px] text-muted">v1.0.0</span></h2>
      <p class="text-[12px] text-faint">
        Uptime <span class="mono text-soft">{fmtUptime(sinkhole.now - sinkhole.startedAt)}</span> ·
        {fmt(sinkhole.totalDomains)} blocklist domains · MIT licensed
      </p>
    </div>
    <button type="button" class="btn btn-ghost h-8!" onclick={() => (ui.overlay = 'shortcuts')}>Keyboard shortcuts</button>
  </article>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 400;
    color: var(--color-ink);
  }
  .ico {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: var(--color-inset);
    color: var(--color-soft);
  }
  .rows {
    display: flex;
    flex-direction: column;
    padding: 4px 16px;
  }
  .r {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 56px;
    padding: 10px 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.04);
  }
  .r:last-child {
    border-bottom: 0;
  }
  .r.col {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .swatch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 12px;
    background: rgb(0 0 0 / 0.2);
    border: 1px solid transparent;
    font-size: 12px;
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
    width: 14px;
    height: 14px;
    border-radius: 99px;
    margin-right: -4px;
    border: 2px solid #232327;
  }
  .about {
    flex-direction: row;
    align-items: center;
  }
</style>
