"""One occupancy sample per invocation. Python 3.9+, standard library only."""
import argparse
import base64
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

def fetch_count(config):
    request = Request(config['url'], headers={'Authorization': 'Bearer ' + config['token']})
    with urlopen(request, timeout=30) as response:
        count = json.load(response).get('count')
    if type(count) is not int or count < 0:
        raise ValueError('Sensor returned an invalid count; no reading saved')
    return count

def record_and_export(database, output, count, now):
    if type(count) is not int or count < 0:
        raise ValueError('Invalid count')
    database.parent.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    stamp = now.astimezone(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')
    cutoff = (now - timedelta(days=56)).astimezone(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')
    with sqlite3.connect(database, timeout=60) as db:
        db.execute('CREATE TABLE IF NOT EXISTS readings (at TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count >= 0))')
        db.execute('INSERT OR IGNORE INTO readings VALUES (?, ?)', (stamp, count))
        db.commit()  # Durable even if export or upload subsequently fails.
        db.execute('BEGIN IMMEDIATE')  # Serialize exports from overlapping runs.
        stamp = max(stamp, db.execute('SELECT MAX(at) FROM readings').fetchone()[0])
        cutoff = (datetime.fromisoformat(stamp.replace('Z', '+00:00')) - timedelta(days=56)).isoformat(timespec='microseconds').replace('+00:00', 'Z')
        rows = db.execute('SELECT at, count FROM readings WHERE at >= ? AND at <= ? ORDER BY at', (cutoff, stamp)).fetchall()
        result = {'version': 1, 'updatedAt': rows[-1][0] if rows else None,
                  'samples': [{'at': at, 'count': value} for at, value in rows]}
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent, delete=False) as f:
                temporary = Path(f.name)
                json.dump(result, f, separators=(',', ':'))
                f.write('\n')
            temporary.replace(output)
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
    return result

def publish(output, token):
    """Publish only the website export. SQLite remains the source of truth."""
    if not token:
        raise ValueError('Publishing requires RSF_GITHUB_TOKEN or --token-file')
    url = 'https://api.github.com/repos/Robsant523/RSF-Crowd-Meter/contents/data/history.json'
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
               'Content-Type': 'application/json', 'User-Agent': 'rsf-local-collector'}
    for attempt in range(3):
        with urlopen(Request(url + '?ref=main', headers=headers), timeout=30) as response:
            remote = json.load(response)
        payload = output.read_bytes()
        if remote.get('encoding') != 'base64' or not remote.get('sha'):
            raise ValueError('GitHub returned an incomplete history file')
        if base64.b64decode(remote['content']) == payload:
            return
        body = json.dumps({'message': 'Record local occupancy history', 'branch': 'main',
                           'sha': remote['sha'], 'content': base64.b64encode(payload).decode()}).encode()
        try:
            with urlopen(Request(url, data=body, headers=headers, method='PUT'), timeout=30) as response:
                json.load(response)
            return
        except HTTPError as error:
            if error.code != 409 or attempt == 2:
                raise

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=ROOT / 'local-data/occupancy.sqlite3')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/history.json')
    parser.add_argument('--publish', action='store_true', help='Upload export to GitHub main after saving locally')
    parser.add_argument('--token-file', type=Path, help='Private file containing a GitHub token; never commit it')
    args = parser.parse_args()
    config = json.loads((ROOT / 'scripts/source.json').read_text())
    count = fetch_count(config)
    result = record_and_export(args.db, args.output, count, datetime.now(timezone.utc))
    print(f"Saved {count} people at {result['updatedAt']} to {args.db}", flush=True)
    if args.publish:
        token = args.token_file.read_text().strip() if args.token_file else os.environ.get('RSF_GITHUB_TOKEN', '')
        publish(args.output, token)
        print('Published website history.', flush=True)

if __name__ == '__main__':
    main()
