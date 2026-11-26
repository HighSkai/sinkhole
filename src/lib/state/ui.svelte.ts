export type Page = 'pipeline' | 'log' | 'lists' | 'settings';
export type Palette = 'aurora' | 'ember' | 'glacier';
export type StatusFilter = 'all' | 'allowed' | 'blocked' | 'cached';

export const PAGES: { id: Page; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'log', label: 'Query Log' },
  { id: 'lists', label: 'Lists' },
  { id: 'settings', label: 'Settings' }
];

export interface FlowApi {
  zoomIn(): void;
  zoomOut(): void;
  fitView(): void;
  focusNode(id: string): void;
  resetLayout(): void;
}

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn';
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('sinkhole.' + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, v: unknown) {
  try {
    localStorage.setItem('sinkhole.' + key, JSON.stringify(v));
  } catch {
    /* storage blocked: preferences just won't persist */
  }
}

const readHash = (): Page => {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as Page;
  return PAGES.some((p) => p.id === h) ? h : 'pipeline';
};

class UIState {
  page = $state<Page>(readHash());
  animations = $state<boolean>(load('animations', true));
  minimap = $state<boolean>(load('minimap', false));
  palette = $state<Palette>(load('palette', 'aurora'));
  docVisible = $state(typeof document === 'undefined' ? true : !document.hidden);
  reducedMotion = $state(
    typeof matchMedia === 'undefined' ? false : matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  selectedNode = $state('decision');
  logFilter = $state<{ q: string; status: StatusFilter; client: string }>({ q: '', status: 'all', client: 'all' });
  toasts = $state<Toast[]>([]);
  overlay = $state<null | 'sinkhole' | 'shortcuts' | 'about'>(null);
  commandFocusToken = $state(0);

  /** Loops (canvas, drift) run only when this is true. */
  motion = $derived(this.animations && this.docVisible);
  /** Full choreography; reduced motion swaps travel for fades. */
  fullMotion = $derived(this.motion && !this.reducedMotion);

  flow: FlowApi | null = null;
  private toastId = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('hashchange', () => (this.page = readHash()));
    document.addEventListener('visibilitychange', () => (this.docVisible = !document.hidden));
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener(
      'change',
      (e) => (this.reducedMotion = e.matches)
    );
    $effect.root(() => {
      $effect(() => save('animations', this.animations));
      $effect(() => save('minimap', this.minimap));
      $effect(() => save('palette', this.palette));
    });
  }

  go(page: Page) {
    if (location.hash !== '#/' + page) location.hash = '/' + page;
    this.page = page;
  }

  toast(text: string, tone: Toast['tone'] = 'info') {
    const id = ++this.toastId;
    this.toasts = [...this.toasts, { id, text, tone }].slice(-3);
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3200);
  }

  openLogFor(patch: Partial<{ q: string; status: StatusFilter; client: string }>) {
    this.logFilter = { q: '', status: 'all', client: 'all', ...patch };
    this.go('log');
  }
}

export const ui = new UIState();
