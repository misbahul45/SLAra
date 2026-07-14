import { useState } from "react";

// Segmented range control (Figma 6-29). Visual only for the mock — no data refetch.

const RANGES = ["Today", "7d", "30d", "Custom"];

export function RangeToggle() {
  const [active, setActive] = useState("Today");
  return (
    <div className="flex rounded-[12px] border-2 border-brand/50 bg-white/50 p-1">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setActive(r)}
          className={`rounded-[8px] px-3 py-1 text-[13px] font-semibold transition-colors ${
            active === r ? "bg-ink text-white" : "text-brand hover:text-ink"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
