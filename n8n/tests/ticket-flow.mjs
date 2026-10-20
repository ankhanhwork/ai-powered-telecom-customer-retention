import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const env=Object.fromEntries((await readFile(new URL('website/app/.env.local',root),'utf8')).trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const password=(await readFile(new URL('tmp/demo-auth/accounts.md',root),'utf8')).match(/Shared demo password: (.+)/)?.[1]?.trim();
const stateFile=new URL('tmp/ticket-live-fixture.json',root),evidenceFile=new URL('docs/evidence/chat_to_ticket.json',root);
let existing;try{existing=await readFile(stateFile,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}assert(!existing,'Fixture already exists. Read its state; do not spend executions again.');
const session=await fetch(env.VITE_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:'supervisor@retention.example',password})});assert(session.ok);const auth=await session.json();
const headers={apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'};
async function db(path,body){const r=await fetch(env.VITE_SUPABASE_URL+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();assert(r.ok,'Supabase '+r.status+': '+(data.message||''));return data}
const rpc=(name,args)=>db('rpc/'+name,args);
const state={started_at:new Date().toISOString(),executions_triggered:0,checks:[],requests:[]};
const persist=()=>writeFile(stateFile,JSON.stringify(state,null,2));
async function wake(type,id){state.executions_triggered++;state.requests.push({type,job_id:id});await persist();const r=await fetch('https://group-2-new.app.n8n.cloud/webhook/retention-ai-'+type,{method:'POST',headers,body:JSON.stringify({job_id:id}),signal:AbortSignal.timeout(8000)});assert(r.ok,'Webhook '+r.status);assert.equal((await r.json()).message,'Workflow was started');}
async function waitJob(id){let j;for(let i=0;i<20;i++){[j]=await db('automation_jobs?select=id,status,claimed_at,request_key&id=eq.'+id);if(j?.status!=='queued')break;await new Promise(r=>setTimeout(r,3000));}assert.equal(j?.status,'completed','Job did not complete: '+j?.status);return j}
try{
 const [caseRow]=await db('retention_care_queue?select=case_id&case_id=eq.1df49385-9fdc-4e46-ac9d-a85fb7bdfd44');assert(caseRow);state.case_id=caseRow.case_id;
 const before=await rpc('retention_case_detail',{p_case_id:state.case_id});assert(before.customer.is_synthetic&&before.customer.profile_source==='synthetic_demo');assert(before.messages.some(m=>m.direction==='inbound'&&m.visibility==='external'));
 await persist();const job=await rpc('retention_request_ticket',{p_case_id:state.case_id,p_request_key:'manual:ticket:live-'+crypto.randomUUID()});await wake('ticket',job);await waitJob(job);
 const after=await rpc('retention_case_detail',{p_case_id:state.case_id});const ticket=after.support_requests.find(t=>t.source_job_id===job);assert(ticket);assert.equal(ticket.handoff_status,'draft');assert.equal(ticket.submitted_at,null);assert.equal(ticket.external_receipt,null);assert(ticket.request_body.trim());assert(ticket.department);assert(ticket.model_version.includes('gpt-5.4-mini'));assert.equal(after.messages.length,before.messages.length);
 assert(ticket.source_messages.some(m=>m.direction==='inbound'));for(const e of ticket.evidence)assert(ticket.source_messages.some(m=>m.id===e.message_id&&m.direction==='inbound'&&m.body.includes(e.quote)));
 state.ticket_id=ticket.id;state.checks.push('Authenticated Supervisor webhook produced structured LLM ticket draft','Source snapshot and evidence match real synthetic customer chat','No ticket submitted or message created by ticket worker');
 if(ticket.missing_fields.length){const instruction='Ask the customer only for these missing details, using a concise, helpful message: '+ticket.missing_fields.join('; ')+'. Do not claim a ticket was submitted or confirm an appointment.';
 const id=await rpc('retention_request_recommendation',{p_case_id:state.case_id,p_request_key:'manual:message:ticket-clarify-'+crypto.randomUUID(),p_instructions:instruction,p_source_text:null});await wake('message',id);const j=await waitJob(id);const d=await rpc('retention_case_detail',{p_case_id:state.case_id});const rec=d.recommendations.find(r=>r.request_key===j.request_key);assert.equal(rec?.generation_mode,'llm');const message=d.messages.find(m=>m.recommendation_id===rec.id);assert.equal(message?.approval_status,'draft');assert.equal(message?.delivery_status,'not_queued');state.checks.push('Existing AI message worker drafted clarification; remains unapproved and unsent');}
 state.verified_at=new Date().toISOString();state.workflow_id='uYazemvlz8sw7FW3';state.timers_enabled=false;await persist();await writeFile(evidenceFile,JSON.stringify(state,null,2)+'\n');console.log(JSON.stringify(state));
}finally{await fetch(env.VITE_SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers})}
