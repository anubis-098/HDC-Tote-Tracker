import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { api, type Store } from '../lib/api';
import './StorePicker.css';
import { t, useLanguage } from '../lib/i18n';

type Props = {
  stores: Store[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  existing?: { code: string; name: string };
};

export function useStoreRefresh(onUpdate: (stores: Store[]) => void) {
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { const rows = await api<Store[]>('/stores'); if (active) onUpdate(rows); }
      catch { /* Keep the last successful list while offline. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(() => void refresh(), 15000);
    const resume = () => { void refresh(); };
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener('focus', resume); window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [onUpdate]);
}

export function StorePicker({ stores, value, onChange, disabled, existing }: Props) {
  useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const available = stores.filter(store => store.active);
  const oldStore = existing && !available.some(store => store.code === existing.code) ? existing : undefined;
  const selected = available.find(store => store.code === value) || (oldStore?.code === value ? oldStore : undefined);
  const sections = ['1PX', 'HLE'].map(group => {
    const categories = [...new Set(available.flatMap(store => (store.memberships || [])
      .filter(item => item.group === group).map(item => item.category)))].sort();
    return {group, categories: categories.map(category => ({name: category, stores: available.filter(store =>
      store.memberships?.some(item => item.group === group && item.category === category))}))};
  }).filter(section => section.categories.length);
  const ungrouped: { code: string; name: string }[] = available.filter(store => !store.memberships?.length);
  if (oldStore) ungrouped.push(oldStore);
  const term = query.trim().toLocaleLowerCase();
  const results = [...available, ...(oldStore ? [oldStore] : [])].filter(store => {
    const links = available.find(item => item.code === store.code)?.memberships || [];
    return `${store.code} ${store.name} ${links.map(item => `${item.group} ${item.category}`).join(' ')}`.toLocaleLowerCase().includes(term);
  });

  function close(restoreFocus = false) {
    panel.current?.close();
    setOpen(false);
    setQuery('');
    if (restoreFocus) trigger.current?.focus();
  }
  function choose(code: string) { onChange(code); close(true); }
  useEffect(() => {
    if (open) panel.current?.showModal();
    else panel.current?.close();
  }, [open]);
  useEffect(() => { if (disabled) { setOpen(false); setQuery(''); } }, [disabled]);

  const option = (store: {code: string; name: string}, showPath = false) => <button
    key={store.code} type="button" className="store-picker-option" aria-pressed={store.code === value}
    onClick={() => choose(store.code)}>
    <span><b>{store.code}</b> · {store.name}
      {showPath && <small>{available.find(item => item.code === store.code)?.memberships?.map(item => `${item.group} / ${item.category}`).join(' · ') || t('อื่น ๆ')}</small>}
    </span>{store.code === value && <Check size={18} aria-hidden="true" />}
  </button>;

  return <div ref={root} className="store-picker" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
  }}>
    <span id={`${id}-label`} className="store-picker-label">{t('Store ปลายทาง')}</span>
    <button ref={trigger} id={`${id}-trigger`} type="button" className={`store-picker-trigger ${!value ? 'is-empty' : ''}`}
      aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-haspopup="dialog"
      aria-controls={open ? `${id}-panel` : undefined} disabled={disabled}
      onClick={() => { if (open) close(); else setOpen(true); }}>
      <span id={`${id}-value`}>{selected ? `${selected.code} · ${selected.name}` : t('เลือก Store')}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <select className="store-picker-validation" tabIndex={-1} aria-hidden="true" required disabled={disabled}
      value={value} onChange={event => onChange(event.target.value)} onInvalid={event => {
        event.preventDefault(); setOpen(true);
      }}>
      <option value="" />{value && <option value={value}>{value}</option>}
    </select>
    <dialog ref={panel} id={`${id}-panel`} className="store-picker-panel"
      aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(true); }} onClose={() => {setOpen(false); setQuery('');}} onClick={event => { if (event.target === event.currentTarget) { const r=event.currentTarget.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) close(true); } }}>
      <h2 id={`${id}-title`} className="store-picker-title">{t('เลือก Store')}</h2>
      <div className="store-picker-search">
        <Search size={17} aria-hidden="true" />
        <input aria-label={t('ค้นหา Store')} placeholder={t('ค้นหารหัส ชื่อ Store หรือ Category')} value={query}
          onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} />
        <button type="button" aria-label={t('ปิดรายการ Store')} onClick={() => close(true)}><X size={18} /></button>
      </div>
      <div className="store-picker-list">
        {term ? <><small className="store-picker-count" role="status">{t('พบ {0} Store', results.length)}</small>
          {results.map(store => option(store, true))}
          {!results.length && <p className="store-picker-empty">{t('ไม่พบ Store ที่ตรงกับคำค้นหา')}</p>}
        </> : <>
          {sections.map(section => <details key={section.group} className="store-picker-group">
            <summary>{section.group}<small>{section.categories.length} Category</small></summary>
            {section.categories.map(category => <details key={category.name} className="store-picker-category">
              <summary>{category.name}<small>{category.stores.length}</small></summary>
              {category.stores.map(store => option(store))}
            </details>)}
          </details>)}
          {ungrouped.length > 0 && <details className="store-picker-group">
            <summary>{t('อื่น ๆ / ยังไม่จัดกลุ่ม')}<small>{ungrouped.length} Store</small></summary>
            {ungrouped.map(store => option(store))}
          </details>}
          {!available.length && !oldStore && <p className="store-picker-empty">{t('ยังไม่มี Store เปิดใช้งาน กรุณาติดต่อผู้ดูแล')}</p>}
        </>}
      </div>
    </dialog>
  </div>;
}
