<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    order?: number;
    selected?: boolean;
    width?: number;
    status?: 'on' | 'off' | 'warn';
    children: Snippet;
    actions?: Snippet;
    class?: string;
  }
  let { title, order = 0, selected = false, width = 260, status = 'on', children, actions, class: cls = '' }: Props =
    $props();
</script>

<div class="node-card {cls}" class:selected style="width: {width}px; --order: {order}">
  <div class="lift" aria-hidden="true"></div>
  <header>
    <span class="status {status}"></span>
    <h3>{title}</h3>
    {#if actions}<div class="ml-auto flex items-center gap-1">{@render actions()}</div>{/if}
  </header>
  {@render children()}
</div>

<style>
  .node-card {
    position: relative;
    padding: 12px;
    border-radius: var(--radius-card);
    background: var(--color-card);
    border: 1px solid var(--color-line);
    box-shadow: var(--shadow-card);
    transition:
      transform 260ms var(--ease-out-soft),
      border-color 260ms ease;
  }
  /* stronger shadow lives on a sibling layer so hover only animates opacity */
  .lift {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: var(--shadow-card-hi);
    opacity: 0;
    pointer-events: none;
    transition: opacity 260ms ease;
    z-index: -1;
  }
  :global(.svelte-flow__node:hover) .node-card {
    transform: translateY(-2px);
  }
  :global(.svelte-flow__node:hover) .lift {
    opacity: 1;
  }
  .selected {
    border-color: rgb(255 255 255 / 0.14);
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 4px 0 6px;
    margin-bottom: 10px;
  }
  h3 {
    font-size: 14px;
    font-weight: 400;
    color: #fff;
    letter-spacing: 0.005em;
  }
  .status {
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: #fff;
    box-shadow: 0 0 8px rgb(255 255 255 / 0.6);
    transition:
      background-color 400ms ease,
      box-shadow 400ms ease;
  }
  .status.off {
    background: #5d5d66;
    box-shadow: none;
  }
  .status.warn {
    background: #f87171;
    box-shadow: 0 0 8px rgb(248 113 113 / 0.7);
  }

  :global(.intro) .node-card {
    animation: node-in 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--order) * 60ms);
  }
  @keyframes node-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.96);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.intro) .node-card {
      animation: fade-in 400ms ease both;
      animation-delay: calc(var(--order) * 40ms);
    }
    :global(.svelte-flow__node:hover) .node-card {
      transform: none;
    }
  }
</style>
