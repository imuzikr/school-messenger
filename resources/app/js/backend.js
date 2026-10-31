/* Installed clients send typed, authorized operations to the LAN server.
   Authentication tokens stay in Electron's main process, never in this renderer. */
(function(){
const clone=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const timingOnly=(before,after,fields)=>before&&!same(before,after)&&same({...before,...Object.fromEntries(fields.map(k=>[k,after[k]]))},after);
const keys=['rooms','mails','events','notes','deadlines','tasks','shortcuts'];
class DingdongBackend{
 constructor(native,callbacks){this.native=native;this.callbacks=callbacks;this.active=false;this.baseline=null;this.queue=Promise.resolve();this.pending=0;this.generation=0;this.refreshTimer=null;this.native.subscribe(event=>this.onEvent(event));}
 async init(){
  const generation=this.generation;
  this.connection=await this.native.connection();if(this.connection?.error)this.connection=null;
  if(!this.connection||generation!==this.generation)return null;
  const result=await this.native.request('/bootstrap');
  if(generation!==this.generation)return null;
  const wasWaiting=this.waitingForServer;
  this.waitingForServer=!!result.retryAutoLogin;
  if(wasWaiting&&!this.waitingForServer&&result.error)this.callbacks.loginRetryEnded?.();
  if(result.error){
   if(this.waitingForServer&&this.native.mainHost){
    clearTimeout(this.loginRetry);this.loginRetry=setTimeout(()=>this.init(),5000);
   }
   return null;
  }
  clearTimeout(this.loginRetry);this.activate(result);return result;
 }
 activate(result){this.user=result.user;this.active=true;this.baseline=clone(result.data);this.callbacks.data(result);this.callbacks.status(result.offline?'PC 보관 기록 · 연결 끊김':result.incomingFailures?'연결됨 · 수신 확인 필요 '+result.incomingFailures+'건':result.publicSavePending?'연결됨 · 공용 변경 서버 반영 대기 '+result.publicSavePending+'건':result.deliveryFailures?'연결됨 · 전달 실패 '+result.deliveryFailures+'건':result.publicSaveFailures?'연결됨 · 공용 변경 거절 기록 '+result.publicSaveFailures+'건':result.receiptPending?'PC 저장 완료 · 저장 확인 전송 대기':result.outgoingPending?'연결됨 · 발송 재시도 중':'연결됨');if(result.receiptPending||result.outgoingPending)this.scheduleRefresh(3000);else if(result.privacy?.more)this.scheduleRefresh();}
 async login(username,password,remember=false){
  this.generation++;clearTimeout(this.loginRetry);this.waitingForServer=false;
  const result=await this.native.request('/login',{username,password,remember});if(result.error)throw new Error(result.error);
  this.user=result.user;if(!result.user.mustChange){const snapshot=await this.native.request('/bootstrap');if(snapshot.error)throw Object.assign(new Error(snapshot.error),{code:snapshot.code});this.activate(snapshot);}
  if(result.loginWarning)this.callbacks.loginWarning(result.loginWarning);return result.user;
 }
 async changePassword(current,password){const result=await this.native.request('/password',{current,password});if(result.error)throw new Error(result.error);await this.refresh();if(result.loginWarning)this.callbacks.loginWarning(result.loginWarning);}
 async logout(){this.active=false;this.generation++;clearTimeout(this.loginRetry);this.baseline=null;const result=await this.native.request('/logout',{});if(result.error)throw Error(result.error);}
 diff(before,after){const operations=[];if(!before)return operations;
  if(!same(before.classTeachers,after.classTeachers))operations.push({type:'classes.upsert',value:{classes:after.classTeachers||[]}});
  const oldRooms=new Map(before.rooms.map(r=>[r.id,r]));
  for(const room of after.rooms){const old=oldRooms.get(room.id);if(!old)operations.push({type:'room.create',value:room});else if(room.pinned!==old.pinned||room.muted!==old.muted||old.unread>0&&room.unread===0)operations.push({type:'room.update',id:room.id,pinned:room.pinned,muted:room.muted,read:room.unread===0});
   const messages=new Map((old?.messages||[]).map(m=>[m.id,m]));for(const m of room.messages){const prev=messages.get(m.id);if(!prev&&m.sender==='me')operations.push({type:'message.send',room:room.id,value:m});else if(prev&&prev.liked!==m.liked)operations.push({type:'message.like',id:m.id,liked:m.liked});}}
  for(const room of before.rooms)if(!after.rooms.some(r=>r.id===room.id))operations.push({type:'room.leave',id:room.id});
  const oldMails=new Map(before.mails.map(m=>[m.id,m]));for(const m of after.mails){const old=oldMails.get(m.id);if(!old&&m.from==='me')operations.push({type:'mail.send',value:m});else if(old&&(old.folder!==m.folder||old.important!==m.important||old.unread!==m.unread||old.eventId!==m.eventId||!same(old.receipts,m.receipts)))operations.push({type:'mail.update',id:m.id,folder:m.folder,important:m.important,read:!m.unread,eventId:m.eventId,recall:m.receipts.some((r,i)=>r==='recalled'&&old.receipts[i]!=='recalled')});}
  if(!same(before.defaultPeriods,after.defaultPeriods))operations.push({type:'schedule.upsert',value:{periods:after.defaultPeriods}});
  for(const schedule of after.bellSchedules||[]){const old=(before.bellSchedules||[]).find(s=>s.date===schedule.date);if(!same(old,schedule))operations.push({type:'schedule.upsert',value:schedule});}
  for(const schedule of before.bellSchedules||[])if(!(after.bellSchedules||[]).some(s=>s.date===schedule.date))operations.push({type:'schedule.delete',value:{date:schedule.date}});
  const previousEvents=new Map(before.events.map(e=>[e.id,e]));for(const event of after.events){const prev=previousEvents.get(event.id);if(!event.noticeMail&&!['makeup','lessonChange'].includes(event.type)&&timingOnly(prev,event,['date','start','end']))operations.push({type:'event.reschedule',id:event.id,value:{date:event.date,start:event.start,end:event.end,...(event.duty?{expected:{date:prev.date,start:prev.start,end:prev.end}}:{})}});else if(!event.readonly&&!(event.noticeMail&&!prev)&&!same(prev,event))operations.push({type:'event.upsert',value:event});}for(const event of before.events)if(!event.readonly&&!after.events.some(e=>e.id===event.id))operations.push({type:'event.delete',id:event.id});
  for(const kind of ['notes','deadlines','tasks','shortcuts']){const previous=new Map((before[kind]||[]).map(i=>[i.id,i]));for(const value of after[kind]||[])if(kind==='deadlines'&&value.dueTime&&timingOnly(previous.get(value.id),value,['date','dueTime','rule']))operations.push({type:'deadline.reschedule',id:value.id,value:{date:value.date,dueTime:value.dueTime}});else if(!same(previous.get(value.id),value))operations.push({type:'item.upsert',kind,value});for(const value of before[kind]||[])if(!(after[kind]||[]).some(i=>i.id===value.id))operations.push({type:'item.delete',id:value.id});}
  // Event links are applied after the corresponding event has been inserted.
  const mailUpdates=operations.filter(op=>op.type==='mail.update'&&op.eventId||op.type==='mail.send'&&(op.value.calendarEvent||op.value.scheduleAnnouncement));for(const op of mailUpdates){operations.splice(operations.indexOf(op),1);operations.push(op);}
  return operations;
 }
 sync(data,onResult){if(!this.active)return Promise.resolve(false);const before=this.baseline,snapshot=clone(data),operations=this.diff(before,snapshot);this.baseline=snapshot;if(!operations.length)return Promise.resolve(true);const generation=this.generation;this.pending++;this.callbacks.status('저장 중');
  const job=this.queue.then(async()=>{if(generation!==this.generation)return false;try{const result=await this.native.request('/sync',{operations});this.lastSyncResult=result;onResult?.(result);if(result.error)throw new Error(result.error);this.callbacks.status(result.publicSave==='pending'?'공용 변경 서버 반영 대기':Object.values(result.delivery||{}).includes('review')?'발송 여부 확인 필요 · 보낸함 확인':result.failed?'발송 실패 · 보낸함 확인':result.queued?'PC에 발송 대기 중':'연결됨');return true;}catch(error){if(this.generation===generation){this.generation++;this.baseline=before;this.callbacks.error(error.message);}return false;}}).finally(async()=>{this.pending--;if(!this.pending){clearTimeout(this.refreshTimer);this.refreshTimer=null;await this.refresh();}});this.queue=job.catch(()=>false);return job;
 }
 scheduleRefresh(delay=0){if(this.refreshTimer||!this.active)return;this.refreshTimer=setTimeout(()=>{this.refreshTimer=null;this.refresh();},delay);}
 async refresh(){if(this.pending||!this.user)return;const generation=this.generation;try{const result=await this.native.request('/bootstrap');if(generation!==this.generation)return;if(result.error){if(result.status===401){this.active=false;this.callbacks.expired();}else this.callbacks.status('연결 확인 필요');return;}this.activate(result);}catch{this.callbacks.status('연결 끊김');}}
 onEvent(event){if(event.kind==='connected'&&!this.active){this.init().catch(()=>this.callbacks.status('연결 확인 필요'));return;}if(['changed','presence','ready','connected'].includes(event.kind))this.scheduleRefresh();if(event.kind==='disconnected')this.callbacks.status('재연결 중');if(event.kind==='expired'||event.kind==='logout'){this.generation++;clearTimeout(this.loginRetry);clearTimeout(this.refreshTimer);this.waitingForServer=false;this.refreshTimer=null;this.active=false;this.user=null;this.baseline=null;this.callbacks.expired();}}
}
window.DingdongBackend=DingdongBackend;
})();
