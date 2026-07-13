import { useEffect, useState } from "react";

// Live clock. Starts null so SSR and first client render match (no hydration
// mismatch), then ticks each second on the client.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`
    : "--.--.--";

  return (
    <div className="text-right">
      <div className="text-[22px] font-bold tabular-nums text-brand">{time}</div>
      <div className="text-[13px] text-ink/70">WIB · UTC+7</div>
    </div>
  );
}
