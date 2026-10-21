import test from 'node:test';
import assert from 'node:assert/strict';
import {planAssignment,openCounts,summarize,weightsTotal,suggestedWeights,inPeriod} from '../src/assign.js';

const c=(id,p,extra={})=>({case_id:id,churn_probability:p,created_at:'2026-10-10T00:00:00Z',case_status:'new',assigned_agent_id:null,target_period_start:'2026-10-11',...extra});
const cases=[c('a',0.7),c('b',0.95),c('c',0.8),c('d',0.8,{created_at:'2026-10-09T00:00:00Z'})];

test('cases are assigned by churn risk first, then waiting time',()=>{
 const plan=planAssignment({cases,agents:['x'],strategy:'round_robin',weights:suggestedWeights,counts:{x:0}});
 assert.deepEqual(plan.items.map(i=>i.case.case_id),['b','d','c','a']);
});
test('round-robin rotates and continues from the previous run',()=>{
 const first=planAssignment({cases:cases.slice(0,3),agents:['x','y'],strategy:'round_robin',weights:suggestedWeights,counts:{x:0,y:0}});
 assert.deepEqual(first.items.map(i=>i.agent),['x','y','x']);
 const second=planAssignment({cases:cases.slice(3),agents:['x','y'],strategy:'round_robin',weights:suggestedWeights,counts:{x:2,y:1},start:first.next});
 assert.equal(second.items[0].agent,'y');
});
test('agents at the open-case limit are skipped and leftover cases stay unassigned',()=>{
 const plan=planAssignment({cases,agents:['x','y'],strategy:'round_robin',weights:suggestedWeights,counts:{x:40,y:39}});
 assert.equal(plan.items.length,1);assert.equal(plan.items[0].agent,'y');assert.equal(plan.unassigned.length,3);
});
test('weighted plan gives the next case to the agent with the lightest load',()=>{
 const plan=planAssignment({cases:cases.slice(0,2),agents:['x','y'],strategy:'weighted',weights:suggestedWeights,counts:{x:10,y:2}});
 assert.equal(plan.items[0].agent,'y');assert.equal(summarize(plan.items).y,2);
});
test('open counts ignore closed and unowned cases; weights must total 100',()=>{
 const counts=openCounts([c('1',1,{assigned_agent_id:'x'}),c('2',1,{assigned_agent_id:'x',case_status:'closed'}),c('3',1)],['x','y']);
 assert.deepEqual(counts,{x:1,y:0});
 assert.equal(weightsTotal(suggestedWeights),100);assert.notEqual(weightsTotal({continuity:50,skill:30,load:30}),100);
});
test('period filter matches month and year independently',()=>{
 const row=c('p',1);assert.equal(inPeriod(row,{year:'2026',mon:'10'}),true);assert.equal(inPeriod(row,{year:'2026',mon:'09'}),false);assert.equal(inPeriod(row,{year:'',mon:''}),true);
});
