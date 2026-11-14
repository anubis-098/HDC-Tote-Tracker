import { useEffect, useState } from "react";

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parts = timeFormat.formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  const date = now.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  });
  return (
    <time
      className="live-clock"
      dateTime={now.toISOString()}
    >
      <span className="clock-reading">
        {hour}
        <span className="clock-colon">:</span>
        {minute}
      </span>
      <small>{date}</small>
    </time>
  );
}
