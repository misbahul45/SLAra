// Shared loading placeholders for lazy client-only panels (maps, charts) —
// previously copy-pasted into every route file.

export function MapFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-white/40 text-sm text-brand">
      Loading map…
    </div>
  );
}

export function ChartFallback({ height = 300 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-brand"
      style={{ height }}
    >
      Loading chart…
    </div>
  );
}
