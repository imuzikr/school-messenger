'use strict';
const {randomUUID}=require('node:crypto');
const crypto=require('../privacy/crypto.cjs');
const {LocalStore}=require('../privacy/local-store.cjs');
const {LocalFiles}=require('../privacy/local-files.cjs');
const path=require('node:path');
const deadlines=require('../js/message-deadlines.js');
const workTools=require('../js/work-tools.js');
const announcements=require('../js/announcements.js');
const homeroom=require('../js/homeroom.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const contentId=(kind,id)=>kind+':'+id;
class PrivateClient{
  constructor({root,server,user,request,protector,onTransfer=()=>{}}){this.user=user;this.raw=request;this.store=new LocalStore(root,server,user.id,protector);this.files=new LocalFiles(path.join(root,this.store.scope+'-files'),this.store);this.onTransfer=onTransfer;this.server=server;this.queue=Promise.resolve();this.snapshot=this.store.get('state','snapshot');this.initialized=false;}
  async initialize(){
    if(this.initialized)return;
    if(this.initializing)return this.initializing;
    // Login, a second window and the security panel can initialize together.
    // They must share the same key creation/registration operation.
    const attempt=(async()=>{
      this.files.cleanup();
      this.identity=this.store.get('identity','current');
      if(!this.identity){this.identity=await crypto.newIdentity();this.store.put('identity','current',this.identity);}
      const registered=await this.raw('/privacy/register',crypto.publicIdentity(this.identity));if(registered.error)throw new Error(registered.error);
      this.initialized=true;
    })();
    this.initializing=attempt;try{await attempt;}finally{if(this.initializing===attempt)this.initializing=null;}
  }
  request(route,payload){const job=this.queue.then(()=>this.handle(route,payload));this.queue=job.catch(()=>{});return job;}
  async trusted(id,keys){
    const key=keys[id];if(!key)throw Object.assign(new Error('상대방이 아직 암호화 키를 등록하지 않았습니다. 먼저 한 번 로그인해야 합니다.'),{code:'PEER_KEY_MISSING'});
    const fp=await crypto.fingerprint(key),old=this.store.get('trust',id);
    if(old&&old.fingerprint!==fp)throw Object.assign(new Error('상대방의 보안 번호가 변경되어 송수신을 중단했습니다. 상대방과 보안 번호를 확인해 주세요.'),{code:'PEER_KEY_CHANGED'});
    if(!old)this.store.put('trust',id,{fingerprint:fp,verified:false});return key;
  }
  async flush(){
    for(const pending of this.store.all('outbox')){
      const result=await this.raw('/sync',{operations:pending.value.operations});
      if(result.error){if(result.status>=400&&result.status<500){this.store.remove('outbox',pending.id);for(const id of pending.value.pendingIds||[])this.store.remove('pending',id);}throw new Error(result.error);}
      this.store.transaction(()=>{this.store.remove('outbox',pending.id);for(const id of pending.value.pendingIds||[])this.store.remove('pending',id);});
    }
  }
  async acknowledge(){
    const rows=this.store.all('ack');
    for(let i=0;i<rows.length;i+=300){const batch=rows.slice(i,i+300),result=await this.raw('/privacy/ack',{entries:batch.map(r=>r.value)});if(result.error)throw new Error(result.error);this.store.transaction(()=>batch.forEach(r=>this.store.remove('ack',r.id)));}
  }
  privateFields(kind,value){
    const field=(name,max)=>{const v=value[name]??'';if(typeof v!=='string'||v.length>max)throw new Error('메시지 내용 형식 또는 길이가 올바르지 않습니다.');return v;};
    return kind==='response'?{note:field('note',500)}:kind==='mail'?{title:field('title',150),body:field('body',100000),html:field('html',4400000),...(value.attachments?{attachments:value.attachments}:{}),...(value.calendarDetails?{calendarDetails:value.calendarDetails}:{})}:{text:field('text',5000),reply:field('reply',5000)};
  }
  async receive(kind,value,keys,room=''){
    const sender=kind==='mail'?value.from:value.sender,owner=sender==='me'?this.user.id:sender,id=contentId(kind,value.id);
    let saved=this.store.get('content',id);
    if(value.legacyContent){
      saved=this.privateFields(kind,value.legacyContent);
      this.store.transaction(()=>{this.store.put('content',id,saved);this.store.put('ack',id,{kind,id:value.id,digest:value.contentDigest});});
    }else if(value.sealed){
      const expected=value.privateContext;
      if(expected?.kind!==kind||expected.id!==value.id||expected.sender!==owner||expected.room!==room)throw new Error('메시지의 원본 식별 정보가 일치하지 않습니다.');
      const senderKey=await this.trusted(owner,keys),plain=await crypto.decrypt(value.sealed,expected,this.identity,senderKey,this.user.id);
      const fields=this.privateFields(kind,plain);
      // This FULL-synchronous transaction commits content and a retryable ACK
      // together. No server receipt can be sent before durable local storage.
      this.store.transaction(()=>{this.store.put('content',id,fields);this.store.put('ack',id,{kind,id:value.id,digest:value.contentDigest});});saved=fields;
    }else if(!value.privateMessage){saved=this.privateFields(kind,value);this.store.put('content',id,saved);}
    const result={...value,...(saved||{})};delete result.sealed;delete result.legacyContent;delete result.privateContext;delete result.contentDigest;
    if(value.privateMessage&&!saved)Object.assign(result,kind==='mail'?{title:value.contentPending?'메시지 수신 중':'이 PC에 보관되지 않은 메시지',body:value.contentPending?'이전 메시지를 차례로 저장하고 있습니다.':'기존 PC의 보관 파일을 가져와 주세요.',html:''}:{text:value.contentPending?'대화 수신 중입니다.':'이 PC에 보관되지 않은 대화입니다. 기존 PC의 보관 파일을 가져와 주세요.'});
    if(kind==='mail'){
      result.files=(result.files||[]).filter(f=>!f.inline);
      if(/ieum-inline:\d+/.test(result.html||'')){result.inlineStored=true;result.html=result.html.replace(/ieum-inline:\d+/g,'');}
      if(result.scheduled&&new Date(result.scheduled).getTime()<=Date.now())result.scheduled='';
    }
    return result;
  }
  async refresh(page=0){
    await this.initialize();await this.flush();
    const result=await this.raw('/bootstrap?privacy=1');if(result.error)return result;
    const keys=result.privacy?.keys;if(!keys)throw new Error('서버를 메시지 암호화 지원 버전으로 업데이트해 주세요.');
    const data=result.data;
    this.store.transaction(()=>{for(const item of result.privacy.localRecords||[]){if(!this.store.get('local-'+item.kind,item.id))this.store.put('local-'+item.kind,item.id,{...item.value,id:item.id});this.store.put('localize',item.id,{kind:item.kind,id:item.id,hash:item.hash});}});
    for(let i=0;i<data.mails.length;i++){
      const mail=await this.receive('mail',data.mails[i],keys);
      for(const [sender,response] of Object.entries(mail.workResponses||{}))if(response.responseId){const decrypted=await this.receive('response',{...response,id:response.responseId,sender},keys,mail.id);mail.workResponses[sender]={done:response.done,note:decrypted.note||'',updatedAt:response.updatedAt,responseId:response.responseId};}
      const link=this.store.get('mail-link',mail.id);if(link)mail.eventId=link.eventId;data.mails[i]=mail;
    }
    for(const room of data.rooms)for(let i=0;i<room.messages.length;i++)room.messages[i]=await this.receive('message',room.messages[i],keys,room.id);
    // The server's remaining routing rows are not the user's history database.
    // Keep complete local records even if a server restore removes those rows.
    const activeMails=new Set(data.mails.map(m=>m.id)),recalled=new Set([...this.store.all('recalled').map(r=>r.id),...(result.privacy.recalled||[])]);
    this.store.transaction(()=>{
      for(const id of recalled)this.store.put('recalled',id,true);
      for(const mail of data.mails)this.store.put('mail-history',mail.id,mail);
      for(const room of data.rooms){const old=this.store.get('room-history',room.id),messages=new Map((old?.messages||[]).map(m=>[m.id,m]));for(const m of room.messages)messages.set(m.id,m);room.messages=[...messages.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));this.store.put('room-history',room.id,room);}
    });
    for(const {id,value} of this.store.all('mail-history'))if(!activeMails.has(id)&&!recalled.has(id))data.mails.push({...value,localOnly:true,canRecall:false});
    for(const receipt of data.readReceipts||[])receipt.subject=this.store.get('content',contentId('mail',receipt.mail))?.title||'메시지';
    for(const kind of ['events','notes','deadlines','tasks','shortcuts']){
      const local=this.store.all('local-'+kind),map=new Map(data[kind].map(v=>[v.id,v]));
      for(const {id,value} of local){if(value.deleted)map.delete(id);else{const remote=map.get(id);map.set(id,kind==='events'&&remote&&!value.source&&value.type!=='personal'?{...remote,title:value.title,note:value.note}:{...remote,...value});}}data[kind]=[...map.values()];
    }
    for(const mail of data.mails)if(mail.calendarDetails){const event=data.events.find(e=>e.id===mail.calendarDetails.id);if(event){event.title=mail.calendarDetails.title;event.note=mail.calendarDetails.note;}}
    for(const event of data.events)if(event.noticeMail){const mail=data.mails.find(m=>m.id===event.noticeMail);if(mail)event.note=mail.body;}
    data.autoDeadlineSources=this.store.get('state','deadline-ledger')||{};
    for(const kind of ['events','deadlines'])for(const entry of data[kind])if(entry.source){
      const sourceKind=entry.source.kind+(entry.rule==='event'?'-event':entry.rule==='start-event'?'-start-event':'');
      for(const item of result.privacy.localLedger||[])if(item.item_id===entry.id)data.autoDeadlineSources[item.source_key]=entry.id;
    }
    deadlines.applyDemo(data,this.user.id);
    this.store.transaction(()=>{
      this.store.put('state','deadline-ledger',data.autoDeadlineSources);
      for(const kind of ['events','deadlines'])for(const entry of data[kind])if(entry.source)this.store.put('local-'+kind,entry.id,entry);
      this.store.put('state','snapshot',result);
    });
    this.snapshot=result;
    try{await this.acknowledge();const rows=this.store.all('localize');for(let i=0;i<rows.length;i+=300){const batch=rows.slice(i,i+300),r=await this.raw('/privacy/localize',{entries:batch.map(x=>x.value)});if(r.error)throw new Error(r.error);this.store.transaction(()=>batch.forEach(x=>this.store.remove('localize',x.id)));}}catch(e){result.receiptPending=true;}
    if(result.privacy.more&&!result.receiptPending&&page<25)return this.refresh(page+1);
    return result;
  }
  async prepare(operations){
    if(!this.snapshot)await this.refresh();
    const data=this.snapshot.data,dir=await this.raw('/privacy/keys');if(dir.error)throw new Error(dir.error);const keys=dir.keys;
    const rooms=new Map(data.rooms.map(r=>[r.id,[this.user.id,...r.members]]));
    const mails=new Map(data.mails.map(m=>[m.id,m]));
    const privateEvents=new Map(operations.filter(o=>o.type==='event.upsert').map(o=>[o.value.id,o.value]));
    for(const op of operations)if(op.type==='room.create')rooms.set(op.value.id,[this.user.id,...op.value.members]);
    const outgoing=[];
    for(const rawOp of operations){const op=clone(rawOp),v=op.value||{},id=op.id||v.id;
      if(['mail.send','message.send'].includes(op.type)){
        const kind=op.type==='mail.send'?'mail':'message';let targets;
        if(this.store.get('content',contentId(kind,id)))throw new Error('메시지 식별자가 중복되었습니다. 새 메시지로 작성해 주세요.');
        if(kind==='message')targets=rooms.get(op.room)||[];
        else{
          targets=[...(v.to||[]),...(v.cc||[]),...(v.notice?.rows||[]).flatMap(r=>[r.teacher,r.originalTeacher,r.homeroomTeacher].filter(Boolean))];
          if(v.announcement)targets=announcements.recipients(data.people,v.announcement.audience);
          if(v.scheduleAnnouncement)targets=data.people.filter(p=>p.id!==this.user.id).map(p=>p.id);
          if(v.workReminderOf){const original=mails.get(v.workReminderOf);targets=targets.filter(t=>!original?.workResponses?.[t]?.done&&(!original?.workDelivery||['read','unread'].includes(original.workDelivery[t])));}
        }
        const ctx=crypto.context(kind,id,this.user.id,targets,op.room||'');for(const target of ctx.targets)await this.trusted(target,keys);
        const fields=this.privateFields(kind,v);
        if(kind==='message'&&(fields.text.length>5000||fields.reply.length>5000||!fields.text.trim()))throw new Error('대화는 5,000자까지 입력하세요.');
        if(kind==='mail'){
          if(fields.title.length>150||fields.body.length>100000||!fields.body.trim())throw new Error('메시지 제목 또는 본문 길이를 확인해 주세요.');
          v.files||=[];
          for(let i=0;i<v.files.length;i++)if(v.files[i].data)this.store.put('file',id+':'+i,v.files[i]);
          fields.html=fields.html.replace(/data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}/g,image=>{const index=v.files.length;v.files.push({name:'본문 이미지 '+(index+1),data:image,inline:true});this.store.put('file',id+':'+index,{name:'본문 이미지',data:image});return 'ieum-inline:'+index;});
          if(fields.html.length>400000)throw new Error('본문 서식이 너무 큽니다. 내용을 나누어 보내 주세요.');
          fields.attachments=v.files.map((f,index)=>({index,name:f.name,sha256:crypto.digest(Buffer.from((f.data||'').split(',')[1]||'','base64'))}));
          const calendar=privateEvents.get(v.calendarEvent);if(calendar)fields.calendarDetails={id:calendar.id,title:calendar.title,note:calendar.note};
        }
        const sealed=await crypto.encrypt(fields,ctx,this.identity,keys);
        this.store.put('content',contentId(kind,id),fields);
        for(const field of ['title','body','html','text','reply'])delete v[field];
        v.privacyTargets=ctx.targets;v.sealed=sealed;op.value=v;outgoing.push(op);continue;
      }
      if(op.type==='mail.work.respond'){
        const original=mails.get(id);if(!original)throw new Error('완료 요청 원본을 찾을 수 없습니다.');
        if(original.localOnly)throw new Error('서버의 요청 정보가 없어 완료 상태를 전달할 수 없습니다. 새 메시지로 답장해 주세요.');
        const sender=original.from==='me'?this.user.id:original.from,responseId='response-'+randomUUID(),ctx=crypto.context('response',responseId,this.user.id,[sender],id);
        for(const target of ctx.targets)await this.trusted(target,keys);
        if(typeof v.note!=='string'||v.note.length>500)throw new Error('응답 메모는 500자까지 입력하세요.');
        this.store.put('content',contentId('response',responseId),{note:v.note});
        op.value={...v,note:'',responseId,privacyTargets:ctx.targets,sealed:await crypto.encrypt({note:v.note},ctx,this.identity,keys)};outgoing.push(op);continue;
      }
      if(op.type==='mail.update'&&mails.get(id)?.localOnly){
        if(op.recall)throw new Error('PC에만 남은 메시지는 서버에서 회수할 수 없습니다.');
        const old=mails.get(id);this.store.put('mail-history',id,{...old,folder:op.folder||old.folder,important:!!op.important,unread:op.read?false:old.unread});continue;
      }
      if(op.type==='item.upsert'){this.store.put('local-'+op.kind,id,v);continue;}
      if(op.type==='item.delete'){for(const kind of ['notes','deadlines','tasks','shortcuts'])this.store.put('local-'+kind,id,{deleted:true});continue;}
      if(op.type==='homeroom.pin'){
        const mail=mails.get(v.mail),itemId='local-homeroom-'+v.mail;if(!mail)throw new Error('담임 메시지를 찾을 수 없습니다.');
        this.store.put('local-deadlines',itemId,v.pinned?{id:itemId,...homeroom.pinnedItem(mail,v.date||data.today)}:{deleted:true});continue;
      }
      const oldEvent=data.events.find(e=>e.id===id),localEvent=v.source||oldEvent?.source||v.type==='personal'||oldEvent?.type==='personal';
      if(op.type==='event.upsert'&&localEvent){this.store.put('local-events',id,v);continue;}
      if(op.type==='event.delete'&&localEvent){this.store.put('local-events',id,{deleted:true});continue;}
      if(op.type==='event.reschedule'&&localEvent){this.store.put('local-events',id,{...oldEvent,...v});continue;}
      if(op.type==='deadline.reschedule'){const old=data.deadlines.find(d=>d.id===id);this.store.put('local-deadlines',id,{...old,...v});continue;}
      if(op.type==='event.upsert'&&(v.noticeMail||this.store.get('local-events',id)||operations.some(o=>o.type==='mail.send'&&o.value.calendarEvent===id))){this.store.put('local-events',id,v);op.value={...v,title:v.noticeMail?'수업 안내':'공유 일정',note:''};}
      // Auto-extracted links exist only on this PC, never send their contents or IDs.
      if(op.type==='mail.update'&&op.eventId&&(op.eventId.startsWith('auto-')||op.eventId.startsWith('local-'))){this.store.put('mail-link',id,{eventId:op.eventId});delete op.eventId;}
      outgoing.push(op);
    }
    return outgoing;
  }
  async sync(payload){
    await this.initialize();const operations=await this.prepare(payload.operations||[]);if(!operations.length)return {ok:true};
    const id=randomUUID(),pendingIds=[];
    this.store.transaction(()=>{
      for(const op of payload.operations||[])if(['mail.send','message.send'].includes(op.type)){const key=contentId(op.type==='mail.send'?'mail':'message',op.value.id);pendingIds.push(key);this.store.put('pending',key,{kind:op.type==='mail.send'?'mail':'message',room:op.room,value:op.value});}
      this.store.put('outbox',id,{operations,createdAt:Date.now(),pendingIds});
    });
    try{await this.flush();return {ok:true};}catch(e){if(/연결|connection|network|ECONN|timeout/i.test(e.message)){this.withPending();return {ok:true,queued:true};}throw e;}
  }
  withPending(){
    if(!this.snapshot)return null;
    const result=clone(this.snapshot);
    for(const {value:p} of this.store.all('pending')){
      const target=p.kind==='mail'?result.data.mails:result.data.rooms.find(r=>r.id===p.room)?.messages;if(!target)continue;
      if(!target.some(v=>v.id===p.value.id))target.push({...p.value,pendingDelivery:true});
    }
    this.store.put('state','snapshot',result);this.snapshot=result;return result;
  }
  async attachment(p){
    if(p.inline){const content=this.store.get('content',contentId('mail',p.mail));if(!content)return this.raw('/attachment',p);let html=content.html||'';
      for(const match of [...html.matchAll(/ieum-inline:(\d+)/g)]){const result=await this.attachment({mail:p.mail,index:Number(match[1])});if(result.error)throw new Error(result.error);html=html.replaceAll(match[0],result.file.data);}return {html};}
    const id=p.mail+':'+p.index,cached=this.store.get('file',id);if(cached)return {file:cached};
    const result=await this.raw('/attachment',p);if(!result.error){const expected=this.store.get('content',contentId('mail',p.mail))?.attachments?.find(f=>f.index===p.index);if(expected&&crypto.digest(Buffer.from(result.file.data.split(',')[1],'base64'))!==expected.sha256)throw new Error('첨부 파일이 발신자가 보낸 원본과 일치하지 않습니다.');this.store.put('file',id,result.file);}return result;
  }
  async handle(route,payload){
    if(route==='/bootstrap'){
      try{return await this.refresh();}catch(e){if(this.snapshot&&/연결|connection|network|ECONN|timeout/i.test(e.message))return {...this.withPending(),offline:true};throw e;}
    }
    if(route==='/sync')return this.sync(payload);
    if(route==='/search'){const snapshot=await this.handle('/bootstrap');if(snapshot.error)return snapshot;const rooms=new Map(this.store.all('room-history').map(r=>[r.id,r.value]));for(const r of snapshot.data.rooms)rooms.set(r.id,r);return workTools.search({...snapshot.data,rooms:[...rooms.values()]},workTools.filters(payload),snapshot.user);}
    if(route==='/message-source'){const snapshot=await this.handle('/bootstrap');for(const room of [...snapshot.data.rooms,...this.store.all('room-history').map(r=>r.value)]){const message=room.messages.find(m=>m.id===payload.id);if(message)return {room:room.id,roomName:room.name,message};}throw new Error('이 PC에서 원본 대화를 찾을 수 없습니다.');}
    if(route==='/attachment')return this.attachment(payload);
    return this.raw(route,payload);
  }
  async security(){await this.initialize();const directory=await this.raw('/privacy/keys');return {fingerprint:await crypto.fingerprint(crypto.publicIdentity(this.identity)),people:await Promise.all(Object.entries(directory.keys||{}).map(async([id,key])=>({id,fingerprint:await crypto.fingerprint(key),verified:!!this.store.get('trust',id)?.verified}))),pending:this.store.all('outbox').length,path:this.store.path};}
  async verify(id,number){const directory=await this.raw('/privacy/keys'),key=await this.trusted(id,directory.keys||{}),fp=await crypto.fingerprint(key);if(fp!==String(number).replace(/[\s:-]/g,'').toLowerCase())throw new Error('상대방의 보안 번호가 일치하지 않습니다.');this.store.put('trust',id,{fingerprint:fp,verified:true});return {ok:true};}
  async exportArchive(password){await this.initialize();const archive=await require('../privacy/archive.cjs').seal({version:1,server:this.server,user:this.user.id,records:this.store.export()},password);if(Buffer.byteLength(archive)>256*1024*1024)throw new Error('보관 파일 한도를 초과했습니다. 내려받은 파일을 별도로 보관해 주세요.');return archive;}
  async importArchive(encrypted,password){
    const value=await require('../privacy/archive.cjs').open(encrypted,password);
    if(value.version!==1||value.server!==this.server||value.user!==this.user.id)throw new Error('같은 학교 서버와 계정의 보관 파일만 가져올 수 있습니다.');
    const identity=value.records?.find(r=>r.kind==='identity'&&r.id==='current')?.value;if(!identity)throw new Error('보관 파일에 암호화 키가 없습니다.');
    const directory=await this.raw('/privacy/keys'),registered=directory.keys?.[this.user.id];
    if(registered&&await crypto.fingerprint(registered)!==await crypto.fingerprint(crypto.publicIdentity(identity)))throw new Error('보관 파일의 암호화 키가 등록된 계정과 다릅니다.');
    this.store.import(value.records);this.identity=identity;this.initialized=false;this.snapshot=this.store.get('state','snapshot');await this.initialize();return {ok:true};
  }
  close(){this.store.close();}
}
module.exports={PrivateClient};
