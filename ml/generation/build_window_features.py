"""Multi-window service/support and as-of payment features. Never reads labels.

All windows are [next midnight - N days, next midnight). Missing history is
NaN, not zero. Postpaid invoice features are not applicable to prepaid users.
Future payment/resolution dates cannot change earlier feature values.
"""
from pathlib import Path

import numpy as np
import pandas as pd

from build_history_features import EXTRA_FEATURES, build_features, groups_for
from generate_sample import FEATURES

SERVICE_WINDOWS = (7, 14, 30, 60, 90)
BILLING_WINDOWS = (30, 60, 90)


def feature_dictionary():
    rows = []
    def add(name, group, window, definition, postpaid=False):
        if name not in FEATURES + EXTRA_FEATURES:
            rows.append(dict(feature=name, group=group, window_days=window,
                             definition=definition, postpaid_only=postpaid))
    for n in SERVICE_WINDOWS:
        for stem, definition in [('disconnect_count','Count of disconnections'), ('outage_minutes','Total outage minutes'),
                                  ('evening_speed_ratio','Mean evening measured speed / plan speed'), ('service_issue_days','Days with a service issue')]:
            add(f'{stem}_{n}d','Connection Quality',n,definition)
        for stem, definition in [('usage_gb','Total measured usage in GB'), ('inactive_days','Observed zero-usage days')]:
            add(f'{stem}_{n}d','Usage & Engagement',n,definition)
        for stem, definition in [('support_contacts','Support contact count'), ('repeat_contacts','Repeat contact count'),
                                  ('opened_tickets','Newly opened ticket count'), ('unresolved_tickets','Tickets opened in window and still open at cutoff'),
                                  ('avg_resolution_hours','Mean duration of tickets resolved in window')]:
            add(f'{stem}_{n}d','Support Experience',n,definition)
        add(f'plan_change_requests_{n}d','Customer Relationship & Plan',n,'Count of plan-change requests')
    for n in (14, 60, 90):
        add(f'usage_change_pct_{n}d','Usage & Engagement',2*n,f'Percent change of last {n} days versus preceding {n}; all days measured, positive denominator')
    for n in (60,90):
        add(f'fee_change_pct_{n}d','Billing & Payment',n+1,f'Percent fee change from snapshot minus {n} days')
    for n in BILLING_WINDOWS:
        for stem, definition in [
            ('due_invoice_count','Invoices due in window'),
            ('late_invoice_count','Due-cohort invoices paid late or currently past due'),
            ('late_invoice_rate','Late invoice count / due invoice count'),
            ('observed_delay_mean_days','Mean nonnegative payment delay over due-cohort; unpaid measured only through snapshot'),
            ('observed_delay_max_days','Maximum observed payment delay over due-cohort'),
            ('late_paid_invoice_count','Due-cohort invoices already paid after due date'),
            ('on_time_paid_invoice_rate','Due-cohort invoices already paid on/before due date / due count'),
            ('unpaid_overdue_invoice_count','Due-cohort invoices still unpaid and past due'),
            ('unpaid_overdue_amount_vnd','Outstanding due-cohort amount past due'),
            ('due_cohort_paid_ratio','Paid amount of due-cohort / total due-cohort amount'),
            ('payment_count','Payments observed in window, irrespective of invoice due window'),
            ('paid_amount_vnd','Total invoice amounts paid in window')]:
            add(f'{stem}_{n}d','Billing & Payment',n,definition,True)
    for name, definition in [
        ('current_overdue_invoice_count','All currently unpaid invoices with at least one day past due'),
        ('current_overdue_days_mean','Mean age past due of all currently unpaid overdue invoices; zero if none'),
        ('current_overdue_amount_to_fee','Current unpaid overdue amount / current monthly fee'),
        ('days_since_last_payment','Days since latest observed payment; NaN if none'),
        ('last_payment_delay_days','Nonnegative delay of latest observed payment; NaN if none'),
        ('consecutive_late_invoice_count','Backward streak of late invoices in due-date order'),
        ('delay_change_recent3_vs_previous3_days','Mean observed delay of last 3 due invoices minus preceding 3; requires 6'),
        ('late_rate_change_recent3_vs_previous3','Late rate of last 3 due invoices minus preceding 3; requires 6')]:
        add(name,'Billing & Payment',0,definition,True)
    for n in (7,30,60):
        add(f'current_overdue_count_ge_{n}d','Billing & Payment',0,f'Currently unpaid invoices at least {n} days past due',True)
    for n in (30,60):
        add(f'current_overdue_amount_ge_{n}d_vnd','Billing & Payment',0,f'Currently unpaid amount at least {n} days past due',True)
    return pd.DataFrame(rows)


DICTIONARY = feature_dictionary()
NEW_FEATURES = DICTIONARY['feature'].tolist()
EXTENDED_FEATURES = FEATURES + EXTRA_FEATURES + NEW_FEATURES
PAYMENT_FEATURES = DICTIONARY.loc[DICTIONARY['postpaid_only'],'feature'].tolist()
assert len(EXTENDED_FEATURES) == len(set(EXTENDED_FEATURES))


def extended_groups(features=EXTENDED_FEATURES):
    result = groups_for(FEATURES + EXTRA_FEATURES)
    for group, part in DICTIONARY.groupby('group'):
        result[group] += part['feature'].tolist()
    return {group:[f for f in fs if f in features] for group,fs in result.items()}


def payment_features(bills, snapshot, monthly_fee, history_days):
    """Standalone, testable payment calculations; snapshot is an ISO date.

    Unpaid invoice delay is right-censored at snapshot, never its future paid_date.
    An invoice due today and not yet paid has delay 0, not a late invoice.
    """
    out = {feature:np.nan for feature in PAYMENT_FEATURES}
    today = np.datetime64(snapshot,'D')
    cutoff = today + np.timedelta64(1,'D')
    issued = pd.to_datetime(bills['issued_date']).to_numpy(dtype='datetime64[D]')
    due = pd.to_datetime(bills['due_date']).to_numpy(dtype='datetime64[D]')
    paid = pd.to_datetime(bills['paid_date']).to_numpy(dtype='datetime64[D]')
    amount = bills['amount_vnd'].to_numpy(dtype=float)
    known = issued < cutoff
    paid_known = known & ~np.isnat(paid) & (paid < cutoff)
    mature = known & (due < cutoff)
    effective_end = np.where(paid_known,paid,today)
    delay = np.maximum(0,(effective_end-due)/np.timedelta64(1,'D'))
    late = mature & (delay > 0)
    unpaid_late = late & ~paid_known
    for n in BILLING_WINDOWS:
        if history_days < n:
            continue
        w = mature & (due >= cutoff-np.timedelta64(n,'D'))
        count = int(w.sum())
        payments = paid_known & (paid >= cutoff-np.timedelta64(n,'D'))
        values = {
            'due_invoice_count':count, 'late_invoice_count':int((w & late).sum()),
            'late_invoice_rate':float(late[w].mean()) if count else np.nan,
            'observed_delay_mean_days':float(delay[w].mean()) if count else np.nan,
            'observed_delay_max_days':float(delay[w].max()) if count else np.nan,
            'late_paid_invoice_count':int((w & late & paid_known).sum()),
            'on_time_paid_invoice_rate':float((paid_known[w] & (paid[w]<=due[w])).mean()) if count else np.nan,
            'unpaid_overdue_invoice_count':int((w & unpaid_late).sum()),
            'unpaid_overdue_amount_vnd':float(amount[w & unpaid_late].sum()),
            'due_cohort_paid_ratio':float(amount[w & paid_known].sum()/amount[w].sum()) if count and amount[w].sum()>0 else np.nan,
            'payment_count':int(payments.sum()), 'paid_amount_vnd':float(amount[payments].sum()),
        }
        out.update({f'{stem}_{n}d':value for stem,value in values.items()})
    out['current_overdue_invoice_count'] = int(unpaid_late.sum())
    out['current_overdue_days_mean'] = float(delay[unpaid_late].mean()) if unpaid_late.any() else 0.
    out['current_overdue_amount_to_fee'] = float(amount[unpaid_late].sum()/monthly_fee) if monthly_fee>0 else np.nan
    if paid_known.any():
        last = np.flatnonzero(paid_known)[np.argmax(paid[paid_known])]
        out['days_since_last_payment'] = float((today-paid[last])/np.timedelta64(1,'D'))
        out['last_payment_delay_days'] = float(delay[last])
    order = np.flatnonzero(mature)[np.argsort(due[mature], kind='stable')]
    streak = 0
    for index in order[::-1]:
        if not late[index]:
            break
        streak += 1
    out['consecutive_late_invoice_count'] = streak
    if len(order)>=6:
        out['delay_change_recent3_vs_previous3_days'] = float(delay[order[-3:]].mean()-delay[order[-6:-3]].mean())
        out['late_rate_change_recent3_vs_previous3'] = float(late[order[-3:]].mean()-late[order[-6:-3]].mean())
    for n in (7,30,60):
        out[f'current_overdue_count_ge_{n}d'] = int((unpaid_late & (delay>=n)).sum())
    for n in (30,60):
        out[f'current_overdue_amount_ge_{n}d_vnd'] = float(amount[unpaid_late & (delay>=n)].sum())
    return out


def build_extended_features(snapshots, daily, tickets, contacts, bills):
    base = build_features(snapshots,daily,tickets)
    output_rows = []
    daily_groups = {cid:part.sort_values('service_date') for cid,part in daily.groupby('customer_id')}
    ticket_groups = {cid:part for cid,part in tickets.groupby('customer_id')}
    contact_groups = {cid:part for cid,part in contacts.groupby('customer_id')}
    bill_groups = {cid:part for cid,part in bills.groupby('customer_id')}
    empty_bills = bills.iloc[:0]
    for customer_index,(cid,rows) in enumerate(base.groupby('customer_id',sort=False),1):
        if customer_index == 1 or customer_index % 1000 == 0:
            print(f'Expanding windows: {customer_index} customers',flush=True)
        days = daily_groups[cid]
        dates = np.asarray(days['service_date'],dtype='datetime64[D]')
        observed = days['telemetry_observed'].to_numpy(dtype=bool)
        cols = {'disconnect_count':'disconnect_count', 'outage_minutes':'outage_minutes',
                'evening_speed_ratio':'evening_speed_ratio', 'service_issue_days':'service_issue',
                'usage_gb':'usage_gb','plan_change_requests':'plan_change_request'}
        arrays = {stem:days[column].to_numpy(dtype=float) for stem,column in cols.items()}
        sums = {stem:np.r_[0.,np.cumsum(np.nan_to_num(values,nan=0.))] for stem,values in arrays.items()}
        sums['inactive_days'] = np.r_[0.,np.cumsum(observed & (arrays['usage_gb']==0))]
        missing = np.r_[0,np.cumsum(~observed | ~np.isfinite(arrays['usage_gb']) | ~np.isfinite(arrays['evening_speed_ratio']))]
        own_tickets = ticket_groups.get(cid)
        opened = np.asarray(own_tickets['opened_date'],dtype='datetime64[D]') if own_tickets is not None else np.array([],dtype='datetime64[D]')
        resolved = pd.to_datetime(own_tickets['resolved_date']).to_numpy(dtype='datetime64[D]') if own_tickets is not None else np.array([],dtype='datetime64[D]')
        own_contacts = contact_groups.get(cid)
        contact_dates = np.asarray(own_contacts['contact_date'],dtype='datetime64[D]') if own_contacts is not None else np.array([],dtype='datetime64[D]')
        repeats = own_contacts['is_repeat'].to_numpy(dtype=int) if own_contacts is not None else np.array([],dtype=int)
        for idx,row in rows.iterrows():
            result = {feature:np.nan for feature in NEW_FEATURES}
            cutoff = np.datetime64(row['snapshot_date'],'D') + np.timedelta64(1,'D')
            end = np.searchsorted(dates,cutoff)
            for n in SERVICE_WINDOWS:
                start = np.searchsorted(dates,cutoff-np.timedelta64(n,'D'))
                complete = end-start == n
                telemetry_complete = complete and missing[end]==missing[start]
                for stem,prefix in sums.items():
                    name = f'{stem}_{n}d'
                    if name not in result or not complete:
                        continue
                    if stem in ('usage_gb','inactive_days','evening_speed_ratio') and not telemetry_complete:
                        continue
                    value = prefix[end]-prefix[start]
                    result[name] = value/n if stem=='evening_speed_ratio' else value
                if complete:
                    lower = cutoff-np.timedelta64(n,'D')
                    contact_window = (contact_dates>=lower) & (contact_dates<cutoff)
                    opened_window = (opened>=lower) & (opened<cutoff)
                    resolved_window = ~np.isnat(resolved) & (resolved>=lower) & (resolved<cutoff) & (opened<cutoff)
                    support_values = {'support_contacts':int(contact_window.sum()),
                                      'repeat_contacts':int(repeats[contact_window].sum()),
                                      'opened_tickets':int(opened_window.sum()),
                                      'unresolved_tickets':int((opened_window & (np.isnat(resolved) | (resolved>=cutoff))).sum()),
                                      'avg_resolution_hours':float(((resolved[resolved_window]-opened[resolved_window])/np.timedelta64(1,'h')).mean()) if resolved_window.any() else np.nan}
                    result.update({f'{stem}_{n}d':value for stem,value in support_values.items() if f'{stem}_{n}d' in result})
            for n in (14,60,90):
                start,mid = np.searchsorted(dates,[cutoff-np.timedelta64(2*n,'D'),cutoff-np.timedelta64(n,'D')])
                if mid-start==n and end-mid==n and missing[end]==missing[start]:
                    prev = sums['usage_gb'][mid]-sums['usage_gb'][start]
                    if prev>0:
                        result[f'usage_change_pct_{n}d'] = 100*((sums['usage_gb'][end]-sums['usage_gb'][mid])/prev-1)
            for n in (60,90):
                target_day = cutoff-np.timedelta64(n+1,'D')
                pos = np.searchsorted(dates,target_day)
                if pos<len(dates) and dates[pos]==target_day:
                    old_fee = float(days.iloc[pos]['monthly_fee_vnd'])
                    result[f'fee_change_pct_{n}d'] = 100*(row['monthly_fee_vnd']/old_fee-1) if old_fee>0 else np.nan
            if row['billing_mode']=='Postpaid':
                result.update(payment_features(bill_groups.get(cid,empty_bills),row['snapshot_date'],row['monthly_fee_vnd'],end))
            output_rows.append({'_index':idx,**result})
    extra = pd.DataFrame(output_rows).set_index('_index').reindex(base.index)
    output = pd.concat([base,extra],axis=1)
    pd.testing.assert_frame_equal(output[base.columns],base)
    assert not output[EXTENDED_FEATURES].select_dtypes(include='number').isin([np.inf,-np.inf]).any().any()
    assert output.loc[output['billing_mode'].eq('Prepaid'),PAYMENT_FEATURES].isna().all().all()
    return output


def load_and_build_extended(folder):
    folder = Path(folder)
    return build_extended_features(pd.read_csv(folder/'customer_features.csv'),
        pd.read_csv(folder/'daily_service_history.csv',usecols=['customer_id','service_date','telemetry_observed','usage_gb',
            'disconnect_count','outage_minutes','evening_speed_ratio','service_issue','plan_change_request','monthly_fee_vnd']),
        pd.read_csv(folder/'support_tickets.csv'),pd.read_csv(folder/'support_contacts.csv'),pd.read_csv(folder/'billing_history.csv'))


if __name__=='__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Output exists; do not overwrite a frozen feature matrix')
    result = load_and_build_extended(args.data)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    result.to_csv(args.output,index=False)
    print(f'Wrote {len(result)} snapshots with {len(EXTENDED_FEATURES)} model features')
