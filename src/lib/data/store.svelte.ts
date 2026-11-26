import { queryBus } from './bus';
import { resolveSource } from './source';
import type { ClientInfo, DecisionConfig, DnsEvent, DnsQuery, DnsSource, ListInfo, Profile, Snapshot } from './types';

export type Range = '1h' | '24h' | '7d' | '30d';

export interface ClientView extends ClientInfo {
  spark: number[];
  queries: number;
  blocked: number;
}

const SPARK_LEN = 30;
const BUCKET_TICKS = 2; // 1 bucket every 2s → 60s window
const LOG_CAP = 10_000;
const FRESH_MS = 1500;

const zeros = (n = SPARK_LEN) => Array.from({ length: n }, () => 0);
const push = (arr: number[], v: number) => [...arr.slice(1 - SPARK_LEN), v];

function seedSpark(base: number, seed: number) {
  let v = base;
  let s = seed;
  return Array.from({ length: SPARK_LEN }, () => {
    s = (s * 9301 + 49297) % 233280;
    v = Math.max(0, v + ((s / 233280) - 0.5) * base * 0.6);
    return Math.round(v * 10) / 10;
  });
}

/**
 * Reactive application state. Raw events are queued and applied in a single
 * pass once per animation frame (or every 250ms while the tab is hidden), so a
 * burst of 500 queries costs one reactive update, not 500.
 */
class SinkholeStore {
  ready = $state(false);
  connected = $state(false);
  sourceKind = $state<'mock' | 'websocket'>('mock');
  sourceLabel = $state('');

  profile = $state<Profile>({ id: 'home', name: 'Home Network' });
  profiles = $state<Profile[]>([]);
  clients = $state<ClientView[]>([]);
  lists = $state<ListInfo[]>([]);
  allowlist = $state<string[]>([]);
  lastAllowed = $state<string | null>(null);
  config = $state<DecisionConfig>({
    mode: 'null',
    cacheSize: 10_000,
    ttl: 300,
    upstream: 'cloudflare',
    dnssec: true,
    protocol: 'doh'
  });

  totalToday = $state(0);
  blockedToday = $state(0);
  cachedToday = $state(0);
  blockedLastHour = $state(0);
  dailyBlocked = $state.raw<number[]>([]);
  startedAt = $state(Date.now());
  now = $state(Date.now());

  qps = $state(0);
  qpsSpark = $state<number[]>(zeros());
  latency = $state(0);
  latencySpark = $state<number[]>(zeros());
  listSpark = $state<Record<string, number[]>>({});
  topBlocked = $state.raw<[string, number][]>([]);
  latest = $state.raw<DnsQuery | null>(null);
  recent = $state.raw<DnsQuery[]>([]);

  paused = $state(false);
  pausedUntil = $state<number | null>(null);
  updatingLists = $state(false);
  refreshing = $state(false);

  /** oldest → newest; not reactive, read alongside `logVersion` */
  log: DnsQuery[] = [];
  logVersion = $state(0);

  blockedPct = $derived(this.totalToday ? (this.blockedToday / this.totalToday) * 100 : 0);
  cacheHitPct = $derived(this.totalToday ? (this.cachedToday / this.totalToday) * 100 : 0);
  activeLists = $derived(this.lists.filter((l) => l.enabled));
  totalDomains = $derived(this.activeLists.reduce((s, l) => s + l.domains, 0));

  private source: DnsSource | null = null;
  private disconnect: (() => void) | null = null;
  private queue: DnsEvent[] = [];
  private scheduled = false;
  private ticks = 0;
  private secCount = 0;
  private secWindow: number[] = [];
  private bucketClients = new Map<string, number>();
  private bucketLists = new Map<string, number>();
  private latSum = 0;
  private latN = 0;
  private topCounts = new Map<string, number>();
  private tickTimer: ReturnType<typeof setInterval> | undefined;

  async start() {
    if (this.source) return;
    this.source = await resolveSource();
    this.sourceKind = this.source.kind;
    this.sourceLabel = this.source.label;
    let saved = 'home';
    try {
      saved = localStorage.getItem('sinkhole.profile') || 'home';
    } catch {
      /* ignore */
    }
    this.applySnapshot(await this.source.load(saved));
    this.disconnect = this.source.connect((e) => {
      this.queue.push(e);
      this.schedule();
    });
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.ready = true;
  }

  stop() {
    this.disconnect?.();
    clearInterval(this.tickTimer);
  }

  /* ---------------- snapshot & batching ---------------- */

  private applySnapshot(s: Snapshot) {
    this.profile = s.profile;
    this.profiles = s.profiles;
    this.clients = s.clients.map((c, i) => ({
      ...c,
      spark: seedSpark(2 + (i % 3), 17 + i * 31),
      queries: 0,
      blocked: 0
    }));
    this.lists = s.lists;
    this.allowlist = s.allowlist;
    this.config = s.config;
    this.totalToday = s.stats.totalToday;
    this.blockedToday = s.stats.blockedToday;
    this.cachedToday = s.stats.cachedToday;
    this.blockedLastHour = s.stats.blockedLastHour;
    this.dailyBlocked = s.stats.dailyBlocked;
    this.startedAt = s.stats.startedAt;
    this.topCounts = new Map(s.topBlocked);
    this.topBlocked = s.topBlocked.slice(0, 10);
    this.listSpark = Object.fromEntries(s.lists.map((l, i) => [l.id, seedSpark(1.5 + i, 101 + i * 7)]));
    this.qpsSpark = seedSpark(4, 7);
    this.latencySpark = seedSpark(11, 3);
    this.latency = 11;
    this.log = s.recent.slice(-LOG_CAP);
    this.recent = this.log.slice(-5).reverse();
    this.latest = this.log.at(-1) ?? null;
    const lastAllow = [...this.log].reverse().find((q) => q.status === 'allowlisted');
    this.lastAllowed = lastAllow?.domain ?? s.allowlist[0] ?? null;
    this.logVersion++;
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => this.scheduled && this.flush();
    if (typeof document !== 'undefined' && document.hidden) {
      setTimeout(run, 250);
    } else {
      requestAnimationFrame(run);
      // rAF can be throttled while the page still reports visible (offscreen iframes,
      // background webviews) — make sure data keeps flowing anyway.
      setTimeout(run, 150);
    }
  }

  private flush() {
    this.scheduled = false;
    const events = this.queue;
    this.queue = [];
    if (!events.length) return;

    const batch: DnsQuery[] = [];
    let total = 0;
    let blocked = 0;
    let cached = 0;
    let allowedName: string | null = null;
    const perClient = new Map<string, [number, number]>();

    for (const e of events) {
      switch (e.t) {
        case 'query': {
          const q = e.q;
          batch.push(q);
          total++;
          this.secCount++;
          const pc = perClient.get(q.client) ?? [0, 0];
          pc[0]++;
          this.bucketClients.set(q.client, (this.bucketClients.get(q.client) ?? 0) + 1);
          if (q.status === 'blocked') {
            blocked++;
            pc[1]++;
            this.topCounts.set(q.domain, (this.topCounts.get(q.domain) ?? 0) + 1);
            if (q.list) this.bucketLists.set(q.list, (this.bucketLists.get(q.list) ?? 0) + 1);
          } else if (q.status === 'cached') {
            cached++;
          } else {
            if (q.status === 'allowlisted') allowedName = q.domain;
            if (q.ms > 0) {
              this.latSum += q.ms;
              this.latN++;
            }
          }
          perClient.set(q.client, pc);
          break;
        }
        case 'lists':
          this.lists = e.lists;
          break;
        case 'allowlist':
          this.allowlist = e.domains;
          break;
        case 'blocking':
          this.paused = e.paused;
          this.pausedUntil = e.until;
          break;
        case 'config':
          this.config = e.config;
          break;
        case 'counter-reset':
          this.blockedToday = 0;
          this.blockedLastHour = 0;
          break;
        case 'status':
          this.connected = e.connected;
          break;
      }
    }

    if (batch.length) {
      this.totalToday += total;
      if (blocked) {
        this.blockedToday += blocked;
        this.blockedLastHour += blocked;
      }
      if (cached) this.cachedToday += cached;
      if (allowedName) this.lastAllowed = allowedName;
      for (const c of this.clients) {
        const pc = perClient.get(c.id);
        if (pc) {
          c.queries += pc[0];
          c.blocked += pc[1];
        }
      }
      this.log.push(...batch);
      if (this.log.length > LOG_CAP + 1000) this.log.splice(0, this.log.length - LOG_CAP);
      this.logVersion++;
      this.latest = batch[batch.length - 1];
      this.recent = [...batch.slice(-5).reverse(), ...this.recent].slice(0, 5);

      // Only hand live traffic to the animation layer (skip backlog after a hidden tab).
      const cutoff = Date.now() - FRESH_MS;
      const fresh = batch.filter((q) => q.ts >= cutoff);
      queryBus.emit(fresh);
    }
  }

  private tick() {
    this.now = Date.now();
    this.secWindow.push(this.secCount);
    this.secCount = 0;
    if (this.secWindow.length > 5) this.secWindow.shift();
    const avg = this.secWindow.reduce((a, b) => a + b, 0) / this.secWindow.length;
    this.qps = Math.round(avg * 10) / 10;

    if (++this.ticks % BUCKET_TICKS !== 0) return;

    this.qpsSpark = push(this.qpsSpark, avg);
    for (const c of this.clients) {
      c.spark = push(c.spark, this.bucketClients.get(c.id) ?? 0);
    }
    this.bucketClients.clear();
    const ls: Record<string, number[]> = {};
    for (const l of this.lists) ls[l.id] = push(this.listSpark[l.id] ?? zeros(), this.bucketLists.get(l.id) ?? 0);
    this.listSpark = ls;
    this.bucketLists.clear();
    if (this.latN) {
      const lat = this.latSum / this.latN;
      this.latency = Math.round(this.latency * 0.5 + lat * 0.5);
      this.latencySpark = push(this.latencySpark, lat);
    } else {
      this.latencySpark = push(this.latencySpark, this.latency);
    }
    this.latSum = 0;
    this.latN = 0;
    this.topBlocked = [...this.topCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }

  /* ---------------- derived helpers ---------------- */

  blockedIn(range: Range) {
    const d = this.dailyBlocked;
    switch (range) {
      case '1h':
        return this.blockedLastHour;
      case '24h':
        return this.blockedToday;
      case '7d':
        return d.slice(-6).reduce((a, b) => a + b, 0) + this.blockedToday;
      case '30d':
        return d.reduce((a, b) => a + b, 0) + this.blockedToday;
    }
  }

  clientName(id: string) {
    return this.clients.find((c) => c.id === id)?.name ?? id;
  }

  listName(id?: string) {
    if (!id) return '';
    if (id === 'allowlist') return 'Allowlist';
    return this.lists.find((l) => l.id === id)?.name ?? id;
  }

  /* ---------------- commands ---------------- */

  pause(ms: number | null) {
    this.paused = true;
    this.pausedUntil = ms ? Date.now() + ms : null;
    this.source?.pauseBlocking(ms);
  }

  resume() {
    this.paused = false;
    this.pausedUntil = null;
    this.source?.resumeBlocking();
  }

  setListEnabled(id: string, enabled: boolean) {
    const l = this.lists.find((x) => x.id === id);
    if (l) l.enabled = enabled;
    this.source?.setListEnabled(id, enabled);
  }

  async updateLists() {
    if (!this.source || this.updatingLists) return { added: 0 };
    this.updatingLists = true;
    try {
      return await this.source.updateLists();
    } finally {
      this.updatingLists = false;
    }
  }

  addEntry(listId: string, entry: string) {
    this.source?.addEntry(listId, entry.trim().toLowerCase());
  }

  removeEntry(listId: string, entry: string) {
    this.source?.removeEntry(listId, entry);
  }

  allow(domain: string) {
    this.source?.allow(domain.trim().toLowerCase());
    this.lastAllowed = domain;
  }

  unallow(domain: string) {
    this.source?.unallow(domain);
  }

  block(domain: string) {
    this.addEntry('custom', domain);
    if (this.allowlist.includes(domain)) this.unallow(domain);
  }

  setConfig(patch: Partial<DecisionConfig>) {
    Object.assign(this.config, patch);
    this.source?.setConfig(patch);
  }

  resetCounter() {
    this.blockedToday = 0;
    this.blockedLastHour = 0;
    this.source?.resetCounter();
  }

  async switchProfile(id: string) {
    if (!this.source || id === this.profile.id) return;
    try {
      localStorage.setItem('sinkhole.profile', id);
    } catch {
      /* ignore */
    }
    this.applySnapshot(await this.source.load(id));
  }

  async refresh() {
    if (!this.source || this.refreshing) return;
    this.refreshing = true;
    const started = Date.now();
    try {
      const snap = await this.source.load(this.profile.id);
      // keep live counters, refresh structure
      this.lists = snap.lists;
      this.allowlist = snap.allowlist;
      this.config = snap.config;
    } finally {
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))));
      this.refreshing = false;
    }
  }
}

export const sinkhole = new SinkholeStore();
