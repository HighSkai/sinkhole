import type { DnsSource } from './types';

export const WS_STORAGE_KEY = 'sinkhole.ws';

export function configuredStreamUrl(): string | null {
  let url: string | null = null;
  try {
    url = localStorage.getItem(WS_STORAGE_KEY);
  } catch {
    /* storage blocked */
  }
  return url || import.meta.env.VITE_SINKHOLE_WS || null;
}

/**
 * Pick the data source. A WebSocket URL (from Settings or VITE_SINKHOLE_WS)
 * selects the real backend adapter; otherwise the mock resolver is used.
 * Both are split into their own chunks so only the one in use is fetched.
 */
export async function resolveSource(): Promise<DnsSource> {
  const url = configuredStreamUrl();
  if (url) {
    const { createWsSource } = await import('./ws');
    return createWsSource(url);
  }
  const { createMockSource } = await import('./mock');
  return createMockSource();
}
