<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import NodeCard from './NodeCard.svelte';
  import Port from './Port.svelte';
  import Odometer from '../../../lib/ui/Odometer.svelte';
  import { sinkhole } from '../../../lib/data/store.svelte';
  import { ui } from '../../../lib/state/ui.svelte';
  import { Plus } from '../../../lib/icons';

  let { selected }: NodeProps = $props();
  let draft = $state('');

  function add(e: SubmitEvent) {
    e.preventDefault();
    const d = draft.trim().toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
      ui.toast('Enter a domain like example.com', 'warn');
      return;
    }
    sinkhole.allow(d);
    ui.toast(`Allowed ${d}`, 'good');
    draft = '';
  }
</script>

<NodeCard title="Allowlist" order={3} {selected} width={268}>
  <div class="inset p-3">
    <div class="grid grid-cols-2 gap-2">
      <Port id="in" type="target" kind="client" label="query" />
      <Port id="allowed" type="source" kind="allow" label="allowed" />
    </div>

    <div class="mt-2 flex items-end justify-between gap-2 px-1">
      <div>
        <span class="label">Overrides</span>
        <div class="text-[22px] leading-tight text-ink"><Odometer value={sinkhole.allowlist.length} /></div>
      </div>
      <span class="text-[11px] text-faint">domains</span>
    </div>

    <div class="last">
      <span class="label">Last allowed</span>
      <div class="grid h-5 overflow-hidden">
        {#key sinkhole.lastAllowed}
          <span class="mono flex items-center gap-2 truncate text-[12px] text-ink [grid-area:1/1]" in:fly={{ y: ui.fullMotion ? 8 : 0, duration: 260, easing: cubicOut }}>
            <span class="gdot"></span>{sinkhole.lastAllowed ?? '—'}
          </span>
        {/key}
      </div>
    </div>

    <form class="mt-2 flex gap-2" onsubmit={add}>
      <input class="field nodrag h-[28px]! flex-1 text-[12px]!" placeholder="Allow a domain…" bind:value={draft} aria-label="Allow a domain" />
      <button type="submit" class="add nodrag" aria-label="Add to allowlist"><Plus size={14} /></button>
    </form>
  </div>
</NodeCard>

<style>
  .last {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #1b1b1f;
    border: 1px solid rgb(255 255 255 / 0.04);
  }
  .gdot {
    width: 6px;
    height: 6px;
    border-radius: 9px;
    background: #4ade80;
    box-shadow: 0 0 8px rgb(74 222 128 / 0.7);
    flex-shrink: 0;
  }
  .add {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: var(--color-pill);
    color: #fff;
  }
  .add:hover {
    background: var(--color-pill-hi);
  }
  .field {
    min-width: 0;
  }
</style>
