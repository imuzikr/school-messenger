'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),{randomBytes}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {startServer}=require('../server/index.cjs'),{PrivateClient}=require('../desktop/private-client.cjs'),crypto=require('../privacy/crypto.cjs');
const protector={encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}; // Test-only; native test covers DPAPI.
test('metadata relay over real HTTPS and durable PC SQLite',{timeout:240000},async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-relay-test-'));let now=Date.now();const timers=require('./helpers/server-timers.cjs')(()=>now);
  const server=await startServer({dataDir:path.join(root,'server'),port:0,host:'127.0.0.1',address:'https://localhost:8443',now:()=>now,timers,admin:{username:'admin',password:'Fixture-password-123'},onError:console.error});
  const tokens={},users={},clients=[];
  const call=(name,route,payload)=>new Promise((resolve,reject)=>{const body=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:body?'POST':'GET',ca:server.connection.certificate,headers:{...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),...(tokens[name]?{authorization:'Bearer '+tokens[name]}:{})}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(text)}));});req.on('error',reject);if(body)req.write(body);req.end();});
  const login=await call(null,'/login',{username:'admin',password:'Fixture-password-123'});tokens.a=login.token;users.a=login.user;
  const sql=(query,...values)=>{const db=new DatabaseSync(path.join(root,'server','dingdong.sqlite'));try{return db.prepare(query).all(...values);}finally{db.close();}};
  const db=new DatabaseSync(path.join(root,'server','dingdong.sqlite')),base=db.prepare('SELECT * FROM users WHERE id=?').get(users.a.id);
  for(let i=0;i<71;i++){const name='u'+i,id='fixture-'+name,token=randomBytes(32).toString('hex');users[name]={id,name,username:name};tokens[name]=token;db.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt) VALUES(?,?,?,?,?,?,?,?,?)').run(id,name,name,'교무','교사','','',base.digest,base.salt);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(crypto.digest(token),id,Date.now()+86400000);}db.close();
  function client(name){const c=new PrivateClient({root:path.join(root,name),server:server.connection.fingerprint,user:users[name],request:(r,p)=>call(name,r,p),protector});clients.push(c);return c;}
  const a=client('a'),b=client('u0'),c=client('u1');await Promise.all([a.initialize(),b.initialize(),c.initialize()]);await a.request('/bootstrap');
  const send=async(cl,...operations)=>assert.equal((await cl.request('/sync',{operations})).ok,true);
  const mail=(id,to=[users.u0.id,users.u1.id],extra={})=>({type:'mail.send',value:{id,title:'민감 제목 '+id,body:'개별 메시지 본문 '+id,html:'',to,cc:[],files:[],...extra}});
  const packet=id=>a.store.get('mail-history',id).relayPacket;
  const count=(table,where='',...args)=>sql('SELECT count(*) n FROM '+table+(where?' WHERE '+where:''),...args)[0].n;
  t.after(async()=>{for(const c of clients)if(c.store.db)c.close();await server.close();assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('dingdong-relay-test-'));fs.rmSync(root,{recursive:true,force:true});});
  await t.test('metadata and content are both deleted after last durable receipt, not read',async()=>{
    await send(a,mail('group'));assert.equal(count('mails'),0);assert.equal(count('recipients'),0);assert.equal(count('private_deliveries'),0);assert.equal(count('relay_packets','id=?',packet('group')),1);
    assert.ok(!JSON.stringify(sql('SELECT * FROM relay_packets')).includes('민감'));assert.ok(!JSON.stringify(sql('SELECT * FROM relay_packets')).includes('"mail":"group"'));
    const received=await b.request('/bootstrap');assert.equal(received.data.mails.find(m=>m.id==='group').unread,true);assert.equal(count('relay_packets','id=?',packet('group')),1);
    await c.request('/bootstrap');assert.equal(count('relay_packets','id=?',packet('group')),0);assert.equal(count('relay_targets','packet_id=?',packet('group')),0);
    assert.ok(count('relay_packets')>=2,'sender offline delivery receipts remain');
    const sender=await a.request('/bootstrap'),m=sender.data.mails.find(m=>m.id==='group');assert.equal(m.receipts[0],'unread');assert.ok(m.storedReceipts[users.u0.id]);assert.equal(count('relay_packets'),0);assert.equal(count('relay_targets'),0);
  });
  await t.test('offline sender receives read notice later; UI dismissal stays local',async()=>{
    await send(b,{type:'mail.update',id:'group',read:true,important:true});assert.ok(count('relay_packets')>0);
    const r=await a.request('/bootstrap');assert.equal(r.data.mails.find(m=>m.id==='group').receipts[0],'read');assert.equal(r.data.readReceipts.length,1);assert.equal(count('relay_packets'),0);
    await send(a,{type:'mail.receipt.ack',id:'group',value:{recipient:users.u0.id}});assert.equal((await a.request('/bootstrap')).data.readReceipts.length,0);assert.equal(count('relay_packets'),0);
  });
  await t.test('failed PC metadata write rolls back content, ACK and auto receipt',async()=>{
    await send(a,mail('disk',[users.u0.id]));const put=b.store.put.bind(b.store);b.store.put=(kind,id,value)=>{if(kind==='mail-history'&&id==='disk')throw new Error('fixture disk full');return put(kind,id,value);};
    await assert.rejects(b.request('/bootstrap'),/disk full/);assert.equal(b.store.get('content','mail:disk'),null);assert.equal(b.store.all('relay-ack').length,0);assert.equal(count('relay_targets','packet_id=?',packet('disk')),1);b.store.put=put;await b.request('/bootstrap');await a.request('/bootstrap');
  });
  await t.test('lost ACK retries after process restart; local search/history survives deletion',async()=>{
    await send(a,mail('ack',[users.u1.id]));const raw=c.raw;c.raw=async(r,p)=>{if(r==='/relay/ack')throw new Error('fixture connection lost');return raw(r,p);};assert.equal((await c.request('/bootstrap')).receiptPending,true);assert.equal(count('relay_packets','id=?',packet('ack')),1);c.close();
    const reopened=client('u1');const r=await reopened.request('/bootstrap');assert.equal(r.data.mails.find(m=>m.id==='ack').body,'개별 메시지 본문 ack');assert.equal(count('relay_packets','id=?',packet('ack')),0);assert.ok((await reopened.request('/search',{query:'개별 메시지'})).total>=2);await a.request('/bootstrap');
  });
  await t.test('accepted upload with lost reply is not replayed even after recipient deletes it',async()=>{
    const raw=a.raw;let once=true;a.raw=async(r,p)=>{const out=await raw(r,p);if(r==='/relay/send'&&once){once=false;throw new Error('fixture connection lost');}return out;};assert.equal((await a.request('/sync',{operations:[mail('retry',[users.u0.id])]})).queued,true);a.raw=raw;
    await b.request('/bootstrap');assert.equal(count('relay_packets','id=?',packet('retry')),0);await a.request('/bootstrap');assert.equal(count('relay_packets','id=?',packet('retry')),0);assert.equal(a.store.all('relay-outbox').length,0);
  });
  await t.test('completion response works after all original server metadata is gone',async()=>{
    await send(a,mail('work',[users.u0.id],{workRequest:{kind:'submission',dueDate:'2026-11-03'}}));await b.request('/bootstrap');await a.request('/bootstrap');assert.equal(count('relay_packets'),0);
    await send(b,{type:'mail.work.respond',id:'work',value:{done:true,note:'개인 회신 비밀'}});assert.ok(!JSON.stringify(sql('SELECT * FROM relay_packets')).includes('개인 회신'));
    const r=await a.request('/bootstrap');assert.equal(r.data.mails.find(m=>m.id==='work').workResponses[users.u0.id].note,'개인 회신 비밀');assert.equal(count('relay_packets'),0);assert.equal(count('mail_work_responses'),0);
    assert.equal(b.store.get('mail-history','work').unread,true);
    assert.deepEqual(a.store.get('mail-history','work').receipts,['unread']);
    assert.equal(a.store.get('read-receipt','work:'+users.u0.id),null);
    await send(b,{type:'mail.update',id:'work',read:true});await a.request('/bootstrap');
    assert.deepEqual(a.store.get('mail-history','work').receipts,['read']);
    await send(b,{type:'mail.work.respond',id:'work',value:{done:false,note:''}});await a.request('/bootstrap');
    const changed=a.store.get('mail-history','work');assert.deepEqual(changed.receipts,['read']);assert.equal(changed.workResponses[users.u0.id].done,false);
  });
  await t.test('files use an independent capability, remain unencrypted, expire at ten days',async()=>{
    const data='data:application/octet-stream;base64,'+Buffer.from('unchanged file bytes').toString('base64');await send(a,mail('file',[users.u0.id],{files:[{name:'비공개 파일 이름.bin',data}]}));await b.request('/bootstrap');await a.request('/bootstrap');const row=sql('SELECT * FROM relay_files')[0],handle=b.store.get('mail-history','file').files[0].relayFile;
    assert.equal(row.data,data);assert.ok(!JSON.stringify(row).includes('비공개'));assert.equal(row.staged_owner,null);assert.equal(count('mails'),0);assert.equal((await call('u1','/relay/file',{id:row.id,secret:'bad'})).status,403);
    assert.equal((await b.request('/attachment',{mail:'file',index:0})).file.data,data);now=row.expires_at;await timers.runDue();assert.equal((await call('u0','/relay/file',handle)).status,410);assert.equal(count('relay_files','id=?',row.id),0);assert.equal((await b.request('/attachment',{mail:'file',index:0})).file.data,data);now=Date.now();
  });
  await t.test('scheduled delivery starts file lifetime at actual dispatch and cancels pending files',async()=>{
    const start=Date.now()+86400000;await send(a,mail('schedule',[users.u0.id],{scheduled:new Date(start).toISOString(),files:[{name:'예약.txt',data:'data:text/plain;base64,YQ=='}]}));assert.ok(!(await b.request('/bootstrap')).data.mails.some(m=>m.id==='schedule'));const f=a.store.get('mail-history','schedule').files[0];assert.equal(sql('SELECT expires_at FROM relay_files WHERE id=?',f.relayFile.id)[0].expires_at,0);
    now=start+5*86400000;await timers.runDue();await b.request('/bootstrap');assert.equal(sql('SELECT expires_at FROM relay_files WHERE id=?',f.relayFile.id)[0].expires_at,now+10*86400000);await a.request('/bootstrap');now=Date.now();
    await send(a,mail('cancel',[users.u0.id],{scheduled:new Date(Date.now()+86400000).toISOString(),files:[{name:'취소.txt',data:'data:text/plain;base64,Yg=='}]}));const id=a.store.get('mail-history','cancel').files[0].relayFile.id;await send(a,{type:'mail.update',id:'cancel',recall:true});assert.equal(count('relay_files','id=?',id),0);assert.equal(count('relay_packets','id=?',packet('cancel')),0);
  });
  await t.test('chat metadata, likes, room settings and homeroom actions are local after delivery',async()=>{
    await send(a,{type:'room.create',value:{id:'room',name:'민감 대화방',members:[users.u0.id]}},{type:'message.send',room:'room',value:{id:'chat',text:'대화 내용',reply:''}});await b.request('/bootstrap');assert.equal(count('rooms'),0);assert.equal(count('messages'),0);
    await send(b,{type:'message.like',id:'chat',liked:true});assert.equal((await a.request('/bootstrap')).data.rooms.find(r=>r.id==='room').messages[0].likes,1);
    await send(b,{type:'room.update',id:'room',pinned:true,muted:true,read:true});assert.equal(count('room_members'),0);
    await send(a,mail('home',[users.u0.id],{category:'homeroom'}));await b.request('/bootstrap');const m=b.store.get('mail-history','home');await send(b,{type:'homeroom.defer',value:{mail:'home',date:m.date}},{type:'homeroom.dismiss',value:{mail:'home',date:m.date}});assert.equal(count('homeroom_days'),0);assert.equal(b.store.get('mail-history','home').homeroomDays.length,2);await a.request('/bootstrap');
  });
  await t.test('70 recipients: only the final recipient removes the envelope and all routing rows',async()=>{
    const group=Array.from({length:70},(_,i)=>client('u'+i));await Promise.all(group.map(c=>c.initialize()));await send(a,mail('seventy',group.map(c=>c.user.id)));const id=packet('seventy');
    for(let i=0;i<69;i++)await group[i].request('/bootstrap');assert.equal(count('relay_packets','id=?',id),1);assert.equal(count('relay_targets','packet_id=?',id),1);
    await group[69].request('/bootstrap');assert.equal(count('relay_packets','id=?',id),0);assert.equal(count('relay_targets','packet_id=?',id),0);await a.request('/bootstrap');assert.equal(Object.keys(a.store.get('mail-history','seventy').storedReceipts).length,71);
  });
  await t.test('outsiders cannot ACK or cancel; tampered packets do not delete queued metadata',async()=>{
    await send(a,mail('protected',[users.u0.id]));const id=packet('protected'),row=sql('SELECT * FROM relay_packets WHERE id=?',id)[0];
    assert.equal((await call('u1','/relay/ack',{entries:[{id,digest:row.digest}]})).status,403);assert.equal((await call('u1','/relay/cancel',{id})).status,403);
    const ctx=JSON.parse(row.context);assert.equal((await call('a','/relay/send',{context:ctx,sealed:row.sealed.slice(0,-8)+'12345678'})).status,400);assert.equal(count('relay_packets','id=?',id),1);await b.request('/bootstrap');await a.request('/bootstrap');
  });
  await t.test('linked calendar and inline images work after server mail rows are deleted',async()=>{
    const event={id:'private-calendar',title:'개인 연결 일정',date:'2026-11-02',start:'09:00',end:'10:00',type:'group',targets:[users.u0.id],note:'개인 일정 메모',place:''};
    await send(a,{type:'event.upsert',value:event},mail('calendar',[users.u0.id],{calendarEvent:event.id,html:'<img src="data:image/png;base64,YWJj">'}));let r=await b.request('/bootstrap');await a.request('/bootstrap');assert.equal(count('events','id=?',event.id),0);assert.equal(r.data.events.find(e=>e.id===event.id).note,event.note);assert.equal(r.data.mails.find(m=>m.id==='calendar').files.length,0);
    assert.ok((await b.request('/attachment',{mail:'calendar',inline:true})).html.includes('data:image/png;base64,YWJj'));
    await send(b,{type:'event.reschedule',id:event.id,value:{date:'2026-11-03',start:'10:00',end:'11:00'}});r=await a.request('/bootstrap');assert.equal(r.data.events.find(e=>e.id===event.id).date,'2026-11-03');
  });
  await t.test('server backup excludes pending content, routing metadata, attachments and legacy rows',async()=>{
    await send(a,mail('backup',[users.u0.id],{files:[{name:'백업 제외.txt',data:'data:text/plain;base64,YQ=='}]}));const backup=path.join(root,'backup.sqlite');server.backup(backup);const db=new DatabaseSync(backup);try{for(const table of ['relay_packets','relay_targets','relay_files','relay_migrated','relay_legacy_files','mails','recipients','messages','room_members','private_deliveries'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get().n,0,table);assert.ok(db.prepare('SELECT count(*) n FROM users').get().n>0);}finally{db.close();}await b.request('/bootstrap');await a.request('/bootstrap');
  });
});

test('upgrade copies legacy metadata to every PC before deleting server history',{timeout:90000},async t=>{
  const {PrivateClient:Legacy}=require('../desktop/legacy-client.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-relay-migration-'));const options={dataDir:path.join(root,'server'),port:0,host:'127.0.0.1',address:'https://localhost:8443',admin:{username:'a',password:'Fixture-password-123'},onError:console.error};
  let server=await startServer({...options,metadataRelay:false});const clients=[],tokens={},users={};
  const call=(name,route,payload)=>new Promise((resolve,reject)=>{const body=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:body?'POST':'GET',ca:server.connection.certificate,headers:{...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),...(tokens[name]?{authorization:'Bearer '+tokens[name]}:{})}},res=>{let data='';res.on('data',s=>data+=s);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(data)}));});req.on('error',reject);if(body)req.write(body);req.end();});
  const login=await call(null,'/login',{username:'a',password:'Fixture-password-123'});tokens.a=login.token;users.a=login.user;await call('a','/admin/users',{username:'b',name:'b',department:'교무',password:'Fixture-password-123'});const lb=await call(null,'/login',{username:'b',password:'Fixture-password-123'});tokens.b=lb.token;users.b=lb.user;await call('b','/password',{current:'Fixture-password-123',password:'Fixture-password-123'});
  const make=(Type,name)=>{const c=new Type({root:path.join(root,name),server:server.connection.fingerprint,user:users[name],request:(r,p)=>call(name,r,p),protector});clients.push(c);return c;};
  const count=table=>{const db=new DatabaseSync(path.join(root,'server','dingdong.sqlite'));try{return db.prepare('SELECT count(*) n FROM '+table).get().n;}finally{db.close();}};
  t.after(async()=>{for(const c of clients)if(c.store.db)c.close();await server.close();assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('dingdong-relay-migration-'));fs.rmSync(root,{recursive:true,force:true});});
  const oldA=make(Legacy,'a'),oldB=make(Legacy,'b');await oldA.initialize();await oldB.initialize();await oldA.request('/bootstrap');
  await oldA.request('/sync',{operations:[{type:'room.create',value:{id:'old-room',name:'기존 방',members:[users.b.id]}},{type:'message.send',room:'old-room',value:{id:'old-chat',text:'기존 대화',reply:''}},{type:'mail.send',value:{id:'old-mail',title:'기존 메시지',body:'기존 본문',html:'',to:[users.b.id],cc:[],files:[{name:'기존 파일.txt',data:'data:text/plain;base64,YQ=='}],workRequest:{kind:'submission',dueDate:'2026-11-03'}}}]});
  await oldB.request('/bootstrap');await oldB.request('/sync',{operations:[{type:'mail.work.respond',id:'old-mail',value:{done:false,note:'이전 응답'}}]});await oldB.request('/sync',{operations:[{type:'mail.work.respond',id:'old-mail',value:{done:true,note:'기존 회신'}}]});
  await oldA.request('/sync',{operations:[{type:'mail.send',value:{id:'old-scheduled',title:'기존 예약',body:'기존 예약 본문',html:'',to:[users.b.id],cc:[],files:[{name:'예약 파일.txt',data:'data:text/plain;base64,Yg=='}],scheduled:new Date(Date.now()+86400000).toISOString()}}]});
  const oldRaw=oldA.raw;oldA.raw=async(r,p)=>{if(r==='/sync')throw new Error('fixture connection lost');return oldRaw(r,p);};assert.equal((await oldA.request('/sync',{operations:[{type:'mail.send',value:{id:'old-pending',title:'기존 대기',body:'PC의 미전송 메시지',html:'',to:[users.b.id],cc:[],files:[]}}]})).queued,true);
  oldA.close();oldB.close();await server.close();server=await startServer(options);
  const a=make(PrivateClient,'a'),b=make(PrivateClient,'b');let r=await a.request('/bootstrap');assert.equal(r.data.mails.find(m=>m.id==='old-mail').workResponses[users.b.id].note,'기존 회신');assert.equal(count('mails'),2);assert.equal(count('rooms'),1);
  await a.request('/sync',{operations:[{type:'mail.update',id:'old-scheduled',recall:true}]});assert.equal(count('relay_files'),1);
  const original=b.store.put.bind(b.store);b.store.put=(kind,id,v)=>{if(kind==='mail-history')throw new Error('migration disk full');return original(kind,id,v);};await assert.rejects(b.request('/bootstrap'),/disk full/);assert.equal(count('mails'),2);b.store.put=original;
  const raw=b.raw;let lose=true;b.raw=async(route,p)=>{const r=await raw(route,p);if(route==='/relay/migrate'&&lose){lose=false;throw new Error('migration connection lost');}return r;};assert.equal((await b.request('/bootstrap')).receiptPending,true);
  for(const table of ['mails','recipients','mail_work_responses','homeroom_days','rooms','room_members','messages','reactions','private_content','private_deliveries','retained_files','relay_legacy_files','relay_migrated'])assert.equal(count(table),0,table);
  b.raw=raw;r=await b.request('/bootstrap');assert.equal(r.data.mails.find(m=>m.id==='old-mail').body,'기존 본문');assert.equal(r.data.mails.find(m=>m.id==='old-pending').body,'PC의 미전송 메시지');assert.equal(a.store.all('outbox').length,0);assert.equal(r.data.rooms.find(r=>r.id==='old-room').messages[0].text,'기존 대화');assert.equal((await b.request('/attachment',{mail:'old-mail',index:0})).file.data,'data:text/plain;base64,YQ==');
  await b.request('/sync',{operations:[{type:'mail.work.respond',id:'old-mail',value:{done:false,note:'이전 뒤 수정'}}]});assert.equal((await a.request('/bootstrap')).data.mails.find(m=>m.id==='old-mail').workResponses[users.b.id].note,'이전 뒤 수정');
});
