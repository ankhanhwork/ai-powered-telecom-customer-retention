import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const {PGlite}=await import('@electric-sql/pglite');
const db=new PGlite();
const source=await readFile(resolve(root,'supabase/tests/workspace.test.mjs'),'utf8');
await db.exec(source.match(/const bootstrap=`([\s\S]*?)`;/)[1]);
const fullSetup=await readFile(resolve(root,'supabase/setup.sql'),'utf8');
const marker=fullSetup.indexOf('-- Rolling calendar-month inference;');
await db.exec(marker<0?fullSetup:fullSetup.slice(0,marker)+'commit;');
const cfg={...JSON.parse(await readFile(resolve(root,'ml/config.json'),'utf8')),dataset_version:'synthetic_monthend_v4_strong_signal'};
const features=Object.fromEntries(cfg.features.map(k=>[k,k==='billing_mode'?'Prepaid':0]));
await db.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
const ingest=async p=>(await db.query('select public.retention_ingest_prediction($1,$2,$3,$4,$5,$6) as result',
 [p.p_run,p.p_customer_ref,p.p_features,p.p_prediction,p.p_context,p.p_profile])).rows[0].result;
const prior=await ingest({p_run:{run_key:'v4-preservation',dataset_version:cfg.dataset_version,model_version:'fixture',
 calibration_version:'identity',snapshot_date:'2026-09-30',target_period_start:'2026-10-01',source_sha256:'a'.repeat(64),is_synthetic:true},
 p_customer_ref:'OLD-DEMO',p_features:features,p_prediction:{raw_probability:.8,churn_probability:.8,explanations_status:'fixture',explanation_version:null},p_context:null,p_profile:{}});
await db.exec(await readFile(resolve(root,'supabase/migrations/20261019033021_rolling_month_v5_shap.sql'),'utf8'));
let passed=0;const checks=[];
async function test(name,fn){await fn();passed++;checks.push(name);console.log('PASS '+name)}
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const payloads=JSON.parse(await readFile(resolve(root,'supabase/tests/fixtures/import_payloads.json'),'utf8'));
const p=payloads[0];let got;
await test('migration retains v4 row and derives exact window end',async()=>{
 assert.equal(await scalar('select target_period_end_exclusive::text from public.retention_cases where id=$1',[prior.case_id]),'2026-11-01');
});
await test('v5 real SHAP payload imports unchanged and idempotently',async()=>{
 got=await ingest(p);assert.deepEqual(await ingest(p),got);
 assert.equal(await scalar('select churn_probability::float8 from public.churn_predictions where id=$1',[got.prediction_id]),p.p_prediction.churn_probability);
 assert.equal(await scalar('select target_period_end_exclusive::text from public.retention_cases where id=$1',[got.case_id]),'2026-11-11');
 assert.equal(await scalar('select snapshot_basis from public.customer_snapshots where customer_id=$1',[got.customer_id]),'synthetic_rolling_month');
});
await test('invalid horizon and unsupported issue day rejected',async()=>{
 await assert.rejects(()=>ingest({...p,p_run:{...p.p_run,target_period_end_exclusive:'2026-12-11'}}),/window end mismatch/);
 await assert.rejects(()=>ingest({...p,p_run:{...p.p_run,run_key:'bad-day',snapshot_date:'2026-10-11',target_period_start:'2026-10-12',target_period_end_exclusive:'2026-11-12'}}),/check constraint/);
});
await test('old model context cannot be attached to v5 prediction',async()=>{
 await assert.rejects(()=>ingest({...p,p_context:{...p.p_context,model_sha256:'0'.repeat(64)}}),/Care context contract mismatch/);
});
await test('backup and staging are private with RLS and no browser/worker privileges',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const table of ['v4_demo_backup','v5_import_stage'])
  assert.equal(await scalar(`select has_table_privilege($1,'app_private.${table}','SELECT,INSERT,UPDATE,DELETE')`,[role]),false);
 assert.equal(await scalar("select count(*)::int from pg_class where relnamespace='app_private'::regnamespace and relname in ('v4_demo_backup','v5_import_stage') and relrowsecurity"),2);
});
const agent='00000000-0000-4000-8000-000000000001';
await db.query('insert into auth.users(id) values($1)',[agent]);
await db.query("insert into public.staff_members(user_id,display_name,role) values($1,'Test supervisor','supervisor')",[agent]);
await db.query('update public.retention_cases set assigned_agent_id=$1 where id=$2',[agent,got.case_id]);
await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:agent})]);
await test('outcome remains blocked before rolling window completes',async()=>{
 await assert.rejects(()=>db.query("select public.retention_record_outcome($1,false,'fixture',true,now(),'fixture-evidence')",[got.case_id]),/complete target period/);
});
await test('queue and worker context expose exact start and end',async()=>{
 assert.equal(await scalar('select target_period_end_exclusive::text from public.retention_care_queue where case_id=$1',[got.case_id]),'2026-11-11');
 const job=await scalar("select public.retention_request_recommendation($1,'manual:explanation:rolling-test')",[got.case_id]);
 await db.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 const context=await scalar('select public.retention_worker_context($1)',[job]);
 assert.equal(context.target_period_end_exclusive,'2026-11-11');
 assert.equal(context.target_period_start,'2026-10-11');
});
await writeFile(resolve(root,'supabase/tests/rolling-results.json'),JSON.stringify({passed,checks,limits:['Local PGlite; Auth and Storage stubs; no multi-connection test.']},null,2));
await db.close();
