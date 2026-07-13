/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" (default) serves local mock fixtures; "false" hits the real FastAPI backend. */
  readonly VITE_USE_MOCK?: string;
  /** Override the `ai` service base URL (default http://localhost:8000/api/v1). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
