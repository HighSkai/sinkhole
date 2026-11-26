<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui } from '../state/ui.svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-[132px] z-[70] flex flex-col items-center gap-2" aria-live="polite">
  {#each ui.toasts as t (t.id)}
    <div
      class="toast {t.tone}"
      in:fly={{ y: 10, duration: ui.reducedMotion ? 0 : 260, easing: cubicOut }}
      out:fade={{ duration: 180 }}
    >
      <span class="dot"></span>{t.text}
    </div>
  {/each}
</div>

<style>
  .toast {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 400;
    color: var(--color-ink);
    background: #232327;
    border: 1px solid rgb(255 255 255 / 0.08);
    box-shadow: 0 16px 36px rgb(0 0 0 / 0.5);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: #fff;
  }
  .good .dot {
    background: var(--color-allow);
    box-shadow: 0 0 8px var(--color-allow);
  }
  .warn .dot {
    background: var(--color-block);
    box-shadow: 0 0 8px var(--color-block);
  }
</style>
