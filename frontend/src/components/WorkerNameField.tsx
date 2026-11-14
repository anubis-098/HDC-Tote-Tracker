import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function WorkerNameField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  useEffect(() => {
    setNames([]); setSelected(-1);
    if (!open || value.trim().length < 3) return;
    let active = true;
    const timer = setTimeout(() => {
      api<{ name: string }[]>('/workers/suggestions?q=' + encodeURIComponent(value.trim()))
        .then(rows => { if (active) setNames(rows.map(row => row.name)); })
        .catch(() => { if (active) setNames([]); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [value, open]);
  function choose(name: string) { onChange(name); setOpen(false); setNames([]); }
  const visible = open && names.length > 0;
  return <div className="worker-autocomplete" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label htmlFor="worker-name">ชื่อ–นามสกุล</label>
    <input id="worker-name" autoComplete="off" required minLength={2} maxLength={160}
      placeholder="กรอกชื่อและนามสกุลของคุณ" role="combobox" aria-autocomplete="list"
      aria-expanded={visible} aria-controls="worker-suggestions"
      aria-activedescendant={visible && selected >= 0 ? `worker-option-${selected}` : undefined}
      value={value} disabled={disabled} onFocus={() => setOpen(true)}
      onChange={event => { onChange(event.target.value); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); return; }
        if (!visible) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(index => (index + 1) % names.length); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => (index <= 0 ? names.length : index) - 1); }
        if (event.key === 'Enter' && selected >= 0) { event.preventDefault(); choose(names[selected]); }
      }} />
    {visible && <ul id="worker-suggestions" role="listbox" aria-label="รายชื่อผู้ปฏิบัติงาน" className="worker-suggestions">
      {names.map((name, index) => <li key={name} role="presentation"><button id={`worker-option-${index}`} type="button"
        role="option" aria-selected={index === selected} onMouseDown={event => event.preventDefault()} onClick={() => choose(name)}>{name}</button></li>)}
    </ul>}
    <small>พิมพ์อย่างน้อย 3 ตัวอักษรเพื่อเลือกชื่อที่เคยบันทึก</small>
  </div>;
}
