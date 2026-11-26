import type { DnsQuery } from './types';

type Listener = (batch: DnsQuery[]) => void;

/**
 * Non-reactive fan-out for per-frame query batches. The packet canvas and the
 * Query Log subscribe here so high-frequency traffic never touches the
 * reactive graph more than once per animation frame.
 */
export const queryBus = {
  listeners: new Set<Listener>(),
  on(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  },
  emit(batch: DnsQuery[]) {
    for (const fn of this.listeners) fn(batch);
  }
};
