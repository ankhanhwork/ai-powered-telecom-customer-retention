// Explicit demo-only integration check; credentials stay in ignored local storage.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const env=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const local=await readFile(new URL('../../../tmp/demo-auth/accounts.md',import.meta.url),'utf8');
const password=local.match(/Shared demo password: (.+)/)?.[1]?.trim();
assert(password,'Local demo credential missing');
const sessions=[],checks=[];
async function request(path,body,token){const r=await fetch(env.VITE_SUPABASE_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});const value=await r.json().catch(()=>null);if(!r.ok)throw new Error(`HTTP ${r.status} from ${path}: ${value?.message||value?.error_description||'request failed'}`);return value;}
try{
 const auth={};
 for(const role of ['supervisor','agent','customer']){auth[role]=await request('/auth/v1/token?grant_type=password',{email:`${role}@retention.example`,password});sessions.push(auth[role].access_token);checks.push(`${role} password login passed`);}
 const queues={};for(const role of ['supervisor','agent','customer'])queues[role]=await request('/rest/v1/retention_care_queue?select=*',undefined,auth[role].access_token);
 assert.equal(queues.supervisor.length,260);assert.equal(queues.agent.length,1);assert.equal(queues.customer.length,0);checks.push('PostgREST role-scoped queues passed');
 const call=(role,name,args)=>request('/rest/v1/rpc/'+name,args,auth[role].access_token);
 const id=queues.agent[0].case_id;
 const note='Automated demo check: internal staff note, not customer-facing.';
 const args={p_case_id:id,p_body:note,p_request_key:'hosted-smoke:staff-note:v1',p_internal:true};
 const first=await call('agent','retention_save_draft',args),again=await call('agent','retention_save_draft',args);assert.deepEqual(first,again);
 const detail=await call('agent','retention_case_detail',{p_case_id:id});assert(detail.messages.some(m=>m.id===first.message_id&&m.visibility==='internal'));checks.push('Staff note saved idempotently and visible in detail');
 const threads=await call('customer','retention_portal_threads',{});assert.equal(threads.length,1);
 const thread=await call('customer','retention_portal_thread',{p_conversation_id:threads[0].conversation_id});assert(!JSON.stringify(thread).includes(note));checks.push('Customer portal excludes internal staff note');
 await assert.rejects(()=>call('customer','retention_case_detail',{p_case_id:id}),/HTTP 403/);checks.push('Customer cannot read internal detail');
 const result={date:new Date().toISOString(),checks,limits:['No n8n or LLM execution','No outbound message sent','No phone call placed'],fixture:'One idempotent internal demo test note is retained.'};
 await writeFile(new URL('../../../docs/evidence/hosted_auth_checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{for(const token of sessions)await fetch(env.VITE_SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});}
