import { isRouteErrorResponse, useRouteError, useRevalidator } from "react-router";
import { ApiError } from "~/lib/api";

// Per-route error boundary. Exported as `ErrorBoundary` from every route module so
// a failing loader (agent/ai down) renders inside the AppShell <Outlet> — the
// sidebar stays alive instead of falling through to the bare root boundary.

export function RouteErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  let title = "Something went wrong";
  let detail = "An unexpected error occurred while loading this view.";
  let hint: string | null = null;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Not found" : `Error ${error.status}`;
    detail = error.statusText || detail;
  } else if (error instanceof ApiError) {
    title = `Backend error (${error.status})`;
    detail = error.message;
    hint = "Is the agent up on :3000 (and ai on :8000)? See apps/app/.env.example.";
  } else if (error instanceof Error) {
    detail = error.message;
    // fetch() rejects with TypeError when the service is unreachable.
    if (error.name === "TypeError" || /fetch failed/i.test(error.message)) {
      title = "Backend unreachable";
      hint =
        "Is the agent up on :3000 (and ai on :8000)? Or set VITE_USE_MOCK=true for the offline demo.";
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="glass-card p-6">
        <h1 className="text-[24px] font-bold text-ink">{title}</h1>
        <p className="mt-2 text-[14px] text-ink/70">{detail}</p>
        {hint && <p className="mt-2 text-[13px] text-muted">{hint}</p>}
        <button
          type="button"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state === "loading"}
          className="mt-4 rounded-[10px] bg-accent px-5 py-2.5 text-[14px] font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {revalidator.state === "loading" ? "Retrying…" : "Retry"}
        </button>
      </div>
    </div>
  );
}
