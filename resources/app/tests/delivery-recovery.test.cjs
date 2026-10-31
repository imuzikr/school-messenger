'use strict';
// Isolated regression fixtures; no real school accounts or message history.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const appDir=path.resolve(__dirname,'..');
const {startServer}=require(path.join(appDir,'server/index.cjs')),{PrivateClient}=require(path.join(appDir,'desktop/private-client.cjs')),crypto=require(path.join(appDir,'privacy/crypto.cjs'));
const {test}=require('node:test');
test('each public save reports its own server decision and keeps a transient change for retry',()=>fixture(async({a,users,sql})=>{
  const renderer={window:{},setTimeout,clearTimeout},errors=[];
  vm.runInNewContext(fs.readFileSync(path.join(appDir,'js/backend.js'),'utf8'),renderer);
  const backend=new renderer.window.DingdongBackend({subscribe(){},connection:async()=>({url:'https://fixture.test'}),request:(r,p)=>a.request(r,p)},{data(){},status(){},error:e=>errors.push(e)});
  const snapshot=await backend.init(),data=structuredClone(snapshot.data);
  data.classTeachers=[{className:'1학년 1반',teacher:users.b.id}];
  sql('UPDATE users SET admin=0 WHERE id=?',[users.a.id],true);
  let result;
  assert.equal(await backend.sync(data,r=>{result=r;}),false);
  assert.equal(result.publicSave,'rejected');assert.equal(result.status,403);assert.deepEqual(errors,[result.error]);
  assert.deepEqual(a.snapshot.data.classTeachers,snapshot.data.classTeachers);
  sql('UPDATE users SET admin=1 WHERE id=?',[users.a.id],true);
  assert.equal(await backend.sync(data,r=>{result=r;}),true);assert.equal(result.publicSave,'saved');
  assert.deepEqual(a.snapshot.data.classTeachers,data.classTeachers);
  const raw=a.raw;a.raw=(r,p)=>r==='/sync'?Promise.resolve({error:'temporary',status:503}):raw(r,p);
  const pending=await a.request('/sync',{operations:[{type:'classes.upsert',value:{classes:[]}}]});
  assert.equal(pending.publicSave,'pending');assert.equal(a.store.all('public-outbox').length,1);
  a.raw=raw;await a.request('/bootstrap');assert.deepEqual(a.snapshot.data.classTeachers,[]);
}));
test('schedule notices wait for acceptance and a rejected schedule sends no announcement',()=>fixture(async({a,b,users,sql})=>{
  const date='2030-04-15',periods=a.snapshot.data.defaultPeriods,schedule={type:'schedule.upsert',value:{date,periods,title:'시험 일과표'}};
  const submit=id=>a.request('/sync',{operations:[schedule,{type:'mail.send',value:{id,body:'학교 일과표 안내',title:'시험 일과표',scheduleAnnouncement:{date,scope:'temporary'}}}]});
  const raw=a.raw;a.raw=(r,p)=>r==='/sync'?Promise.resolve({error:'temporary',status:503}):raw(r,p);
  assert.equal((await submit('held-schedule')).publicSave,'pending');
  assert.equal(sql('SELECT COUNT(*) n FROM relay_packets')[0].n,0);
  a.raw=raw;sql('UPDATE users SET admin=0 WHERE id=?',[users.a.id],true);
  await a.request('/bootstrap');assert.equal(a.store.get('mail-history','held-schedule'),null);
  assert.equal(sql('SELECT COUNT(*) n FROM relay_packets')[0].n,0);
  sql('UPDATE users SET admin=1 WHERE id=?',[users.a.id],true);
  assert.equal((await submit('accepted-schedule')).publicSave,'saved');
  assert.ok((await b.request('/bootstrap')).data.mails.find(m=>m.id==='accepted-schedule'));
}));
async function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-development-audit-')),clients=[],tokens={},users={};let server;
  try{
    server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(root,'server'),admin:{username:'audit',password:'Synthetic-audit-password-123'}});
    const call=(name,route,payload)=>new Promise((resolve,reject)=>{const body=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:body?'POST':'GET',ca:server.connection.certificate,headers:{...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),...(tokens[name]?{authorization:'Bearer '+tokens[name]}:{})}},res=>{let data='';res.on('data',s=>data+=s);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(data)}));});req.on('error',reject);if(body)req.write(body);req.end();});
    const login=await call(null,'/login',{username:'audit',password:'Synthetic-audit-password-123'});tokens.a=login.token;users.a=login.user;
    const sql=(q,values=[],write=false)=>{const db=new DatabaseSync(path.join(root,'server/dingdong.sqlite'));try{return write?db.prepare(q).run(...values):db.prepare(q).all(...values);}finally{db.close();}};
    const base=sql('SELECT * FROM users WHERE id=?',[users.a.id])[0];for(const name of ['b','c']){users[name]={id:'audit-'+name,name,username:name};tokens[name]=randomBytes(32).toString('hex');sql('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt) VALUES(?,?,?,?,?,?,?,?,?)',[users[name].id,name,name,'시험','교사','','',base.digest,base.salt],true);sql('INSERT INTO sessions VALUES(?,?,?)',[crypto.digest(tokens[name]),users[name].id,Date.now()+86400000],true);}
    const make=name=>{const c=new PrivateClient({root:path.join(root,name),server:server.connection.fingerprint,user:users[name],request:(r,p)=>call(name,r,p),protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});clients.push(c);return c;};
    const a=make('a'),b=make('b'),c=make('c');await Promise.all(clients.map(c=>c.initialize()));for(const cl of clients)await cl.request('/bootstrap');
    const send=(cl,id,to)=>cl.request('/sync',{operations:[{type:'mail.send',value:{id,title:'합성 시험 '+id,body:'개발 점검용 합성 본문 '+id,html:'',to,cc:[],files:[]}}]});
    return await fn({a,b,c,send,users,sql,call,make,root,clients});
  }finally{for(const c of clients)if(c.store.db)c.close();if(server)await server.close();const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('dingdong-development-audit-'));fs.rmSync(absolute,{recursive:true,force:true});}
}
test('permanent rejection is isolated, survives restart, and can be retried after repair',()=>fixture(async({a,b,c,send,users,sql,make})=>{
  sql('UPDATE users SET disabled=1 WHERE id=?',[users.b.id],true);
  const first=await send(a,'rejected',[users.b.id]);assert.equal(first.delivery.rejected,'failed');assert.equal(a.store.all('relay-outbox').length,0);
  assert.equal(a.store.get('mail-history','rejected').sendError.status,409);
  assert.equal((await send(a,'valid-after-rejection',[users.c.id])).delivery['valid-after-rejection'],'sent');
  assert.ok((await c.request('/bootstrap')).data.mails.find(m=>m.id==='valid-after-rejection'));
  await send(c,'incoming-while-failed',[users.a.id]);assert.ok((await a.request('/bootstrap')).data.mails.find(m=>m.id==='incoming-while-failed'));
  a.close();const reopened=make('a');await reopened.request('/bootstrap');assert.equal(reopened.store.all('relay-failed').length,1);
  sql('UPDATE users SET disabled=0 WHERE id=?',[users.b.id],true);
  assert.equal((await reopened.request('/sync',{operations:[{type:'mail.retry',id:'rejected'}]})).delivery.rejected,'sent');
  assert.ok((await b.request('/bootstrap')).data.mails.find(m=>m.id==='rejected'));
  assert.equal(reopened.store.all('relay-failed').length,0);
}));
test('transient outgoing failure keeps its sequence and does not prevent receiving',()=>fixture(async({a,b,c,send,users})=>{
  const raw=a.raw;a.raw=(r,p)=>r==='/relay/send'?Promise.resolve({error:'temporary failure',status:503}):raw(r,p);
  assert.equal((await send(a,'temporary',[users.b.id])).queued,true);const first=a.store.all('relay-outbox')[0];
  assert.equal((await send(a,'later',[users.b.id])).queued,true);assert.equal(a.store.all('relay-outbox')[1].value.wire,undefined);
  await send(c,'inbound',[users.a.id]);const incoming=await a.request('/bootstrap');assert.ok(incoming.data.mails.some(m=>m.id==='inbound'));assert.equal(incoming.outgoingPending,true);
  assert.equal(a.store.all('relay-failed').length,0);assert.deepEqual(a.store.get('relay-outbox',first.id).wire,first.value.wire);
  a.raw=raw;await a.request('/bootstrap');const received=await b.request('/bootstrap');assert.ok(received.data.mails.some(m=>m.id==='temporary'));assert.ok(received.data.mails.some(m=>m.id==='later'));
}));
test('invalid inbox pages never block valid mail, survive restart and recover when repaired',()=>fixture(async({a,b,c,send,users,sql,make})=>{
  await send(a,'invalid-first',[users.b.id]);const original=sql('SELECT * FROM relay_packets WHERE sender=?',[users.a.id])[0];
  sql('UPDATE relay_packets SET sealed=? WHERE id=?',[original.sealed+'invalid',original.id],true);
  for(let i=0;i<104;i++){
    const id='invalid-page-'+i,context={...JSON.parse(original.context),id};
    sql('INSERT INTO relay_packets VALUES(?,?,?,?,?,?,?,?,?)',[id,original.sender,original.sequence,JSON.stringify(context),original.sealed+'invalid',original.digest,0,1,'[]'],true);
    sql('INSERT INTO relay_targets VALUES(?,?)',[id,users.b.id],true);sql('INSERT INTO relay_positions(packet_id) VALUES(?)',[id],true);
  }
  await send(c,'valid-after-bad-page',[users.b.id]);let result=await b.request('/bootstrap');
  assert.ok(result.data.mails.some(m=>m.id==='valid-after-bad-page'));assert.equal(result.incomingFailures,105);assert.equal(result.privacy.more,false);
  assert.equal(sql('SELECT COUNT(*) n FROM relay_targets WHERE user_id=?',[users.b.id])[0].n,105);
  assert.equal(b.store.get('relay-ack',original.id),null);assert.equal(b.store.get('content','mail:invalid-first'),null);
  b.close();const reopened=make('b');result=await reopened.request('/bootstrap');assert.equal(result.incomingFailures,105);assert.equal(result.data.mails.filter(m=>m.id==='valid-after-bad-page').length,1);
  sql('UPDATE relay_packets SET sealed=? WHERE id=?',[original.sealed,original.id],true);result=await reopened.request('/bootstrap');
  assert.ok(result.data.mails.some(m=>m.id==='invalid-first'));assert.equal(result.incomingFailures,104);assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[original.id])[0].n,0);
  result=await reopened.retryIncoming();assert.equal(result.incomingFailures,104);assert.equal((await reopened.security()).incomingFailed,104);
  const labels=[];const renderer={window:{},setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(path.join(appDir,'js/backend.js'),'utf8'),renderer);
  new renderer.window.DingdongBackend({subscribe(){}},{data(){},status:s=>labels.push(s)}).activate(result);assert.match(labels[0],/수신 확인 필요 104건/);
}));
test('authenticated unsupported and deferred invalid actions do not roll back unrelated messages',()=>fixture(async({a,b,c,send,users,sql})=>{
  const bad=a.stage({type:'unsupported.fixture',body:'never-write-this-to-a-log'},[users.b.id]);await a.request('/bootstrap');
  b.store.put('relay-deferred','bad-deferred',{action:{type:'receipt.read',mail:'good-with-deferred',at:Date.now()},context:{id:'bad-deferred',sender:users.c.id,sequence:1}});
  await send(a,'good-with-deferred',[users.b.id]);const received=await b.request('/bootstrap');
  assert.ok(received.data.mails.some(m=>m.id==='good-with-deferred'));assert.equal(received.incomingFailures,2);
  assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[bad])[0].n,1);assert.equal(b.store.get('relay-ack',bad),null);
  assert.ok(!JSON.stringify(b.store.all('incoming-failed')).includes('never-write-this-to-a-log'));
  await send(c,'later-valid',[users.b.id]);assert.ok((await b.request('/bootstrap')).data.mails.some(m=>m.id==='later-valid'));
}));
test('old backup merges history without replay or rolling back current state; new PC holds pending mail for review',()=>fixture(async({a,b,send,users,sql,make,root})=>{
  const raw=a.raw;a.raw=(r,p)=>{if(r==='/relay/state')throw new Error('fixture connection lost');return raw(r,p);};
  assert.equal((await send(a,'archive-queued',[users.b.id])).queued,true);
  const password='Synthetic-backup-password-123',archive=await a.exportArchive(password);a.raw=raw;
  await a.request('/bootstrap');await b.request('/bootstrap');await a.request('/bootstrap');
  await b.request('/sync',{operations:[{type:'mail.update',id:'archive-queued',read:true}]});await a.request('/bootstrap');
  await a.request('/sync',{operations:[{type:'mail.update',id:'archive-queued',important:true}]});
  const restored=await a.importArchive(archive,password);assert.equal(restored.reviewRequired,0);assert.equal(a.store.all('relay-outbox').length,0);
  const old=a.store.get('mail-history','archive-queued');assert.equal(old.receipts[0],'read');assert.equal(old.important,true);assert.ok(!old.pendingDelivery);
  await a.request('/bootstrap');await b.request('/bootstrap');assert.equal(sql('SELECT count(*) n FROM relay_packets')[0].n,0);
  a.close();const archivedDir=path.join(root,'a');fs.renameSync(archivedDir,path.join(root,'a-original'));
  const fresh=make('a');assert.equal((await fresh.importArchive(archive,password)).reviewRequired,1);
  const history=(await fresh.request('/bootstrap')).data.mails.find(m=>m.id==='archive-queued');assert.ok(history.restoreReview);assert.match(history.body,/合成|합성/);assert.equal(history.pendingDelivery,false);
  assert.equal(fresh.store.all('relay-outbox').length,0);assert.equal(sql('SELECT count(*) n FROM relay_packets')[0].n,0);
  assert.equal((await fresh.importArchive(archive,password)).reviewRequired,0);await b.request('/bootstrap');
  const before=fresh.store.export();await assert.rejects(fresh.importArchive(archive,'wrong-password-long-enough'));assert.deepEqual(fresh.store.export(),before);
}));
test('restored received history retries stored/read receipts with fresh IDs and preserves server deletion order',()=>fixture(async({a,b,send,users,sql,make,root})=>{
  await send(a,'receipt-backup',[users.b.id]);const raw=b.raw;b.raw=(r,p)=>r==='/relay/state'?Promise.reject(new Error('fixture connection lost')):raw(r,p);
  await b.request('/bootstrap');await b.request('/sync',{operations:[{type:'mail.update',id:'receipt-backup',read:true}]});
  const ids=b.store.all('relay-outbox').map(r=>r.id),password='Synthetic-backup-password-123',archive=await b.exportArchive(password);
  b.raw=raw;await b.request('/bootstrap');await a.request('/bootstrap');assert.equal(sql('SELECT count(*) n FROM relay_packets')[0].n,0);
  b.close();fs.renameSync(path.join(root,'b'),path.join(root,'b-original'));const fresh=make('b');await fresh.importArchive(archive,password);
  const queued=fresh.store.all('relay-outbox');assert.equal(queued.length,2);assert.ok(queued.every(r=>!ids.includes(r.id)&&!r.value.wire));
  await fresh.request('/bootstrap');const received=await a.request('/bootstrap');const mail=received.data.mails.find(m=>m.id==='receipt-backup');assert.equal(mail.receipts[0],'read');assert.ok(mail.storedReceipts[users.b.id]);assert.equal(sql('SELECT count(*) n FROM relay_packets')[0].n,0);
  await fresh.importArchive(archive,password);assert.equal(fresh.store.all('relay-outbox').length,0);
}));
test('restoration storage failure rolls back all history and serialized import waits for active sync',()=>fixture(async({a,send,users,make,root})=>{
  await send(a,'atomic-backup',[users.b.id]);const password='Synthetic-backup-password-123',archive=await a.exportArchive(password);
  a.close();fs.renameSync(path.join(root,'a'),path.join(root,'a-original'));const fresh=make('a'),put=fresh.store.put.bind(fresh.store);
  fresh.store.put=(kind,id,value)=>{if(kind==='mail-history')throw new Error('fixture disk full');return put(kind,id,value);};
  await assert.rejects(fresh.importArchive(archive,password),/disk full/);assert.equal(fresh.store.export().length,0);fresh.store.put=put;
  let unlock;fresh.queue=new Promise(r=>unlock=r);let done=false;const importing=fresh.importArchive(archive,password).then(()=>done=true);
  await new Promise(r=>setTimeout(r,20));assert.equal(done,false);unlock();await importing;assert.ok(fresh.store.get('mail-history','atomic-backup'));
}));
test('delivery labels distinguish local queue, recipient storage, reading and independent completion',()=>{
  const {delivery,summary,message}=require('../js/mail-receipts.js'),m={to:['b','c','cc'],cc:['cc'],receipts:['unread','read','unread'],storedReceipts:{b:1},workRequest:{kind:'reply',targets:['b','c']},workResponses:{b:{done:true}}};
  assert.equal(delivery(m,'b'),'상대 PC 저장 완료 · 읽음 확인 전');assert.equal(delivery(m,'cc'),'상대 PC 저장 대기');
  assert.equal(delivery(m,'c'),'상대 PC 저장 완료 · 읽음');
  assert.deepEqual(summary(m).metrics,[{label:'상대 PC 저장 완료',count:2,total:3},{label:'읽음',count:1,total:3},{label:'회신 완료',count:1,total:2}]);
  assert.equal(summary({...m,workRequest:null}).metrics.length,2);
  assert.equal(summary({...m,to:['a']},{self:'a'}).label,'내 PC 보관');
  assert.equal(summary({...m,to:['a',...m.to]},{self:'a'}).metrics[0].total,3);
  assert.equal(summary({...m,receipts:['recalled','read','unread']}).metrics[2].total,1);
  assert.equal(summary({...m,receipts:m.to.map(()=>'recalled'),pendingDelivery:true}).label,'회수됨');
  assert.equal(delivery({...m,pendingDelivery:true},'cc'),'발송 대기');
  assert.equal(delivery({...m,sendError:{message:'disabled'}},'cc'),'발송 실패');assert.equal(delivery({...m,restoreReview:{}},'cc'),'발송 여부 확인 필요');
  assert.equal(delivery({...m,scheduled:'2099-01-01'},'c'),'예약 발송 대기');assert.equal(message({name:'시험 교사'}).title,'메시지 읽음 확인');assert.match(message({}).body,/읽었습니다/);
});
test('recalling queued mail clears the local send state even when server acceptance is unknown',()=>fixture(async({a,b,send,users})=>{
  const raw=a.raw;
  a.raw=(route,p)=>route==='/relay/send'?Promise.resolve({error:'temporary failure',status:503}):raw(route,p);
  await send(a,'attempted',[users.b.id]);await send(a,'never-attempted',[users.b.id]);
  const recall=id=>a.request('/sync',{operations:[{type:'mail.update',id,recall:true}]});
  await recall('never-attempted');
  const status=id=>require('../js/mail-receipts.js').summary(a.store.get('mail-history',id)).label;
  assert.equal(status('never-attempted'),'회수됨');
  await recall('attempted');assert.equal(a.store.get('mail-history','attempted').pendingDelivery,false);
  assert.equal(status('attempted'),'회수 확인 대기');
  a.raw=raw;await a.request('/bootstrap');const snapshot=await b.request('/bootstrap');await a.request('/bootstrap');
  assert.equal(status('attempted'),'회수됨');assert.ok(!snapshot.data.mails.some(m=>['attempted','never-attempted'].includes(m.id)));
}));
test('restoring chat history merges missing messages and preserves newer messages and room settings',()=>fixture(async({a,users})=>{
  await a.request('/sync',{operations:[{type:'room.create',value:{id:'archive-room',name:'기록 시험',members:[users.b.id]}},{type:'message.send',room:'archive-room',value:{id:'old-chat',text:'백업에만 남은 기록'}}]});
  const password='Synthetic-backup-password-123',archive=await a.exportArchive(password);
  await a.request('/sync',{operations:[{type:'message.send',room:'archive-room',value:{id:'new-chat',text:'백업 이후의 기록'}},{type:'room.update',id:'archive-room',pinned:true,muted:true}]});
  const room=a.store.get('room-history','archive-room');room.messages=room.messages.filter(m=>m.id!=='old-chat');a.saveRoom(room);
  await a.importArchive(archive,password);const merged=a.store.get('room-history','archive-room');assert.deepEqual(merged.messages.map(m=>m.id),['old-chat','new-chat']);assert.equal(merged.pinned,true);assert.equal(merged.muted,true);
}));

