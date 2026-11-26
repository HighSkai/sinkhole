<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import NodeCard from './NodeCard.svelte';
  import Port from './Port.svelte';
  import Logo from '../../../lib/logo/Logo.svelte';
  import { makeLogo } from '../../../lib/logo/geometry';
  import Odometer from '../../../lib/ui/Odometer.svelte';
  import Select from '../../../lib/ui/Select.svelte';
  import { sinkhole, type Range } from '../../../lib/data/store.svelte';
  import { ui } from '../../../lib/state/ui.svelte';
  import { exportBlocked, summaryText, type ExportFormat } from '../../../lib/export';
  import { sinkTarget, fallBus } from '../geometry';
  import { Expand, Pin, PinOff, Copy, RotateCcw, Download } from '../../../lib/icons';

  let { id, selected, positionAbsoluteX, positionAbsoluteY, data }: NodeProps = $props();

  const LOGO_W = 300;
  const RATIO = 0.7;
  const geo = makeLogo(RATIO, { cracks: 6 });

  let card = $state<HTMLDivElement>();
  let holeBox = $state<HTMLDivElement>();
  let logo = $state<ReturnType<typeof Logo>>();
  let local = $state({ x: 0, y: 0 });

  let range = $state<Range>('24h');
  let format = $state<ExportFormat>('csv');
  const RANGES = [
    { value: '1h' as Range, label: '1h' },
    { value: '24h' as Range, label: '24h' },
    { value: '7d' as Range, label: '7d' },
    { value: '30d' as Range, label: '30d' }
  ];
  const FORMATS = [
    { value: 'csv' as ExportFormat, label: 'CSV' },
    { value: 'json' as ExportFormat, label: 'JSON' }
  ];
  const rangeLabel = $derived({ '1h': 'Blocked · last hour', '24h': 'Blocked today', '7d': 'Blocked · 7 days', '30d': 'Blocked · 30 days' }[range]);
  const count = $derived(sinkhole.blockedIn(range));
  const top = $derived(sinkhole.topBlocked[0]?.[0] ?? '—');
  const pinned = $derived(!!data?.pinned);

  /** measure where the hole sits inside the card, in node-local (unzoomed) px */
  function measure() {
    if (!card || !holeBox) return;
    const cr = card.getBoundingClientRect();
    const hr = holeBox.getBoundingClientRect();
    const zoom = cr.width / card.offsetWidth || 1;
    const svgH = (LOGO_W * geo.h) / geo.w;
    local = {
      x: (hr.left - cr.left) / zoom + (geo.depth.cx / geo.w) * LOGO_W,
      y: (hr.top - cr.top) / zoom + (geo.depth.cy / geo.h) * svgH
    };
    sinkTarget.rx = (geo.depth.rx / geo.w) * LOGO_W;
    sinkTarget.ry = (geo.depth.ry / geo.h) * svgH;
  }

  onMount(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (card) ro.observe(card);
    const off = fallBus.on(() => logo?.fall());
    return () => {
      ro.disconnect();
      off();
      sinkTarget.ready = false;
    };
  });

  $effect(() => {
    sinkTarget.x = positionAbsoluteX + local.x;
    sinkTarget.y = positionAbsoluteY + local.y;
    sinkTarget.ready = local.x > 0;
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryText(range));
      ui.toast('Summary copied to clipboard', 'good');
    } catch {
      ui.toast('Clipboard unavailable', 'warn');
    }
  }
</script>

<div bind:this={card}>
  <NodeCard title="Sinkhole" order={5} {selected} width={360} status={sinkhole.paused ? 'off' : 'on'}>
    <div class="inset p-3">
      <Port id="in" type="target" kind="block" label="blocked" meta={sinkhole.paused ? 'paused' : 'null-routed'} />

      <div class="result">
        <div class="aura" class:dim={sinkhole.paused}></div>
        <div class="hole" bind:this={holeBox}>
          <Logo
            bind:this={logo}
            width={LOGO_W}
            ratio={RATIO}
            cracks={6}
            paused={sinkhole.paused}
            idle={ui.motion}
            swirl={0.7}
          />
        </div>
        <div class="caption">
          <span class="label text-soft!">{rangeLabel}</span>
          <div class="text-[30px] leading-none font-[400] tracking-tight text-white">
            <Odometer value={count} />
          </div>
          <div class="mt-1 flex min-w-0 items-center gap-2 text-[12px] text-soft">
            <span class="shrink-0 text-muted">Top blocked:</span>
            <span class="mono truncate text-white">{top}</span>
          </div>
        </div>
      </div>
    </div>
  </NodeCard>

  <div class="toolbar nodrag" role="toolbar" aria-label="Sinkhole tools">
    <button type="button" class="tb" aria-label="Expand" data-tip="Expand" onclick={() => (ui.overlay = 'sinkhole')}><Expand size={14} /></button>
    <button
      type="button"
      class="tb"
      aria-label={pinned ? 'Unpin node' : 'Pin node'}
      aria-pressed={pinned}
      data-tip={pinned ? 'Unpin' : 'Pin in place'}
      onclick={() => (data?.togglePin as ((id: string) => void) | undefined)?.(id)}
    >
      {#if pinned}<PinOff size={14} />{:else}<Pin size={14} />{/if}
    </button>
    <button type="button" class="tb" aria-label="Copy summary" data-tip="Copy summary" onclick={copy}><Copy size={14} /></button>
    <button
      type="button"
      class="tb"
      aria-label="Reset counter"
      data-tip="Reset counter"
      onclick={() => {
        sinkhole.resetCounter();
        ui.toast('Blocked counter reset');
      }}
    >
      <RotateCcw size={14} />
    </button>
    <span class="sep"></span>
    <Select size="sm" label="Range" bind:value={range} options={RANGES} up class="w-[64px]" />
    <Select size="sm" label="Format" bind:value={format} options={FORMATS} up class="w-[70px]" />
    <button
      type="button"
      class="tb"
      aria-label="Download"
      data-tip="Download"
      onclick={() => {
        exportBlocked(range, format);
        ui.toast(`Downloaded blocked domains (${range}, ${format.toUpperCase()})`, 'good');
      }}
    >
      <Download size={14} />
    </button>
  </div>
</div>

<style>
  .result {
    position: relative;
    margin-top: 8px;
    height: 300px;
    border-radius: 12px;
    overflow: hidden;
    background:
      radial-gradient(70% 55% at 50% 52%, rgb(139 92 246 / 0.14), transparent 70%),
      #161619;
    border: 1px solid rgb(255 255 255 / 0.04);
  }
  .aura {
    position: absolute;
    left: 50%;
    top: 46%;
    width: 340px;
    height: 240px;
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgb(255 107 157 / 0.22), rgb(139 92 246 / 0.12) 55%, transparent);
    transition: opacity 700ms ease;
  }
  .aura.dim {
    opacity: 0.15;
  }
  .hole {
    position: absolute;
    left: 50%;
    top: 8px;
    translate: -50% 0;
  }
  .caption {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 40px 14px 12px;
    background: linear-gradient(180deg, transparent, rgb(10 10 12 / 0.78) 45%, rgb(10 10 12 / 0.92));
  }

  .toolbar {
    position: absolute;
    left: 50%;
    top: calc(100% + 12px);
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    border-radius: 14px;
    background: rgb(28 28 31 / 0.94);
    border: 1px solid var(--color-line);
    box-shadow: 0 14px 30px rgb(0 0 0 / 0.45);
    white-space: nowrap;
  }
  .tb {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: var(--color-soft);
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }
  .tb:hover {
    background: rgb(255 255 255 / 0.07);
    color: #fff;
  }
  .tb[aria-pressed='true'] {
    background: #f4f4f6;
    color: #111113;
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: rgb(255 255 255 / 0.08);
  }
</style>
