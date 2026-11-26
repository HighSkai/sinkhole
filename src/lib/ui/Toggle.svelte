<script lang="ts">
  interface Props {
    checked: boolean;
    onchange?: (v: boolean) => void;
    label?: string;
    tone?: 'white' | 'red' | 'green';
    size?: 'sm' | 'md';
  }
  let { checked = $bindable(), onchange, label = 'Toggle', tone = 'white', size = 'md' }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  class="toggle nodrag {tone} {size}"
  class:on={checked}
  onclick={() => {
    checked = !checked;
    onchange?.(checked);
  }}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    position: relative;
    flex-shrink: 0;
    width: 32px;
    height: 18px;
    border-radius: 999px;
    background: #2e2e34;
    border: 1px solid rgb(255 255 255 / 0.06);
    transition: background-color 200ms ease;
  }
  .toggle.sm {
    width: 26px;
    height: 15px;
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: #77777f;
    transition:
      transform 260ms var(--ease-spring),
      background-color 200ms ease;
  }
  .sm .knob {
    width: 9px;
    height: 9px;
  }
  .on {
    background: #f4f4f6;
  }
  .on.red {
    background: #f87171;
  }
  .on.green {
    background: #4ade80;
  }
  .on .knob {
    transform: translateX(14px);
    background: #111113;
  }
  .sm.on .knob {
    transform: translateX(11px);
  }
</style>
