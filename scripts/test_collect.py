import unittest
from datetime import datetime, timezone
from collect import update

class CollectorTests(unittest.TestCase):
    def test_validation(self):
        for count in [None, True, -1, '5', 1.5]:
            with self.assertRaises(ValueError):
                update({'samples': []}, count, datetime.now(timezone.utc))
    def test_retention_and_zero(self):
        now = datetime(2026, 10, 19, tzinfo=timezone.utc)
        original = {'samples': [{'at': '2025-01-01T00:00:00Z', 'count': 10}]}
        result = update(original, 0, now)
        self.assertEqual(len(result['samples']), 1)
        self.assertEqual(result['samples'][0]['count'], 0)
        self.assertEqual(len(update(result, 40, now)['samples']), 1)
        self.assertEqual(original['samples'][0]['count'], 10)

if __name__ == '__main__': unittest.main()
