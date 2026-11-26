<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { WireKind } from '../geometry';

  interface Props {
    id: string;
    type: 'source' | 'target';
    kind: WireKind;
    label: string;
    /** distance from this row's edge to the card's outer border */
    edge?: number;
    meta?: string;
  }
  let { id, type, kind, label, edge = 25, meta }: Props = $props();
  const out = $derived(type === 'source');
</script>

<div class="port-row" class:out>
  <Handle
    {id}
    {type}
    position={out ? Position.Right : Position.Left}
    isConnectable={false}
    class="port-dot {kind}"
    style="{out ? 'right' : 'left'}: {-edge}px"
  />
  <span class="port-label">{label}</span>
  {#if meta}<span class="port-meta mono">{meta}</span>{/if}
</div>

<style>
  .port-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    font-size: 12px;
    color: var(--color-muted);
    transition: color 160ms ease;
  }
  .port-row.out {
    flex-direction: row-reverse;
  }
  .port-row:hover {
    color: var(--color-ink);
  }
  .port-meta {
    font-size: 11px;
    color: var(--color-faint);
  }
  .out .port-meta {
    margin-right: auto;
  }
  .port-row:not(.out) .port-meta {
    margin-left: auto;
  }
</style>
