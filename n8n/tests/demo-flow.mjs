// Uses only provisioned synthetic demo identities; never sends to a real channel.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const env=Object.fromEntries((await readFile(new URL('../../website/app/.env.local',import.meta.url),'utf8')).trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const local=await readFile(new URL('../../tmp/demo-auth/accounts.md',import.meta.url),'utf8');
const password=local.match(/Shared demo password: (.+)/)?.[1]?.trim();
assert(password,'Local demo credentials missing');
const sessions=[],mode=process.argv[2];
assert(['prepare','reply','request-artifacts','verify-artifacts','prepare-care','verify-care','approve-ai','verify-ai-delivery'].includes(mode),'Choose a supported demo check mode');
async function req(path,body,token){const r=await fetch(env.VITE_SUPABASE_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(`HTTP ${r.status}: ${data?.message||'Request failed'}`);return data;}
const results={mode,checked_at:new Date().toISOString(),checks:[]};
try{
 const tokens={};for(const role of ['agent','customer']){const a=await req('/auth/v1/token?grant_type=password',{email:role+'@retention.example',password});tokens[role]=a.access_token;sessions.push(a.access_token);}
 const rpc=(role,name,args={})=>req('/rest/v1/rpc/'+name,args,tokens[role]);
 const [row]=await req('/rest/v1/retention_care_queue?select=*',undefined,tokens.agent);assert(row,'Assigned demo case missing');
 const detail=()=>rpc('agent','retention_case_detail',{p_case_id:row.case_id});
 const [thread]=await rpc('customer','retention_portal_threads');assert(thread,'Portal conversation missing');
 if(mode==='prepare'){
  const draft=await rpc('agent','retention_save_draft',{p_case_id:row.case_id,p_body:'Hello, this is a simulated customer-care check. Has your Internet service met your current needs?',p_request_key:'n8n-smoke:outbound:v1',p_channel:'Zalo'});
  const before=await rpc('customer','retention_portal_thread',{p_conversation_id:thread.conversation_id});assert(!before.messages.some(m=>m.id===draft.message_id),'Prepare must run before delivery for the first test');
  await rpc('agent','retention_review_message',{p_message_id:draft.message_id,p_revision:draft.revision,p_decision:'approved'});
  results.checks.push('Unapproved draft absent from portal','Agent approved exact revision and queued mock delivery');results.message_id=draft.message_id;
 }
 if(mode==='reply'){
  const portal=await rpc('customer','retention_portal_thread',{p_conversation_id:thread.conversation_id});
  const sent=portal.messages.filter(m=>m.body==='Hello, this is a simulated customer-care check. Has your Internet service met your current needs?');assert.equal(sent.length,1,'Expected exactly one mock delivery');
  const args={p_conversation_id:thread.conversation_id,p_body:'This is a demo reply. I would like to discuss my Internet usage.',p_event_key:'n8n-smoke:reply:v1'};
  const first=await rpc('customer','retention_portal_send',args);assert.equal(await rpc('customer','retention_portal_send',args),first);
  const d=await detail();assert(d.messages.some(m=>m.id===first&&m.direction==='inbound'));assert.equal(d.case.case_status,'in_progress');
  results.checks.push('Mock delivery appeared exactly once in portal','Customer reply deduplicates','Agent sees reply and case moves to Outreach');results.message_id=sent[0].id;
 }
 if(mode==='request-artifacts'){
  for(const type of ['message','call_script','explanation']){
   const args={p_case_id:row.case_id,p_request_key:'manual:'+type+':n8n-smoke-v2',p_instructions:type==='message'?'Use a warmer tone and keep it under 60 words.':type==='call_script'?'Include two discovery questions and a short closing.':null,p_source_text:type==='message'?'Hello, may we check your current Internet needs?':null};
   await rpc('agent','retention_request_recommendation',args);
  }
  results.checks.push('Three explicit staff requests queued, including rewrite instructions');
 }
 if(mode==='verify-artifacts'){
  const d=await detail();
  for(const type of ['message','call_script','explanation']){
   const r=d.recommendations.find(r=>r.request_key==='manual:'+type+':n8n-smoke-v2');assert(r&&r.generation_mode==='llm','Missing real LLM '+type);
   const messages=d.messages.filter(m=>m.recommendation_id===r.id);
   if(type==='message'){assert.equal(messages.length,1);assert.equal(messages[0].approval_status,'draft');assert.equal(messages[0].delivery_status,'not_queued');}
   else assert.equal(messages.length,0,'Non-message artifact created an outbound draft');
   if(type==='call_script')assert(r.call_script?.trim());
   results.checks.push('Real LLM '+type+' persisted with correct outbound separation');
  }
 }
 if(mode==='prepare-care'){
  await rpc('agent','retention_request_support',{p_case_id:row.case_id,p_body:'Synthetic demo handoff: please verify the current service needs with the customer.',p_request_key:'n8n-smoke:support:v1',p_preferred_contact_time:null});
  await rpc('agent','retention_schedule_reminder',{p_case_id:row.case_id,p_due_at:new Date(Date.now()+10000).toISOString(),p_request_key:'n8n-smoke:reminder:v1'});
  results.checks.push('Mock support handoff queued','Manual demo reminder scheduled ten seconds ahead');
 }
 if(mode==='verify-care'){
  const d=await detail();
  const support=d.support_requests.find(r=>r.idempotency_key==='n8n-smoke:support:v1');assert(support&&support.handoff_status==='sent'&&support.external_receipt?.startsWith('mock-support:'));
  const task=d.follow_up_tasks.find(r=>r.idempotency_key==='n8n-smoke:reminder:v1');assert(task&&task.status==='due');
  const notifications=await req('/rest/v1/notifications?select=*',undefined,tokens.agent);assert(notifications.some(n=>n.type==='follow_up_due'&&n.case_id===row.case_id));
  results.checks.push('Support workflow recorded mock receipt','Due reminder generated staff notification');
 }
 if(mode==='approve-ai'||mode==='verify-ai-delivery'){
  const d=await detail(),r=d.recommendations.find(r=>r.request_key==='manual:message:n8n-smoke-v2');
  assert(r&&r.generation_mode==='llm');const m=d.messages.find(m=>m.recommendation_id===r.id);assert(m);
  if(mode==='approve-ai'){
   assert(m.body&&!/SHAP|churn|overdue debt/i.test(m.body));
   await rpc('agent','retention_review_message',{p_message_id:m.id,p_revision:m.current_revision,p_decision:'approved'});
   results.checks.push('Agent approved the reviewed real-LLM draft revision');
  }else{
   const p=await rpc('customer','retention_portal_thread',{p_conversation_id:thread.conversation_id});assert.equal(p.messages.filter(x=>x.id===m.id).length,1);
   const args={p_conversation_id:thread.conversation_id,p_body:'Demo follow-up reply: please help me review my current Internet needs.',p_event_key:'n8n-smoke:ai-reply:v1'};
   const id=await rpc('customer','retention_portal_send',args);assert.equal(await rpc('customer','retention_portal_send',args),id);
   assert((await detail()).messages.some(x=>x.id===id&&x.direction==='inbound'));
   results.checks.push('Real-LLM draft reached portal exactly once after staff approval','Customer reply returned to Agent and deduplicated');
  }
  results.message_id=m.id;
 }
 await writeFile(new URL('../../docs/evidence/n8n-'+mode+'.json',import.meta.url),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{for(const token of sessions)await fetch(env.VITE_SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});}
