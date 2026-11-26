# Changelog

## v1.0.0 — 2026-11-25

First public release.

### Pipeline
- Node-graph dashboard on Svelte Flow: Clients → DNS Query → Blocklists / Allowlist → Decision → Sinkhole / Upstream.
- Single-canvas packet animation (≤ 200 packets, sampled under load) along the exact wire curves; blocked packets spiral into the sinkhole.
- Animated inline-SVG logo with conic swirl, crack breathing, pulse, ripple and flicker on every fall.
- Pause blocking for 30s / 5m / 1h / until re-enabled, with retracting cracks, grey glow and desaturated wires.
- Decision controls: blocking mode, cache size, TTL, upstream resolver.
- Aurora glows behind the Decision node that drift and follow the selected node; three palettes.
- Load-in choreography (staggered node fade-up, self-drawing wires), hover lift, port glow, wire hover with 2× packet speed.

### Pages
- Virtualised Query Log with live slide-in rows, status / device / domain filters and inline allow / block.
- Lists: StevenBlack, custom and regex lists, allowlist editor and regex tester.
- Settings: resolver, blocking, interface and data source.

### Platform
- Typed `DnsSource` data layer with a mock resolver and a WebSocket adapter; events applied once per animation frame.
- Code-split pages, lazy minimap / command panel / modals, precompressed (br + gz) hashed assets.
- Default route 116.7 KB gz of JS; first paint 50 KB gz.
- Caddy, nginx and Docker configs; CI with type check, build and size budget.
- Respects `prefers-reduced-motion`; all loops pause when the tab is hidden or animations are off.
