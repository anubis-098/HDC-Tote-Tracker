# Docker บน C: และข้อมูลบน HDD D:

`compose.yaml` ใช้ bind mount แยกจากต้นแบบทั้งหมด ไม่มี volume หรือฐานข้อมูลร่วมกับ Container Loading

| Container | ที่เก็บบน Host | Mount ใน Container |
| --- | --- | --- |
| postgres-app | D:/HDC-Data/HDC-Tote-Tracker-data/postgres-app | /var/lib/postgresql/data |
| postgres-images | D:/HDC-Data/HDC-Tote-Tracker-data/postgres-images | /var/lib/postgresql/data |

Docker Desktop, image, build cache และ writable layer ของ container ยังอยู่ที่ disk image ของ Docker Desktop (C: ตามการตั้งค่าของเครื่อง) โปรเจคนี้ไม่ย้าย disk image หรือเปลี่ยนค่า Docker Desktop

สร้างโฟลเดอร์ก่อน `docker compose up` ทั้งสอง mount ระบุ `create_host_path: false` หาก HDD/path ไม่พร้อมให้ระบบหยุดแทนการสร้างปลายทางเปล่าโดยเงียบ ๆ ค่า path เปลี่ยนได้ใน `.env` ผ่าน `APP_DATA_PATH`, `IMAGE_DATA_PATH`

ภาพเป็น BYTEA ในฐาน `tote_images` ไม่ปรากฏเป็น JPG แยกบน HDD ส่วนฐาน `tote_app` เก็บ Tote / history / Store / session การล้าง Store ในหน้าเว็บไม่ลบโฟลเดอร์หรือประวัติ

## สำรองข้อมูล

แนะนำใช้ `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Backup.ps1` ซึ่งหยุดการเขียนชั่วคราว สร้าง snapshot ชื่อไม่ซ้ำ พร้อม manifest และ checksum และเปิดบริการเดิมกลับมา จากนั้นตรวจ restore แบบแยกชุดได้ด้วย `python scripts/verify_restore.py <โฟลเดอร์ snapshot>` (ใช้ Python 3.11 ขึ้นไปบนเครื่องที่เรียก Docker ได้) รายละเอียดใน [deployment.md](deployment.md)

ใช้ `pg_dump` สำรองแต่ละฐาน และทดสอบ restore หลีกเลี่ยงคัดลอกไฟล์ PostgreSQL ขณะฐานข้อมูลกำลังทำงาน ตัวอย่างสร้าง dump ใน container ก่อนคัดลอก (หลีกเลี่ยง PowerShell redirect binary):

```powershell
New-Item -ItemType Directory -Force D:\HDC-Data\HDC-Tote-Tracker-data\backups
docker compose exec -T postgres-app pg_dump -U tote -d tote_app -Fc -f /tmp/tote-app.dump
docker compose cp postgres-app:/tmp/tote-app.dump D:/HDC-Data/HDC-Tote-Tracker-data/backups/tote-app.dump
docker compose exec -T postgres-images pg_dump -U images -d tote_images -Fc -f /tmp/tote-images.dump
docker compose cp postgres-images:/tmp/tote-images.dump D:/HDC-Data/HDC-Tote-Tracker-data/backups/tote-images.dump
```

แต่ละคำสั่งตัวอย่างใช้ชื่อไฟล์เดิม ควรตั้งชื่อวันที่และสำรองออกนอก HDD อีกชุด หยุดการแก้ข้อมูลระหว่างสำรองทั้งสองฐานหากต้องการชุดที่ตรงเวลากัน

หากเปลี่ยน path ภายหลัง ให้ dump/restore และตรวจสอบข้อมูลก่อนใช้งาน path ใหม่ การเปลี่ยน bind mount ไม่ย้ายข้อมูลให้เอง โครงไม่มีงานลบรูปหรือ archive อัตโนมัติ

การ bind mount PostgreSQL ลง Windows HDD ใช้รูปแบบเดียวกับต้นแบบ ประสิทธิภาพขึ้นกับ filesystem และ Docker Desktop file sharing หากข้อมูลโตควรประเมิน Linux filesystem บน HDD อีกครั้ง โดยไม่ย้าย Docker Desktop ทั้งชุดออกจาก C:
