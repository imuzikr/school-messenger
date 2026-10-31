'use strict';
const crypto=require('../privacy/crypto.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
// A backup is a copy of history, not a command to repeat old network operations.
// Server transport rows may already have been deleted after successful delivery.
const transport=new Set(['incoming-failed','relay-outbox','relay-cancel','relay-failed','public-outbox','outbox','pending','ack','relay-ack','relay-send-ack','migration-ack','localize']);
async function restore(c,encrypted,password){
  const value=await require('../privacy/archive.cjs').open(encrypted,password);
  return restoreValue(c,value);
}
async function restoreValue(c,value){
  if(value.version!==1||value.server!==c.server||value.user!==c.user.id)throw new Error('같은 학교 서버와 계정의 보관 파일만 가져올 수 있습니다.');
  const rows=value.records;if(!Array.isArray(rows)||rows.some(r=>typeof r.kind!=='string'||typeof r.id!=='string'||!Object.hasOwn(r,'value')))throw new Error('PC 보관 파일 형식이 올바르지 않습니다.');
  const identity=rows.find(r=>r.kind==='identity'&&r.id==='current')?.value;if(!identity)throw new Error('보관 파일에 암호화 키가 없습니다.');
  const directory=await c.api('/privacy/keys'),registered=directory.keys?.[c.user.id];
  if(registered&&await crypto.fingerprint(registered)!==await crypto.fingerprint(crypto.publicIdentity(identity)))throw new Error('보관 파일의 암호화 키가 등록된 계정과 다릅니다.');
  // Validate registration before mutating any local history.
  await c.api('/privacy/register',crypto.publicIdentity(identity));
  const current=new Set(c.store.export().map(r=>r.kind+'\0'+r.id)),messages=new Set(c.store.all('room-history').flatMap(r=>(r.value.messages||[]).map(m=>r.id+'\0'+m.id)));let restored=0,review=0;
  c.store.transaction(()=>{
    for(const r of rows){if(transport.has(r.kind)||r.kind==='state'&&['relay-retry-at','relay-pull-after'].includes(r.id))continue;
      if(r.kind==='room-history'&&current.has(r.kind+'\0'+r.id)){
        const room=c.store.get(r.kind,r.id),missing=(r.value.messages||[]).filter(m=>!messages.has(r.id+'\0'+m.id));
        if(missing.length){room.messages=[...missing,...room.messages].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)||((a.date||'')+(a.time||'')).localeCompare((b.date||'')+(b.time||'')));c.saveRoom(room);restored+=missing.length;}continue;
      }
      if(r.kind==='identity'&&r.id==='current'||!current.has(r.kind+'\0'+r.id)){c.store.put(r.kind,r.id,r.value);restored++;}
    }
    function hold(action,key,source){
      const id=action?.type==='mail.create'||action?.type==='chat.message'?action.value?.id:action?.mail;
      if(action?.type==='mail.create'&&current.has('mail-history\0'+id))return;
      if(action?.type==='chat.message'&&messages.has(action.room?.id+'\0'+id))return;
      if(c.store.get('restore-review',key))return;
      const notice={message:'백업에서 가져온 발송 대기입니다. 발송 여부를 확인한 뒤 다시 작성해 주세요.',at:Date.now()};
      if(action?.type==='mail.create'){
        const v=action.value;let m=c.store.get('mail-history',id);
        if(!m){const fields=c.store.get('content','mail:'+id)||{};m={...v,...fields,id,from:'me',folder:'sent',previousFolder:'sent',unread:false,receipts:(v.to||[]).map(()=> 'unread'),files:(v.files||[]).map((f,index)=>{if(f.data&&!c.store.get('file',id+':'+index))c.store.put('file',id+':'+index,f);const {data,...meta}=f;return {...meta,index,stored:true,sourceMail:id};})};}
        c.saveMail({...m,pendingDelivery:false,sendError:null,restoreReview:notice});
      }else if(action?.type==='chat.message'){
        const room=c.store.get('room-history',action.room?.id),m=room?.messages.find(m=>m.id===id);if(m){Object.assign(m,{pendingDelivery:false,sendError:null,restoreReview:notice});c.saveRoom(room);}
      }else if(action?.type==='work.response'){
        const m=c.store.get('mail-history',id),r=m?.workResponses?.[c.user.id];if(r&&!current.has('mail-history\0'+id)){Object.assign(r,{pendingDelivery:false,sendError:null,restoreReview:notice});c.saveMail(m);}
      }
      c.store.put('restore-review',key,{action,source,at:Date.now()});review++;
    }
    for(const row of rows){
      if(!transport.has(row.kind)||current.has(row.kind+'\0'+row.id)||c.store.get('relay-sent',row.id))continue;
      if(row.kind==='relay-outbox'||row.kind==='relay-failed'){
        const action=row.value.action,marker=row.kind+':'+row.id;
        // A stored/read receipt describes a durable fact, not a new message.
        // Give it a fresh transport ID; replaying the archived wire is unsafe.
        if(['receipt.delivery','receipt.read'].includes(action?.type)){
          const m=c.store.get('mail-history',action.mail);
          if(m&&m.from!=='me'&&!c.store.get('restore-notice',marker)&&!current.has('mail-history\0'+m.id)){
            c.stage({...action},[m.from]);c.store.put('restore-notice',marker,true);
          }
        }else hold(action,marker,row.kind);
      }
      if(row.kind==='outbox')for(const [i,op] of (row.value.operations||[]).entries()){
        if(op.type==='mail.send')hold({type:'mail.create',value:op.value},row.kind+':'+row.id+':'+i,row.kind);
        else if(op.type==='message.send')hold({type:'chat.message',room:{id:op.room},value:op.value},row.kind+':'+row.id+':'+i,row.kind);
        else hold({type:op.type,mail:op.id,value:op.value},row.kind+':'+row.id+':'+i,row.kind);
      }
      if(row.kind==='public-outbox'||row.kind==='relay-cancel')hold({type:row.kind,value:row.value},row.kind+':'+row.id,row.kind);
    }
  });
  c.identity=identity;c.initialized=true;c.snapshot=c.store.get('state','snapshot');if(c.snapshot)c.compose(clone(c.snapshot));
  return {ok:true,restored,reviewRequired:review,preservedExisting:true};
}
module.exports={restore,restoreValue};
