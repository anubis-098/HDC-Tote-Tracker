import { CircleHelp } from 'lucide-react';

export function UsageGuide() {
  return <details className="usage-guide">
    <summary><CircleHelp size={18} />วิธีใช้งาน · เริ่มตรงไหน?</summary>
    <ol><li>แตะช่องสีเหลือง แล้วยิง QR บนกล่อง หรือกรอกเลขและกด Enter</li>
      <li><b>พร้อมใช้งาน:</b> เลือก Store ปลายทาง ถ่ายรูปได้สูงสุด 6 รูป แล้วกดส่งไป Store</li>
      <li><b>ส่งไป Store:</b> เมื่อกล่องกลับถึง HDC ให้สแกน ตรวจ Store เดิม แล้วกดรับ Tote กลับ</li>
      <li><b>รับกลับแล้ว:</b> กดล้างปลายทางเพื่อพร้อมใช้รอบใหม่ ประวัติเดิมยังอยู่</li></ol>
    <p>รูปบันทึกทันที · รูปไม่บังคับก่อนส่ง · ถ้ามีรูปเก่าให้ลบก่อนถ่ายรอบใหม่</p>
    <p>สีเหลือง = ช่องที่ต้องกรอก · สีเทา = ช่องอื่น ๆ</p>
  </details>;
}
