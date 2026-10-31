'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),nodeCrypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {startServer}=require('../server/index.cjs');
const {PrivateClient}=require('../desktop/legacy-client.cjs');
const crypto=require('../privacy/crypto.cjs');
const {RETENTION}=require('../server/privacy.cjs');
// Test-only disk protector. Production exclusively uses Electron safeStorage.
const testKey=nodeCrypto.randomBytes(32);
const protector={encrypt(text){const iv=nodeCrypto.randomBytes(12),c=nodeCrypto.createCipheriv('aes-256-gcm',testKey,iv),body=Buffer.concat([c.update(text),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]);},decrypt(value){const d=nodeCrypto.createDecipheriv('aes-256-gcm',testKey,value.subarray(0,12));d.setAuthTag(value.subarray(12,28));return Buffer.concat([d.update(value.subarray(28)),d.final()]).toString();}};
test('JOSE authenticates content, sender, target set and message identity',async()=>{
  const a=await crypto.newIdentity(),b=await crypto.newIdentity(),c=await crypto.newIdentity(),keys={a:crypto.publicIdentity(a),b:crypto.publicIdentity(b)};
  const ctx=crypto.context('mail','one','a',['b']),sealed=await crypto.encrypt({body:'개인 내용'},ctx,a,keys);
  assert.equal((await crypto.decrypt(sealed,ctx,b,keys.a,'b')).body,'개인 내용');
  await assert.rejects(crypto.decrypt(sealed,{...ctx,id:'two'},b,keys.a,'b'));
  await assert.rejects(crypto.decrypt(sealed,ctx,c,keys.a,'b'));
  await assert.rejects(crypto.decrypt(sealed,ctx,b,crypto.publicIdentity(c),'b'));
  await assert.rejects(crypto.decrypt(sealed.slice(0,-8)+'ABCDEFGH',ctx,b,keys.a,'b'));
});

test('private delivery, PC history and ten-day retention over actual HTTPS',{timeout:180000},async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-privacy-test-')),serverDir=path.join(root,'server');let clock=Date.now();
  let server=await startServer({metadataRelay:false,port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:serverDir,now:()=>clock,admin:{username:'admin',password:'Fixture-password-123'},onError:e=>console.error(e)});
  const clients=[],tokens={},users={};
  const call=(user,route,payload)=>new Promise((resolve,reject)=>{
    const raw=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:raw?'POST':'GET',ca:server.connection.certificate,headers:{...(raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}),...(tokens[user]?{authorization:'Bearer '+tokens[user]}:{})}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(data)}));});req.on('error',reject);if(raw)req.write(raw);req.end();
  });
  const login=await call(null,'/login',{username:'admin',password:'Fixture-password-123'});tokens.admin=login.token;users.admin=login.user;
  let db=new DatabaseSync(path.join(serverDir,'dingdong.sqlite'));const base=db.prepare('SELECT * FROM users WHERE id=?').get(users.admin.id);
  for(let i=0;i<71;i++){const name='u'+i,id='fixture-'+name,token=nodeCrypto.randomBytes(32).toString('hex');users[name]={id,name,username:name};tokens[name]=token;
    db.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt) VALUES(?,?,?,?,?,?,?,?,?)').run(id,name,name,'교무','교사','','',base.digest,base.salt);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(crypto.digest(token),id,Date.now()+86400000);}
  db.close();
  function client(name,extra={}){const c=new PrivateClient({root:path.join(root,name),server:server.connection.fingerprint,user:users[name],request:(r,p)=>call(name,r,p),protector,...extra});clients.push(c);return c;}
  const a=client('admin'),b=client('u0'),c=client('u1');await Promise.all([a.initialize(),b.initialize(),c.initialize()]);await a.request('/bootstrap');
  const query=(sql,...args)=>{const d=new DatabaseSync(path.join(serverDir,'dingdong.sqlite'));try{return d.prepare(sql).all(...args);}finally{d.close();}};
  const mail=(id,to=[users.u0.id,users.u1.id],extra={})=>({type:'mail.send',value:{id,title:'비밀 제목 '+id,body:'다른 사람이 읽으면 안 되는 본문 '+id,html:'<p>비밀 본문</p>',to,cc:[],files:[],...extra}});
  const send=async(cl,op)=>{const r=await cl.request('/sync',{operations:[op]});assert.equal(r.ok,true,JSON.stringify(r));};
  t.after(async()=>{for(const c of clients)if(c.store.db)c.close();await server.close();assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('dingdong-privacy-test-'));fs.rmSync(root,{recursive:true,force:true});});
  await t.test('plaintext rejected; body removed only after the final durable receipt; reading is independent',async()=>{
    assert.equal((await call('admin','/sync',{operations:[mail('plaintext')]})).status,400);
    await send(a,mail('group'));
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='group'")[0].n,1);
    assert.ok(!JSON.stringify(query("SELECT payload FROM mails WHERE id='group'")).includes('비밀'));
    assert.equal((await b.request('/bootstrap')).data.mails.find(m=>m.id==='group').body,'다른 사람이 읽으면 안 되는 본문 group');
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='group'")[0].n,1);
    assert.equal(query("SELECT status FROM recipients WHERE mail_id='group' AND user_id=?",users.u0.id)[0].status,'unread');
    await c.request('/bootstrap');assert.equal(query("SELECT count(*) n FROM private_content WHERE id='group'")[0].n,0);
    assert.equal((await a.request('/bootstrap')).data.mails.find(m=>m.id==='group').title,'비밀 제목 group');
    b.close();const restarted=client('u0');assert.equal((await restarted.request('/bootstrap')).data.mails.find(m=>m.id==='group').body,'다른 사람이 읽으면 안 되는 본문 group');
    assert.equal((await restarted.request('/search',{query:'다른 사람이'})).total,1);
    const raw=fs.readFileSync(restarted.store.path);assert.equal(raw.includes(Buffer.from('다른 사람이')),false);
  });
  await t.test('a failed local disk write never acknowledges a receipt',async()=>{
    await send(a,mail('disk-fail',[users.u1.id]));const original=c.store.put.bind(c.store);
    c.store.put=(kind,id,value)=>{if(kind==='content'&&id==='mail:disk-fail')throw new Error('fixture disk full');return original(kind,id,value);};
    await assert.rejects(c.request('/bootstrap'),/disk full/);
    assert.equal(query("SELECT received_at FROM private_deliveries WHERE id='disk-fail' AND user_id=?",users.u1.id)[0].received_at,null);
    c.store.put=original;await c.request('/bootstrap');assert.equal(query("SELECT count(*) n FROM private_content WHERE id='disk-fail'")[0].n,0);
  });
  await t.test('acknowledgement loss is retried after restarting the receiving PC',async()=>{
    await send(a,mail('lost-ack',[users.u1.id]));const raw=c.raw;c.raw=async(route,payload)=>{if(route==='/privacy/ack')throw new Error('fixture connection lost');return raw(route,payload);};
    assert.equal((await c.request('/bootstrap')).receiptPending,true);assert.equal(query("SELECT count(*) n FROM private_content WHERE id='lost-ack'")[0].n,1);c.close();
    const restarted=client('u1');await restarted.request('/bootstrap');assert.equal(query("SELECT count(*) n FROM private_content WHERE id='lost-ack'")[0].n,0);
  });
  await t.test('an upload accepted before connection loss is retried idempotently from disk',async()=>{
    const original=a.raw;let lose=true;a.raw=async(route,payload)=>{const r=await original(route,payload);if(route==='/sync'&&lose){lose=false;throw new Error('fixture connection lost');}return r;};
    const queued=await a.request('/sync',{operations:[mail('retry',[users.u0.id])]});assert.equal(queued.queued,true);assert.equal(a.store.all('outbox').length,1);a.raw=original;
    await a.request('/bootstrap');assert.equal(a.store.all('outbox').length,0);assert.equal(query("SELECT count(*) n FROM mails WHERE id='retry'")[0].n,1);
  });
  await t.test('attachments stay byte-identical, expire at ten days, and remain locally if downloaded',async()=>{
    const bytes=Buffer.from('unchanged binary file\x00\x01'),data='data:application/octet-stream;base64,'+bytes.toString('base64');
    await send(a,mail('file',[users.u0.id],{files:[{name:'자료.bin',data}]}));const r=client('u0');await r.request('/bootstrap');
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='file'")[0].n,0);
    const file=await r.request('/attachment',{mail:'file',index:0});assert.equal(file.file.data,data);
    assert.equal(query("SELECT data FROM retained_files WHERE mail_id='file'")[0].data,data);
    const expiry=query("SELECT expires_at FROM retained_files WHERE mail_id='file'")[0].expires_at;clock=expiry-1;
    assert.equal((await call('u0','/attachment',{mail:'file',index:0})).status,200);clock=expiry;
    assert.equal((await call('u0','/attachment',{mail:'file',index:0})).status,410);
    assert.equal(query("SELECT count(*) n FROM retained_files WHERE mail_id='file'")[0].n,0);
    assert.equal((await r.request('/attachment',{mail:'file',index:0})).file.data,data);clock=Date.now();
  });
  await t.test('scheduled recipients cannot fetch or ACK early; attachment lifetime starts at scheduled send',async()=>{
    const scheduled=new Date(Date.now()+86400000).toISOString();await send(a,mail('scheduled',[users.u0.id],{scheduled,files:[{name:'예약.txt',data:'data:text/plain;base64,YQ=='}]}));
    assert.ok(!(await call('u0','/bootstrap')).data.mails.some(m=>m.id==='scheduled'));
    const digest=query("SELECT digest FROM private_content WHERE id='scheduled'")[0].digest;
    assert.equal((await call('u0','/privacy/ack',{entries:[{kind:'mail',id:'scheduled',digest}]})).status,403);
    assert.equal(query("SELECT expires_at FROM retained_files WHERE mail_id='scheduled'")[0].expires_at,0);
    const backup=path.join(root,'backup.sqlite');server.backup(backup);const d=new DatabaseSync(backup);try{assert.equal(d.prepare('SELECT count(*) n FROM private_content').get().n,0);assert.equal(d.prepare('SELECT count(*) n FROM retained_files').get().n,0);}finally{d.close();}
  });
  await t.test('outsiders cannot download attachments or acknowledge another user; keys cannot be replaced',async()=>{
    assert.equal((await call('u70','/attachment',{mail:'scheduled',index:0})).status,403);
    assert.equal((await call('u70','/privacy/ack',{entries:[{kind:'mail',id:'scheduled',digest:'fake'}]})).status,403);
    assert.equal((await call('u0','/privacy/register',crypto.publicIdentity(await crypto.newIdentity()))).status,409);
    await assert.rejects(send(a,mail('unregistered',[users.u70.id])),/등록/);
  });
  await t.test('70 recipient group: first 69 keep the ciphertext, recipient 70 deletes it',async()=>{
    const group=Array.from({length:70},(_,i)=>client('u'+i));await Promise.all(group.map(c=>c.initialize()));
    const targets=group.map(c=>c.user.id);await send(a,mail('seventy',targets));
    for(const receiver of group.slice(0,69))await receiver.request('/bootstrap');
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='seventy'")[0].n,1);
    await group[69].request('/bootstrap');assert.equal(query("SELECT count(*) n FROM private_content WHERE id='seventy'")[0].n,0);
    for(const receiver of group)assert.equal(receiver.store.get('content','mail:seventy').body,'다른 사람이 읽으면 안 되는 본문 seventy');
  });
  await t.test('chat messages and automatic deadlines are local and searchable after deletion',async()=>{
    const receiver=client('u0');await send(a,{type:'room.create',value:{id:'chat',name:'교무',members:[users.u0.id]}});await a.request('/bootstrap');
    await a.request('/sync',{operations:[{type:'message.send',room:'chat',value:{id:'chat-one',text:'2026년 11월 2일까지 비밀계획서를 제출해 주세요.',reply:''}}]});
    const snap=await receiver.request('/bootstrap');assert.equal(snap.data.rooms.find(r=>r.id==='chat').messages[0].text,'2026년 11월 2일까지 비밀계획서를 제출해 주세요.');
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='chat-one'")[0].n,0);
    assert.ok(snap.data.deadlines.some(d=>d.source?.id==='chat-one'));
    assert.ok(!JSON.stringify(query('SELECT payload FROM items')).includes('비밀계획서'));
    assert.equal((await receiver.request('/message-source',{id:'chat-one'})).message.id,'chat-one');
  });
  await t.test('completion notes are encrypted, locally stored, and deleted after sender delivery',async()=>{
    const receiver=client('u0');await send(a,mail('work-private',[users.u0.id],{workRequest:{kind:'submission',dueDate:'2099-11-01'}}));await receiver.request('/bootstrap');
    await receiver.request('/sync',{operations:[{type:'mail.work.respond',id:'work-private',value:{done:true,note:'개인적인 응답 메모'}}]});
    assert.equal(query("SELECT note FROM mail_work_responses WHERE mail_id='work-private'")[0].note,'');
    assert.equal(query("SELECT count(*) n FROM private_content WHERE kind='response'")[0].n,1);
    assert.equal((await a.request('/bootstrap')).data.mails.find(m=>m.id==='work-private').workResponses[users.u0.id].note,'개인적인 응답 메모');
    assert.equal(query("SELECT count(*) n FROM private_content WHERE kind='response'")[0].n,0);
    assert.equal((await a.request('/bootstrap')).data.mails.find(m=>m.id==='work-private').workResponses[users.u0.id].note,'개인적인 응답 메모');
  });
  await t.test('inline images use unencrypted expiring file storage and encrypted HTML references',async()=>{
    const receiver=client('u0'),image='data:image/png;base64,aW1hZ2U=';
    await send(a,mail('inline',[users.u0.id],{html:'<p>이미지 안내</p><img src="'+image+'">'}));const snapshot=await receiver.request('/bootstrap'),received=snapshot.data.mails.find(m=>m.id==='inline');
    assert.equal(received.files.length,0);assert.equal(received.inlineStored,true);assert.equal(query("SELECT data FROM retained_files WHERE mail_id='inline'")[0].data,image);
    assert.equal((await receiver.request('/attachment',{mail:'inline',inline:true})).html,'<p>이미지 안내</p><img src="'+image+'">');
  });
  await t.test('a portable password archive restores history and keys only for the matching account',async()=>{
    const receiver=client('u0');await receiver.request('/bootstrap');const encrypted=await receiver.exportArchive('correct-archive-password');
    assert.ok(!encrypted.includes('다른 사람이'));const imported=client('u0',{root:path.join(root,'moved-PC')});
    await assert.rejects(imported.importArchive(encrypted,'incorrect-password'),/비밀번호/);
    await imported.importArchive(encrypted,'correct-archive-password');
    assert.equal((await imported.request('/bootstrap')).data.mails.find(m=>m.id==='group').body,'다른 사람이 읽으면 안 되는 본문 group');
    const outsider=client('u1',{root:path.join(root,'wrong-account')});await assert.rejects(outsider.importArchive(encrypted,'correct-archive-password'),/계정/);
  });
  await t.test('a changed pinned key prevents a send; no plaintext fallback',async()=>{
    const original=a.raw;a.raw=async(route,payload)=>{const result=await original(route,payload);if(route==='/privacy/keys')result.keys[users.u0.id]=crypto.publicIdentity(await crypto.newIdentity());return result;};
    await assert.rejects(send(a,mail('changed-key',[users.u0.id])),/보안 번호/);a.raw=original;
    assert.equal(query("SELECT count(*) n FROM mails WHERE id='changed-key'")[0].n,0);
  });
  await t.test('legacy messages and extracted copies migrate only after a durable PC save',async()=>{
    const d=new DatabaseSync(path.join(serverDir,'dingdong.sqlite'));
    d.prepare('INSERT INTO mails(id,sender,payload) VALUES(?,?,?)').run('legacy',users.admin.id,JSON.stringify({title:'기존 비공개 제목',body:'기존 비공개 내용',html:'',files:[],date:'2026-10-30',time:'09:00',createdAt:Date.now()}));
    d.prepare('INSERT INTO recipients(mail_id,user_id) VALUES(?,?)').run('legacy',users.u0.id);
    d.prepare('INSERT INTO items VALUES(?,?,?,?)').run('old-note',users.u0.id,'notes',JSON.stringify({text:'기존 개인 메모',date:'2026-10-30',time:'09:00'}));d.close();
    await server.close();server=await startServer({metadataRelay:false,port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:serverDir,now:()=>clock});
    assert.ok(!query("SELECT payload FROM mails WHERE id='legacy'")[0].payload.includes('기존 비공개'));
    const receiver=client('u0'),snapshot=await receiver.request('/bootstrap');assert.equal(snapshot.data.mails.find(m=>m.id==='legacy').body,'기존 비공개 내용');
    assert.equal(snapshot.data.notes.find(n=>n.id==='old-note').text,'기존 개인 메모');assert.equal(query("SELECT count(*) n FROM items WHERE id='old-note'")[0].n,0);
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='legacy'")[0].n,1);await a.request('/bootstrap');assert.equal(query("SELECT count(*) n FROM private_content WHERE id='legacy'")[0].n,0);
  });
  await t.test('late scheduled dispatch starts a fresh ten-day file lifetime and a recall cancels pending files',async()=>{
    await send(a,mail('late',[users.u0.id],{scheduled:new Date(Date.now()+86400000).toISOString(),files:[{name:'late.txt',data:'data:text/plain;base64,YQ=='}]}));
    const d=new DatabaseSync(path.join(serverDir,'dingdong.sqlite')),p=JSON.parse(d.prepare("SELECT payload FROM mails WHERE id='late'").get().payload);p.scheduled=new Date(Date.now()-20*86400000).toISOString();d.prepare("UPDATE mails SET payload=? WHERE id='late'").run(JSON.stringify(p));d.close();
    const start=Date.now();for(let i=0;i<30&&query("SELECT expires_at FROM retained_files WHERE mail_id='late'")[0].expires_at===0;i++)await new Promise(r=>setTimeout(r,100));
    const expiry=query("SELECT expires_at FROM retained_files WHERE mail_id='late'")[0].expires_at;assert.ok(expiry>=start+RETENTION&&expiry<=Date.now()+RETENTION);
    const receiver=client('u0');assert.equal((await receiver.request('/bootstrap')).data.mails.find(m=>m.id==='late').body,'다른 사람이 읽으면 안 되는 본문 late');
    await a.request('/sync',{operations:[{type:'mail.update',id:'scheduled',folder:'sent',recall:true}]});
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id='scheduled'")[0].n,0);
    assert.equal(query("SELECT count(*) n FROM retained_files WHERE mail_id='scheduled'")[0].n,0);
  });
  await t.test('a modified ciphertext reusing a sent message ID is rejected',async()=>{
    await assert.rejects(send(a,mail('group',[users.u0.id],{body:'다른 내용으로 식별자 재사용'})),/중복/);
    assert.equal(a.store.get('content','mail:group').body,'다른 사람이 읽으면 안 되는 본문 group');
    const targets=[users.u0.id,users.u1.id],ctx=crypto.context('mail','group',users.admin.id,targets),keys=(await call('admin','/privacy/keys')).keys;
    const sealed=await crypto.encrypt({body:'변조한 내용',title:'',html:''},ctx,a.identity,keys);
    assert.equal((await call('admin','/sync',{operations:[{type:'mail.send',value:{id:'group',to:targets,cc:[],files:[],privacyTargets:ctx.targets,sealed}}]})).status,409);
  });
  await t.test('PC history remains readable when server routing records are absent',async()=>{
    const receiver=client('u0');await send(a,mail('local-archive',[users.u0.id]));await receiver.request('/bootstrap');
    const d=new DatabaseSync(path.join(serverDir,'dingdong.sqlite'));d.prepare("DELETE FROM mails WHERE id='local-archive'").run();d.close();
    const restored=(await receiver.request('/bootstrap')).data.mails.find(m=>m.id==='local-archive');assert.equal(restored.body,'다른 사람이 읽으면 안 되는 본문 local-archive');assert.equal(restored.localOnly,true);
    assert.equal((await receiver.request('/search',{query:'local-archive'})).total,1);
    await receiver.request('/sync',{operations:[{type:'mail.update',id:'local-archive',folder:'trash'}]});assert.equal((await receiver.request('/search',{query:'local-archive'})).total,0);
  });
  await t.test('a large offline inbox is received in bounded batches without losing messages',async()=>{
    const receiver=client('u2'),body='긴 안내문 '.repeat(10000),operations=Array.from({length:18},(_,i)=>mail('backlog-'+i,[users.u2.id],{body,html:''}));
    assert.equal((await a.request('/sync',{operations})).ok,true);
    assert.equal((await call('u2','/bootstrap?privacy=1')).privacy.more,true);
    const snapshot=await receiver.request('/bootstrap');assert.equal(snapshot.data.mails.filter(m=>m.id.startsWith('backlog-')&&m.body===body).length,18);
    assert.equal(query("SELECT count(*) n FROM private_content WHERE id LIKE 'backlog-%'")[0].n,0);
  });
});

