import { useEffect, useState } from "react";

// Live clock. Starts null so SSR and first client render match (no hydration
// mismatch), then ticks each second on the client. Rendered in Asia/Jakarta so
// the "WIB · UTC+7" label stays true on any viewer's machine.

const WIB = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now ? WIB.format(now).replaceAll(":", ".") : "--.--.--";

  return (
    <div className="text-right">
      <div className="text-[22px] font-bold tabular-nums text-brand">{time}</div>
      <div className="text-[13px] text-ink/70">WIB · UTC+7</div>
    </div>
  );
}
