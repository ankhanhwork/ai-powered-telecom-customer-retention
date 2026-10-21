import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardMetrics,rate,localDay,issueBreakdown} from '../src/dashboard.js';

const data={as_of:'2026-10-21T10:00:00Z',staff:[{id:'a',name:'Agent'}],cases:[
 {id:'old',owner:'a',start:'2026-09-01',end:'2026-10-01',stage:'closed',outcome:false},
 {id:'missing',owner:'a',start:'2026-09-01',end:'2026-10-01',stage:'closed',outcome:null},
 {id:'current',owner:null,start:'2026-10-11',end:'2026-11-11',stage:'new',outcome:null}
],events:[{case_id:'old',actor:'a',type:'sent',at:'2026-09-01T17:30:00Z'}],tasks:[
 {case_id:'current',owner:null,status:'pending',due_at:'2026-10-20T00:00:00Z'},
 {case_id:'old',owner:'a',status:'pending',due_at:'2026-09-02T00:00:00Z'}
],tickets:[]};
test('dashboard separates maturity, coverage, closed state and unknown outcomes',()=>{
 const m=dashboardMetrics(data);
 assert.equal(m.open.length,1);assert.equal(m.known.length,1);assert.equal(m.missing,1);assert.equal(m.awaiting,1);
 assert.equal(m.active.length+m.churned.length+m.missing+m.awaiting,m.cases.length);
 assert.equal(m.overdue.length,1);assert.equal(rate(0,0),null);
 const current=dashboardMetrics(data,{cohort:'2026-10-11'});
 assert.equal(current.known.length,0);assert.equal(current.awaiting,1);
});
test('activity dates use Vietnam time and do not change current workload',()=>{
 assert.equal(localDay('2026-09-01T17:30:00Z'),'2026-09-02');
 assert.equal(dashboardMetrics(data,{from:'2026-09-02',to:'2026-09-02'}).events.length,1);
 const m=dashboardMetrics(data,{from:'2026-10-01'});
 assert.equal(m.events.length,0);assert.equal(m.open.length,1);
 assert.equal(dashboardMetrics(data,{owner:'unassigned'}).cases.length,1);
});
test('outcome eligibility starts at the exclusive boundary in Vietnam',()=>{
 const justBefore={...data,as_of:'2026-09-30T16:59:59Z'};
 const boundary={...data,as_of:'2026-09-30T17:00:00Z'};
 assert.equal(dashboardMetrics(justBefore).eligible.length,0);
 assert.equal(dashboardMetrics(boundary).eligible.length,2);
});

test('primary issues count each contract once using its latest eligible window',()=>{
 const cases=[
  {id:'1',customer:'same',start:'2026-08-01',end:'2026-09-01',outcome:false,primary_issue:'Billing'},
  {id:'2',customer:'same',start:'2026-09-01',end:'2026-10-01',outcome:true,primary_issue:'Connection'},
  {id:'3',customer:'same',start:'2026-10-11',end:'2026-11-11',outcome:null,primary_issue:'Other'},
  {id:'4',customer:'second',start:'2026-09-01',end:'2026-10-01',outcome:null}
 ];
 const groups=issueBreakdown(cases,data.as_of);
 assert.equal(groups.reduce((n,g)=>n+g.cases.length,0),2);
 assert.equal(groups.find(g=>g.label==='Connection').churned.length,1);
 assert.equal(groups.find(g=>g.label==='Unclassified').known,0);
 assert(!groups.some(g=>g.label==='Billing'||g.label==='Other'));
 const current=issueBreakdown([cases[2]],data.as_of);
 assert.equal(current[0].cases.length,1);assert.equal(current[0].known,0);
});
