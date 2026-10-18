from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'generation'))
import unittest

import numpy as np
import pandas as pd

from build_window_features import (EXTENDED_FEATURES, PAYMENT_FEATURES,
                                   build_extended_features, extended_groups, payment_features)
from generate_sample import FEATURES


class PaymentFeatureChecks(unittest.TestCase):
    def setUp(self):
        self.bills = pd.DataFrame({'customer_id':['A']*4,
            'issued_date':['2026-01-01','2026-02-01','2026-03-01','2026-04-01'],
            'due_date':['2026-01-10','2026-02-10','2026-03-10','2026-04-10'],
            'paid_date':['2026-01-10','2026-02-20','2026-04-05','2026-04-15'],
            'amount_vnd':[205000]*4})

    def test_delays_and_windows(self):
        f = payment_features(self.bills,'2026-03-31',205000,90)
        self.assertEqual(f['due_invoice_count_90d'],3)
        self.assertAlmostEqual(f['late_invoice_rate_90d'],2/3)
        self.assertEqual(f['observed_delay_max_days_90d'],21)
        self.assertEqual(f['observed_delay_mean_days_60d'],15.5)
        self.assertEqual(f['unpaid_overdue_amount_vnd_30d'],205000)
        self.assertEqual(f['payment_count_90d'],2)
        self.assertEqual(f['days_since_last_payment'],39)
        self.assertEqual(f['last_payment_delay_days'],10)
        self.assertEqual(f['consecutive_late_invoice_count'],2)
        self.assertEqual(f['current_overdue_count_ge_7d'],1)
        self.assertEqual(f['current_overdue_count_ge_30d'],0)

    def test_future_payment_and_future_invoice_invariance(self):
        first = payment_features(self.bills,'2026-03-31',205000,90)
        changed = self.bills.iloc[:3].copy()
        changed.loc[2,'paid_date'] = None
        second = payment_features(changed,'2026-03-31',205000,90)
        for name in PAYMENT_FEATURES:
            np.testing.assert_equal(first[name],second[name],err_msg=name)

    def test_short_history_and_no_payment(self):
        self.bills['paid_date'] = None
        f = payment_features(self.bills,'2026-01-31',205000,31)
        self.assertEqual(f['due_invoice_count_30d'],1)
        self.assertTrue(pd.isna(f['due_invoice_count_60d']))
        self.assertTrue(pd.isna(f['days_since_last_payment']))
        self.assertEqual(f['current_overdue_invoice_count'],1)

    def test_due_today_is_not_late(self):
        self.bills = self.bills.iloc[:1].copy()
        self.bills.loc[0,'due_date'] = '2026-01-31'
        self.bills.loc[0,'paid_date'] = None
        f = payment_features(self.bills,'2026-01-31',205000,31)
        self.assertEqual(f['late_invoice_count_30d'],0)
        self.assertEqual(f['current_overdue_invoice_count'],0)

    def test_six_invoice_trend(self):
        due = pd.to_datetime(['2026-01-10','2026-02-10','2026-03-10','2026-04-10','2026-05-10','2026-06-10'])
        paid = due + pd.to_timedelta([0,0,0,3,6,9],unit='D')
        bills = pd.DataFrame({'issued_date':(due-pd.Timedelta(days=9)).strftime('%Y-%m-%d'),
                              'due_date':due.strftime('%Y-%m-%d'),'paid_date':paid.strftime('%Y-%m-%d'),'amount_vnd':205000})
        f = payment_features(bills,'2026-06-30',205000,181)
        self.assertEqual(f['delay_change_recent3_vs_previous3_days'],6)
        self.assertEqual(f['late_rate_change_recent3_vs_previous3'],1)


class MultiWindowChecks(unittest.TestCase):
    def fixture(self):
        snapshots = pd.DataFrame({'customer_id':['A'], 'snapshot_date':['2026-03-31'],
            'service_issue_days_30d':[30], 'monthly_fee_vnd':[205000], 'billing_mode':['Prepaid']})
        for feature in FEATURES:
            if feature not in snapshots:
                snapshots[feature] = np.nan
        dates = pd.date_range('2026-01-01','2026-04-15')
        daily = pd.DataFrame({'customer_id':'A','service_date':dates.strftime('%Y-%m-%d'),'telemetry_observed':True,
            'usage_gb':10.,'disconnect_count':1,'outage_minutes':5.,'evening_speed_ratio':.8,
            'service_issue':1,'plan_change_request':0,'monthly_fee_vnd':205000})
        tickets = pd.DataFrame(columns=['customer_id','opened_date','resolved_date'])
        contacts = pd.DataFrame(columns=['customer_id','contact_date','is_repeat'])
        bills = pd.DataFrame(columns=['customer_id','issued_date','due_date','paid_date','amount_vnd'])
        return snapshots,daily,tickets,contacts,bills

    def test_window_values_prepaid_and_unavailable_history(self):
        f = build_extended_features(*self.fixture()).iloc[0]
        self.assertEqual(f['disconnect_count_7d'],7)
        self.assertEqual(f['outage_minutes_60d'],300)
        self.assertEqual(f['usage_gb_90d'],900)
        self.assertTrue(pd.isna(f['usage_change_pct_60d']))
        self.assertTrue(f[PAYMENT_FEATURES].isna().all())
        self.assertEqual(f['opened_tickets_90d'],0)

    def test_future_daily_history_invariance(self):
        args = list(self.fixture())
        original = build_extended_features(*args)
        args[1] = args[1].loc[args[1]['service_date'].le('2026-03-31')].copy()
        earlier = build_extended_features(*args)
        pd.testing.assert_frame_equal(original,earlier)

    def test_group_coverage_and_no_duplicate_features(self):
        mapped = [f for fs in extended_groups().values() for f in fs]
        self.assertCountEqual(mapped,EXTENDED_FEATURES)
        self.assertEqual(len(mapped),len(set(mapped)))


if __name__=='__main__':
    unittest.main()
