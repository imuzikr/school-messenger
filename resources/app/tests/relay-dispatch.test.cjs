'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),https=require('node:https'),{DatabaseSync}=require('node:sqlite');
const fixture=require('./helpers/transfer-fixture.cjs'),crypto=require('../privacy/crypto.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('different signed packets sharing a sequence are held for review, including after restart',()=>fixture(async({a,b,send,call,sql,users,make})=>{
  const raw=a.raw;let first;
  a.raw=async(route,p)=>{if(route==='/relay/send'){first=p;throw Error('fixture connection lost');}return raw(route,p);};
  await send(a,'collision-first',[users.b.id]);a.raw=raw;
  const queued=a.store.get('relay-outbox',first.context.id),context={...first.context,id:'signed-by-second-pc'};
  const other={...queued.action,value:{...queued.action.value,id:'collision-second'}};
  const sealed=await crypto.encrypt(other,context,a.identity,await a.keys());
  assert.equal((await call('a','/relay/send',{context,sealed,requestProof:true})).status,200);
  const conflict=await call('a','/relay/send',first);
  assert.equal(conflict.status,409);assert.equal(conflict.code,'RELAY_SEQUENCE_UNCONFIRMED');
  a.close();const reopened=make('a');
  const snapshot=await reopened.request('/bootstrap'),mail=snapshot.data.mails.find(m=>m.id==='collision-first');
  assert.equal(require('../js/mail-receipts.js').delivery(mail,users.b.id),'발송 여부 확인 필요');
  assert.equal(reopened.store.get('relay-sent',first.context.id),null);
  assert.equal(reopened.store.get('relay-outbox',first.context.id),null);
  assert.equal((await send(reopened,'after-collision',[users.b.id])).delivery['after-collision'],'sent');
  const inbox=(await b.request('/bootstrap')).data.mails.map(m=>m.id);
  assert.ok(inbox.includes('collision-second')&&inbox.includes('after-collision')&&!inbox.includes('collision-first'));
  assert.equal(sql('SELECT count(*) n FROM relay_packets WHERE id=?',[first.context.id])[0].n,0);
}));
test('an exact retry is provable after final delivery, lost reply and restart; only its sender clears proof',()=>fixture(async({a,b,send,call,sql,users,restart,root,backup})=>{
  const raw=a.raw;let wire;
  a.raw=async(route,p)=>{const reply=await raw(route,p);if(route==='/relay/send'){wire=p;throw Error('fixture connection lost');}return reply;};
  await send(a,'proven-retry',[users.b.id]);a.raw=raw;
  await b.request('/bootstrap');await restart();
  assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[wire.context.id])[0].n,0);
  const digest=crypto.digest(wire.sealed),proof=crypto.digest([users.a.id,digest]);
  const retry=await call('a','/relay/send',wire);assert.equal(retry.duplicate,true);assert.equal(retry.digest,digest);
  const file=path.join(root,'proof-backup.sqlite');backup(file);const copy=new DatabaseSync(file);
  try{assert.equal(copy.prepare('SELECT COUNT(*) n FROM relay_send_proofs').get().n,0);}finally{copy.close();}
  await call('b','/relay/ack',{entries:[],confirmedSends:[digest]});
  assert.equal(sql('SELECT count(*) n FROM relay_send_proofs WHERE proof=?',[proof])[0].n,1);
  const result=await a.request('/bootstrap');
  assert.ok(!result.data.mails.find(m=>m.id==='proven-retry').restoreReview);
  assert.equal(a.store.get('relay-sent',wire.context.id).digest,digest);
  assert.equal(sql('SELECT count(*) n FROM relay_send_proofs WHERE proof=?',[proof])[0].n,0);
  assert.equal((await call('a','/relay/send',wire)).status,409);
  assert.equal((await b.request('/bootstrap')).data.mails.filter(m=>m.id==='proven-retry').length,1);
}));

test('an expired proof or an old server duplicate without a digest never certifies a send',()=>fixture(async({a,b,send,call,sql,users,advance})=>{
  const raw=a.raw;let wire;
  a.raw=async(route,p)=>{
    const result=await raw(route,p);
    if(route==='/relay/send'){wire=p;throw Error('fixture connection lost');}
    return result;
  };
  await send(a,'lost-confirmation',[users.b.id]);a.raw=raw;
  await b.request('/bootstrap');
  await advance(86400000);await call('b','/relay/pull');
  const proof=crypto.digest([users.a.id,crypto.digest(wire.sealed)]);
  assert.equal(sql('SELECT COUNT(*) n FROM relay_send_proofs WHERE proof=?',[proof])[0].n,0);
  assert.equal((await call('a','/relay/send',wire)).code,'RELAY_SEQUENCE_UNCONFIRMED');
  await a.request('/bootstrap');

  a.raw=(route,p)=>route==='/relay/send'?Promise.resolve({ok:true,duplicate:true}):raw(route,p);
  const legacy=await send(a,'unproven-legacy-response',[users.b.id]);
  assert.equal(legacy.delivery['unproven-legacy-response'],'review');
  const mail=a.store.get('mail-history','unproven-legacy-response');
  assert.ok(mail.restoreReview);assert.equal(a.store.get('relay-sent',mail.relayPacket),null);
}));

function listen(connection,token){
  return new Promise((resolve,reject)=>{
    const events=[];
    const req=https.get(new URL('/events',connection.url),{ca:connection.certificate,headers:{authorization:'Bearer '+token}},res=>{
      let buffer='';
      res.setEncoding('utf8');res.on('error',reject);
      res.on('data',chunk=>{
        buffer+=chunk;let end;
        while((end=buffer.indexOf('\n\n'))>=0){
          const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
          const data=frame.split('\n').find(line=>line.startsWith('data: '));
          if(!data)continue;
          const event=JSON.parse(data.slice(6));
          if(event.kind==='changed')events.push(event);
          if(frame.startsWith('event: ready'))resolve({events,close:()=>req.destroy()});
        }
      });
    });
    req.on('error',reject);
  });
}
test('scheduled release wakes an idle recipient exactly once, including beyond an older page cursor',()=>fixture(async({a,b,users,call,sql,clock,advance,tokens,connection})=>{
  const recipient=await listen(connection(),tokens.b),other=await listen(connection(),tokens.c);
  try{
    const due=clock()+20000,id='scheduled-while-idle';
    await a.request('/sync',{operations:[{type:'mail.send',value:{id,title:'예약 시험',body:'예약 도착',to:[users.b.id],cc:[],files:[],scheduled:new Date(due).toISOString()}}]});
    const packet=a.store.get('mail-history',id).relayPacket;
    const cursor=sql('SELECT position FROM relay_positions WHERE packet_id=?',[packet])[0].position;
    assert.equal((await call('b','/relay/pull')).packets.length,0);
    assert.equal(recipient.events.length,0);
    await advance(19999);
    assert.equal(sql('SELECT released FROM relay_packets WHERE id=?',[packet])[0].released,0);
    await advance(1);
    // Only the server scheduler runs. The online recipient makes no request until notified.
    for(let i=0;i<100&&!recipient.events.length;i++)await wait(50);
    assert.equal(recipient.events.length,1);
    const page=await call('b','/relay/pull?after='+cursor);
    assert.ok(page.packets.some(p=>p.context.id===packet));
    assert.equal(recipient.events.length,1);assert.equal(other.events.length,0);
    assert.equal((await b.request('/bootstrap')).data.mails.filter(m=>m.id===id).length,1);
  }finally{recipient.close();other.close();}
}));

test('an earlier reservation preempts the timer, cancel re-arms it, and restart recovers the rest',()=>fixture(async({a,users,clock,advance,call,sql,restart})=>{
  async function reserve(id,delay){
    const value={id,title:id,body:id,to:[users.b.id],cc:[],files:[],scheduled:new Date(clock()+delay).toISOString()};
    await a.request('/sync',{operations:[{type:'mail.send',value}]});
    return a.store.get('mail-history',id).relayPacket;
  }
  const last=await reserve('last',45000),first=await reserve('first',10000),middle=await reserve('middle',20000);
  const released=id=>sql('SELECT released FROM relay_packets WHERE id=?',[id])[0]?.released;
  assert.equal((await call('a','/relay/cancel',{id:first})).status,200);
  await advance(19999);
  assert.equal(released(first),undefined);assert.equal(released(middle),0);
  await advance(1);
  assert.equal(released(middle),1);assert.equal(released(last),0);
  await restart(40000);
  await advance(0);
  const page=await call('b','/relay/pull');
  assert.deepEqual(page.packets.map(p=>p.context.id),[middle,last]);
}));

test('expiry blocks access before the minute sweep and a slow file deletion cannot hold a scheduled delivery',t=>fixture(async({a,users,tokens,call,sql,advance,clock,root})=>{
  const fs=require('node:fs'),{randomUUID,randomBytes}=require('node:crypto');
  const id=randomUUID(),secret=randomBytes(32).toString('hex'),cap={id,secret};
  const bytes=Buffer.from('test attachment'),file=path.join(root,'server','relay-files',id+'.blob');
  const info={...cap,bytes:bytes.length,sha256:crypto.digest(bytes),mime:'text/plain'};
  const mail={id:'during-cleanup',title:'예약',body:'예약',to:[users.c.id],cc:[],files:[],scheduled:new Date(clock()+65000).toISOString()};
  await a.request('/sync',{operations:[{type:'mail.send',value:mail}]});
  const packet=a.store.get('mail-history',mail.id).relayPacket;
  assert.equal((await call('a','/relay/blob/start',info)).status,200);
  assert.equal((await call('a','/relay/blob/chunk',{...cap,offset:0,data:bytes.toString('base64')})).status,200);
  assert.equal((await call('a','/relay/blob/finish',cap)).status,200);
  sql('UPDATE relay_blobs SET expires_at=?,staged_owner=NULL,staged_until=NULL WHERE id=?',[clock()+30000,id],true);
  await advance(29999);
  assert.equal((await call('b','/relay/blob/read',{...cap,offset:0})).status,200);
  await advance(1);
  sql('UPDATE sessions SET expires=? WHERE user_id=?',[Date.now()-1,users.b.id],true);
  assert.equal((await call('b','/bootstrap')).status,401);
  assert.equal((await call('a','/relay/blob/read',{...cap,offset:0})).status,410);
  await call('c','/relay/pull');
  const session=()=>sql('SELECT 1 FROM sessions WHERE token_hash=?',[crypto.digest(tokens.b)]).length;
  await advance(29999);assert.equal(session(),1);assert.ok(fs.existsSync(file));
  const entered=Promise.withResolvers(),resume=Promise.withResolvers(),rm=fs.promises.rm;
  t.mock.method(fs.promises,'rm',async(target,options)=>{
    if(target===file){entered.resolve();await resume.promise;}
    return rm(target,options);
  });
  const sweeping=advance(1);
  try{
    await Promise.race([entered.promise,sweeping.then(()=>{throw Error('expected a pending file deletion');})]);
    await advance(5000);
    assert.equal(sql('SELECT released FROM relay_packets WHERE id=?',[packet])[0].released,1);
    assert.ok(fs.existsSync(file));
  }finally{resume.resolve();await sweeping;}
  assert.equal(session(),0);assert.equal(fs.existsSync(file),false);
  assert.equal(sql('SELECT 1 FROM relay_blobs WHERE id=?',[id]).length,0);
}));
