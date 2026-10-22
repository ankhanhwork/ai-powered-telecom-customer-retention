import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeed} from '../src/notifications.js';

const rows=[{case_id:'c1',display_name:'Mai',assigned_agent_id:null,case_status:'new',target_period_start:'2026-10-11',created_at:'2026-10-11T01:00:00Z'},
 {case_id:'c2',display_name:'Bao',assigned_agent_id:'a1',case_owner:'Anh',case_status:'new',contact_result:'not_contacted',target_period_start:'2026-10-11',created_at:'2026-10-11T01:00:00Z'},
 {case_id:'c3',display_name:'Lam',assigned_agent_id:'a1',case_owner:'Anh',case_status:'waiting_customer',contact_result:'contacted',pending_drafts:1,target_period_start:'2026-10-11'}];
const text=i=>i.text.map(p=>typeof p==='string'?p:p.b).join('');
test('agent feed: stored notifications named by customer, own not-yet-cared and draft alerts',()=>{
 const f=buildFeed({role:'agent',userId:'a1',rows,notifications:[{id:'n1',type:'new_message',case_id:'c3',created_at:'2026-10-22T00:00:00Z'},{id:'n2',type:'case_assignment_batch',title:'You have 5 new cases',created_at:'2026-10-21T00:00:00Z',read_at:'x'}]});
 assert.ok(f.items.some(i=>text(i).startsWith('Lam sent a new message')));
 assert.ok(f.items.some(i=>i.id==='not-cared'&&text(i).includes('1 case still in New predictions')));
 assert.ok(f.items.some(i=>i.id==='drafts'));
 assert.equal(f.items.find(i=>i.id==='n2').tab,'updates');assert.equal(f.unread.updates,0);
 assert.ok(!f.items.some(i=>i.id==='unassigned'));
});
test('supervisor feed: unassigned, per-agent not cared and prediction batch alerts',()=>{
 const f=buildFeed({role:'supervisor',userId:'s1',rows,notifications:[{id:'n1',type:'new_message',case_id:'c1',created_at:'2026-10-22T00:00:00Z'}]});
 assert.ok(text(f.items.find(i=>i.id==='unassigned')).startsWith('1 at-risk customer is not assigned'));
 assert.ok(text(f.items.find(i=>i.id==='pending:Anh')).includes('Anh has 1 case'));
 assert.ok(text(f.items.find(i=>i.id==='batch:2026-10-11')).includes('October 2026: 3 customers'));
 assert.ok(text(f.items.find(i=>i.id==='n1')).includes('no owner yet'));
});
