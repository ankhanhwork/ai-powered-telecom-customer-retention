// Read-only authenticated checks; credentials stay in memory and are never logged.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../../..');
const accountText=await readFile(resolve(root,'tmp/demo-auth/accounts.md'),'utf8');
const password=accountText.match(/^Shared demo password:\s*(.+)$/m)?.[1].trim();
assert(password,'Local provisioned credentials are unavailable');
const env=await readFile(resolve(root,'website/app/.env.local'),'utf8');
const value=name=>env.match(new RegExp(`^${name}=(.+)$`,'m'))?.[1].trim().replace(/^['"]|['"]$/g,'');
const url=value('VITE_SUPABASE_URL'),key=value('VITE_SUPABASE_PUBLISHABLE_KEY');
assert.equal(new URL(url).hostname,'azeqdnbtzwaehewnyfdq.supabase.co');
const results=[];
for(const role of ['supervisor','agent','customer']){
 const login=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',
  headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:`${role}@retention.example`,password}),signal:AbortSignal.timeout(20000)});
 assert.equal(login.status,200,`${role} login failed`);
 const session=await login.json();
 const start=Date.now();
 const r=await fetch(url+'/rest/v1/rpc/retention_supervisor_dashboard',{method:'POST',
  headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
 if(role==='supervisor'){
  assert.equal(r.status,200,'Supervisor RPC failed');const d=await r.json();
  assert.equal(d.cases.length,507);assert.equal(d.staff.length,5);
  assert.equal(d.cases.filter(c=>c.outcome===true).length,22);
  assert.equal(d.cases.filter(c=>c.outcome===false).length,250);
  assert(d.cases.filter(c=>c.start==='2026-10-11').every(c=>c.outcome===null));
  const detail=await fetch(url+'/rest/v1/rpc/retention_case_detail',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({p_case_id:d.cases.find(c=>c.start==='2026-09-01').id}),signal:AbortSignal.timeout(20000)});
  assert.equal(detail.status,200,'Historical drill-down failed');
  results.push({role,status:r.status,cases:d.cases.length,staff:d.staff.length,elapsed_ms:Date.now()-start,historical_detail:detail.status});
 }else{assert.equal(r.status,403,`${role} unexpectedly read Supervisor dashboard`);results.push({role,status:r.status})}
 // End only this test's session; keep the user's other sessions intact.
 await fetch(url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(10000)});
}
const anon=await fetch(url+'/rest/v1/rpc/retention_supervisor_dashboard',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
assert([401,403].includes(anon.status));results.push({role:'anonymous',status:anon.status});
await writeFile(resolve(root,'tmp/dashboard-cloud/auth-checks.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
