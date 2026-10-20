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

one=await ingest('TICKET-A');two=await ingest('TICKET-B');
await rpc('authenticated',supervisor,'retention_assign_case',[one.case_id,agent]);
await rpc('authenticated',supervisor,'retention_assign_case',[two.case_id,otherAgent]);
const manual={description:'Customer needs a technical check.',category:'connection_issue',priority:'normal',repeat_issue:'unknown',churn_concern:'unknown',missing_fields:['Router light status'],evidence:[]};
let row,job,sourceMessage;
await test('manual draft persists without queueing; wrong owner and customer cannot access',async()=>{
 row=await rpc('authenticated',agent,'retention_save_ticket',[one.case_id,manual,'manual-ticket']);
 assert.equal(row.handoff_status,'draft');assert.equal(row.department,'Technical Support');
 assert.equal(await rpc('service_role',null,'retention_process_support',[10]),0);
 await denied(()=>rpc('authenticated',otherAgent,'retention_save_ticket',[one.case_id,manual,'wrong-owner']),/Case access denied/);
 await denied(()=>rpc('authenticated',customer,'retention_submit_ticket',[row.id,1]),/Case access denied/);
 assert.equal((await as('authenticated',otherAgent,'select * from public.support_requests')).length,0);
 await denied(()=>rpc('authenticated',agent,'retention_complete_ticket',[uid(99),manual,'fixture']),/permission denied/);
 await denied(()=>rpc('service_role',null,'retention_submit_ticket',[row.id,1]),/permission denied/);
});
await test('empty chat cannot start AI; invalid category rejected at server',async()=>{
 await denied(()=>rpc('authenticated',agent,'retention_request_ticket',[one.case_id,'manual:ticket:empty']),/Customer chat required/);
 await denied(()=>rpc('authenticated',agent,'retention_save_ticket',[one.case_id,{...manual,category:'invented'},'invalid']),/Invalid category/);
});
await test('ticket edits check version; submit is explicit and idempotent',async()=>{
 row=await rpc('authenticated',agent,'retention_save_ticket',[one.case_id,{...manual,description:'Reviewed technical request.'},'save-2',row.id,1]);assert.equal(row.version,2);
 await denied(()=>rpc('authenticated',agent,'retention_save_ticket',[one.case_id,manual,'stale',row.id,1]),/Ticket changed/);
 await denied(()=>rpc('authenticated',agent,'retention_submit_ticket',[row.id,1]),/Ticket changed/);
 const submitted=await rpc('authenticated',agent,'retention_submit_ticket',[row.id,2]);assert.equal(submitted.handoff_status,'queued');assert.equal(submitted.submitted_by,agent);
 assert.deepEqual(await rpc('authenticated',agent,'retention_submit_ticket',[row.id,2]),submitted);
 await denied(()=>rpc('authenticated',agent,'retention_save_ticket',[one.case_id,manual,'after-submit',row.id,2]),/not an editable draft/);
 assert.equal(await rpc('service_role',null,'retention_process_support',[10]),1);
 assert((await scalar('select external_receipt from public.support_requests where id=$1',[row.id])).startsWith('mock-support:'));
});
const conversation=await scalar("insert into public.conversations(case_id,customer_id,selected_channel) values($1,$2,'Zalo') returning id",[one.case_id,one.customer_id]);
await db.exec('begin');
sourceMessage=await scalar("insert into public.messages(case_id,conversation_id,sender_type,direction,visibility,approval_status,delivery_status) values($1,$2,'customer','inbound','external','not_required','received') returning id",[one.case_id,conversation]);
const body='My Internet drops every evening. This happened last week too. I may cancel.';
await q("insert into public.message_revisions(message_id,revision,body,content_hash,request_key) values($1,1,$2,encode(sha256(convert_to($2,'UTF8')),'hex'),'inbound-ticket')",[sourceMessage,body]);await db.exec('commit');
await rpc('authenticated',agent,'retention_save_draft',[one.case_id,'Internal sensitive note','note-ticket','Zalo',null,null,null,true]);
await rpc('authenticated',agent,'retention_save_draft',[one.case_id,'Unsent customer draft','unsent-ticket']);
await test('AI job freezes full external chat, excludes notes and unsent drafts, and coalesces requests',async()=>{
 job=await rpc('authenticated',agent,'retention_request_ticket',[one.case_id,'manual:ticket:first']);
 assert.equal(await rpc('authenticated',agent,'retention_request_ticket',[one.case_id,'manual:ticket:second']),job);
 await rpc('service_role',null,'retention_claim_ai_request',[job]);
 assert.deepEqual(await rpc('service_role',null,'retention_claim_ai_request',[job]),[]);
 const context=await rpc('service_role',null,'retention_ticket_context',[job]);assert.equal(context.conversation.length,1);assert.equal(context.conversation[0].body,body);
 for(const key of ['driver_groups','churn_probability','requested_by','rewrite_source_text'])assert(!(key in context));
 assert(!JSON.stringify(context).includes('Internal sensitive'));assert(!JSON.stringify(context).includes('Unsent customer'));
});
const output={...manual,description:'Repeated evening disconnections; customer may cancel.',repeat_issue:'yes',churn_concern:'explicit',evidence:[{field:'repeat_issue',message_id:sourceMessage,quote:'This happened last week too.'},{field:'churn_concern',message_id:sourceMessage,quote:'I may cancel.'}]};
await test('AI evidence must quote actual customer chat; explicit flags need evidence',async()=>{
 await denied(()=>rpc('service_role',null,'retention_complete_ticket',[job,{...output,evidence:[]},'fixture']),/evidence required/);
 await denied(()=>rpc('service_role',null,'retention_complete_ticket',[job,{...output,evidence:[{field:'repeat_issue',message_id:sourceMessage,quote:'invented'}]},'fixture']),/Evidence must quote/);
});
await test('AI completion saves draft once; no message or outbox is created',async()=>{
 const before=await scalar('select count(*)::int from public.messages');
 const id=await rpc('service_role',null,'retention_complete_ticket',[job,output,'fixture']);assert.equal(await rpc('service_role',null,'retention_complete_ticket',[job,output,'fixture']),id);
 const ticket=await scalar('select to_jsonb(r) from public.support_requests r where id=$1',[id]);assert.equal(ticket.handoff_status,'draft');assert.equal(ticket.source_messages.length,1);
 assert.equal(await scalar('select count(*)::int from public.messages'),before);assert.equal(await scalar('select count(*)::int from public.delivery_outbox'),0);
 assert.equal(await rpc('service_role',null,'retention_process_support',[10]),0);
});
await test('closed case blocks new ticket and submit',async()=>{
 await q("update public.retention_cases set case_status='closed',close_reason='Demo complete',closed_at=now() where id=$1",[one.case_id]);
 await denied(()=>rpc('authenticated',agent,'retention_request_ticket',[one.case_id,'manual:ticket:closed']),/Case closed/);
});
await test('migration preserves existing support history when upgrading the prior workspace',async()=>{
 const old=new PGlite();await old.exec(bootstrap);
 const marker=setup.indexOf('-- Source: 20261020182841_chat_to_ticket.sql');assert(marker>0);await old.exec(setup.slice(0,marker)+'commit;');
 await old.exec("insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'); insert into public.staff_members(user_id,display_name,role) values('00000000-0000-4000-8000-000000000001','Supervisor','supervisor');");
 await old.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"service_role"})]);
 const fixture=(await old.query('select public.retention_ingest_prediction($1,$2,$3,$4,$5,$6) as r',[{...run,run_key:'ticket-upgrade'},'UPGRADE-TICKET',features,pred,null,{display_name:'Synthetic upgrade'}])).rows[0].r;
 await old.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:supervisor})]);
 const oldId=(await old.query("select public.retention_request_support($1,'Existing support request','ticket-upgrade-key') as id",[fixture.case_id])).rows[0].id;
 await old.exec(await readFile(resolve(root,'supabase/migrations/20261020182841_chat_to_ticket.sql'),'utf8'));
 const retained=(await old.query('select * from public.support_requests where id=$1',[oldId])).rows[0];assert.equal(retained.request_body,'Existing support request');assert.equal(retained.handoff_status,'queued');

 assert.equal((await old.query("select count(*)::int as n from public.staff_members")).rows[0].n,1);
 assert.equal((await old.query("select has_function_privilege('service_role','public.retention_submit_ticket(uuid,integer)','execute') as allowed")).rows[0].allowed,false);
 await old.close();
});
console.log(`${passed} ticket checks passed.`);
await writeFile(resolve(here,'ticket-results.json'),JSON.stringify({engine:'PGlite',passed,tests},null,2)+'\n');
await db.close();
