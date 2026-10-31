'use strict';
const defaults=()=>Array.from({length:7},(_,i)=>({period:i+1,start:String(8+i).padStart(2,'0')+':00',end:String(8+i).padStart(2,'0')+':50'}));
function validate(periods){
 if(!Array.isArray(periods)||!periods.length||periods.length>13)throw new Error('일과표는 1~12개 교시를 입력하세요.');
 const result=periods.map(p=>({period:Number(p.period),start:p.start,end:p.end})).sort((a,b)=>a.period-b.period);
 const seen=new Set();let previous='08:00';
 for(const p of result){if((!Number.isInteger(p.period)&&p.period!==4.5)||p.period<1||p.period>12||seen.has(p.period)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end)||p.start<'08:00'||p.end>'18:00'||p.start>=p.end||(p.period!==4.5&&p.start<previous))throw new Error('교시는 중복 없이 시간순으로 입력하고, 08:00~18:00 범위에서 겹치지 않게 설정하세요.');seen.add(p.period);if(p.period!==4.5)previous=p.end;}
 const chronological=[...result].sort((a,b)=>a.start.localeCompare(b.start));
 for(let i=1;i<chronological.length;i++)if(chronological[i].start<chronological[i-1].end)throw new Error('점심시간과 수업 시간이 겹치지 않도록 설정하세요.');
 return result;
}
function announcement(date,periods,scope='temporary',customTitle='',restored=false){
 const title=customTitle||`${Number(date.slice(5,7))}월 ${Number(date.slice(8,10))}일 일과표${scope==='default'?' (기본 일과표)':''}`;
 const rows=[1,2,3,4,4.5,5,6,7].map(period=>{let slot=periods.find(p=>p.period===period);if(period===4.5&&!slot){const before=periods.find(p=>p.period===4),after=periods.find(p=>p.period===5);if(before&&after&&before.end<after.start)slot={start:before.end,end:after.start};}return [period===4.5?'점심시간':period+'교시',slot?slot.start+' ~ '+slot.end:'미설정'];});
 return {title,body:title+'\n적용 날짜: '+date+'\n'+(scope==='default'?'기본 일과 시간 안내입니다.':restored?'임시 일과표를 해제하고 기본 시간을 적용합니다.':'이 날짜에만 적용하며 다음 날에는 설정의 기본 일과 시간을 사용합니다.')+'\n'+rows.map(row=>row.join(' · ')).join('\n'),html:'<p>적용 날짜: '+date+'</p><p>'+(scope==='default'?'기본 일과 시간 안내입니다.':restored?'임시 일과표를 해제하고 기본 시간을 적용합니다.':'이 날짜에만 적용하며 다음 날에는 설정의 기본 일과 시간을 사용합니다.')+'</p><table><thead><tr><th>구분</th><th>시간</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+row[0]+'</td><td>'+row[1]+'</td></tr>').join('')+'</tbody></table>'};
}
module.exports={defaults,validate,announcement};
