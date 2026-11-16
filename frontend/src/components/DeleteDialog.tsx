import { t, useLanguage, locale } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { message } from "../lib/api";

export interface DeleteTarget {
  kind: "stores" | "totes";
  code: string;
  label: string;
}
export function DeleteDialog({
  target,
  onClose,
  onDelete,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onDelete: (confirmation: string) => Promise<void>;
}) {
  useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expected = `DELETE ${target.code}`;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (text !== expected || busy) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(text);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form className="dialog-content form" onSubmit={submit}>
        <Trash2 size={36} className="red" />
        <h2 id="delete-title">
          {t("ยืนยันการลบ")}
          {target.kind === "stores" ? "Store" : "Tote"}
        </h2>
        <b>{target.label}</b>
        <p>
          {target.kind === "stores"
            ? t(
                "Store จะถูกนำออกจากรายการเลือกและหน้าจัดการ ประวัติและข้อมูล Store ของ Tote ที่เคยส่งไปยังอยู่",
              )
            : t(
                "Tote พร้อมประวัติและรูปภาพทั้งหมดจะถูกลบถาวร และไม่สามารถกู้คืนผ่านหน้าเว็บได้",
              )}
        </p>
        <label htmlFor="delete-confirmation">
          {t("พิมพ์")}
          <strong>{expected}</strong>
          {t("เพื่อยืนยัน")}
        </label>
        <input
          id="delete-confirmation"
          required
          autoComplete="off"
          spellCheck={false}
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        {error && (
          <div role="alert" className="error">
            {t(error)}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            {t("ยกเลิก")}
          </button>
          <button className="danger" disabled={busy || text !== expected}>
            {busy ? t("กำลังลบ…") : t("ยืนยันลบ")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
