<script lang="ts" generics="T extends string | number">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Caret from './Caret.svelte';

  interface Option {
    value: T;
    label: string;
    hint?: string;
  }
  interface Props {
    value: T;
    options: Option[];
    onchange?: (v: T) => void;
    label?: string;
    size?: 'sm' | 'md';
    align?: 'left' | 'right';
    up?: boolean;
    class?: string;
    display?: (o: Option | undefined) => string;
  }

  let {
    value = $bindable(),
    options,
    onchange,
    label = 'Select',
    size = 'md',
    align = 'left',
    up = false,
    class: cls = '',
    display
  }: Props = $props();

  let open = $state(false);
  let active = $state(0);
  let root = $state<HTMLDivElement>();
  let list = $state<HTMLDivElement>();

  const current = $derived(options.find((o) => o.value === value));

  function choose(o: Option) {
    value = o.value;
    onchange?.(o.value);
    open = false;
  }

  function toggle() {
    open = !open;
    if (open) active = Math.max(0, options.findIndex((o) => o.value === value));
  }

  function onkey(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === 'Escape') {
      open = false;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % options.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + options.length) % options.length;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(options[active]);
    }
  }

  $effect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sel nodrag nowheel nopan {size} {cls}" class:open bind:this={root} onkeydown={onkey}>
  <button
    type="button"
    class="sel-btn"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={label}
    onclick={toggle}
  >
    <span class="truncate">{display ? display(current) : (current?.label ?? '—')}</span>
    <Caret class="caret" />
  </button>
  {#if open}
    <div
      bind:this={list}
      class="sel-list"
      class:right={align === 'right'}
      class:up
      role="listbox"
      aria-label={label}
      transition:fly={{ y: up ? 4 : -4, duration: 150, easing: cubicOut }}
    >
      {#each options as o, i (o.value)}
        <button
          type="button"
          role="option"
          aria-selected={o.value === value}
          class="sel-opt"
          class:active={i === active}
          onpointerenter={() => (active = i)}
          onclick={() => choose(o)}
        >
          <span class="truncate">{o.label}</span>
          {#if o.hint}<span class="hint">{o.hint}</span>{/if}
          {#if o.value === value}<span class="tick"></span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sel {
    position: relative;
    display: inline-block;
    min-width: 0;
  }
  .sel-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    height: 30px;
    padding: 0 10px 0 12px;
    border-radius: var(--radius-pill);
    background: var(--color-pill);
    border: 1px solid rgb(255 255 255 / 0.04);
    color: var(--color-ink);
    font-size: 12px;
    font-weight: 400;
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .sm .sel-btn {
    height: 26px;
    padding: 0 8px 0 10px;
    font-size: 11px;
  }
  .sel-btn:hover,
  .open .sel-btn {
    background: var(--color-pill-hi);
    border-color: rgb(255 255 255 / 0.08);
  }
  .sel-btn :global(.caret) {
    color: #fff;
    transition: transform 180ms var(--ease-out-soft);
  }
  .open .sel-btn :global(.caret) {
    transform: rotate(180deg);
  }
  .sel-list {
    position: absolute;
    z-index: 50;
    top: calc(100% + 6px);
    left: 0;
    min-width: 100%;
    padding: 4px;
    border-radius: 12px;
    background: #26262b;
    border: 1px solid rgb(255 255 255 / 0.08);
    box-shadow: 0 18px 40px rgb(0 0 0 / 0.55);
  }
  .sel-list.right {
    left: auto;
    right: 0;
  }
  .sel-list.up {
    top: auto;
    bottom: calc(100% + 6px);
  }
  .sel-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 400;
    color: var(--color-soft);
    white-space: nowrap;
    text-align: left;
  }
  .sel-opt.active {
    background: rgb(255 255 255 / 0.07);
    color: var(--color-ink);
  }
  .hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--color-faint);
    font-family: var(--font-mono);
  }
  .tick {
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: #fff;
    margin-left: auto;
    flex-shrink: 0;
  }
  .hint + .tick {
    margin-left: 0;
  }
</style>
