import {stages,careStage} from './data.js';
// Care stages match the Agent queue: closed cases split into Care completed / Failed by contact result.
export const careNames=Object.fromEntries(stages.map(s=>[s.id,s.title]));
export const careColors={intake:'var(--primary)',outreach:'var(--link)',resolution:'#8a80bf',care_completed:'var(--success)',failed:'var(--warn)'};
export const localDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const rate=(n,d)=>d?`${(100*n/d).toFixed(1)}%`:null;
export function issueBreakdown(cases,asOf){
 const mature=cases.filter(c=>new Date(c.end+'T00:00:00+07:00')<=new Date(asOf));
 const latest=new Map();
 for(const c of mature.length?mature:cases){const key=c.customer||c.id;if(!latest.has(key)||latest.get(key).start<c.start)latest.set(key,c)}
 const groups=new Map();
 for(const c of latest.values()){
  const issue=c.primary_issue||'Unclassified';
  if(!groups.has(issue))groups.set(issue,{label:issue,cases:[],known:0,churned:[]});
  const group=groups.get(issue);group.cases.push(c);
  if(new Date(c.end+'T00:00:00+07:00')<=new Date(asOf)&&typeof c.outcome==='boolean'){group.known++;if(c.outcome)group.churned.push(c)}
 }
 return [...groups.values()].sort((a,b)=>b.cases.length-a.cases.length||a.label.localeCompare(b.label));
}
export function dashboardMetrics(data,{cohort='',owner='',from='',to=''}={}){
 const cases=data.cases.map(c=>({...c,care:careStage(c.stage,c.contact)})).filter(c=>(!cohort||c.start===cohort)&&(!owner||(owner==='unassigned'?!c.owner:c.owner===owner)));
 const ids=new Set(cases.map(c=>c.id)),open=cases.filter(c=>c.stage!=='closed');
 const events=data.events.filter(e=>ids.has(e.case_id)&&(!from||localDay(e.at)>=from)&&(!to||localDay(e.at)<=to));
 const eligible=cases.filter(c=>new Date(c.end+'T00:00:00+07:00')<=new Date(data.as_of));
 const known=eligible.filter(c=>typeof c.outcome==='boolean'),active=known.filter(c=>!c.outcome),churned=known.filter(c=>c.outcome);
 // Assigned in the activity dates (latest assignment, else case creation); not yet cared = still in New predictions.
 const inRange=at=>at?(!from||localDay(at)>=from)&&(!to||localDay(at)<=to):!from&&!to;
 const assigned=cases.filter(c=>c.owner&&inRange(c.assigned_at||c.created_at)),notCared=assigned.filter(c=>c.care==='intake');
 const tickets=data.tickets.filter(t=>ids.has(t.case_id)&&(!from||localDay(t.at)>=from)&&(!to||localDay(t.at)<=to));
 const days=new Map();
 for(const event of events){const day=localDay(event.at);if(!days.has(day))days.set(day,{day,sent:new Set(),reply:new Set(),closed:new Set()});if(['sent','reply','closed'].includes(event.type))days.get(day)[event.type].add(event.case_id)}
 const trend=[...days.values()].sort((a,b)=>a.day.localeCompare(b.day)).map(d=>({day:d.day,sent:d.sent.size,reply:d.reply.size,closed:d.closed.size}));
 // Team workload lists Agents only; supervisors keep their name for case owners elsewhere.
 const team=data.staff.filter(s=>s.role!=='supervisor').map(s=>({
  ...s,open:open.filter(c=>c.owner===s.id).length,
  assigned:assigned.filter(c=>c.owner===s.id).length,notCared:notCared.filter(c=>c.owner===s.id).length,
  sent:events.filter(e=>e.type==='sent'&&e.actor===s.id).length,
  worked:new Set(events.filter(e=>['sent','closed','call_answered','call_no_answer'].includes(e.type)&&e.actor===s.id).map(e=>e.case_id)).size,
  tickets:tickets.filter(t=>t.actor===s.id&&t.status!=='draft').length
 })).sort((a,b)=>b.notCared-a.notCared||b.open-a.open);
 const attention=open.map(c=>({...c,reasons:[!c.owner?'Unassigned':null,notCared.includes(c)?'Not yet cared':null,data.tickets.some(t=>t.case_id===c.id&&['queued','failed'].includes(t.status))?'Support request not handed off':null,...(events.some(e=>e.case_id===c.id&&e.type==='delivery_failed')?['Message not delivered']:[])].filter(Boolean)})).filter(c=>c.reasons.length);
 return {cases,open,events,tickets,eligible,known,active,churned,assigned,notCared,trend,team,attention,
  unknown:cases.length-known.length,awaiting:cases.length-eligible.length,missing:eligible.length-known.length,
  unassigned:open.filter(c=>!c.owner),stages:stages.map(s=>({stage:s.id,label:s.title,color:careColors[s.id],value:cases.filter(c=>c.care===s.id).length}))};
}
