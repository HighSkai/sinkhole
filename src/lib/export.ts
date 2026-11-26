import { sinkhole, type Range } from './data/store.svelte';

export type ExportFormat = 'csv' | 'json';

const stamp = () => new Date().toISOString().slice(0, 10);

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function statsObject() {
  const s = sinkhole;
  return {
    generatedAt: new Date().toISOString(),
    profile: s.profile.name,
    summary: {
      queriesToday: s.totalToday,
      blockedToday: s.blockedToday,
      blockedPct: +s.blockedPct.toFixed(2),
      cacheHitPct: +s.cacheHitPct.toFixed(2),
      qps: s.qps,
      upstreamLatencyMs: s.latency,
      blockingPaused: s.paused
    },
    clients: s.clients.map((c) => ({ name: c.name, ip: c.ip, sessionQueries: c.queries, sessionBlocked: c.blocked })),
    lists: s.lists.map((l) => ({ name: l.name, kind: l.kind, domains: l.domains, enabled: l.enabled })),
    topBlocked: s.topBlocked.map(([domain, count]) => ({ domain, count }))
  };
}

export function exportStats(format: ExportFormat = 'csv') {
  const o = statsObject();
  if (format === 'json') {
    download(`sinkhole-stats-${stamp()}.json`, JSON.stringify(o, null, 2), 'application/json');
    return;
  }
  const rows: unknown[][] = [['section', 'key', 'value', 'extra']];
  for (const [k, v] of Object.entries(o.summary)) rows.push(['summary', k, v, '']);
  for (const c of o.clients) rows.push(['client', c.name, c.sessionQueries, `blocked=${c.sessionBlocked}`]);
  for (const l of o.lists) rows.push(['list', l.name, l.domains, l.enabled ? 'enabled' : 'disabled']);
  for (const t of o.topBlocked) rows.push(['top_blocked', t.domain, t.count, '']);
  download(`sinkhole-stats-${stamp()}.csv`, toCsv(rows), 'text/csv');
}

export function exportBlocked(range: Range, format: ExportFormat) {
  const span = { '1h': 3600_000, '24h': 86400_000, '7d': 7 * 86400_000, '30d': 30 * 86400_000 }[range];
  const since = Date.now() - span;
  const rows = sinkhole.log
    .filter((q) => q.status === 'blocked' && q.ts >= since)
    .map((q) => ({
      time: new Date(q.ts).toISOString(),
      domain: q.domain,
      client: sinkhole.clientName(q.client),
      type: q.qtype,
      list: sinkhole.listName(q.list)
    }));
  const payload = {
    range,
    blocked: sinkhole.blockedIn(range),
    topBlocked: sinkhole.topBlocked.map(([domain, count]) => ({ domain, count })),
    recent: rows
  };
  if (format === 'json') {
    download(`sinkhole-blocked-${range}-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  } else {
    const out: unknown[][] = [['time', 'domain', 'client', 'type', 'list']];
    for (const r of rows) out.push([r.time, r.domain, r.client, r.type, r.list]);
    download(`sinkhole-blocked-${range}-${stamp()}.csv`, toCsv(out), 'text/csv');
  }
}

export function summaryText(range: Range) {
  const s = sinkhole;
  const top = s.topBlocked[0]?.[0] ?? '—';
  return `sinkhole · ${s.profile.name}\nBlocked (${range}): ${s.blockedIn(range).toLocaleString('en-US')}\nBlocked share today: ${s.blockedPct.toFixed(1)}%\nTop blocked: ${top}`;
}
