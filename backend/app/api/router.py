from collections import defaultdict, deque
from time import monotonic
from threading import Lock
from uuid import UUID, uuid4
from fastapi import Form, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Query
from psycopg.types.json import Jsonb
from app.api.schemas import WorkerInput, LoginInput, StoreInput, ToteInput, TransitionInput, DeleteInput
from app.core.security import worker, admin, actor, create_session, password_matches, password_hash
from app.db.connection import connect
from app.services.images import normalize_image
from app.services.cleanup import cleanup_for_code, try_cleanup_photos

router = APIRouter()
_login_attempts = defaultdict(deque)
_login_lock = Lock()
_dummy_password = password_hash('timing-only-not-an-account')

@router.get('/health')
def health():
    return {'status': 'ok'}

@router.get('/ready')
def ready():
    for images in (False, True):
        with connect(images) as conn:
            conn.execute('SELECT 1')
    return {'status': 'ready'}

@router.post('/worker/session')
def worker_login(body: WorkerInput, request: Request, response: Response):
    try:
        current = worker(request)
    except HTTPException:
        current = None
    with connect() as conn:
        if current and current['name'] == body.name:
            return current
        person = conn.execute('INSERT INTO workers(id,name) VALUES (%s,%s) ON CONFLICT (lower(btrim(name))) DO UPDATE SET name=workers.name RETURNING id,name', (uuid4(), body.name)).fetchone()
        create_session(conn, response, person['id'], 'worker')
        return {**person, 'role': 'worker'}


@router.get('/workers/suggestions')
def worker_suggestions(q: str = Query(min_length=3, max_length=160)):
    if len(q.strip()) < 3:
        return []
    with connect() as conn:
        return conn.execute('SELECT name FROM workers WHERE strpos(lower(name),lower(%s))>0 ORDER BY name LIMIT 20', (q.strip(),)).fetchall()

@router.get('/worker/me')
def worker_me(who=Depends(worker)):
    return who

@router.post('/admin/login')
def login(body: LoginInput, request: Request, response: Response):
    now = monotonic()
    # Single API process; attempts expire after 15 minutes. Proxy overwrites this header.
    ip = request.headers.get('x-real-ip', request.client.host if request.client else 'unknown')
    with _login_lock:
        for key in list(_login_attempts):
            if not _login_attempts[key] or now - _login_attempts[key][-1] > 900:
                del _login_attempts[key]
        attempts = _login_attempts[ip]
        while attempts and now-attempts[0]>900:
            attempts.popleft()
        if len(attempts)>=10:
            raise HTTPException(429, 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที')
        attempts.append(now)
    with connect() as conn:
        account = conn.execute('SELECT * FROM admins WHERE username=%s', (body.username.strip().lower(),)).fetchone()
        valid = password_matches(body.password, account['password_hash'] if account else _dummy_password)
        if not account or not valid:
            raise HTTPException(401, 'ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง')
        create_session(conn, response, account['id'], 'admin')
        return {'name': account['username'], 'role': 'admin'}

@router.get('/admin/me')
def admin_me(who=Depends(admin)):
    return who

@router.post('/admin/logout')
def logout(request: Request, response: Response):
    import hashlib
    with connect() as conn:
        conn.execute('DELETE FROM sessions WHERE token_hash=%s', (hashlib.sha256(request.cookies.get('admin_session','').encode()).hexdigest(),))
    response.delete_cookie('admin_session', path='/')
    return {'ok': True}

@router.get('/stores')
def stores(who=Depends(actor)):
    with connect() as conn:
        return conn.execute('SELECT code,name,active FROM stores WHERE active=true AND deleted_at IS NULL ORDER BY code').fetchall()

@router.get('/admin/stores')
def admin_stores(who=Depends(admin)):
    with connect() as conn:
        return conn.execute('SELECT code,name,active FROM stores WHERE deleted_at IS NULL ORDER BY code').fetchall()

@router.put('/admin/stores/{code}')
def save_store(code: str, body: StoreInput, who=Depends(admin)):
    if code != body.code:
        raise HTTPException(422, 'รหัส Store ไม่ตรงกัน')
    with connect() as conn:
        conn.execute('INSERT INTO stores(code,name,active) VALUES (%s,%s,%s) ON CONFLICT(code) DO UPDATE SET name=excluded.name,active=excluded.active,deleted_at=NULL', (body.code,body.name,body.active))
    return body


@router.delete('/admin/stores/{code}')
def delete_store(code: str, body: DeleteInput, who=Depends(admin)):
    if body.confirmation != f'DELETE {code}':
        raise HTTPException(422, 'ข้อความยืนยันไม่ตรงกัน')
    with connect() as conn:
        result = conn.execute('UPDATE stores SET active=false,deleted_at=now() WHERE code=%s AND deleted_at IS NULL RETURNING code', (code,)).fetchone()
        if not result:
            raise HTTPException(404, 'ไม่พบ Store')
    return {'ok': True}


@router.delete('/admin/totes/{code}')
def delete_tote(code: str, body: DeleteInput, who=Depends(admin)):
    if body.confirmation != f'DELETE {code}':
        raise HTTPException(422, 'ข้อความยืนยันไม่ตรงกัน')
    with connect() as conn:
        conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (code,))
        find_tote(conn, code, lock=True)
        conn.execute('INSERT INTO photo_cleanup_jobs(tote_code) VALUES (%s) ON CONFLICT DO NOTHING', (code,))
        conn.execute('DELETE FROM tote_events WHERE tote_code=%s', (code,))
        conn.execute('DELETE FROM totes WHERE code=%s', (code,))
    try_cleanup_photos()
    return {'ok': True}


def find_tote(conn, code, lock=False, shared=False):
    tote = conn.execute('SELECT * FROM totes WHERE code=%s' + (' FOR UPDATE' if lock else ' FOR SHARE' if shared else ''), (code,)).fetchone()
    if not tote:
        raise HTTPException(404, 'ยังไม่ได้ลงทะเบียน Tote นี้')
    return tote


def detail(conn, code):
    tote = find_tote(conn, code, shared=True)
    tote['history'] = conn.execute(
        'SELECT id,action,from_status,to_status,store_code,store_name,worker_name,note,created_at FROM tote_events WHERE tote_code=%s ORDER BY created_at DESC,id DESC', (code,)).fetchall()
    with connect(True) as images:
        tote['photos'] = images.execute('SELECT id,slot,byte_size,worker_name,uploaded_at FROM photos WHERE tote_code=%s ORDER BY slot', (code,)).fetchall()
    return tote


@router.get('/totes')
def list_totes(q: str = Query(default='', max_length=100), status: str | None = None,
               page: int = Query(default=1, ge=1), who=Depends(actor)):
    if status is not None and status not in ('READY', 'AT_STORE', 'RETURNED'):
        raise HTTPException(422, 'สถานะไม่ถูกต้อง')
    with connect() as conn:
        conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
        params = (q.strip().upper(), status, status)
        condition = ' WHERE strpos(code,%s)>0 AND (%s::text IS NULL OR status=%s)'
        total = conn.execute('SELECT count(*) AS n FROM totes' + condition, params).fetchone()['n']
        items = conn.execute('SELECT * FROM totes' + condition + ' ORDER BY updated_at DESC,code LIMIT 30 OFFSET %s', (*params, (page-1)*30)).fetchall()
        counts = {row['status']: row['n'] for row in conn.execute('SELECT status,count(*) AS n FROM totes GROUP BY status').fetchall()}
        return {'items': items, 'total': total, 'page': page, 'counts': counts}


@router.post('/totes')
def register(body: ToteInput, who=Depends(worker)):
    with connect() as conn:
        conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (body.code,))
        cleanup_for_code(conn, body.code)
        created = conn.execute('INSERT INTO totes(code) VALUES (%s) ON CONFLICT DO NOTHING RETURNING code', (body.code,)).fetchone()
        if created:
            conn.execute("INSERT INTO tote_events(id,tote_code,action,to_status,worker_name,request_id,request_payload) VALUES (%s,%s,'REGISTER','READY',%s,%s,%s)",
                         (uuid4(), body.code, who['name'], uuid4(), Jsonb({'code': body.code})))
        return detail(conn, body.code)


@router.get('/totes/{code}')
def get_tote(code: str, who=Depends(actor)):
    with connect() as conn:
        return detail(conn, code)


@router.post('/totes/{code}/transitions')
def transition(code: str, body: TransitionInput, who=Depends(worker)):
    payload = body.model_dump(mode='json')
    with connect() as conn:
        conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,1))', (str(body.request_id),))
        tote = find_tote(conn, code, lock=True)
        previous = conn.execute('SELECT * FROM tote_events WHERE request_id=%s', (body.request_id,)).fetchone()
        if previous:
            if previous['tote_code'] != code or previous['request_payload'] != payload:
                raise HTTPException(409, 'รหัสคำขอซ้ำแต่ข้อมูลไม่ตรงกัน')
            return detail(conn, code)
        if tote['version'] != body.expected_version:
            raise HTTPException(409, 'ข้อมูลถูกเปลี่ยนจากเครื่องอื่น กรุณาสแกนหรือโหลดข้อมูลใหม่')
        transitions = {'DISPATCH': ('READY', 'AT_STORE'), 'RETURN': ('AT_STORE', 'RETURNED'), 'RESET': ('RETURNED', 'READY')}
        source, target = transitions[body.action]
        if tote['status'] != source:
            raise HTTPException(409, 'ไม่สามารถเปลี่ยนสถานะตามลำดับนี้ได้')
        store_code, store_name = tote['store_code'], tote['store_name']
        if body.action == 'DISPATCH':
            store = conn.execute('SELECT * FROM stores WHERE code=%s AND active=true AND deleted_at IS NULL FOR SHARE', (body.store_code,)).fetchone()
            if not store:
                raise HTTPException(422, 'กรุณาเลือก Store ที่เปิดใช้งาน')
            store_code, store_name = store['code'], store['name']
        elif body.store_code is not None:
            raise HTTPException(422, 'การรับกลับและล้างค่าไม่ต้องระบุ Store ใหม่')
        conn.execute('INSERT INTO tote_events(id,tote_code,action,from_status,to_status,store_code,store_name,worker_name,note,request_id,request_payload) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                     (uuid4(), code, body.action, source, target, store_code, store_name, who['name'], body.note, body.request_id, Jsonb(payload)))
        conn.execute('UPDATE totes SET status=%s,store_code=%s,store_name=%s,version=version+1,updated_at=now() WHERE code=%s',
                     (target, None if target == 'READY' else store_code, None if target == 'READY' else store_name, code))
        return detail(conn, code)


@router.put('/totes/{code}/photos/{slot}')
def upload(code: str, slot: int, expected_version: int = Query(ge=0), file: UploadFile = File(...), who=Depends(worker)):
    if not 1 <= slot <= 6:
        raise HTTPException(422, 'Tote มีช่องรูปภาพได้ 1–6 เท่านั้น')
    content = file.file.read(8 * 1024 * 1024 + 1)
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(413, 'ไฟล์ภาพต้องไม่เกิน 8 MB')
    data, digest = normalize_image(content)
    with connect() as conn:
        tote = find_tote(conn, code, lock=True)
        if tote['version'] != expected_version:
            raise HTTPException(409, 'ข้อมูลถูกเปลี่ยนจากเครื่องอื่น กรุณาโหลดข้อมูลใหม่')
        if tote['status'] != 'READY':
            raise HTTPException(409, 'จัดการรูปได้เฉพาะ Tote ที่พร้อมใช้')
        with connect(True) as images:
            previous = images.execute('SELECT id,sha256 FROM photos WHERE tote_code=%s AND slot=%s', (code, slot)).fetchone()
            if previous and previous['sha256'] != digest:
                raise HTTPException(409, 'ช่องรูปนี้มีภาพแล้ว กรุณาโหลดข้อมูลใหม่ ไม่สามารถเขียนทับรูปจากเครื่องอื่นได้')
            if not previous:
                images.execute('INSERT INTO photos(id,tote_code,slot,content,sha256,byte_size,worker_name) VALUES (%s,%s,%s,%s,%s,%s,%s)',
                               (uuid4(), code, slot, data, digest, len(data), who['name']))
    return {'ok': True}


@router.get('/totes/{code}/photos/{slot}')
def photo(code: str, slot: int, who=Depends(actor)):
    with connect() as conn:
        find_tote(conn, code, shared=True)
        with connect(True) as images:
            row = images.execute('SELECT content FROM photos WHERE tote_code=%s AND slot=%s', (code, slot)).fetchone()
            if not row:
                raise HTTPException(404, 'ไม่พบรูปภาพ')
            return Response(bytes(row['content']), media_type='image/jpeg')


@router.delete('/totes/{code}/photos/{slot}')
def delete_photo(code: str, slot: int, expected_version: int = Query(ge=0), expected_photo_id: UUID = Query(), who=Depends(worker)):
    with connect() as conn:
        tote = find_tote(conn, code, lock=True)
        if tote['version'] != expected_version:
            raise HTTPException(409, 'ข้อมูลถูกเปลี่ยนจากเครื่องอื่น กรุณาโหลดข้อมูลใหม่')
        if tote['status'] != 'READY':
            raise HTTPException(409, 'จัดการรูปได้เฉพาะ Tote ที่พร้อมใช้')
        with connect(True) as images:
            previous = images.execute('SELECT id FROM photos WHERE tote_code=%s AND slot=%s', (code, slot)).fetchone()
            if previous and previous['id'] != expected_photo_id:
                raise HTTPException(409, 'รูปในช่องนี้เปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ก่อนลบ')
            images.execute('DELETE FROM photos WHERE tote_code=%s AND slot=%s AND id=%s', (code, slot, expected_photo_id))
    return {'ok': True}

@router.post('/admin/stores/import')
def import_stores(file: UploadFile = File(...), sheet: str = Form(''), who=Depends(admin)):
    try:
        from app.services.store_import import parse_stores
    except ModuleNotFoundError:
        raise HTTPException(503, "Excel support is missing. Rebuild the api image: docker compose up -d --build api")
    if not (file.filename or '').lower().endswith('.xlsx'):
        raise HTTPException(422, 'Please upload an XLSX file')
    data = file.file.read(5_000_001)
    file.file.close()
    if len(data)>5_000_000:
        raise HTTPException(413, 'Maximum file size is 5 MB')
    records = parse_stores(data, sheet.strip())
    with connect() as conn:
        for code,name in records.items():
            conn.execute('INSERT INTO stores(code,name,active) VALUES (%s,%s,true) ON CONFLICT(code) DO UPDATE SET name=excluded.name,active=CASE WHEN stores.deleted_at IS NOT NULL THEN true ELSE stores.active END,deleted_at=NULL', (code,name))
    return {'imported': len(records)}

@router.post('/admin/stores/excel-sheets')
def store_excel_sheets(file: UploadFile = File(...), who=Depends(admin)):
    try:
        from app.services.store_import import workbook_sheets
    except ModuleNotFoundError:
        raise HTTPException(503, 'Excel support is missing. Rebuild the api image: docker compose up -d --build api')
    data = file.file.read(5_000_001)
    file.file.close()
    if len(data)>5_000_000:
        raise HTTPException(413, 'Maximum file size is 5 MB')
    return {'sheets': workbook_sheets(data)}

@router.post('/admin/stores/delete-all')
def delete_all_stores(body: dict, who=Depends(admin)):
    if body.get('confirmation') != 'DELETE ALL STORES':
        raise HTTPException(422, 'Type DELETE ALL STORES to confirm')
    with connect() as conn:
        result = conn.execute('UPDATE stores SET active=false,deleted_at=now() WHERE deleted_at IS NULL')
        count = result.rowcount
    return {'deleted': count}
