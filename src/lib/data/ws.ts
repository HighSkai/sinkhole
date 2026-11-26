import type { DnsEvent, DnsSource, Snapshot } from './types';

/**
 * Real-backend adapter. One WebSocket carries the live event stream (and
 * commands back to the resolver); the initial snapshot comes from REST.
 *
 *   GET  {http}/api/snapshot?profile=home   → Snapshot
 *   WS   {ws}/api/stream                    → DnsEvent JSON, one per message
 *                                              (or an array of DnsEvent)
 *   WS   ← { op: 'pause', ms } | { op: 'resume' } | { op: 'list', id, enabled }
 *        ← { op: 'update-lists' } | { op: 'entry-add' | 'entry-remove', list, entry }
 *        ← { op: 'allow' | 'unallow', domain } | { op: 'config', patch } | { op: 'reset-counter' }
 *
 * See README → "Wiring a real backend".
 */
export function createWsSource(url: string): DnsSource {
  const wsUrl = new URL(url, location.href);
  const httpBase = new URL(wsUrl.href.replace(/^ws/, 'http'));
  httpBase.pathname = httpBase.pathname.replace(/\/stream\/?$/, '');

  let socket: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let pendingUpdate: ((r: { added: number }) => void) | null = null;
  const outbox: string[] = [];

  const send = (msg: object) => {
    const s = JSON.stringify(msg);
    if (socket?.readyState === WebSocket.OPEN) socket.send(s);
    else outbox.push(s);
  };

  return {
    kind: 'websocket',
    label: `WebSocket · ${wsUrl.host}`,

    async load(profile) {
      const res = await fetch(`${httpBase.href.replace(/\/$/, '')}/snapshot?profile=${encodeURIComponent(profile)}`);
      if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
      return (await res.json()) as Snapshot;
    },

    connect(onEvent) {
      closed = false;
      const open = () => {
        socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          retry = 0;
          onEvent({ t: 'status', connected: true });
          while (outbox.length) socket!.send(outbox.shift()!);
        };
        socket.onmessage = (m) => {
          try {
            const data = JSON.parse(m.data as string) as DnsEvent | DnsEvent[] | { t: 'lists-updated'; added: number };
            const items = Array.isArray(data) ? data : [data];
            for (const e of items) {
              if ((e as { t: string }).t === 'lists-updated') {
                pendingUpdate?.({ added: (e as { added: number }).added });
                pendingUpdate = null;
              } else onEvent(e as DnsEvent);
            }
          } catch {
            /* ignore malformed frames */
          }
        };
        socket.onclose = () => {
          onEvent({ t: 'status', connected: false });
          if (closed) return;
          const delay = Math.min(15_000, 500 * 2 ** retry++);
          setTimeout(open, delay);
        };
      };
      open();
      return () => {
        closed = true;
        socket?.close();
      };
    },

    pauseBlocking: (ms) => send({ op: 'pause', ms }),
    resumeBlocking: () => send({ op: 'resume' }),
    setListEnabled: (id, enabled) => send({ op: 'list', id, enabled }),
    updateLists: () =>
      new Promise((resolve) => {
        pendingUpdate = resolve;
        send({ op: 'update-lists' });
      }),
    addEntry: (list, entry) => send({ op: 'entry-add', list, entry }),
    removeEntry: (list, entry) => send({ op: 'entry-remove', list, entry }),
    allow: (domain) => send({ op: 'allow', domain }),
    unallow: (domain) => send({ op: 'unallow', domain }),
    setConfig: (patch) => send({ op: 'config', patch }),
    resetCounter: () => send({ op: 'reset-counter' })
  };
}
