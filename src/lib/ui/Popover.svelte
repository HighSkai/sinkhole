<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui } from '../state/ui.svelte';

  interface Props {
    open: boolean;
    trigger: Snippet;
    children: Snippet;
    align?: 'left' | 'right' | 'center';
    up?: boolean;
    width?: number;
    class?: string;
  }
  let { open = $bindable(false), trigger, children, align = 'right', up = false, width = 220, class: cls = '' }: Props =
    $props();

  let root = $state<HTMLDivElement>();

  $effect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (open = false);
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', esc);
    };
  });
</script>

<div class="relative {cls}" bind:this={root}>
  {@render trigger()}
  {#if open}
    <div
      class="pop {align}"
      class:up
      style="width: {width}px"
      role="menu"
      tabindex="-1"
      transition:fly={{ y: up ? 6 : -6, duration: ui.reducedMotion ? 0 : 160, easing: cubicOut }}
    >
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .pop {
    position: absolute;
    z-index: 80;
    top: calc(100% + 8px);
    padding: 6px;
    border-radius: 14px;
    background: #222226;
    border: 1px solid rgb(255 255 255 / 0.08);
    box-shadow: 0 24px 48px rgb(0 0 0 / 0.55);
  }
  .pop.up {
    top: auto;
    bottom: calc(100% + 10px);
  }
  .right {
    right: 0;
  }
  .left {
    left: 0;
  }
  .center {
    left: 50%;
    translate: -50% 0;
  }
  .pop :global(.pop-label) {
    padding: 6px 10px 4px;
    font-size: 11px;
    color: var(--color-faint);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .pop :global(.pop-item) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 400;
    color: var(--color-soft);
    text-align: left;
    transition: background-color 120ms ease;
  }
  .pop :global(.pop-item:hover),
  .pop :global(.pop-item:focus-visible) {
    background: rgb(255 255 255 / 0.07);
    color: var(--color-ink);
    outline: none;
  }
  .pop :global(.pop-item .kbd) {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-faint);
  }
  .pop :global(.pop-sep) {
    height: 1px;
    margin: 6px 4px;
    background: rgb(255 255 255 / 0.06);
  }
</style>
