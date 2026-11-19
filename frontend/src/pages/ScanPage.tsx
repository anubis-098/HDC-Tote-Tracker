import { t, useLanguage, locale } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useBeforeUnload,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ScanLine,
  Camera,
  History,
  Package,
  ArrowRight,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { PhotoViewer } from "../components/PhotoViewer";
import { UsageGuide } from "../components/UsageGuide";
import {
  api,
  ApiError,
  message,
  requestId,
  statusLabel,
  actionLabel,
  dateTime,
  type Tote,
  type Identity,
  type Action,
} from "../lib/api";

interface Review {
  code: string;
  action: Action;
  expected_version: number;
  store_name?: string;
  truck_registration?: string;
  order_number?: string;
  note: string;
  request_id: string;
  destination: string;
}
export function ScanPage() {
  useLanguage();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initial = useRef(params.get("code") || "");
  const input = useRef<HTMLInputElement>(null);
  const reviewDialog = useRef<HTMLDialogElement>(null);
  const focusAfterReset = useRef(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [code, setCode] = useState(initial.current);
  const [tote, setTote] = useState<Tote | null>(null);
  const [unknown, setUnknown] = useState("");
  const [truckRegistration,setTruckRegistration] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [store, setStore] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const scanning = useRef(false);
  const displayedCodeMatches = !tote || code.trim().toUpperCase() === tote.code;
  const editingDisabled = busy || !displayedCodeMatches;
  const latestReset = tote?.history.find((event) => event.action === "RESET");
  const hasPreviousPhotos =
    !!latestReset &&
    !!tote?.photos.some(
      (photo) =>
        Date.parse(photo.uploaded_at) < Date.parse(latestReset.created_at),
    );
  useBeforeUnload((event) => {
    if (busy || store || truckRegistration.trim() || orderNumber.trim() || note.trim()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  useEffect(() => {
    const protectDraft = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link || link.href === window.location.href) return;
      if (
        busy ||
        ((store || truckRegistration.trim() || orderNumber.trim() || note.trim()) &&
          !window.confirm(
            t("มีข้อมูลที่ยังไม่ยืนยัน ต้องการออกจากหน้านี้หรือไม่?"),
          ))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", protectDraft, true);
    return () => document.removeEventListener("click", protectDraft, true);
  }, [busy, store, truckRegistration, orderNumber, note]);
  useEffect(() => {
    let active = true;
    api<Identity>("/actor/me")
      .then((user) => {
        if (!active) return;
        setIdentity(user);
        if (initial.current) void lookup(initial.current);
        else input.current?.focus();
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) navigate("/");
        else setError(message(error));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (review) reviewDialog.current?.showModal();
    else reviewDialog.current?.close();
  }, [review]);
  useEffect(() => {
    if (focusAfterReset.current && !busy && !tote && !review) {
      focusAfterReset.current = false;
      input.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [busy, tote, review]);
  function resetScan(notice = "") {
    setTote(null);
    setCode("");
    setUnknown("");
    setStore("");
    setTruckRegistration("");
    setOrderNumber("");
    setNote("");
    setReview(null);
    setPhotoUrl("");
    setSuccess(notice);
    setError("");
    setParams({}, { replace: true });
    initial.current = "";
    focusAfterReset.current = true;
  }
  async function lookup(raw: string) {
    if (scanning.current) return;
    const value = raw.trim().toUpperCase();
    if (!/^HDC-?\d+$/.test(value) || value.length > 100) {
      setError(
        t(
          "รหัส Tote ต้องเป็น HDC ตามด้วยตัวเลข เช่น HDC-000001 / HDC1 หรือ HDC000001 (รวมไม่เกิน 100 ตัวอักษร)",
        ),
      );
      return;
    }
    if (
      tote &&
      (store || truckRegistration.trim() || orderNumber.trim() || note.trim()) &&
      !window.confirm(
        t(
          "การค้นหาหรือโหลดใหม่จะล้างข้อมูลที่ยังไม่ยืนยัน ต้องการดำเนินการต่อหรือไม่?",
        ),
      )
    )
      return;
    scanning.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    setUnknown("");
    setTote(null);
    setStore("");
    setTruckRegistration("");
    setOrderNumber("");
    setNote("");
    setCode(value);
    try {
      setTote(await api<Tote>("/totes/" + value));
      setParams({ code: value }, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setUnknown(value);
      else setError(message(error));
    } finally {
      setBusy(false);
      scanning.current = false;
    }
  }
  async function register() {
    setBusy(true);
    setError("");
    try {
      const result = await api<Tote>("/totes", {
        method: "POST",
        body: JSON.stringify({ code: unknown }),
      });
      setTote(result);
      setUnknown("");
      setParams({ code: result.code }, { replace: true });
      setSuccess(t("ลงทะเบียน Tote เรียบร้อยแล้ว"));
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  function prepare() {
    if (!tote || !displayedCodeMatches) return;
    const action: Action =
      tote.status === "READY"
        ? "DISPATCH"
        : tote.status === "AT_STORE"
          ? "RETURN"
          : "RESET";
    setError("");
    if(action === "DISPATCH" && !orderNumber.trim()){setError(t("กรุณากรอก Order/oLPN"));return;}
    setReview({
      code: tote.code,
      action,
      expected_version: tote.version,
      store_name: action === "DISPATCH" ? store.trim() || undefined : undefined,
      truck_registration: action === "DISPATCH" ? truckRegistration.trim() || undefined : undefined,
      order_number: action === "DISPATCH" ? orderNumber.trim() : undefined,
      note: note.trim(),
      request_id: requestId(),
      destination: action === "DISPATCH" ? store.trim() || t("ไม่ระบุ Store") : [tote.store_code, tote.store_name].filter(Boolean).join(" · ") || t("ไม่ระบุ Store"),
    });
  }
  async function confirm() {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { code, destination: _, ...body } = review;
      const result = await api<Tote>(`/totes/${code}/transitions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (body.action === "DISPATCH")
        resetScan(
          t("บันทึกแล้ว · ส่งไป Store · {0} พร้อมสแกนกล่องถัดไป", code),
        );
      else {
        setTote(result);
        setReview(null);
        setStore("");
    setTruckRegistration("");
    setOrderNumber("");
        setNote("");
        setSuccess(t("บันทึกแล้ว · ") + t(statusLabel[result.status]));
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function upload(slot: number, file?: File) {
    if (!file || !tote || editingDisabled) return;
    if (file.size > 8 * 1024 * 1024) {
      setError(t("ไฟล์ภาพต้องไม่เกิน 8 MB"));
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api(
        `/totes/${tote.code}/photos/${slot}?expected_version=${tote.version}`,
        { method: "PUT", body: form },
      );
      setTote(await api<Tote>("/totes/" + tote.code));
      setSuccess(t("บันทึกรูปภาพแล้ว"));
    } catch (error) {
      setError(message(error));
      if (error instanceof ApiError && error.status === 409)
        setTote(await api<Tote>("/totes/" + tote.code).catch(() => tote));
    } finally {
      setBusy(false);
    }
  }
  async function remove(slot: number) {
    if (
      !tote ||
      editingDisabled ||
      !window.confirm(t("ลบรูปช่อง {0} ของ {1}?", slot, tote.code))
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(
        `/totes/${tote.code}/photos/${slot}?expected_version=${tote.version}&expected_photo_id=${tote.photos.find((photo) => photo.slot === slot)?.id}`,
        { method: "DELETE" },
      );
      setTote(await api<Tote>("/totes/" + tote.code));
    } catch (error) {
      setError(message(error));
      if (error instanceof ApiError && error.status === 409)
        setTote(await api<Tote>("/totes/" + tote.code).catch(() => tote));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SCAN & TRACK</span>
          <h1>{t("สแกนกล่อง Tote")}</h1>
        </div>
        <ScanLine size={30} />
      </div>
      <div className="operator">
        <span>
          {t("ผู้ปฏิบัติงาน:")}
          {identity?.name || t("กำลังเชื่อมต่อ…")}
        </span>
        <Link to="/">{t("เปลี่ยนชื่อ")}</Link>
      </div>
      <form
        className="panel form"
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(code);
        }}
      >
        <label htmlFor="tote-code">{t("QR Code / หมายเลข Tote")}</label>
        <div className="scan-input">
          <ScanLine size={22} />
          <input
            ref={input}
            id="tote-code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="search"
            value={code}
            placeholder="HDC000001"
            maxLength={100}
            disabled={busy || !identity}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="primary"
            disabled={busy || !identity}
            aria-label={t("ค้นหา Tote")}
          >
            <ArrowRight size={22} />
          </button>
        </div>
        <small>{t("ยิง QR ด้วยเครื่องสแกน หรือกรอกเลขแล้วกด Enter")}</small>
      </form>
      <UsageGuide />
      {!displayedCodeMatches && (
        <div className="notice draft-warning" role="status">
          {t(
            "หมายเลขในช่องเปลี่ยนแล้ว กรุณากดค้นหาหรือ Enter ก่อนปรับสถานะกล่อง",
          )}
        </div>
      )}
      {busy && (
        <p className="notice" role="status">
          {t("กำลังดำเนินการ…")}
        </p>
      )}
      {error && !review && (
        <div role="alert" className="error space">
          {t(error)}
        </div>
      )}
      {success && (
        <div role="status" className="success space">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {unknown && (
        <section className="panel form">
          <h2>
            <Package size={20} />
            {t("พบรหัสใหม่:")}
            {unknown}
          </h2>
          <p>{t("ยังไม่มี Tote นี้ในระบบ ลงทะเบียนเพื่อเริ่มติดตาม")}</p>
          <button className="primary" disabled={busy} onClick={register}>
            {t("ลงทะเบียน Tote นี้")}
          </button>
        </section>
      )}
      {!tote && !unknown && (
        <div className="empty">
          <ScanLine size={48} />
          <h2>{t("พร้อมรับการสแกน")}</h2>
          <p>
            {t("สถานะ Store ปลายทาง และประวัติ")}
            <br />
            {t("จะแสดงหลังสแกนกล่อง")}
          </p>
        </div>
      )}
      {tote && (
        <>
          <section className="panel tote-card">
            <div className="row">
              <span className="eyebrow">TOTE NUMBER</span>
              <span className={"badge " + tote.status}>
                {t(statusLabel[tote.status])}
              </span>
            </div>
            <h2 className="tote-code">{tote.code}</h2>
            <div className="destination">
              <small>
                {tote.status === "RETURNED"
                  ? t("รับกลับจาก Store")
                  : t("Store ปัจจุบัน")}
              </small>
              <b>
                {tote.status === "READY" ? t("อยู่ที่ HDC · พร้อมส่งรอบใหม่") : [tote.store_code, tote.store_name].filter(Boolean).join(" · ") || t("ไม่ระบุ Store")}
              </b>
            </div>
            <small>
              {t("อัปเดต")}
              {dateTime(tote.updated_at)}
            </small>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => lookup(tote.code)}
            >
              <RefreshCw size={15} />
              {t("โหลดข้อมูลใหม่")}
            </button>
          </section>
          <section className="panel form">
            <h2>
              <Package size={20} />
              {t("ปรับสถานะ Tote")}
            </h2>
            {tote.status === "READY" ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}><label>{t("Store (ไม่บังคับ)")}<input maxLength={160} value={store} onChange={e => setStore(e.target.value)} disabled={busy} placeholder={t("พิมพ์ชื่อหรือรหัส Store")} /></label>
              <label>{t("ทะเบียนรถ")}<input maxLength={40} disabled={busy} value={truckRegistration} onChange={e=>setTruckRegistration(e.target.value)}/></label>
              <label>{t("Order/oLPN")}<input required maxLength={80} disabled={busy} value={orderNumber} onChange={e=>setOrderNumber(e.target.value)}/></label></div>
            ) : (
              <div className="notice">
                {tote.status === "AT_STORE"
                  ? t(
                      "ตรวจสอบ Store เดิม แล้วกดยืนยันเมื่อได้รับกล่องกลับถึง HDC",
                    )
                  : t(
                      "ล้าง Store ปัจจุบันเพื่อเริ่มรอบใหม่ ประวัติและรูปจะยังคงอยู่",
                    )}
              </div>
            )}
            <label>
              {t("หมายเหตุ (ไม่บังคับ)")}
              <textarea
                rows={2}
                maxLength={500}
                disabled={busy}
                placeholder={t("เช่น สภาพกล่อง / รายละเอียดเพิ่มเติม")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </section>
          <section className="panel">
            <div className="row">
              <h2>
                <Camera size={20} />
                {t("ภาพสินค้าใน Tote")}
              </h2>
              <b className="counter">{tote.photos.length} / 6</b>
            </div>
            <p className="hint">
              {tote.status === "READY"
                ? t("รูปบันทึกทันที · สูงสุด 6 รูป · แตะรูปเพื่อดูขนาดใหญ่")
                : t("ดูรูปได้ · จัดการรูปได้เมื่อ Tote พร้อมใช้")}
            </p>
            {tote.status === "READY" && hasPreviousPhotos && (
              <div className="notice">
                {t(
                  "มีภาพจากรอบก่อนอยู่ กรุณาตรวจสอบและลบภาพเก่าก่อนถ่ายชุดใหม่ ภาพที่เหลือจะใช้กับรอบนี้ด้วย",
                )}
              </div>
            )}
            <button
              className="camera-button"
              disabled={
                editingDisabled ||
                tote.status !== "READY" ||
                tote.photos.length >= 6
              }
              onClick={() => cameraInput.current?.click()}
            >
              <Camera size={36} />
              <span>
                {tote.photos.length >= 6
                  ? t("ครบ 6 รูปแล้ว")
                  : t("ถ่ายภาพสินค้า")}
                <small>
                  {tote.photos.length >= 6
                    ? t("ลบรูปเดิมก่อนถ่ายใหม่")
                    : t("แตะเพื่อเปิดกล้อง")}
                </small>
              </span>
            </button>
            <input
              ref={cameraInput}
              className="camera-input"
              aria-label={t("ถ่ายภาพสินค้าใน Tote")}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={
                editingDisabled ||
                tote.status !== "READY" ||
                tote.photos.length >= 6
              }
              onChange={(event) => {
                const slot = [1, 2, 3, 4, 5, 6].find(
                  (value) => !tote.photos.some((photo) => photo.slot === value),
                );
                if (slot) void upload(slot, event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="photos">
              {Array.from({ length: 6 }, (_, index) => {
                const slot = index + 1;
                const photo = tote.photos.find((item) => item.slot === slot);
                const url = `/api/totes/${tote.code}/photos/${slot}?v=${photo?.id || ""}`;
                return (
                  <div className="photo" key={slot}>
                    {photo ? (
                      <>
                        <button
                          className="thumbnail"
                          aria-label={t("ดูรูป {0}", slot)}
                          onClick={() => setPhotoUrl(url)}
                        >
                          <img
                            src={url}
                            alt={t(
                              "ภาพสินค้า Tote {0} ช่อง {1}",
                              tote.code,
                              slot,
                            )}
                          />
                        </button>
                        {tote.status === "READY" && (
                          <button
                            disabled={editingDisabled}
                            className="delete-photo"
                            aria-label={t("ลบรูป {0}", slot)}
                            onClick={() => remove(slot)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <span className="photo-number">{slot}</span>
                      </>
                    ) : (
                      <div className="photo-placeholder">
                        <Camera size={24} />
                        <span>
                          {t("รูปที่")}
                          {slot}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <small>
              {t(
                "การล้างปลายทางไม่ลบรูป หากเริ่มรอบใหม่ให้ลบรูปเก่าก่อนถ่ายเพิ่ม",
              )}
            </small>
          </section>
          <section className="panel">
            <h2>
              <History size={20} />
              {t("ประวัติการใช้งาน")}
            </h2>
            <ol className="timeline">
              {tote.history.map((event) => (
                <li key={event.id}>
                  <b>{t(actionLabel[event.action])}</b>
                  {(event.store_code || event.store_name) && (
                    <p>
                      {[event.store_code, event.store_name].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {event.truck_registration && <p>{event.truck_registration}</p>}
                  {event.order_number && <p>{t("Order/oLPN")}: {event.order_number}</p>}
                  {event.note && <p className="note">{event.note}</p>}
                  <small>
                    {dateTime(event.created_at)} · {event.worker_name}
                  </small>
                </li>
              ))}
            </ol>
          </section>
          <div className="action-bar">
            <button
              className="primary"
              disabled={editingDisabled}
              onClick={prepare}
            >
              {tote.status === "READY"
                ? t("ส่งไป Store")
                : tote.status === "AT_STORE"
                  ? t("รับ Tote กลับ")
                  : t("ล้างปลายทาง · พร้อมใช้ใหม่")}
              <ArrowRight size={20} />
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => resetScan()}
            >
              {t("สแกนกล่องถัดไป")}
            </button>
          </div>
        </>
      )}
      <dialog
        ref={reviewDialog}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setReview(null);
        }}
      >
        <div className="dialog-content">
          <CheckCircle2 size={36} className="blue" />
          <h2>{t("ตรวจสอบก่อนยืนยัน")}</h2>
          {review && (
            <>
              <b className="tote-code">{review.code}</b>
              <p>{t(actionLabel[review.action])}</p>
              <div className="notice">{review.destination}</div>
              <p>{review.truck_registration}</p>
              {review.order_number && <p>{t("Order/oLPN")}: {review.order_number}</p>}
              {review.note && <p>{review.note}</p>}
              {review.action === "RESET" && (
                <small>{t("ล้างเฉพาะปลายทาง ประวัติและรูปยังอยู่")}</small>
              )}
            </>
          )}
          {error && (
            <div role="alert" className="error">
              {t(error)}
            </div>
          )}
          <div className="dialog-actions">
            <button
              disabled={busy}
              onClick={() => {
                setReview(null);
                setError("");
              }}
            >
              {t("กลับไปแก้ไข")}
            </button>
            <button className="primary" disabled={busy} onClick={confirm}>
              {busy ? t("กำลังบันทึก…") : t("ยืนยันบันทึก")}
            </button>
          </div>
        </div>
      </dialog>
      {photoUrl && (
        <PhotoViewer
          key={photoUrl}
          url={photoUrl}
          onClose={() => setPhotoUrl("")}
        />
      )}
    </>
  );
}
