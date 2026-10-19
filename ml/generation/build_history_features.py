"""Derive three as-of features from existing histories; never read or change labels."""
from pathlib import Path

import numpy as np
import pandas as pd

from generate_sample import FEATURES, GROUPS

EXTRA_GROUPS = {
    'Support Experience': ['oldest_open_ticket_days'],
    'Connection Quality': ['consecutive_issue_months'],
    'Usage & Engagement': ['usage_change_pct_7d'],
}
EXTRA_FEATURES = [f for features in EXTRA_GROUPS.values() for f in features]


def groups_for(features):
    return {group: [f for f in original + EXTRA_GROUPS.get(group, []) if f in features]
            for group, original in GROUPS.items()}


def build_features(snapshots, daily, tickets):
    """Use service_date < next midnight, and ticket status at that same cutoff.

    consecutive_issue_months: current 30d issue state plus consecutive qualifying
    prior calendar month-end states; extra snapshots never increment the count.
    usage_change_pct_7d: last 7 days versus preceding 7, all 14 observed.
    oldest_open_ticket_days: oldest ticket still open, including older than 30d.
    """
    assert not snapshots.duplicated(['customer_id', 'snapshot_date']).any()
    assert not daily.duplicated(['customer_id', 'service_date']).any()
    result = snapshots.copy()
    for column in EXTRA_FEATURES:
        result[column] = np.nan
    days_by_id = {cid: part.sort_values('service_date') for cid, part in daily.groupby('customer_id')}
    tickets_by_id = {cid: part for cid, part in tickets.groupby('customer_id')}
    for cid, rows in result.groupby('customer_id', sort=False):
        days = days_by_id[cid]
        dates = np.asarray(days['service_date'], dtype='datetime64[D]')
        usage = pd.to_numeric(days['usage_gb']).to_numpy(dtype=float)
        observed = days['telemetry_observed'].to_numpy(dtype=bool) & np.isfinite(usage)
        sums = np.r_[0., np.cumsum(np.where(observed, usage, 0.))]
        missing = np.r_[0, np.cumsum(~observed)]
        own_tickets = tickets_by_id.get(cid)
        if own_tickets is not None:
            opened = np.asarray(own_tickets['opened_date'], dtype='datetime64[D]')
            resolved = pd.to_datetime(own_tickets['resolved_date']).to_numpy(dtype='datetime64[D]')
        streak, previous_month = 0, None
        for idx, row in rows.sort_values('snapshot_date').iterrows():
            snapshot = np.datetime64(row['snapshot_date'], 'D')
            cutoff = snapshot + np.timedelta64(1, 'D')
            a, b, c = np.searchsorted(dates, [cutoff-np.timedelta64(14,'D'), cutoff-np.timedelta64(7,'D'), cutoff])
            if b-a == 7 and c-b == 7 and missing[c] == missing[a] and sums[b] > sums[a]:
                result.at[idx, 'usage_change_pct_7d'] = 100*((sums[c]-sums[b])/(sums[b]-sums[a])-1)
            age = 0
            if own_tickets is not None:
                still_open = (opened < cutoff) & (np.isnat(resolved) | (resolved >= cutoff))
                if still_open.any():
                    age = int((snapshot-opened[still_open].min()) / np.timedelta64(1, 'D'))
            result.at[idx, 'oldest_open_ticket_days'] = age
            month = pd.Period(row['snapshot_date'], freq='M')
            if previous_month is not None and month != previous_month + 1:
                streak = 0
            if pd.isna(row['service_issue_days_30d']):
                current_streak = 0
            else:
                current_streak = streak + 1 if row['service_issue_days_30d'] >= 3 else 0
                result.at[idx, 'consecutive_issue_months'] = current_streak
            if pd.Timestamp(row['snapshot_date']).is_month_end:
                streak,previous_month = current_streak,month
    assert result['oldest_open_ticket_days'].ge(0).all()
    assert result['consecutive_issue_months'].dropna().between(0,result['snapshot_date'].str[:7].nunique()).all()
    pd.testing.assert_frame_equal(snapshots, result[snapshots.columns])
    return result


def load_and_build(folder):
    folder = Path(folder)
    return build_features(
        pd.read_csv(folder / 'customer_features.csv'),
        pd.read_csv(folder / 'daily_service_history.csv', usecols=['customer_id','service_date','usage_gb','telemetry_observed']),
        pd.read_csv(folder / 'support_tickets.csv'))
