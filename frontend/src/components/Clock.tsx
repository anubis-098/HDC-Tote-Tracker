import { t, useLanguage, locale } from "../lib/i18n";
import { useEffect, useState } from "react";

const timeFormat = new Intl.DateTimeFormat(locale(), {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function Clock() {
  useLanguage();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const parts = timeFormat.formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  const date = now.toLocaleDateString(locale(), {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  });
  return (
    <time className="live-clock" dateTime={now.toISOString()}>
      <span className="clock-reading">
        {hour}
        <span className="clock-colon">:</span>
        {minute}
      </span>
      <small>{date}</small>
    </time>
  );
}
