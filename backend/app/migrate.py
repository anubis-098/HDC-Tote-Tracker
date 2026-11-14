from pathlib import Path
from app.db.connection import connect

def migrate():
    for name, images in [('app', False), ('images', True)]:
        with connect(images) as conn:
            conn.execute('SELECT pg_advisory_xact_lock(913020)')
            conn.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
            for path in sorted((Path(__file__).resolve().parent.parent / 'migrations' / name).glob('*.sql')):
                if not conn.execute('SELECT 1 FROM schema_migrations WHERE version=%s', (path.name,)).fetchone():
                    conn.execute(path.read_text(encoding='utf-8-sig'))
                    conn.execute('INSERT INTO schema_migrations(version) VALUES (%s)', (path.name,))
                    print(f'Applied {name}/{path.name}')

if __name__ == '__main__':
    migrate()
