import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const w=JSON.parse(await readFile(new URL('../workflows/02_ai_ticket.json',import.meta.url),'utf8'));
const code=w.nodes.find(n=>n.name==='Validate ticket').parameters.jsCode;
const context={categories:{connection_issue:'Technical Support'},conversation:[{id:'m',direction:'inbound',body:'This happened last week too. I may cancel.'}]};
const output={description:'Repeated service issue.',category:'connection_issue',priority:'normal',repeat_issue:'yes',churn_concern:'explicit',preferred_contact_time:null,missing_fields:['Router lights'],evidence:[{field:'repeat_issue',message_id:'m',quote:'This happened last week too.'},{field:'churn_concern',message_id:'m',quote:'I may cancel.'}]};
const run=out=>new Function('$input','$',code)({first:()=>({json:{text:typeof out==='string'?out:JSON.stringify(out)}})},name=>({first:()=>({json:name==='Read ticket context'?context:{id:'job'}})}))[0].json;
test('ticket output preserves typed payload and configured model provenance',()=>{const r=run(output);assert.equal(r.p_job_id,'job');assert.equal(r.p_model_version,'gpt-5.4-mini (configured)');assert.deepEqual(r.p_ticket,output)});
test('ticket validator rejects invented evidence, unsupported classification and missing schema',()=>{
 assert.throws(()=>run({...output,category:'invented'}),/classification/);
 assert.throws(()=>run({...output,evidence:[{field:'repeat_issue',message_id:'m',quote:'Made up'}]}),/source customer/);
 assert.throws(()=>run({...output,evidence:[]}),/evidence required/);
 assert.throws(()=>run({...output,priority:'high'}),/priority evidence/);
 assert.throws(()=>run({...output,missing_fields:[42]}),/missing fields/);
 assert.throws(()=>run({...output,submit:true}),/schema/);assert.throws(()=>run('bad JSON'),/JSON/);
});
test('ticket workflow authorizes before claim, has no submit nodes, schedules or retained execution data',()=>{
 assert.equal(w.active,false);assert.equal(w.settings.saveDataSuccessExecution,'none');assert.equal(w.settings.saveDataErrorExecution,'none');
 assert(!w.nodes.some(n=>n.type.includes('scheduleTrigger')));
 assert.equal(w.connections['Request ticket'].main[0][0].node,'Authorize requested job');assert.equal(w.connections['Selected ticket'].main[0][0].node,'Claim ticket job');
 assert(w.nodes.filter(n=>n.credentials?.supabaseApi).every(n=>n.credentials.supabaseApi.name==='Supabase account'));
 assert(!JSON.stringify(w.nodes).includes('/retention_submit_ticket'));
});
