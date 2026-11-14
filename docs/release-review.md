# ผลตรวจความพร้อม HDC Tote tracker 1.0.0

ตรวจวันที่ 14 พฤศจิกายน 2026 จาก source, PostgreSQL integration tests, Chrome ขนาด 360×720, automated accessibility audit และ Docker บนเครื่อง Windows นี้

## ข้อสรุป

Workflow สอดคล้องกับการใช้ Tote ซ้ำ: รหัสกล่องคงเดิม, Store บังคับตอนส่ง, ไม่ข้ามสถานะ, การรับกลับแยกจากล้างปลายทาง และเก็บประวัติ Store เดิมไว้ การล้างหน้าสแกนหลังส่งเป็นเพียงการล้างฟอร์ม ไม่ล้างข้อมูลกล่องในฐานข้อมูล

ผ่านการตรวจซอฟต์แวร์สำหรับเตรียม deploy ในเครือข่ายภายในตามขอบเขตปัจจุบัน ก่อนเปิดหน้างานยังต้องทดสอบ TC22, DataWedge, กล้อง, Wi-Fi และ HTTPS/certificate ของสถานที่จริง ระบบชื่อพนักงานเป็นการระบุชื่อ ไม่ใช่การยืนยันตัวบุคคล

## จุดที่พบและแก้

| ระดับ | จุดที่พบ | ผลหลังแก้ |
| --- | --- | --- |
| สูง | สองเครื่องอัปโหลดคนละภาพลงช่องเดียวกันอาจทับกัน | เก็บภาพแรก ปฏิเสธภาพต่างกันด้วย 409; retry ภาพเดิมไม่สร้างรูปใหม่ |
| สูง | การลบ Tote กับฐานภาพไม่มี transaction ร่วมกัน | Durable cleanup queue พร้อม metadata transaction; retry ทุก 60 วินาที; ตรวจการมีอยู่ของ Tote ก่อนอ่านรูป |
| สูง | การลบรูปจากหน้าจอเก่าอาจลบรูปที่เพิ่งแทนช่องเดิม | ตรวจทั้ง expected_version และ expected_photo_id |
| สูง | Pillow รุ่นเดิมมี advisory ที่ dependency audit รายงาน | อัปเกรด 13.0.0 และล็อก runtime dependencies; audit ซ้ำไม่พบ advisory ที่รายงาน |
| กลาง | request_id เดียวกันแข่งกันข้ามกล่องอาจเกิด unique violation | ล็อก request_id ก่อนทำงาน ได้ผล 200/409 ตามข้อมูล |
| กลาง | แก้เลข QR ในช่องแล้วปุ่มเดิมยังปรับกล่องก่อนหน้าได้ | ปิดการแก้ไข/ส่ง/ถ่ายรูปจนกดค้นหารหัสที่ตรงกับข้อมูล |
| กลาง | ค้นหาใหม่/ออกผ่านเมนูอาจทิ้ง Store หรือหมายเหตุที่ยังไม่ยืนยัน | เตือนก่อนค้นหา/โหลดใหม่/ออกผ่านเมนู และก่อนปิดหรือ reload browser |
| กลาง | รอ network โดยไม่มีกำหนด | Timeout 30 วินาทีสำหรับ API ทั่วไป และ 90 วินาทีสำหรับ upload; ข้อมูลยืนยันเดิมยังอยู่ให้ retry |
| กลาง | ยอดนับและรายการอาจอ่านคนละช่วงขณะมีการเปลี่ยนสถานะ | Dashboard อ่าน snapshot เดียวกัน และปรับเลขหน้าหากจำนวนรายการลดลง |
| กลาง | ข้อความบางส่วนจางและ label ของนาฬิกาไม่เหมาะกับ screen reader | ปรับ contrast, touch target และ ARIA; automated audit ของหน้าหลักไม่พบ serious/critical violations |
| กลาง | ฟอนต์พึ่ง Google Fonts ตอนเปิดเว็บใน LAN | รวม Sarabun ใน build; ทดสอบว่าไม่ร้องขอฟอนต์ภายนอก |
| กลาง | ขาดขั้นตอน recovery/deploy ที่ทดสอบได้ | เพิ่ม Initialize, Backup, isolated restore verifier, HTTPS override และ CI |

Pillow: [official release notes 13.0.0](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html)

## ผลทดสอบ

| การตรวจ | ผล |
| --- | --- |
| TypeScript + Vite production build | ผ่านทั้ง local และ Docker |
| PostgreSQL integration tests | 20 ผ่าน: workflow, history, auth, store deletion, image validation, concurrency, idempotency, migration และ image DB outage |
| Playwright UI / UX / accessibility | 10 ผ่าน: scan reset, retry, camera, pinch zoom, pan, Donut, suggestions, typed deletion, draft guard, security headers และ offline notice |
| Axe WCAG 2 A/AA automated scan | หน้าหลัก 5 หน้าไม่พบ serious/critical violations; ไม่ใช่การรับรอง accessibility ทุกกรณี |
| npm audit | ไม่พบ known vulnerabilities ณ เวลาตรวจ |
| pip-audit requirements.lock | ไม่พบ known vulnerabilities ณ เวลาตรวจ |
| Docker health | frontend / api / postgres-app / postgres-images healthy |
| API privilege | รันด้วย user app ไม่ใช่ root |
| Compose และ Caddy HTTPS config | validate ผ่าน; ยังไม่ได้ออก certificate ของโดเมนหน้างาน |
| Backup / restore rehearsal | restore dump ทั้งสองใน PostgreSQL ชั่วคราวที่แยกเครือข่าย; counts และ SHA256 ของภาพตรงกับ manifest |

UI tests ใช้ fixture สำหรับข้อมูลธุรกิจเพื่อไม่เขียนข้อมูลทดสอบลงฐานจริง ส่วน integration tests ใช้ PostgreSQL จริงแยก project / tmpfs ทั้งหมด การทดสอบ restore ไม่แก้ฐานข้อมูลจริง Backup เก็บภายนอก repository บน HDD ตามที่ตั้งไว้

## ขอบเขตที่ยังต้องดูแล

- TC22 จริงและเครือข่ายหน้างานยังไม่ได้ทดสอบใน session นี้
- พนักงานไม่มีรหัสผ่านตามข้อกำหนด ใช้เครือข่ายภายใน/VPN หรือ access control ขององค์กรก่อนเปิดจากภายนอก
- ไม่รองรับ offline sync เต็มรูปแบบ มีข้อความบอกสถานะเครือข่ายและ retry ของคำขอยืนยัน
- รูปเป็นชุดปัจจุบัน 6 รูปต่อกล่อง ไม่ใช่อัลบั้มแยกทุกรอบ รูปเก่าจะแสดงคำเตือนหลังล้างปลายทาง
- ต้องกำหนดผู้ดูแลและรอบ backup/off-host backup รวมถึงทดสอบ restore ตามรอบขององค์กร
- ยังไม่ได้ load test ตามจำนวน Handheld/ปริมาณรูปจริง และยังไม่รองรับ multi-instance แบบมี shared rate limiter
- CI ที่เพิ่มใน GitHub ตรวจ build, audits, API และ UI บน runner ชั่วคราว ผลแต่ละ commit ดูได้ในแท็บ Actions

ขั้นตอนใช้งาน: [user-guide.md](user-guide.md) · การติดตั้ง/อัปเดต/สำรอง: [deployment.md](deployment.md)
