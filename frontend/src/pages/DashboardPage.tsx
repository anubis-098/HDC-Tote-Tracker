import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Search, ArrowUpRight } from 'lucide-react';
import { api, message, statusLabel, dateTime, type ToteList } from '../lib/api';
import { ToteDonutChart } from '../components/ToteDonutChart';

export function DashboardPage() {
  const [data, setData] = useState<ToteList | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const params = new URLSearchParams({ q: search, page: String(page) });
    if (status) params.set('status', status);
    api<ToteList>('/totes?' + params).then(result => { if (active) { const last = Math.max(1, Math.ceil(result.total / 30)); if (page > last) setPage(last); else setData(result); } }).catch(error => { if (active) setError(message(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, status, page, refresh]);
  return <><div className="page-title"><div><span className="eyebrow">TOTE OVERVIEW</span><h1>ภาพรวม Tote</h1></div><LayoutDashboard size={28} /></div>
    {data ? <ToteDonutChart counts={data.counts} selected={status} onSelect={value => { setStatus(value); setPage(1); }} /> : !error && <div className="panel chart-loading" role="status">กำลังโหลดสัดส่วน Tote…</div>}
    <section className="panel form"><form className="search" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setPage(1); setRefresh(value => value + 1); }}><input aria-label="ค้นหาเลข Tote" placeholder="ค้นหา HDC000001" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} /><button className="primary" aria-label="ค้นหา"><Search size={20} /></button></form><label>สถานะ<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">ทุกสถานะ</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="row"><small>{data?.total ?? 0} กล่อง</small><button className="text-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>รีเฟรชข้อมูล</button></div>
      {error && <div role="alert" className="error">{error}<p><Link to="/">กลับหน้าเข้าสู่ระบบ</Link></p></div>}
      {loading ? <p role="status">กำลังโหลด…</p> : !error && <>{!data?.items.length && <div className="empty">ไม่พบ Tote ตามเงื่อนไข</div>}{data?.items.map(tote => <Link className="tote-list-item" key={tote.code} to={'/scan?code=' + tote.code}><div className="row"><b>{tote.code}</b><span className={'badge ' + tote.status}>{statusLabel[tote.status]}</span></div><p>{tote.store_code ? `${tote.store_code} · ${tote.store_name}` : 'อยู่ที่ HDC'}</p><div className="row"><small>{dateTime(tote.updated_at)}</small><ArrowUpRight size={17} /></div></Link>)}<div className="pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>ก่อนหน้า</button><span>{page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 30))}</span><button disabled={page * 30 >= (data?.total ?? 0)} onClick={() => setPage(value => value + 1)}>ถัดไป</button></div></>}
    </section></>;
}
