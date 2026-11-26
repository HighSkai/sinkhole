import type { Component } from 'svelte';
import type { Page } from './ui.svelte';

// Each page is its own chunk, fetched on first visit (or on tab hover).
const loaders: Record<Page, () => Promise<{ default: Component }>> = {
  pipeline: () => import('../../pages/pipeline/PipelinePage.svelte'),
  log: () => import('../../pages/log/QueryLogPage.svelte'),
  lists: () => import('../../pages/lists/ListsPage.svelte'),
  settings: () => import('../../pages/settings/SettingsPage.svelte')
};

const cache = new Map<Page, Promise<Component>>();

export function loadPage(p: Page): Promise<Component> {
  let hit = cache.get(p);
  if (!hit) {
    hit = loaders[p]().then((m) => m.default);
    cache.set(p, hit);
  }
  return hit;
}

export const prefetch = (p: Page) => void loadPage(p);
