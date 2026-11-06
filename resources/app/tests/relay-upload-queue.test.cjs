'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./helpers/transfer-fixture.cjs'),io=require('../privacy/file-io.cjs'),crypto=require('../privacy/crypto.cjs');
const sync=(c,...operations)=>c.request('/sync',{operations});
const mail=(id,to,files=[],extra={})=>({type:'mail.send',value:{id,title:'업로드 대기 시험',body:'합성 시험 본문',to,cc:[],files,...extra}});
async function attachment(c){
  const bytes=io.CHUNK+17,staged=await c.stageAttachment('begin',{name:'시험자료.bin',bytes,mime:'application/octet-stream'});
  for(let offset=0;offset<bytes;offset+=io.CHUNK)await c.stageAttachment('chunk',{localFile:staged.localFile,offset,data:Buffer.alloc(Math.min(io.CHUNK,bytes-offset),37)});
  return c.stageAttachment('finish',staged);
}
// Hold real HTTPS chunk transfers, independent of machine or network speed.
function holdUploads(c){
  const raw=c.raw;let release;const gate=new Promise(resolve=>{release=resolve;});
  c.raw=async(route,p)=>{if(route==='/relay/blob/chunk')await gate;return raw(route,p);};
  return {release,async finish(){release();await Promise.all([...(c.uploadJobs?.values()||[])].map(job=>job.promise));}};
}
async function drain(c){
  for(let i=0;i<30;i++){
    await c.request('/bootstrap');
    if(!c.store.all('relay-outbox').length)return;
    await Promise.all([...(c.uploadJobs?.values()||[])].map(job=>job.promise));
  }
  throw Error('outgoing queue did not drain');
}

test('text, chat and delivery/read receipts pass a held upload; files stay queued and arrive once',()=>fixture(async({a,b,users,send})=>{
  const f=await attachment(a),held=holdUploads(a);
  try{
    const result=await sync(a,mail('upload-first',[users.b.id],[f]));
    assert.equal(result.delivery['upload-first'],'queued');assert.equal(result.queued,true);
    const packet=a.store.get('mail-history','upload-first').relayPacket;
    assert.equal(a.store.get('relay-outbox',packet).wire,undefined,'an unfinished upload must not reserve a sequence');
    await sync(a,mail('upload-second',[users.b.id],[f]));
    assert.equal(a.uploadJobs.size,1,'later attachments must not start unbounded parallel uploads');
    assert.equal((await send(a,'text-behind-files',[users.b.id])).delivery['text-behind-files'],'sent');
    await sync(a,{type:'room.create',value:{id:'upload-chat',name:'시험 대화',members:[users.b.id]}},{type:'message.send',room:'upload-chat',value:{id:'chat-behind-files',text:'파일 전송 중 대화',reply:''}});
    await send(b,'incoming-during-upload',[users.a.id]);
    assert.equal((await a.request('/bootstrap')).outgoingPending,true);
    await sync(a,{type:'mail.update',id:'incoming-during-upload',read:true});
    const before=(await b.request('/bootstrap')).data;
    assert.ok(before.mails.some(m=>m.id==='text-behind-files'));
    assert.ok(!before.mails.some(m=>m.id==='upload-first'||m.id==='upload-second'));
    assert.equal(before.rooms.find(r=>r.id==='upload-chat').messages.filter(m=>m.id==='chat-behind-files').length,1);
    const receipt=before.mails.find(m=>m.id==='incoming-during-upload');
    assert.ok(receipt.storedReceipts[users.a.id]);assert.deepEqual(receipt.receipts,['read']);
    assert.equal(a.store.get('mail-history','upload-first').pendingDelivery,true);
    held.release();await drain(a);await b.request('/bootstrap');await a.request('/bootstrap');
    for(const id of ['upload-first','upload-second','text-behind-files']){
      assert.equal(b.store.all('mail-history').filter(r=>r.id===id).length,1);
      assert.equal(a.store.get('mail-history',id).pendingDelivery,false);
      assert.ok(!a.store.get('mail-history',id).restoreReview);
    }
    const downloaded=(await b.request('/attachment',{mail:'upload-first',index:0})).file;
    assert.equal(await io.hashFile(b.files.path(downloaded.localFile)),f.sha256);
    assert.ok(a.store.get('relay-sent',packet).sequence>a.store.get('relay-sent',a.store.get('mail-history','text-behind-files').relayPacket).sequence);
  }finally{await held.finish();}
}));

for(const accepted of [false,true])test(`a signed text retry precedes an older upload after restart (server accepted: ${accepted})`,()=>fixture(async({a,b,users,send,make,restart})=>{
  const f=await attachment(a),held=holdUploads(a);
  try{
    await sync(a,mail('older-upload',[users.b.id],[f]));
    const raw=a.raw;let original;
    a.raw=async(route,p)=>{
      if(route==='/relay/send'){
        original=p;if(accepted)await raw(route,p);
        throw Error('fixture connection lost before send confirmation');
      }
      return raw(route,p);
    };
    assert.equal((await send(a,'uncertain-text',[users.b.id])).delivery['uncertain-text'],'queued');
    assert.ok(original,'text must be attempted while the upload is held');
    // Let the older upload finish before retrying the text. Row insertion order
    // alone would then assign the upload the text's sequence or overtake it.
    await held.finish();await b.request('/bootstrap');a.close();await restart();
    const reopened=make('a'),retryRaw=reopened.raw,sent=[];
    reopened.raw=async(route,p)=>{if(route==='/relay/send')sent.push(p);return retryRaw(route,p);};
    await drain(reopened);assert.deepEqual(sent[0],original,'retry keeps the exact signed packet');
    const inbox=(await b.request('/bootstrap')).data.mails;
    for(const id of ['uncertain-text','older-upload']){
      assert.equal(inbox.filter(m=>m.id===id).length,1);
      const m=reopened.store.get('mail-history',id);assert.equal(m.pendingDelivery,false);assert.ok(!m.restoreReview);assert.ok(!m.sendError);
    }
    assert.ok(sent[1].context.sequence>sent[0].context.sequence);
    assert.equal((await b.request('/attachment',{mail:'older-upload',index:0})).file.sha256,f.sha256);
  }finally{await held.finish();}
}));

test('recalling an unsigned upload never delivers it after the transfer resumes',()=>fixture(async({a,b,users,send})=>{
  const f=await attachment(a),held=holdUploads(a);
  try{
    await sync(a,mail('cancel-upload',[users.b.id],[f]));
    const jobs=[...a.uploadJobs.values()];
    await sync(a,{type:'mail.update',id:'cancel-upload',recall:true});
    assert.equal((await send(a,'after-cancel',[users.b.id])).delivery['after-cancel'],'sent');
    held.release();await Promise.all(jobs.map(job=>job.promise));await drain(a);
    const inbox=(await b.request('/bootstrap')).data.mails;
    assert.ok(!inbox.some(m=>m.id==='cancel-upload'));assert.ok(inbox.some(m=>m.id==='after-cancel'));
    assert.deepEqual(a.store.get('mail-history','cancel-upload').receipts,['recalled']);
    assert.equal(a.store.all('relay-failed').length,0);
  }finally{await held.finish();}
}));

for(const deleted of [false,true])test(`calendar changes keep their order behind an upload (deleted: ${deleted})`,()=>fixture(async({a,b,users,send})=>{
  const event={id:'upload-calendar',title:'원래 일정',date:'2026-11-10',start:'09:00',end:'10:00',type:'personal',note:'',place:''};
  await sync(a,{type:'event.upsert',value:event},mail('calendar-original',[users.b.id],[],{calendarEvent:event.id}));await b.request('/bootstrap');
  const f=await attachment(a),held=holdUploads(a);
  try{
    await sync(a,mail('calendar-upload',[users.b.id],[f],{calendarEvent:event.id}));
    const updated={...event,title:'수정된 일정',start:'11:00',end:'12:00'};
    await sync(a,{type:'event.upsert',value:updated},mail('calendar-later-share',[users.b.id],[],{calendarEvent:event.id}));
    if(deleted)await sync(a,{type:'event.delete',id:event.id});
    assert.equal((await send(a,'independent-text',[users.b.id])).delivery['independent-text'],'sent');
    const before=(await b.request('/bootstrap')).data;
    assert.equal(before.events.find(e=>e.id===event.id).title,event.title);
    assert.ok(before.mails.some(m=>m.id==='independent-text'));
    assert.ok(!before.mails.some(m=>m.id==='calendar-later-share'));
    held.release();await drain(a);
    const after=(await b.request('/bootstrap')).data;
    assert.equal(after.mails.filter(m=>m.id==='calendar-upload').length,1);
    assert.equal(after.mails.filter(m=>m.id==='calendar-later-share').length,1);
    if(deleted)assert.ok(!after.events.some(e=>e.id===event.id));
    else{const e=after.events.find(e=>e.id===event.id);assert.equal(e.title,updated.title);assert.equal(e.start,updated.start);}
    assert.equal(b.store.all('relay-deferred').length,0);assert.equal(b.store.all('incoming-failed').length,0);
  }finally{await held.finish();}
}));

test('a signed upload left by an older client keeps its sequence and blocks overtaking',()=>fixture(async({a,b,users,send,call})=>{
  const f=await attachment(a),held=holdUploads(a);
  try{
    await sync(a,mail('legacy-signed-upload',[users.b.id],[f]));
    const row=a.store.all('relay-outbox')[0],p=row.value;
    const context={...crypto.context('relay',row.id,users.a.id,p.targets),sequence:(await call('a','/relay/state')).sequence+1,releaseAt:p.releaseAt,files:p.files.map(f=>f.id)};
    p.wire={context,sealed:await crypto.encrypt(p.action,context,a.identity,await a.keys())};a.store.put('relay-outbox',row.id,p);
    assert.equal((await send(a,'behind-legacy-upload',[users.b.id])).delivery['behind-legacy-upload'],'queued');
    assert.deepEqual(a.store.get('relay-outbox',row.id).wire,p.wire);
    held.release();await drain(a);
    const inbox=(await b.request('/bootstrap')).data.mails;
    for(const id of ['legacy-signed-upload','behind-legacy-upload'])assert.equal(inbox.filter(m=>m.id===id).length,1);
    assert.equal(a.store.get('relay-sent',row.id).sequence,context.sequence);
  }finally{await held.finish();}
}));
