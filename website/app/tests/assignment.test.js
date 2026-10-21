import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAssignment,availableSlots,suggestedWeights} from '../src/assignment.js';
const agents=[{id:'a',name:'A',open:0,today:0},{id:'b',name:'B',open:0,today:0}];
const cases=[0,1,2].map(i=>({id:String(i),risk:.9-i*.1,created_at:'2026-10-11',stage:'new',owner:null,group:'Connection quality'}));
const config={cases,agents,selectedIds:['a','b'],method:'round_robin',limits:{daily:20,open:40}};
test('round-robin respects risk, capacity and cursor without mutating inputs',()=>{
 const first=previewAssignment(config);assert.deepEqual(first.proposals.map(p=>p.agentId),['a','b','a']);
 assert.equal(previewAssignment({...config,cursor:first.cursor}).proposals[0].agentId,'b');assert.equal(agents[0].open,0);
 const capped=previewAssignment({...config,limits:{daily:1,open:40}});assert.equal(capped.proposals.length,2);assert.equal(capped.remaining.length,1);
 assert.equal(availableSlots({today:25,open:0},config.limits),0);
});
test('weighted matches the documented 62.5 vs 52.5 example',()=>{
 const result=previewAssignment({...config,cases:[{...cases[0],previousAgent:'a'}],method:'weighted',agents:[{...agents[0],open:30,experience:{'Connection quality':2}},{...agents[1],open:10,experience:{'Connection quality':4}}]});
 assert.equal(result.proposals[0].agentId,'a');assert.equal(result.proposals[0].score,62.5);
 assert.throws(()=>previewAssignment({...config,method:'weighted',weights:{...suggestedWeights,load:31}}),/total 100/);
 assert.throws(()=>previewAssignment({...config,method:'weighted',weights:{...suggestedWeights,load:NaN}}),/Weights/);
});
test('manual overrides still respect capacity and omitted cases stay unassigned',()=>{
 const result=previewAssignment({...config,method:'manual',limits:{daily:1,open:40},overrides:{0:'b',1:'b'}});
 assert.equal(result.proposals.length,1);assert.equal(result.remaining.length,2);assert.equal(result.proposals[0].agentId,'b');
});
test('closed, assigned, low-risk and overlapping active cases are excluded or flagged',()=>{
 const result=previewAssignment({...config,cases:[{...cases[0],owner:'a'},{...cases[1],stage:'closed'},{...cases[2],blocked:'Existing active case — review owner'},{...cases[0],id:'low',risk:.5}]});
 assert.equal(result.eligible,1);assert.equal(result.proposals.length,0);assert.match(result.remaining[0].reason,/Existing active/);
});
test('missing history has finite scores, ties are stable and active selection is enforced',()=>{
 const result=previewAssignment({...config,method:'weighted'});assert.equal(result.proposals[0].agentId,'a');assert(result.proposals.every(p=>Number.isFinite(p.score)));
 assert.throws(()=>previewAssignment({...config,agents:agents.map(a=>({...a,active:false}))}),/active agent/);
});
test('receiving the same case again today does not consume another daily slot',()=>{
 const result=previewAssignment({...config,cases:[{...cases[0],receivedToday:['a']}],agents:[{...agents[0],today:20}],selectedIds:['a']});
 assert.equal(result.proposals.length,1);assert.equal(result.agents[0].today,20);assert.equal(result.agents[0].open,1);
});
