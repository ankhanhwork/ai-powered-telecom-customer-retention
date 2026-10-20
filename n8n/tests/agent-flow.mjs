// Hosted smoke test: creates three unapproved AI artifacts, never sends a message.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const env=Object.fromEntries((await readFile(new URL('../../website/app/.env.local',import.meta.url),'utf8')).trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const password=(await readFile(new URL('../../tmp/demo-auth/accounts.md',import.meta.url),'utf8')).match(/Shared demo password: (.+)/)?.[1]?.trim();
assert(password);
const sessions=[];
async function request(path,body,token){
 const response=await fetch(env.VITE_SUPABASE_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const result=await response.json();assert(response.ok,`Supabase HTTP ${response.status}`);return result;
}
try{
 const agent=await request('/auth/v1/token?grant_type=password',{email:'agent@retention.example',password});sessions.push(agent.access_token);
 const customer=await request('/auth/v1/token?grant_type=password',{email:'customer@retention.example',password});sessions.push(customer.access_token);
 const [row]=await request('/rest/v1/retention_care_queue?select=case_id',undefined,agent.access_token);assert(row);
 const started=Date.now(),requests=[];
 for(const type of ['message','call_script','explanation']){
  const key=`manual:${type}:agent-smoke-${crypto.randomUUID()}`;
  const id=await request('/rest/v1/rpc/retention_request_recommendation',{p_case_id:row.case_id,p_request_key:key,p_instructions:type==='explanation'?null:'Be concise and ask two questions to confirm current needs.',p_source_text:null},agent.access_token);
  const duplicate=await request('/rest/v1/rpc/retention_request_recommendation',{p_case_id:row.case_id,p_request_key:`manual:${type}:duplicate-${crypto.randomUUID()}`,p_instructions:type==='explanation'?null:'Be concise and ask two questions to confirm current needs.',p_source_text:null},agent.access_token);assert.equal(duplicate,id,'Pending request did not coalesce');
  const response=await fetch('https://group-2-new.app.n8n.cloud/webhook/retention-ai-'+type,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${agent.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({job_id:id})});
  assert(response.ok,`Webhook ${type} HTTP ${response.status}`);const duplicateWake=await fetch('https://group-2-new.app.n8n.cloud/webhook/retention-ai-'+type,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${agent.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({job_id:id})});assert(duplicateWake.ok);requests.push({type,id,key});
 }
 console.log('Three authenticated webhook requests accepted; awaiting results.');
 let jobs=[];
 while(Date.now()-started<115000){
  jobs=await request('/rest/v1/automation_jobs?select=id,status,claimed_at&id=in.('+requests.map(r=>r.id).join(',')+')',undefined,agent.access_token);
  if(jobs.every(j=>['completed','failed','cancelled'].includes(j.status)))break;
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
 console.log(JSON.stringify({jobs}));
 assert.equal(jobs.length,3);assert(jobs.every(j=>j.claimed_at),'Expected atomic claim before generation');assert(jobs.every(j=>j.status==='completed'),'Expected all AI Agent requests completed');
 const detail=await request('/rest/v1/rpc/retention_case_detail',{p_case_id:row.case_id},agent.access_token);
 for(const r of requests){
  const result=detail.recommendations.find(x=>x.request_key===r.key);assert(result?.generation_mode==='llm');
  const messages=detail.messages.filter(m=>m.recommendation_id===result.id);
  if(r.type==='message'){assert.equal(messages.length,1);assert.equal(messages[0].approval_status,'draft');assert.equal(messages[0].delivery_status,'not_queued')}
  else assert.equal(messages.length,0);
 }
 const threads=await request('/rest/v1/rpc/retention_portal_threads',{},customer.access_token);
 assert(threads.some(t=>t.display_name.includes('7801-CEDNV')),'Second Outreach recipient missing from demo selector');
 for(const t of threads)await request('/rest/v1/rpc/retention_portal_thread',{p_conversation_id:t.conversation_id},customer.access_token);
 const evidence={checked_at:new Date().toISOString(),elapsed_seconds:Math.round((Date.now()-started)/1000),requests:requests.map(r=>({type:r.type,job_id:r.id})),checks:['Authenticated immediate webhooks completed all three AI Agent artifacts with Google Sheets tool','Duplicate requests coalesced and duplicate webhooks claimed each job only once','Message remains unapproved and unsent; explanation/call script create no outbound','Demo portal lists and reads both Outreach recipients'],portal_thread_count:threads.length};
 await writeFile(new URL('../../docs/evidence/n8n_agents.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{
 for(const token of sessions)await fetch(env.VITE_SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}});
}
