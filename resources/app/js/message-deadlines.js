/* Pure local rules shared by the LAN server and the offline demo. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongDeadlines=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const pad=n=>String(n).padStart(2,'0');
 // Time ranges and class periods require a numeric time. Date-only deadlines require one of the deadline markers.
 const possibleTiming=/까지|마감|오전\s*중|\d\s*(?:시|교시|:\d{2})/;
 const deadlineAction=/제출|회신|마감|신청|등록|보고|송부|알려\s*주|보내\s*주|전달|답변|응답/;
 const legacyEventAction=/회의|연수|수업|상담|행사|협의회|출장|교육|설명회|간담회|면담|모임/;
 const legacyStartAction=/모여|모이|모입|모일|집합|참석|회의|연수|수업|상담|행사|협의회|출장|교육|설명회|간담회|면담|모임|만나|만납|뵙|뵐|뵈|봅시다|오세요|오십시오|와\s*주세요|와\s*주십시오/;
 const maintenanceAction=/소독|방역|청소|점검/;
 const ceremonyAction=/(?:개회|폐회|입학|졸업|시업|종업|개학|방학|퇴임|퇴직|취임|이임|시상|수료|수여|발대|해단|기념|추모|시무|종무|준공)식|축제|운동회|체육대회|학예회|발표회|공연|전시회/;
 const occurrenceAction=/(?:시작|진행|개최|실시|거행|개막|폐막)\s*(?:됩니다|될|되는|되고|되겠|합니다|할|하겠|해요|한다|하고)|열(?:립니다|릴|려|리는)/;
 function activityGeneration(clause,start=false){
  if((start?legacyStartAction:legacyEventAction).test(clause))return 0;
  if(maintenanceAction.test(clause))return 1;
  if(occurrenceAction.test(clause)||ceremonyAction.test(clause)&&!/자료|서류|문서|파일|사진|영상|안내문|계획서|일정표|결과/.test(clause))return 2;
  return -1;
 }
 const maintenanceCancelled=/취소|철회|연기|없(?:습니다|어요|음|다|을)|하지\s*않|진행하지|실시하지/;
 const key=d=>d.toISOString().slice(0,10);
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&key(new Date(s+'T00:00:00Z'))===s;
 const add=(s,n)=>key(new Date(Date.parse(s+'T00:00:00Z')+n*86400000));
 function sentDate(value){
  if(typeof value==='string'&&valid(value))return value;
  // Zone-less timestamps are ambiguous; never fall back to the query date.
  if(typeof value==='string'&&!/(Z|[+-]\d{2}:?\d{2})$/.test(value))return null;
  if(value===null||value===undefined||value==='')return null;
  const ms=new Date(value).getTime();return Number.isFinite(ms)?key(new Date(ms+9*3600000)):null;
 }
 function lunchTime(date,context={}){
  const periods=(context.bellSchedules||[]).find(s=>s.date===date)?.periods||(context.deadlineDefaultPeriodsChanged===false?undefined:context.defaultPeriods);
  return periods?.find(p=>Number(p.period)===4.5)?.start?.match(/^([01]\d|2[0-3]):[0-5]\d$/)?.[0]||periods?.find(p=>Number(p.period)===4)?.end?.match(/^([01]\d|2[0-3]):[0-5]\d$/)?.[0]||'12:05';
 }
 function resolveDate(clause,base){
  let date=base,m,hasDate=false;
   if((m=clause.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/))){date=`${m[1]||base.slice(0,4)}-${pad(m[2])}-${pad(m[3])}`;hasDate=true;}
   else if((m=clause.match(/(\d{4})-(\d{2})-(\d{2})/))){date=m[0];hasDate=true;}
   else if((m=clause.match(/(이번|다음)\s*주\s*([월화수목금토일])요일/))){const dow=new Date(base+'T00:00:00Z').getUTCDay();date=add(base,-((dow+6)%7)+(m[1]==='다음'?7:0)+'월화수목금토일'.indexOf(m[2]));hasDate=true;}
   else if((m=clause.match(/오늘|내일|모레/))){date=add(base,{오늘:0,내일:1,모레:2}[m[0]]);hasDate=true;}
   else if((m=clause.match(/(?:^|[^\d])(\d{1,2})\s*일/))){date=base.slice(0,8)+pad(m[1]);hasDate=true;}
   else if((m=clause.match(/([월화수목금토일])요일/))){const dow=(new Date(base+'T00:00:00Z').getUTCDay()+6)%7;date=add(base,('월화수목금토일'.indexOf(m[1])-dow+7)%7);hasDate=true;}
  return {date,hasDate};
 }
 function extract(text,sentAt,context={}){
  const base=sentDate(sentAt);if(!base||typeof text!=='string')return [];
  const result=[];
  // Sentence boundaries retain dotted numeric dates and HH:mm times.
  for(const clause of text.slice(0,100000).split(/\n+|[!?。]+|\.(?=\s|$)/)){
   if(!/까지|마감|오전\s*중/.test(clause)||extractEvents(clause,sentAt).length)continue;
   if(activityGeneration(clause)>=0&&!deadlineAction.test(clause)&&/(?:시|:\d{2}).*(?:에서|부터|[~～–—-]).*(?:시|:\d{2})/.test(clause))continue;
   if(/(?:마감|제출|등록|신청).{0,8}(?:취소|철회)|(?:제출|등록|신청)(?:하지\s*마|할\s*필요\s*없)/.test(clause))continue;
   if(/(?:알려|보내|전달|회신|제출).{0,5}(?:하지\s*마|지\s*마|필요\s*없|않아도)/.test(clause))continue;
   let m;const {date,hasDate}=resolveDate(clause,base);
   if(!valid(date))continue;
   let dueTime='',rule='date';
   // Explicit time must be associated with the deadline, not a meeting earlier in the sentence.
   m=clause.match(/(오전|오후)?\s*(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)\s*(?:전\s*)?(?:까지|마감)/);
   if(!m){const times=[...clause.matchAll(/(오전|오후)?\s*(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)/g)];if(times.length===1)m=times[0];}
   if(m){let hour=Number(m[2]),minute=Number(m[3]||m[4]||(m[5]?30:0));if(m[1]){if(hour<1||hour>12)continue;hour=hour%12+(m[1]==='오후'?12:0);}else if(!m[3]&&hour>=1&&hour<=7)hour+=12;if(hour>23||minute>59)continue;dueTime=pad(hour)+':'+pad(minute);rule='explicit';}
   else if(/오전\s*중|점심\s*시간\s*전\s*까지/.test(clause)){dueTime=lunchTime(date,context);rule='lunch';}
   else if(hasDate){dueTime='16:00';}
   else continue;
   result.push({date,dueTime,rule,title:clause.trim().slice(0,150),note:clause.trim().slice(0,1000)});
  }
  return result;
 }
 function extractEvents(text,sentAt){
  const base=sentDate(sentAt);if(!base||typeof text!=='string')return [];
  const result=[],added=[],announced=[];
  for(const clause of text.slice(0,100000).split(/\n+|[!?。]+|\.(?=\s|$)/)){
   const generation=activityGeneration(clause),legacy=generation===0;
   if(generation<0||(!legacy&&maintenanceCancelled.test(clause))||(deadlineAction.test(clause)||/취소|철회|없습니다|하지\s*마/.test(clause)))continue;
   const entries=generation===0?result:generation===1?added:announced;
   const {date,hasDate}=resolveDate(clause,base);if(!hasDate||!valid(date))continue;
   const times=[...clause.matchAll(/(오전|오후)?\s*(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)/g)];
   if(times.length!==2)continue;
   const between=clause.slice(times[0].index+times[0][0].length,times[1].index);if(!/에서|부터|[~～–—-]/.test(between))continue;
   let meridiem=times[0][1]||times[1][1];
   const convert=m=>{let h=Number(m[2]),min=Number(m[3]||m[4]||(m[5]?30:0));const zone=m[1]||meridiem;
    if(zone){if(h<1||h>12)return null;h=h%12+(zone==='오후'?12:0);}
    else if(!m[3]&&h>=1&&h<=7)h+=12; // School-day shorthand: 1–7시 means afternoon.
    return h<24&&min<60?pad(h)+':'+pad(min):null;};
   const start=convert(times[0]),end=convert(times[1]);if(!start||!end||start>=end)continue;
   entries.push({date,start,end,title:clause.trim().slice(0,150),note:clause.trim().slice(0,1000),type:'personal',place:'',targets:[],rule:'event'});
  }
  return [...result,...added,...announced];
 }
 function extractStartEvents(text,sentAt,context={}){
  const base=sentDate(sentAt);if(!base||typeof text!=='string')return [];
  const result=[],added=[],announced=[],seen=new Set();
  for(const clause of text.slice(0,100000).split(/\n+|[!?。]+|\.(?=\s|$)/)){
   const generation=activityGeneration(clause,true),legacy=generation===0;
   if(generation<0||(!legacy&&(deadlineAction.test(clause)||maintenanceCancelled.test(clause)))||/까지|제출|회신|마감|취소|철회|없습니다|하지\s*마|지\s*마|지\s*않|않[아습을]|못\s*(?:뵙|뵐|뵈|만나)|(?:뵙|뵐|뵈|만나)지\s*못/.test(clause))continue;
   const entries=generation===0?result:generation===1?added:announced;
   const {date}=resolveDate(clause,base);if(!valid(date))continue;
   const place=clause.match(/(?:\d+\s*층\s*)?(?:[가-힣A-Za-z0-9-]*(?:교실|회의실|교무실|도서관|강당|체육관)|\d+호(?:실)?|\d+\s*층)(?=으로|로|에서|에|\s|$)/)?.[0]||'';
   const times=[...clause.matchAll(/(오전|오후)?\s*(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)/g)];
   if(times.length===0){
    const mentions=[...clause.matchAll(/(?<!\d)(\d{1,2})\s*교시/g)];
    if(mentions.length!==1||/\d+\s*[~～–—-]\s*\d+\s*교시/.test(clause))continue;
    const period=Number(mentions[0][1]),periods=(context.bellSchedules||[]).find(s=>s.date===date)?.periods||context.defaultPeriods;
    const slot=periods?.find(p=>Number(p.period)===period),validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'');
    if(!slot||!validTime(slot.start)||!validTime(slot.end)||slot.start>=slot.end)continue;
    const title=clause.trim().slice(0,150),identity=JSON.stringify([date,slot.start,title]);if(seen.has(identity))continue;seen.add(identity);
    entries.push({date,start:slot.start,end:slot.end,period,title,note:clause.trim().slice(0,1000),type:'personal',place,targets:[],rule:'start-event'});
    continue;
   }
   if(times.length!==1)continue;
   const m=times[0];let h=Number(m[2]),min=Number(m[3]||m[4]||(m[5]?30:0));
   if(m[1]){if(h<1||h>12)continue;h=h%12+(m[1]==='오후'?12:0);}else if(!m[3]&&h>=1&&h<=7)h+=12;
   if(h>23||min>59)continue;const dueTime=pad(h)+':'+pad(min),title=clause.trim().slice(0,150),identity=JSON.stringify([date,dueTime,title]);if(seen.has(identity))continue;seen.add(identity);
   const endMinutes=h*60+min+60,entry={date,start:dueTime,end:pad(Math.floor(Math.min(endMinutes,1440)/60))+':'+pad(endMinutes>=1440?0:endMinutes%60),title,note:clause.trim().slice(0,1000),type:'personal',place,targets:[],rule:'start-event'};
   entries.push(entry);
   if(endMinutes>1440)entries.push({...entry,date:add(date,1),start:'00:00',end:'00:'+pad(endMinutes-1440)});
  }
  // Keep recognition generations in append-only groups so upgrades preserve calendar ledger identities.
  return [...result.filter(entry=>entry.period===undefined),...result.filter(entry=>entry.period!==undefined),...added.filter(entry=>entry.period===undefined),...added.filter(entry=>entry.period!==undefined),...announced.filter(entry=>entry.period===undefined),...announced.filter(entry=>entry.period!==undefined)];
 }
 const sourceKey=(kind,id,owner,index)=>JSON.stringify([kind,id,owner,index]);
 function withSourceTitle(entry,kind,payload){
  const title=kind==='mail'?String(payload?.title||'').trim():'';
  return title?{...entry,title:title.slice(0,150),titleFromMail:true}:entry;
 }
 function applyDemo(data,owner='me'){
  data.autoDeadlineSources ||= {};data.deadlines ||= [];data.events ||= [];
  const mails=new Map((data.mails||[]).map(mail=>[mail.id,mail]));
  for(const item of [...data.events,...data.deadlines])if(item.source?.kind==='mail'&&!item.titleFromMail)Object.assign(item,withSourceTitle(item,'mail',mails.get(item.source.id)));
  const sources=[];
  for(const room of data.rooms||[])for(const m of room.messages||[])if(possibleTiming.test(m.text))sources.push({kind:'message',id:m.id,text:m.text,at:m.createdAt??m.date});
  for(const m of data.mails||[])if(m.folder!=='trash'&&!m.workReminderOf&&!m.notice&&!m.calendarEvent&&!m.scheduleAnnouncement&&!m.scheduled&&possibleTiming.test((m.title||'')+'\n'+m.body))sources.push({kind:'mail',id:m.id,text:(m.title||'')+'\n'+m.body,at:m.createdAt??m.date,mail:m});
  for(const item of data.deadlines)if(item.rule==='lunch')item.dueTime=lunchTime(item.date,data);
  for(const s of sources)extractEvents(s.text,s.at).forEach((entry,i)=>{const k=sourceKey(s.kind+'-event',s.id,owner,i);if(data.autoDeadlineSources[k])return;const id='auto-'+encodeURIComponent(k);data.autoDeadlineSources[k]=id;data.events.push({id,...withSourceTitle(entry,s.kind,s.mail),source:{kind:s.kind,id:s.id}});data.deadlines=data.deadlines.filter(d=>!(d.source?.kind===s.kind&&d.source?.id===s.id&&d.note===entry.note));if(s.mail&&!s.mail.eventId)s.mail.eventId=id;});
  for(const s of sources)extractStartEvents(s.text,s.at,data).forEach((d,i)=>{const k=sourceKey(s.kind+'-start-event',s.id,owner,i);if(data.autoDeadlineSources[k])return;const id='auto-'+encodeURIComponent(k);data.autoDeadlineSources[k]=id;data.events.push({id,...withSourceTitle(d,s.kind,s.mail),source:{kind:s.kind,id:s.id}});if(s.mail&&!s.mail.eventId)s.mail.eventId=id;});
  for(const s of sources)extract(s.text,s.at,data).forEach((d,i)=>{const k=sourceKey(s.kind,s.id,owner,i);if(data.autoDeadlineSources[k])return;const id='auto-'+encodeURIComponent(k);data.autoDeadlineSources[k]=id;data.deadlines.push({id,...withSourceTitle(d,s.kind,s.mail),done:false,source:{kind:s.kind,id:s.id}});if(s.mail&&!s.mail.eventId)s.mail.eventId=id;});
 }
 return {extract,extractEvents,extractStartEvents,sentDate,lunchTime,sourceKey,withSourceTitle,applyDemo};
});
