<script lang="ts">
  import Caret from './Caret.svelte';

  interface Props {
    value: number;
    /** discrete stops; when set, ◀ ▶ walk through these */
    values?: number[];
    min?: number;
    max?: number;
    step?: number;
    format?: (n: number) => string;
    onchange?: (v: number) => void;
    label?: string;
    size?: 'sm' | 'md';
  }
  let {
    value = $bindable(),
    values,
    min = 0,
    max = 1e9,
    step = 1,
    format = (n) => String(n),
    onchange,
    label = 'Value',
    size = 'md'
  }: Props = $props();

  function nudge(dir: -1 | 1) {
    let next: number;
    if (values?.length) {
      const i = values.findIndex((v) => v >= value);
      const idx = i < 0 ? values.length - 1 : values[i] === value ? i + dir : dir > 0 ? i : i - 1;
      next = values[Math.max(0, Math.min(values.length - 1, idx))];
    } else {
      next = Math.max(min, Math.min(max, value + dir * step));
    }
    if (next !== value) {
      value = next;
      onchange?.(next);
    }
  }

  // press-and-hold repeats, accelerating
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  function hold(dir: -1 | 1) {
    nudge(dir);
    let delay = 380;
    const again = () => {
      nudge(dir);
      delay = Math.max(60, delay * 0.78);
      holdTimer = setTimeout(again, delay);
    };
    holdTimer = setTimeout(again, delay);
  }
  const release = () => clearTimeout(holdTimer);
</script>

<div class="stepper nodrag {size}" role="group" aria-label={label}>
  <button
    type="button"
    aria-label="Decrease {label}"
    onpointerdown={() => hold(-1)}
    onpointerup={release}
    onpointerleave={release}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudge(-1))}
  >
    <Caret dir="left" size={9} />
  </button>
  <output class="mono">{format(value)}</output>
  <button
    type="button"
    aria-label="Increase {label}"
    onpointerdown={() => hold(1)}
    onpointerup={release}
    onpointerleave={release}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudge(1))}
  >
    <Caret dir="right" size={9} />
  </button>
</div>

<style>
  .stepper {
    display: inline-grid;
    grid-template-columns: 28px 1fr 28px;
    align-items: stretch;
    height: 30px;
    min-width: 120px;
    border-radius: var(--radius-pill);
    background: var(--color-pill);
    border: 1px solid rgb(255 255 255 / 0.04);
    overflow: hidden;
  }
  .sm {
    height: 26px;
    grid-template-columns: 24px 1fr 24px;
  }
  button {
    display: grid;
    place-items: center;
    color: #fff;
    transition: background-color 140ms ease;
  }
  button:first-child {
    border-right: 1px solid rgb(0 0 0 / 0.35);
  }
  button:last-child {
    border-left: 1px solid rgb(0 0 0 / 0.35);
  }
  button:hover {
    background: rgb(255 255 255 / 0.06);
  }
  button:active {
    background: rgb(255 255 255 / 0.1);
  }
  output {
    display: grid;
    place-items: center;
    font-size: 12px;
    color: var(--color-ink);
    padding: 0 6px;
  }
</style>
