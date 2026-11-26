<script lang="ts">
  import { onMount } from 'svelte';
  import {
    SvelteFlow,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    type useSvelteFlow,
    type FitViewOptions
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/base.css';
  import './pipeline.css';

  import FlowBridge from './FlowBridge.svelte';
  import PacketLayer from './PacketLayer.svelte';
  import Aurora from './Aurora.svelte';
  import Wire from './Wire.svelte';
  import ClientsNode from './nodes/ClientsNode.svelte';
  import QueryNode from './nodes/QueryNode.svelte';
  import BlocklistsNode from './nodes/BlocklistsNode.svelte';
  import AllowlistNode from './nodes/AllowlistNode.svelte';
  import DecisionNode from './nodes/DecisionNode.svelte';
  import SinkholeNode from './nodes/SinkholeNode.svelte';
  import UpstreamNode from './nodes/UpstreamNode.svelte';
  import { sinkhole } from '../../lib/data/store.svelte';
  import { ui } from '../../lib/state/ui.svelte';
  import type { WireKind } from './geometry';

  let { active = true }: { active?: boolean } = $props();

  const nodeTypes: NodeTypes = {
    clients: ClientsNode,
    query: QueryNode,
    blocklists: BlocklistsNode,
    allowlist: AllowlistNode,
    decision: DecisionNode,
    sinkhole: SinkholeNode,
    upstream: UpstreamNode
  };
  const edgeTypes: EdgeTypes = { wire: Wire };

  const LAYOUT_KEY = 'sinkhole.layout';
  const DEFAULT: Record<string, { x: number; y: number }> = {
    clients: { x: 0, y: 40 },
    query: { x: 384, y: 24 },
    blocklists: { x: 776, y: -296 },
    allowlist: { x: 776, y: 300 },
    decision: { x: 1200, y: 24 },
    sinkhole: { x: 1648, y: -264 },
    upstream: { x: 1648, y: 330 }
  };

  function loadLayout(): Record<string, { x: number; y: number }> {
    try {
      return { ...DEFAULT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') };
    } catch {
      return { ...DEFAULT };
    }
  }
  function saveLayout() {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(Object.fromEntries(nodes.map((n) => [n.id, n.position]))));
    } catch {
      /* ignore */
    }
  }

  function togglePin(id: string) {
    nodes = nodes.map((n) =>
      n.id === id ? { ...n, draggable: !!n.data.pinned, data: { ...n.data, pinned: !n.data.pinned } } : n
    );
    ui.toast(nodes.find((n) => n.id === id)?.data.pinned ? 'Sinkhole pinned in place' : 'Sinkhole unpinned');
  }

  function makeNodes(pos = loadLayout()): Node[] {
    return Object.keys(DEFAULT).map((id) => ({
      id,
      type: id,
      position: { ...pos[id] },
      data: id === 'sinkhole' ? { pinned: false, togglePin } : {},
      dragHandle: undefined,
      selected: id === 'decision'
    }));
  }

  const edge = (
    id: string,
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string,
    kind: WireKind,
    order: number
  ): Edge => ({
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: 'wire',
    data: { kind, order },
    selectable: false,
    focusable: false
  });

  function makeEdges(clientIds: string[]): Edge[] {
    return [
      ...clientIds.map((c, i) => edge(`e-c-${c}`, 'clients', `c-${c}`, 'query', 'in', 'client', i * 0.6)),
      edge('e-q-bl', 'query', 'out', 'blocklists', 'in', 'client', 3),
      edge('e-q-al', 'query', 'out', 'allowlist', 'in', 'client', 3.3),
      edge('e-q-dc', 'query', 'out', 'decision', 'clients', 'client', 3.6),
      edge('e-bl-dc', 'blocklists', 'blocked', 'decision', 'blocked', 'block', 5),
      edge('e-al-dc', 'allowlist', 'allowed', 'decision', 'allowed', 'allow', 5.3),
      edge('e-dc-sk', 'decision', 'sinkhole', 'sinkhole', 'in', 'block', 7),
      edge('e-dc-up', 'decision', 'response', 'upstream', 'in', 'up', 7.3)
    ];
  }

  let nodes = $state.raw<Node[]>(makeNodes());
  let edges = $state.raw<Edge[]>([]);

  const clientKey = $derived(sinkhole.clients.map((c) => c.id).join('|'));
  $effect(() => {
    const ids = clientKey ? clientKey.split('|') : [];
    // let the Clients node render its new handles before wiring them up
    // (timer fallback in case rAF is throttled while the page is offscreen)
    let done = false;
    const wire = () => {
      if (done) return;
      done = true;
      edges = makeEdges(ids);
    };
    requestAnimationFrame(wire);
    setTimeout(wire, 100);
  });

  /* ---------- flow api for the shell toolbar ---------- */
  let api: ReturnType<typeof useSvelteFlow> | null = null;
  const getViewport = () => api?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
  const PAD: NonNullable<FitViewOptions['padding']> = { top: '104px', bottom: '150px', left: '48px', right: '96px' };
  const FIT = { padding: PAD, duration: 600 };

  function register(a: ReturnType<typeof useSvelteFlow>) {
    api = a;
    ui.flow = {
      zoomIn: () => a.zoomIn({ duration: 240 }),
      zoomOut: () => a.zoomOut({ duration: 240 }),
      fitView: () => a.fitView(FIT),
      focusNode: (id) => {
        const n = a.getInternalNode(id);
        if (!n) return;
        const w = n.measured.width ?? 280;
        const h = n.measured.height ?? 300;
        a.setCenter(n.internals.positionAbsolute.x + w / 2, n.internals.positionAbsolute.y + h / 2, {
          zoom: Math.max(a.getZoom(), 0.9),
          duration: 700
        });
        ui.selectedNode = id;
      },
      resetLayout: () => {
        try {
          localStorage.removeItem(LAYOUT_KEY);
        } catch {
          /* ignore */
        }
        nodes = makeNodes({ ...DEFAULT });
        setTimeout(() => a.fitView(FIT), 30);
        ui.toast('Layout reset');
      }
    };
  }

  /* ---------- intro choreography ---------- */
  let intro = $state(ui.motion);
  $effect(() => {
    if (!ui.motion) intro = false;
  });
  onMount(() => {
    const t = setTimeout(() => (intro = false), 2400);
    return () => {
      clearTimeout(t);
      ui.flow = null;
    };
  });
</script>

<div class="pipeline" class:intro>
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    class="sinkhole-flow"
    fitView
    fitViewOptions={{ padding: PAD }}
    minZoom={0.25}
    maxZoom={1.75}
    nodesConnectable={false}
    edgesFocusable={false}
    deleteKey={null}
    selectionKey={null}
    multiSelectionKey={null}
    selectionOnDrag={false}
    zoomOnDoubleClick={false}
    elevateNodesOnSelect={false}
    proOptions={{ hideAttribution: true }}
    onnodeclick={({ node }) => (ui.selectedNode = node.id)}
    onnodedragstart={({ targetNode }) => targetNode && (ui.selectedNode = targetNode.id)}
    onnodedragstop={saveLayout}
  >
    <Background variant={BackgroundVariant.Dots} gap={24} size={2} bgColor="#111113" patternColor="#2a2a2e" />
    <Aurora {nodes} selected={ui.selectedNode} dim={sinkhole.paused} />
    {#if ui.minimap}
      {#await import('./LazyMinimap.svelte') then M}<M.default />{/await}
    {/if}
    <FlowBridge {register} />
  </SvelteFlow>
  <PacketLayer {getViewport} {active} />
</div>

<style>
  .pipeline {
    position: absolute;
    inset: 0;
  }
  .pipeline :global(.sinkhole-flow) {
    width: 100%;
    height: 100%;
  }
  /* desaturate the canvas wiring while blocking is paused */
  :global(.paused) .pipeline :global(.svelte-flow__handle.port-dot.block) {
    --c: #8a8a93;
  }
</style>
