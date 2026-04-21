/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EOH_API_BASE_URL?: string;
  readonly VITE_EOH_API_TOKEN?: string;
  readonly VITE_EOH_POLL_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
