import { t, useLanguage, locale } from "../lib/i18n";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Store as StoreIcon,
  LogOut,
  Trash2,
  Search,
} from "lucide-react";
import {
  api,
  ApiError,
  message,
  statusLabel,
  type Store,
  type ToteList,
} from "../lib/api";
import { DeleteDialog, type DeleteTarget } from "../components/DeleteDialog";

export function AdminPage() {
  useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const login = location.pathname === "/admin/login";
  const [selected, setSelected] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [totes, setTotes] = useState<ToteList | null>(null);
  const [toteQuery, setToteQuery] = useState("");
  const [toteSearch, setToteSearch] = useState("");
  const [totePage, setTotePage] = useState(1);
  const [toteRefresh, setToteRefresh] = useState(0);
  const [totesLoading, setTotesLoading] = useState(false);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [draft, setDraft] = useState<Store>({
    code: "",
    name: "",
    active: true,
  });
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    if (!login) {
      setLoading(true);
      api<Store[]>("/admin/stores")
        .then((rows) => {
          if (active) {
            setStores(rows);
            setReady(true);
          }
        })
        .catch((error) => {
          if (!active) return;
          if (error instanceof ApiError && error.status === 401)
            navigate("/admin/login", { replace: true });
          else setError(message(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [login]);
  useEffect(() => {
    if (login || !ready) return;
    let active = true;
    setTotesLoading(true);
    api<ToteList>(`/totes?q=${encodeURIComponent(toteSearch)}&page=${totePage}`)
      .then((result) => {
        if (active) { setTotes(result); setSelected([]); }
      })
      .catch((error) => {
        if (active) setError(message(error));
      })
      .finally(() => {
        if (active) setTotesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [login, ready, toteSearch, totePage, toteRefresh]);
  async function remove(confirmation: string) {
    if (!deleting) return;
    await api(`/admin/${deleting.kind}/${encodeURIComponent(deleting.code)}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    });
    if (deleting.kind === "stores") {
      setStores((rows) => rows.filter((row) => row.code !== deleting.code));
      if (draft.code === deleting.code) {
        setEditing(false);
        setDraft({ code: "", name: "", active: true });
      }
    } else {
      setTotes(null);
      setTotePage(1);
      setToteRefresh((value) => value + 1);
    }
    setSuccess(t("ลบ {0} แล้ว", deleting.code));
    setDeleting(null);
  }
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      navigate("/admin/stores");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/admin/stores/" + encodeURIComponent(draft.code), {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setStores(await api<Store[]>("/admin/stores"));
      setDraft({ code: "", name: "", active: true });
      setEditing(false);
      setSuccess(t("บันทึก Store แล้ว"));
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/admin/logout", { method: "POST" });
      navigate("/admin/login");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>{login ? t("เข้าสู่ระบบผู้ดูแล") : t("จัดการ Store / Tote")}</h1>
        </div>
        {login ? <LockKeyhole size={28} /> : <StoreIcon size={28} />}
      </div>
      {error && (
        <div role="alert" className="error space">
          {t(error)}
        </div>
      )}
      {success && (
        <div className="success space" role="status">
          {success}
        </div>
      )}
      {login ? (
        <form className="panel form" onSubmit={signIn}>
          <label>
            {t("ชื่อบัญชี")}
            <input
              required
              maxLength={60}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            {t("รหัสผ่าน")}
            <input
              required
              type="password"
              maxLength={200}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? t("กำลังเข้าสู่ระบบ…") : t("เข้าสู่ระบบ")}
          </button>
          <small>{t("สร้างบัญชีผู้ดูแลครั้งแรกผ่านคำสั่งใน README")}</small>
        </form>
      ) : ready ? (
        <>
          <div className="operator">
            <Link to="/dashboard">{t("ดูภาพรวม Tote →")}</Link>
            <button className="text-button" disabled={busy} onClick={logout}>
              <LogOut size={15} />
              {t("ออกจากระบบ")}
            </button>
          </div>
          <form className="panel form" onSubmit={save}>
            <h2>{editing ? t("แก้ไข Store") : t("เพิ่ม Store ใหม่")}</h2>
            <label>
              {t("รหัส Store")}
              <input
                required
                pattern="[A-Za-z0-9_-]{1,30}"
                maxLength={30}
                disabled={busy || editing}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </label>
            <label>
              {t("ชื่อ Store")}
              <input
                required
                maxLength={160}
                disabled={busy}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={busy}
                checked={draft.active}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
              />
              {t("เปิดใช้งาน")}
            </label>
            <div className="dialog-actions">
              <button className="primary" disabled={busy}>
                {t("บันทึก Store")}
              </button>
              {editing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false);
                    setDraft({ code: "", name: "", active: true });
                  }}
                >
                  {t("ยกเลิก")}
                </button>
              )}
            </div>
          </form>
          <section className="panel">
            <h2>
              {t("Store ทั้งหมด (")}
              {stores.length})
            </h2>
            {!stores.length && (
              <p className="hint">
                {t("ยังไม่มี Store เพิ่มปลายทางแรกเพื่อเริ่มส่ง Tote")}
              </p>
            )}
            {stores.map((item) => (
              <div className="store-item" key={item.code}>
                <div>
                  <b>
                    {item.code} · {item.name}
                  </b>
                  <small>
                    {item.active ? t("เปิดใช้งาน") : t("ปิดใช้งาน")}
                  </small>
                </div>
                <div className="item-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setDraft(item);
                      setEditing(true);
                      setSuccess("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {t("แก้ไข")}
                  </button>
                  <button
                    className="danger-outline"
                    disabled={busy}
                    aria-label={t("ลบ Store {0}", item.code)}
                    onClick={() =>
                      setDeleting({
                        kind: "stores",
                        code: item.code,
                        label: `${item.code} · ${item.name}`,
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </section>
          <section className="panel form">
            <h2>
              {t("จัดการ Tote (")}
              {totes?.total ?? "…"})
            </h2>
            <form
              className="search"
              onSubmit={(event) => {
                event.preventDefault();
                setToteSearch(toteQuery.trim());
                setTotePage(1);
                setToteRefresh((value) => value + 1);
              }}
            >
              <input
                aria-label={t("ค้นหา Tote เพื่อลบ")}
                placeholder={t("ค้นหาหมายเลข Tote")}
                maxLength={100}
                value={toteQuery}
                onChange={(event) => setToteQuery(event.target.value)}
              />
              <button className="primary" aria-label={t("ค้นหา Tote เพื่อลบ")}>
                <Search size={20} />
              </button>
            </form>
            <div className="search">
              <label><input type="checkbox" disabled={busy || !totes?.items.length} checked={!!totes?.items.length && selected.length === totes.items.length} onChange={e => setSelected(e.target.checked ? totes!.items.map(item => item.code) : [])} />{t("เลือกทั้งหมดในหน้านี้")}</label>
              <button disabled={busy || !selected.length} onClick={() => {
                const rows = totes!.items.filter(item => selected.includes(item.code));
                const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"','""') + '"';
                const blob = new Blob(['\ufeff' + [['Tote','Status','Store'], ...rows.map(item => [item.code,item.status,item.store_code])].map(row => row.map(cell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='selected-totes.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
              }}>{t("ดาวน์โหลดที่เลือก")} ({selected.length}) CSV</button>
              <button disabled={busy || !selected.length} onClick={async () => {
                if (!window.confirm(t("ยืนยันลบรายการที่เลือกและภาพทั้งหมด?"))) return;
                setBusy(true); setError('');
                try { for (const code of selected) { await api(`/admin/totes/${encodeURIComponent(code)}`, {method:'DELETE',body:JSON.stringify({confirmation:`DELETE ${code}`})}); setSelected(values => values.filter(value => value !== code)); } }
                catch(error) { setError(message(error)); }
                finally {setBusy(false); setToteRefresh(value => value + 1);}
              }}>{t("ลบที่เลือก")}</button>
            </div>
            {totesLoading ? (
              <p role="status">{t("กำลังโหลด Tote…")}</p>
            ) : (
              <>
                {!totes?.items.length && (
                  <p className="hint">{t("ไม่พบ Tote")}</p>
                )}
                {totes?.items.map((item) => (
                  <div className="store-item" key={item.code}>
                    <input type="checkbox" aria-label={item.code} disabled={busy} checked={selected.includes(item.code)} onChange={e => setSelected(values => e.target.checked ? [...values,item.code] : values.filter(code => code !== item.code))} />
                    <div>
                      <b className="wrap-code">{item.code}</b>
                      <small>
                        {t(statusLabel[item.status])}
                        {item.store_code ? ` · ${item.store_code}` : ""}
                      </small>
                    </div>
                    <button
                      className="danger-outline"
                      aria-label={t("ลบ Tote {0}", item.code)}
                      onClick={() =>
                        setDeleting({
                          kind: "totes",
                          code: item.code,
                          label: item.code,
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </>
            )}
            <div className="pagination">
              <button
                disabled={totesLoading || totePage === 1}
                onClick={() => setTotePage((value) => value - 1)}
              >
                {t("ก่อนหน้า")}
              </button>
              <span>
                {totePage} / {Math.max(1, Math.ceil((totes?.total ?? 0) / 30))}
              </span>
              <button
                disabled={totesLoading || totePage * 30 >= (totes?.total ?? 0)}
                onClick={() => setTotePage((value) => value + 1)}
              >
                {t("ถัดไป")}
              </button>
            </div>
          </section>
        </>
      ) : loading ? (
        <p className="notice">{t("กำลังตรวจสอบสิทธิ์ผู้ดูแล…")}</p>
      ) : (
        <div className="panel">
          <button onClick={() => window.location.reload()}>
            {t("ลองเชื่อมต่อใหม่")}
          </button>
        </div>
      )}
      {deleting && (
        <DeleteDialog
          key={`${deleting.kind}:${deleting.code}`}
          target={deleting}
          onClose={() => setDeleting(null)}
          onDelete={remove}
        />
      )}
    </>
  );
}
