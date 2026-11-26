<script lang="ts">
  // Split out so the minimap code only loads when the toggle is first switched on.
  import { MiniMap } from '@xyflow/svelte';
</script>

<MiniMap
  position="bottom-left"
  pannable
  zoomable
  width={180}
  height={120}
  nodeBorderRadius={12}
  nodeColor={(n) => (n.id === 'sinkhole' ? '#3a2a33' : n.id === 'decision' ? '#2d2840' : '#2a2a30')}
/>
