import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, Store as StoreIcon, LogOut, Trash2, Search } from 'lucide-react';
import { api, ApiError, message, statusLabel, type Store, type ToteList } from '../lib/api';
import { DeleteDialog, type DeleteTarget } from '../components/DeleteDialog';

export function AdminPage() {
  const navigate = useNavigate(); const location = useLocation();
  const login = location.pathname === '/admin/login';
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [totes, setTotes] = useState<ToteList | null>(null);
  const [toteQuery, setToteQuery] = useState('');
  const [toteSearch, setToteSearch] = useState('');
  const [totePage, setTotePage] = useState(1);
  const [toteRefresh, setToteRefresh] = useState(0);
  const [totesLoading, setTotesLoading] = useState(false);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [draft, setDraft] = useState<Store>({ code: '', name: '', active: true });
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true; setReady(false); setError('');
    if (!login) { setLoading(true); api<Store[]>('/admin/stores').then(rows => { if (active) { setStores(rows); setReady(true); } }).catch(error => { if (!active) return; if (error instanceof ApiError && error.status === 401) navigate('/admin/login', { replace: true }); else setError(message(error)); }).finally(() => { if (active) setLoading(false); }); }
    return () => { active = false; };
  }, [login]);
  useEffect(() => {
    if (login || !ready) return;
    let active = true; setTotesLoading(true);
    api<ToteList>(`/totes?q=${encodeURIComponent(toteSearch)}&page=${totePage}`)
      .then(result => { if (active) setTotes(result); })
      .catch(error => { if (active) setError(message(error)); })
      .finally(() => { if (active) setTotesLoading(false); });
    return () => { active = false; };
  }, [login, ready, toteSearch, totePage, toteRefresh]);
  async function remove(confirmation: string) {
    if (!deleting) return;
    await api(`/admin/${deleting.kind}/${encodeURIComponent(deleting.code)}`, { method: 'DELETE', body: JSON.stringify({ confirmation }) });
    if (deleting.kind === 'stores') {
      setStores(rows => rows.filter(row => row.code !== deleting.code));
      if (draft.code === deleting.code) { setEditing(false); setDraft({ code: '', name: '', active: true }); }
    } else { setTotes(null); setTotePage(1); setToteRefresh(value => value + 1); }
    setSuccess(`ลบ ${deleting.code} แล้ว`); setDeleting(null);
  }
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); setPassword(''); navigate('/admin/stores'); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      await api('/admin/stores/' + encodeURIComponent(draft.code), { method: 'PUT', body: JSON.stringify(draft) });
      setStores(await api<Store[]>('/admin/stores')); setDraft({ code: '', name: '', active: true }); setEditing(false); setSuccess('บันทึก Store แล้ว');
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function logout() { setBusy(true); try { await api('/admin/logout', { method: 'POST' }); navigate('/admin/login'); } catch (error) { setError(message(error)); } finally { setBusy(false); } }
  return <><div className="page-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>{login ? 'เข้าสู่ระบบผู้ดูแล' : 'จัดการ Store / Tote'}</h1></div>{login ? <LockKeyhole size={28} /> : <StoreIcon size={28} />}</div>
    {error && <div role="alert" className="error space">{error}</div>}{success && <div className="success space" role="status">{success}</div>}
    {login ? <form className="panel form" onSubmit={signIn}><label>ชื่อบัญชี<input required maxLength={60} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} disabled={busy} /></label><label>รหัสผ่าน<input required type="password" maxLength={200} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label><button className="primary" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button><small>สร้างบัญชีผู้ดูแลครั้งแรกผ่านคำสั่งใน README</small></form>
      : ready ? <><div className="operator"><Link to="/dashboard">ดูภาพรวม Tote →</Link><button className="text-button" disabled={busy} onClick={logout}><LogOut size={15} />ออกจากระบบ</button></div><form className="panel form" onSubmit={save}><h2>{editing ? 'แก้ไข Store' : 'เพิ่ม Store ใหม่'}</h2><label>รหัส Store<input required pattern="[A-Za-z0-9_-]{1,30}" maxLength={30} disabled={busy || editing} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} /></label><label>ชื่อ Store<input required maxLength={160} disabled={busy} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label className="checkbox"><input type="checkbox" disabled={busy} checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />เปิดใช้งาน</label><div className="dialog-actions"><button className="primary" disabled={busy}>บันทึก Store</button>{editing && <button type="button" disabled={busy} onClick={() => { setEditing(false); setDraft({ code: '', name: '', active: true }); }}>ยกเลิก</button>}</div></form>
      <section className="panel"><h2>Store ทั้งหมด ({stores.length})</h2>{!stores.length && <p className="hint">ยังไม่มี Store เพิ่มปลายทางแรกเพื่อเริ่มส่ง Tote</p>}{stores.map(item => <div className="store-item" key={item.code}><div><b>{item.code} · {item.name}</b><small>{item.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</small></div><div className="item-actions"><button disabled={busy} onClick={() => { setDraft(item); setEditing(true); setSuccess(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>แก้ไข</button><button className="danger-outline" disabled={busy} aria-label={`ลบ Store ${item.code}`} onClick={() => setDeleting({ kind: 'stores', code: item.code, label: `${item.code} · ${item.name}` })}><Trash2 size={17} /></button></div></div>)}</section>
      <section className="panel form"><h2>จัดการ Tote ({totes?.total ?? '…'})</h2>
        <form className="search" onSubmit={event => { event.preventDefault(); setToteSearch(toteQuery.trim()); setTotePage(1); setToteRefresh(value => value + 1); }}>
          <input aria-label="ค้นหา Tote เพื่อลบ" placeholder="ค้นหาหมายเลข Tote" maxLength={100} value={toteQuery} onChange={event => setToteQuery(event.target.value)} />
          <button className="primary" aria-label="ค้นหา Tote เพื่อลบ"><Search size={20} /></button>
        </form>
        {totesLoading ? <p role="status">กำลังโหลด Tote…</p> : <>{!totes?.items.length && <p className="hint">ไม่พบ Tote</p>}{totes?.items.map(item => <div className="store-item" key={item.code}><div><b className="wrap-code">{item.code}</b><small>{statusLabel[item.status]}{item.store_code ? ` · ${item.store_code}` : ''}</small></div><button className="danger-outline" aria-label={`ลบ Tote ${item.code}`} onClick={() => setDeleting({ kind: 'totes', code: item.code, label: item.code })}><Trash2 size={17} /></button></div>)}</>}
        <div className="pagination"><button disabled={totesLoading || totePage === 1} onClick={() => setTotePage(value => value - 1)}>ก่อนหน้า</button><span>{totePage} / {Math.max(1, Math.ceil((totes?.total ?? 0) / 30))}</span><button disabled={totesLoading || totePage * 30 >= (totes?.total ?? 0)} onClick={() => setTotePage(value => value + 1)}>ถัดไป</button></div>
      </section></> : loading ? <p className="notice">กำลังตรวจสอบสิทธิ์ผู้ดูแล…</p> : <div className="panel"><button onClick={() => window.location.reload()}>ลองเชื่อมต่อใหม่</button></div>}
    {deleting && <DeleteDialog key={`${deleting.kind}:${deleting.code}`} target={deleting} onClose={() => setDeleting(null)} onDelete={remove} />}
  </>;
}
