import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
const {PGlite}=await import('@electric-sql/pglite');
const db=new PGlite();
process.on('uncaughtException',e=>{console.error(JSON.stringify({message:e.message,detail:e.detail,where:e.where}));process.exit(1)});
const source=await readFile(resolve(root,'supabase/tests/workspace.test.mjs'),'utf8');
await db.exec(source.match(/const bootstrap=`([\s\S]*?)`;/)[1]);
await db.exec(await readFile(resolve(root,'supabase/setup.sql'),'utf8'));
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const supervisor=uid(1),agent=uid(2),second=uid(3),portal=uid(4),inactive=uid(5);
await q('insert into auth.users(id) select x::uuid from unnest($1::text[]) x',[[supervisor,agent,second,portal,inactive]]);
await q(`insert into public.staff_members(user_id,display_name,role,active) values($1,'Supervisor','supervisor',true),($2,'Agent A','agent',true),($3,'Agent B','agent',true),($4,'Inactive','agent',false)`,[supervisor,agent,second,inactive]);
async function as(user,sql,args=[],role='authenticated'){
 await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,role})]);await db.exec(`set role ${role}`);
 try{return await q(sql,args)}finally{await db.exec('reset role');await q("select set_config('request.jwt.claims','{}',false)")}
}
const rpc=async(name,args=[],user=supervisor)=>Object.values((await as(user,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))[0])[0];
const count=table=>scalar(`select count(*)::int from public.${table}`);
const make=async(ref,risk=.8)=>{
 const customer=await scalar("insert into public.customers(customer_ref,source_dataset,is_synthetic,display_name,contract_ref) values($1,'assignment-test',true,$1,$1) returning id",[ref]);
 const run=await scalar("insert into public.prediction_runs(run_key,dataset_version,model_version,calibration_version,snapshot_date,target_period_start,source_sha256,is_synthetic) values($1,'assignment-test','fixture','fixture','2026-10-10','2026-10-11',repeat('a',64),true) returning id",[ref]);
 const snapshot=await scalar("insert into public.customer_snapshots(customer_id,snapshot_date,dataset_version,features) values($1,'2026-10-10','assignment-test','{}') returning id",[customer]);
 const prediction=await scalar("insert into public.churn_predictions(customer_id,snapshot_id,run_id,snapshot_date,target_period_start,raw_probability,churn_probability,explanations_status) values($1,$2,$3,'2026-10-10','2026-10-11',$4,$4,'fixture') returning id",[customer,snapshot,run,risk]);
 return scalar("insert into public.retention_cases(customer_id,prediction_id,target_period_start) values($1,$2,'2026-10-11') returning id",[customer,prediction]);
};
const ids=await Promise.all([make('HIGH',.95),make('MID',.85),make('LOW',.7)]);
const weights={continuity:40,experience:30,load:30};
let state,config,preview,result;const checks=[];
async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name)}
await test('only active Supervisor can read capacity or preview; no direct writes',async()=>{
 for(const user of [agent,portal,inactive])await assert.rejects(()=>rpc('retention_agent_capacity',[],user),/Supervisor required/);
 await assert.rejects(()=>as(null,'select public.retention_agent_capacity()',[],'anon'),/permission denied/);
 assert.equal(await scalar("select has_table_privilege('authenticated','public.assignment_runs','INSERT')"),false);
 assert.equal(await scalar("select has_function_privilege('authenticated','app_private.apply_case_assignment(uuid,uuid,text,uuid,jsonb,uuid,boolean,text)','EXECUTE')"),false);
 state=await rpc('retention_agent_capacity');assert.equal(state.agents.length,2);
 config={method:'round_robin',period:'2026-10-11',selectedIds:[agent,second],limits:state.limits,weights,overrides:{}};
});
await test('Preview is read-only, risk sorted and deterministically rotates',async()=>{
 const before=await count('interaction_events');preview=await rpc('retention_preview_assignment',[config]);
 assert.deepEqual(preview.proposals.map(p=>p.id),ids);assert.deepEqual(preview.proposals.map(p=>p.agentId),[agent,second,agent]);
 assert.equal(await count('interaction_events'),before);assert.equal(await count('assignment_runs'),0);
 assert.equal((await rpc('retention_agent_capacity')).cursor,null);
});
await test('Confirm persists once with one summary per recipient and unchanged care state',async()=>{
 result=await rpc('retention_confirm_assignment',['test-confirm',preview]);assert.equal(result.proposals.length,3);
 assert.equal(await scalar('select assigned_agent_id from public.retention_cases where id=$1',[ids[0]]),agent);
 assert.equal(await count('assignment_runs'),1);assert.equal(await count('notifications'),2);
 assert.equal(await scalar("select count(*)::int from public.retention_cases where case_status='new'"),3);
 assert.deepEqual(await rpc('retention_confirm_assignment',['test-confirm',preview]),result);
 assert.equal(await count('notifications'),2);assert.equal(await count('interaction_events'),3);
 assert.equal((await rpc('retention_agent_capacity')).agents.find(a=>a.id===agent).today,2);
 await assert.rejects(()=>rpc('retention_confirm_assignment',['test-confirm',{...preview,config:{...config,method:'manual'}}]),/another confirmation/);
});
await test('batch notifications are private and readable without case_id',async()=>{
 const notes=await as(agent,'select * from public.notifications');assert.equal(notes.length,1);assert.equal(notes[0].case_id,null);
 await rpc('retention_mark_notification_read',[notes[0].id],agent);
 assert.equal((await as(portal,'select * from public.notifications')).length,0);
 assert.equal((await as(agent,'select * from public.assignment_runs')).length,0);
 await assert.rejects(()=>rpc('retention_mark_notification_read',[notes[0].id],second),/access denied/);
});
await test('manual no-op, expected owner, unassign and follow-up transfer preserve quota',async()=>{
 await q("insert into public.follow_up_tasks(case_id,task_type,due_at,assigned_agent_id,idempotency_key) values($1,'manual_reminder',now(),$2,'assignment-task')",[ids[0],agent]);
 const events=await count('interaction_events');await rpc('retention_assign_case',[ids[0],agent]);assert.equal(await count('interaction_events'),events);
 await assert.rejects(()=>rpc('retention_change_assignment',[ids[0],second,null,null]),/owner changed/);
 await rpc('retention_change_assignment',[ids[0],second,agent,null]);
 assert.equal(await scalar('select assigned_agent_id from public.follow_up_tasks where case_id=$1',[ids[0]]),second);
 await assert.rejects(()=>rpc('retention_change_assignment',[ids[0],null,second,null]),/Reason required/);
 await rpc('retention_change_assignment',[ids[0],null,second,'Rebalance workload']);
 assert.equal(await scalar('select assigned_agent_id from public.follow_up_tasks where case_id=$1',[ids[0]]),null);
 await rpc('retention_change_assignment',[ids[0],agent,null,null]);
 assert.equal((await rpc('retention_agent_capacity')).agents.find(a=>a.id===agent).today,2);
 await assert.rejects(()=>rpc('retention_assign_case',[ids[0],supervisor]),/Active staff/);
 await q("update public.retention_cases set case_status='closed',closed_at=now() where id=$1",[ids[2]]);
 await assert.rejects(()=>rpc('retention_assign_case',[ids[2],second]),/Case closed/);
});
await test('capacity and configuration constraints apply to manual and batch',async()=>{
 await assert.rejects(()=>rpc('retention_assignment_settings',[20,40,{...weights,load:31}]),/Invalid/);
 state=await rpc('retention_assignment_settings',[2,40,weights]);
 const fresh=await make('AT-CAP');await assert.rejects(()=>rpc('retention_assign_case',[fresh,agent]),/Daily assignment limit/);
 const plan=await rpc('retention_preview_assignment',[{...config,limits:state.limits}]);assert(plan.proposals.every(p=>p.agentId===second));
 await assert.rejects(()=>rpc('retention_confirm_assignment',['stale-settings',preview]),/changed/);
 await rpc('retention_assignment_settings',[20,1,weights]);await assert.rejects(()=>rpc('retention_assign_case',[fresh,agent]),/Open case limit/);
 await rpc('retention_assignment_settings',[20,40,weights]);
});
await test('confirm skips a concurrently assigned case and never reroutes approved recipients',async()=>{
 const s=await rpc('retention_agent_capacity');const p=await rpc('retention_preview_assignment',[{...config,limits:s.limits}]);
 const target=p.proposals[0];await rpc('retention_assign_case',[target.id,second]);
 const r=await rpc('retention_confirm_assignment',['stale-case',p]);assert.equal(r.proposals.length,0);assert.equal(r.skipped.length,1);
 assert.equal(await scalar('select assigned_agent_id from public.retention_cases where id=$1',[target.id]),second);
});
await test('server planner matches weighted example and rejects forged payloads',async()=>{
 const fake={...state,limits:{daily:20,open:40},agents:[{id:agent,name:'A',open:30,today:0,experience:{connection_quality:2}},{id:second,name:'B',open:10,today:0,experience:{connection_quality:4}}],cases:[{id:ids[0],risk:.9,owner:null,stage:'new',start:'2026-10-11',created_at:'2026-10-11',group:'connection_quality',groupName:'Connection quality',previousAgent:agent}]};
 const p=await scalar('select app_private.assignment_plan($1,$2)',[fake,{...config,method:'weighted'}]);assert.equal(p.proposals[0].score,62.5);assert.equal(p.proposals[0].agentId,agent);
 const current=await rpc('retention_agent_capacity');const empty=await rpc('retention_preview_assignment',[{...config,limits:current.limits}]);
 await assert.rejects(()=>rpc('retention_confirm_assignment',['fake',{...empty,proposals:[{id:ids[0],agentId:portal}]}]),/selected agent/);
 await assert.rejects(()=>rpc('retention_confirm_assignment',['dup',{...preview,proposals:[preview.proposals[0],preview.proposals[0]]}]),/Duplicate/);
});
await test('same case received twice today consumes one slot in server batch and manual paths',async()=>{
 await rpc('retention_assignment_settings',[1,40,weights]);
 await rpc('retention_change_assignment',[ids[1],null,second,'Return to queue']);
 const current=await rpc('retention_agent_capacity');
 const p=await rpc('retention_preview_assignment',[{...config,method:'manual',selectedIds:[second],limits:current.limits,overrides:{[ids[1]]:second}}]);
 assert.equal(p.proposals.length,1);assert.equal(p.proposals[0].id,ids[1]);
 const before=current.agents.find(a=>a.id===second).today;
 const r=await rpc('retention_confirm_assignment',['same-case-again',p]);assert.equal(r.proposals.length,1);
 assert.equal((await rpc('retention_agent_capacity')).agents.find(a=>a.id===second).today,before);
});
await writeFile(resolve(root,'supabase/tests/assignment-results.json'),JSON.stringify({engine:'PGlite PostgreSQL WASM',passed:checks.length,checks,limits:['Auth gateway and true multi-connection concurrency require separate checks.']},null,2)+'\n');
await db.close();console.log(`${checks.length} assignment checks passed.`);
