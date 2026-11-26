/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SINKHOLE_WS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
