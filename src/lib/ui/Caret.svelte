<script lang="ts">
  let {
    dir = 'down',
    size = 8,
    class: cls = ''
  }: { dir?: 'down' | 'left' | 'right' | 'up'; size?: number; class?: string } = $props();
  const rot = { down: 0, left: 90, up: 180, right: -90 };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 8 8"
  class="shrink-0 {cls}"
  style="transform: rotate({rot[dir]}deg)"
  aria-hidden="true"
>
  <path d="M1.2 2.6h5.6L4 5.8z" fill="currentColor" />
</svg>
