<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui } from '../state/ui.svelte';
  import { ZoomIn, ZoomOut, Scan, Sparkles, MapIcon } from '../icons';
</script>

{#if ui.page === 'pipeline'}
  <aside
    class="rtb"
    aria-label="Canvas tools"
    transition:fly={{ x: 12, duration: ui.reducedMotion ? 0 : 220, easing: cubicOut }}
  >
    <button type="button" class="icon-btn" aria-label="Zoom in" data-tip="Zoom in" data-tip-side="left" onclick={() => ui.flow?.zoomIn()}>
      <ZoomIn size={16} />
    </button>
    <button type="button" class="icon-btn" aria-label="Zoom out" data-tip="Zoom out" data-tip-side="left" onclick={() => ui.flow?.zoomOut()}>
      <ZoomOut size={16} />
    </button>
    <button type="button" class="icon-btn" aria-label="Fit view" data-tip="Fit view" data-tip-side="left" onclick={() => ui.flow?.fitView()}>
      <Scan size={16} />
    </button>
    <span class="sep"></span>
    <button
      type="button"
      class="icon-btn toggle"
      class:on={ui.animations}
      aria-label="Toggle animations"
      aria-pressed={ui.animations}
      data-tip={ui.animations ? 'Animations on' : 'Animations off'}
      data-tip-side="left"
      onclick={() => (ui.animations = !ui.animations)}
    >
      <Sparkles size={16} />
    </button>
    <button
      type="button"
      class="icon-btn toggle"
      class:on={ui.minimap}
      aria-label="Toggle minimap"
      aria-pressed={ui.minimap}
      data-tip={ui.minimap ? 'Hide minimap' : 'Show minimap'}
      data-tip-side="left"
      onclick={() => (ui.minimap = !ui.minimap)}
    >
      <MapIcon size={16} />
    </button>
  </aside>
{/if}

<style>
  .rtb {
    position: fixed;
    right: 16px;
    top: 50%;
    translate: 0 -50%;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border-radius: 16px;
    background: rgb(28 28 31 / 0.88);
    border: 1px solid var(--color-line);
    box-shadow: var(--shadow-card);
  }
  .sep {
    height: 1px;
    margin: 4px 6px;
    background: rgb(255 255 255 / 0.07);
  }
  /* toolbar toggles use a calm "lit" state rather than the white fill */
  .toggle[aria-pressed='true'],
  .toggle[aria-pressed='false'] {
    background: transparent;
    color: var(--color-faint);
  }
  .toggle.on {
    color: var(--color-ink) !important;
    background: rgb(255 255 255 / 0.08) !important;
  }
  .toggle:hover {
    color: var(--color-ink);
  }
</style>
