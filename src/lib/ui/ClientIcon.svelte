<script lang="ts">
  import type { ClientKind } from '../data/types';
  import { Laptop, Smartphone, Tv, Gamepad, Tablet, Speaker, Cctv, Thermometer, Refrigerator } from '../icons';

  let { kind, size = 14 }: { kind: ClientKind; size?: number } = $props();
  const map = { laptop: Laptop, phone: Smartphone, tv: Tv, console: Gamepad, tablet: Tablet, speaker: Speaker, camera: Cctv, thermostat: Thermometer, fridge: Refrigerator };
  const Icon = $derived(map[kind] ?? Laptop);
</script>

<Icon {size} strokeWidth={1.6} />
