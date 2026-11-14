import logging
from app.db.connection import connect


def cleanup_for_code(conn, code):
    job = conn.execute('SELECT tote_code FROM photo_cleanup_jobs WHERE tote_code=%s FOR UPDATE', (code,)).fetchone()
    if job:
        with connect(True) as images:
            images.execute('DELETE FROM photos WHERE tote_code=%s', (code,))
        conn.execute('DELETE FROM photo_cleanup_jobs WHERE tote_code=%s', (code,))


def cleanup_photos(limit=100):
    for _ in range(limit):
        with connect() as conn:
            job = conn.execute('SELECT tote_code FROM photo_cleanup_jobs ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED').fetchone()
            if not job:
                return
            cleanup_for_code(conn, job['tote_code'])


def try_cleanup_photos():
    try:
        cleanup_photos()
    except Exception:
        logging.exception('Image cleanup deferred; queued work will retry')
