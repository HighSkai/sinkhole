<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import NodeCard from './NodeCard.svelte';
  import Port from './Port.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import Toggle from '../../../lib/ui/Toggle.svelte';
  import Odometer from '../../../lib/ui/Odometer.svelte';
  import { sinkhole } from '../../../lib/data/store.svelte';
  import { ui } from '../../../lib/state/ui.svelte';
  import { pad2 } from '../../../lib/format';

  let { selected }: NodeProps = $props();
  const kindLabel = { hosts: 'hosts', custom: 'domains', regex: 'patterns' };
</script>

<NodeCard title="Blocklists" order={2} {selected} width={300}>
  <div class="inset p-3">
    <div class="grid grid-cols-2 gap-2">
      <Port id="in" type="target" kind="client" label="query" />
      <Port id="blocked" type="source" kind="block" label="blocked" />
    </div>

    <div class="mt-2 flex flex-col gap-2">
      {#each sinkhole.lists as l (l.id)}
        <div class="sub" class:off={!l.enabled}>
          <div class="thumb">
            <span class="num mono">{pad2(l.idx)}</span>
            <Sparkline data={sinkhole.listSpark[l.id] ?? []} width={64} height={26} color="#f87171" stroke={1.1} />
          </div>
          <button type="button" class="info nodrag" onclick={() => ui.go('lists')}>
            <span class="block truncate text-[13px] text-ink">{l.name}</span>
            <span class="block text-[11px] text-faint">
              <Odometer value={l.domains} class="text-soft" />
              {kindLabel[l.kind]}
            </span>
          </button>
          <Toggle
            checked={l.enabled}
            tone="red"
            size="sm"
            label="Enable {l.name}"
            onchange={(v) => {
              sinkhole.setListEnabled(l.id, v);
              ui.toast(`${l.name} ${v ? 'enabled' : 'disabled'}`, v ? 'good' : 'warn');
            }}
          />
        </div>
      {/each}
    </div>
  </div>
</NodeCard>

<style>
  .sub {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 12px;
    background: #1b1b1f;
    border: 1px solid rgb(255 255 255 / 0.04);
    transition: opacity 300ms ease;
  }
  .sub.off {
    opacity: 0.5;
  }
  .thumb {
    position: relative;
    display: grid;
    place-items: end center;
    width: 76px;
    height: 44px;
    padding: 0 6px 5px;
    border-radius: 8px;
    background:
      radial-gradient(120% 90% at 50% 120%, rgb(248 113 113 / 0.16), transparent 70%),
      #141417;
    border: 1px solid rgb(255 255 255 / 0.05);
    flex-shrink: 0;
  }
  .num {
    position: absolute;
    top: 4px;
    left: 6px;
    font-size: 10px;
    color: var(--color-muted);
  }
  .info {
    flex: 1;
    min-width: 0;
    text-align: left;
  }
</style>
