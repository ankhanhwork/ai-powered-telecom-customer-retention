import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
const body=source.slice(source.indexOf(' async function requestAI('),source.indexOf('\n async function save()')).replaceAll('import.meta.env.PROD','true').replaceAll('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY',"'public-test-key'");
function requestWith(fetch,load){
 return new Function('rpc','supabase','fetch','load','id','key','pendingAI','outbound',body+';return requestAI;')(
  async()=> 'existing-job',{auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})}},fetch,load,'case',()=> 'key',{current:null},[]);
}
test('webhook starts even when the subsequent screen refresh fails',async()=>{
 let calls=0;
 const request=requestWith(async(url,options)=>{calls++;assert.equal(url,'/api/retention-ai-explanation');assert.deepEqual(JSON.parse(options.body),{job_id:'existing-job'});assert.equal(options.headers.Authorization,'Bearer test-token');return {ok:true,json:async()=>({message:'Workflow was started'})}},async()=>{throw Error('Refresh unavailable')});
 await assert.rejects(()=>request('explanation'),/Refresh unavailable/);assert.equal(calls,1);
});
test('AI request rejects a successful HTML route instead of silently waiting forever',async()=>{
 let loads=0;
 const request=requestWith(async()=>({ok:true,json:async()=>{throw SyntaxError('HTML response')}}),async()=>{loads++});
 await assert.rejects(()=>request('message'),/Use Retry if the request stalls/);assert.equal(loads,0);
});
test('an acknowledged AI request returns the coalesced job for progress tracking',async()=>{
 const request=requestWith(async()=>({ok:true,json:async()=>({message:'Workflow was started'})}),async()=>{});
 assert.equal(await request('call_script'),'existing-job');
});
