import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))

import pandas as pd

from data.synthetic.generation.generate_data import cohort_role, generate
from data.synthetic.generation.common import FEATURES
from data.synthetic.generation.rolling_quality import validate_rolling


class SimulatorChecks(unittest.TestCase):
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
        cls.config = json.loads((cls.root/'data/synthetic/generation/simulator.json').read_text())
        cls.tables,cls.audit = generate(cls.source,32,cls.config)

    @classmethod
    def tearDownClass(cls):
        assert Path(cls.temp.name).resolve().is_relative_to(cls.temp_root)
        cls.temp.cleanup()

    def test_source_labels_ignored_and_repeatable(self):
        changed = self.fixture.copy()
        changed['Customer Status'] = 'Stayed'
        changed.to_csv(self.source,index=False)
        tables,audit = generate(self.source,32,self.config)
        for name in tables:
            pd.testing.assert_frame_equal(tables[name],self.tables[name])
        pd.testing.assert_frame_equal(audit,self.audit)

    def test_later_cutoff_cannot_change_past_features(self):
        earlier = {**self.config,'as_of':'2026-06-01'}
        tables,_ = generate(self.source,32,earlier)
        keys = ['customer_id','snapshot_date']
        left = tables['customer_features'].set_index(keys)[FEATURES].sort_index()
        right = self.tables['customer_features'].set_index(keys).loc[left.index,FEATURES].sort_index()
        pd.testing.assert_frame_equal(left,right,check_dtype=False)

    def test_holdout_customer_roles_and_snapshot_schedule(self):
        x = self.tables['customer_features']
        audit_ids = set(x.loc[x.cohort_role.eq('audit_holdout'),'customer_id'])
        development_ids = set(x.loc[x.cohort_role.eq('development'),'customer_id'])
        self.assertTrue(audit_ids)
        self.assertTrue(audit_ids.isdisjoint(development_ids))
        dates = pd.to_datetime(x.snapshot_date)
        self.assertTrue((dates.dt.day.isin([10,20]) | dates.dt.is_month_end).all())
        for cid in audit_ids:
            self.assertEqual(cohort_role(cid,self.config),'audit_holdout')

    def test_integrity_and_audit_excluded(self):
        self.assertTrue(validate_rolling(self.tables,date.fromisoformat(self.config['as_of']))['checks_passed'])
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
