# Deploy บน Windows / Docker Desktop

## ติดตั้งครั้งแรก

ใช้ Docker Desktop แบบ Linux containers / WSL 2 เก็บ Docker disk image บน C: และข้อมูลแอพบน HDD D: ตามที่กำหนด

```powershell
git clone https://github.com/anubis-098/HDC-Tote-Tracker.git D:\Code\HDC-Tote-tracker
cd D:\Code\HDC-Tote-tracker
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Initialize.ps1
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
docker compose exec api python -m app.manage create-admin
```

Initialize สร้างรหัสผ่านฐานข้อมูลแบบสุ่มใน `.env` และโฟลเดอร์ HDD ถ้ามี `.env` อยู่แล้วจะเก็บไฟล์เดิมไว้ ไม่เปลี่ยนข้อมูล Docker Desktop `ExecutionPolicy Bypass` ในคำสั่งใช้กับ process นี้เท่านั้น ไม่แก้ policy ถาวรของเครื่อง

เปิด `http://localhost:8081` → เข้าระบบ Admin → เพิ่ม Store → เปิดจาก TC22 ที่ `http://<IP-server>:8081` และตั้ง DataWedge ตาม [คู่มือหน้างาน](user-guide.md)

แอพใช้การระบุชื่อพนักงานโดยไม่มีรหัสผ่านตาม workflow ที่ตกลง เหมาะกับเครือข่ายภายในที่ควบคุมผู้เข้าถึง หากต้องเข้าจากภายนอกให้ผ่าน VPN หรือชั้นควบคุมการเข้าถึงขององค์กร การเปิด HTTPS อย่างเดียวไม่ยืนยันตัวบุคคลของพนักงาน

## HTTPS

เมื่อมีโดเมนชี้มาที่เซิร์ฟเวอร์และเปิด 80/443 ให้เพิ่มใน `.env`:

```dotenv
APP_DOMAIN=totes.example.com
COOKIE_SECURE=true
```

```powershell
docker compose -f compose.yaml -f compose.https.yaml config --quiet
docker compose -f compose.yaml -f compose.https.yaml up --build -d --wait --wait-timeout 180
```

Caddy ขอ certificate สำหรับโดเมนที่กำหนดโดยอัตโนมัติ จากนั้นใช้ URL HTTPS บน TC22 ปอร์ตแอพ 8081 ยังคงเดิม แต่เมื่อ COOKIE_SECURE=true จะเข้าระบบผ่าน HTTP ไม่ได้ ให้ควบคุม 8081 ด้วย firewall ตามเครือข่ายที่อนุญาต สำหรับโดเมนภายใน ให้ใช้ reverse proxy / certificate ขององค์กรที่ TC22 เชื่อถือ

## อัปเดตและ rollback

1. เลือกช่วงหยุดงานชั่วคราว แล้วสำรองข้อมูลก่อนอัปเดต
2. เก็บ Git commit และ image ID ปัจจุบันสำหรับ rollback
3. ดึงโค้ด รัน build/test และอัปเดต Compose
4. ตรวจ ready, health และทดลองกับ TC22 ก่อนเริ่มกะ

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Backup.ps1
git pull --ff-only
docker compose up --build -d --wait --wait-timeout 180
docker compose ps
Invoke-RestMethod http://localhost:8081/api/ready
docker compose logs --tail 60 api frontend
```

ใช้ไฟล์ compose.https.yaml ร่วมทุกครั้งหากติดตั้งผ่าน HTTPS Script Backup หยุด API/Frontend ชั่วคราวเพื่อเก็บ dump ทั้งสองฐานในช่วงที่ไม่มีการแก้ข้อมูล แล้วเปิดเฉพาะบริการที่เคยทำงานกลับมา พร้อม manifest จำนวนรายการ ขนาดไฟล์ และ SHA256 ชื่อโฟลเดอร์ไม่ซ้ำตามเวลา เก็บ backup อีกชุดนอก HDD ด้วย

SQL migrations เป็นแบบมี version และไม่ลบข้อมูลที่มีอยู่ หากย้อนเวอร์ชันที่ schema ไม่เข้ากัน ให้ restore backup ทั้งสองฐานเข้าฐานใหม่ที่แยกจากข้อมูลจริง แล้วตรวจสอบก่อนสลับ path ไม่ควรเปลี่ยน path ไปฐานเปล่าแล้วถือว่าเป็นการย้ายข้อมูล

## ตรวจ restore ก่อนใช้งานจริง

นำ dump ทั้งสองเข้า PostgreSQL 17 ชุดทดสอบแยก แล้วใช้ `pg_restore --exit-on-error --no-owner --no-privileges` ตรวจจำนวน Tote/event/Store/worker/photo กับ manifest ตรวจ hash ของภาพกับค่า sha256 ในฐาน และทดลองเปิดภาพก่อนลบชุดทดสอบ ห้ามทดลอง restore ทับฐานที่กำลังใช้งาน

## การดูแล

- `/api/ready` ตรวจเชื่อมต่อฐานข้อมูลทั้งสอง; `/healthz` ตรวจ Nginx; Docker มี healthcheck ทั้ง 4 บริการ
- สำรองตามรอบงานจริงและติดตามพื้นที่ HDD ผ่านเครื่องมือเซิร์ฟเวอร์
- รัน `npm audit` และ `pip-audit -r requirements.lock` ในสภาพแวดล้อมทดสอบก่อนอัปเดตแพ็กเกจ
- Runtime Python ล็อกเวอร์ชันใน requirements.lock และ Frontend ล็อกใน package-lock.json
- งานลบรูปจาก Tote ที่ถูกลบจะอยู่ในคิว durable และลองใหม่ทุก 60 วินาทีหากฐานภาพขัดข้อง ข้อมูล Tote จะไม่กลับมาให้เห็น และลงทะเบียนรหัสเดิมได้เมื่อเคลียร์รูปเก่าสำเร็จ
- ไม่ส่ง `.env`, dump, credential หรือข้อมูลจริงเข้า GitHub

## ก่อนเปิดใช้หน้างาน

ต้องตรวจบน TC22 จริง: DataWedge keyboard + Enter, กล้องหลัง/สิทธิ์กล้อง, pinch zoom, Wi-Fi ของพื้นที่, certificate และการรับส่งกล่องหนึ่งรอบ ทดสอบอัตโนมัติบน Chrome ช่วยยืนยันเว็บ แต่ไม่แทนการตรวจอุปกรณ์จริง
