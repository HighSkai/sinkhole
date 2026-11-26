<script lang="ts">
  import { untrack } from 'svelte';

  let { digit, dir = 1, animate = true, delay = 0 }: { digit: number; dir?: number; animate?: boolean; delay?: number } =
    $props();

  // The strip holds 0–9 three times; the resting window is the middle copy (10–19),
  // so a digit can always roll forward (9 → 0) or backward without a visible jump.
  let pos = $state(10 + untrack(() => digit));
  let instant = $state(true);
  let prev = untrack(() => digit);

  $effect(() => {
    const d = digit;
    if (d === prev) return;
    const from = prev;
    prev = d;
    untrack(() => {
      if (!animate) {
        instant = true;
        pos = 10 + d;
        return;
      }
      const step = (p: number) => (dir >= 0 ? p + ((d - from + 10) % 10) : p - ((from - d + 10) % 10));
      let target = step(pos);
      if (target < 0 || target > 29) target = step(10 + from);
      instant = false;
      pos = target;
    });
  });

  function settle() {
    instant = true;
    pos = 10 + (pos % 10);
  }
</script>

<span class="odo-col">
  <span
    class="odo-strip"
    class:instant
    style="transform: translate3d(0, {-pos * 1.2}em, 0); transition-delay: {delay}ms"
    ontransitionend={settle}
  >
    {#each { length: 30 } as _, i (i)}<span>{i % 10}</span>{/each}
  </span>
</span>

<style>
  .odo-col {
    display: inline-block;
    height: 1.2em;
    line-height: 1.2em;
    overflow: hidden;
    vertical-align: top;
  }
  .odo-strip {
    display: block;
    will-change: transform;
    transition: transform 620ms cubic-bezier(0.2, 0.85, 0.25, 1);
  }
  .odo-strip.instant {
    transition: none;
  }
  .odo-strip > span {
    display: block;
    height: 1.2em;
    text-align: center;
  }
</style>
