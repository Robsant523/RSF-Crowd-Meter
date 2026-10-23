import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from collect import record_and_export, fetch_count

class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / 'readings.sqlite3'
        self.out = Path(self.temp.name) / 'history.json'
        self.now = datetime(2026, 10, 22, tzinfo=timezone.utc)
    def test_append_zero_and_export_retention(self):
        record_and_export(self.db, self.out, 50, self.now - timedelta(days=60))
        record_and_export(self.db, self.out, 0, self.now)
        result = record_and_export(self.db, self.out, 20, self.now + timedelta(minutes=15))
        self.assertEqual([s['count'] for s in result['samples']], [0, 20])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM readings').fetchone()[0], 3)
        self.assertEqual(json.loads(self.out.read_text()), result)
    def test_invalid_count_never_written(self):
        for count in [None, True, -1, '3', 2.2]:
            with self.assertRaises(ValueError): record_and_export(self.db, self.out, count, self.now)
        self.assertFalse(self.db.exists())
    def test_duplicate_timestamp_is_idempotent(self):
        record_and_export(self.db, self.out, 20, self.now)
        result = record_and_export(self.db, self.out, 20, self.now)
        self.assertEqual(len(result['samples']), 1)
    def test_database_survives_export_failure(self):
        with patch('collect.tempfile.NamedTemporaryFile', side_effect=OSError('disk error')):
            with self.assertRaises(OSError): record_and_export(self.db, self.out, 20, self.now)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT count FROM readings').fetchone()[0], 20)
    def test_network_failure_propagates(self):
        with patch('collect.urlopen', side_effect=TimeoutError):
            with self.assertRaises(TimeoutError): fetch_count({'url': 'https://example.com', 'token': 'test'})

if __name__ == '__main__': unittest.main()
