<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import NodeCard from './NodeCard.svelte';
  import Port from './Port.svelte';
  import Select from '../../../lib/ui/Select.svelte';
  import Stepper from '../../../lib/ui/Stepper.svelte';
  import { sinkhole } from '../../../lib/data/store.svelte';
  import { BLOCKING_MODES, TTL_OPTIONS, UPSTREAMS, type BlockingMode, type Upstream } from '../../../lib/data/types';
  import { fmt } from '../../../lib/format';

  let { selected }: NodeProps = $props();

  const CACHE_STEPS = [0, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const modes = BLOCKING_MODES.map((m) => ({ value: m.value, label: m.label }));
  const upstreams = UPSTREAMS.map((u) => ({ value: u.value, label: `${u.label} ${u.ip.split('#')[0]}` }));
</script>

<NodeCard title="Decision" order={4} {selected} width={316} status={sinkhole.paused ? 'off' : 'on'}>
  <div class="inset p-3">
    <div class="grid grid-cols-2 gap-x-3">
      <div class="flex flex-col">
        <Port id="clients" type="target" kind="client" label="clients" />
        <Port id="allowed" type="target" kind="allow" label="allowed" />
        <Port id="blocked" type="target" kind="block" label="blocked" />
      </div>
      <div class="flex flex-col">
        <Port id="response" type="source" kind="up" label="response" />
        <Port id="sinkhole" type="source" kind="block" label="sinkhole" />
      </div>
    </div>

    <div class="divider"></div>

    <div class="flex flex-col gap-2">
      <div class="ctrl-row">
        <span class="label">Blocking mode</span>
        <Select
          label="Blocking mode"
          value={sinkhole.config.mode}
          options={modes}
          onchange={(v: BlockingMode) => sinkhole.setConfig({ mode: v })}
        />
      </div>
      <div class="ctrl-row">
        <span class="label">Cache size</span>
        <Stepper
          label="Cache size"
          value={sinkhole.config.cacheSize}
          values={CACHE_STEPS}
          onchange={(v) => sinkhole.setConfig({ cacheSize: v })}
        />
      </div>
      <div class="ctrl-row">
        <span class="label">TTL (seconds)</span>
        <Select
          label="TTL"
          value={sinkhole.config.ttl}
          options={TTL_OPTIONS}
          onchange={(v: number) => sinkhole.setConfig({ ttl: v })}
        />
      </div>
      <div class="ctrl-row">
        <span class="label">Upstream DNS</span>
        <Select
          label="Upstream DNS"
          value={sinkhole.config.upstream}
          options={upstreams}
          align="right"
          onchange={(v: Upstream) => sinkhole.setConfig({ upstream: v })}
        />
      </div>
    </div>
  </div>
  <div class="node-foot">
    <span>Cache hits <span class="mono">{sinkhole.cacheHitPct.toFixed(1)}%</span></span>
    <span>
      {#if sinkhole.paused}
        <span class="text-block">bypassing</span>
      {:else}
        blocked <span class="mono">{sinkhole.blockedPct.toFixed(1)}%</span>
      {/if}
    </span>
    <span class="mono">{fmt(sinkhole.totalToday)}</span>
  </div>
</NodeCard>
