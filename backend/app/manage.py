import getpass
import sys
from uuid import uuid4
from psycopg.errors import UniqueViolation
from app.db.connection import connect
from app.core.security import password_hash

MIN_PASSWORD_LENGTH = 1
MAX_PASSWORD_LENGTH = 200


def prompt_username():
    while True:
        username = input('Admin username (1-60 characters): ').strip().lower()
        if not username:
            print('Username is empty. Please enter a username.')
        elif len(username) > 60:
            print('Username is too long. Use no more than 60 characters.')
        else:
            return username


def prompt_password():
    print('Password must contain 1-200 characters. Input is hidden (no dots or asterisks).')
    print('Spaces are significant. Check keyboard language and Caps Lock before typing.')
    while True:
        password = getpass.getpass('New password: ')
        if len(password) < MIN_PASSWORD_LENGTH:
            print('Password is empty. Please enter a password.')
            continue
        if len(password) > MAX_PASSWORD_LENGTH:
            print('Password is too long. Use no more than 200 characters. Please try again.')
            continue
        confirmation = getpass.getpass('Confirm password (type the same password again): ')
        if password != confirmation:
            print('Passwords do not match. Please enter both values again.')
            continue
        return password


def main():
    if sys.argv[1:] != ['create-admin']:
        raise SystemExit('Usage: python -m app.manage create-admin')
    try:
        username = prompt_username()
        with connect() as conn:
            if conn.execute('SELECT 1 FROM admins WHERE username=%s', (username,)).fetchone():
                raise SystemExit('Username already exists; no account was changed.')
        password = prompt_password()
        with connect() as conn:
            conn.execute(
                'INSERT INTO admins(id,username,password_hash) VALUES (%s,%s,%s)',
                (uuid4(), username, password_hash(password)),
            )
    except (EOFError, KeyboardInterrupt):
        raise SystemExit('\nCancelled; no account was created. Run in an interactive terminal.')
    except UniqueViolation:
        raise SystemExit('Username already exists; no account was changed.')
    print(f'Admin created: {username}. Sign in at /admin/login.')


if __name__ == '__main__':
    main()
