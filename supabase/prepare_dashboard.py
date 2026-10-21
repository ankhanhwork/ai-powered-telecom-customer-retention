"""Prepare append-only operational demo batches from frozen v5 + local care fixture."""
import hashlib
import json
import sys
import uuid
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml'))
from predict import load_bundle,predict_frame

def uid(value): return str(uuid.uuid5(uuid.NAMESPACE_URL,'retention:dashboard-v1:'+value))
def sql_json(value): return '$payload$'+json.dumps(value,ensure_ascii=False,allow_nan=False)+'$payload$'

def main():
 out=ROOT/'tmp/dashboard-cloud';out.mkdir(parents=True,exist_ok=True)
 fixture=json.loads((ROOT/'website/app/.dashboard-fixture.json').read_text(encoding='utf-8'))
 backup=json.loads((ROOT/'tmp/dashboard-cloud-before.json').read_text(encoding='utf-8'))
 config=json.loads((ROOT/'ml/config.json').read_text(encoding='utf-8'))
 existing_agent=next(s['user_id'] for s in backup['staff'] if s['role']=='agent')
 supervisor=next(s['user_id'] for s in backup['staff'] if s['role']=='supervisor')
 staff={s['id']:existing_agent if i==0 else uid(s['id']) for i,s in enumerate(fixture['staff'])}
 current_map={c['ref']:c['id'] for c in backup['customer_map']}
 protected={c['customer_id'] for c in backup['cases'] if c['assigned_agent_id'] is not None}
 records=[c for c in fixture['cases'] if c['start']!='2026-10-11' or current_map[c['customer']] not in protected]
 keys={(c['customer'],c['start']) for c in records if c['start']!='2026-10-11'}
 chunks=[]
 for chunk in pd.read_csv(ROOT/'data/synthetic/final/rolling_month_v5/features_127.csv',chunksize=10000):
  wanted=[(str(c),str(s)) in keys for c,s in zip(chunk.customer_id,chunk.target_period_start)]
  chunks.append(chunk.loc[wanted,['customer_id','snapshot_date','target_period_start','target_period_end_exclusive']+config['features']])
 frame=pd.concat(chunks,ignore_index=True)
 assert len(frame)==300
 bundle=load_bundle(ROOT/config['models_dir']/'champion')
 predictions=predict_frame(bundle,frame)
 feature_map={(r['customer_id'],r['target_period_start']):r for r in frame.to_dict('records')}
 pred_map={(r['customer_id'],r['target_period_start']):r for r in predictions.to_dict('records')}
 source_hash=hashlib.sha256((ROOT/'website/app/.dashboard-fixture.json').read_bytes()).hexdigest()
 payloads=[]
 category={'Connectivity':'connection_issue','Billing':'billing','Renewal':'plan_change','Service quality':'other'}
 for c in records:
  p={**c,'historical':c['start']!='2026-10-11','owner':staff.get(c['owner']),'supervisor':supervisor,
     'marker_id':uid(c['id']+':marker'),'case_id':uid(c['id']), 'conversation_id':uid(c['id']+':conversation')}
  p['events']=[{**e,'id':uid(e['id']),'message_id':uid(e['id']+':message'),'approval_id':uid(e['id']+':approval'),
                'outbox_id':uid(e['id']+':outbox')} for e in fixture['events'] if e['case_id']==c['id']]
  t=next((t for t in fixture['tasks'] if t['case_id']==c['id']),None)
  p['task']={**t,'id':uid(t['id'])} if t else None
  t=next((t for t in fixture['tickets'] if t['case_id']==c['id']),None)
  # Queued historical imports must never wake the support worker.
  p['ticket']={**t,'id':uid(t['id']),'category':category[t['category']],
               'status':'draft' if t['status']=='queued' else t['status']} if t else None
  if p['historical']:
   raw=feature_map[(c['customer'],c['start'])];pred=pred_map[(c['customer'],c['start'])]
   p['features']={k:None if pd.isna(raw[k]) else raw[k] for k in config['features']}
   p['run']={k:pred[k] for k in ['dataset_version','model_version','calibration_version','snapshot_date','target_period_start','target_period_end_exclusive']}
   p['run'].update(run_key='dashboard-v1:'+c['start'],source_sha256=source_hash,is_synthetic=True)
   p['prediction']={k:pred[k] for k in ['raw_probability','churn_probability','explanations_status']}
   p['prediction']['explanation_version']=None
   p['profile']=dict(display_name='Customer '+c['customer'],contract_ref='DEMO-'+c['customer'],
      plan_name='Internet',monthly_fee=p['features']['monthly_fee_vnd'],billing_mode=p['features']['billing_mode'],
      currency='VND',tenure_months=int(p['features']['tenure_months']))
  payloads.append(p)
 assert len(payloads)==504
 template=(ROOT/'supabase/seed_dashboard_case.sql').read_text(encoding='utf-8')
 for i in range(0,len(payloads),12):
  (out/f'batch-{i//12:03}.sql').write_text('begin;\nset local lock_timeout=\'5s\';\n'+template.replace('__PAYLOAD__',sql_json(payloads[i:i+12]))+'\ncommit;',encoding='utf-8')
 init=['begin;']
 for s in fixture['staff'][1:]:
  staff_id=staff[s['id']]
  init.append(f"insert into auth.users(id,banned_until,raw_app_meta_data) values('{staff_id}','infinity','{{\"dashboard_roster_only\":true}}') on conflict(id) do nothing;")
  init.append(f"insert into public.staff_members(user_id,display_name,role) values('{staff_id}','{s['name']}','agent') on conflict(user_id) do nothing;")
 init.append('commit;')
 (out/'init.sql').write_text('\n'.join(init),encoding='utf-8')
 (out/'payloads.json').write_text(json.dumps(payloads,ensure_ascii=False,allow_nan=False),encoding='utf-8')
 (out/'manifest.json').write_text(json.dumps(dict(version='dashboard-v1',cases=len(payloads),historical=300,current=204,
   staff=staff,supervisor=supervisor,model_sha256=bundle[1]['model_sha256'],batches=(len(payloads)+11)//12),indent=2),encoding='utf-8')
 rollback=(ROOT/'supabase/rollback_dashboard.sql').read_text(encoding='utf-8')
 rollback=rollback.replace('__BACKUP__',sql_json(backup)).replace('__STAFF__',sql_json(list(staff.values())[1:]))
 (out/'rollback.sql').write_text(rollback,encoding='utf-8')
 print(json.dumps(dict(cases=len(payloads),historical=300,current=204,protected=3,model_unchanged=True)))

if __name__=='__main__': main()
