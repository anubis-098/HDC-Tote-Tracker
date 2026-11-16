import { t, useLanguage, locale } from "../lib/i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Search, ArrowUpRight, Download } from "lucide-react";
import { api, message, statusLabel, dateTime, type ToteList } from "../lib/api";
import { ToteDonutChart } from "../components/ToteDonutChart";

export function DashboardPage() {
  const language = useLanguage();
  const en = language === "en";
  const [selected,setSelected] = useState<string[]>([]);
  const [downloading,setDownloading] = useState(false);
  const [data, setData] = useState<ToteList | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected([]);
    setError("");
    const params = new URLSearchParams({ q: search, page: String(page) });
    if (status) params.set("status", status);
    api<ToteList>("/totes?" + params)
      .then((result) => {
        if (active) {
          const last = Math.max(1, Math.ceil(result.total / 30));
          if (page > last) setPage(last);
          else setData(result);
        }
      })
      .catch((error) => {
        if (active) setError(message(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, status, page, refresh]);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">TOTE OVERVIEW</span>
          <h1>{t("ภาพรวม Tote")}</h1>
        </div>
        <LayoutDashboard size={28} />
      </div>
      {data ? (
        <ToteDonutChart
          counts={data.counts}
          selected={status}
          onSelect={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      ) : (
        !error && (
          <div className="panel chart-loading" role="status">
            {t("กำลังโหลดสัดส่วน Tote…")}
          </div>
        )
      )}
      <section className="panel form">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
            setPage(1);
            setRefresh((value) => value + 1);
          }}
        >
          <input
            aria-label={t("ค้นหาเลข Tote")}
            placeholder={t("ค้นหา HDC000001")}
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="primary" aria-label={t("ค้นหา")}>
            <Search size={20} />
          </button>
        </form>
        <label>
          {t("สถานะ")}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("ทุกสถานะ")}</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <small>
            {data?.total ?? 0}
            {t("กล่อง")}
          </small>
          <button
            className="text-button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {t("รีเฟรชข้อมูล")}
          </button>
        </div>
        <div className="row">
          <label><input type="checkbox" disabled={loading || downloading || !data?.items.length} checked={!!data?.items.length && data.items.every(item=>selected.includes(item.code))} onChange={e=>setSelected(e.target.checked ? data!.items.map(item=>item.code) : [])}/>{en ? "Select Totes on this page" : "\u0e40\u0e25\u0e37\u0e2d\u0e01 Tote \u0e17\u0e35\u0e48\u0e2a\u0e48\u0e07\u0e44\u0e1b Store \u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49"}</label>
          <button className="primary" disabled={loading || downloading || !selected.length} onClick={async()=>{
            setDownloading(true);setError("");
            try {
              const response=await fetch('/api/tote-photo-downloads',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:selected})});
              if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail || `Download failed (${response.status})`);}
              const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='tote-photos.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            }catch(error){setError(message(error));}finally{setDownloading(false);}
          }}><Download size={18}/>{downloading ? '...' : en ? 'Download photos' : '\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b'} ({selected.length})</button>
        </div>
        {error && (
          <div role="alert" className="error">
            {t(error)}
            <p>
              <Link to="/">{t("กลับหน้าเข้าสู่ระบบ")}</Link>
            </p>
          </div>
        )}
        {loading ? (
          <p role="status">{t("กำลังโหลด…")}</p>
        ) : (
          !error && (
            <>
              {!data?.items.length && (
                <div className="empty">{t("ไม่พบ Tote ตามเงื่อนไข")}</div>
              )}
              {data?.items.map((tote) => (
                <div key={tote.code}>
                  {<label><input type="checkbox" aria-label={"Select " + tote.code} checked={selected.includes(tote.code)} disabled={downloading || loading} onChange={e=>setSelected(values=>e.target.checked ? [...values,tote.code] : values.filter(code=>code!==tote.code))}/>{en ? "Select" : "\u0e40\u0e25\u0e37\u0e2d\u0e01"} {tote.code}</label>}
                <Link
                  className="tote-list-item"
                  to={"/scan?code=" + tote.code}
                >
                  <div className="row">
                    <b>{tote.code}</b><small>{tote.truck_registration}</small>
                    <span className={"badge " + tote.status}>
                      {t(statusLabel[tote.status])}
                    </span>
                  </div>
                  <p>
                    {tote.store_code
                      ? `${tote.store_code} · ${tote.store_name}`
                      : t("อยู่ที่ HDC")}
                  </p>
                  <div className="row">
                    <small>{dateTime(tote.updated_at)}</small>
                    <ArrowUpRight size={17} />
                  </div>
                </Link>
                </div>
              ))}
              <div className="pagination">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t("ก่อนหน้า")}
                </button>
                <span>
                  {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 30))}
                </span>
                <button
                  disabled={page * 30 >= (data?.total ?? 0)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t("ถัดไป")}
                </button>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
