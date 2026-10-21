// Auth gateway checks only: previews do not allocate cases or call n8n.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../../..');
const accountText=await readFile(resolve(root,'tmp/demo-auth/accounts.md'),'utf8');
const password=accountText.match(/^Shared demo password:\s*(.+)$/m)?.[1].trim();
const env=await readFile(resolve(root,'website/app/.env.local'),'utf8');
const value=name=>env.match(new RegExp(`^${name}=(.+)$`,'m'))?.[1].trim().replace(/^['"]|['"]$/g,'');
const url=value('VITE_SUPABASE_URL'),key=value('VITE_SUPABASE_PUBLISHABLE_KEY');
assert(password);assert.equal(new URL(url).hostname,'azeqdnbtzwaehewnyfdq.supabase.co');
const results=[];
for(const role of ['supervisor','agent','customer']){
 const login=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:`${role}@retention.example`,password}),signal:AbortSignal.timeout(20000)});
 assert.equal(login.status,200,`${role} login failed`);const session=await login.json();
 const rpc=async(name,args={})=>{const start=Date.now();const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});const data=await r.json();return {status:r.status,data,elapsed_ms:Date.now()-start}};
 try{
  const capacity=await rpc('retention_agent_capacity');
  if(role==='supervisor'){
   assert.equal(capacity.status,200,JSON.stringify(capacity.data));const s=capacity.data;
   assert.equal(s.agents.length,4);assert(s.agents.every(a=>a.active));
   const period=s.cases.map(c=>c.start).sort().at(-1),config={period,selectedIds:s.agents.map(a=>a.id),limits:s.limits,weights:s.weights,overrides:{}};
   const methods=[];
   for(const method of ['manual','round_robin','weighted']){
    const p=await rpc('retention_preview_assignment',{p_config:{...config,method}});assert.equal(p.status,200,JSON.stringify(p.data));
    assert.equal(p.data.proposals.length+p.data.remaining.length,p.data.eligible);
    assert(p.data.agents.every(a=>a.open<=s.limits.open||s.agents.find(original=>original.id===a.id).open>=a.open));
    methods.push({method,ready:p.data.proposals.length,remaining:p.data.remaining.length,elapsed_ms:p.elapsed_ms});
   }
   const invalid=await rpc('retention_preview_assignment',{p_config:{...config,method:'weighted',weights:{continuity:40,experience:30,load:31}}});assert.equal(invalid.status,400);
   results.push({role,capacity_status:capacity.status,agents:s.agents.length,cases:s.cases.length,capacity_elapsed_ms:capacity.elapsed_ms,methods,invalid_weights_status:invalid.status});
  }else{
   assert.equal(capacity.status,403);
   const attempts=[['retention_preview_assignment',{p_config:{}}],['retention_confirm_assignment',{p_request_key:'denied-check',p_preview:{}}],['retention_assignment_settings',{p_daily:20,p_open:40,p_weights:{continuity:40,experience:30,load:30}}]];
   const denied=[];for(const [name,args] of attempts){const r=await rpc(name,args);assert.equal(r.status,403,`${role}: ${name}`);denied.push(name)}
   results.push({role,capacity_status:capacity.status,denied});
  }
 }finally{await fetch(url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(10000)})}
}
const anon=await fetch(url+'/rest/v1/rpc/retention_agent_capacity',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
assert([401,403].includes(anon.status));results.push({role:'anonymous',status:anon.status});
await writeFile(resolve(root,'tmp/assignment-auth-checks.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
