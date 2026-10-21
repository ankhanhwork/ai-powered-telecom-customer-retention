import React from 'react';
import {monthNames} from './data';

export default function PeriodFilter({rows,sel,setSel}){
 const years=[...new Set(rows.map(r=>r.target_period_start.slice(0,4)))].sort().reverse();
 return <>
  <select aria-label="Filter by month" value={sel?.mon??''} onChange={e=>setSel(v=>({...v,mon:e.target.value}))}><option value="">All months</option>{monthNames.map((n,i)=><option key={n} value={String(i+1).padStart(2,'0')}>{n}</option>)}</select>
  <select aria-label="Filter by year" value={sel?.year??''} onChange={e=>setSel(v=>({...v,year:e.target.value}))}><option value="">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
 </>;
}
