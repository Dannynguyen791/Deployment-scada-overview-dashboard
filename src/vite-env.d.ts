/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EOH_API_BASE_URL?: string;
  readonly VITE_EOH_API_TOKEN?: string;
  readonly VITE_EOH_POLL_INTERVAL_MS?: string;
  readonly VITE_EOH_PSON_CONFIG_ID?: string;
  readonly VITE_EOH_PSON_GATEWAY_ID?: string;
  readonly VITE_EOH_PSON_NAME?: string;
  readonly VITE_EOH_PSON_FUNCTION_CODE?: string;
  readonly VITE_EOH_PSON_DATA_ADDRESS?: string;
  readonly VITE_EOH_PSON_DATA_LENGTH?: string;
  readonly VITE_EOH_PSON_TRANSFORMER?: string;
  readonly VITE_EOH_PSON_UNIT_KEYS?: string;
  readonly VITE_EOH_PCON_CONFIG_ID?: string;
  readonly VITE_EOH_PCON_GATEWAY_ID?: string;
  readonly VITE_EOH_PCON_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
