/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FAKE_LATENCY_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
