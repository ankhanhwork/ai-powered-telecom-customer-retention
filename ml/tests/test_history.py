from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'generation'))
import unittest

import numpy as np
import pandas as pd

from build_history_features import EXTRA_FEATURES, build_features


class HistoryFeatureChecks(unittest.TestCase):
    def setUp(self):
        self.snapshots = pd.DataFrame({'customer_id':['A','A'], 'snapshot_date':['2026-01-31','2026-02-28'],
                                       'service_issue_days_30d':[5,4]})
        dates = pd.date_range('2026-01-01','2026-02-28')
        usage = np.where((dates >= '2026-01-25') & (dates <= '2026-01-31'), 20., 10.)
        self.daily = pd.DataFrame({'customer_id':'A','service_date':dates.strftime('%Y-%m-%d'),
                                   'usage_gb':usage, 'telemetry_observed':True})
        self.tickets = pd.DataFrame({'customer_id':['A','A','A'],
                                     'opened_date':['2026-01-01','2026-01-05','2026-03-01'],
                                     'resolved_date':['2026-02-01',None,None]})

    def test_definitions(self):
        output = build_features(self.snapshots,self.daily,self.tickets)
        self.assertAlmostEqual(output.loc[0,'usage_change_pct_7d'],100.)
        self.assertAlmostEqual(output.loc[1,'usage_change_pct_7d'],0.)
        self.assertEqual(output['oldest_open_ticket_days'].tolist(),[30,54])
        self.assertEqual(output['consecutive_issue_months'].tolist(),[1,2])

    def test_future_events_do_not_change_past(self):
        expected = build_features(self.snapshots,self.daily,self.tickets)
        future = pd.DataFrame({'customer_id':['A'],'service_date':['2026-03-01'], 'usage_gb':[9999.], 'telemetry_observed':[True]})
        actual = build_features(self.snapshots,pd.concat([self.daily,future],ignore_index=True),self.tickets)
        pd.testing.assert_frame_equal(actual,expected)

    def test_missing_telemetry_is_not_zero_usage(self):
        self.daily.loc[self.daily['service_date'].eq('2026-01-30'),'telemetry_observed'] = False
        output = build_features(self.snapshots,self.daily,self.tickets)
        self.assertTrue(pd.isna(output.loc[0,'usage_change_pct_7d']))

    def test_gap_resets_streak(self):
        self.snapshots.loc[1,'snapshot_date'] = '2026-03-31'
        output = build_features(self.snapshots,self.daily,self.tickets)
        self.assertEqual(output.loc[1,'consecutive_issue_months'],1)
        self.assertTrue(pd.isna(output.loc[1,'usage_change_pct_7d']))

    def test_future_resolution_not_visible_at_january_cutoff(self):
        before = build_features(self.snapshots.iloc[:1],self.daily,self.tickets)
        self.tickets.loc[0,'resolved_date'] = None
        after = build_features(self.snapshots.iloc[:1],self.daily,self.tickets)
        pd.testing.assert_frame_equal(before[EXTRA_FEATURES],after[EXTRA_FEATURES])


if __name__=='__main__':
    unittest.main()
