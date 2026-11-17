import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request, Response
from app.db.connection import connect
from app.core.config import settings

def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return f'{salt}:{digest}'

def password_matches(password, stored):
    salt, expected = stored.split(':')
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return hmac.compare_digest(digest, expected)

def create_session(conn, response, actor_id, role):
    token = secrets.token_urlsafe(32)
    seconds = 24 * 60 * 60
    conn.execute('DELETE FROM sessions WHERE expires_at < now()')
    conn.execute('INSERT INTO sessions VALUES (%s,%s,%s,%s)', (hashlib.sha256(token.encode()).hexdigest(), actor_id, role, datetime.now(timezone.utc) + timedelta(seconds=seconds)))
    response.set_cookie(f'{role}_session', token, max_age=seconds, httponly=True, secure=settings().cookie_secure, samesite='strict', path='/')

def identity(request, role):
    token = request.cookies.get(f'{role}_session', '')
    with connect() as conn:
        session = conn.execute('SELECT actor_id, role FROM sessions WHERE token_hash=%s AND role=%s AND expires_at>now()', (hashlib.sha256(token.encode()).hexdigest(), role)).fetchone()
        if not session:
            raise HTTPException(401, 'กรุณาเข้าสู่ระบบใหม่')
        table = 'admins' if role == 'admin' else 'workers'
        actor = conn.execute(f'SELECT * FROM {table} WHERE id=%s', (session['actor_id'],)).fetchone()
        if not actor:
            raise HTTPException(401, 'ไม่พบบัญชี')
        return {'id': actor['id'], 'role': role, 'name': actor.get('name', actor.get('username'))}

def worker(request: Request):
    return identity(request, 'worker')

def admin(request: Request):
    return identity(request, 'admin')

def actor(request: Request):
    try:
        return identity(request, 'admin')
    except HTTPException:
        return identity(request, 'worker')
