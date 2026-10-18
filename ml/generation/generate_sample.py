"""Generate a reproducible synthetic month-end panel (sample or full cohort).

Only Customer ID and tenure seed are read from the public Internet cohort.
Original status, churn reasons, and company Python code are never inputs.
Label months after the report cutoff stay Unknown. All times are Vietnam local
for calendar boundaries and UTC for storage. No financial offer is activated.
"""
import argparse
import calendar
import hashlib
import json
import math
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

VN = timezone(timedelta(hours=7))
VERSION = 'synthetic_monthend_v3'
GROUPS = {
    'Connection Quality': ['disconnect_count_30d', 'outage_minutes_30d', 'evening_speed_ratio_30d', 'service_issue_days_30d'],
    'Usage & Engagement': ['usage_gb_7d', 'usage_gb_30d', 'usage_change_pct_30d', 'inactive_days_14d'],
    'Billing & Payment': ['monthly_fee_vnd', 'fee_change_pct_30d', 'overdue_days', 'overdue_amount_vnd'],
    'Renewal & Promotions': ['billing_mode', 'prepaid_days_remaining', 'promo_days_remaining'],
    'Support Experience': ['support_contacts_30d', 'unresolved_tickets_30d', 'repeat_contacts_30d', 'avg_resolution_hours_90d'],
    'Customer Relationship & Plan': ['tenure_months', 'plan_speed_mbps', 'plan_change_requests_30d'],
}
FEATURES = [f for group in GROUPS.values() for f in group]


def next_month(d):
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def utc_at(d, hour=0):
    return datetime.combine(d, time(hour), VN).astimezone(timezone.utc).isoformat()


def frame(rows, columns):
    return pd.DataFrame(rows, columns=columns)


def split_name(d):
    if d.month <= 6:
        return 'train'
    if d.month == 7:
        return 'validation'
    if d.month == 8:
        return 'test'
    return 'inference'


def generate(source, size, seed, asof):
    source_df = pd.read_csv(source, usecols=['Customer ID', 'Tenure in Months', 'Internet Service'])
    cohort = source_df.loc[source_df['Internet Service'].eq('Yes')].sort_values('Customer ID')
    if not 1 <= size <= len(cohort):
        raise ValueError('sample size outside Internet source cohort')
    selected = cohort.sample(size, random_state=seed).sort_values('Customer ID')
    profiles, service, bills, tickets, contacts, snapshots, labels = [], [], [], [], [], [], []
    start = date(2026, 1, 1)
    for customer_index, source_row in enumerate(selected.to_dict('records'), 1):
        if customer_index == 1 or customer_index % 250 == 0:
            print(f'Generating customer {customer_index}/{size}', file=sys.stderr, flush=True)
        cid = source_row['Customer ID']
        customer_seed = int(hashlib.sha256(f'{seed}:{cid}'.encode()).hexdigest()[:16], 16)
        rng = np.random.default_rng(customer_seed)
        tenure_seed = int(source_row['Tenure in Months'])
        plan_i = int(rng.choice(3, p=[0.7, 0.2, 0.1]))
        # These speeds/prices are a demo catalog, not verified FPT products.
        fee, speed = [205000, 250000, 300000][plan_i], [100, 300, 500][plan_i]
        mode = str(rng.choice(['Prepaid', 'Postpaid']))
        quality = float(rng.beta(2, 4))
        disengagement = float(rng.beta(2, 3))
        financial = float(rng.beta(2, 4))
        service_delay = float(rng.beta(2, 3))
        usage_level = float(rng.uniform(4, 20))
        prepaid_expiry = start + timedelta(days=int(rng.integers(10, 150))) if mode == 'Prepaid' else None
        promo_expiry = start + timedelta(days=int(rng.integers(20, 250))) if rng.random() < .45 else None
        profiles.append({'customer_id': cid, 'tenure_seed_jan': tenure_seed, 'billing_mode': mode,
                         'is_synthetic': True, 'dataset_version': VERSION, 'source_role': 'id_and_tenure_seed_only'})
        own_days, own_tickets, own_contacts, own_bills = [], [], [], []
        churn_on = None
        current = start
        while current < asof:
            if churn_on is not None and current >= churn_on:
                break
            if current.day == 1 and mode == 'Postpaid':
                late = int(rng.choice([0, 3, 12, 22], p=[.60, .20, .14, .06]))
                due = current + timedelta(days=9)
                paid = None if rng.random() < .04 + financial * .12 else due + timedelta(days=late)
                invoice = {'customer_id':cid,'invoice_id':f'{cid}-{current:%Y%m}',
                           'issued_date':current,'due_date':due,'paid_date':paid,'amount_vnd':fee}
                own_bills.append(invoice)
            if prepaid_expiry and current >= prepaid_expiry and rng.random() < .35:
                prepaid_expiry = current + timedelta(days=int(rng.choice([30,90,180])))
            if current.day == 1 and current.month > 1 and rng.random() < .07:
                fee = int(max(150000, fee + int(rng.choice([-10000,10000,20000]))))
            incident = int(rng.poisson(.025 + .22*quality))
            outage = float(min(240, incident * rng.uniform(5, 55)))
            telemetry = bool(rng.random() > .002)
            speed_ratio = float(np.clip(rng.normal(1-.5*quality-.12*bool(incident), .10), .15, 1.1)) if telemetry else None
            inactive = bool(rng.random() < .015 + disengagement*.12)
            usage = 0.0 if inactive else max(0.0, float(rng.normal(usage_level * (1-.045*(current.month-1)*disengagement), usage_level*.25)))
            usage *= max(.1, 1-outage/500)
            day_row = {'customer_id':cid,'service_date':current,'observed_at':utc_at(current+timedelta(days=1)),
                       'telemetry_observed':telemetry,'usage_gb':round(usage,3) if telemetry else None,
                       'disconnect_count':incident,'outage_minutes':round(outage,2),
                       'evening_speed_ratio':round(speed_ratio,4) if telemetry else None,
                       'service_issue':int(bool(incident) or (speed_ratio is not None and speed_ratio<.65)),
                       'monthly_fee_vnd':fee,'plan_speed_mbps':speed,
                       'prepaid_expiry_date':prepaid_expiry,'promo_expiry_date':promo_expiry,
                       'plan_change_request':int(rng.random()<.002+financial*.006)}
            own_days.append(day_row)
            if rng.random() < .008 + quality*.012 + bool(incident)*.07:
                opened = [t for t in own_tickets if t['opened_date']<=current and (t['resolved_date'] is None or t['resolved_date']>current)]
                repeat = bool(opened and rng.random()<.65)
                if repeat:
                    ticket = opened[-1]
                else:
                    duration = int(rng.integers(1, max(3, int(3+service_delay*18))))
                    resolution = None if rng.random()<.12 else current + timedelta(days=duration)
                    ticket = {'customer_id':cid,'ticket_id':f'{cid}-T{len(own_tickets)+1:03d}',
                              'opened_date':current,'resolved_date':resolution}
                    own_tickets.append(ticket)
                own_contacts.append({'customer_id':cid,'contact_date':current,'ticket_id':ticket['ticket_id'],'is_repeat':int(repeat)})

            if current.day == calendar.monthrange(current.year,current.month)[1]:
                cutoff = current+timedelta(days=1)
                d = pd.DataFrame(own_days)
                def window(n, offset=0):
                    return d.loc[d['service_date'].ge(cutoff-timedelta(days=n+offset)) & d['service_date'].lt(cutoff-timedelta(days=offset))]
                w30,w14,w7,prev30=window(30),window(14),window(7),window(30,30)
                def complete(w,n):
                    return len(w)==n and bool(w['telemetry_observed'].all())
                def sum_usage(w,n):
                    return round(float(w['usage_gb'].sum()),3) if complete(w,n) else None
                recent_gb,previous_gb=sum_usage(w30,30),sum_usage(prev30,30)
                support30=[t for t in own_tickets if cutoff-timedelta(days=30)<=t['opened_date']<cutoff]
                closed90=[t for t in own_tickets if t['resolved_date'] is not None and cutoff-timedelta(days=90)<=t['resolved_date']<cutoff]
                contact30=[c for c in own_contacts if cutoff-timedelta(days=30)<=c['contact_date']<cutoff]
                overdue=[b for b in own_bills if b['issued_date']<cutoff and b['due_date']<cutoff and (b['paid_date'] is None or b['paid_date']>=cutoff)]
                old_fees=d.loc[d['service_date'].eq(current-timedelta(days=30)),'monthly_fee_vnd']
                old_fee=float(old_fees.iloc[0]) if len(old_fees) else None
                f={
                    'disconnect_count_30d':int(w30['disconnect_count'].sum()) if len(w30)==30 else None,
                    'outage_minutes_30d':round(float(w30['outage_minutes'].sum()),2) if len(w30)==30 else None,
                    'evening_speed_ratio_30d':round(float(w30['evening_speed_ratio'].mean()),4) if complete(w30,30) else None,
                    'service_issue_days_30d':int(w30['service_issue'].sum()) if len(w30)==30 else None,
                    'usage_gb_7d':sum_usage(w7,7),'usage_gb_30d':recent_gb,
                    'usage_change_pct_30d':round(100*(recent_gb-previous_gb)/previous_gb,2) if recent_gb is not None and previous_gb is not None and previous_gb>0 else None,
                    'inactive_days_14d':int(w14['usage_gb'].eq(0).sum()) if complete(w14,14) else None,
                    'monthly_fee_vnd':fee,'fee_change_pct_30d':round(100*(fee-old_fee)/old_fee,2) if old_fee else None,
                    'overdue_days':max((current-b['due_date']).days for b in overdue) if overdue else (0 if mode=='Postpaid' else None),
                    'overdue_amount_vnd':sum(b['amount_vnd'] for b in overdue) if mode=='Postpaid' else None,
                    'billing_mode':mode,'prepaid_days_remaining':max(0,(prepaid_expiry-current).days) if prepaid_expiry else None,
                    'promo_days_remaining':max(0,(promo_expiry-current).days) if promo_expiry else None,
                    'support_contacts_30d':len(contact30),
                    'unresolved_tickets_30d':sum(t['resolved_date'] is None or t['resolved_date']>=cutoff for t in support30),
                    'repeat_contacts_30d':sum(c['is_repeat'] for c in contact30),
                    'avg_resolution_hours_90d':round(float(np.mean([(t['resolved_date']-t['opened_date']).days*24 for t in closed90])),2) if closed90 and len(own_days)>=90 else None,
                    'tenure_months':tenure_seed+current.month-1,'plan_speed_mbps':speed,
                    'plan_change_requests_30d':int(w30['plan_change_request'].sum()),
                }
                target_start=cutoff
                target_end=next_month(target_start)
                known=target_end<=asof
                split=split_name(current) if known else 'inference'
                metadata={'customer_id':cid,'snapshot_date':str(current),'cutoff_at':utc_at(cutoff),
                          'target_period_start':str(target_start),'target_period_end_exclusive':str(target_end),
                          'split':split,'is_synthetic':True,'dataset_version':VERSION,
                          'history_days_available':len(own_days),'observed_days_30d':len(w30),
                          'telemetry_days_30d':int(w30['telemetry_observed'].sum())}
                snapshots.append({**metadata,**f})
                y=None
                if known:
                    # Features/latent traits precede outcome. No original y is read.
                    usage_drop=max(0,-(f['usage_change_pct_30d'] or 0)/100)
                    z=-5.5 + .12*(f['disconnect_count_30d'] or 0) + 1.2*(1-(f['evening_speed_ratio_30d'] or .8))
                    z+=.65*min(f['unresolved_tickets_30d'],3)+.7*min(usage_drop,1)+.025*(f['overdue_days'] or 0)
                    z+=.6*financial+float(rng.normal(0,.7))
                    probability=1/(1+math.exp(-min(12,max(-12,z))))
                    y=int(rng.random()<probability)
                    if y:
                        churn_on=target_start+timedelta(days=int(rng.integers(0,(target_end-target_start).days)))
                labels.append({'customer_id':cid,'snapshot_date':str(current),
                               'target_period_start':str(target_start),'target_period_end_exclusive':str(target_end),
                               'churn_next_month':y,'label_status':'Simulated complete month' if known else 'Unknown',
                               'label_observed_at':utc_at(target_end) if known else None,
                               'churn_date':str(churn_on) if y else None,'is_synthetic':True,'dataset_version':VERSION})
            current+=timedelta(days=1)
        service.extend(own_days)
        # Future scheduled resolution/payment is not exported as an observed event.
        bills.extend([{**b,'paid_date':b['paid_date'] if b['paid_date'] and b['paid_date']<asof else None} for b in own_bills])
        tickets.extend([{**t,'resolved_date':t['resolved_date'] if t['resolved_date'] and t['resolved_date']<asof else None} for t in own_tickets])
        contacts.extend(own_contacts)
    tables={
        'customers':pd.DataFrame(profiles),
        'daily_service_history':pd.DataFrame(service),
        'billing_history':frame(bills,['customer_id','invoice_id','issued_date','due_date','paid_date','amount_vnd']),
        'support_tickets':frame(tickets,['customer_id','ticket_id','opened_date','resolved_date']),
        'support_contacts':frame(contacts,['customer_id','contact_date','ticket_id','is_repeat']),
        'customer_features':pd.DataFrame(snapshots),
        'churn_labels':pd.DataFrame(labels),
    }
    tables['churn_labels']['churn_next_month']=tables['churn_labels']['churn_next_month'].astype('Int64')
    latest=max(tables['customer_features']['snapshot_date'])
    tables['inference_latest']=tables['customer_features'].loc[tables['customer_features']['snapshot_date'].eq(latest)].copy()
    return tables


def validate(tables, asof):
    x,y=tables['customer_features'],tables['churn_labels']
    assert len(FEATURES)==len(set(FEATURES))==22
    assert not x.duplicated(['customer_id','snapshot_date']).any()
    assert not y.duplicated(['customer_id','snapshot_date']).any()
    assert len(x)==len(y)
    assert 'churn_next_month' not in x
    assert 'latent_risk' not in x
    assert x['snapshot_date'].map(date.fromisoformat).lt(asof).all()
    assert x['snapshot_date'].map(lambda s:date.fromisoformat(s).day==calendar.monthrange(date.fromisoformat(s).year,date.fromisoformat(s).month)[1]).all()
    assert (x['repeat_contacts_30d']<=x['support_contacts_30d']).all()
    assert (x['service_issue_days_30d'].dropna()<=30).all()
    assert x.loc[x['billing_mode'].eq('Postpaid'),'prepaid_days_remaining'].isna().all()
    assert x.loc[x['billing_mode'].eq('Prepaid'),['overdue_days','overdue_amount_vnd']].isna().all().all()
    assert y.loc[y['target_period_end_exclusive'].map(date.fromisoformat).gt(asof),'churn_next_month'].isna().all()
    assert y.loc[y['churn_next_month'].notna(),'label_observed_at'].notna().all()
    daily=tables['daily_service_history']
    daily_by_customer={cid:part for cid,part in daily.groupby('customer_id')}
    tickets_by_customer={cid:part for cid,part in tables['support_tickets'].groupby('customer_id')}
    contacts_by_customer={cid:part for cid,part in tables['support_contacts'].groupby('customer_id')}
    for label in y.loc[y['churn_next_month'].eq(1)].to_dict('records'):
        events=daily_by_customer[label['customer_id']]
        assert not events['service_date'].ge(date.fromisoformat(label['churn_date'])).any()
        assert not x.loc[x['customer_id'].eq(label['customer_id']),'snapshot_date'].ge(label['churn_date']).any()
    # Reconcile monthly service sums directly to source history, one snapshot at a time.
    for row in x.to_dict('records'):
        cutoff=date.fromisoformat(row['snapshot_date'])+timedelta(days=1)
        own_daily=daily_by_customer[row['customer_id']]
        w=own_daily.loc[own_daily['service_date'].ge(cutoff-timedelta(days=30)) & own_daily['service_date'].lt(cutoff)]
        assert len(w)==row['observed_days_30d']
        if pd.notna(row['disconnect_count_30d']):
            assert row['disconnect_count_30d']==w['disconnect_count'].sum()
        if row['history_days_available']<90:
            assert pd.isna(row['avg_resolution_hours_90d'])
        own_tickets=tickets_by_customer.get(row['customer_id'])
        if own_tickets is not None:
            open_window=own_tickets.loc[own_tickets['opened_date'].ge(cutoff-timedelta(days=30)) & own_tickets['opened_date'].lt(cutoff)]
            unresolved=sum(d is None or pd.isna(d) or d>=cutoff for d in open_window['resolved_date'])
            assert row['unresolved_tickets_30d']==unresolved
        own_contacts=contacts_by_customer.get(row['customer_id'])
        if own_contacts is not None:
            count=int((own_contacts['contact_date'].ge(cutoff-timedelta(days=30)) & own_contacts['contact_date'].lt(cutoff)).sum())
            assert row['support_contacts_30d']==count
    month_summary=[]
    for month,part in x.groupby('snapshot_date'):
        outcome=y.loc[y['snapshot_date'].eq(month),'churn_next_month']
        month_summary.append({'snapshot_date':month,'customers':len(part),'known_labels':int(outcome.notna().sum()),
                              'churned':int(outcome.sum()) if outcome.notna().any() else None,
                              'split':part['split'].iloc[0]})
    return {'checks_passed':True,'customers':len(tables['customers']),'model_features':22,
            'snapshot_rows':len(x),'month_summary':month_summary,
            'rows_by_table':{k:len(v) for k,v in tables.items()},
            'feature_null_counts':{k:int(v) for k,v in x[FEATURES].isna().sum().items()},
            'limitations':['Synthetic cohort; no evidence of real FPT prediction performance.',
                           'Generation QA only; model metrics belong to a separate training run.',
                           'Latest incomplete target month remains Unknown; no future month-end snapshot.',
                           'Simulator calibration and final group/action mapping await review.']}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--sample-size',type=int,default=50)
    p.add_argument('--seed',type=int,default=42)
    p.add_argument('--as-of',default='2026-10-17')
    p.add_argument('--quality-output',type=Path)
    a=p.parse_args()
    asof=date.fromisoformat(a.as_of)
    if a.output.exists():
        raise ValueError('Use a new output directory; existing sample will not be overwritten')
    if asof.year!=2026 or asof<=date(2026,2,1):
        raise ValueError('This simulator is scoped to 2026, after first January snapshot')
    tables=generate(a.source,a.sample_size,a.seed,asof)
    quality=validate(tables,asof)
    manifest={'dataset_version':VERSION,'is_synthetic':True,'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),
              'source_fields_read':['Customer ID','Tenure in Months','Internet Service'],
              'report_as_of':a.as_of,'observed_through':str(asof-timedelta(days=1)),
              'seed':a.seed,'sample_size':a.sample_size,'feature_whitelist':FEATURES,'categorical_features':['billing_mode'],
              'feature_groups_provisional':GROUPS,'grouping_requires_shap_and_actionability_review':True,
              'target':'churn during calendar month immediately after snapshot_date',
              'timezone':'Asia/Ho_Chi_Minh; cutoff_at exported UTC',
              'split_policy':'Train Jan-Jun snapshots (targets Feb-Jul); validation Jul (target Aug); test Aug (target Sep); latest Sep inference (target Oct). Recurring customers allowed; no customer ID feature.',
              'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'catalog_status':'Hypothetical simulator prices/speeds, not approved customer offers or verified FPT catalog.',
              'synthetic_outcome_status':'Synthetic completed months only; not real customer observations or validated FPT predictions.',
              'model':'LightGBM planned, native pandas categorical; no model trained',
              'quality':quality}
    a.output.mkdir(parents=True)
    for name,table in tables.items():
        table.to_csv(a.output/f'{name}.csv',index=False,encoding='utf-8')
    (a.output/'dataset_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    if a.quality_output:
        a.quality_output.parent.mkdir(parents=True,exist_ok=True)
        a.quality_output.write_text(json.dumps(quality,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(quality,ensure_ascii=True,indent=2))


if __name__=='__main__':
    main()
