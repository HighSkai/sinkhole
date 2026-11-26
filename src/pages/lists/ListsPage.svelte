<script lang="ts">
  import { slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { sinkhole } from '../../lib/data/store.svelte';
  import { ui } from '../../lib/state/ui.svelte';
  import type { ListInfo } from '../../lib/data/types';
  import Toggle from '../../lib/ui/Toggle.svelte';
  import Odometer from '../../lib/ui/Odometer.svelte';
  import Sparkline from '../../lib/ui/Sparkline.svelte';
  import { fmtAgo, pad2, fmt } from '../../lib/format';
  import { Plus, X, Layers, ShieldCheck } from '../../lib/icons';

  const DOMAIN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  const kindLabel = { hosts: 'hosts file', custom: 'local list', regex: 'regex patterns' };

  let drafts = $state<Record<string, string>>({ custom: '', regex: '', allow: '' });
  let probe = $state('ads3.tracking-cdn.net');
  const dur = $derived(ui.fullMotion ? 220 : 0);

  function add(list: string) {
    const v = drafts[list].trim().toLowerCase();
    if (!v) return;
    if (list === 'regex') {
      try {
        new RegExp(v);
      } catch {
        ui.toast('That is not a valid regular expression', 'warn');
        return;
      }
      sinkhole.addEntry('regex', v);
    } else if (!DOMAIN.test(v)) {
      ui.toast('Enter a domain like example.com', 'warn');
      return;
    } else if (list === 'allow') {
      sinkhole.allow(v);
    } else {
      sinkhole.addEntry(list, v);
    }
    ui.toast(list === 'allow' ? `Allowed ${v}` : `Added ${v} to ${sinkhole.listName(list)}`, list === 'allow' ? 'good' : 'info');
    drafts[list] = '';
  }

  const regexList = $derived(sinkhole.lists.find((l) => l.kind === 'regex'));
  const probeHits = $derived(
    (regexList?.entries ?? []).filter((p) => {
      try {
        return new RegExp(p).test(probe.trim().toLowerCase());
      } catch {
        return false;
      }
    })
  );

  async function updateAll() {
    const r = await sinkhole.updateLists();
    ui.toast(`Lists updated · +${r.added} domains`, 'good');
  }
</script>

{#snippet entryEditor(l: ListInfo, key: string, placeholder: string)}
  <form
    class="add"
    onsubmit={(e) => {
      e.preventDefault();
      add(key);
    }}
  >
    <input class="field flex-1" {placeholder} bind:value={drafts[key]} aria-label={placeholder} spellcheck="false" />
    <button type="submit" class="btn btn-ghost h-8! px-3!" aria-label="Add"><Plus size={14} /> Add</button>
  </form>
  <ul class="entries">
    {#each l.entries.slice(0, 8) as e (e)}
      <li animate:flip={{ duration: dur }} transition:slide={{ duration: dur }}>
        <span class="mono truncate">{e}</span>
        <button type="button" class="x" aria-label="Remove {e}" onclick={() => sinkhole.removeEntry(l.id, e)}><X size={12} /></button>
      </li>
    {/each}
  </ul>
{/snippet}

<section class="mx-auto flex max-w-[1280px] flex-col gap-6">
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-[26px] font-[300] text-ink">Lists</h1>
      <p class="label mt-1">
        <span class="mono text-soft">{sinkhole.activeLists.length}</span> active lists ·
        <span class="mono text-soft">{fmt(sinkhole.totalDomains)}</span> domains ·
        <span class="mono text-soft">{sinkhole.allowlist.length}</span> allowlist overrides
      </p>
    </div>
    <button type="button" class="btn btn-ghost" onclick={updateAll} disabled={sinkhole.updatingLists}>
      <span class="inline-grid" class:spin={sinkhole.updatingLists}><Layers size={14} /></span>
      {sinkhole.updatingLists ? 'Updating…' : 'Update all lists'}
    </button>
  </header>

  <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
    <div class="flex flex-col gap-4">
      {#each sinkhole.lists as l (l.id)}
        <article class="surface card" class:off={!l.enabled}>
          <header class="flex items-start gap-4">
            <span class="num mono">{pad2(l.idx)}</span>
            <div class="min-w-0 flex-1">
              <h2 class="text-[16px] font-[400] text-ink">{l.name}</h2>
              <p class="mono truncate text-[11px] text-faint">{l.source}</p>
            </div>
            <Toggle
              checked={l.enabled}
              tone="red"
              label="Enable {l.name}"
              onchange={(v) => {
                sinkhole.setListEnabled(l.id, v);
                ui.toast(`${l.name} ${v ? 'enabled' : 'disabled'}`, v ? 'good' : 'warn');
              }}
            />
          </header>

          <div class="inset stats">
            <div>
              <span class="label">{l.kind === 'regex' ? 'Patterns' : 'Domains'}</span>
              <span class="text-[22px] text-ink"><Odometer value={l.domains} /></span>
            </div>
            <div>
              <span class="label">Type</span>
              <span class="text-[13px] text-soft">{kindLabel[l.kind]}</span>
            </div>
            <div>
              <span class="label">Updated</span>
              <span class="text-[13px] text-soft">{fmtAgo(l.updatedAt, sinkhole.now)}</span>
            </div>
            <div class="spark">
              <span class="label">Hits · 60s</span>
              <Sparkline data={sinkhole.listSpark[l.id] ?? []} width={140} height={28} color="#f87171" />
            </div>
          </div>

          {#if l.kind === 'custom'}
            {@render entryEditor(l, 'custom', 'Block a domain, e.g. ads.example.com')}
          {:else if l.kind === 'regex'}
            {@render entryEditor(l, 'regex', 'Add a pattern, e.g. ^ads?[0-9]*\\.')}
          {:else}
            <div class="sample">
              <span class="label">Sample entries</span>
              <div class="flex flex-wrap gap-2">
                {#each l.entries.slice(0, 10) as e (e)}<span class="chip mono">{e}</span>{/each}
              </div>
            </div>
          {/if}
        </article>
      {/each}
    </div>

    <div class="flex flex-col gap-4">
      <article class="surface card">
        <header class="flex items-center gap-3">
          <span class="ok"><ShieldCheck size={15} /></span>
          <div class="flex-1">
            <h2 class="text-[16px] font-[400] text-ink">Allowlist</h2>
            <p class="text-[12px] text-faint">Overrides every blocklist. Last allowed: <span class="mono text-soft">{sinkhole.lastAllowed ?? '—'}</span></p>
          </div>
        </header>
        <form
          class="add"
          onsubmit={(e) => {
            e.preventDefault();
            add('allow');
          }}
        >
          <input class="field flex-1" placeholder="Allow a domain" bind:value={drafts.allow} aria-label="Allow a domain" spellcheck="false" />
          <button type="submit" class="btn btn-ghost h-8! px-3!"><Plus size={14} /> Allow</button>
        </form>
        <ul class="entries">
          {#each sinkhole.allowlist as d (d)}
            <li animate:flip={{ duration: dur }} transition:slide={{ duration: dur }}>
              <span class="gdot"></span>
              <span class="mono truncate">{d}</span>
              <button type="button" class="x" aria-label="Remove {d}" onclick={() => sinkhole.unallow(d)}><X size={12} /></button>
            </li>
          {/each}
        </ul>
      </article>

      <article class="surface card">
        <h2 class="text-[16px] font-[400] text-ink">Regex tester</h2>
        <p class="text-[12px] text-faint">Check a hostname against the regex list.</p>
        <input class="field mono mt-3 w-full" bind:value={probe} aria-label="Hostname to test" spellcheck="false" />
        <div class="mt-3 flex flex-col gap-2">
          {#each regexList?.entries ?? [] as p (p)}
            <div class="probe" class:hit={probeHits.includes(p)}>
              <span class="mono truncate">{p}</span>
              <span class="text-[11px]">{probeHits.includes(p) ? 'match' : '—'}</span>
            </div>
          {/each}
        </div>
        <p class="mt-3 text-[12px]" class:text-block={probeHits.length} class:text-allow={!probeHits.length}>
          {probeHits.length ? `Would be blocked by ${probeHits.length} pattern${probeHits.length > 1 ? 's' : ''}` : 'Would resolve normally'}
        </p>
      </article>
    </div>
  </div>
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    transition: opacity 300ms ease;
  }
  .card.off {
    opacity: 0.55;
  }
  .num {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--color-inset);
    color: var(--color-muted);
    font-size: 12px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, auto) 1fr;
    gap: 24px;
    padding: 16px;
  }
  .stats > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .spark {
    align-items: flex-end;
  }
  .add {
    display: flex;
    gap: 8px;
  }
  .entries {
    display: flex;
    flex-direction: column;
  }
  .entries li {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    padding: 0 4px 0 8px;
    border-bottom: 1px solid rgb(255 255 255 / 0.04);
    font-size: 12px;
    color: var(--color-soft);
  }
  .entries li > .mono {
    flex: 1;
  }
  .x {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    color: var(--color-faint);
  }
  .x:hover {
    background: rgb(255 255 255 / 0.07);
    color: var(--color-ink);
  }
  .sample {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chip {
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--color-inset);
    font-size: 11px;
    color: var(--color-soft);
  }
  .ok {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgb(74 222 128 / 0.1);
    color: #4ade80;
  }
  .gdot {
    width: 6px;
    height: 6px;
    border-radius: 9px;
    background: #4ade80;
    flex-shrink: 0;
  }
  .probe {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--color-inset);
    font-size: 12px;
    color: var(--color-muted);
    transition:
      background-color 200ms ease,
      color 200ms ease;
  }
  .probe.hit {
    background: rgb(248 113 113 / 0.12);
    color: #fca5a5;
  }
  @media (max-width: 1100px) {
    .stats {
      grid-template-columns: repeat(3, auto);
    }
    .spark {
      display: none !important;
    }
  }
</style>
