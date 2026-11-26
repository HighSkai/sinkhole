<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';

  type Api = ReturnType<typeof useSvelteFlow>;
  let { register }: { register: (api: Api) => void } = $props();

  // must be called during init, inside <SvelteFlow>'s context
  // svelte-ignore state_referenced_locally
  register(useSvelteFlow());
</script>
