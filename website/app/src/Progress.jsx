import React from 'react';
export default function Progress({detail}){
 const c=detail.case,o=detail.outcomes.find(o=>o.window_start===c.target_period_start);
 return <section className="outcome-panel"><p>Outcome: <strong>{o?.churned===true?'Churned':o?.churned===false?'Continued service':'Unknown'}</strong></p><p className="muted">Updated automatically by the system once the target period ends. Care completion or a customer reply does not change it.</p></section>
}
