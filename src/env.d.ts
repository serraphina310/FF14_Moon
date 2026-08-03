/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOURCE_URL?: string
  readonly VITE_SOURCE_REVISION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
