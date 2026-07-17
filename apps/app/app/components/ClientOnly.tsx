import { useEffect, useState, type ReactNode } from "react";

// Renders children only after mount, so client-only libraries (maplibre-gl) never run
// during SSR. `children` is a function so the element isn't even constructed on the
// server; SSR and first client render both show `fallback` → no hydration mismatch.

export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children() : fallback}</>;
}
