import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const workflow=JSON.parse(await readFile(new URL('../02_ai_message.json',import.meta.url),'utf8'));
const code=workflow.nodes.find(n=>n.name==='Validate AI output').parameters.jsCode;
function validate(type,out,{asText=false,status='completed'}={}){
 const response={output:asText?JSON.stringify(out):out};
 const run=new Function('$input','$',code);
 return run({first:()=>({json:response})},name=>({first:()=>({json:name==='Read care context'?{requested_output:type}:{id:'fixture-job'}})}))[0].json;
}
const message={action:'Verify needs',rationale:'Ask for current context.',message_body:'May we check your current needs?',call_script:null,missing_fields:[]};
test('accepts native structured output and raw JSON text with provenance',()=>{
 for(const asText of [false,true]){const p=validate('message',message,{asText});assert.equal(p.p_job_id,'fixture-job');assert.equal(p.p_generation_mode,'llm');assert.equal(p.p_model_version,'gpt-5.4-mini (configured)');assert.equal(p.p_offer_id,null);}
});
test('only message requests can create outbound drafts',()=>{
 assert.throws(()=>validate('call_script',message),/Call script/);
 assert.throws(()=>validate('explanation',message),/Explanation/);
 assert.equal(validate('call_script',{...message,message_body:null,call_script:'Ask two discovery questions.'}).p_message_body,null);
 assert.equal(validate('explanation',{...message,message_body:null}).p_call_script,null);
});
test('rejects malformed JSON, schema drift, empty text and excessive content',()=>{
 assert.throws(()=>validate('message','not JSON'),/JSON/);
 assert.throws(()=>validate('message',{...message,offer_id:'invented'}),/schema/);
 assert.throws(()=>validate('message',{...message,message_body:''}),/Invalid/);
 assert.throws(()=>validate('message',{...message,rationale:'x'.repeat(10001)}),/Invalid/);
 assert.throws(()=>validate('message',{...message,missing_fields:[42]}),/missing_fields/);
});
test('each output has an Agent, knowledge tool and JWT/RLS gate before worker context',async()=>{
 for(const type of ['message','call_script','explanation']){
  const w=JSON.parse(await readFile(new URL('../02_ai_'+type+'.json',import.meta.url),'utf8'));
  assert(w.nodes.some(n=>n.type==='@n8n/n8n-nodes-langchain.agent'));
  assert(w.nodes.some(n=>n.name==='Read_company_FAQ'&&n.type==='n8n-nodes-base.googleSheetsTool'));
  assert.equal(w.settings.saveDataSuccessExecution,'none');assert.equal(w.settings.saveDataErrorExecution,'none');
  assert.equal(w.connections['Request AI'].main[0][0].node,'Authorize requested job');
  assert.equal(w.connections['Authorize requested job'].main[0][0].node,'Selected request');
  assert.equal(w.connections['Selected request'].main[0][0].node,'Claim AI request');
  assert.equal(w.connections['Claim AI request'].main[0][0].node,'Read care context');
  assert.equal(w.nodes.find(n=>n.name==='Read_company_FAQ').parameters.filtersUI.values[0].lookupValue,'true');
  const auth=w.nodes.find(n=>n.name==='Authorize requested job');
  assert(auth.parameters.url.includes('status=eq.queued&id=eq.'));assert(auth.parameters.url.includes('encodeURIComponent'));
  assert(auth.parameters.headerParameters.parameters.some(p=>p.name==='Authorization'&&p.value.includes('$json.headers.authorization')));
  assert.equal(JSON.parse(w.nodes.find(n=>n.name==='Read pending requests').parameters.jsonBody).p_output,type);
  assert(w.nodes.find(n=>n.name==='Selected request').parameters.jsCode.includes('manual:'+type+':'));
 }
});
test('exports contain credential references and scoped worker RPCs, not secrets or approval calls',async()=>{
 for(const file of ['02_ai_message.json','02_ai_call_script.json','02_ai_explanation.json','04_mock_delivery.json','06_followups_support.json']){
  const raw=await readFile(new URL('../'+file,import.meta.url),'utf8'),w=JSON.parse(raw);
  assert(!raw.includes('sb_secret_'));assert(!/eyJ[A-Za-z0-9_-]{20,}/.test(raw));assert(!raw.includes('retention_review_message'));
  for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'&&n.name!=='Authorize requested job')){assert.equal(n.parameters.authentication,'predefinedCredentialType');assert.equal(n.credentials.supabaseApi.name,'Retention Supabase');assert(n.parameters.url.startsWith('https://azeqdnbtzwaehewnyfdq.supabase.co/rest/v1/rpc/'));}
 }
});
