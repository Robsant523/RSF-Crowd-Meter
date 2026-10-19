"""Collect one real count; failures leave history untouched."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

def update(history, count, now):
    if type(count) is not int or count < 0:
        raise ValueError('Sensor returned an invalid count')
    cutoff = now - timedelta(days=56)
    samples = [s for s in history['samples'] if cutoff <= datetime.fromisoformat(s['at'].replace('Z', '+00:00')) <= now]
    stamp = now.isoformat().replace('+00:00', 'Z')
    samples = [s for s in samples if s['at'] != stamp]
    samples.append({'at': stamp, 'count': count})
    return {'version': 1, 'updatedAt': stamp, 'samples': samples}

def main():
    config = json.loads((ROOT / 'scripts/source.json').read_text())
    request = Request(config['url'], headers={'Authorization': 'Bearer ' + config['token']})
    with urlopen(request, timeout=30) as response:
        count = json.load(response).get('count')
    path = ROOT / 'data/history.json'
    result = update(json.loads(path.read_text()), count, datetime.now(timezone.utc))
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    temporary.replace(path)
    print('Saved one occupancy reading.')

if __name__ == '__main__':
    main()
