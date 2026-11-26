<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import NodeCard from './NodeCard.svelte';
  import Port from './Port.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import Odometer from '../../../lib/ui/Odometer.svelte';
  import { sinkhole } from '../../../lib/data/store.svelte';
  import { UPSTREAMS } from '../../../lib/data/types';

  let { selected }: NodeProps = $props();
  const up = $derived(UPSTREAMS.find((u) => u.value === sinkhole.config.upstream) ?? UPSTREAMS[0]);
  const proto = $derived({ udp: 'UDP :53', dot: 'DoT :853', doh: 'DoH :443' }[sinkhole.config.protocol]);
  const health = $derived(sinkhole.latency < 25 ? 'good' : sinkhole.latency < 60 ? 'ok' : 'slow');
</script>

<NodeCard title="Upstream" order={6} {selected} width={268}>
  <div class="inset p-3">
    <Port id="in" type="target" kind="up" label="response" meta={proto} />

    <div class="mt-2 flex items-end justify-between px-1">
      <div>
        <span class="label">Latency</span>
        <div class="flex items-baseline gap-1 text-[28px] leading-tight font-[400] text-ink">
          <Odometer value={sinkhole.latency} throttle={900} />
          <span class="text-[13px] text-muted">ms</span>
        </div>
      </div>
      <span class="pill {health}">{health}</span>
    </div>
    <div class="mt-2">
      <Sparkline data={sinkhole.latencySpark} width={218} height={34} color="#60a5fa" stroke={1.3} dot />
    </div>
    <div class="row">
      <span class="label">Resolver</span>
      <span class="mono text-[12px] text-ink">{up.label} · {up.ip}</span>
    </div>
    <div class="row">
      <span class="label">DNSSEC</span>
      <span class="mono text-[12px]" class:text-allow={sinkhole.config.dnssec} class:text-faint={!sinkhole.config.dnssec}>
        {sinkhole.config.dnssec ? 'validating' : 'off'}
      </span>
    </div>
  </div>
</NodeCard>

<style>
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 28px;
    padding: 0 4px;
    border-top: 1px solid rgb(255 255 255 / 0.04);
  }
  .row:first-of-type {
    margin-top: 8px;
  }
  .pill {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 99px;
    background: rgb(96 165 250 / 0.12);
    color: #93c5fd;
    margin-bottom: 6px;
  }
  .pill.slow {
    background: rgb(248 113 113 / 0.12);
    color: #fca5a5;
  }
</style>
