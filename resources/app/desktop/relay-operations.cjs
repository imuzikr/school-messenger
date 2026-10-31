'use strict';
const {randomUUID,randomBytes}=require('node:crypto');
const crypto=require('../privacy/crypto.cjs');
const workTools=require('../js/work-tools.js'),announcements=require('../js/announcements.js'),homeroom=require('../js/homeroom.js'),bell=require('../server/schedule.cjs');
const clone=v=>JSON.parse(JSON.stringify(v)),unique=a=>[...new Set(a)];
const date=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}),time=()=>new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'});
const check=(condition,message)=>{if(!condition)throw new Error(message);};
async function prepare(c,operations){
  const data=c.snapshot.data,keys=await c.keys(),me=c.user.id,store=c.store,sharedEvents=new Map(operations.filter(o=>o.type==='event.upsert').map(o=>[o.value.id,o.value])),outgoing=[];
  // Network reads above, no network writes below. Failed validation or a disk
  // failure rolls back all content, metadata and queued delivery as one action.
  const canceledUploads=[],schedulePackets=[];
  let publicJob;
  await store.transactionAsync(async()=>{
    for(const input of operations){const op=clone(input),v=op.value||{},id=op.id||v.id;
      if(op.type==='room.create'){
        const members=unique([me,...(v.members||[])]);check(typeof id==='string'&&id.length<=100&&typeof v.name==='string'&&v.name.length<=150&&members.length<=201,'대화방 정보를 확인해 주세요.');for(const target of members)await c.trusted(target,keys);
        if(!store.get('room-history',id)){c.saveRoom({id,name:v.name,notice:v.notice||'',members:members.filter(id=>id!==me),messages:[],unread:0,pinned:!!v.pinned,muted:!!v.muted,creator:me});c.stage({type:'room.create',value:{id,name:v.name,members}},members);}continue;
      }
      if(op.type==='message.send'){
        const room=store.get('room-history',op.room);check(room&&!room.left,'대화방을 찾을 수 없습니다.');check(c.restoringLegacy||!store.get('content','message:'+id),'메시지 식별자가 중복되었습니다.');const fields=c.privateFields('message',v);check(fields.text.trim(),'대화 내용을 입력해 주세요.');const members=unique([me,...room.members]);for(const target of members)await c.trusted(target,keys);
        const value={id,...fields,createdAt:Date.now(),date:date(),time:time()};store.put('content','message:'+id,fields);room.messages.push({...value,sender:'me',pendingDelivery:true,likes:0,liked:false,likesBy:[]});room.unread=0;c.saveRoom(room);c.stage({type:'chat.message',value,room:{id:room.id,name:room.name,members}},members);continue;
      }
      if(op.type==='mail.send'){
        check(typeof id==='string'&&id.length<=100&&(c.restoringLegacy||!store.get('content','mail:'+id)),'메시지 식별자가 중복되었거나 올바르지 않습니다.');
        if(v.scheduleAnnouncement){check(c.user.admin||data.dutySettings.managers.timetable?.includes(me),'일과표 담당자만 전체 안내를 보낼 수 있습니다.');const p=operations.find(o=>o.type==='schedule.upsert'&&(o.value.date||'')===(v.scheduleAnnouncement.scope==='default'?'':v.scheduleAnnouncement.date))?.value?.periods||data.bellSchedules.find(s=>s.date===v.scheduleAnnouncement.date)?.periods||data.defaultPeriods;Object.assign(v,bell.announcement(v.scheduleAnnouncement.date,p,v.scheduleAnnouncement.scope,v.title||'',!!v.scheduleAnnouncement.restored));v.to=data.people.filter(p=>p.id!==me).map(p=>p.id);}
        if(v.announcement){check(['teachers','staff'].includes(v.announcement.audience)&&data.departments.includes(v.announcement.department),'공지 대상과 부서를 확인해 주세요.');v.to=announcements.recipients(data.people,v.announcement.audience);v.cc=[];}
        if(v.notice){check(['makeup','lessonChange'].includes(v.notice.kind)&&Array.isArray(v.notice.rows)&&v.notice.rows.length>0&&v.notice.rows.length<=7&&!v.scheduled,'수업 안내 정보를 확인해 주세요.');const seen=new Set();for(const row of v.notice.rows){const period=Number(row.period);check(Number.isInteger(period)&&period>=1&&period<=7&&!seen.has(period),'교시를 중복 없이 지정하세요.');seen.add(period);if(v.notice.kind==='lessonChange')check(row.originalTeacher&&row.originalTeacher!==row.teacher,'기존 교사와 교체 교사는 달라야 합니다.');if(v.notice.kind==='makeup'&&row.className){const mapping=data.classTeachers.find(c=>c.className.replace(/\s+/g,'')===row.className.replace(/\s+/g,''));check(mapping,'해당 반의 담임이 등록되어 있지 않습니다.');row.homeroomTeacher=mapping.teacher;}}}
        let to=unique([...(v.to||[]),...(v.cc||[]),...(v.notice?.rows||[]).flatMap(r=>[r.teacher,r.originalTeacher,r.homeroomTeacher].filter(Boolean))]);
        if(v.workReminderOf){const original=store.get('mail-history',v.workReminderOf);check(original?.from==='me'&&original.workRequest,'본인이 보낸 요청만 재안내할 수 있습니다.');check(to.every(id=>original.workRequest.targets.includes(id)),'원 요청 대상자에게만 재안내할 수 있습니다.');to=to.filter(id=>!original.workResponses?.[id]?.done&&original.workDelivery?.[id]!=='recalled');}
        check(to.length>0&&to.length<=200,'수신자를 선택해 주세요.');for(const target of unique([me,...to]))await c.trusted(target,keys);
        const fields=c.privateFields('mail',v);check(fields.body.trim(),'메시지 본문을 입력해 주세요.');let files=clone(v.files||[]);
        if(files.some(f=>f.localFile))check(c.snapshot.privacy.fileTransferVersion===1,'첨부 파일 전송을 위해 서버도 최신 버전으로 업데이트해 주세요.');
        fields.html=fields.html.replace(/data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}/g,image=>{const index=files.length;files.push({name:'본문 이미지 '+(index+1),data:image,inline:true});return 'ieum-inline:'+index;});check(files.length<=20&&fields.html.length<=400000,'첨부 또는 본문 서식 크기 제한을 초과했습니다.');let bytes=0;const uploads=[];
        const releaseAt=v.scheduled?Date.parse(v.scheduled):0;check(!v.scheduled||Number.isFinite(releaseAt)&&releaseAt>Date.now(),'예약 발송 시간은 현재 이후여야 합니다.');
        files=files.map((f,index)=>{
          check(typeof f.name==='string'&&f.name.length<=180,'첨부 파일 이름을 확인해 주세요.');
          const relayFile={id:randomUUID(),secret:randomBytes(32).toString('hex')};let count,sha256,blob=false;
          if(f.localFile){const local=c.files.get(f.localFile);count=local.bytes;sha256=local.sha256;blob=true;uploads.push({...relayFile,blob:local});f={...local,name:f.name};}
          else{check(typeof f.data==='string'&&/^data:[a-zA-Z0-9.+\/-]+;base64,[A-Za-z0-9+/=]*$/.test(f.data),'첨부 파일 정보를 확인해 주세요.');const buffer=Buffer.from(f.data.split(',')[1],'base64');count=buffer.length;check(count<=2*1024*1024,'큰 파일은 파일 첨부 버튼으로 다시 선택해 주세요.');sha256=crypto.digest(buffer);uploads.push({...relayFile,data:f.data});}
          bytes+=count;check(count<=500*1024*1024&&bytes<=2*1024*1024*1024,'파일당 500 MB, 메시지당 합계 2 GB 이하로 첨부해 주세요.');store.put('file',id+':'+index,f);
          return {name:f.name,size:f.size||Math.ceil(count/1024)+' KB',bytes:count,index,inline:!!f.inline,blob,stored:true,sourceMail:id,sha256,relayFile,expiresAt:releaseAt?null:Date.now()+10*86400000};
        });
        fields.attachments=files.map(f=>({index:f.index,name:f.name,sha256:f.sha256}));const calendar=sharedEvents.get(v.calendarEvent)||store.get('local-events',v.calendarEvent||'')||data.events.find(e=>e.id===v.calendarEvent);if(v.calendarEvent){check(calendar,'연결할 일정을 찾을 수 없습니다.');fields.calendarDetails={...calendar,targets:to,owner:me};}
        const value={id,...fields,to,cc:(v.cc||[]).filter(id=>to.includes(id)),files,createdAt:Date.now(),date:date(),time:time(),scheduled:v.scheduled||'',important:!!v.important,...Object.fromEntries(['category','titleProvided','notice','announcement','calendarEvent','scheduleAnnouncement','workReminderOf'].filter(k=>v[k]!==undefined).map(k=>[k,v[k]]))};if(v.workRequest)value.workRequest=workTools.request(v.workRequest,to,value.cc,me);
        const packet=c.stage({type:'mail.create',value},to,{releaseAt,files:uploads,pending:id});
        if(v.scheduleAnnouncement)schedulePackets.push(packet);
        store.put('content','mail:'+id,fields);const mail={...value,from:'me',folder:'sent',previousFolder:'sent',unread:false,canRecall:true,receipts:to.map(()=> 'unread'),storedReceipts:{[me]:Date.now()},workDelivery:Object.fromEntries(to.map(id=>[id,'unread'])),workResponses:{},homeroomDays:[],pendingDelivery:true,relayPacket:packet};c.saveMail(mail);c.mailEvents(mail);continue;
      }
      const mail=store.get('mail-history',id||v.mail||'');
      if(op.type==='mail.retry'){c.retryMail(id);continue;}
      if(op.type==='mail.update'){
        check(mail,'메시지를 찾을 수 없습니다.');
        if(op.recall&&!mail.recallRequested){
          check(mail.from==='me','보낸 사람만 회수할 수 있습니다.');
          const queued=mail.relayPacket&&store.get('relay-outbox',mail.relayPacket);
          if(queued){
            store.remove('relay-outbox',mail.relayPacket);
            canceledUploads.push(...queued.files.map(file=>file.id));
          }
          mail.pendingDelivery=false;
          mail.recallRequested=true;
          if(queued&&!queued.wire){
            // The original envelope was never prepared or sent to the server.
            mail.receipts=mail.to.map(()=>'recalled');
            mail.workDelivery=Object.fromEntries(mail.to.map(target=>[target,'recalled']));
          }else{
            if(mail.relayPacket)store.put('relay-cancel',mail.relayPacket,{id:mail.relayPacket});
            else store.put('relay-cancel','legacy:'+id,{legacyMail:id});
            c.stage({type:'mail.recall',mail:id,at:Date.now()},mail.to);
          }
        }
        if(op.folder){check((mail.from==='me'?['sent','trash']:['inbox','trash']).includes(op.folder),'메시지 폴더가 올바르지 않습니다.');mail.folder=op.folder;}if(typeof op.important==='boolean')mail.important=op.important;if(op.eventId)mail.eventId=op.eventId;if(op.read&&mail.unread){mail.unread=false;c.response('receipt.read',id,mail.from);}c.saveMail(mail);continue;
      }
      if(op.type==='mail.work.respond'){
        check(mail&&mail.from!=='me'&&mail.folder!=='trash'&&!store.get('recalled',id)&&mail.workRequest?.targets.includes(me),'본인이 받은 완료 요청만 처리할 수 있습니다.');check(typeof v.done==='boolean'&&typeof v.note==='string'&&v.note.length<=500,'응답 내용을 확인해 주세요.');for(const r of store.all('relay-failed'))if(r.value.action?.type==='work.response'&&r.value.action.mail===id)store.remove('relay-failed',r.id);for(const r of store.all('restore-review'))if(r.value.action?.type==='work.response'&&r.value.action.mail===id)store.remove('restore-review',r.id);mail.workResponses||={};mail.workResponses[me]={done:v.done,note:v.note,updatedAt:Date.now(),pendingDelivery:true};c.saveMail(mail);c.response('work.response',id,mail.from,{done:v.done,note:v.note});continue;
      }
      if(op.type==='mail.receipt.ack'){const key=id+':'+v.recipient,r=store.get('read-receipt',key);if(r)store.put('read-receipt',key,{...r,notified:true});continue;}
      if(op.type==='room.update'||op.type==='room.leave'){const room=store.get('room-history',id);check(room,'대화방을 찾을 수 없습니다.');if(op.type==='room.leave'){room.left=true;c.stage({type:'room.leave',room:id},room.members);}else{room.pinned=!!op.pinned;room.muted=!!op.muted;if(op.read)room.unread=0;}c.saveRoom(room);continue;}
      if(op.type==='message.like'){const room=store.all('room-history').map(r=>r.value).find(r=>r.messages.some(m=>m.id===id));check(room&&!room.left,'대화를 찾을 수 없습니다.');const msg=room.messages.find(m=>m.id===id);msg.likesBy=unique([...(msg.likesBy||[]).filter(id=>id!==me),...(op.liked?[me]:[])]);msg.likes=msg.likesBy.length;msg.liked=!!op.liked;c.saveRoom(room);c.stage({type:'message.like',room:room.id,id,liked:!!op.liked},room.members);continue;}
      if(op.type==='item.upsert'){check(['notes','deadlines','tasks','shortcuts'].includes(op.kind),'개인 항목 종류가 올바르지 않습니다.');store.put('local-'+op.kind,id,v);continue;}
      if(op.type==='item.delete'){for(const kind of ['notes','deadlines','tasks','shortcuts'])store.put('local-'+kind,id,{deleted:true});continue;}
      if(op.type==='deadline.reschedule'){const old=store.get('local-deadlines',id)||data.deadlines.find(d=>d.id===id);check(old,'마감을 찾을 수 없습니다.');store.put('local-deadlines',id,{...old,...v,rule:'explicit'});continue;}
      if(op.type.startsWith('homeroom.')){
        const m=store.get('mail-history',v.mail);check(m&&m.from!=='me'&&m.category==='homeroom'&&m.folder!=='trash','받은 담임 업무만 변경할 수 있습니다.');
        if(op.type==='homeroom.pin')store.put('local-deadlines','local-homeroom-'+v.mail,v.pinned?{id:'local-homeroom-'+v.mail,...homeroom.pinnedItem(m,v.date||data.today)}:{deleted:true});
        else if(op.type==='homeroom.dismiss'&&!v.date){m.homeroomHidden=true;c.saveMail(m);}
        else{check(/^\d{4}-\d{2}-\d{2}$/.test(v.date),'날짜를 확인해 주세요.');m.homeroomDays||=[];if(op.type==='homeroom.dismiss'){const old=m.homeroomDays.find(d=>d.date===v.date);if(old)old.hidden=true;else m.homeroomDays.push({date:v.date,hidden:true});}else if(op.type==='homeroom.defer'){check(homeroom.onDay(m,v.date),'해당 날짜의 담임 업무를 찾을 수 없습니다.');const target=homeroom.nextDay(v.date);if(!m.homeroomDays.some(d=>d.date===target))m.homeroomDays.push({date:target,hidden:false,carriedFrom:v.date});}c.saveMail(m);}continue;
      }
      if(op.type.startsWith('event.')){
        const old=store.get('local-events',id)||data.events.find(e=>e.id===id),linked=v.noticeMail||v.deliveryMail||v.source||v.type==='personal'||old?.source||old?.type==='personal'||store.get('local-events',id)||operations.some(o=>o.type==='mail.send'&&o.value.calendarEvent===id);
        if(linked&&!old?.duty){
          if(op.type==='event.delete'){check(!old?.owner||old.owner===me,'등록자만 일정을 삭제할 수 있습니다.');store.put('local-events',id,{...old,deleted:true});if(old?.targets?.length)c.stage({type:'calendar.update',id,deleted:true},unique([old.owner,...old.targets]).filter(id=>id!==me));}
          else if(op.type==='event.reschedule'){check(!old?.noticeMail,'교시에 연결된 일정은 일과표에서 변경해 주세요.');store.put('local-events',id,{...old,...v});if(old?.targets?.length)c.stage({type:'calendar.update',id,value:v},unique([old.owner,...old.targets]).filter(id=>id!==me));}
          else{check(!old?.owner||old.owner===me,'등록자만 일정 내용을 수정할 수 있습니다.');store.put('local-events',id,{...old,...v,owner:old?.owner||me});if(old?.targets?.length)c.stage({type:'calendar.update',id,value:{date:v.date,start:v.start,end:v.end,title:v.title||'',note:v.note||'',place:v.place||''}},unique([old.owner,...old.targets]).filter(id=>id!==me));}continue;
        }
      }
      outgoing.push(op);
    }
    if(outgoing.length){publicJob=randomUUID();store.put('public-outbox',publicJob,{operations:outgoing,schedulePackets});}
  });
  for(const id of canceledUploads)c.uploadJobs?.delete(id);
  return publicJob;
}
module.exports={prepare};
