# HDC Tote tracker

รุ่น **1.0.0** · [คู่มือหน้างาน](docs/user-guide.md) · [Deploy / HTTPS / Backup](docs/deployment.md) · [ผลตรวจความพร้อม](docs/release-review.md)

เว็บติดตามกล่อง Tote สำหรับ Handheld Zebra TC22 อิงโครงและหน้าตาจาก `D:/Code/HDC-Container-loading` ใช้ React 19 + TypeScript + Vite + Tailwind CSS 4 + Lucide, FastAPI + psycopg และ PostgreSQL 17 แยกฐานข้อมูลทั่วไปกับฐานข้อมูลภาพ รันด้วย Docker Compose / Nginx

สำหรับติดตั้งครั้งแรก แนะนำ `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Initialize.ps1` เพื่อสร้าง `.env` ด้วยรหัสฐานข้อมูลแบบสุ่มและเตรียมโฟลเดอร์ HDD โดยไม่ทับ `.env` เดิม จากนั้น `docker compose up --build -d --wait --wait-timeout 180` และสร้าง Admin ตามขั้นตอนด้านล่าง

## ขั้นตอนทำงาน

1. ระบุชื่อ–นามสกุลผู้ปฏิบัติงาน
2. สแกน QR เช่น `HDC000001` ถ้ายังไม่มีในระบบให้กดลงทะเบียน Tote
3. ดูสถานะและประวัติเดิม เลือก Store ปลายทาง แนบรูปได้สูงสุด 6 รูป
4. กดส่งไป Store → ตรวจสอบข้อมูล → ยืนยัน เมื่อบันทึกสำเร็จหน้าจอจะล้างข้อมูล Tote/Store/หมายเหตุ และกลับมารอสแกนกล่องถัดไปพร้อมโฟกัสช่อง QR (ชื่อผู้ปฏิบัติงานยังอยู่) หากบันทึกไม่สำเร็จข้อมูลจะคงไว้ให้ลองใหม่
5. เมื่อ Tote กลับถึง HDC สแกนรหัสเดิม → ตรวจสอบ Store ที่ส่งไป → ยืนยันรับกลับ
6. กดล้างปลายทาง → ยืนยัน เพื่อเปลี่ยนเป็นพร้อมใช้งานในรอบถัดไป ประวัติเดิมยังอยู่

สถานะ: `READY → AT_STORE → RETURNED → READY` ไม่สามารถข้ามลำดับหรือส่งซ้ำขณะ Tote ยังอยู่ที่ Store

รูปเป็น **6 ช่องรวมต่อ Tote** ไม่ใช่ 6 รูปต่อเหตุการณ์ จัดการรูปได้เมื่อ READY และบันทึกทันทีเมื่ออัปโหลด การล้างปลายทางไม่ลบรูป ให้ลบรูปเก่าก่อนถ่ายชุดใหม่ ภาพที่ลบจะไม่อยู่ในประวัติ ส่วนประวัติการเปลี่ยนสถานะและ Store เก็บต่อเนื่อง รูปไม่บังคับก่อนส่ง

ไม่มีข้อมูลทะเบียนรถ, OCR, Trip, Shipment หรือ Pallet ในโปรเจคนี้

## เริ่มระบบบน Windows / Docker Desktop

ใช้ Linux containers / WSL 2 เก็บ Docker Desktop และ disk image ไว้ C: ได้ ฐานข้อมูลทั้งสองตัว bind mount ลง HDD ตามนี้:

| ข้อมูล | ตำแหน่งบนเครื่อง |
| --- | --- |
| Tote, สถานะ, ประวัติ, Store, session | `D:/HDC-Data/HDC-Tote-Tracker-data/postgres-app/` |
| รูปภาพ JPEG และ metadata ภาพ | `D:/HDC-Data/HDC-Tote-Tracker-data/postgres-images/` |

รูปเก็บเป็น BYTEA ใน PostgreSQL ไม่ใช่ไฟล์ JPG แยกในโฟลเดอร์ อ่านรายละเอียดได้ที่ [docs/storage.md](docs/storage.md)

```powershell
# รันจาก D:\Code\HDC-Tote-tracker
# ถ้ามี .env อยู่แล้วให้ใช้ไฟล์เดิม ไม่คัดลอกทับ
Copy-Item .env.example .env
# แก้ APP_DB_PASSWORD และ IMAGE_DB_PASSWORD ให้เป็นรหัสผ่านเฉพาะระบบก่อนเริ่ม
New-Item -ItemType Directory -Force 'D:\HDC-Data\HDC-Tote-Tracker-data\postgres-app', 'D:\HDC-Data\HDC-Tote-Tracker-data\postgres-images'
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

เปิด **http://localhost:8081** จาก Handheld ใช้ `http://<IP-เครื่องเซิร์ฟเวอร์>:8081` ใน LAN (อนุญาตพอร์ต 8081 ใน firewall ตามเครือข่ายที่ใช้งาน)

สร้างผู้ดูแลครั้งแรก แล้วเข้าสู่ `/admin/login` เพื่อเพิ่ม Store จริง:

```powershell
docker compose exec api python -m app.manage create-admin
```

รหัสผ่าน Admin ยาว 1–200 ตัว ไม่มีบัญชีหรือ Store เริ่มต้น พนักงานระบุชื่อโดยไม่ใช้รหัสผ่านเหมือนต้นแบบ จึงเป็นเพียงชื่อผู้บันทึก ไม่ใช่การยืนยันตัวบุคคล ผู้ดูแลใช้รหัสผ่าน scrypt และ HttpOnly cookie

ชื่อผู้ปฏิบัติงานใหม่จะบันทึกลงฐานข้อมูลเมื่อเริ่มทำงาน ครั้งถัดไปพิมพ์อย่างน้อย 3 ตัวอักษรเพื่อแสดงรายชื่อที่ตรงกัน เลือกชื่อด้วยการแตะหรือปุ่มลูกศรและ Enter ระบบเติมชื่อเต็มและใช้ข้อมูลคนเดิม ไม่สร้างชื่อซ้ำเมื่อกลับมาใช้งาน

หน้า Store / Tote ของผู้ดูแลลบรายการได้ โดย popup ต้องพิมพ์ `DELETE รหัสรายการ` ให้ตรงก่อนกดยืนยัน ลบ Store แล้วจะหายจากรายการแต่ประวัติ Store เดิมยังอยู่ ส่วนลบ Tote จะลบทั้งประวัติและรูปของ Tote ถาวร หากเพิ่มรหัส Store เดิมอีกครั้งจะเปิดรายการนั้นกลับมา

ช่องบังคับกรอกเป็นสีเหลือง ช่องอื่นเป็นสีเทาอ่อน ปุ่มกล้องสีแดงในหมวดภาพสินค้าเปิดกล้องและบันทึกรูปลงช่องว่างถัดไป สูงสุด 6 รูป

แตะรูปเพื่อเปิดตัวดูภาพ ซูมได้ 100–400% ด้วยปุ่ม +/−, ล้อเมาส์ หรือกางสองนิ้ว ลากเพื่อเลื่อนภาพ และกดพอดีจอเพื่อคืนขนาด หน้าภาพรวมแสดง Donut chart เปรียบเทียบจำนวนและเปอร์เซ็นต์ Tote แต่ละสถานะจากจำนวนทั้งหมดในระบบ แตะรายการสถานะใต้กราฟเพื่อกรองรายการ Tote ด้านล่าง กราฟยังแสดงสัดส่วนทั้งหมดแม้ค้นหาหรือกรองรายการ

## Zebra TC22

หน้า `/scan` รับค่าจากเครื่องสแกนผ่าน input ใน browser ให้ตั้ง DataWedge profile ของ browser ที่ใช้เป็น Keystroke output และส่ง Enter หลังรหัส แตะช่อง QR ให้มี focus ก่อนยิงสแกน รับรูปแบบ `HDC` + ตัวเลขอย่างน้อย 1 หลัก เช่น `HDC1`, `HDC1234567` (รวมสูงสุด 100 ตัวอักษร) และแปลงตัวพิมพ์เล็กเป็นใหญ่ก่อนค้นหา

ถ่ายภาพใช้ file input ที่ระบุ `capture="environment"` เพื่อเรียกกล้องหลัง ขึ้นกับ browser/Android ที่ใช้งาน รองรับ JPEG/PNG/WebP ขนาดไม่เกิน 8 MB ต่อไฟล์ Backend ตรวจและแปลง JPEG, ปรับด้านยาวไม่เกิน 1600 px

ต้องทดสอบ DataWedge, กล้อง และ touch target บน TC22 จริงก่อนใช้งานหน้างาน ระบบต้องออนไลน์ ไม่มี offline queue ในโครงรุ่นนี้

## HTTPS

ตั้ง reverse proxy พร้อม certificate ที่ TC22 เชื่อถือ และ `COOKIE_SECURE=true` เมื่อเปิดใช้งานผ่าน HTTPS แล้ว เช่น Caddy / Nginx ที่ส่งต่อไป `localhost:8081` พอร์ต Docker สำหรับแอพยังเป็น 8081 การสแกนฮาร์ดแวร์ไม่ใช้ OCR หรือกล้องอ่าน QR ใน browser

## พัฒนาและทดสอบ

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
npm.cmd run build
```

Vite proxy `/api` ไป `http://localhost:8000` ถ้ารัน Backend โดยตรงให้กำหนด `APP_DATABASE_URL` และ `IMAGE_DATABASE_URL` ของฐานข้อมูล dev แยกจากข้อมูลจริง แล้วรัน `python -m app.migrate` และ `uvicorn app.main:app --host 0.0.0.0 --port 8000` จาก `backend/`

Integration tests ใช้ PostgreSQL ชั่วคราวแยก project/network ไม่มี mount ไป `D:/HDC-Data`:

```powershell
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f compose.test.yaml down
```

ทดสอบ UI ขนาด 360×720 หลังเปิดระบบที่ 8081 แล้ว (ใช้ Chrome ที่ติดตั้งในเครื่อง):

```powershell
cd frontend
npm.cmd run test:ui
```

UI test ตรวจหน้าจอจริงและ `/api/ready` ส่วนขั้นตอนรับส่งใน UI ใช้ API fixture เพื่อไม่สร้าง Tote/Store ทดสอบในฐานข้อมูลหลัก การทดสอบ Backend ข้างต้นใช้ PostgreSQL จริง

มี CI บน GitHub สำหรับ build, dependency audit, PostgreSQL integration tests, UI และ accessibility checks โดยใช้ฐานข้อมูลชั่วคราวบน runner ไม่มีการใช้ข้อมูลจาก HDD ของเซิร์ฟเวอร์ Runtime Python ตรึงเวอร์ชันใน `backend/requirements.lock` ส่วนฟอนต์ Sarabun รวมในตัวเว็บเพื่อไม่ต้องออกอินเทอร์เน็ตตอนใช้งาน

ทดสอบวงจรรับส่ง, ประวัติ, การส่งคำขอซ้ำ, หลายเครื่องเปลี่ยนสถานะพร้อมกัน, Store ปิดใช้งาน, รูปสูงสุด 6 ช่อง, ไฟล์ผิดรูปแบบ/ขนาด, สิทธิ์ผู้ดูแล และ cross-origin request

## โครงสร้าง

```text
frontend/src/
  components/         Header / Clock / Layout
  pages/              Entry / Scan / Dashboard / Admin & Store
  lib/api.ts          API client และชนิดข้อมูล
  styles/app.css      หน้าตา Handheld อิง CI ต้นแบบ
backend/app/
  api/                Validation, endpoints และ state transitions
  core/               Configuration / session / security
  db/                 PostgreSQL connection แยกสองฐาน
  services/images.py  ตรวจและแปลงภาพ
  migrate.py          Versioned SQL migrations
  manage.py           สร้าง Admin ผ่าน CLI
backend/migrations/   Schema ของ app และ images
backend/tests/        Integration tests บน PostgreSQL จริง
docs/                 โครงข้อมูลและการเก็บข้อมูล
compose.yaml          ระบบหลัก พอร์ต 8081 / ฐานข้อมูลบน D:
compose.test.yaml     ระบบทดสอบชั่วคราว
```

รายละเอียด state machine และ API: [docs/architecture.md](docs/architecture.md)
