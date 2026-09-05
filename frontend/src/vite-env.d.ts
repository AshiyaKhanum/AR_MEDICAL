/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_BUSINESS_NAME: string;
  readonly VITE_BUSINESS_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
