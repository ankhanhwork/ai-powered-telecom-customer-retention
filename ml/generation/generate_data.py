"""Versioned, deliberately strong-signal simulation; preserves v3 code and data.

This changes the prediction task to an easier synthetic world. Higher AUC here
is not improvement on the same data, nor evidence of real FPT performance.
Public labels/reasons are never read. Episode and outcome RNGs are separate.
"""
import argparse
import calendar
import hashlib
import json
import math
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from generate_sample import FEATURES, GROUPS, frame, next_month, utc_at, validate


def rng_for(seed, cid, namespace):
    key = hashlib.sha256(f'{seed}:{cid}:{namespace}'.encode()).hexdigest()
    return np.random.default_rng(int(key[:16],16))


def cohort_role(cid, config):
    value = int(hashlib.sha256(f"{config['holdout_hash_salt']}:{cid}".encode()).hexdigest()[:16],16)
    return 'audit_holdout' if value % config['holdout_modulus']==config['holdout_remainder'] else 'development'


def split_for(snapshot, role, complete):
    if not complete or snapshot.month==9:
        return 'inference'
    if role=='audit_holdout':
        return 'test' if snapshot.month==8 else 'holdout_history'
    if snapshot.month<=6:
        return 'train'
    return 'validation' if snapshot.month==7 else 'unused_development'


def canonical_features(days, bills, tickets, contacts, snapshot, tenure, mode):
    """Same 22-feature contract as v3, aggregated strictly before cutoff."""
    cutoff = snapshot+timedelta(days=1)
    d = pd.DataFrame(days)
    def window(n, offset=0):
        return d.loc[d['service_date'].ge(cutoff-timedelta(days=n+offset)) & d['service_date'].lt(cutoff-timedelta(days=offset))]
    def usage(w,n):
        return float(w['usage_gb'].sum()) if len(w)==n and w['telemetry_observed'].all() else None
    w30,w14,w7,previous = window(30),window(14),window(7),window(30,30)
    recent,prior = usage(w30,30),usage(previous,30)
    opened = [t for t in tickets if cutoff-timedelta(days=30)<=t['opened_date']<cutoff]
    closed = [t for t in tickets if t['resolved_date'] and cutoff-timedelta(days=90)<=t['resolved_date']<cutoff]
    contact30 = [c for c in contacts if cutoff-timedelta(days=30)<=c['contact_date']<cutoff]
    overdue = [b for b in bills if b['issued_date']<cutoff and b['due_date']<cutoff and b['paid_date']>=cutoff]
    old_fee = d.loc[d['service_date'].eq(snapshot-timedelta(days=30)),'monthly_fee_vnd']
    latest = days[-1]
    f = {
        'disconnect_count_30d':int(w30['disconnect_count'].sum()) if len(w30)==30 else None,
        'outage_minutes_30d':float(w30['outage_minutes'].sum()) if len(w30)==30 else None,
        'evening_speed_ratio_30d':float(w30['evening_speed_ratio'].mean()) if len(w30)==30 and w30['telemetry_observed'].all() else None,
        'service_issue_days_30d':int(w30['service_issue'].sum()) if len(w30)==30 else None,
        'usage_gb_7d':usage(w7,7),'usage_gb_30d':recent,
        'usage_change_pct_30d':100*(recent/prior-1) if recent is not None and prior is not None and prior>0 else None,
        'inactive_days_14d':int(w14['usage_gb'].eq(0).sum()) if len(w14)==14 and w14['telemetry_observed'].all() else None,
        'monthly_fee_vnd':latest['monthly_fee_vnd'],
        'fee_change_pct_30d':100*(latest['monthly_fee_vnd']/old_fee.iloc[0]-1) if len(old_fee) else None,
        'overdue_days':max((snapshot-b['due_date']).days for b in overdue) if overdue else (0 if mode=='Postpaid' else None),
        'overdue_amount_vnd':sum(b['amount_vnd'] for b in overdue) if mode=='Postpaid' else None,
        'billing_mode':mode,
        'prepaid_days_remaining':max(0,(latest['prepaid_expiry_date']-snapshot).days) if latest['prepaid_expiry_date'] else None,
        'promo_days_remaining':max(0,(latest['promo_expiry_date']-snapshot).days) if latest['promo_expiry_date'] else None,
        'support_contacts_30d':len(contact30),
        'unresolved_tickets_30d':sum(t['resolved_date']>=cutoff for t in opened),
        'repeat_contacts_30d':sum(c['is_repeat'] for c in contact30),
        'avg_resolution_hours_90d':float(np.mean([(t['resolved_date']-t['opened_date']).days*24 for t in closed])) if closed and len(days)>=90 else None,
        'tenure_months':tenure+snapshot.month-1,'plan_speed_mbps':latest['plan_speed_mbps'],
        'plan_change_requests_30d':int(w30['plan_change_request'].sum()),
    }
    return f


def outcome_probability(f,days,bills,tickets,snapshot,config,outcome_rng):
    """Rare severe observable states yield steep, explicitly designed hazards.

    Latent episode names never enter the model or this hazard. Components are
    reconstructed from observed facts; probability is audit-only, not a feature.
    """
    cutoff = snapshot+timedelta(days=1)
    clip = lambda value:float(np.clip(value,0,1))
    speed = f['evening_speed_ratio_30d']
    connection = max(clip(((f['disconnect_count_30d'] or 0)-5)/10),clip((.75-(speed if speed is not None else .9))/.35))
    mature = [b for b in bills if cutoff-timedelta(days=30)<=b['due_date']<cutoff]
    delays = [max(0,((b['paid_date'] if b['paid_date']<cutoff else snapshot)-b['due_date']).days) for b in mature]
    billing = clip((max(delays,default=0)-5)/15)
    age = max(((snapshot-t['opened_date']).days for t in tickets if t['opened_date']<cutoff and t['resolved_date']>=cutoff),default=0)
    support = max(clip((age-7)/14),clip((f['repeat_contacts_30d']-1)/3))
    drop = max(0,-(f['usage_change_pct_30d'] or 0))
    usage = max(clip((drop-25)/45),clip(((f['inactive_days_14d'] or 0)-3)/5))
    remaining = [f[key] for key in ['prepaid_days_remaining','promo_days_remaining'] if f[key] is not None]
    renewal = 1. if any(0<=value<=3 for value in remaining) else 0.
    old = [row['monthly_fee_vnd'] for row in days if row['service_date']==snapshot-timedelta(days=60)]
    price = clip(((100*(f['monthly_fee_vnd']/old[0]-1) if old else 0)-10)/25)
    values = dict(connection=connection,billing=billing,support=support,usage=usage,renewal=renewal,price=price)
    maximum = max(values.values())
    z = config['hazard_intercept']+config['hazard_max_severity_weight']*maximum
    z += config['hazard_secondary_weight']*(sum(values.values())-maximum)
    z += float(outcome_rng.normal(0,config['hazard_logit_noise_sd']))
    return 1/(1+math.exp(-z)),values


def generate_v4(source,size,config):
    asof,seed = date.fromisoformat(config['as_of']),config['seed']
    public = pd.read_csv(source,usecols=['Customer ID','Tenure in Months','Internet Service'])
    public = public.loc[public['Internet Service'].eq('Yes')].sort_values('Customer ID')
    if not 1<=size<=len(public):
        raise ValueError('Invalid cohort size')
    public = public.sample(size,random_state=seed).sort_values('Customer ID')
    profiles,service,invoices,all_tickets,all_contacts,snapshots,labels,audit = [],[],[],[],[],[],[],[]
    start = date(2026,1,1)
    for number,source_row in enumerate(public.to_dict('records'),1):
        if number==1 or number%500==0:
            print(f"Generating {config['dataset_version']} customer {number}/{size}",flush=True)
        cid = source_row['Customer ID']
        role = cohort_role(cid,config)
        profile_rng = rng_for(seed,cid,'profile')
        mode = str(profile_rng.choice(['Prepaid','Postpaid']))
        plan = int(profile_rng.choice(3,p=[.7,.2,.1]))
        fee,speed = [205000,250000,300000][plan],[100,300,500][plan]
        usage_level = float(profile_rng.uniform(5,20))
        tenure = int(source_row['Tenure in Months'])
        expiry = start+timedelta(days=int(profile_rng.integers(45,120))) if mode=='Prepaid' else None
        promo = None
        profiles.append(dict(customer_id=cid,tenure_seed_jan=tenure,billing_mode=mode,cohort_role=role,
                             is_synthetic=True,dataset_version=config['dataset_version'],source_role='id_and_tenure_seed_only'))
        days,bills,tickets,contacts = [],[],[],[]
        churn_on = None
        rolling = config.get('snapshot_schedule')=='three_per_month'
        episode = 'None'
        own_snapshots = []
        month = start
        while month<asof:
            if churn_on is not None and churn_on<=month:
                break
            month_end = date(2026,month.month,calendar.monthrange(2026,month.month)[1])
            n = month_end.day
            rng = rng_for(seed,cid,f'events:{month:%Y%m}')
            if not rolling or episode=='None' or rng.random()>=config['episode_persistence']:
                episode = str(rng.choice(config['episode_choices'])) if rng.random()<config['monthly_episode_probability'] else 'None'
            if episode=='Payment' and mode=='Prepaid':
                episode = 'Renewal'
            if episode=='Price':
                fee = min(650000,int(round(fee*1.4/1000)*1000))
            if promo is not None and promo<month:
                promo = None
            if episode=='Renewal':
                if mode=='Prepaid':
                    expiry = month_end+timedelta(days=2)
                else:
                    promo = month_end+timedelta(days=2)
            if mode=='Postpaid':
                due = month+timedelta(days=9)
                delay = int(rng.integers(30,46)) if episode=='Payment' else int(rng.choice([0,1,3],p=[.85,.10,.05]))
                bills.append(dict(customer_id=cid,invoice_id=f'{cid}-{month:%Y%m}',issued_date=month,
                                  due_date=due,paid_date=due+timedelta(days=delay),amount_vnd=fee))
            disconnects = rng.poisson(.8 if episode=='Connection' else .025,size=n)
            outages = np.minimum(240,disconnects*rng.uniform(10,60,size=n))
            ratios = np.clip(rng.normal(.38 if episode=='Connection' else .95,.055,size=n),.1,1.1)
            telemetry = rng.random(n)>.001
            inactive = rng.random(n)<(.65 if episode=='Usage' else .015)
            usage = np.maximum(0,rng.normal(usage_level*(.15 if episode=='Usage' else 1),usage_level*.15,size=n))
            usage[inactive] = 0
            changes = rng.random(n)<(.10 if episode=='Price' else .001)
            contact_days = {int(rng.integers(1,n+1))} if rng.random()<.12 else set()
            if episode=='Support':
                contact_days = {5,10,15,20,25}
            active_ticket = None
            for day in range(1,n+1):
                current = date(2026,month.month,day)
                if current>=asof or (churn_on is not None and current>=churn_on):
                    break
                if expiry is not None and expiry<=current:
                    expiry = current+timedelta(days=90)
                if promo is not None and promo<current:
                    promo = None
                if current.day in contact_days:
                    if active_ticket is None:
                        duration = int(rng.integers(32,45)) if episode=='Support' else int(rng.integers(1,4))
                        active_ticket = dict(customer_id=cid,ticket_id=f'{cid}-T{len(tickets)+1:03d}',
                                             opened_date=current,resolved_date=current+timedelta(days=duration))
                        tickets.append(active_ticket)
                        repeat = 0
                    else:
                        repeat = 1
                    contacts.append(dict(customer_id=cid,contact_date=current,ticket_id=active_ticket['ticket_id'],is_repeat=repeat))
                i = day-1
                days.append(dict(customer_id=cid,service_date=current,observed_at=utc_at(current+timedelta(days=1)),
                    telemetry_observed=bool(telemetry[i]),usage_gb=round(float(usage[i]),3) if telemetry[i] else None,
                    disconnect_count=int(disconnects[i]),outage_minutes=round(float(outages[i]),2),
                    evening_speed_ratio=round(float(ratios[i]),4) if telemetry[i] else None,
                    service_issue=int(disconnects[i]>0 or (telemetry[i] and ratios[i]<.65)),
                    monthly_fee_vnd=fee,plan_speed_mbps=speed,prepaid_expiry_date=expiry,promo_expiry_date=promo,
                    plan_change_request=int(changes[i])))
                if rolling and (day in (10,20) or current==month_end):
                    cutoff = current+timedelta(days=1)
                    target_end = (pd.Timestamp(cutoff)+pd.DateOffset(months=1)).date()
                    f = canonical_features(days,bills,tickets,contacts,current,tenure,mode)
                    own_snapshots.append(dict(customer_id=cid,snapshot_date=str(current),cutoff_at=utc_at(cutoff),
                        target_period_start=str(cutoff),target_period_end_exclusive=str(target_end),
                        split='unassigned',cohort_role=role,is_synthetic=True,dataset_version=config['dataset_version'],
                        history_days_available=len(days),observed_days_30d=min(30,len(days)),
                        telemetry_days_30d=sum(d['telemetry_observed'] for d in days[-30:]),**f))
                    label_rng = rng_for(seed,cid,f'hazard:{current.isoformat()}')
                    probability,components = outcome_probability(f,days,bills,tickets,current,config,label_rng)
                    daily_probability = -math.expm1(math.log1p(-min(probability,1-1e-12))/30)
                    wait = int(label_rng.geometric(max(daily_probability,1e-12)))-1
                    next_cutoff = date(current.year,current.month,21) if day==10 else (month_end+timedelta(days=1) if day==20 else date(cutoff.year,cutoff.month,11))
                    candidate = cutoff+timedelta(days=wait) if wait<400 else None
                    if candidate is not None and candidate<min(next_cutoff,asof):
                        churn_on = candidate
                    audit.append(dict(customer_id=cid,snapshot_date=str(current),episode=episode,
                        generation_probability=probability,daily_hazard=daily_probability,**components))
            if not rolling and days and days[-1]['service_date']==month_end:
                f = canonical_features(days,bills,tickets,contacts,month_end,tenure,mode)
                cutoff = month_end+timedelta(days=1)
                target_end = next_month(cutoff)
                known = target_end<=asof
                w30 = days[-30:]
                snapshots.append(dict(customer_id=cid,snapshot_date=str(month_end),cutoff_at=utc_at(cutoff),
                    target_period_start=str(cutoff),target_period_end_exclusive=str(target_end),
                    split=split_for(month_end,role,known),cohort_role=role,is_synthetic=True,dataset_version=config['dataset_version'],
                    history_days_available=len(days),observed_days_30d=len(w30),telemetry_days_30d=sum(d['telemetry_observed'] for d in w30),**f))
                y,probability,components = None,None,{}
                if known:
                    label_rng = rng_for(seed,cid,f'outcome:{cutoff:%Y%m}')
                    probability,components = outcome_probability(f,days,bills,tickets,month_end,config,label_rng)
                    y = int(label_rng.random()<probability)
                    if y:
                        churn_on = cutoff+timedelta(days=int(label_rng.integers(0,(target_end-cutoff).days)))
                labels.append(dict(customer_id=cid,snapshot_date=str(month_end),target_period_start=str(cutoff),
                    target_period_end_exclusive=str(target_end),churn_next_month=y,
                    label_status='Simulated complete month' if known else 'Unknown',label_observed_at=utc_at(target_end) if known else None,
                    churn_date=str(churn_on) if y else None,is_synthetic=True,dataset_version=config['dataset_version']))
                audit.append(dict(customer_id=cid,snapshot_date=str(month_end),episode=episode,generation_probability=probability,
                                  max_severity=max(components.values()) if components else None,**components))
            month = next_month(month)
        if rolling:
            snapshots.extend(own_snapshots)
            for row in own_snapshots:
                target_start = date.fromisoformat(row['target_period_start'])
                target_end = date.fromisoformat(row['target_period_end_exclusive'])
                known = target_end<=asof
                y = int(churn_on is not None and target_start<=churn_on<target_end) if known else None
                labels.append(dict(customer_id=cid,snapshot_date=row['snapshot_date'],target_period_start=str(target_start),
                    target_period_end_exclusive=str(target_end),churn_next_month=y,
                    label_status='Simulated complete rolling month' if known else 'Unknown',
                    label_observed_at=utc_at(target_end) if known else None,churn_date=str(churn_on) if y else None,
                    is_synthetic=True,dataset_version=config['dataset_version']))
            bills = [b for b in bills if churn_on is None or b['issued_date']<churn_on]
        service.extend(days)
        invoices.extend([{**b,'paid_date':b['paid_date'] if b['paid_date']<asof else None} for b in bills])
        all_tickets.extend([{**t,'resolved_date':t['resolved_date'] if t['resolved_date']<asof else None} for t in tickets])
        all_contacts.extend(contacts)
    tables = dict(customers=pd.DataFrame(profiles),daily_service_history=pd.DataFrame(service),
        billing_history=frame(invoices,['customer_id','invoice_id','issued_date','due_date','paid_date','amount_vnd']),
        support_tickets=frame(all_tickets,['customer_id','ticket_id','opened_date','resolved_date']),
        support_contacts=frame(all_contacts,['customer_id','contact_date','ticket_id','is_repeat']),
        customer_features=pd.DataFrame(snapshots),churn_labels=pd.DataFrame(labels))
    tables['churn_labels']['churn_next_month'] = tables['churn_labels']['churn_next_month'].astype('Int64')
    latest = tables['customer_features']['snapshot_date'].max() if config.get('snapshot_schedule')=='three_per_month' else '2026-09-30'
    tables['inference_latest'] = tables['customer_features'].loc[tables['customer_features']['snapshot_date'].eq(latest)].copy()
    return tables,pd.DataFrame(audit)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--config',type=Path,default=Path('ml/generation/simulator.json'))
    p.add_argument('--output',type=Path,default=Path('data/synthetic/final'))
    p.add_argument('--sample-size',type=int,default=5517)
    p.add_argument('--quality-output',type=Path,default=Path('docs/evidence/ml/generation_quality.json'))
    a = p.parse_args()
    if a.output.exists():
        raise ValueError('Choose a new output directory; no overwrite')
    config = json.loads(a.config.read_text(encoding='utf-8'))
    tables,audit = generate_v4(a.source,a.sample_size,config)
    print(f"Validating {config['dataset_version']} histories and snapshots",flush=True)
    if config.get('snapshot_schedule')=='three_per_month':
        from rolling_quality import validate_rolling
        quality = validate_rolling(tables,date.fromisoformat(config['as_of']))
    else:
        quality = validate(tables,date.fromisoformat(config['as_of']))
    x = tables['customer_features']
    train_ids = set(x.loc[x['split'].eq('train'),'customer_id'])
    test_ids = set(x.loc[x['split'].eq('test'),'customer_id'])
    assert train_ids.isdisjoint(test_ids)
    if config.get('snapshot_schedule')!='three_per_month':
        assert set(x.loc[x['split'].eq('test'),'snapshot_date'])=={'2026-08-31'}
    quality['customer_disjoint_test'] = True if config.get('snapshot_schedule')!='three_per_month' else 'Verified later by ml/data.py after partition assignment'
    quality['source_fields_read'] = ['Customer ID','Tenure in Months','Internet Service']
    quality['cohort_counts'] = tables['customers']['cohort_role'].value_counts().to_dict()
    quality['limitations'] = ['Deliberately easier strong-signal synthetic task; no real FPT evidence.',
                              'One locked config/seed; generated probabilities and episode labels are audit-only, never features.',
                              ('Rolling month windows overlap; incomplete windows Unknown, no real FPT evidence.' if config.get('snapshot_schedule')=='three_per_month' else 'One September test month, held-out customer IDs; October labels Unknown.')]
    a.output.mkdir(parents=True)
    for name,table in tables.items():
        table.to_csv(a.output/f'{name}.csv',index=False)
    audit.to_csv(a.output/'generation_audit_private.csv',index=False)
    sha = lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
    manifest = dict(config=config,source_sha256=sha(a.source),generator_sha256=sha(Path(__file__)),
        config_sha256=sha(a.config),dataset_version=config['dataset_version'],is_synthetic=True,
        feature_whitelist=FEATURES,feature_groups=GROUPS,quality=quality,
        synthetic_task_changed_from_v3=True,unapproved_fpt_catalog=True)
    (a.output/'dataset_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    a.quality_output.parent.mkdir(parents=True,exist_ok=True)
    a.quality_output.write_text(json.dumps(quality,indent=2),encoding='utf-8')
    print(json.dumps(quality,indent=2))


if __name__=='__main__':
    main()
