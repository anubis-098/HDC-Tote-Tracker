from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from uuid import uuid4
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.db.connection import connect
from app.core.security import password_hash


@pytest.fixture(autouse=True)
def clean():
    with connect() as conn:
        conn.execute('TRUNCATE photo_cleanup_jobs,tote_events,totes,stores,sessions,workers,admins CASCADE')
    with connect(True) as images:
        images.execute('TRUNCATE photos')


@pytest.fixture
def client():
    with TestClient(app) as client:
        assert client.post('/api/worker/session', json={'name': 'พนักงาน ทดสอบ'}).status_code == 200
        with connect() as conn:
            conn.execute("INSERT INTO stores(code,name) VALUES ('S001','Store หนึ่ง'),('S002','Store สอง')")
        yield client


def register(client, code='HDC000001'):
    response = client.post('/api/totes', json={'code': code})
    assert response.status_code == 200
    return response.json()


def test_namespaced_24_hour_sessions_and_admin_scan(client):
    cookie = client.cookies.get('hdc_tote_worker_session')
    assert cookie
    with connect() as conn:
        remaining = conn.execute("SELECT extract(epoch FROM (expires_at-now())) AS seconds FROM sessions WHERE role='worker'").fetchone()['seconds']
        assert 86300 < remaining <= 86400
        conn.execute('INSERT INTO admins VALUES (%s,%s,%s)', (uuid4(), 'admin', password_hash('test')))
    response = client.post('/api/admin/login', json={'username':'admin','password':'test'})
    assert 'Max-Age=86400' in response.headers['set-cookie']
    assert 'hdc_tote_admin_session=' in response.headers['set-cookie']
    client.cookies.delete('hdc_tote_worker_session')
    assert client.get('/api/actor/me').json()['role'] == 'admin'
    register(client)
    assert change(client,'DISPATCH',0,store_code='S001').status_code == 200
    assert client.post('/api/admin/logout').status_code == 200
    assert client.get('/api/actor/me').status_code == 401


def test_pdf_report_requires_admin_and_returns_pdf(client):
    register(client)
    assert client.post('/api/tote-photo-report',json={'codes':['HDC000001']}).status_code == 401
    with connect() as conn:
        conn.execute('INSERT INTO admins VALUES (%s,%s,%s)', (uuid4(), 'admin', password_hash('test')))
    client.post('/api/admin/login',json={'username':'admin','password':'test'})
    assert client.post('/api/tote-photo-report',json={'codes':[]}).status_code == 422
    report=client.post('/api/tote-photo-report',json={'codes':['HDC000001']})
    assert report.status_code == 200
    assert report.headers['content-type'] == 'application/pdf'
    assert report.content.startswith(b'%PDF-')


def change(client, action, version, code='HDC000001', **extra):
    if action == 'DISPATCH':
        extra.setdefault('truck_registration', 'TEST-1234')
    body = {'action': action, 'expected_version': version, 'request_id': str(uuid4()), **extra}
    return client.post(f'/api/totes/{code}/transitions', json=body)


def test_roundtrip_retains_store_history_and_new_cycle(client):
    register(client)
    register(client)  # Repeated scan/registration must not create duplicate history.
    sent = change(client, 'DISPATCH', 0, store_code='S001').json()
    assert sent['status'] == 'AT_STORE' and sent['store_name'] == 'Store หนึ่ง'
    returned = change(client, 'RETURN', 1).json()
    assert returned['status'] == 'RETURNED' and returned['store_code'] == 'S001'
    reset = change(client, 'RESET', 2).json()
    assert reset['status'] == 'READY' and reset['store_code'] is None
    assert len(reset['history']) == 4
    assert [event['store_code'] for event in reset['history'] if event['action'] != 'REGISTER'] == ['S001'] * 3
    next_cycle = change(client, 'DISPATCH', 3, store_code='S002').json()
    assert next_cycle['store_code'] == 'S002'
    assert any(event['store_code'] == 'S001' for event in next_cycle['history'])


def test_invalid_transitions_stale_versions_and_store_validation(client):
    register(client)
    assert change(client, 'RETURN', 0).status_code == 409
    assert change(client, 'RESET', 0).status_code == 409
    assert change(client, 'DISPATCH', 0, store_code='missing').status_code == 422
    with connect() as conn:
        conn.execute("UPDATE stores SET active=false WHERE code='S001'")
    assert change(client, 'DISPATCH', 0, store_code='S001').status_code == 422
    assert change(client, 'DISPATCH', 0, store_code='S002').status_code == 200
    assert change(client, 'RETURN', 0).status_code == 409
    assert change(client, 'RETURN', 1, store_code='S001').status_code == 422


def test_retry_request_is_idempotent(client):
    register(client)
    body = {'action': 'DISPATCH', 'expected_version': 0, 'store_code': 'S001', 'truck_registration': 'TEST-1234', 'request_id': str(uuid4())}
    first = client.post('/api/totes/HDC000001/transitions', json=body)
    retry = client.post('/api/totes/HDC000001/transitions', json=body)
    assert first.status_code == retry.status_code == 200
    assert retry.json()['version'] == 1 and len(retry.json()['history']) == 2
    body['store_code'] = 'S002'
    assert client.post('/api/totes/HDC000001/transitions', json=body).status_code == 409


def test_two_handhelds_cannot_dispatch_same_version(client):
    register(client)
    cookies = dict(client.cookies)
    def send(store):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            return change(other, 'DISPATCH', 0, store_code=store).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(send, ['S001', 'S002'])) == [200, 409]


def test_six_photos_and_edit_lock(client):
    register(client)
    image = BytesIO()
    Image.new('RGB', (30, 30), '#006da8').save(image, format='PNG')
    content = image.getvalue()
    for slot in range(1, 7):
        response = client.put(f'/api/totes/HDC000001/photos/{slot}?expected_version=0', files={'file': ('photo.png', content, 'image/png')})
        assert response.status_code == 200
    assert client.put('/api/totes/HDC000001/photos/7?expected_version=0', files={'file': ('p.png', content)}).status_code == 422
    assert len(client.get('/api/totes/HDC000001').json()['photos']) == 6
    photo = client.get('/api/totes/HDC000001/photos/1')
    assert photo.headers['content-type'] == 'image/jpeg'
    assert Image.open(BytesIO(photo.content)).format == 'JPEG'
    change(client, 'DISPATCH', 0, store_code='S001')
    assert client.put('/api/totes/HDC000001/photos/1?expected_version=0', files={'file': ('p.png', content)}).status_code == 409
    assert client.delete('/api/totes/HDC000001/photos/1?expected_version=0&expected_photo_id=00000000-0000-4000-8000-000000000000').status_code == 409
    change(client, 'RETURN', 1)
    reset = change(client, 'RESET', 2).json()
    assert len(reset['photos']) == 6
    photo_id = reset['photos'][0]['id']
    assert client.delete(f'/api/totes/HDC000001/photos/1?expected_version=3&expected_photo_id={photo_id}').status_code == 200
    assert len(client.get('/api/totes/HDC000001').json()['photos']) == 5


def test_invalid_photos_and_qr_codes(client):
    for code in ['HDC', 'ABC000001', 'HDC12/3', 'HDC12345X', 'HDC' + '1' * 98]:
        assert client.post('/api/totes', json={'code': code}).status_code == 422
    register(client)
    assert client.put('/api/totes/HDC000001/photos/1?expected_version=0', files={'file': ('fake.jpg', b'not an image')}).status_code == 422
    assert client.put('/api/totes/HDC000001/photos/1?expected_version=0', files={'file': ('large.jpg', b'x' * (8*1024*1024+1))}).status_code == 413


def test_auth_stores_and_cross_origin():
    with TestClient(app) as client:
        assert client.get('/api/totes').status_code == 401
        assert client.get('/api/admin/stores').status_code == 401
        client.post('/api/worker/session', json={'name': 'พนักงาน'})
        assert client.put('/api/admin/stores/S001', json={'code': 'S001', 'name': 'test'}).status_code == 401
        assert client.post('/api/totes', json={'code': 'HDC000001'}, headers={'origin': 'https://other.example'}).status_code == 403
        with connect() as conn:
            conn.execute('INSERT INTO admins VALUES (%s,%s,%s)', (uuid4(), 'admin', password_hash('test-password-123')))
        assert client.post('/api/admin/login', json={'username': 'admin', 'password': 'incorrect'}).status_code == 401
        assert client.post('/api/admin/login', json={'username': 'admin', 'password': 'test-password-123'}).status_code == 200
        assert client.put('/api/admin/stores/S001', json={'code': 'S001', 'name': 'Store ใหม่'}).status_code == 200
        assert client.get('/api/stores').json()[0]['name'] == 'Store ใหม่'
        client.post('/api/admin/logout')
        assert client.get('/api/admin/stores').status_code == 401


def test_dashboard_filters_and_paging(client):
    register(client, 'HDC000001')
    register(client, 'HDC000002')
    change(client, 'DISPATCH', 0, store_code='S001')
    result = client.get('/api/totes?status=AT_STORE&q=000001').json()
    assert result['total'] == 1 and result['items'][0]['code'] == 'HDC000001'
    assert result['counts'] == {'READY': 1, 'AT_STORE': 1}
    assert client.get('/api/totes?page=2').json()['items'] == []
    assert client.get('/api/totes?status=INVALID').status_code == 422


def test_change_operator_and_stale_photo_request(client):
    register(client)
    assert client.post('/api/worker/session', json={'name': 'พนักงาน คนใหม่'}).status_code == 200
    assert client.get('/api/worker/me').json()['name'] == 'พนักงาน คนใหม่'
    change(client, 'DISPATCH', 0, store_code='S001')
    change(client, 'RETURN', 1)
    reset = change(client, 'RESET', 2).json()
    assert reset['history'][0]['worker_name'] == 'พนักงาน คนใหม่'
    assert client.delete('/api/totes/HDC000001/photos/1?expected_version=0&expected_photo_id=00000000-0000-4000-8000-000000000000').status_code == 409


def login_admin(client):
    with connect() as conn:
        conn.execute('INSERT INTO admins VALUES (%s,%s,%s)', (uuid4(), 'admin', password_hash('1')))
    assert client.post('/api/admin/login', json={'username': 'admin', 'password': '1'}).status_code == 200


def test_variable_length_tote_codes(client):
    for code in ['HDC1', 'HDC123', 'HDC1234567', 'HDC' + '9' * 97]:
        assert register(client, code)['code'] == code
        assert client.get('/api/totes/' + code).status_code == 200


def test_worker_suggestions_and_name_reuse(client):
    first = client.get('/api/worker/me').json()
    with TestClient(app) as other:
        assert other.get('/api/workers/suggestions?q=พน').status_code == 422
        result = other.get('/api/workers/suggestions?q=พนัก').json()
        assert result == [{'name': 'พนักงาน ทดสอบ'}]
        second = other.post('/api/worker/session', json={'name': '  พนักงาน ทดสอบ  '}).json()
        assert first['id'] == second['id']
        assert other.get('/api/workers/suggestions?q=xxx').json() == []
        assert other.get('/api/workers/suggestions?q=%25%25%25').json() == []
    with connect() as conn:
        assert conn.execute('SELECT count(*) AS n FROM workers').fetchone()['n'] == 1


def test_delete_store_preserves_existing_tote_history(client):
    register(client)
    change(client, 'DISPATCH', 0, store_code='S001')
    assert client.request('DELETE', '/api/admin/stores/S001', json={'confirmation': 'DELETE S001'}).status_code == 401
    login_admin(client)
    assert client.request('DELETE', '/api/admin/stores/S001', json={'confirmation': 'wrong'}).status_code == 422
    assert client.request('DELETE', '/api/admin/stores/S001', json={'confirmation': 'DELETE S001'}).status_code == 200
    assert all(store['code'] != 'S001' for store in client.get('/api/admin/stores').json())
    assert all(store['code'] != 'S001' for store in client.get('/api/stores').json())
    assert client.get('/api/totes/HDC000001').json()['store_name'] == 'Store หนึ่ง'
    change(client, 'RETURN', 1)
    result = change(client, 'RESET', 2).json()
    assert any(event['store_code'] == 'S001' for event in result['history'])
    assert change(client, 'DISPATCH', 3, store_code='S001').status_code == 422


def test_delete_tote_requires_confirmation_and_removes_photos(client):
    register(client, 'HDC12')
    output = BytesIO()
    Image.new('RGB', (10, 10), 'red').save(output, format='JPEG')
    assert client.put('/api/totes/HDC12/photos/1?expected_version=0', files={'file': ('photo.jpg', output.getvalue())}).status_code == 200
    assert client.request('DELETE', '/api/admin/totes/HDC12', json={'confirmation': 'DELETE HDC12'}).status_code == 401
    login_admin(client)
    assert client.request('DELETE', '/api/admin/totes/HDC12', json={'confirmation': 'DELETE HDC1'}).status_code == 422
    assert client.get('/api/totes/HDC12').status_code == 200
    assert client.request('DELETE', '/api/admin/totes/HDC12', json={'confirmation': 'DELETE HDC12'}).status_code == 200
    assert client.get('/api/totes/HDC12').status_code == 404
    assert client.get('/api/totes/HDC12/photos/1').status_code == 404
    with connect() as conn:
        assert conn.execute("SELECT count(*) AS n FROM tote_events WHERE tote_code='HDC12'").fetchone()['n'] == 0


def test_cli_accepts_short_password(monkeypatch):
    from app.manage import prompt_password
    answers = iter(['', '1', '1'])
    monkeypatch.setattr('app.manage.getpass.getpass', lambda _: next(answers))
    assert prompt_password() == '1'


def test_upgrade_preserves_existing_codes_and_reuses_duplicate_workers():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1] / 'migrations' / 'app'
    canonical, duplicate = sorted([uuid4(), uuid4()])
    with connect() as conn:
        conn.execute('CREATE SCHEMA migration_fixture')
        conn.execute('SET LOCAL search_path TO migration_fixture')
        conn.execute((root / '001_initial.sql').read_text(encoding='utf-8-sig'))
        conn.execute("INSERT INTO totes(code) VALUES ('HDC000001')")
        conn.execute('INSERT INTO workers(id,name) VALUES (%s,%s),(%s,%s)', (canonical, 'Operator Name', duplicate, '  operator name  '))
        conn.execute("INSERT INTO sessions VALUES ('old-token',%s,'worker',now()+interval '1 day')", (duplicate,))
        conn.execute((root / '002_flexible_codes_workers_deletion.sql').read_text(encoding='utf-8-sig'))
        assert conn.execute('SELECT actor_id FROM sessions').fetchone()['actor_id'] == canonical
        assert conn.execute('SELECT count(*) AS n FROM workers').fetchone()['n'] == 1
        assert conn.execute("SELECT code FROM totes WHERE code='HDC000001'").fetchone()
        conn.execute("INSERT INTO totes(code) VALUES ('HDC1')")
        conn.execute('SET LOCAL search_path TO public')
        conn.execute('DROP SCHEMA migration_fixture CASCADE')


def image_bytes(color):
    output = BytesIO()
    Image.new('RGB', (30, 30), color).save(output, format='PNG')
    return output.getvalue()


def test_photo_retry_never_overwrites_another_photo(client):
    register(client)
    path = '/api/totes/HDC000001/photos/1?expected_version=0'
    first = client.put(path, files={'file': ('red.png', image_bytes('red'))})
    assert first.status_code == 200
    original = client.get('/api/totes/HDC000001').json()['photos'][0]['id']
    assert client.put(path, files={'file': ('red.png', image_bytes('red'))}).status_code == 200
    assert client.get('/api/totes/HDC000001').json()['photos'][0]['id'] == original
    assert client.put(path, files={'file': ('blue.png', image_bytes('blue'))}).status_code == 409
    wrong_id = str(uuid4())
    assert client.delete(path + '&expected_photo_id=' + wrong_id).status_code == 409
    assert client.delete(path + '&expected_photo_id=' + original).status_code == 200
    assert client.put(path, files={'file': ('blue.png', image_bytes('blue'))}).status_code == 200
    assert client.delete(path + '&expected_photo_id=' + original).status_code == 409


def test_simultaneous_photo_uploads_keep_one_original(client):
    register(client)
    cookies = dict(client.cookies)
    def send(color):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            return other.put('/api/totes/HDC000001/photos/1?expected_version=0', files={'file': ('p.png', image_bytes(color))}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(send, ['red', 'blue'])) == [200, 409]


def test_delete_continues_after_image_database_outage(client, monkeypatch):
    from app.services import cleanup
    from psycopg import OperationalError
    register(client, 'HDC77')
    client.put('/api/totes/HDC77/photos/1?expected_version=0', files={'file': ('p.png', image_bytes('red'))})
    login_admin(client)
    original_connect = cleanup.connect
    def disconnected(images=False):
        if images:
            raise OperationalError('simulated image outage')
        return original_connect(images)
    monkeypatch.setattr(cleanup, 'connect', disconnected)
    assert client.request('DELETE', '/api/admin/totes/HDC77', json={'confirmation': 'DELETE HDC77'}).status_code == 200
    assert client.get('/api/totes/HDC77').status_code == 404
    assert client.get('/api/totes/HDC77/photos/1').status_code == 404
    with connect() as conn:
        assert conn.execute("SELECT 1 FROM photo_cleanup_jobs WHERE tote_code='HDC77'").fetchone()
    monkeypatch.setattr(cleanup, 'connect', original_connect)
    # Registering the same QR must complete old cleanup before creating a new Tote.
    assert register(client, 'HDC77')['photos'] == []
    with connect() as conn:
        assert not conn.execute("SELECT 1 FROM photo_cleanup_jobs WHERE tote_code='HDC77'").fetchone()


def test_request_id_collision_across_totes_returns_conflict(client):
    register(client, 'HDC1'); register(client, 'HDC2')
    body = {'action': 'DISPATCH', 'expected_version': 0, 'request_id': str(uuid4()), 'store_code': 'S001', 'truck_registration': 'TEST-1234'}
    cookies = dict(client.cookies)
    def send(code):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            return other.post(f'/api/totes/{code}/transitions', json=body).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(send, ['HDC1', 'HDC2'])) == [200, 409]


def test_search_treats_wildcards_as_literal_text(client):
    register(client)
    assert client.get('/api/totes', params={'q': '%'}).json()['total'] == 0
