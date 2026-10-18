// PostgreSQL/WASM integration tests. Supabase auth/storage schemas are stubbed;
// this tests real SQL, constraints, RLS and RPC, not the hosted Auth gateway.
import { readFile, readdir, access, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
let modulePath=resolve(here,'node_modules/@electric-sql/pglite/dist/index.js');
try { await access(modulePath); } catch { modulePath=resolve(root,'tmp/db-tests/node_modules/@electric-sql/pglite/dist/index.js'); }
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const bootstrap=`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text unique);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
create function auth.role() returns text language sql stable as $$
 select current_setting('request.jwt.claims',true)::jsonb->>'role' $$;
grant usage on schema auth to authenticated,service_role,anon;
grant execute on all functions in schema auth to authenticated,service_role,anon;
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false);
select set_config('request.jwt.claims','{}',false);`;
await db.exec(bootstrap);
const setup=await readFile(resolve(root,'supabase/setup.sql'),'utf8');
await db.exec(setup);
console.log('Fresh setup compiled and applied.');
let passed=0;
const tests=[];
async function test(name,fn){try{await fn();passed++;tests.push(name);console.log('PASS '+name);}catch(e){console.error('FAIL '+name+'\n'+e.message);throw e;}}
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args=[]) => Object.values((await q(sql,args))[0])[0];
async function as(role,user,sql,args=[]){
  assert(['authenticated','anon','service_role'].includes(role));
  await q(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({role,...(user?{sub:user}:{})})]);
  await db.exec(`set role ${role}`);
  try{return await q(sql,args);}finally{await db.exec('reset role');await q(`select set_config('request.jwt.claims','{}',false)`);}
}
async function rpc(role,user,name,args){
  return Object.values((await as(role,user,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args))[0])[0];
}
async function denied(fn,pattern){await assert.rejects(fn,pattern);}
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const supervisor=uid(1),agent=uid(2),otherAgent=uid(3),customer=uid(4),otherCustomer=uid(5),inactive=uid(6);
await q(`insert into auth.users(id) select x::uuid from unnest($1::text[]) x`,[[supervisor,agent,otherAgent,customer,otherCustomer,inactive]]);
await q(`insert into public.staff_members(user_id,display_name,role,active) values
 ($1,'Supervisor','supervisor',true),($2,'Agent One','agent',true),($3,'Agent Two','agent',true),($4,'Inactive','agent',false)`,[supervisor,agent,otherAgent,inactive]);
const config=JSON.parse(await readFile(resolve(root,'ml/config.json'),'utf8'));
const features=Object.fromEntries(config.features.map(k=>[k,k==='billing_mode'?'Prepaid':0]));
const run={run_key:'test-october',dataset_version:config.dataset_version,model_version:'fixture',calibration_version:'identity',
 snapshot_date:'2026-09-30',target_period_start:'2026-10-01',source_sha256:'a'.repeat(64),is_synthetic:true};
const pred={raw_probability:0.8,churn_probability:0.8,explanations_status:'Fixture: no model explanation',explanation_version:null};
async function ingest(ref,prediction=pred,fs=features,runMeta=run,context=null){return rpc('service_role',null,'retention_ingest_prediction',
 [runMeta,ref,fs,prediction,context,{display_name:'Fictional customer',billing_mode:'Prepaid',monthly_fee:205000}]);}
let one,two,half;
await test('25 tables have RLS; no browser or worker direct DML',async()=>{
 const tables=await q(`select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`);
 assert.equal(tables.length,25);assert(tables.every(t=>t.relrowsecurity));
 for(const role of ['authenticated','service_role','anon']) assert.equal(await scalar(`select count(*)::int from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
   and has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE')`,[role]),0);
});
await test('anonymous cannot call RPC or read customers',async()=>{
 await denied(()=>as('anon',null,'select * from public.customers'),/permission denied/);
 await denied(()=>rpc('anon',null,'retention_portal_threads',[]),/permission denied/);
});
await test('ingestion is idempotent and score 500 does not create case',async()=>{
 one=await ingest('TEST-A');two=await ingest('TEST-B');half=await ingest('TEST-HALF',{...pred,churn_probability:0.5});
 assert.deepEqual(await ingest('TEST-A'),one);assert.equal(half.case_id,null);
 assert.equal(await scalar('select count(*)::int from public.churn_predictions'),3);
 assert.equal(await scalar('select churn_score::float8 from public.churn_predictions where id=$1',[one.prediction_id]),800);
});
await test('ingestion rejects labels, missing features, bad probability and frozen-data mutation',async()=>{
 await denied(()=>ingest('BAD-LABEL',pred,{...features,churned:true}),/127 features/);
 const missing={...features};delete missing[config.features[0]];
 await denied(()=>ingest('BAD-MISSING',pred,missing),/127 features/);
 await denied(()=>ingest('BAD-PROB',{...pred,churn_probability:1.1}),/check constraint/);
 await denied(()=>ingest('TEST-A',pred,{...features,[config.features[0]]:99}),/Frozen snapshot conflict/);
 await denied(()=>ingest('TEST-A',pred,features,{...run,model_version:'changed'}),/metadata conflict/);
 await denied(()=>ingest('TEST-CONTEXT',pred,features,run,{generation_audit_private:true}),/Care context contract mismatch/);
 await denied(()=>ingest('BAD-TYPE',pred,{...features,[config.features[0]]:{audit_label:true}}),/Feature values/);
});
await test('database rejects mismatched customer/period and client supplied generated scores',async()=>{
 await denied(()=>q('insert into public.retention_cases(customer_id,prediction_id,target_period_start) values($1,$2,$3)',
   [two.customer_id,one.prediction_id,'2026-11-01']),/foreign key constraint/);
 await denied(()=>q('update public.churn_predictions set churn_score=900 where id=$1',[one.prediction_id]),{code:'428C9'});
});
await test('only supervisor assigns; RLS scopes staff queue',async()=>{
 await denied(()=>rpc('authenticated',agent,'retention_assign_case',[one.case_id,agent]),/Supervisor required/);
 await rpc('authenticated',supervisor,'retention_assign_case',[one.case_id,agent]);
 await rpc('authenticated',supervisor,'retention_assign_case',[two.case_id,otherAgent]);
 assert.equal((await as('authenticated',agent,'select * from public.retention_care_queue')).length,1);
 assert.equal((await as('authenticated',otherAgent,'select * from public.retention_care_queue')).length,1);
 assert.equal((await as('authenticated',supervisor,'select * from public.retention_care_queue')).length,2);
 assert.equal((await as('authenticated',inactive,'select * from public.retention_care_queue')).length,0);
 await denied(()=>rpc('authenticated',supervisor,'retention_assign_case',[one.case_id,inactive]),/Active staff/);
});
await q('insert into public.customer_portal_users(user_id,customer_id) values($1,$2),($3,$4)',[customer,one.customer_id,otherCustomer,two.customer_id]);
let draft,conv,claim;
const save=(body,key,id=null,revision=null,offer=null,internal=false)=>rpc('authenticated',agent,'retention_save_draft',
 [one.case_id,body,key,'Zalo',id,revision,offer,internal]);
await test('staff draft is idempotent and invisible to portal; other agent denied',async()=>{
 draft=await save('Hello, is your connection stable?','draft-1');
 assert.deepEqual(await save('Hello, is your connection stable?','draft-1'),draft);
 await denied(()=>save('Different body','draft-1'),/different content/);
 await denied(()=>rpc('authenticated',otherAgent,'retention_save_draft',[one.case_id,'Unauthorized','unauth']),/Case access denied/);
 conv=await scalar('select conversation_id from public.messages where id=$1',[draft.message_id]);
 const thread=await rpc('authenticated',customer,'retention_portal_thread',[conv]);assert.deepEqual(thread.messages,[]);
 await denied(()=>rpc('authenticated',otherCustomer,'retention_portal_thread',[conv]),/Conversation access denied/);
 assert.equal((await as('authenticated',customer,'select * from public.churn_predictions')).length,0);
 assert.equal((await as('authenticated',customer,'select * from public.message_revisions')).length,0);
});
await test('missing consent blocks approval and workers cannot approve',async()=>{
 await denied(()=>rpc('authenticated',agent,'retention_review_message',[draft.message_id,1,'approved']),/Contact not allowed/);
 await denied(()=>rpc('service_role',null,'retention_review_message',[draft.message_id,1,'approved']),/permission denied/);
 assert.equal(await rpc('service_role',null,'retention_claim_delivery',[]),null);
 await rpc('service_role',null,'retention_set_demo_consent',[one.customer_id,'Zalo',true,'Explicit fictional demo consent']);
});
await test('approval enqueues once; claim holds lease; editing invalidates approval',async()=>{
 const approval=await rpc('authenticated',agent,'retention_review_message',[draft.message_id,1,'approved']);
 const duplicate=await rpc('authenticated',agent,'retention_review_message',[draft.message_id,1,'approved']);
 assert.equal(approval.outbox_id,duplicate.outbox_id);
 claim=await rpc('service_role',null,'retention_claim_delivery',[]);assert.equal(claim.outbox_id,approval.outbox_id);
 assert.equal(await rpc('service_role',null,'retention_claim_delivery',[]),null);
 draft=await save('Updated question: is the connection stable?','draft-2',draft.message_id,1);
 assert.equal(draft.revision,2);
 await denied(()=>save('Stale editor','draft-stale',draft.message_id,1),/Revision conflict/);
 await denied(()=>rpc('service_role',null,'retention_deliver_mock',[claim.outbox_id,claim.lease_token]),/delivery lease/);
 await denied(()=>rpc('authenticated',agent,'retention_review_message',[draft.message_id,1,'approved']),/current unsent revision/);
});
await test('mock send rechecks revision and delivers exactly once on retry',async()=>{
 await rpc('authenticated',agent,'retention_review_message',[draft.message_id,2,'approved']);
 claim=await rpc('service_role',null,'retention_claim_delivery',[]);
 const sent=await rpc('service_role',null,'retention_deliver_mock',[claim.outbox_id,claim.lease_token]);
 assert.equal(sent.status,'sent');assert.deepEqual(await rpc('service_role',null,'retention_deliver_mock',[claim.outbox_id,claim.lease_token]),sent);
 const thread=await rpc('authenticated',customer,'retention_portal_thread',[conv]);assert.equal(thread.messages.length,1);
 assert.equal(thread.messages[0].body,'Updated question: is the connection stable?');
 assert(!JSON.stringify(thread).includes('churn_probability'));
 await denied(()=>save('Edit sent body','sent-edit',draft.message_id,2),/cannot be edited/);
});
await test('internal notes never appear in portal',async()=>{
 await save('Internal-only follow-up reasoning','internal-note',null,null,null,true);
 assert.equal((await rpc('authenticated',customer,'retention_portal_thread',[conv])).messages.length,1);
});
await test('follow-up dedupes; reading a notification does not complete task',async()=>{
 await q("update public.follow_up_tasks set due_at=now()-interval '1 second' where case_id=$1",[one.case_id]);
 assert.equal(await rpc('service_role',null,'retention_process_followups',[]),1);
 assert.equal(await rpc('service_role',null,'retention_process_followups',[]),0);
 const notification=await scalar("select id from public.notifications where case_id=$1 and type='follow_up_due'",[one.case_id]);
 await rpc('authenticated',agent,'retention_mark_notification_read',[notification]);
 assert.equal(await scalar("select count(*)::int from public.follow_up_tasks where case_id=$1 and status='due'",[one.case_id]),1);
});
let inbound,manualReminder;
await test('portal reply dedupes and notifies staff without automatically requesting AI',async()=>{
 const tomorrow=await scalar("select (now()+interval '1 day')::text");
 await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual-before-reply']);
 manualReminder=await rpc('authenticated',agent,'retention_schedule_reminder',[one.case_id,tomorrow,'manual-before-reply']);
 inbound=await rpc('authenticated',customer,'retention_portal_send',[conv,'It still disconnects.','reply-1']);
 assert.equal(await rpc('authenticated',customer,'retention_portal_send',[conv,'It still disconnects.','reply-1']),inbound);
 await denied(()=>rpc('authenticated',customer,'retention_portal_send',[conv,'Different body','reply-1']),/Event key conflict/);
 assert.equal(await scalar("select count(*)::int from public.follow_up_tasks where case_id=$1 and task_type='no_reply' and status in ('pending','due')",[one.case_id]),0);
 assert.equal(await scalar('select status from public.follow_up_tasks where id=$1',[manualReminder]),'pending');
 assert.equal(await scalar("select count(*)::int from public.automation_jobs where case_id=$1 and job_type='reply_draft'",[one.case_id]),0);
 assert.equal((await rpc('authenticated',customer,'retention_portal_thread',[conv])).messages.length,2);
});
let aiDraft;
await test('job completion is idempotent and creates an unsent AI draft',async()=>{
 await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual-after-reply']);
 const jobs=await rpc('service_role',null,'retention_pending_jobs',[]);
 const job=jobs.find(j=>j.case_id===one.case_id);
 assert.equal(job.case_id,one.case_id);
 const args=[job.id,'Verify connection','Ask for a suitable support time.',
   'What time would be convenient for support to contact you?','fixture','fixture-v1','prompt-v1'];
 const invalid=[...args];invalid[3]='';
 await denied(()=>rpc('service_role',null,'retention_complete_job',invalid),/check constraint/);
 assert((await rpc('service_role',null,'retention_pending_jobs',[])).some(j=>j.id===job.id));
 aiDraft=await rpc('service_role',null,'retention_complete_job',args);
 assert.deepEqual(await rpc('service_role',null,'retention_complete_job',args),aiDraft);
 assert.equal((await rpc('authenticated',customer,'retention_portal_thread',[conv])).messages.length,2);
 assert.equal(await scalar('select approval_status from public.messages where id=$1',[aiDraft.message_id]),'draft');
 assert(!(await rpc('service_role',null,'retention_pending_jobs',[])).some(j=>j.id===job.id));
 const stale=await scalar("select id from public.automation_jobs where request_key='manual-before-reply' and case_id=$1",[one.case_id]);
 await denied(()=>rpc('service_role',null,'retention_complete_job',[stale,...args.slice(1)]),/not pending/);
});
await test('opt-out cancels queued delivery and prevents future approval',async()=>{
 await rpc('authenticated',agent,'retention_review_message',[aiDraft.message_id,1,'approved']);
 const queued=await rpc('service_role',null,'retention_claim_delivery',[]);
 await rpc('authenticated',customer,'retention_opt_out',[conv]);
 await denied(()=>rpc('service_role',null,'retention_deliver_mock',[queued.outbox_id,queued.lease_token]),/delivery lease/);
 await denied(()=>rpc('authenticated',agent,'retention_review_message',[aiDraft.message_id,1,'approved']),/Contact not allowed/);
 await rpc('service_role',null,'retention_set_demo_consent',[one.customer_id,'Zalo',true,'same-seed-again']);
 assert.equal(await scalar('select contact_allowed from public.contact_preferences where customer_id=$1',[one.customer_id]),false);
 assert.notEqual(await scalar('select opt_out_at from public.contact_preferences where customer_id=$1',[one.customer_id]),null);
});
await test('support handoff dedupes and receipts mean mock handoff only',async()=>{
 const args=[one.case_id,'Please check evening disconnections.','support-1','After 18:00'];
 const id=await rpc('authenticated',agent,'retention_request_support',args);
 assert.equal(await rpc('authenticated',agent,'retention_request_support',args),id);
 assert.equal(await rpc('service_role',null,'retention_process_support',[]),1);
 assert.equal(await rpc('service_role',null,'retention_process_support',[]),0);
 assert((await scalar('select external_receipt from public.support_requests where id=$1',[id])).startsWith('mock-support:'));
});
await test('unknown outcome remains null after case closure; premature observed outcome rejected',async()=>{
 await rpc('authenticated',agent,'retention_record_outcome',[one.case_id,null,'fixture',true]);
 await denied(()=>rpc('authenticated',agent,'retention_record_outcome',[one.case_id,false,'fixture',true,'2026-10-15T12:00:00Z','premature']),/complete target period/);
 await rpc('authenticated',agent,'retention_update_case',[one.case_id,'closed','contacted','Demo closed; outcome unknown']);
 assert.equal(await scalar('select churned from public.retention_outcomes where case_id=$1',[one.case_id]),null);
});
await test('cost deduplication and scoped metrics preserve unknown outcomes',async()=>{
 const args=[one.case_id,10000,'VND','contact','fictional demo',true,'cost-1'];
 const cost=await rpc('authenticated',agent,'retention_record_cost',args);
 assert.equal(await rpc('authenticated',agent,'retention_record_cost',args),cost);
 const metrics=await rpc('authenticated',agent,'retention_metrics',['2026-10-01']);
 assert.equal(metrics.cases,1);assert.equal(metrics.unknown_outcomes,1);assert.equal(metrics.observed_active,0);
 assert.equal(Number(metrics.costs_by_currency[0].amount),10000);
});
await test('revisions and audit rows cannot be overwritten',async()=>{
 await denied(()=>q("update public.message_revisions set body='tampered' where message_id=$1",[draft.message_id]),/immutable/);
 await denied(()=>q('delete from public.message_approvals where message_id=$1',[draft.message_id]),/immutable/);
});
await test('configuration changes require supervisor; default three hours stays configurable',async()=>{
 await denied(()=>rpc('authenticated',agent,'retention_update_settings',[24]),/Supervisor required/);
 await rpc('authenticated',supervisor,'retention_update_settings',[24]);
 assert.equal(await scalar('select extract(epoch from follow_up_delay)::int from public.workspace_settings'),86400);
});

await test('offer eligibility and supervisor approval are enforced again at send',async()=>{
 await rpc('authenticated',agent,'retention_update_case',[one.case_id,'in_progress','contacted']);
 // Separate fixture: an affirmative new customer choice, not a repeated import.
 await q("update public.contact_preferences set contact_allowed=true,opt_out_at=null,consent_basis='fixture_new_opt_in' where customer_id=$1",[one.customer_id]);
 const offer=await scalar(`insert into public.offers(code,version,title,description,unit_cost,valid_from,valid_until,active,requires_supervisor)
  values('TEST-OFFER',1,'Fixture offer','Fictional approved catalog',1000,now()-interval '1 day',now()+interval '1 day',true,true) returning id`);
 const offered=await save('Please review this eligible demo option.','offer-draft',null,null,offer);
 await denied(()=>rpc('authenticated',supervisor,'retention_review_message',[offered.message_id,1,'approved']),/Offer unavailable/);
 await q(`insert into public.customer_offer_eligibility(customer_id,offer_id,eligible,reason,valid_until,rule_version)
   values($1,$2,true,'Fixture eligibility',now()+interval '1 day','fixture')`,[one.customer_id,offer]);
 await denied(()=>rpc('authenticated',agent,'retention_review_message',[offered.message_id,1,'approved']),/requires supervisor/);
 await rpc('authenticated',supervisor,'retention_review_message',[offered.message_id,1,'approved']);
 const leased=await rpc('service_role',null,'retention_claim_delivery',[]);
 await q('update public.offers set active=false where id=$1',[offer]);
 assert.equal((await rpc('service_role',null,'retention_deliver_mock',[leased.outbox_id,leased.lease_token])).status,'cancelled');
});
await test('send failure backs off and exhausted retries fail permanently',async()=>{
 const m=await save('Retry this demo message.','retry-draft');
 await rpc('authenticated',agent,'retention_review_message',[m.message_id,1,'approved']);
 const lease=await rpc('service_role',null,'retention_claim_delivery',[]);
 await denied(()=>rpc('service_role',null,'retention_fail_delivery',[lease.outbox_id,uid(99),'fixture_error',true]),/Invalid delivery lease/);
 await rpc('service_role',null,'retention_fail_delivery',[lease.outbox_id,lease.lease_token,'fixture_error',true]);
 assert.equal(await scalar('select status from public.delivery_outbox where id=$1',[lease.outbox_id]),'queued');
 assert.equal(await rpc('service_role',null,'retention_claim_delivery',[]),null);
 await q("update public.delivery_outbox set next_attempt_at=now()-interval '1 second',attempt_count=2 where id=$1",[lease.outbox_id]);
 const last=await rpc('service_role',null,'retention_claim_delivery',[]);
 await rpc('service_role',null,'retention_fail_delivery',[last.outbox_id,last.lease_token,'permanent_fixture_error',true]);
 assert.equal(await scalar('select status from public.delivery_outbox where id=$1',[lease.outbox_id]),'failed');
});
await test('cooldown, daily contact policy and synthetic reporting flags are enforced',async()=>{
 await rpc('authenticated',supervisor,'retention_set_contact_policy',[60,null]);
 const m=await save('Should wait for cooldown.','cooldown-draft');
 await denied(()=>rpc('authenticated',agent,'retention_review_message',[m.message_id,1,'approved']),/cooldown/);
 await rpc('authenticated',supervisor,'retention_set_contact_policy',[0,1]);
 await denied(()=>rpc('authenticated',agent,'retention_review_message',[m.message_id,1,'approved']),/Daily contact limit/);
 await rpc('authenticated',supervisor,'retention_set_contact_policy',[0,null]);
 await denied(()=>rpc('authenticated',agent,'retention_record_outcome',[one.case_id,null,'fictional',false]),/simulated outcome/);
 await denied(()=>rpc('authenticated',agent,'retention_record_cost',[one.case_id,1,'VND','contact','fictional',false,'false-cost']),/simulated cost/);
});
await test('read models are scoped; worker context omits model internals and notes',async()=>{
 assert((await rpc('authenticated',agent,'retention_case_detail',[one.case_id])).messages.length>0);
 await denied(()=>rpc('authenticated',otherAgent,'retention_case_detail',[one.case_id]),/Case access denied/);
 await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'context-refresh']);
 const job=(await rpc('service_role',null,'retention_pending_jobs',[])).find(j=>j.case_id===one.case_id);
 const context=await rpc('service_role',null,'retention_worker_context',[job.id]);
 assert.equal(context.language,'English');assert.equal(context.requires_staff_review,true);
 const text=JSON.stringify(context);
 for(const forbidden of ['churn_probability','contribution_log_odds','Internal-only','source_sha256','features'])assert(!text.includes(forbidden));
 await denied(()=>rpc('authenticated',agent,'retention_worker_context',[job.id]),/permission denied/);
 await denied(()=>rpc('service_role',null,'retention_pending_jobs',[0]),/Invalid limit/);
 await denied(()=>rpc('authenticated',agent,'retention_pending_jobs',[]),/permission denied/);
 assert.equal(await scalar("select count(*)::int from information_schema.columns where table_schema='public' and table_name='automation_jobs' and column_name in ('lease_token','lease_until','attempt_count','next_attempt_at','error_code')"),0);
});

await test('all staff writes lock the case before checking ownership',async()=>{
 const api=await readFile(resolve(root,'supabase/migrations/20261018000300_workspace_api.sql'),'utf8');
 const helper=api.match(/create function app_private\.require_staff\(.*?end \$\$;/s)[0];
 const guarded=helper.replace('create function','create or replace function').replace('begin\n',`begin
   if not exists(select 1 from pg_catalog.pg_locks where (pid=pg_backend_pid() or (pg_backend_pid()=0 and pid is null))
     and relation='public.retention_cases'::regclass and mode='RowShareLock' and granted) then
     raise exception 'Case row lock must precede permission check'; end if;
 `);
 const saveFunction=api.match(/create function public\.retention_save_draft\(.*?end \$\$;/s)[0].replace('create function','create or replace function');
 await db.exec(guarded);
 try {
   // Prove this regression check rejects the previous check-before-lock order.
   const previous=saveFunction.replace(
     'select * into v_case from public.retention_cases where id=p_case_id for update;\n  v_actor := app_private.require_staff(p_case_id);',
     'v_actor := app_private.require_staff(p_case_id);\n  select * into v_case from public.retention_cases where id=p_case_id for update;');
   assert.notEqual(previous,saveFunction);await db.exec(previous);
   await denied(()=>save('Regression probe','order-old'),/lock must precede/);
   await db.exec(saveFunction);
   const m=await save('Lock ownership before writing.','order-new');
   await rpc('authenticated',agent,'retention_review_message',[m.message_id,1,'rejected','Fixture review']);
   await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'order-rec']);
   const due=await scalar("select (now()+interval '2 days')::text");
   const task=await rpc('authenticated',agent,'retention_schedule_reminder',[one.case_id,due,'order-task']);
   await rpc('authenticated',agent,'retention_complete_task',[task]);
   await rpc('authenticated',agent,'retention_request_support',[one.case_id,'Fixture support request','order-support']);
   await rpc('authenticated',agent,'retention_update_case',[one.case_id,'in_progress','contacted']);
   await rpc('authenticated',agent,'retention_record_outcome',[one.case_id,null,'order-fixture',true]);
   await rpc('authenticated',agent,'retention_record_cost',[one.case_id,0,'VND','contact','order-fixture',true,'order-cost']);
 } finally {
   await db.exec(saveFunction);
   await db.exec(helper.replace('create function','create or replace function'));
 }
});

await test('exhausted n8n retries stop polling a failed AI job without overwriting a completed result',async()=>{
 const id=await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'exhausted-ai']);
 await rpc('service_role',null,'retention_fail_job',[id]);
 await rpc('service_role',null,'retention_fail_job',[id]);
 assert.equal(await scalar('select status from public.automation_jobs where id=$1',[id]),'failed');
 assert(!(await rpc('service_role',null,'retention_pending_jobs',[])).some(j=>j.id===id));
 const done=await scalar("select id from public.automation_jobs where case_id=$1 and status='completed' limit 1",[one.case_id]);
 await rpc('service_role',null,'retention_fail_job',[done]);
 assert.equal(await scalar('select status from public.automation_jobs where id=$1',[done]),'completed');
});

let sourceCompatibility='not run (prepare_import.py first)';
const payloadPath=resolve(root,'tmp/supabase/import_payloads.json');
try{await access(payloadPath);sourceCompatibility='prepared canonical inference payloads';}catch{}
if(sourceCompatibility==='prepared canonical inference payloads')await test('canonical October data and SHAP context import without changing probability',async()=>{
 const payloads=JSON.parse(await readFile(payloadPath,'utf8'));
 for(const p of payloads){
   const args=[p.p_run,p.p_customer_ref,p.p_features,p.p_prediction,p.p_context,p.p_profile];
   const got=await rpc('service_role',null,'retention_ingest_prediction',args);
   assert.deepEqual(await rpc('service_role',null,'retention_ingest_prediction',args),got);
   const probability=await scalar('select churn_probability::float8 from public.churn_predictions where id=$1',[got.prediction_id]);
   assert(Math.abs(probability-p.p_prediction.churn_probability)<1e-14);
 }
 sourceCompatibility=`${payloads.length} canonical October payloads + exact 127 features + grounded SHAP contexts`;
});

await test('read-only hosted verification script executes and reports complete workspace',async()=>{
 const results=await db.exec(await readFile(resolve(root,'supabase/verify_workspace.sql'),'utf8'));
 assert.equal(results[0].rows[0].tables,25);assert.equal(results[0].rows[0].rls_tables,25);
 assert.equal(results[0].rows[0].anon_table_privileges,0);assert.equal(results[0].rows[0].private_bucket,true);
});
await test('a completed past period accepts an evidenced simulated outcome',async()=>{
 const old=await ingest('TEST-PAST',pred,features,{...run,run_key:'test-past-period',snapshot_date:'2020-01-31',target_period_start:'2020-02-01'});
 await rpc('authenticated',supervisor,'retention_assign_case',[old.case_id,agent]);
 const id=await rpc('authenticated',agent,'retention_record_outcome',
   [old.case_id,false,'fixture-period-end',true,'2020-03-01T00:00:00Z','fixture-evidence']);
 assert.equal(await scalar('select churned from public.retention_outcomes where id=$1',[id]),false);
});
if(sourceCompatibility.startsWith('5 canonical'))await test('prepared SQL import and account bootstrap execute idempotently',async()=>{
 const before=await scalar('select count(*)::int from public.customers');
 await db.exec(await readFile(resolve(root,'tmp/supabase/import_demo.sql'),'utf8'));
 assert.equal(await scalar('select count(*)::int from public.customers'),before);
 await q(`update auth.users set email=case id when $1::uuid then 'supervisor@retention.example'
   when $2::uuid then 'agent@retention.example' when $3::uuid then 'customer@retention.example' end
   where id in ($1,$2,$3)`,[supervisor,agent,customer]);
 const script=await readFile(resolve(root,'supabase/connect_demo_accounts.sql'),'utf8');
 await db.exec(script);await db.exec(script);
 assert.equal(await scalar('select count(*)::int from public.customer_portal_users where user_id=$1',[customer]),1);
 const thread=(await rpc('authenticated',customer,'retention_portal_threads',[]))[0];
 await rpc('authenticated',customer,'retention_opt_out',[thread.conversation_id]);
 await db.exec(await readFile(resolve(root,'tmp/supabase/import_demo.sql'),'utf8'));
 assert.equal(await scalar(`select p.contact_allowed from public.contact_preferences p
   join public.conversations cv on cv.customer_id=p.customer_id and cv.selected_channel=p.channel where cv.id=$1`,[thread.conversation_id]),false);
});

await test('rewrite instructions and selected source reach worker context with idempotency and access checks',async()=>{
 const args=[one.case_id,'manual:message:rewrite-fixture','Make it shorter and warmer.','Original verified customer draft.'];
 const id=await rpc('authenticated',agent,'retention_request_recommendation',args);
 assert.equal(await rpc('authenticated',agent,'retention_request_recommendation',args),id);
 const context=await rpc('service_role',null,'retention_worker_context',[id]);
 assert.equal(context.rewrite_instructions,args[2]);assert.equal(context.rewrite_source_text,args[3]);
 assert.equal(context.snapshot_date,'2026-09-30');assert.equal(context.target_period_start,'2026-10-01');assert(Number.isFinite(Date.parse(context.current_time)));
 await denied(()=>rpc('authenticated',agent,'retention_request_recommendation',[...args.slice(0,2),'Different instructions',args[3]]),/Request key conflict/);
 await denied(()=>rpc('authenticated',otherAgent,'retention_request_recommendation',[one.case_id,'manual:message:forbidden','Change tone']),/Case access denied/);
 await denied(()=>rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual:message:long','x'.repeat(2001)]),/too long/);
 await denied(()=>rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual:explanation:rewrite','Change the facts']),/only supported/);
 await denied(()=>rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual:message:no-instructions',null,'Existing source']),/instructions required/);
});
await test('call script and explanation requests do not create outbound drafts',async()=>{
 const before=await scalar('select count(*)::int from public.messages where case_id=$1',[one.case_id]);
 for(const output of ['call_script','explanation']){
   const job=await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual:'+output+':fixture']);
   assert.equal((await rpc('service_role',null,'retention_worker_context',[job])).requested_output,output);
   const args=[job,'Verify customer needs','Grounded fixture rationale',null,'fixture','fixture-v1','prompt-v1',output==='call_script'?'Ask about current needs.':null];
   if(output==='call_script')await denied(()=>rpc('service_role',null,'retention_complete_job',[...args.slice(0,7),null]),/Call script required/);
   const result=await rpc('service_role',null,'retention_complete_job',args);
   assert.equal(result.message_id,null);assert.equal(result.revision,null);
   assert.deepEqual(await rpc('service_role',null,'retention_complete_job',args),result);
 }
 assert.equal(await scalar('select count(*)::int from public.messages where case_id=$1',[one.case_id]),before);
});
await test('manual-only AI and pipeline separate closed care from period outcomes',async()=>{
 const oldRun={...run,run_key:'pipeline-historical',snapshot_date:'2020-09-30',target_period_start:'2020-10-01'};
 const row=await ingest('PIPELINE-HISTORY',pred,features,oldRun);
 assert.equal(await scalar('select count(*)::int from public.automation_jobs where case_id=$1',[row.case_id]),0);
 await rpc('authenticated',supervisor,'retention_assign_case',[row.case_id,agent]);
 await rpc('authenticated',agent,'retention_update_case',[row.case_id,'resolving_request','contacted']);
 assert.equal(await scalar('select care_stage from public.retention_care_queue where case_id=$1',[row.case_id]),'resolution');
 await rpc('authenticated',agent,'retention_update_case',[row.case_id,'closed','contacted','Care completed']);
 assert.equal(await scalar('select care_stage from public.retention_care_queue where case_id=$1',[row.case_id]),'care_completed');
 assert.equal(await scalar('select outcome_churned from public.retention_care_queue where case_id=$1',[row.case_id]),null);
 await rpc('authenticated',agent,'retention_record_outcome',[row.case_id,false,'historical-fixture',true,'2020-11-01T00:00:00Z','fixture-evidence']);
 assert.equal(await scalar('select outcome_churned from public.retention_care_queue where case_id=$1',[row.case_id]),false);
 await rpc('authenticated',agent,'retention_record_outcome',[row.case_id,true,'historical-fixture',true,'2020-11-01T00:00:00Z','fixture-evidence']);
 assert.equal(await scalar('select outcome_churned from public.retention_care_queue where case_id=$1',[row.case_id]),true);
});

await test('typed queues filter before limit and remain worker-only',async()=>{
 await q("update public.automation_jobs set completed_at=now()-interval '1 minute' where status='completed'");
 await q("update public.retention_cases set case_status='in_progress',assigned_agent_id=$1 where id=$2",[agent,one.case_id]);
 for(const output of ['message','call_script','explanation'])await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual:'+output+':typed-test']);
 for(const output of ['message','call_script','explanation']){
  const jobs=await rpc('service_role',null,'retention_pending_jobs',[1,output]);assert.equal(jobs.length,1);assert(jobs[0].request_key.startsWith('manual:'+output+':'));
 }
 await denied(()=>rpc('authenticated',agent,'retention_pending_jobs',[1,'message']),/permission denied/);
 await denied(()=>rpc('service_role',null,'retention_pending_jobs',[1,'unknown']),/Invalid output/);
});
await test('reserved demo portal switches only sent synthetic Outreach conversations',async()=>{
 const demo=uid(999);await q("update auth.users set email='previous-demo@retention.example' where email='customer@retention.example'");await q("insert into auth.users(id,email) values($1,'customer@retention.example')",[demo]);
 await q('insert into public.customer_portal_users(user_id,customer_id) values($1,$2)',[demo,half.customer_id]);
 assert((await rpc('authenticated',demo,'retention_portal_threads',[])).some(t=>t.conversation_id===conv));
 const thread=await rpc('authenticated',demo,'retention_portal_thread',[conv]);assert(thread.messages.every(m=>m.direction!=='internal'));
 await denied(()=>rpc('authenticated',otherCustomer,'retention_portal_thread',[conv]),/Conversation access denied/);
 await q("update public.retention_cases set case_status='new' where id=$1",[one.case_id]);
 await denied(()=>rpc('authenticated',demo,'retention_portal_thread',[conv]),/Conversation access denied/);
 await q("update public.retention_cases set case_status='in_progress' where id=$1",[one.case_id]);
 await q('update public.customers set is_synthetic=false where id=$1',[one.customer_id]);
 await denied(()=>rpc('authenticated',demo,'retention_portal_thread',[conv]),/Conversation access denied/);
 await q('update public.customers set is_synthetic=true where id=$1',[one.customer_id]);
 await q('update public.customer_portal_users set active=false where user_id=$1',[demo]);
 await denied(()=>rpc('authenticated',demo,'retention_portal_thread',[conv]),/Conversation access denied/);
});
await test('AI requests coalesce while pending, claim once, cool down and expire safely',async()=>{
 const row=await ingest('REQUEST-GUARD');await rpc('authenticated',supervisor,'retention_assign_case',[row.case_id,agent]);
 const args=[row.case_id,'manual:call_script:guard-one','Ask one question',null];
 const first=await rpc('authenticated',agent,'retention_request_recommendation',args);
 const second=await rpc('authenticated',agent,'retention_request_recommendation',[row.case_id,'manual:call_script:guard-two','Different tone',null]);assert.equal(second,first);
 await denied(()=>rpc('authenticated',agent,'retention_claim_ai_request',[first]),/permission denied/);
 assert.equal((await rpc('service_role',null,'retention_claim_ai_request',[first]))[0].id,first);
 assert.deepEqual(await rpc('service_role',null,'retention_claim_ai_request',[first]),[]);
 assert(!(await rpc('service_role',null,'retention_pending_jobs',[100,'call_script'])).some(j=>j.id===first));
 const result=await rpc('service_role',null,'retention_complete_job',[first,'Verify needs','Grounded rationale',null,'fixture','fixture-model','fixture-prompt','Ask one question.']);
 assert.equal(await rpc('authenticated',agent,'retention_request_recommendation',[row.case_id,'manual:call_script:guard-three','Ask one question',null]),first);
 await denied(()=>rpc('authenticated',otherAgent,'retention_mark_script_used',[result.recommendation_id]),/Case access denied/);
 await denied(()=>rpc('service_role',null,'retention_mark_script_used',[result.recommendation_id]),/permission denied/);
 await rpc('authenticated',agent,'retention_mark_script_used',[result.recommendation_id]);
 const used=await scalar('select used_at from public.ai_recommendations where id=$1',[result.recommendation_id]);assert(used);
 await rpc('authenticated',agent,'retention_mark_script_used',[result.recommendation_id]);assert.equal((await scalar('select used_at from public.ai_recommendations where id=$1',[result.recommendation_id])).getTime(),used.getTime());
 const next=await rpc('authenticated',agent,'retention_request_recommendation',[row.case_id,'manual:message:stale-guard']);await rpc('service_role',null,'retention_claim_ai_request',[next]);
 await q("update public.automation_jobs set claimed_at=now()-interval '6 minutes' where id=$1",[next]);await rpc('service_role',null,'retention_pending_jobs',[100,'message']);
 assert.equal(await scalar('select status from public.automation_jobs where id=$1',[next]),'failed');
 await denied(()=>rpc('service_role',null,'retention_complete_job',[next,'Verify','Too late','Hello','fixture','fixture','fixture']),/not pending/);
});
await test('every worker request contains chronological sent history and customer replies only',async()=>{
 await q("update public.retention_cases set case_status='in_progress',assigned_agent_id=$1 where id=$2",[agent,one.case_id]);
 await q("update public.automation_jobs set status='failed' where case_id=$1 and status='queued'",[one.case_id]);
 const job=await rpc('authenticated',agent,'retention_request_recommendation',[one.case_id,'manual:message:history-check','Continue latest reply',null]);
 const context=await rpc('service_role',null,'retention_worker_context',[job]);
 assert.equal(context.care_stage,'in_progress');assert(context.conversation.some(m=>m.direction==='inbound'));assert(context.conversation.some(m=>m.direction==='outbound'));
 const expected=await q("select m.direction,r.body from public.messages m join public.message_revisions r on r.message_id=m.id and r.revision=case when m.direction='outbound' then m.sent_revision else m.current_revision end where m.case_id=$1 and m.visibility='external' and (m.direction='inbound' or (m.direction='outbound' and m.delivery_status='sent')) order by coalesce(m.sent_at,m.created_at),m.id",[one.case_id]);
 assert.deepEqual(context.conversation.map(({direction,body})=>({direction,body})),expected);
});
await db.close();
await test('upgrade from existing six-table foundation preserves customers',async()=>{
 const upgrade=new PGlite();await upgrade.exec(bootstrap);
 await upgrade.exec(await readFile(resolve(root,'supabase/migrations/20261018000100_ingestion_foundation.sql'),'utf8'));
 await upgrade.exec("insert into public.customers(customer_ref,source_dataset,is_synthetic) values('EXISTING','fixture',true)");
 await upgrade.exec(setup);
 assert.equal((await upgrade.query("select customer_ref from public.customers where customer_ref='EXISTING'")).rows.length,1);
 await denied(()=>upgrade.exec(setup),/already installed/);await upgrade.exec('rollback');await upgrade.close();
});
await test('lean upgrade keeps existing full-workspace drafts and queued requests',async()=>{
 const upgrade=new PGlite();await upgrade.exec(bootstrap);
 let oldSetup;
 try{oldSetup=await readFile(resolve(root,'tmp/supabase-before-lean/setup.sql'),'utf8');}catch{}
 await upgrade.exec(oldSetup??setup);
 if(!oldSetup){
   // Portable compatibility fixture when the previous local snapshot is absent.
   await upgrade.exec(`alter table public.automation_jobs drop constraint automation_jobs_status_check;
     alter table public.automation_jobs add constraint automation_jobs_status_check check(status in ('queued','running','completed','failed','cancelled'));
     alter table public.automation_jobs add column attempt_count int default 0,add column next_attempt_at timestamptz default now(),
       add column lease_token uuid,add column lease_until timestamptz,add column error_code text;
     create function public.retention_claim_job() returns jsonb language sql as $$select '{}'::jsonb$$;
     create function public.retention_fail_job(uuid,uuid,text) returns void language sql as $$select$$;`);
 }
 await upgrade.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 const ids=(await upgrade.query('select public.retention_ingest_prediction($1,$2,$3,$4,$5,$6) as result',
   [run,'UPGRADE-CUSTOMER',features,pred,null,{}])).rows[0].result;
 await upgrade.query('insert into auth.users(id) values($1)',[agent]);
 await upgrade.query("insert into public.staff_members(user_id,display_name,role) values($1,'Upgrade Agent','agent')",[agent]);
 await upgrade.query('update public.retention_cases set assigned_agent_id=$1 where id=$2',[agent,ids.case_id]);
 await upgrade.query('select set_config(\'request.jwt.claims\',$1,false)',[JSON.stringify({role:'authenticated',sub:agent})]);
 const m=(await upgrade.query("select public.retention_save_draft($1,'Keep this draft','upgrade-draft') as result",[ids.case_id])).rows[0].result;
 await upgrade.exec("update public.automation_jobs set status='running',attempt_count=2,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'");
 const upgradeSql=await readFile(resolve(root,'supabase/upgrade_lean.sql'),'utf8');
 await upgrade.exec(upgradeSql);await upgrade.exec(upgradeSql);
 assert.equal((await upgrade.query('select body from public.message_revisions where message_id=$1',[m.message_id])).rows[0].body,'Keep this draft');
 assert.equal((await upgrade.query('select status from public.automation_jobs where case_id=$1',[ids.case_id])).rows[0].status,'queued');
 assert.equal((await upgrade.query("select count(*)::int as n from pg_proc where pronamespace='public'::regnamespace and (proname='retention_claim_job' or (proname='retention_fail_job' and pronargs<>1))")).rows[0].n,0);
 assert.equal((await upgrade.query("select has_function_privilege('anon','public.retention_complete_job(uuid,text,text,text,text,text,text,text,jsonb,uuid,uuid,text)'::regprocedure,'EXECUTE') as allowed")).rows[0].allowed,false);
 await upgrade.close();
});
console.log(`${passed} database integration checks passed.`);
await writeFile(resolve(here,'results.json'),JSON.stringify({engine:'PGlite 0.3.15 (PostgreSQL WASM)',passed,tests,
 sourceCompatibility,
 limits:['Supabase Auth/Storage and JWT gateway are stubbed. Hosted deployment not tested.',
 'PGlite serializes queries; true multi-connection concurrency requires hosted/Postgres checks.']},null,2)+'\n');
