import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

if (import.meta.env.DEV) {
  // handy for poking at state from devtools / screenshot scripts
  Promise.all([import('./lib/state/ui.svelte'), import('./lib/data/store.svelte')]).then(([u, d]) => {
    Object.assign(window, { __sinkhole: { ui: u.ui, store: d.sinkhole } });
  });
}

mount(App, { target: document.getElementById('app')! });
