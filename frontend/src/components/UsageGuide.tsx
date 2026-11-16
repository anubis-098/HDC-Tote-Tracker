import { t, useLanguage, locale } from "../lib/i18n";
import { CircleHelp } from "lucide-react";

export function UsageGuide() {
  useLanguage();
  return (
    <details className="usage-guide">
      <summary>
        <CircleHelp size={18} />
        {t("วิธีใช้งาน · เริ่มตรงไหน?")}
      </summary>
      <ol>
        <li>
          {t("แตะช่องสีเหลือง แล้วยิง QR บนกล่อง หรือกรอกเลขและกด Enter")}
        </li>
        <li>
          <b>{t("พร้อมใช้งาน:")}</b>
          {t("เลือก Store ปลายทาง ถ่ายรูปได้สูงสุด 6 รูป แล้วกดส่งไป Store")}
        </li>
        <li>
          <b>{t("ส่งไป Store:")}</b>
          {t(
            "เมื่อกล่องกลับถึง HDC ให้สแกน ตรวจ Store เดิม แล้วกดรับ Tote กลับ",
          )}
        </li>
        <li>
          <b>{t("รับกลับแล้ว:")}</b>
          {t("กดล้างปลายทางเพื่อพร้อมใช้รอบใหม่ ประวัติเดิมยังอยู่")}
        </li>
      </ol>
      <p>
        {t(
          "รูปบันทึกทันที · รูปไม่บังคับก่อนส่ง · ถ้ามีรูปเก่าให้ลบก่อนถ่ายรอบใหม่",
        )}
      </p>
      <p>{t("สีเหลือง = ช่องที่ต้องกรอก · สีเทา = ช่องอื่น ๆ")}</p>
    </details>
  );
}
