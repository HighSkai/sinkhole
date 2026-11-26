/**
 * Sinkhole data contract.
 *
 * Everything the UI renders comes through a `DnsSource`. The bundled mock
 * source simulates a resolver; `ws.ts` speaks the same contract over a single
 * WebSocket so a real DNS backend can be dropped in without touching the UI.
 */

export type QueryStatus = 'allowed' | 'cached' | 'blocked' | 'allowlisted';
export type QType = 'A' | 'AAAA' | 'HTTPS' | 'CNAME' | 'TXT' | 'PTR' | 'SRV';
export type ClientKind = 'laptop' | 'phone' | 'tv' | 'console' | 'tablet' | 'speaker' | 'camera' | 'thermostat' | 'fridge';

export interface DnsQuery {
  id: number;
  /** epoch ms */
  ts: number;
  domain: string;
  /** client id */
  client: string;
  qtype: QType;
  status: QueryStatus;
  /** list id that matched (blocked → blocklist, allowlisted → allowlist) */
  list?: string;
  /** response time in ms (0 for sinkholed / cached answers) */
  ms: number;
  /** true when the query would have been blocked but blocking was paused */
  bypassed?: boolean;
}

export interface ClientInfo {
  id: string;
  name: string;
  ip: string;
  kind: ClientKind;
}

export type ListKind = 'hosts' | 'custom' | 'regex';

export interface ListInfo {
  id: string;
  /** display index, e.g. 1 → "01" */
  idx: number;
  name: string;
  kind: ListKind;
  source: string;
  /** number of domains (or patterns for regex lists) */
  domains: number;
  enabled: boolean;
  updatedAt: number;
  /** a few sample entries, used by the Lists page editors */
  entries: string[];
}

export type BlockingMode = 'null' | 'nxdomain' | 'refused' | 'nodata';
export type Upstream = 'cloudflare' | 'quad9' | 'google' | 'adguard' | 'unbound';

export interface DecisionConfig {
  mode: BlockingMode;
  cacheSize: number;
  ttl: number;
  upstream: Upstream;
  dnssec: boolean;
  protocol: 'udp' | 'dot' | 'doh';
}

export interface Profile {
  id: string;
  name: string;
}

export interface Snapshot {
  profile: Profile;
  profiles: Profile[];
  clients: ClientInfo[];
  lists: ListInfo[];
  allowlist: string[];
  config: DecisionConfig;
  stats: {
    totalToday: number;
    blockedToday: number;
    cachedToday: number;
    /** epoch ms the resolver started */
    startedAt: number;
    /** blocked per day for the previous 29 days (oldest first) */
    dailyBlocked: number[];
    /** blocked in the trailing hour */
    blockedLastHour: number;
  };
  topBlocked: [domain: string, count: number][];
  /** recent history, oldest first */
  recent: DnsQuery[];
}

export type DnsEvent =
  | { t: 'query'; q: DnsQuery }
  | { t: 'lists'; lists: ListInfo[] }
  | { t: 'allowlist'; domains: string[] }
  | { t: 'blocking'; paused: boolean; until: number | null }
  | { t: 'config'; config: DecisionConfig }
  | { t: 'counter-reset' }
  | { t: 'status'; connected: boolean };

export interface DnsSource {
  readonly kind: 'mock' | 'websocket';
  readonly label: string;
  /** Fetch the full state for a profile (REST in a real backend). */
  load(profile: string): Promise<Snapshot>;
  /** Open the live stream. Returns a disconnect function. */
  connect(onEvent: (e: DnsEvent) => void): () => void;

  pauseBlocking(durationMs: number | null): void;
  resumeBlocking(): void;
  setListEnabled(id: string, enabled: boolean): void;
  updateLists(): Promise<{ added: number }>;
  addEntry(listId: string, entry: string): void;
  removeEntry(listId: string, entry: string): void;
  allow(domain: string): void;
  unallow(domain: string): void;
  setConfig(patch: Partial<DecisionConfig>): void;
  resetCounter(): void;
}

export const UPSTREAMS: { value: Upstream; label: string; ip: string }[] = [
  { value: 'cloudflare', label: 'Cloudflare', ip: '1.1.1.1' },
  { value: 'quad9', label: 'Quad9', ip: '9.9.9.9' },
  { value: 'google', label: 'Google', ip: '8.8.8.8' },
  { value: 'adguard', label: 'AdGuard', ip: '94.140.14.14' },
  { value: 'unbound', label: 'Unbound', ip: '127.0.0.1#5335' }
];

export const BLOCKING_MODES: { value: BlockingMode; label: string; hint: string }[] = [
  { value: 'null', label: 'Null IP', hint: 'Answer 0.0.0.0 / ::' },
  { value: 'nxdomain', label: 'NXDOMAIN', hint: 'Domain does not exist' },
  { value: 'refused', label: 'Refused', hint: 'REFUSED rcode' },
  { value: 'nodata', label: 'NODATA', hint: 'Empty answer section' }
];

export const TTL_OPTIONS = [60, 300, 900, 3600].map((v) => ({ value: v, label: String(v) }));
