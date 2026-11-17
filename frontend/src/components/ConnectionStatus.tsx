import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";

export function ConnectionStatus() {
  const language = useLanguage();
  const [state, setState] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  useEffect(() => {
    let stopped = false;
    let running = false;
    let controller: AbortController | undefined;
    let failed = false;
    async function check() {
      if (running || stopped) return;
      if (!navigator.onLine) { failed = true; setState('disconnected'); return; }
      running = true;
      if (failed) setState('connecting');
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 6000);
      try {
        const response = await fetch('/api/health', {cache:'no-store', credentials:'same-origin', signal:controller.signal});
        if (!response.ok) throw new Error('Unavailable');
        if (!stopped) { failed = false; setState('connected'); }
      } catch {
        if (!stopped) { failed = true; setState('disconnected'); }
      } finally { clearTimeout(timeout); running = false; }
    }
    const offline = () => { failed = true; controller?.abort(); setState('disconnected'); };
    const online = () => { failed = true; void check(); };
    void check();
    const interval = setInterval(check, 15000);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { stopped = true; clearInterval(interval); controller?.abort(); window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);
  const labels = language === 'en'
    ? {connected:'Connected', connecting:'Reconnecting', disconnected:'Disconnected'}
    : {connected:'เชื่อมต่ออยู่', connecting:'กำลังเชื่อมต่อ', disconnected:'หลุดการเชื่อมต่อ'};
  return <span className={'connection-status ' + state} role="status" aria-live="polite" aria-label={labels[state]} title={labels[state]}><span className="connection-dot" aria-hidden="true"/><span className="connection-label">{labels[state]}</span></span>;
}
