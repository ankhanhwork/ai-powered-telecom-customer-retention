import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
process.on('uncaughtException',error=>{console.error(JSON.stringify({error:error.message,detail:error.detail,code:error.code}));process.exit(1)});
const root=resolve(import.meta.dirname,'../..');
const {PGlite}=await import(pathToFileURL(resolve(root,'tmp/db-tests/node_modules/@electric-sql/pglite/dist/index.js')));
const db=new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text,banned_until timestamptz,raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb->>'role' $$;
grant usage on schema auth to authenticated,service_role,anon;grant execute on all functions in schema auth to authenticated,service_role,anon;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
select set_config('request.jwt.claims','{}',false);`);
await db.exec(await readFile(resolve(root,'supabase/setup.sql'),'utf8'));
await db.exec(await readFile(resolve(root,'supabase/migrations/20261021150146_supervisor_dashboard.sql'),'utf8'));
const backup=JSON.parse(await readFile(resolve(root,'tmp/dashboard-cloud-before.json'),'utf8'));
const original=backup.cases, supervisor=backup.staff.find(s=>s.role==='supervisor').user_id;
const agent=backup.staff.find(s=>s.role==='agent').user_id, portal='00000000-0000-4000-8000-000000000099';
await db.query('insert into auth.users(id) select x::uuid from unnest($1::text[]) x',[[...backup.staff.map(s=>s.user_id),portal]]);
for(const s of backup.staff)await db.query('insert into public.staff_members(user_id,display_name,role) values($1,$2,$3)',[s.user_id,s.display_name,s.role]);
const run=(await db.query(`insert into public.prediction_runs(run_key,dataset_version,model_version,calibration_version,snapshot_date,target_period_start,source_sha256,is_synthetic)
values('existing-current','synthetic_rolling_month_v5','lightgbm_tuned','existing','2026-10-10','2026-10-11',repeat('a',64),true) returning id`)).rows[0].id;
await db.exec('begin');
for(const c of original){
 const customer=backup.customer_map.find(x=>x.id===c.customer_id);
 await db.query(`insert into public.customers(id,customer_ref,source_dataset,is_synthetic,contract_ref) values($1,$2,'synthetic_rolling_month_v5',true,$2)`,[c.customer_id,customer.ref]);
 const snapshot=(await db.query(`insert into public.customer_snapshots(customer_id,snapshot_date,dataset_version,features) values($1,'2026-10-10','synthetic_rolling_month_v5','{}') returning id`,[c.customer_id])).rows[0].id;
 await db.query(`insert into public.churn_predictions(id,customer_id,snapshot_id,run_id,snapshot_date,target_period_start,raw_probability,churn_probability,explanations_status)
values($1,$2,$3,$4,'2026-10-10','2026-10-11',.8,.8,'existing')`,[c.prediction_id,c.customer_id,snapshot,run]);
 await db.query(`insert into public.retention_cases(id,customer_id,prediction_id,target_period_start,assigned_agent_id,case_status,created_at)
 values($1,$2,$3,'2026-10-11',$4,$5,$6)`,[c.id,c.customer_id,c.prediction_id,c.assigned_agent_id,c.case_status,c.created_at]);
}
await db.exec('commit');
await db.exec(await readFile(resolve(root,'tmp/dashboard-cloud/init.sql'),'utf8'));
const batches=(await readdir(resolve(root,'tmp/dashboard-cloud'))).filter(f=>/^batch-.*sql$/.test(f)).sort();
for(const file of batches)await db.exec(await readFile(resolve(root,'tmp/dashboard-cloud',file),'utf8'));
const count=async table=>(await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
assert.equal(await count('retention_cases'),507);assert.equal(await count('staff_members'),5);
assert.equal(await count('retention_outcomes'),272);
assert.equal(await count('automation_jobs'),0);assert.equal(await count('contact_preferences'),0);
assert.equal((await db.query("select count(*)::int n from public.delivery_outbox where status<>'sent'")).rows[0].n,0);
assert.equal((await db.query("select count(*)::int n from public.support_requests where handoff_status='queued'")).rows[0].n,0);
const before=await count('interaction_events');
for(const file of batches)await db.exec(await readFile(resolve(root,'tmp/dashboard-cloud',file),'utf8'));
assert.equal(await count('interaction_events'),before);
const protectedIds=original.filter(c=>c.assigned_agent_id).map(c=>c.id);
assert.equal((await db.query('select count(*)::int n from public.messages where case_id=any($1::uuid[])',[protectedIds])).rows[0].n,0);
async function as(user,role='authenticated'){
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:user})]);
 await db.exec(`set role ${role}`);
 try{return (await db.query('select public.retention_supervisor_dashboard() data')).rows[0].data}
 finally{await db.exec('reset role')}
}
const payload=await as(supervisor);
assert.equal(payload.cases.length,507);assert.equal(payload.staff.length,5);
assert.equal(payload.cases.filter(c=>c.outcome===true).length,22);
assert.equal(payload.cases.filter(c=>c.outcome===false).length,250);
await assert.rejects(()=>as(agent),/Supervisor access required/);
await assert.rejects(()=>as(portal),/Supervisor access required/);
await assert.rejects(()=>as(portal,'anon'),/permission denied/);
await db.query('update public.staff_members set active=false where user_id=$1',[supervisor]);
await assert.rejects(()=>as(supervisor),/Supervisor access required/);
await db.exec(await readFile(resolve(root,'tmp/dashboard-cloud/rollback.sql'),'utf8'));
assert.equal(await count('retention_cases'),207);assert.equal(await count('staff_members'),2);
assert.equal(await count('retention_outcomes'),0);assert.equal(await count('messages'),0);
assert.equal(await count('churn_predictions'),207);
const result={passed:true,cases:507,known_outcomes:272,staff:5,checks:['full seed + FK/revision/approval constraints','rerun is idempotent','protected fixtures preserved','no AI jobs/consent/queued delivery or support','Supervisor JSON complete','Agent/Portal/anon/inactive denied','rollback restores baseline locally']};
await writeFile(resolve(root,'tmp/dashboard-cloud/local-checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));await db.close();
