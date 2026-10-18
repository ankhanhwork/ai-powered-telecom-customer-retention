import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import pandas as pd

import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'generation'))
from generate_data import cohort_role, generate_v4
from generate_sample import FEATURES, validate


class SimulatorV4Checks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[2]
        cls.temp_root = (cls.root/'tmp').resolve()
        cls.temp_root.mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(dir=cls.temp_root)
        cls.source = Path(cls.temp.name)/'source.csv'
        cls.fixture = pd.DataFrame({'Customer ID':[f'FIX-{i:03d}' for i in range(32)],
                                    'Tenure in Months':[24]*32,'Internet Service':['Yes']*32,
                                    'Customer Status':['Churned']*32})
        cls.fixture.to_csv(cls.source,index=False)
        cls.config = json.loads((cls.root/'ml/generation/simulator.json').read_text())
        cls.tables,cls.audit = generate_v4(cls.source,32,cls.config)

    @classmethod
    def tearDownClass(cls):
        assert Path(cls.temp.name).resolve().is_relative_to(cls.temp_root)
        cls.temp.cleanup()

    def test_source_labels_ignored_and_repeatable(self):
        changed = self.fixture.copy()
        changed['Customer Status'] = 'Stayed'
        changed.to_csv(self.source,index=False)
        tables,audit = generate_v4(self.source,32,self.config)
        for name in tables:
            pd.testing.assert_frame_equal(tables[name],self.tables[name])
        pd.testing.assert_frame_equal(audit,self.audit)

    def test_later_cutoff_cannot_change_past_features(self):
        earlier = {**self.config,'as_of':'2026-06-01'}
        tables,_ = generate_v4(self.source,32,earlier)
        keys = ['customer_id','snapshot_date']
        left = tables['customer_features'].set_index(keys)[FEATURES].sort_index()
        right = self.tables['customer_features'].set_index(keys).loc[left.index,FEATURES].sort_index()
        pd.testing.assert_frame_equal(left,right,check_dtype=False)

    def test_holdout_and_one_test_month(self):
        x = self.tables['customer_features']
        train_ids = set(x.loc[x['split'].eq('train'),'customer_id'])
        val_ids = set(x.loc[x['split'].eq('validation'),'customer_id'])
        test_ids = set(x.loc[x['split'].eq('test'),'customer_id'])
        self.assertTrue(test_ids)
        self.assertTrue(test_ids.isdisjoint(train_ids|val_ids))
        self.assertEqual(set(x.loc[x['split'].eq('test'),'snapshot_date']),{'2026-08-31'})
        for cid in test_ids:
            self.assertEqual(cohort_role(cid,self.config),'audit_holdout')

    def test_integrity_and_audit_excluded(self):
        self.assertTrue(validate(self.tables,date(2026,10,17))['checks_passed'])
        x = self.tables['customer_features']
        self.assertNotIn('generation_probability',x)
        self.assertNotIn('episode',x)
        self.assertNotIn('max_severity',x)
        self.assertNotIn('churn_next_month',x)

    def test_finite_observed_resolution_and_payment_dates(self):
        tickets = self.tables['support_tickets'].dropna(subset=['resolved_date'])
        duration = tickets.apply(lambda row:(row['resolved_date']-row['opened_date']).days,axis=1)
        self.assertTrue(duration.between(1,44).all())
        bills = self.tables['billing_history'].dropna(subset=['paid_date'])
        delays = bills.apply(lambda row:(row['paid_date']-row['due_date']).days,axis=1)
        self.assertTrue(delays.between(0,45).all())


if __name__=='__main__':
    unittest.main()
