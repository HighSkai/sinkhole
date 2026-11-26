<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import NodeCard from './NodeCard.svelte';
  import Port from './Port.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import { sinkhole } from '../../../lib/data/store.svelte';
  import { ui } from '../../../lib/state/ui.svelte';

  let { selected }: NodeProps = $props();

  const latest = $derived(sinkhole.latest);
  const tail = $derived(sinkhole.recent.slice(1, 4));
  const d = $derived(ui.fullMotion ? 1 : 0);
</script>

<NodeCard title="DNS Query" order={1} {selected} width={268}>
  <div class="inset p-3">
    <div class="grid grid-cols-2 gap-2">
      <Port id="in" type="target" kind="client" label="clients" />
      <Port id="out" type="source" kind="client" label="query" />
    </div>

    <div class="latest">
      <span class="label">Latest</span>
      <div class="latest-domain">
        {#key latest?.id}
          <span
            class="mono truncate"
            in:fly={{ y: 8 * d, duration: 220 * d + 120, easing: cubicOut }}
          >
            {latest?.domain ?? '—'}
          </span>
        {/key}
      </div>
      <div class="flex items-center gap-2 text-[11px] text-muted">
        <span class="badge mono">{latest?.qtype ?? 'A'}</span>
        <span>{latest ? sinkhole.clientName(latest.client) : ''}</span>
      </div>
    </div>

    <ul class="stream">
      {#each tail as q (q.id)}
        <li animate:flip={{ duration: 260 * d }} in:fade={{ duration: 200 }}>
          <span class="mono truncate">{q.domain}</span>
          <span class="mono qt">{q.qtype}</span>
        </li>
      {/each}
    </ul>
  </div>
  <div class="node-foot">
    <span>Q/s <span class="mono">{sinkhole.qps.toFixed(1)}</span></span>
    <Sparkline data={sinkhole.qpsSpark} width={96} height={16} color="#facc15" stroke={1.1} />
  </div>
</NodeCard>

<style>
  .latest {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #1b1b1f;
    border: 1px solid rgb(255 255 255 / 0.04);
  }
  .latest-domain {
    display: grid;
    height: 20px;
    overflow: hidden;
    font-size: 13px;
    color: var(--color-ink);
  }
  .latest-domain > :global(span) {
    grid-area: 1 / 1;
  }
  .badge {
    padding: 1px 6px;
    border-radius: 6px;
    background: rgb(250 204 21 / 0.12);
    color: #facc15;
    font-size: 10px;
  }
  .stream {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 8px;
    height: 72px;
    overflow: hidden;
  }
  .stream li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    height: 22px;
    align-items: center;
    padding: 0 4px;
    font-size: 11px;
    color: var(--color-muted);
  }
  .stream li:nth-child(2) {
    opacity: 0.7;
  }
  .stream li:nth-child(3) {
    opacity: 0.45;
  }
  .qt {
    color: var(--color-faint);
    font-size: 10px;
  }
</style>
