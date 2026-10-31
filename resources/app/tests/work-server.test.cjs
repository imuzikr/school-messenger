'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const https=require('node:https');
const {DatabaseSync}=require('node:sqlite');
const {startServer}=require('../server/index.cjs');

test('HTTPS completion requests and authorized full-history search',{timeout:60000},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-work-test-'));
  let server=await startServer({allowLegacyMessages:true,port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:dir,admin:{username:'admin',password:'Fixture-password-123',name:'관리자'},onError:e=>console.error(e)});
  t.after(async()=>{await server.close();assert.ok(path.resolve(dir).startsWith(path.join(os.tmpdir(),'dingdong-work-test-')));fs.rmSync(dir,{recursive:true,force:true});});
  const call=(route,payload,token)=>new Promise((resolve,reject)=>{
    const raw=payload===undefined?null:JSON.stringify(payload);
    const req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:raw?'POST':'GET',ca:server.connection.certificate,headers:{...(raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}),...(token?{authorization:'Bearer '+token}:{})}},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(data)}));});req.on('error',reject);if(raw)req.write(raw);req.end();
  });
  const login=async username=>{const r=await call('/login',{username,password:'Fixture-password-123'});assert.equal(r.status,200);return r;};
  const admin=await login('admin'),users={};
  await t.test('account creation, password changes and resets use an eight-character minimum',async()=>{
    const account={name:'비밀번호 시험',username:'password-test',department:'교무부'};
    assert.equal((await call('/admin/users',{...account,password:'1234567'},admin.token)).status,400);
    const created=await call('/admin/users',{...account,password:'Temp1234'},admin.token);
    assert.equal(created.status,201);
    const signIn=(password,remember=false)=>call('/login',{username:account.username,password,remember});
    const first=await signIn('Temp1234',true);
    assert.equal(first.user.mustChange,true);
    assert.equal((await call('/session',undefined,first.token)).status,403);
    assert.equal((await call('/password',{current:'Temp1234',password:'1234567'},first.token)).status,400);
    assert.equal((await call('/password',{current:'Temp1234',password:'New!1234'},first.token)).status,200);
    assert.equal((await call('/session',undefined,first.token)).user.id,created.id);
    const manual=await signIn('New!1234');
    assert.equal(manual.user.mustChange,false);
    assert.equal((await call('/session',undefined,manual.token)).status,403);
    const anotherPC=await signIn('New!1234',true);
    assert.equal((await call('/logout',{},anotherPC.token)).status,200);
    assert.equal((await call('/session',undefined,anotherPC.token)).status,401);
    assert.equal((await call('/session',undefined,first.token)).status,200);
    assert.equal((await call('/admin/user',{id:created.id,password:'1234567'},admin.token)).status,400);
    assert.equal((await call('/admin/user',{id:created.id,password:'Temp5678'},admin.token)).status,200);
    assert.equal((await call('/session',undefined,first.token)).status,401);
    assert.equal((await signIn('New!1234')).status,401);
    assert.equal((await signIn('Temp5678')).user.mustChange,true);
  });
  await t.test('remembered sessions renew on use, expire after inactivity and stay out of backups',async()=>{
    const day=86400000,db=new DatabaseSync(require('../desktop/branding.cjs').databaseFile(dir));
    const digest=token=>require('node:crypto').createHash('sha256').update(token).digest('hex');
    const expiry=key=>db.prepare('SELECT expires FROM sessions WHERE token_hash=?').get(key).expires;
    try{
      const manualExpiry=expiry(digest(admin.token));assert.ok(manualExpiry>Date.now()&&manualExpiry<=Date.now()+day/2);
      const enabled=await call('/login',{username:'admin',password:'Fixture-password-123',remember:true}),key=digest(enabled.token);
      assert.ok(expiry(key)>Date.now()+89*day);
      db.prepare('UPDATE sessions SET expires=? WHERE token_hash=?').run(Date.now()+5*day,key);
      assert.equal((await call('/session',undefined,enabled.token)).status,200);
      assert.ok(expiry(key)>Date.now()+89*day);
      const file=path.join(dir,'login-backup.sqlite');server.backup(file);
      const copy=new DatabaseSync(file);try{
        for(const table of ['sessions','remembered_sessions'])assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
      }finally{copy.close();}
      db.prepare('UPDATE sessions SET expires=? WHERE token_hash=?').run(Date.now()-1,key);
      assert.equal((await call('/session',undefined,enabled.token)).status,401);
    }finally{db.close();}
  });
  await t.test('staff import issues a usable eight-character temporary password',async()=>{
    const {headers}=require('../js/staff-directory.js');
    const rows=[headers,['일괄 등록 시험','','','','','교무부']];
    const preview=await call('/admin/staff-import',{rows,preview:true},admin.token);
    assert.deepEqual(preview.errors,[]);
    const result=await call('/admin/staff-import',{rows,revision:preview.revision},admin.token);
    assert.equal(result.status,200);assert.equal(result.accounts.length,1);
    const {username,password}=result.accounts[0];
    assert.match(password,/^[A-Za-z0-9_-]{8}$/);
    assert.equal((await call('/login',{username,password})).user.mustChange,true);
  });
  for(const username of ['alice','bob','cc','outsider']){
    const made=await call('/admin/users',{username,password:'Fixture-password-123',name:username,department:'교무부'},admin.token);assert.equal(made.status,201);users[username]={id:made.id,...await login(username)};
    assert.equal((await call('/password',{current:'Fixture-password-123',password:'Fixture-password-123'},users[username].token)).status,200);
  }
  const a=users.alice,b=users.bob,c=users.cc,o=users.outsider;
  const sync=(user,...operations)=>call('/sync',{operations},user.token);
  const getMail=async(user,id)=>(await call('/bootstrap',undefined,user.token)).data.mails.find(m=>m.id===id);
  const makeMail=(id,extra={})=>({type:'mail.send',value:{id,title:'검색검증 평가계획',body:'평가 자료를 보내 주세요.',to:[a.id,b.id,c.id],cc:[c.id],files:[],workRequest:{kind:'submission',dueDate:'2099-11-01'},...extra}});
  assert.equal((await sync(admin,makeMail('work'))).status,200);
  await t.test('only a designated recipient can record their own completion',async()=>{
    const response={type:'mail.work.respond',id:'work',value:{done:true,note:'제출했습니다'}};
    for(const user of [admin,c,o])assert.equal((await sync(user,response)).status,403);
    assert.equal((await sync(a,{...response,value:{done:true,recipient:b.id}})).status,400);
    assert.equal((await sync(a,{...response,value:{done:'yes'}})).status,400);
    assert.equal((await sync(a,response)).status,200);
    const sent=await getMail(admin,'work');assert.equal(sent.workResponses[a.id].done,true);assert.ok(sent.workResponses[a.id].updatedAt);assert.deepEqual(sent.workRequest.targets.sort(),[a.id,b.id].sort());
    assert.equal(sent.workDelivery[a.id],'unread');
    assert.equal((await getMail(b,'work')).workResponses[a.id],undefined);assert.equal((await getMail(c,'work')).workResponses[a.id],undefined);
    assert.equal((await sync(a,{...response,value:{done:false,note:'수정 중'}})).status,200);
    assert.equal((await getMail(admin,'work')).workResponses[a.id].done,false);
  });
  await t.test('reminders recheck pending recipients and preserve the original request',async()=>{
    assert.equal((await sync(a,{type:'mail.work.respond',id:'work',value:{done:true,note:'최종'}})).status,200);
    const reminder=makeMail('reminder',{to:[a.id,b.id],cc:[],body:'2026년 11월 2일까지 제출해 주세요.',workRequest:null,workReminderOf:'work'});
    assert.equal((await sync(admin,reminder)).status,200);
    const saved=await getMail(admin,'reminder');assert.deepEqual(saved.to,[b.id]);assert.equal(saved.workReminderOf,'work');assert.equal(saved.workRequest,undefined);
    const snapshot=(await call('/bootstrap',undefined,b.token)).data;assert.ok(![...snapshot.events,...snapshot.deadlines].some(item=>item.source?.id==='reminder'));
    assert.equal((await sync(o,makeMail('forged',{to:[b.id],cc:[],workRequest:null,workReminderOf:'work'}))).status,403);
    assert.equal((await sync(admin,makeMail('unrelated',{to:[o.id],cc:[],workRequest:null,workReminderOf:'work'}))).status,403);
    assert.equal((await sync(admin,makeMail('complete',{to:[a.id],cc:[],workRequest:null,workReminderOf:'work'}))).status,409);
  });
  await t.test('scheduled and recalled requests cannot be answered or searched by recipients',async()=>{
    assert.equal((await sync(admin,makeMail('scheduled',{scheduled:'2099-01-01T09:00:00+09:00'}))).status,200);
    assert.equal((await sync(a,{type:'mail.work.respond',id:'scheduled',value:{done:true}})).status,403);
    assert.equal((await sync(admin,makeMail('recalled',{to:[b.id],cc:[]}))).status,200);
    assert.equal((await sync(admin,{type:'mail.update',id:'recalled',folder:'sent',recall:true})).status,200);
    assert.equal((await sync(b,{type:'mail.work.respond',id:'recalled',value:{done:true}})).status,403);
    const found=await call('/search',{query:'검색검증'},b.token);assert.equal(found.status,200);assert.ok(!found.results.some(r=>['scheduled','recalled'].includes(r.id)));
  });
  await t.test('search excludes unauthorized and trashed mail and finds filenames',async()=>{
    assert.equal((await sync(admin,makeMail('file',{to:[a.id],cc:[],workRequest:null,files:[{name:'검색검증.PDF',data:'data:application/pdf;base64,dGVzdA=='}]}))).status,200);
    const result=await call('/search',{query:'검색검증',kind:'file'},a.token);assert.equal(result.total,1);assert.equal(result.results[0].fileIndex,0);assert.ok(!JSON.stringify(result).includes('base64'));
    assert.equal((await call('/search',{query:'검색검증'},o.token)).total,0);
    assert.equal((await sync(a,{type:'mail.update',id:'file',folder:'trash'})).status,200);
    assert.equal((await call('/search',{query:'검색검증',kind:'file'},a.token)).total,0);
    assert.equal((await call('/search',{from:'2026-11-01',until:'2026-10-01'},a.token)).status,400);
  });
  await t.test('search includes older than 500 chat messages, excludes other rooms and paginates',async()=>{
    const db=new DatabaseSync(path.join(dir,'dingdong.sqlite'));
    try{db.prepare('INSERT INTO rooms(id,name) VALUES(?,?)').run('history','지난 대화');db.prepare('INSERT INTO room_members(room_id,user_id) VALUES(?,?)').run('history',a.id);
      const insert=db.prepare('INSERT INTO messages(id,room_id,sender,payload) VALUES(?,?,?,?)');db.exec('BEGIN');for(let i=0;i<505;i++)insert.run('old-'+i,'history',a.id,JSON.stringify({text:i===0?'오래된검색검증':'페이지검증',date:'2026-10-30',time:'09:00'}));db.exec('COMMIT');
    }finally{db.close();}
    assert.equal((await call('/bootstrap',undefined,a.token)).data.rooms.find(r=>r.id==='history').messages.length,500);
    const old=await call('/search',{query:'오래된검색검증'},a.token);assert.equal(old.total,1);assert.equal(old.results[0].id,'old-0');
    assert.equal((await call('/search',{query:'오래된검색검증'},b.token)).total,0);
    const first=await call('/search',{query:'페이지검증',kind:'message'},a.token),second=await call('/search',{query:'페이지검증',kind:'message',offset:50},a.token);
    assert.equal(first.total,504);assert.equal(first.results.length,50);assert.equal(first.hasMore,true);assert.equal(new Set([...first.results,...second.results].map(r=>r.id)).size,100);
  });
  await t.test('calendar search respects personal ownership and shared event targets',async()=>{
    const db=new DatabaseSync(path.join(dir,'dingdong.sqlite'));
    try{const add=db.prepare('INSERT INTO events(id,owner,payload) VALUES(?,?,?)');add.run('private-event',a.id,JSON.stringify({title:'일정검색검증 개인',date:'2026-10-30',start:'09:00',end:'10:00',type:'personal',targets:[],note:'개인 정보'}));add.run('shared-event',a.id,JSON.stringify({title:'일정검색검증 공유',date:'2026-10-30',start:'10:00',end:'11:00',type:'group',targets:[b.id],note:'공유 내용'}));}finally{db.close();}
    assert.equal((await call('/search',{query:'일정검색검증',kind:'event'},a.token)).total,2);
    const shared=await call('/search',{query:'일정검색검증',kind:'event'},b.token);assert.equal(shared.total,1);assert.equal(shared.results[0].id,'shared-event');
    assert.equal((await call('/search',{query:'일정검색검증',kind:'event'},o.token)).total,0);
  });
  await t.test('completion responses survive a server restart',async()=>{
    await server.close();server=await startServer({allowLegacyMessages:true,port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:dir});
    const mail=await getMail(admin,'work');assert.equal(mail.workResponses[a.id].done,true);assert.equal(mail.workResponses[a.id].note,'최종');
  });
});
