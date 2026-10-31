'use strict';
const {randomUUID}=require('node:crypto');
const {PrivateClient:LegacyClient}=require('./legacy-client.cjs');
const crypto=require('../privacy/crypto.cjs');
const deadlines=require('../js/message-deadlines.js');
const workTools=require('../js/work-tools.js');
const bell=require('../server/schedule.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
const unique=a=>[...new Set(a)];
const network=e=>/연결|connection|network|ECONN|timeout|fetch failed/i.test(e.message);
const transient=e=>e.status!==507&&(network(e)||e.status>=500||[408,425,429].includes(e.status));
const owner=(m,me)=>m.from==='me'?me:m.from;
const requireThat=(condition,message)=>{if(!condition)throw Object.assign(new Error(message),{code:'DELIVERY_INVALID'});};
const invalidIncoming=e=>['DELIVERY_INVALID','PEER_KEY_MISSING','PEER_KEY_CHANGED'].includes(e.code)||e instanceof TypeError;
const validateIncoming=fn=>{try{return fn();}catch(e){throw Object.assign(e,{code:'DELIVERY_INVALID'});}};
class PrivateClient extends LegacyClient{
  queueTask(fn){const job=this.queue.then(()=>{if(this.closing)throw Error('로그인 상태가 변경되었습니다.');return fn();});this.queue=job.catch(()=>{});return job;}
  request(route,payload){
    if(route==='/attachment'&&!payload?.inline){this.downloadJobs||=new Map();const key=payload.mail+':'+payload.index;if(!this.downloadJobs.has(key)){const job=require('./file-transfer.cjs').download(this,payload);this.downloadJobs.set(key,job);job.finally(()=>this.downloadJobs.delete(key)).catch(()=>{});}return this.downloadJobs.get(key);}
    return super.request(route,payload);
  }
  stageAttachment(action,value){return this.queueTask(()=>{if(action==='begin')return this.files.begin(value);if(action==='chunk')return this.files.chunk(value);if(action==='finish')return this.files.finish(value.localFile);if(action==='cancel')return this.files.cancel(value.localFile);throw Error('지원하지 않는 파일 준비 요청입니다.');});}
  async api(route,payload){const r=await this.raw(route,payload);if(r.error)throw Object.assign(new Error(r.error),{status:r.status,code:r.code});return r;}
  stage(action,targets,{releaseAt=0,files=[],pending=null}={}){const id=randomUUID();this.store.put('relay-outbox',id,{action,targets:unique(targets),releaseAt,files,pending,createdAt:Date.now()});return id;}
  async keys(){try{const r=await this.api('/privacy/keys');this.store.put('state','keys',r.keys);return r.keys;}catch(e){if(network(e)&&this.store.get('state','keys'))return this.store.get('state','keys');throw e;}}
  deliveryRecord(p,patch){
    if(p.action?.type==='mail.create'||p.pending){const id=p.pending||p.action.value.id,m=this.store.get('mail-history',id);if(m)this.saveMail({...m,...patch});}
    if(p.action?.type==='chat.message'){const room=this.store.get('room-history',p.action.room.id),m=room?.messages.find(m=>m.id===p.action.value.id);if(m){Object.assign(m,patch);this.saveRoom(room);}}
    if(p.action?.type==='work.response'){const m=this.store.get('mail-history',p.action.mail),r=m?.workResponses?.[this.user.id];if(r&&r.updatedAt<=p.action.at){Object.assign(r,patch);this.saveMail(m);}}
  }
  rejectDelivery(kind,row,error){
    const sendError={message:error.message,status:error.status||null,at:Date.now(),job:row.id};
    this.store.transaction(()=>{
      // The generated school announcement belongs to this rejected schedule and has never been sent.
      if(kind==='public-outbox')for(const packet of row.value.schedulePackets||[]){
        const job=this.store.get('relay-outbox',packet);
        if(job?.action?.value?.scheduleAnnouncement){
          this.store.remove('relay-outbox',packet);this.store.remove('mail-history',job.pending);this.store.remove('content','mail:'+job.pending);
        }
      }
      this.store.put('relay-failed',kind+':'+row.id,{...row.value,transportKind:kind,job:row.id,error:sendError});this.deliveryRecord(row.value,{pendingDelivery:false,sendError});this.store.remove(kind,row.id);});
  }
  async flush({force=false}={}){
    if(!force&&(this.store.get('state','relay-retry-at')||0)>Date.now())return {deferred:true};
    for(const row of this.store.all('relay-cancel')){try{await this.api('/relay/cancel',row.value);this.store.remove('relay-cancel',row.id);}catch(e){if(transient(e)||e.status===401)throw e;this.rejectDelivery('relay-cancel',row,e);}}
    let publicDeferred=false;
    for(const row of this.store.all('public-outbox')){
      try{await this.api('/sync',{operations:row.value.operations});this.store.remove('public-outbox',row.id);}
      catch(e){if(e.status===401)throw e;if(transient(e)){publicDeferred=true;break;}this.rejectDelivery('public-outbox',row,e);}
    }
    const waiting=new Set(this.store.all('public-outbox').flatMap(row=>row.value.schedulePackets||[]));
    const rows=this.store.all('relay-outbox').filter(row=>!waiting.has(row.id));
    if(rows.length){let {sequence}=await this.api('/relay/state');const keys=await this.keys();
      for(const row of rows){let p=row.value;
        try{
        if(!p.wire){const ctx={...crypto.context('relay',row.id,this.user.id,p.targets),sequence:++sequence,releaseAt:p.releaseAt,files:p.files.map(f=>f.id)};for(const target of ctx.targets)await this.trusted(target,keys);p={...p,wire:{context:ctx,sealed:await crypto.encrypt(p.action,ctx,this.identity,keys)}};this.store.put('relay-outbox',row.id,p);}
        else sequence=Math.max(sequence,p.wire.context.sequence);
        const watermark=(await this.api('/relay/state')).sequence;
        sequence=Math.max(sequence,watermark);
        if(watermark<p.wire.context.sequence){
          if(!require('./file-transfer.cjs').uploadsReady(this,p.files))return {deferred:true};
          for(const file of p.files)if(!file.blob)await this.api('/relay/upload',file);
        }
        const digest=crypto.digest(p.wire.sealed);
        const receipt=await this.api('/relay/send',{...p.wire,requestProof:true});
        // Older servers return a bare ok for a new send, but their duplicate response proves only a sequence.
        if(receipt.ok!==true||((receipt.duplicate||receipt.digest!==undefined)&&receipt.digest!==digest)){
          throw Object.assign(new Error('이 메시지의 발송 여부를 확인할 수 없습니다. 수신자에게 확인해 주세요.'),{code:'RELAY_SEQUENCE_UNCONFIRMED'});
        }
        this.store.transaction(()=>{
          this.deliveryRecord(p,{pendingDelivery:false,sendError:null,restoreReview:null});
          this.store.put('relay-sent',row.id,{sequence:p.wire.context.sequence,digest,at:Date.now()});
          if(receipt.digest)this.store.put('relay-send-ack',digest,digest);
          this.store.remove('relay-outbox',row.id);
        });
        for(const file of p.files)this.uploadJobs?.delete(file.id);
        }catch(e){
          if(e.code==='RELAY_SEQUENCE_UNCONFIRMED'){
            const notice={message:e.message,at:Date.now()};
            this.store.transaction(()=>{
              this.deliveryRecord(p,{pendingDelivery:false,sendError:null,restoreReview:notice});
              this.store.put('restore-review','relay-outbox:'+row.id,{action:p.action,source:'relay-sequence',at:notice.at});
              this.store.remove('relay-outbox',row.id);
            });
            for(const file of p.files)this.uploadJobs?.delete(file.id);
          }else{
            if(transient(e)||e.status===401)throw e;
            this.rejectDelivery('relay-outbox',{id:row.id,value:p},e);
            for(const file of p.files)this.uploadJobs?.delete(file.id);
          }
        }
      }
    }
    if(publicDeferred){this.store.put('state','relay-retry-at',Date.now()+3000);return {deferred:true};}
    this.store.remove('state','relay-retry-at');return {deferred:false};
  }
  async flushSafe(options){
    try{return await this.flush(options);}catch(e){if(!transient(e))throw e;this.store.put('state','relay-retry-at',Date.now()+3000);return {deferred:true,error:e.message};}
  }
  retryMail(id){
    const mail=this.store.get('mail-history',id),failed=mail?.sendError?.job&&this.store.get('relay-failed','relay-outbox:'+mail.sendError.job);
    requireThat(mail?.from==='me'&&failed?.action?.type==='mail.create','다시 보낼 수 있는 발송 실패 메시지를 찾을 수 없습니다.');
    const job=randomUUID(),{wire,error,transportKind,...p}=failed;
    this.store.put('relay-outbox',job,{...p,job:undefined,createdAt:Date.now()});this.store.remove('relay-failed','relay-outbox:'+mail.sendError.job);this.saveMail({...mail,relayPacket:job,pendingDelivery:true,sendError:null});
  }
  async acknowledgeRelay(kinds=['relay-ack','migration-ack']){
    for(const kind of kinds){
      const rows=this.store.all(kind);
      for(let i=0;i<rows.length;i+=300){
        const batch=rows.slice(i,i+300),values=batch.map(r=>r.value);
        await this.api(kind==='migration-ack'?'/relay/migrate':'/relay/ack',kind==='relay-send-ack'?{entries:[],confirmedSends:values}:{entries:values});
        this.store.transaction(()=>batch.forEach(r=>this.store.remove(kind,r.id)));
      }
    }
  }
  saveMail(mail){this.store.put('mail-history',mail.id,mail);}
  saveRoom(room){this.store.put('room-history',room.id,room);}
  response(type,mail,target,extra={}){this.stage({type,mail,at:Date.now(),...extra},[target]);}
  apply(action,ctx,{defer=true}={}){
    requireThat(action&&typeof action.type==='string','알림 형식이 올바르지 않습니다.');
    const actor=ctx.sender,me=this.user.id,m=action.mail?this.store.get('mail-history',action.mail):null;
    if(action.type==='mail.recall'&&!m){this.store.put('recall-before-mail',actor+':'+action.mail,true);this.response('receipt.recall',action.mail,actor,{recalled:true});return true;}
    if(['receipt.delivery','receipt.read','work.response','receipt.recall'].includes(action.type)&&!m){if(defer)this.store.put('relay-deferred',ctx.id,{action,context:ctx});return false;}
    if(action.type==='mail.create'){
      const v=action.value;requireThat(v&&typeof v.id==='string'&&v.id.length<=100&&Array.isArray(v.to)&&Array.isArray(v.files),'메시지 정보가 올바르지 않습니다.');
      requireThat(JSON.stringify(crypto.context('relay',ctx.id,actor,v.to).targets)===JSON.stringify(ctx.targets),'메시지 수신 대상이 일치하지 않습니다.');validateIncoming(()=>this.privateFields('mail',v));
      requireThat(v.files.length<=20&&v.files.every(f=>Number.isInteger(f.index)&&typeof f.name==='string'&&f.name.length<=180),'첨부 파일 정보가 올바르지 않습니다.');
      if(v.workRequest)requireThat(JSON.stringify(validateIncoming(()=>workTools.request(v.workRequest,v.to,v.cc||[],actor)))===JSON.stringify(v.workRequest),'요청 대상이 올바르지 않습니다.');
      if(v.scheduleAnnouncement)requireThat(this.currentData?.people.find(p=>p.id===actor)?.admin||this.currentData?.dutySettings.managers.timetable?.includes(actor),'일과표 안내 발신 권한을 확인할 수 없습니다.');
      if(v.notice)requireThat(['makeup','lessonChange'].includes(v.notice.kind)&&Array.isArray(v.notice.rows)&&v.notice.rows.length<=7&&v.notice.rows.every(r=>Number.isInteger(Number(r.period))&&Number(r.period)>=1&&Number(r.period)<=7),'수업 안내 정보가 올바르지 않습니다.');
      const old=this.store.get('mail-history',v.id);if(old){requireThat(owner(old,me)===actor,'메시지 식별자가 중복되었습니다.');return true;}
      if(this.store.get('recall-before-mail',actor+':'+v.id))return true;
      const fields=this.privateFields('mail',v);this.store.put('content','mail:'+v.id,fields);
      const mail={...v,from:actor===me?'me':actor,folder:actor===me?'sent':'inbox',previousFolder:actor===me?'sent':'inbox',unread:actor!==me,canRecall:actor===me,scheduled:'',receipts:v.to.map(()=> 'unread'),storedReceipts:{[actor]:v.createdAt},workDelivery:Object.fromEntries(v.to.map(id=>[id,'unread'])),workResponses:{},homeroomDays:[],relayPacket:ctx.id};
      this.saveMail(mail);this.mailEvents(mail);if(actor!==me)this.response('receipt.delivery',mail.id,actor);
    }else if(action.type==='room.create'){
      const r=action.value;requireThat(r&&typeof r.id==='string'&&typeof r.name==='string'&&Array.isArray(r.members)&&r.members.includes(actor)&&r.members.includes(me),'대화방 정보가 올바르지 않습니다.');
      requireThat(JSON.stringify(crypto.context('relay',ctx.id,actor,r.members).targets)===JSON.stringify(ctx.targets),'대화방 참여자가 일치하지 않습니다.');
      if(!this.store.get('room-history',r.id))this.saveRoom({id:r.id,name:r.name,notice:r.notice||'',members:r.members.filter(id=>id!==me),messages:[],pinned:false,muted:false,unread:0,creator:actor});
    }else if(action.type==='chat.message'){
      const v=action.value,r=action.room;requireThat(r&&typeof r.id==='string'&&Array.isArray(r.members)&&r.members.includes(me)&&r.members.includes(actor),'대화 참여자를 확인할 수 없습니다.');
      let room=this.store.get('room-history',r.id);if(!room){this.apply({type:'room.create',value:r},ctx);room=this.store.get('room-history',r.id);}
      requireThat(actor===me||room.members.includes(actor),'이 대화방의 참여자가 아닙니다.');if(room.left)return true;
      if(!room.messages.some(m=>m.id===v.id)){const fields=validateIncoming(()=>this.privateFields('message',v));this.store.put('content','message:'+v.id,fields);room.messages.push({...v,...fields,sender:actor===me?'me':actor,likes:0,liked:false,likesBy:[]});if(actor!==me)room.unread++;this.saveRoom(room);}
    }else if(action.type==='room.leave'){
      const room=this.store.get('room-history',action.room);if(room&&room.members.includes(actor)){room.members=room.members.filter(id=>id!==actor);this.saveRoom(room);}
    }else if(action.type==='message.like'){
      const room=this.store.get('room-history',action.room),msg=room?.messages.find(v=>v.id===action.id);
      if(!msg){if(defer)this.store.put('relay-deferred',ctx.id,{action,context:ctx});return false;}
      requireThat(actor===me||room.members.includes(actor),'대화방 참여자만 공감할 수 있습니다.');const key=action.type+':'+action.id+':'+actor;if((this.store.get('relay-revision',key)||0)>=ctx.sequence)return true;
      msg.likesBy=unique([...(msg.likesBy||[]).filter(id=>id!==actor),...(action.liked?[actor]:[])]);msg.likes=msg.likesBy.length;msg.liked=msg.likesBy.includes(me);this.saveRoom(room);this.store.put('relay-revision',key,ctx.sequence);
    }else if(action.type==='mail.recall'){
      requireThat(owner(m,me)===actor,'발신자만 회수를 요청할 수 있습니다.');const recalled=m.unread||this.store.get('recalled',m.id);
      if(recalled){this.store.put('recalled',m.id,true);for(const row of this.store.all('local-events'))if(row.value.noticeMail===m.id||row.value.deliveryMail===m.id||row.id===m.calendarEvent)this.store.put('local-events',row.id,{deleted:true});}
      this.response('receipt.recall',m.id,actor,{recalled:!!recalled});
    }else if(['receipt.delivery','receipt.read','work.response','receipt.recall'].includes(action.type)){
      requireThat(owner(m,me)===me&&m.to.includes(actor),'원 메시지의 수신자가 보낸 알림이 아닙니다.');const key=action.type+':'+m.id+':'+actor;if((this.store.get('relay-revision',key)||0)>=ctx.sequence)return true;
      const index=m.to.indexOf(actor);m.receipts||=m.to.map(()=> 'unread');m.workDelivery||={};m.storedReceipts||={};
      if(action.type==='receipt.delivery')m.storedReceipts[actor]=action.at;
      if(action.type==='receipt.read'){m.receipts[index]='read';m.workDelivery[actor]='read';const id=m.id+':'+actor;if(!this.store.get('read-receipt',id))this.store.put('read-receipt',id,{mail:m.id,recipient:actor,readAt:action.at,subject:m.title,notified:false});}
      if(action.type==='work.response'){requireThat(m.workRequest?.targets.includes(actor)&&typeof action.done==='boolean'&&typeof action.note==='string'&&action.note.length<=500,'완료 응답이 올바르지 않습니다.');m.workResponses||={};m.workResponses[actor]={done:action.done,note:action.note,updatedAt:action.at};}
      if(action.type==='receipt.recall'&&action.recalled){m.receipts[index]='recalled';m.workDelivery[actor]='recalled';}
      this.saveMail(m);this.store.put('relay-revision',key,ctx.sequence);
    }else if(action.type==='calendar.update'){
      const old=this.store.get('local-events',action.id);if(!old){if(defer)this.store.put('relay-deferred',ctx.id,{action,context:ctx});return false;}
      requireThat(old.owner===actor||old.targets?.includes(actor),'연결된 일정의 참여자가 아닙니다.');const key=action.type+':'+action.id+':'+actor;if((this.store.get('relay-revision',key)||0)>=ctx.sequence)return true;
      if(action.deleted){requireThat(old.owner===actor,'등록자만 일정을 삭제할 수 있습니다.');this.store.put('local-events',action.id,{...old,deleted:true});}
      else{const v=action.value;requireThat(/^\d{4}-\d{2}-\d{2}$/.test(v.date)&&/^\d{2}:\d{2}$/.test(v.start)&&/^\d{2}:\d{2}$/.test(v.end)&&v.start<v.end,'일정 시간이 올바르지 않습니다.');const details={};for(const [key,max] of [['title',100],['note',1000],['place',100]])if(Object.hasOwn(v,key)){requireThat(old.owner===actor&&typeof v[key]==='string'&&v[key].length<=max,'일정 내용 변경 권한 또는 형식이 올바르지 않습니다.');details[key]=v[key];}this.store.put('local-events',action.id,{...old,...details,date:v.date,start:v.start,end:v.end});}this.store.put('relay-revision',key,ctx.sequence);
    }else requireThat(false,'지원하지 않는 암호화 알림입니다.');return true;
  }
  incomingFailure(id,fingerprint,error){
    const old=this.store.get('incoming-failed',id);
    this.store.put('incoming-failed',id,{fingerprint,code:error.code||'DELIVERY_INVALID',firstAt:old?.firstAt||Date.now(),lastAt:Date.now()});
  }
  async receiveIsolated(packet,keys){
    const sender=packet.context?.sender,id=packet.context?.id||crypto.digest(packet),trust=keys[sender]?.recovered?this.store.get('trust',sender)?.fingerprint:null;
    const fingerprint=crypto.digest([packet,keys[sender]||null,trust||null]),old=this.store.get('incoming-failed',id);
    if(old?.fingerprint===fingerprint)return;
    try{await this.receiveRelay(packet,keys);this.store.remove('incoming-failed',id);}
    catch(error){if(!invalidIncoming(error))throw error;this.incomingFailure(id,fingerprint,error);}
  }
  applyDeferred(){
    for(const row of this.store.all('relay-deferred')){
      const id='deferred:'+row.id,fingerprint=crypto.digest(row.value);
      if(this.store.get('incoming-failed',id)?.fingerprint===fingerprint)continue;
      try{this.store.transaction(()=>{if(this.apply(row.value.action,row.value.context,{defer:false})){this.store.remove('relay-deferred',row.id);this.store.remove('incoming-failed',id);}});}
      catch(error){if(!invalidIncoming(error))throw error;this.incomingFailure(id,fingerprint,error);}
    }
  }
  async receiveRelay(packet,keys){
    const ctx=packet.context;requireThat(ctx?.kind==='relay'&&ctx.targets?.includes(this.user.id),'이 PC의 수신 정보가 아닙니다.');requireThat(crypto.digest(packet.sealed)===packet.digest,'전달 내용 확인 값이 일치하지 않습니다.');
    const seen=this.store.get('relay-seen',ctx.id);if(seen){requireThat(seen===packet.digest,'전달 식별자가 중복되었습니다.');this.store.put('relay-ack',ctx.id,{id:ctx.id,digest:packet.digest});return;}
    const key=await this.trusted(ctx.sender,keys);let action;
    try{action=await crypto.decrypt(packet.sealed,ctx,this.identity,key,this.user.id);}catch(error){throw Object.assign(error,{code:'DELIVERY_INVALID'});}
    // Content, metadata, subsequent receipt, deduplication and ACK commit together.
    this.store.transaction(()=>{this.apply(action,ctx);if(action.type==='mail.create'){const mail=this.store.get('mail-history',action.value.id);if(mail){for(const f of mail.files)if(packet.fileExpiry?.[f.relayFile?.id])f.expiresAt=packet.fileExpiry[f.relayFile.id];this.saveMail(mail);}}this.store.put('relay-seen',ctx.id,packet.digest);this.store.put('relay-ack',ctx.id,{id:ctx.id,digest:packet.digest});});
  }
  mailEvents(mail){
    const me=this.user.id,sender=owner(mail,me);if(mail.calendarDetails){const e=mail.calendarDetails;this.store.put('local-events',e.id,{...e,owner:sender,targets:mail.to,deliveryMail:mail.id,readonly:sender!==me,canReschedule:true});}
    if(mail.notice)for(const row of mail.notice.rows){const targets=unique([row.teacher,row.originalTeacher,row.homeroomTeacher].filter(Boolean));if(sender!==me&&!targets.includes(me))continue;
      const data=this.currentData||this.snapshot?.data,periods=data?.bellSchedules?.find(s=>s.date===mail.notice.date)?.periods||data?.defaultPeriods||bell.defaults(),slot=periods.find(p=>p.period===Number(row.period));if(!slot)continue;
      const e={id:mail.id+'-p'+row.period,title:`${mail.notice.kind==='makeup'?'보강 안내':'수업 변경 안내'} · ${row.period}교시${row.className?' · '+row.className:''}`,date:mail.notice.date,start:slot.start,end:slot.end,type:mail.notice.kind,period:Number(row.period),targets,note:mail.body.slice(0,1000),place:row.className,assignment:row,noticeMail:mail.id,owner:sender,readonly:sender!==me,canReschedule:false};this.store.put('local-events',e.id,e);
    }
  }
  async migrate(result){
    const keys=result.privacy.keys,data=result.data,ready=[];
    this.store.transaction(()=>{for(const item of result.privacy.localRecords||[]){if(!this.store.get('local-'+item.kind,item.id))this.store.put('local-'+item.kind,item.id,{...item.value,id:item.id});this.store.put('localize',item.id,{kind:item.kind,id:item.id,hash:item.hash});}});
    for(const token of result.privacy.migration||[]){const marker=token.kind+':'+token.id;
      if(!this.store.get('migrated-local',marker)){
        if(token.kind==='mail'&&!token.recalled){const value=data.mails.find(m=>m.id===token.id);if(!value)continue;const mail=await super.receive('mail',value,keys);let complete=!!this.store.get('content','mail:'+mail.id)&&!value.contentPending;
          for(const [sender,response] of Object.entries(mail.workResponses||{}))if(response.responseId){const d=await super.receive('response',{...response,id:response.responseId,sender},keys,mail.id);if(!this.store.get('content','response:'+response.responseId)||response.contentPending)complete=false;mail.workResponses[sender]={done:response.done,note:d.note||'',updatedAt:response.updatedAt};}if(!complete)continue;
          mail.files=value.files.map(f=>({...f}));const content=this.store.get('content','mail:'+mail.id);mail.html=content.html||'';delete mail.localOnly;mail.canRecall=mail.from==='me';this.saveMail(mail);
          for(const event of data.events)if(event.noticeMail===mail.id||event.deliveryMail===mail.id||event.id===mail.calendarEvent)this.store.put('local-events',event.id,{...event,...(mail.calendarDetails&&event.id===mail.calendarEvent?mail.calendarDetails:{})});
        }else if(token.kind==='mail')this.store.put('recalled',token.id,true);
        else{const found=data.rooms.find(r=>r.id===token.id);if(!found)continue;const room=clone(found);let complete=true;for(let i=0;i<room.messages.length;i++){const value=room.messages[i];room.messages[i]=await super.receive('message',value,keys,room.id);if(value.contentPending||!this.store.get('content','message:'+value.id))complete=false;}if(!complete)continue;const old=this.store.get('room-history',room.id),messages=new Map((old?.messages||[]).map(m=>[m.id,m]));for(const m of room.messages)messages.set(m.id,m);room.messages=[...messages.values()];this.saveRoom(room);}
        this.store.put('migrated-local',marker,true);
      }ready.push(token);
    }
    this.store.transaction(()=>{for(const token of ready)this.store.put('migration-ack',token.kind+':'+token.id,token);for(const r of data.readReceipts||[])if(!this.store.get('read-receipt',r.mail+':'+r.recipient))this.store.put('read-receipt',r.mail+':'+r.recipient,{...r,subject:this.store.get('content','mail:'+r.mail)?.title||'메시지',notified:false});});
  }
  compose(result){
    const data=result.data,me=this.user.id;result.incomingFailures=this.store.all('incoming-failed').length;
    const recalled=new Set(this.store.all('recalled').filter(r=>r.value).map(r=>r.id));
    data.mails=this.store.all('mail-history').filter(r=>!recalled.has(r.id)).map(({value:m})=>{delete m.localOnly;if(m.scheduled&&Date.parse(m.scheduled)<=Date.now())m.scheduled='';m.files=(m.files||[]).filter(f=>!f.inline).map(f=>({...f,expired:!!f.expiresAt&&f.expiresAt<=Date.now()}));if(/ieum-inline:\d+/.test(m.html||'')){m.inlineStored=true;m.html=m.html.replace(/ieum-inline:\d+/g,'');}return m;}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    data.rooms=this.store.all('room-history').map(r=>r.value).filter(r=>!r.left);
    data.readReceipts=this.store.all('read-receipt').map(r=>r.value).filter(r=>!r.notified).map(r=>({...r,name:data.people.find(p=>p.id===r.recipient)?.name||'상대방'}));
    for(const kind of ['events','notes','deadlines','tasks','shortcuts']){const map=new Map((data[kind]||[]).filter(v=>kind!=='events'||!v.noticeMail&&!v.deliveryMail).map(v=>[v.id,v]));for(const {id,value} of this.store.all('local-'+kind)){if(value.deleted)map.delete(id);else map.set(id,value);}data[kind]=[...map.values()];}
    for(const e of data.events)if(['makeup','lessonChange'].includes(e.type)&&e.period){const slot=(data.bellSchedules.find(s=>s.date===e.date)?.periods||data.defaultPeriods).find(p=>p.period===Number(e.period));if(slot){e.start=slot.start;e.end=slot.end;}}
    data.autoDeadlineSources=this.store.get('state','deadline-ledger')||{};for(const r of result.privacy.localLedger||[])data.autoDeadlineSources[r.source_key]||=r.item_id;deadlines.applyDemo(data,me);
    this.store.transaction(()=>{this.store.put('state','deadline-ledger',data.autoDeadlineSources);for(const kind of ['events','deadlines'])for(const e of data[kind])if(e.source)this.store.put('local-'+kind,e.id,e);this.store.put('state','snapshot',result);});this.snapshot=result;return result;
  }
  async refresh(page=0){
    await this.initialize();const outgoing=await this.flushSafe({force:true});const result=await this.api('/bootstrap?privacy=2');requireThat(result.privacy?.relayVersion===2,'서버를 PC 메타데이터 보관 지원 버전으로 업데이트해 주세요.');this.currentData=result.data;this.store.put('state','keys',result.privacy.keys);await this.migrate(result);
    const cursor=this.store.get('state','relay-pull-after')||0;
    const pulled=await this.api('/relay/pull'+(cursor?'?after='+cursor:''));for(const p of pulled.packets)await this.receiveIsolated(p,result.privacy.keys);this.applyDeferred();
    // Advance only after every packet was either durably stored or quarantined.
    // Disk failures leave the cursor and server queue untouched.
    this.store.put('state','relay-pull-after',pulled.more&&Number.isSafeInteger(pulled.cursor)?pulled.cursor:0);
    result.privacy.more=!!(result.privacy.more||pulled.more);
    // Relay content, receipts and ACKs were committed by receiveRelay; only legacy upgrades need an intermediate view.
    if(this.store.all('outbox').length){this.compose(result);await this.upgradeOutbox();}
    try{await super.acknowledge();await this.acknowledgeRelay();const rows=this.store.all('localize');for(let i=0;i<rows.length;i+=300){const batch=rows.slice(i,i+300);await this.api('/privacy/localize',{entries:batch.map(r=>r.value)});this.store.transaction(()=>batch.forEach(r=>this.store.remove('localize',r.id)));}const after=await this.flushSafe();result.outgoingPending=!!(outgoing.deferred||after.deferred);await this.acknowledgeRelay(['relay-send-ack']);}
    catch(e){if(!network(e)&&e.status!==409&&!(e.status>=500))throw e;result.receiptPending=true;}
    const failed=this.store.all('relay-failed');
    result.publicSaveFailures=failed.filter(row=>row.value.transportKind==='public-outbox').length;
    result.publicSavePending=this.store.all('public-outbox').length;
    result.deliveryFailures=failed.length-result.publicSaveFailures;this.compose(result);if(result.privacy.more&&!result.receiptPending&&page<25)return this.refresh(page+1);return result;
  }
  async prepare(operations){return require('./relay-operations.cjs').prepare(this,operations);}
  async upgradeOutbox(){
    for(const row of this.store.all('outbox')){
      const operations=[];
      for(const old of row.value.operations){const op=clone(old),v=op.value||{};
        if(op.type==='mail.send'||op.type==='message.send'){
          const kind=op.type==='mail.send'?'mail':'message';
          if(kind==='mail'&&this.store.get('mail-history',v.id)||kind==='message'&&this.store.get('room-history',op.room)?.messages.some(m=>m.id===v.id))continue;
          const fields=this.store.get('content',kind+':'+v.id);requireThat(fields,'이전 발송 대기의 원본을 PC에서 찾을 수 없습니다. 보관 파일을 확인해 주세요.');op.value={...v,...fields};
        }
        if(op.type==='mail.work.respond')op.value={...v,note:this.store.get('content','response:'+v.responseId)?.note||''};
        operations.push(op);
      }
      this.restoringLegacy=true;try{if(operations.length)await this.prepare(operations);}finally{this.restoringLegacy=false;}
      this.store.transaction(()=>{this.store.remove('outbox',row.id);for(const id of row.value.pendingIds||[])this.store.remove('pending',id);});
    }
  }
  async sync(payload){
    await this.initialize();if(!this.snapshot)await this.refresh();requireThat(Array.isArray(payload.operations)&&payload.operations.length<=300,'변경 요청을 확인해 주세요.');const publicJob=await this.prepare(payload.operations);this.compose(clone(this.snapshot));const result=await this.flushSafe({force:true});this.compose(clone(this.snapshot));
    const delivery={};for(const op of payload.operations)if(['mail.send','mail.retry'].includes(op.type)){const id=op.id||op.value.id,m=this.store.get('mail-history',id);delivery[id]=m?.sendError?'failed':m?.restoreReview?'review':m?.pendingDelivery?'queued':'sent';}
    const outcome={ok:true,queued:!!result.deferred,delivery,failed:Object.values(delivery).filter(s=>s==='failed').length,deliveryFailures:this.store.all('relay-failed').length};
    if(publicJob){
      const rejection=this.store.get('relay-failed','public-outbox:'+publicJob)?.error;
      if(rejection)return {...outcome,ok:false,publicSave:'rejected',error:rejection.message,status:rejection.status};
      outcome.publicSave=this.store.get('public-outbox',publicJob)?'pending':'saved';
    }
    return outcome;
  }
  withPending(){return this.snapshot?this.compose(clone(this.snapshot)):null;}
  async attachment(p){
    if(p.inline){const content=this.store.get('content','mail:'+p.mail);requireThat(content,'본문을 이 PC에서 찾을 수 없습니다.');let html=content.html||'';for(const match of [...html.matchAll(/ieum-inline:(\d+)/g)]){const r=await this.attachment({mail:p.mail,index:Number(match[1])});html=html.replaceAll(match[0],r.file.data);}return {html};}
    const key=p.mail+':'+p.index,cached=this.store.get('file',key);if(cached)return {file:cached};const mail=this.store.get('mail-history',p.mail),metadata=mail?.files.find(f=>f.index===p.index);requireThat(metadata,'첨부 파일 정보를 찾을 수 없습니다.');
    const result=metadata.relayFile?await this.api('/relay/file',metadata.relayFile):await this.api('/attachment',p),expected=metadata.sha256||this.store.get('content','mail:'+p.mail)?.attachments?.find(f=>f.index===p.index)?.sha256;
    requireThat(!expected||crypto.digest(Buffer.from(result.file.data.split(',')[1],'base64'))===expected,'첨부 파일이 발신자가 보낸 원본과 일치하지 않습니다.');const file={...metadata,...result.file};this.store.put('file',key,file);return {file};
  }
  importArchive(encrypted,password){const job=this.queue.then(()=>require('./restore-history.cjs').restore(this,encrypted,password));this.queue=job.catch(()=>{});return job;}
  exportArchive(password){const job=this.queue.then(()=>super.exportArchive(password));this.queue=job.catch(()=>{});return job;}
  exportArchiveFile(file,password){return this.queueTask(()=>require('../privacy/file-archive.cjs').save(this,file,password));}
  importArchiveFile(file,password){return this.queueTask(()=>require('../privacy/file-archive.cjs').load(this,file,password));}
  retryIncoming(){const job=this.queue.then(async()=>{this.store.transaction(()=>{for(const row of this.store.all('incoming-failed'))this.store.remove('incoming-failed',row.id);this.store.remove('state','relay-pull-after');});return this.refresh();});this.queue=job.catch(()=>{});return job;}
  async security(){const result=await super.security();return {...result,pending:this.store.all('relay-outbox').length+this.store.all('relay-ack').length+this.store.all('public-outbox').length,failed:this.store.all('relay-failed').length,incomingFailed:this.store.all('incoming-failed').length,restoreReview:this.store.all('restore-review').length};}
  close(){this.closing=true;super.close();}
}
module.exports={PrivateClient};
