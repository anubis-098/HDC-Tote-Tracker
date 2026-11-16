import { t, useLanguage, locale } from "../lib/i18n";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ScanLine,
  PackageCheck,
  History,
  UserRound,
  LockKeyhole,
} from "lucide-react";
import { api, message, type Identity } from "../lib/api";
import { WorkerNameField } from "../components/WorkerNameField";

export function EntryPage() {
  useLanguage();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Identity | null>(null);
  useEffect(() => {
    api<Identity>("/worker/me")
      .then((user) => {
        setExisting(user);
        setName(user.name);
      })
      .catch(() => {});
  }, []);
  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/worker/session", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      navigate("/scan");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="intro">
        <span className="eyebrow">
          <PackageCheck size={16} /> TOTE OPERATIONS
        </span>
        <h1>{t("ทุกกล่อง ติดตามได้")}</h1>
        <p>
          {t("สแกน QR เพื่อส่ง Tote ไป Store รับกลับ")}
          <br />
          {t("และเตรียมพร้อมสำหรับรอบถัดไป")}
        </p>
        <ol className="workflow">
          <li>
            <ScanLine size={20} />
            {t("สแกน QR")}
          </li>
          <li>
            <PackageCheck size={20} />
            {t("ปรับสถานะ")}
          </li>
          <li>
            <History size={20} />
            {t("ดูประวัติ")}
          </li>
        </ol>
      </div>
      <form className="panel form" onSubmit={start}>
        <h2>
          <UserRound size={20} />
          {t("ผู้ปฏิบัติงาน")}
        </h2>
        <WorkerNameField value={name} onChange={setName} disabled={busy} />
        {error && (
          <div role="alert" className="error">
            {t(error)}
          </div>
        )}
        <button className="primary" disabled={busy || name.trim().length < 2}>
          {busy ? t("กำลังเข้าสู่ระบบ…") : t("เริ่มติดตาม Tote")}
          <ArrowRight size={20} />
        </button>
        <small>{t("ชื่อใช้ระบุผู้บันทึก ไม่ใช่การยืนยันตัวบุคคล")}</small>
        {existing && (
          <Link to="/scan">
            {t("ทำงานต่อในชื่อ")}
            {existing.name} →
          </Link>
        )}
      </form>
      <Link className="admin-entry panel" to="/admin/login">
        <LockKeyhole size={24} />
        <span>
          <b>{t("เข้าสู่ระบบผู้ดูแล")}</b>
          <small>{t("ภาพรวมและจัดการ Store")}</small>
        </span>
        <ArrowRight size={20} />
      </Link>
    </>
  );
}
