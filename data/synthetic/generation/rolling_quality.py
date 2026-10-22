"""Validate rolling calendar-month windows against a single customer churn event."""
from datetime import date
import pandas as pd


def validate_rolling(tables, asof):
    x,y = tables['customer_features'],tables['churn_labels']
    keys = ['customer_id','snapshot_date']
    assert not x.duplicated(keys).any() and not y.duplicated(keys).any()
    assert len(x)==len(y) and 'churn_next_month' not in x
    snapshots = pd.to_datetime(x['snapshot_date'])
    starts,ends = pd.to_datetime(y['target_period_start']),pd.to_datetime(y['target_period_end_exclusive'])
    assert (snapshots.dt.day.isin([10,20]) | snapshots.dt.is_month_end).all()
    assert snapshots.lt(pd.Timestamp(asof)).all()
    assert (starts.to_numpy()==(snapshots+pd.Timedelta(days=1)).to_numpy()).all()
    assert (ends==starts.map(lambda d:d+pd.DateOffset(months=1))).all()
    known = ends.le(pd.Timestamp(asof))
    assert y.loc[known,'churn_next_month'].notna().all()
    assert y.loc[~known,'churn_next_month'].isna().all()
    assert y.loc[known,'label_observed_at'].notna().all()
    events = y.dropna(subset=['churn_date']).groupby('customer_id')['churn_date']
    assert events.nunique().le(1).all()
    event_dates = events.first()
    for name,column in [('customer_features','snapshot_date'),('daily_service_history','service_date'),
                        ('support_tickets','opened_date'),('support_contacts','contact_date'),('billing_history','issued_date')]:
        table = tables[name]
        churn = table['customer_id'].map(event_dates)
        assert (churn.isna() | pd.to_datetime(table[column]).lt(pd.to_datetime(churn))).all()
    observed = y['customer_id'].map(event_dates)
    expected = observed.notna() & pd.to_datetime(observed).ge(starts) & pd.to_datetime(observed).lt(ends)
    assert (y.loc[known,'churn_next_month'].astype(int)==expected[known].astype(int)).all()
    assert x.loc[x['billing_mode'].eq('Prepaid'),['overdue_days','overdue_amount_vnd']].isna().all().all()
    assert not {'episode','generation_probability','max_severity'} & set(x.columns)
    return {'checks_passed':True,'snapshot_rows':len(x),'customers':len(tables['customers']),
            'known_labels':int(known.sum()),'positive_labels':int(y['churn_next_month'].sum()),
            'unknown_labels':int((~known).sum()),'single_event_consistency':True,
            'calendar_month_windows':True,'rows_by_table':{k:len(v) for k,v in tables.items()}}
