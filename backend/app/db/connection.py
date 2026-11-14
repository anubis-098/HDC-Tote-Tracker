from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from app.core.config import settings


@contextmanager
def connect(images=False):
    cfg = settings()
    url = cfg.image_database_url if images else cfg.app_database_url
    options = {'row_factory': dict_row, 'connect_timeout': 10}
    connection = psycopg.connect(url, **options) if url else psycopg.connect(
        host='postgres-images' if images else 'postgres-app',
        dbname='tote_images' if images else 'tote_app',
        user='images' if images else 'tote',
        password=cfg.image_db_password if images else cfg.app_db_password, **options)
    with connection as conn:
        yield conn
