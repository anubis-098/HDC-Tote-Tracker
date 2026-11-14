"""Restore a Backup.ps1 snapshot into isolated temporary PostgreSQL containers."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4
from datetime import datetime, timezone


def run(*args):
    result = subprocess.run(['docker', *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or 'Docker command failed')
    return result.stdout.strip()


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/verify_restore.py <backup-directory>')
    folder = Path(sys.argv[1]).resolve(strict=True)
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8-sig'))
    for item in manifest['files']:
        path = folder / item['name']
        if path.resolve().parent != folder:
            raise ValueError('Backup filename must stay inside the snapshot directory')
        digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
        if digest.lower() != item['sha256'].lower() or path.stat().st_size != item['bytes']:
            raise ValueError('Backup checksum mismatch')
    created = []
    try:
        for kind in ['app', 'images']:
            name = 'hdc-tote-restore-' + uuid4().hex[:12]
            run('run', '-d', '--name', name, '--network', 'none', '-e', 'POSTGRES_PASSWORD=restore-ephemeral-only', '-e', 'POSTGRES_DB=restore_check', 'postgres:17-alpine')
            created.append(name)
            for _ in range(120):
                ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'restore_check'], capture_output=True)
                if ready.returncode == 0:
                    break
                time.sleep(.5)
            else:
                raise RuntimeError('Temporary PostgreSQL did not become ready')
            run('cp', str(folder / f'tote-{kind}.dump'), f'{name}:/tmp/backup.dump')
            run('exec', name, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', 'restore_check', '/tmp/backup.dump')
            if kind == 'app':
                query = "SELECT json_build_object('totes',(SELECT count(*) FROM totes),'events',(SELECT count(*) FROM tote_events),'stores',(SELECT count(*) FROM stores),'workers',(SELECT count(*) FROM workers))"
            else:
                query = "SELECT json_build_object('photos',count(*),'bytes',COALESCE(sum(byte_size),0)) FROM photos"
            counts = json.loads(run('exec', name, 'psql', '-U', 'postgres', '-d', 'restore_check', '-At', '-c', query))
            if counts != manifest[kind]:
                raise RuntimeError(f'{kind} restored counts do not match the backup manifest')
            if kind == 'images':
                invalid = run('exec', name, 'psql', '-U', 'postgres', '-d', 'restore_check', '-At', '-c', "SELECT count(*) FROM photos WHERE encode(sha256(content),'hex')<>sha256 OR octet_length(content)<>byte_size")
                if invalid != '0':
                    raise RuntimeError('Restored image checksum mismatch')
        (folder / 'restore-verification.json').write_text(json.dumps({'verified_utc': datetime.now(timezone.utc).isoformat(), 'success': True, 'isolated_restore': True}, indent=2) + '\n', encoding='utf-8')
        print('Restore verified: both databases, record counts and image checksums match. Production databases were not modified.')
    finally:
        for name in created:
            run('rm', '-f', '-v', name)


if __name__ == '__main__':
    main()
