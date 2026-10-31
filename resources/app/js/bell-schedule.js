/* Local basic bell schedule generation; no persistence until the user saves. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongBellSchedule=api;})(globalThis,()=>{
 'use strict';
 const minutes=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
 const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 function generate({start,duration,count,lunchStart,lunchEnd}){
  const first=minutes(start),begin=minutes(lunchStart),end=minutes(lunchEnd);duration=Number(duration);count=Number(count);
  if(!Number.isFinite(first)||!Number.isFinite(begin)||!Number.isFinite(end))throw new Error('1교시 시작과 점심 시작·종료 시간을 입력하세요.');
  if(![40,45,50].includes(duration)||!Number.isInteger(count)||count<1||count>12)throw new Error('수업 시간은 40·45·50분, 총 교시는 1~12교시 중 선택하세요.');
  if(begin>=end)throw new Error('점심 종료는 시작보다 늦어야 합니다.');
  if(first<480||begin<480||end>1080)throw new Error('일과 시간은 08:00~18:00 안에서 설정하세요.');
  if(first+duration>begin)throw new Error('1교시는 점심 시작 전에 끝나도록 설정하세요.');
  const result=[];let cursor=first;
  for(let period=1;period<=count;period++){
   if(cursor<end&&cursor+duration>begin)cursor=end;
   if(cursor+duration>1080)throw new Error('마지막 교시가 18:00를 넘습니다. 시작 시간이나 교시 수를 조정하세요.');
   result.push({period,start:time(cursor),end:time(cursor+duration)});cursor+=duration+10;
  }
  result.push({period:4.5,start:lunchStart,end:lunchEnd});
  return result.sort((a,b)=>a.period-b.period);
 }
 return {generate};
});
