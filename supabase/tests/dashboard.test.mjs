// Portable synthetic seed/rollback regression; no cloud backups or credentials.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const root=resolve(import.meta.dirname,'../..'),db=new PGlite();
const source=await readFile(resolve(root,'supabase/tests/workspace.test.mjs'),'utf8');
await db.exec(source.match(/const bootstrap=`([\s\S]*?)`;/)[1]);
await db.exec("alter table auth.users add column banned_until timestamptz,add column raw_app_meta_data jsonb;");
await db.exec(await readFile(resolve(root,'supabase/setup.sql'),'utf8'));
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const supervisor=uid(1),agent=uid(2),portal=uid(3),roster=uid(4);
await db.query('insert into auth.users(id) select x::uuid from unnest($1::text[]) x',[[supervisor,agent,portal,roster]]);
await db.query("update auth.users set raw_app_meta_data='{\"dashboard_roster_only\":true}' where id=$1",[roster]);
await db.query("insert into public.staff_members(user_id,display_name,role) values($1,'Supervisor','supervisor'),($2,'Agent','agent'),($3,'Roster','agent')",[supervisor,agent,roster]);
const input=JSON.parse(await readFile(resolve(root,'supabase/tests/fixtures/import_payloads.json'),'utf8'))[0];
async function ingest(ref){
 await db.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 return (await db.query('select public.retention_ingest_prediction($1,$2,$3,$4,null,$5) r',
  [{...input.p_run,run_key:'dashboard-test:'+ref},ref,input.p_features,input.p_prediction,{}])).rows[0].r;
}
const current=await ingest('DASH-CURRENT'),protectedCase=await ingest('DASH-PROTECTED');
await db.query('update public.retention_cases set assigned_agent_id=$1 where id=$2',[agent,protectedCase.case_id]);
const backup={cases:(await db.query('select * from public.retention_cases')).rows,
 customer_map:(await db.query('select id,customer_ref as ref from public.customers')).rows};
const rows=JSON.parse(await readFile(resolve(root,'supabase/tests/fixtures/dashboard.json'),'utf8'));
for(const p of rows){p.owner=agent;p.supervisor=supervisor;if(!p.historical)p.customer='DASH-CURRENT';}
const template=await readFile(resolve(root,'supabase/scripts/seed_dashboard_case.sql'),'utf8');
const seed='begin;\n'+template.replace('__PAYLOAD__',"'"+JSON.stringify(rows).replaceAll("'","''")+"'")+ '\ncommit;';
const count=async table=>(await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
await db.exec(seed);
assert.equal(await count('retention_cases'),3);assert.equal(await count('retention_outcomes'),1);
assert.equal(await count('automation_jobs'),0);assert.equal(await count('contact_preferences'),0);
assert.equal((await db.query("select count(*)::int n from public.delivery_outbox where status<>'sent'")).rows[0].n,0);
assert.equal((await db.query("select count(*)::int n from public.support_requests where handoff_status='queued'")).rows[0].n,0);
const before=await count('interaction_events');await db.exec(seed);assert.equal(await count('interaction_events'),before);
assert.equal((await db.query('select count(*)::int n from public.messages where case_id=$1',[protectedCase.case_id])).rows[0].n,0);
const forbidden={...rows.find(p=>!p.historical),customer:'DASH-PROTECTED',marker_id:uid(999)};
await assert.rejects(()=>db.exec('begin;'+template.replace('__PAYLOAD__',"'"+JSON.stringify([forbidden]).replaceAll("'","''")+"'")+'commit;'),/existing operational fixture/);
await db.exec('rollback');
async function as(user,role='authenticated'){
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:user})]);await db.exec(`set role ${role}`);
 try{return (await db.query('select public.retention_supervisor_dashboard() data')).rows[0].data}
 finally{await db.exec('reset role')}
}
const payload=await as(supervisor);assert.equal(payload.cases.length,3);assert.equal(payload.staff.length,3);
assert.equal(payload.cases.filter(c=>c.outcome!==null).length,1);
await assert.rejects(()=>as(agent),/Supervisor access required/);await assert.rejects(()=>as(portal),/Supervisor access required/);
await assert.rejects(()=>as(portal,'anon'),/permission denied/);
await db.query('update public.staff_members set active=false where user_id=$1',[supervisor]);await assert.rejects(()=>as(supervisor),/Supervisor access required/);
const quote=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'";
const rollback=(await readFile(resolve(root,'supabase/scripts/rollback_dashboard.sql'),'utf8')).replaceAll('__BACKUP__',quote(backup)).replaceAll('__STAFF__',quote([roster]));
await db.exec(rollback);
assert.equal(await count('retention_cases'),2);assert.equal(await count('staff_members'),2);
assert.equal(await count('retention_outcomes'),0);assert.equal(await count('messages'),0);assert.equal(await count('churn_predictions'),2);
assert.equal((await db.query('select assigned_agent_id from public.retention_cases where id=$1',[current.case_id])).rows[0].assigned_agent_id,null);
const result={passed:7,fixture:'Three synthetic cases; no cloud backup',checks:['seed constraints and outcome','idempotent rerun','owned case protected','no AI/consent/pending delivery/support','Supervisor payload','Agent/Portal/anon/inactive denied','rollback restores baseline'],limits:['Local PGlite; no hosted Auth or multi-connection test']};
await writeFile(resolve(root,'supabase/tests/dashboard-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await db.close();
