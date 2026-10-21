import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyTicket,ticketPayload,ticketForm,clarificationInstructions,confirmationInstructions,ticketSourceChanged,ticketDepartments} from '../src/ticket.js';
test('manual draft supports unknown flags, incomplete routing and trims missing fields',()=>{
 const p=ticketPayload({...emptyTicket,missing_fields:[' Router lights ','',' Contact time ']});
 assert.equal(p.category,null);assert.equal(p.priority,null);assert.equal(p.repeat_issue,'unknown');assert.deepEqual(p.missing_fields,['Router lights','Contact time']);
 assert.equal(ticketForm({request_body:'Saved',repeat_issue:'yes',churn_concern:'explicit'}).description,'Saved');
 assert.equal(ticketDepartments.connection_issue,'Technical Support');assert.equal(ticketDepartments.cancellation,'Customer Retention');
});
test('clarification uses unresolved fields and forbids claiming submission',()=>{
 const instructions=clarificationInstructions(['Router light status']);assert.match(instructions,/Router light status/);assert.match(instructions,/Do not claim a ticket was submitted/);
});
test('ticket snapshot compares actual chat content, not number of messages',()=>{
 const source=[{id:'m',body:'First'}],r={source_job_id:'j',source_messages:source};
 assert.equal(ticketSourceChanged(r,source),false);assert.equal(ticketSourceChanged(r,[{id:'m',body:'Edited'}]),true);assert.equal(ticketSourceChanged(r,[...source,{id:'n',body:'Reply'}]),true);assert.equal(ticketSourceChanged({},source),false);
});
test('approved tab order, persistent ticket editor and safe submit button are wired',async()=>{
 const app=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert(app.indexOf("['info','Info']")<app.indexOf("['call','Call']"));assert(app.indexOf("['call','Call']")<app.indexOf("['ticket','Ticket']"));assert(app.indexOf("['ticket','Ticket']")<app.indexOf("['insights','Insights']"));
 assert(app.includes("hidden={tab!=='ticket'}"));assert(!app.includes('<h2>Refer to Technical Support</h2>'));
 const ui=await readFile(new URL('../src/SupportTicket.jsx',import.meta.url),'utf8');assert(ui.includes('p_expected_version:record.version'));assert(ui.includes('dirty||!form.category||!form.priority'));assert(ui.includes('form.missing_fields.filter'));
});
test('confirmation draft names the department and promises nothing',()=>{
 const text=confirmationInstructions('Technical Support');assert.match(text,/Technical Support/);assert.match(text,/Do not promise an appointment/);
});
