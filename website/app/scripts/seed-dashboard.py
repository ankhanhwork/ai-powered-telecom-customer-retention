"""Build a read-only local dashboard fixture; never writes ML inputs or Supabase."""
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'data/synthetic/final/rolling_month_v5'
AS_OF = '2026-10-21T10:00:00+00:00'
staff = [{'id': f'demo-agent-{i}', 'name': name} for i, name in enumerate(
    ['Nguyễn Minh Anh', 'Trần Thu Hà', 'Lê Hoàng Nam', 'Phạm Ngọc Linh'], 1)]
cases, events, tasks, tickets = [], [], [], []
labels = {}
with (SOURCE / 'churn_labels.csv').open(encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        if row['target_period_start'] in ('2026-08-01', '2026-09-01', '2026-10-11'):
            labels[(row['customer_id'], row['target_period_start'])] = row

def stamp(day, hour=9):
    return (datetime.fromisoformat(day).replace(tzinfo=timezone(timedelta(hours=7)))
            + timedelta(hours=hour)).isoformat()

def add(row, index, historical, score=None):
    start = row['target_period_start']
    identity = f"fixture:{start}:{row['customer_id']}"
    churn_date = row['churn_date'] or None
    owner = None if not historical and index % 17 == 0 else staff[index % 4]['id']
    offset = index % (9 if not historical else 20)
    day = datetime.fromisoformat(start) + timedelta(days=offset)
    if churn_date:
        day = min(day, datetime.fromisoformat(churn_date) - timedelta(days=1))
    day = max(day, datetime.fromisoformat(start))
    created = stamp(day.date().isoformat(), 8)
    states = ['new', 'in_progress', 'waiting_customer', 'resolving_request', 'closed']
    stage = 'closed' if historical else states[(index * 7 % 19) % 5]
    if owner is None:
        stage = 'new'
    # Closed care splits into Care completed / Failed (no answer, wrong number) like the Agent queue.
    contact = 'not_contacted' if stage == 'new' else (['no_answer', 'wrong_contact'][index % 2] if stage == 'closed' and index % 6 == 0 else 'contacted')
    known = historical and index % 11 != 0
    outcome = float(row['churn_next_month']) == 1 if known else None
    record = dict(id=identity, ref=f"DEMO-{start[:7]}-{index+1:03}", customer=row['customer_id'],
                  owner=owner, start=start, end=row['target_period_end_exclusive'], stage=stage, contact=contact,
                  created_at=created, outcome=outcome, churn_date=churn_date,
                  score=score, priority='high' if index % 4 == 0 else 'normal',
                  primary_issue=['Connection quality', 'Billing & payments', 'Support experience',
                                 'Renewal & promotions', 'Usage & engagement', 'Plan & pricing'][
                                     int(hashlib.sha256(identity.encode()).hexdigest()[:8], 16) % 6],
                  source='Synthetic care fixture; outcome from frozen v5 labels')
    cases.append(record)
    def event(kind, hours):
        at = (datetime.fromisoformat(created) + timedelta(hours=hours)).isoformat()
        # Same-day churn has no reliable time: record no pre-churn care for that day.
        if churn_date and at[:10] >= churn_date:
            return
        events.append(dict(id=f'{identity}:{kind}', case_id=identity, actor=owner,
                           type=kind, at=at))
    if owner:
        event('assigned', 0)
    if stage != 'new' and (not churn_date or created[:10] < churn_date):
        event('approved', 1)
        event('sent', 2)
        if index % 4 != 0:
            event('reply', 4)
        if index % 3 == 0:
            event('call_answered' if index % 2 else 'call_no_answer', 5)
        if index % 4 == 0:
            status = 'sent' if historical else ['queued', 'sent', 'failed'][index % 3]
            tickets.append(dict(id=identity+':ticket', case_id=identity, actor=owner,
                                category=['Connectivity', 'Billing', 'Renewal', 'Service quality'][index % 7 % 4],
                                status=status, at=(datetime.fromisoformat(created)+timedelta(hours=6)).isoformat()))
        if stage == 'closed':
            event('closed', 7)
        else:
            tasks.append(dict(id=identity+':follow-up', case_id=identity, owner=owner,
                              due_at=stamp('2026-10-20' if index % 3 == 0 else '2026-10-22'),
                              status='pending'))
        if not historical and index % 13 == 0:
            event('delivery_failed', 6)

# A deterministic, unstratified subset; do not tune outcome rates to a desired story.
for start in ('2026-08-01', '2026-09-01'):
    pool = [r for (_, period), r in labels.items() if period == start]
    pool.sort(key=lambda r: hashlib.sha256((start+r['customer_id']).encode()).hexdigest())
    for i, row in enumerate(pool[:150]):
        add(row, i, True)
with (ROOT / 'data/inference/final/rolling_month_v5/predictions.csv').open(encoding='utf-8-sig', newline='') as f:
    current = [r for r in csv.DictReader(f) if r['target_period_start'] == '2026-10-11'
               and float(r['churn_probability']) > .5]
for i, prediction in enumerate(current):
    add(labels[(prediction['customer_id'], '2026-10-11')], i, False, float(prediction['churn_score']))

churn_events = {}
with (SOURCE / 'churn_labels.csv').open(encoding='utf-8-sig', newline='') as f:
    for row in csv.DictReader(f):
        if row['churn_date']:
            churn_events[row['customer_id']] = row['churn_date']
monthly = Counter(day[:7] for day in churn_events.values())
payload = dict(version=1, local_fixture=True, as_of=AS_OF, staff=staff, cases=cases,
               events=events, tasks=tasks, tickets=tickets,
               historical_churn=[dict(month=m, count=n) for m, n in sorted(monthly.items())],
               historical_cutoff='2026-10-19',
               source='Frozen synthetic rolling_month_v5 labels; care activities are simulated locally')
assert len(current) == 207 and len(cases) == 507
assert len({c['id'] for c in cases}) == len(cases)
by_id = {c['id']: c for c in cases}
assert all(c['outcome'] is None for c in cases if c['start'] == '2026-10-11')
assert all(c['outcome'] is None or c['outcome'] == (float(labels[(c['customer'], c['start'])]['churn_next_month']) == 1) for c in cases)
assert any(c['outcome'] is True for c in cases) and any(c['outcome'] is False for c in cases)
assert all(c['owner'] is None or c['owner'] in {s['id'] for s in staff} for c in cases)
assert all(e['at'] >= by_id[e['case_id']]['created_at'] for e in events)
assert all(not by_id[e['case_id']]['churn_date'] or e['at'][:10] < by_id[e['case_id']]['churn_date'] for e in events)
out = ROOT / 'website/app/.dashboard-fixture.json'
out.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps(dict(cases=len(cases), events=len(events), staff=len(staff),
                     known=sum(c['outcome'] is not None for c in cases), output=str(out))))
