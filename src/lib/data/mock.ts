import type {
  ClientInfo,
  DecisionConfig,
  DnsEvent,
  DnsQuery,
  DnsSource,
  ListInfo,
  Profile,
  QType,
  QueryStatus,
  Snapshot
} from './types';

/* ------------------------------------------------------------------ */
/* Simulation data                                                     */
/* ------------------------------------------------------------------ */

interface SimClient extends ClientInfo {
  weight: number;
  /** probability that a query from this client hits a blocklist */
  adRate: number;
  pool: string[];
  adPool: string[];
}

interface ProfileDef extends Profile {
  rate: number;
  clients: SimClient[];
  totalToday: number;
  blockedToday: number;
  uptimeMs: number;
}

const GENERAL = [
  'www.google.com', 'fonts.gstatic.com', 'fonts.googleapis.com', 'www.youtube.com', 'i.ytimg.com',
  'cloudflare.com', 'wikipedia.org', 'en.wikipedia.org', 'reddit.com', 'www.reddit.com', 'apple.com',
  'icloud.com', 'time.apple.com', 'amazonaws.com', 's3.amazonaws.com', 'cdn.jsdelivr.net'
];

const POOLS: Record<string, string[]> = {
  laptop: [
    'github.com', 'api.github.com', 'objects.githubusercontent.com', 'registry.npmjs.org', 'stackoverflow.com',
    'slack.com', 'edgeapi.slack.com', 'zoom.us', 'docs.google.com', 'mail.google.com',
    'outlook.office365.com', 'news.ycombinator.com', 'figma.com', 'linear.app', 'vercel.com'
  ],
  phone: [
    'i.instagram.com', 'graph.instagram.com', 'whatsapp.net', 'mmg.whatsapp.net', 'push.apple.com',
    'gateway.icloud.com', 'api.spotify.com', 'spclient.wg.spotify.com', 'maps.googleapis.com',
    'weather-data.apple.com', 'signal.org', 'api.revolut.com'
  ],
  tv: [
    'netflix.com', 'api-global.netflix.com', 'occ-0-1001-999.1.nflxso.net', 'nflxvideo.net',
    'googlevideo.com', 'youtubei.googleapis.com', 'disneyplus.com', 'plex.tv', 'samsungcloudsolution.com'
  ],
  console: [
    'xboxlive.com', 'xsts.auth.xboxlive.com', 'assets1.xboxlive.com', 'login.live.com', 'playfabapi.com',
    'epicgames.com', 'discord.com', 'gateway.discord.gg', 'cdn.discordapp.com'
  ],
  tablet: ['kids.youtube.com', 'netflix.com', 'books.apple.com', 'duolingo.com', 'khanacademy.org'],
  speaker: ['api.spotify.com', 'avs-alexa-eu.amazon.com', 'clients3.google.com', 'sonos.com'],
  camera: ['ring.com', 'api.ring.com', 'fw.ring.com', 'ntp.ubuntu.com'],
  thermostat: ['home.nest.com', 'frontdoor.nest.com', 'time.google.com'],
  fridge: ['samsungiotcloud.com', 'api.smartthings.com', 'time.samsungcloudsolution.com']
};

/** domain → list id. doubleclick is weighted heaviest so it leads "top blocked". */
const ADS: [domain: string, list: string, weight: number][] = [
  ['doubleclick.net', 'stevenblack', 14],
  ['ad.doubleclick.net', 'stevenblack', 6],
  ['googlesyndication.com', 'stevenblack', 9],
  ['pagead2.googlesyndication.com', 'stevenblack', 5],
  ['app-measurement.com', 'stevenblack', 8],
  ['scorecardresearch.com', 'stevenblack', 5],
  ['adnxs.com', 'stevenblack', 4],
  ['taboola.com', 'stevenblack', 3],
  ['outbrain.com', 'stevenblack', 3],
  ['amazon-adsystem.com', 'stevenblack', 4],
  ['criteo.com', 'stevenblack', 3],
  ['moatads.com', 'stevenblack', 2],
  ['adsrvr.org', 'stevenblack', 3],
  ['pubmatic.com', 'stevenblack', 2],
  ['rubiconproject.com', 'stevenblack', 2],
  ['hotjar.com', 'stevenblack', 2],
  ['connect.facebook.net', 'stevenblack', 3],
  ['analytics.tiktok.com', 'stevenblack', 3],
  ['ads-api.tiktok.com', 'regex', 2],
  ['track.hubspot.com', 'regex', 2],
  ['metrics.roblox.com', 'regex', 1],
  ['telemetry.nvidia.com', 'regex', 1],
  ['tracking.epicgames.com', 'regex', 1]
];

const AD_POOLS: Record<string, [string, string, number][]> = {
  tv: [
    ['samsungads.com', 'custom', 9],
    ['log-config.samsungacr.com', 'custom', 6],
    ['device-metrics-us.amazon.com', 'stevenblack', 4],
    ['ads.roku.com', 'stevenblack', 2],
    ['telemetry.lgtvsdp.com', 'regex', 3],
    ['s.youtube.com', 'allowlist', 2]
  ],
  console: [
    ['vortex.data.microsoft.com', 'stevenblack', 6],
    ['settings-win.data.microsoft.com', 'stevenblack', 3],
    ['watson.telemetry.microsoft.com', 'regex', 4],
    ['mobile.events.data.microsoft.com', 'stevenblack', 2]
  ],
  phone: [
    ['graph.facebook.com', 'custom', 3],
    ['firebaselogging-pa.googleapis.com', 'custom', 2],
    ['t.co', 'allowlist', 2]
  ],
  laptop: [
    ['www.googleadservices.com', 'allowlist', 2],
    ['clarity.ms', 'custom', 2]
  ]
};

const ALLOWLIST = ['s.youtube.com', 't.co', 'www.googleadservices.com', 'clients4.google.com', 'www.msftncsi.com'];

const PROFILES: ProfileDef[] = [
  {
    id: 'home',
    name: 'Home Network',
    rate: 4.2,
    totalToday: 132_684,
    blockedToday: 24_812,
    uptimeMs: (12 * 24 + 4) * 3600_000 + 17 * 60_000,
    clients: [
      client('laptop', 'Laptop', '192.168.1.12', 'laptop', 0.34, 0.11),
      client('phone', 'Phone', '192.168.1.23', 'phone', 0.28, 0.2),
      client('tv', 'TV', '192.168.1.40', 'tv', 0.2, 0.36),
      client('xbox', 'Xbox', '192.168.1.55', 'console', 0.18, 0.14)
    ]
  },
  {
    id: 'guest',
    name: 'Guest Wi-Fi',
    rate: 2.3,
    totalToday: 18_204,
    blockedToday: 4_117,
    uptimeMs: (3 * 24 + 9) * 3600_000,
    clients: [
      client('iphone', 'iPhone', '10.0.20.14', 'phone', 0.42, 0.24),
      client('pixel', 'Pixel', '10.0.20.31', 'phone', 0.33, 0.22),
      client('ipad', 'Tablet', '10.0.20.48', 'tablet', 0.25, 0.16)
    ]
  },
  {
    id: 'iot',
    name: 'IoT VLAN',
    rate: 1.7,
    totalToday: 41_930,
    blockedToday: 12_644,
    uptimeMs: (27 * 24 + 2) * 3600_000,
    clients: [
      client('speaker', 'Speaker', '10.0.30.5', 'speaker', 0.3, 0.22),
      client('camera', 'Camera', '10.0.30.9', 'camera', 0.24, 0.18),
      client('nest', 'Thermostat', '10.0.30.12', 'thermostat', 0.18, 0.31),
      client('fridge', 'Fridge', '10.0.30.20', 'fridge', 0.28, 0.42)
    ]
  }
];

function client(id: string, name: string, ip: string, kind: ClientInfo['kind'], weight: number, adRate: number): SimClient {
  const adPool = AD_POOLS[kind] ?? AD_POOLS.tv;
  return { id, name, ip, kind, weight, adRate, pool: [...GENERAL, ...(POOLS[kind] ?? [])], adPool: adPool.map((a) => a[0]) };
}

const QTYPES: [QType, number][] = [
  ['A', 52], ['AAAA', 26], ['HTTPS', 14], ['CNAME', 3], ['TXT', 2], ['PTR', 2], ['SRV', 1]
];

const UPSTREAM_MS: Record<DecisionConfig['upstream'], number> = {
  cloudflare: 9, quad9: 14, google: 12, adguard: 18, unbound: 24
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(items: T[], weight: (t: T) => number, r: () => number): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let x = r() * total;
  for (const it of items) {
    x -= weight(it);
    if (x <= 0) return it;
  }
  return items[items.length - 1];
}

const pick = <T>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)];
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/* ------------------------------------------------------------------ */
/* Mock source                                                         */
/* ------------------------------------------------------------------ */

export function createMockSource(): DnsSource {
  let profile = PROFILES[0];
  let emit: ((e: DnsEvent) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let burstTimer: ReturnType<typeof setTimeout> | undefined;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let nextId = 1;
  let pausedUntil: number | null = null;
  let paused = false;

  const config: DecisionConfig = {
    mode: 'null',
    cacheSize: 10_000,
    ttl: 300,
    upstream: 'cloudflare',
    dnssec: true,
    protocol: 'doh'
  };

  const now = Date.now();
  const lists: ListInfo[] = [
    {
      id: 'stevenblack',
      idx: 1,
      name: 'StevenBlack',
      kind: 'hosts',
      source: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
      domains: 142_078,
      enabled: true,
      updatedAt: now - 5 * 3600_000,
      entries: ADS.filter((a) => a[1] === 'stevenblack').map((a) => a[0])
    },
    {
      id: 'custom',
      idx: 2,
      name: 'Custom',
      kind: 'custom',
      source: 'local · sinkhole.d/custom.list',
      domains: 214,
      enabled: true,
      updatedAt: now - 26 * 3600_000,
      entries: ['samsungads.com', 'log-config.samsungacr.com', 'graph.facebook.com', 'firebaselogging-pa.googleapis.com', 'clarity.ms']
    },
    {
      id: 'regex',
      idx: 3,
      name: 'Regex',
      kind: 'regex',
      source: 'local · sinkhole.d/regex.list',
      domains: 38,
      enabled: true,
      updatedAt: now - 3 * 86400_000,
      entries: ['^ads?[0-9-]*\\.', '(^|\\.)telemetry\\.', '^track(ing)?\\.', '^metrics\\.', '(^|\\.)ads-api\\.']
    }
  ];
  const allow = new Set(ALLOWLIST);
  const listOf = new Map<string, string>();
  for (const [d, l] of ADS) listOf.set(d, l);
  for (const pool of Object.values(AD_POOLS)) for (const [d, l] of pool) listOf.set(d, l);
  for (const e of lists[1].entries) listOf.set(e, 'custom');

  const cacheHitRate = () => {
    const ttl = { 60: 0.16, 300: 0.27, 900: 0.33, 3600: 0.38 }[config.ttl] ?? 0.27;
    const size = Math.min(1, Math.log10(Math.max(config.cacheSize, 100)) / 4);
    return ttl * (0.55 + 0.45 * size);
  };

  function makeQuery(c: SimClient, ts: number, r: () => number, adBias = 1): DnsQuery {
    const qtype = weighted(QTYPES, (q) => q[1], r)[0];
    let domain: string;
    let status: QueryStatus = 'allowed';
    let list: string | undefined;
    let bypassed = false;

    if (r() < c.adRate * adBias) {
      const own = AD_POOLS[c.kind];
      const src = own && r() < 0.4 ? own : ADS;
      const hit = weighted(src, (a) => a[2], r);
      domain = hit[0];
      const matched = listOf.get(domain) ?? hit[1];
      const listEnabled = lists.find((l) => l.id === matched)?.enabled ?? true;
      if (allow.has(domain)) {
        status = 'allowlisted';
        list = 'allowlist';
      } else if (!listEnabled) {
        status = 'allowed';
      } else if (paused) {
        status = 'allowed';
        bypassed = true;
      } else {
        status = 'blocked';
        list = matched;
      }
    } else {
      domain = pick(c.pool, r);
      if (r() < cacheHitRate()) status = 'cached';
    }

    const base = UPSTREAM_MS[config.upstream] * (config.protocol === 'udp' ? 0.8 : config.protocol === 'dot' ? 1.1 : 1);
    const ms =
      status === 'blocked' ? 0 : status === 'cached' ? 0 : Math.max(1, Math.round(base * Math.exp(gauss(r) * 0.35)));

    return { id: nextId++, ts, domain, client: c.id, qtype, status, list, ms, bypassed: bypassed || undefined };
  }

  function emitOne(adBias = 1, forced?: SimClient) {
    const c = forced ?? weighted(profile.clients, (x) => x.weight, Math.random);
    emit?.({ t: 'query', q: makeQuery(c, Date.now(), Math.random, adBias) });
  }

  function loop() {
    const t = Date.now();
    const rate = profile.rate * (1 + 0.32 * Math.sin(t / 17_000) + 0.14 * Math.sin(t / 5_300));
    const dt = (-Math.log(1 - Math.random()) / Math.max(rate, 0.3)) * 1000;
    timer = setTimeout(() => {
      emitOne();
      loop();
    }, dt);
  }

  function bursts() {
    burstTimer = setTimeout(() => {
      // An app wakes up and fires a flurry of lookups (smart TVs are the worst offenders).
      const c = weighted(profile.clients, (x) => x.weight + x.adRate, Math.random);
      const n = 7 + Math.floor(Math.random() * 9);
      for (let i = 0; i < n; i++) setTimeout(() => emitOne(1.7, c), i * (60 + Math.random() * 120));
      bursts();
    }, 16_000 + Math.random() * 20_000);
  }

  function setPaused(p: boolean, until: number | null) {
    paused = p;
    pausedUntil = until;
    clearTimeout(resumeTimer);
    if (p && until) resumeTimer = setTimeout(() => setPaused(false, null), until - Date.now());
    emit?.({ t: 'blocking', paused, until: pausedUntil });
  }

  const cloneLists = () => lists.map((l) => ({ ...l, entries: [...l.entries] }));

  return {
    kind: 'mock',
    label: 'Mock resolver (demo data)',

    async load(id: string): Promise<Snapshot> {
      profile = PROFILES.find((p) => p.id === id) ?? PROFILES[0];
      const r = mulberry32(profile.id.length * 7919 + 17);
      const t = Date.now();

      const recent: DnsQuery[] = [];
      let ts = t - 240_000;
      while (ts < t - 200) {
        ts += (-Math.log(1 - r()) / profile.rate) * 1000;
        const c = weighted(profile.clients, (x) => x.weight, r);
        recent.push(makeQuery(c, Math.min(ts, t - 200), r));
      }

      const avgDay = profile.blockedToday * 1.12;
      const dailyBlocked = Array.from({ length: 29 }, (_, i) =>
        Math.round(avgDay * (0.82 + 0.3 * r() + 0.08 * Math.sin(i / 2.3)))
      );

      const topBlocked: [string, number][] = ADS.slice(0, 12)
        .map(([d, , w]) => [d, Math.round((profile.blockedToday * w) / 110 * (0.85 + r() * 0.3))] as [string, number])
        .sort((a, b) => b[1] - a[1]);

      // Small async hop, like a real REST call.
      await new Promise((res) => setTimeout(res, 60));

      return {
        profile: { id: profile.id, name: profile.name },
        profiles: PROFILES.map((p) => ({ id: p.id, name: p.name })),
        clients: profile.clients.map(({ id, name, ip, kind }) => ({ id, name, ip, kind })),
        lists: cloneLists(),
        allowlist: [...allow],
        config: { ...config },
        stats: {
          totalToday: profile.totalToday,
          blockedToday: profile.blockedToday,
          cachedToday: Math.round(profile.totalToday * cacheHitRate()),
          startedAt: t - profile.uptimeMs,
          dailyBlocked,
          blockedLastHour: Math.round(profile.blockedToday / 17)
        },
        topBlocked,
        recent
      };
    },

    connect(onEvent) {
      emit = onEvent;
      onEvent({ t: 'status', connected: true });
      loop();
      bursts();
      return () => {
        clearTimeout(timer);
        clearTimeout(burstTimer);
        emit = null;
      };
    },

    pauseBlocking(durationMs) {
      setPaused(true, durationMs ? Date.now() + durationMs : null);
    },
    resumeBlocking() {
      setPaused(false, null);
    },
    setListEnabled(id, enabled) {
      const l = lists.find((x) => x.id === id);
      if (!l) return;
      l.enabled = enabled;
      emit?.({ t: 'lists', lists: cloneLists() });
    },
    async updateLists() {
      await new Promise((res) => setTimeout(res, 1800 + Math.random() * 900));
      const added = 12 + Math.floor(Math.random() * 60);
      lists[0].domains += added;
      lists[0].updatedAt = Date.now();
      lists[1].updatedAt = Date.now();
      lists[2].updatedAt = Date.now();
      emit?.({ t: 'lists', lists: cloneLists() });
      return { added };
    },
    addEntry(listId, entry) {
      const l = lists.find((x) => x.id === listId);
      if (!l || l.entries.includes(entry)) return;
      l.entries.unshift(entry);
      l.domains += 1;
      l.updatedAt = Date.now();
      if (l.kind !== 'regex') listOf.set(entry, listId);
      emit?.({ t: 'lists', lists: cloneLists() });
    },
    removeEntry(listId, entry) {
      const l = lists.find((x) => x.id === listId);
      if (!l) return;
      l.entries = l.entries.filter((e) => e !== entry);
      l.domains = Math.max(0, l.domains - 1);
      emit?.({ t: 'lists', lists: cloneLists() });
    },
    allow(domain) {
      allow.add(domain);
      emit?.({ t: 'allowlist', domains: [...allow] });
    },
    unallow(domain) {
      allow.delete(domain);
      emit?.({ t: 'allowlist', domains: [...allow] });
    },
    setConfig(patch) {
      Object.assign(config, patch);
      emit?.({ t: 'config', config: { ...config } });
    },
    resetCounter() {
      emit?.({ t: 'counter-reset' });
    }
  };
}
