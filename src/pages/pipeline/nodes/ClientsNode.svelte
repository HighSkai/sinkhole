<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  import NodeCard from './NodeCard.svelte';
  import Sparkline from '../../../lib/ui/Sparkline.svelte';
  import ClientIcon from '../../../lib/ui/ClientIcon.svelte';
  import { sinkhole } from '../../../lib/data/store.svelte';
  import { ui } from '../../../lib/state/ui.svelte';

  let { selected }: NodeProps = $props();
</script>

<NodeCard title="Clients" order={0} {selected} width={272}>
  <div class="inset flex flex-col gap-1 p-3">
    {#each sinkhole.clients as c (c.id)}
      <div class="port-row client">
        <button
          type="button"
          class="who nodrag"
          onclick={() => ui.openLogFor({ client: c.id })}
          aria-label="Show {c.name} in the query log"
        >
          <span class="ico"><ClientIcon kind={c.kind} size={15} /></span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block truncate text-[13px] text-ink">{c.name}</span>
            <span class="mono block text-[11px] text-faint">{c.ip}</span>
          </span>
        </button>
        <Sparkline data={c.spark} width={60} height={20} color="#facc15" stroke={1.2} />
        <Handle
          type="source"
          id={'c-' + c.id}
          position={Position.Right}
          isConnectable={false}
          class="port-dot client"
          style="right: -19px"
        />
      </div>
    {/each}
  </div>
  <div class="node-foot">
    <span>{sinkhole.clients.length} devices</span>
    <span><span class="mono">{sinkhole.qps.toFixed(1)}</span> q/s</span>
  </div>
</NodeCard>

<style>
  .client {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 6px;
    margin: 0 -6px;
    border-radius: 10px;
    transition: background-color 160ms ease;
  }
  .client:hover {
    background: rgb(255 255 255 / 0.03);
  }
  .who {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: 10px;
  }
  .ico {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: #2a2a2f;
    color: #facc15;
    flex-shrink: 0;
  }
</style>
