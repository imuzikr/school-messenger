/* A recipient-scoped chronological view of explicitly categorized messages. */
(function(root){
 'use strict';
 const stamp=m=>Number.isFinite(m.createdAt)?m.createdAt:Date.parse(`${m.date}T${m.time||'00:00'}:00+09:00`)||0;
 function entries(mails,viewer,now=Date.now()){
  const ids=Array.isArray(viewer)?viewer:[viewer],seen=new Set();
  return (mails||[]).filter(m=>{
   if(!m||m.category!=='homeroom'||m.folder==='trash'||m.homeroomHidden||seen.has(m.id)||m.scheduled&&(!Number.isFinite(Date.parse(m.scheduled))||Date.parse(m.scheduled)>now))return false;
   const index=(m.to||[]).findIndex(id=>ids.includes(id));if(index<0||['recalled','scheduled'].includes(m.receipts?.[index]))return false;
   seen.add(m.id);return true;
  }).sort((a,b)=>stamp(a)-stamp(b)||String(a.id).localeCompare(String(b.id)));
 }
 function validDay(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
 function nextDay(date){if(!validDay(date))throw Error('날짜가 올바르지 않습니다.');const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
 function receivedDate(mail){
  if(mail.scheduled&&Number.isFinite(Date.parse(mail.scheduled))){const d=new Date(Date.parse(mail.scheduled)+9*3600000);return d.toISOString().slice(0,10);}
  if(validDay(mail.date))return mail.date;
  const time=stamp(mail);return Number.isFinite(time)?new Date(time+9*3600000).toISOString().slice(0,10):'';
 }
 function onDay(mail,date){
  if(!validDay(date))return false;
  const copy=(mail.homeroomDays||[]).find(d=>d.date===date);
  if(date===receivedDate(mail))return !mail.homeroomHidden&&!copy?.hidden;
  return !!copy&&!copy.hidden;
 }
 function dailyEntries(mails,viewer,date,now=Date.now()){
  const originals=new Map((mails||[]).filter(Boolean).map(m=>[m.id,m]));
  return entries((mails||[]).map(m=>m?{...m,homeroomHidden:false}:m),viewer,now).map(m=>originals.get(m.id)).filter(m=>onDay(m,date)).map(m=>({...m,homeroomDate:date,homeroomCarriedFrom:(m.homeroomDays||[]).find(d=>d.date===date)?.carriedFrom||''}));
 }
 function carry(mail,date){
  if(!onDay(mail,date))throw Error('이 날짜에 받은 담임 업무가 없습니다.');const target=nextDay(date);
  if(!(mail.homeroomDays||[]).some(d=>d.date===target))mail.homeroomDays=[...(mail.homeroomDays||[]),{date:target,hidden:false,carriedFrom:date}];return target;
 }
 function dismissDay(mail,date){if(!onDay(mail,date))throw Error('이 날짜에 받은 담임 업무가 없습니다.');const copy=(mail.homeroomDays||[]).find(d=>d.date===date);if(copy)copy.hidden=true;else mail.homeroomDays=[...(mail.homeroomDays||[]),{date,hidden:true,carriedFrom:''}];}
 function preview(mail){
  const text=String(mail.body||'').replace(/\r\n?/g,'\n').trim(),line=text.split('\n').find(line=>line.trim())?.trim()||'';
  let body=line;
  for(let i=0;i<line.length;i++){
   if(!/[.!?。！？]/.test(line[i]))continue;
   if(line[i]==='.'){
    const before=line.slice(0,i+1),after=line.slice(i+1);
    if(/\d$/.test(line.slice(0,i))&&/^\s*\d/.test(after)||/\d{1,4}\.\s*\d{1,2}(?:\.\s*\d{1,2})?\.$/.test(before)||/[A-Za-z]$/.test(line.slice(0,i))&&/^[A-Za-z]/.test(after))continue;
   }
   let end=i+1;while(end<line.length&&/[.!?。！？"'”’」』)\]]/.test(line[end]))end++;body=line.slice(0,end);break;
  }
  const supplied=String(mail.title||'').trim(),hasTitle=mail.titleProvided===true||mail.titleProvided!==false&&supplied!=='담임';
  const chars=Array.from(text.replace(/\s+/g,' ')),fallback=chars.slice(0,30).join('')+(chars.length>30?'…':'');
  return {title:hasTitle&&supplied?supplied:fallback||'제목 없음',body};
 }
 function pinnedItem(mail,date){
  return {title:String(mail.title||'담임').slice(0,150),titleFromMail:true,date,dueTime:'',note:String(mail.body||'').slice(0,1000),done:false,homeroomMail:mail.id,source:{kind:'mail',id:mail.id}};
 }
 function seedDemo(data,date){
  if(data.homeroomSamplesDate===date)return;
  if(data.mails.some(m=>m.demoHomeroom&&m.date===date)){data.homeroomSamplesDate=date;data.homeroomSamplesVersion=2;return;}
  const tomorrow=new Date(date+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const next=`${tomorrow.getUTCFullYear()}년 ${tomorrow.getUTCMonth()+1}월 ${tomorrow.getUTCDate()}일`;
  const samples=[['생활기록부 확인','학급별 생활기록부의 누락된 항목을 확인해 주세요. 확인 후 담당자에게 회신해 주세요.'],['학부모 상담 일정',next+' 오후 2시부터 오후 3시까지 학부모 상담을 진행합니다. 상담 자료를 준비해 주세요.'],['학급 현황 제출',next+' 오후 4시까지 학급 현황 자료를 제출해 주세요.'],['학급 전달 사항','학생들에게 안내문을 전달한 뒤 확인 여부를 기록해 주세요. 메모하기에 회신할 내용을 남겨 보세요.']];
  const people=(data.people||[]).filter(p=>p.id!=='me');
  samples.forEach(([title,body],i)=>{const id='demo-homeroom-'+date+'-'+(i+1);if(data.mails.some(m=>m.id===id))return;data.mails.push({id,from:people[i%Math.max(1,people.length)]?.id||'me',to:['me'],cc:[],title:'[샘플] '+title,body,category:'homeroom',folder:'inbox',files:[],date,time:`09:${String(i*10).padStart(2,'0')}`,createdAt:Date.parse(date+`T09:${String(i*10).padStart(2,'0')}:00+09:00`),receipts:['read'],unread:false,important:false,demoHomeroom:true});});
  data.homeroomSamplesVersion=2;data.homeroomSamplesDate=date;
 }
 const api={entries,stamp,pinnedItem,seedDemo,preview,validDay,nextDay,receivedDate,onDay,dailyEntries,carry,dismissDay};if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongHomeroom=api;
})(typeof window==='object'?window:globalThis);
