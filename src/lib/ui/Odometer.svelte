<script lang="ts">
  import { untrack } from 'svelte';
  import OdoDigit from './OdoDigit.svelte';
  import { ui } from '../state/ui.svelte';
  import { fmt } from '../format';

  interface Props {
    value: number;
    format?: (n: number) => string;
    /** minimum ms between visual updates so each roll can finish */
    throttle?: number;
    class?: string;
  }
  let { value, format = fmt, throttle = 680, class: cls = '' }: Props = $props();

  let shown = $state(untrack(() => value));
  let dir = $state(1);
  let last = 0;

  $effect(() => {
    const v = value;
    const apply = () => {
      const cur = untrack(() => shown);
      if (v === cur) return;
      dir = v >= cur ? 1 : -1;
      shown = v;
      last = performance.now();
    };
    const wait = throttle - (performance.now() - last);
    if (wait <= 0) {
      apply();
      return;
    }
    const t = setTimeout(apply, wait);
    return () => clearTimeout(t);
  });

  const text = $derived(format(shown));
  const chars = $derived([...text]);
  const animate = $derived(ui.motion && !ui.reducedMotion);
</script>

<span class="odo mono {cls}">
  <span class="sr-only">{format(value)}</span>
  <span aria-hidden="true" class="odo-digits">
    {#each chars as ch, i (chars.length - i)}
      {#if ch >= '0' && ch <= '9'}
        <OdoDigit digit={+ch} {dir} {animate} delay={(chars.length - 1 - i) * 28} />
      {:else}
        <span class="odo-sep">{ch}</span>
      {/if}
    {/each}
  </span>
</span>

<style>
  .odo {
    display: inline-flex;
    font-variant-numeric: tabular-nums;
  }
  .odo-digits {
    display: inline-flex;
    line-height: 1.2em;
    height: 1.2em;
  }
  .odo-sep {
    display: inline-block;
    line-height: 1.2em;
  }
</style>
