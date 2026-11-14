import { Package } from 'lucide-react';
import { statusLabel, type Status } from '../lib/api';

const segments: { status: Status; color: string }[] = [
  { status: 'READY', color: '#18a77b' },
  { status: 'AT_STORE', color: '#efaa34' },
  { status: 'RETURNED', color: '#2587d9' },
];
export function ToteDonutChart({ counts, selected, onSelect }: { counts: Partial<Record<Status, number>>; selected: string; onSelect: (status: string) => void }) {
  const total = segments.reduce((sum, item) => sum + (counts[item.status] || 0), 0);
  const circumference = 2 * Math.PI * 78;
  let offset = 0;
  const summary = segments.map(item => `${statusLabel[item.status]} ${counts[item.status] || 0} กล่อง`).join(', ');
  return <section className="panel donut-panel" aria-labelledby="donut-title">
    <div className="row"><div><span className="eyebrow">TOTE DISTRIBUTION</span><h2 id="donut-title">สัดส่วนสถานะ Tote</h2></div><span className="donut-icon"><Package size={22} /></span></div>
    <div className="donut-chart"><svg viewBox="0 0 220 220" role="img" aria-label={`Tote ทั้งหมด ${total} กล่อง: ${summary}`}>
      <circle cx="110" cy="110" r="78" fill="none" stroke="#e8eef4" strokeWidth="22" />
      {segments.map(item => {
        const count = counts[item.status] || 0;
        const length = total ? count / total * circumference : 0;
        const start = offset; offset += length;
        return count > 0 && <circle key={item.status} className="donut-segment" cx="110" cy="110" r="78" fill="none" stroke={item.color} strokeWidth={selected === item.status ? 27 : 22}
          strokeDasharray={`${Math.max(0, length - (count === total ? 0 : Math.min(4, length * .15)))} ${circumference}`}
          strokeDashoffset={-start} transform="rotate(-90 110 110)" opacity={selected && selected !== item.status ? .3 : 1} />;
      })}
    </svg><div className="donut-center"><small>Tote ทั้งหมด</small><strong>{total.toLocaleString('th-TH')}</strong><span>กล่อง</span></div></div>
    <p className="donut-caption">{total ? 'ภาพรวมทั้งหมดในระบบ · แตะสถานะเพื่อกรองรายการ' : 'ยังไม่มี Tote ในระบบ เริ่มสแกนเพื่อลงทะเบียน'}</p>
    <div className="donut-legend">{segments.map(item => {
      const count = counts[item.status] || 0;
      const percent = total ? count / total * 100 : 0;
      return <button key={item.status} className={selected === item.status ? 'selected' : ''} aria-pressed={selected === item.status} onClick={() => onSelect(selected === item.status ? '' : item.status)}>
        <span className="legend-dot" style={{ background: item.color }} /><span className="legend-label">{statusLabel[item.status]}</span><strong>{count.toLocaleString('th-TH')} <small>กล่อง</small></strong><span className="legend-percent">{percent.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%</span>
      </button>;
    })}</div>
  </section>;
}
