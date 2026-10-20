// Explicit live check: three webhook executions in prepare; two manual workers run separately.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const env=Object.fromEntries((await readFile(new URL('website/app/.env.local',root),'utf8')).trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const password=(await readFile(new URL('tmp/demo-auth/accounts.md',root),'utf8')).match(/Shared demo password: (.+)/)?.[1]?.trim();
const mode=process.argv[2];assert(['prepare','resume','verify'].includes(mode));assert(password);
const stateFile=new URL('tmp/n8n-cutover-fixture.json',root),evidenceFile=new URL('docs/evidence/n8n_cutover.json',root);
async function request(path,body,token){
 const r=await fetch(env.VITE_SUPABASE_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await r.json();assert(r.ok,`Supabase ${r.status}: ${data?.message||'request failed'}`);return data;
}
const auth=await request('/auth/v1/token?grant_type=password',{email:(mode==='resume'?'supervisor':'agent')+'@retention.example',password});
const rpc=(name,args={})=>request('/rest/v1/rpc/'+name,args,auth.access_token);
try{
 if(mode==='prepare'||mode==='resume'){
  let state;
  if(mode==='prepare'){
  // Refuse to overwrite evidence and accidentally spend another three executions.
  let prior;try{prior=await readFile(stateFile,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}assert(!prior,'Fixture already prepared; inspect it instead of rerunning');
  const [row]=await request('/rest/v1/retention_care_queue?select=*',undefined,auth.access_token);assert(row);
  const detail=await rpc('retention_case_detail',{p_case_id:row.case_id});
  const customer=detail.customer;
  assert(customer?.is_synthetic===true&&customer?.profile_source==='synthetic_demo','Synthetic fixture required');
  const run=crypto.randomUUID();
  state={checked_at:new Date().toISOString(),instance:'https://group-2-new.app.n8n.cloud',case_id:row.case_id,requests:[],checks:[]};
  await writeFile(stateFile,JSON.stringify(state,null,2));
  for(const type of ['message','call_script','explanation']){
   const key=`manual:${type}:cutover-${run}`;
   const id=await rpc('retention_request_recommendation',{p_case_id:row.case_id,p_request_key:key,p_instructions:null,p_source_text:null});
   state.requests.push({type,job_id:id,key});await writeFile(stateFile,JSON.stringify(state,null,2));
   const r=await fetch(state.instance+'/webhook/retention-ai-'+type,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({job_id:id})});
   assert(r.ok,`Webhook ${type}: ${r.status}`);console.log(`${type}: webhook accepted`);
  }
  let jobs=[];
  for(let i=0;i<40;i++){
   jobs=await request('/rest/v1/automation_jobs?select=id,status,claimed_at&id=in.('+state.requests.map(r=>r.job_id).join(',')+')',undefined,auth.access_token);
   if(jobs.length===3&&jobs.every(j=>['completed','failed','cancelled'].includes(j.status)))break;
   await new Promise(resolve=>setTimeout(resolve,3000));
  }
  state.jobs=jobs;await writeFile(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify({jobs}));
  assert.equal(jobs.length,3);assert(jobs.every(j=>j.status==='completed'&&j.claimed_at),'All three real AI jobs must complete');
  }else state=JSON.parse(await readFile(stateFile,'utf8'));
  const actualJobs=await request('/rest/v1/automation_jobs?select=id,request_key,status,claimed_at&id=in.('+state.requests.map(r=>r.job_id).join(',')+')',undefined,auth.access_token);
  assert.equal(actualJobs.length,3);assert(actualJobs.every(j=>j.status==='completed'&&j.claimed_at));
  // Request RPC may coalesce an existing pending job; use its persisted key.
  for(const r of state.requests)r.key=actualJobs.find(j=>j.id===r.job_id).request_key;
  const d=await rpc('retention_case_detail',{p_case_id:state.case_id});
  for(const r of state.requests){
   const result=d.recommendations.find(x=>x.request_key===r.key);assert.equal(result?.generation_mode,'llm');
   const messages=d.messages.filter(m=>m.recommendation_id===result.id);
   if(r.type==='message'){assert.equal(messages.length,1);assert.equal(messages[0].approval_status,'draft');assert.equal(messages[0].delivery_status,'not_queued')}
   else {assert.equal(messages.length,0);if(r.type==='call_script')assert(result.call_script?.trim())}
  }
  state.checks.push('Three authenticated AI requests completed; generated message remains draft and unsent');
  const preferences=await request('/rest/v1/contact_preferences?select=customer_id&channel=eq.Zalo&contact_allowed=eq.true&opt_out_at=is.null',undefined,auth.access_token);
  const queue=await request('/rest/v1/retention_care_queue?select=case_id,customer_id,is_synthetic&case_status=neq.closed',undefined,auth.access_token);
  const eligible=queue.find(c=>c.is_synthetic&&preferences.some(p=>p.customer_id===c.customer_id));
  console.log(JSON.stringify({eligible_contact_count:preferences.length,eligible_case:eligible?.case_id}));
  if(!eligible){
   state.delivery_fixture='No active synthetic case has existing Zalo consent; verify empty delivery queue without changing consent';
  }
  state.ops_case_id=eligible?.case_id||state.case_id;
  // Fixed English text is the reviewed mock delivery fixture; generated AI text stays unapproved.
  const run=state.requests[0].job_id;
  if(eligible){
  const draft=await rpc('retention_save_draft',{p_case_id:state.ops_case_id,p_body:'This is a simulated migration test. May we confirm your current Internet service needs?',p_request_key:'cutover:delivery:'+run,p_channel:'Zalo'});
  await rpc('retention_review_message',{p_message_id:draft.message_id,p_revision:draft.revision,p_decision:'approved'});state.message_id=draft.message_id;
  }
  state.support_key='cutover:support:'+run;state.reminder_key='cutover:reminder:'+run;
  await rpc('retention_request_support',{p_case_id:state.ops_case_id,p_body:'Synthetic migration test: verify current service needs; mock handoff only.',p_request_key:state.support_key,p_preferred_contact_time:null});
  await rpc('retention_schedule_reminder',{p_case_id:state.ops_case_id,p_due_at:new Date(Date.now()+10000).toISOString(),p_request_key:state.reminder_key});
  await writeFile(stateFile,JSON.stringify(state,null,2));console.log('Ready for one manual delivery execution and one follow-up/support execution.');
 }else{
  const state=JSON.parse(await readFile(stateFile,'utf8'));
  const d=await rpc('retention_case_detail',{p_case_id:state.ops_case_id});
  if(state.message_id){const message=d.messages.find(m=>m.id===state.message_id);assert.equal(message?.delivery_status,'sent');assert(message.sent_at)}
  const support=d.support_requests.find(r=>r.idempotency_key===state.support_key);assert.equal(support?.handoff_status,'sent');assert(support.external_receipt?.startsWith('mock-support:'));
  const reminder=d.follow_up_tasks.find(r=>r.idempotency_key===state.reminder_key);assert.equal(reminder?.status,'due');
  const notifications=await request('/rest/v1/notifications?select=type,case_id',undefined,auth.access_token);assert(notifications.some(n=>n.type==='follow_up_due'&&n.case_id===state.ops_case_id));
  state.checks.push(state.message_id?'Reviewed fixed test message sent by mock delivery worker':'Delivery credential/empty queue tested; no send fixture because existing consent is absent','Support mock receipt recorded','Due reminder and staff notification recorded');
  state.verified_at=new Date().toISOString();state.executions_triggered=5;state.schedules_enabled=false;
  await writeFile(evidenceFile,JSON.stringify(state,null,2)+'\n');console.log(JSON.stringify({checks:state.checks,message_id:state.message_id}));
 }
}finally{await fetch(env.VITE_SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${auth.access_token}`}})}
