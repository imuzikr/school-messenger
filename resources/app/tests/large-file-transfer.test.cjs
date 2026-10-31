'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixture=require('./helpers/transfer-fixture.cjs'),io=require('../privacy/file-io.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function file(c,bytes=8*io.CHUNK){const staged=await c.stageAttachment('begin',{name:'시험자료.bin',bytes,mime:'application/octet-stream'});for(let offset=0;offset<bytes;offset+=io.CHUNK)await c.stageAttachment('chunk',{localFile:staged.localFile,offset,data:Buffer.alloc(Math.min(io.CHUNK,bytes-offset),37)});return c.stageAttachment('finish',staged);}
async function drain(c){for(let i=0;i<200;i++){await c.request('/bootstrap');if(!c.store.all('relay-outbox').length)return;await pause(25);}throw Error('file upload did not finish');}
const send=(c,id,to,files,extra={})=>c.request('/sync',{operations:[{type:'mail.send',value:{id,title:'파일 전달 시험',body:'합성 파일입니다.',to,cc:[],files,...extra}}]});
test('chunked files resume across lost replies and server/client restart while incoming mail still works',()=>fixture(async({a,b,c,users,send:plainSend,sql,make,restart,root,advance,backup})=>{
  const attachment=await file(a),raw=a.raw;let dropped=false;
  a.raw=async(route,p)=>{const r=await raw(route,p);if(route==='/relay/blob/chunk'&&p.offset===2*io.CHUNK&&!dropped){dropped=true;throw Error('fixture connection lost after durable chunk');}return r;};
  assert.equal((await send(a,'big-resume',[users.b.id],[attachment])).queued,true);
  await plainSend(c,'incoming-during-upload',[users.a.id]);assert.ok((await a.request('/bootstrap')).data.mails.some(m=>m.id==='incoming-during-upload'));
  for(let i=0;i<200&&!dropped;i++)await pause(10);assert.ok(dropped);await Promise.all([...a.uploadJobs.values()].map(j=>j.promise));
  assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[a.store.get('mail-history','big-resume').relayPacket])[0].n,0,'the message cannot be delivered before its file upload finishes');
  a.close();await restart();const reopened=make('a');await drain(reopened);assert.equal(reopened.store.get('mail-history','big-resume').pendingDelivery,false);
  const received=await b.request('/bootstrap'),mail=received.data.mails.find(m=>m.id==='big-resume');assert.equal(mail.files[0].bytes,attachment.bytes);assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[mail.relayPacket])[0].n,0);
  let interrupted=false;const bRaw=b.raw;b.raw=async(route,p)=>{if(route==='/relay/blob/read'&&p.offset===3*io.CHUNK&&!interrupted){interrupted=true;throw Error('fixture connection lost while downloading');}return bRaw(route,p);};
  await assert.rejects(b.request('/attachment',{mail:mail.id,index:0}),/connection lost/);b.close();const receiver=make('b');
  const downloaded=await receiver.request('/attachment',{mail:mail.id,index:0});assert.equal(downloaded.file.data,undefined);assert.equal(await io.hashFile(receiver.files.path(downloaded.file.localFile)),attachment.sha256);
  assert.equal(sql('SELECT COUNT(*) n FROM relay_blobs')[0].n,1);const dbBackup=path.join(root,'server-backup.sqlite');backup(dbBackup);const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(dbBackup);assert.equal(db.prepare('SELECT COUNT(*) n FROM relay_blobs').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM relay_positions').get().n,0);db.close();
  await send(receiver,'forwarded',[users.c.id],[downloaded.file]);await drain(receiver);await c.request('/bootstrap');assert.equal((await c.request('/attachment',{mail:'forwarded',index:0})).file.sha256,attachment.sha256);
  await advance(10*86400000+1);await receiver.request('/bootstrap');assert.equal(sql('SELECT COUNT(*) n FROM relay_blobs')[0].n,0);assert.equal(fs.readdirSync(path.join(root,'server/relay-files')).length,0);assert.equal((await receiver.request('/attachment',{mail:mail.id,index:0})).file.localFile,downloaded.file.localFile);
}));
test('file size and total are enforced before queuing, with image and legacy attachment compatibility',()=>fixture(async({a,b,users})=>{
  await assert.rejects(a.stageAttachment('begin',{name:'too-large.bin',bytes:io.MAX_FILE+1}),/500 MB/);
  const f=await file(a,0);assert.equal(f.bytes,0);await send(a,'empty-file',[users.b.id],[f]);await drain(a);await b.request('/bootstrap');assert.equal((await b.request('/attachment',{mail:'empty-file',index:0})).file.bytes,0);
  const actual=a.files.get.bind(a.files);a.files.get=id=>({...actual(id),bytes:io.MAX_FILE});
  await assert.rejects(send(a,'over-total',[users.b.id],Array(5).fill(f)),/2 GB/);assert.equal(a.store.get('mail-history','over-total'),null);a.files.get=actual;
}));
test('portable encrypted backups include disk files, preserve old backups on failure and reject damaged files atomically',()=>fixture(async({a,b,users,root,make})=>{
  const f=await file(a,3*io.CHUNK),password='Synthetic-file-backup-password-123',target=path.join(root,'portable.dingdong');await send(a,'archive-file',[users.b.id],[f]);await drain(a);await b.request('/bootstrap');await a.request('/bootstrap');
  assert.equal((await a.exportArchiveFile(target,password)).files,1);const previous=await fs.promises.readFile(target);
  assert.ok(!previous.includes(Buffer.from('시험자료.bin')));assert.ok(!previous.includes(Buffer.alloc(io.CHUNK,37)));
  const rename=fs.promises.rename;fs.promises.rename=async(from,to)=>{if(to===target)throw Error('fixture replacement failure');return rename(from,to);};
  try{await assert.rejects(a.exportArchiveFile(target,password),/replacement failure/);}finally{fs.promises.rename=rename;}
  assert.deepEqual(await fs.promises.readFile(target),previous);assert.ok(!fs.readdirSync(root).some(n=>n.startsWith('portable.dingdong.')&&n.endsWith('.part')));
  a.close();fs.renameSync(path.join(root,'a'),path.join(root,'a-old'));const fresh=make('a'),corrupt=path.join(root,'damaged.dingdong'),changed=Buffer.from(previous);changed[changed.length-1]^=1;fs.writeFileSync(corrupt,changed);
  await assert.rejects(fresh.importArchiveFile(corrupt,password));assert.equal(fresh.store.export().length,0);assert.equal(fs.readdirSync(fresh.files.root).length,0);
  assert.deepEqual(await fresh.importArchiveFile(target),{needsPassword:true});assert.equal(fresh.store.export().length,0);
  await assert.rejects(fresh.importArchiveFile(target,'wrong-password-long-enough'));assert.equal(fresh.store.export().length,0);
  assert.equal((await fresh.importArchiveFile(target,password)).files,1);const restored=await fresh.request('/attachment',{mail:'archive-file',index:0});assert.equal(await io.hashFile(fresh.files.path(restored.file.localFile)),f.sha256);
  assert.equal(fresh.store.get('mail-history','archive-file').pendingDelivery,false);
}));
test('copy one passwordless transfer file to a new PC and continue using the original identity',()=>fixture(async({a,b,users,root,make,send:plainSend})=>{
  const f=await file(a,io.CHUNK+17);
  await send(a,'before-switch',[users.b.id],[f]);await drain(a);await b.request('/bootstrap');
  await plainSend(b,'inbox-before-switch',[users.a.id]);await a.request('/bootstrap');
  const originalKey=(await a.security()).fingerprint;
  const from=path.join(root,'old.dingdong'),copy=path.join(root,'copied.dingdong');
  assert.equal((await a.exportArchiveFile(from)).files,1);await fs.promises.copyFile(from,copy);
  const beforeOther=b.store.export();
  await assert.rejects(b.importArchiveFile(copy),/같은 학교 서버와 계정/);assert.deepEqual(b.store.export(),beforeOther);
  a.close();fs.renameSync(path.join(root,'a'),path.join(root,'original-pc'));
  const newPC=make('a');
  // The actual login path tries to register a fresh key before the user imports.
  await assert.rejects(newPC.initialize(),/기존 PC/);
  const baseline=newPC.store.export();
  const raw=fs.readFileSync(copy),bad=path.join(root,'damaged.dingdong');
  const headerStart=raw.indexOf(10)+5,signatureStart=headerStart+raw.readUInt32BE(headerStart-4);
  for(const offset of [signatureStart,raw.length-1]){
    const damaged=Buffer.from(raw);damaged[offset]^=1;fs.writeFileSync(bad,damaged);
    await assert.rejects(newPC.importArchiveFile(bad));
    assert.deepEqual(newPC.store.export(),baseline);assert.deepEqual(fs.readdirSync(newPC.files.root),[]);
  }
  assert.equal((await newPC.importArchiveFile(copy)).files,1);
  assert.equal((await newPC.security()).fingerprint,originalKey);
  assert.equal((await newPC.importArchiveFile(copy)).reviewRequired,0);
  const {data}=await newPC.request('/bootstrap');
  assert.equal(data.mails.filter(m=>m.id==='before-switch'&&m.folder==='sent').length,1);
  assert.equal(data.mails.filter(m=>m.id==='inbox-before-switch'&&m.folder==='inbox').length,1);
  const attachment=(await newPC.request('/attachment',{mail:'before-switch',index:0})).file;
  assert.equal(await io.hashFile(newPC.files.path(attachment.localFile)),f.sha256);
  await plainSend(b,'after-switch',[users.a.id]);
  assert.ok((await newPC.request('/bootstrap')).data.mails.some(m=>m.id==='after-switch'));
  await plainSend(newPC,'reply-after-switch',[users.b.id]);
  assert.ok((await b.request('/bootstrap')).data.mails.some(m=>m.id==='reply-after-switch'));
}));
test('legacy single-record archives ask for their original password only after selection',()=>fixture(async({a,root,make})=>{
  const password='Fixture-password-legacy-123',oldFile=path.join(root,'old.ieum');
  fs.writeFileSync(oldFile,await a.exportArchive(password));
  a.close();fs.renameSync(path.join(root,'a'),path.join(root,'original-pc'));
  const fresh=make('a');
  assert.deepEqual(await fresh.importArchiveFile(oldFile),{needsPassword:true});
  await assert.rejects(fresh.importArchiveFile(oldFile,'wrong-password-123'),/비밀번호/);
  assert.equal(fresh.store.export().length,0);assert.ok((await fresh.importArchiveFile(oldFile,password)).ok);
  fs.writeFileSync(oldFile,'invalid archive');await assert.rejects(fresh.importArchiveFile(oldFile),/손상/);
}));
test('scheduled disk attachments stay unavailable until dispatch, expire ten days later and are removed on recall',()=>fixture(async({a,b,users,root,sql,call,advance,clock})=>{
  const f=await file(a,3*io.CHUNK);await send(a,'scheduled-blob',[users.b.id],[f],{scheduled:new Date(Date.now()+3600000).toISOString()});await drain(a);
  const m=a.store.get('mail-history','scheduled-blob'),cap=m.files[0].relayFile;assert.equal((await call('b','/relay/blob/info',cap)).status,403);assert.equal(sql('SELECT expires_at FROM relay_blobs WHERE id=?',[cap.id])[0].expires_at,0);
  await a.request('/sync',{operations:[{type:'mail.update',id:m.id,recall:true}]});assert.equal(sql('SELECT COUNT(*) n FROM relay_blobs')[0].n,0);assert.equal(fs.readdirSync(path.join(root,'server/relay-files')).length,0);await b.request('/bootstrap');await a.request('/bootstrap');
  const releaseAt=Date.now()+60000;await send(a,'scheduled-release',[users.b.id],[f],{scheduled:new Date(releaseAt).toISOString()});await drain(a);await advance(releaseAt-clock()+1);const r=await b.request('/bootstrap'),mail=r.data.mails.find(m=>m.id==='scheduled-release');assert.ok(mail);assert.equal((await call('b','/relay/blob/info',{...mail.files[0].relayFile,secret:'0'.repeat(64)})).status,403);
  await advance(10*86400000-1);assert.equal((await call('b','/relay/blob/info',mail.files[0].relayFile)).status,200);await advance(2);assert.equal((await call('b','/relay/blob/info',mail.files[0].relayFile)).status,410);
}));
test('expired incomplete uploads restart from disk and altered duplicate chunks are rejected',()=>fixture(async({a,users,call,advance})=>{
  const {randomUUID,randomBytes,createHash}=require('node:crypto'),cap={id:randomUUID(),secret:randomBytes(32).toString('hex')},data=Buffer.from('ab'),start={...cap,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),mime:'application/octet-stream'};
  assert.equal((await call('a','/relay/blob/start',start)).offset,0);assert.equal((await call('a','/relay/blob/chunk',{...cap,offset:0,data:Buffer.from('a').toString('base64')})).offset,1);
  assert.equal((await call('a','/relay/blob/chunk',{...cap,offset:0,data:Buffer.from('x').toString('base64')})).status,409);
  await advance(86400000+1);assert.equal((await call('a','/relay/blob/start',start)).offset,0);assert.equal((await call('a','/relay/blob/chunk',{...cap,offset:0,data:data.toString('base64')})).offset,2);assert.equal((await call('a','/relay/blob/finish',cap)).ok,true);
}));
test('overlapping uploads reserve only unwritten bytes, including after upgrading and restarting',async()=>{
  const {RESERVE_BYTES}=require('../server/relay-files.cjs'),{randomUUID,randomBytes,createHash}=require('node:crypto');
  let free=RESERVE_BYTES+1.75*io.CHUNK;
  await fixture(async({call,root,sql,restart,advance})=>{
    const start=(bytes)=>({id:randomUUID(),secret:randomBytes(32).toString('hex'),bytes,sha256:createHash('sha256').update(Buffer.alloc(bytes)).digest('hex'),mime:'application/octet-stream'});
    const names=['a','b'],files=[start(io.CHUNK),start(io.CHUNK)];
    const replies=await Promise.all(files.map((f,i)=>call(names[i],'/relay/blob/start',f)));
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,507]);
    const winner=replies.findIndex(r=>r.status===200),owner=names[winner],f=files[winner],other=files[1-winner];
    assert.equal(fs.existsSync(path.join(root,'server/relay-files',other.id+'.part')),false);
    // Power loss between recording the reservation and creating the empty part file.
    fs.unlinkSync(path.join(root,'server/relay-files',f.id+'.part'));
    assert.equal((await call(owner,'/relay/blob/start',f)).offset,0);
    const half=io.CHUNK/2,chunk={...f,offset:0,data:Buffer.alloc(half).toString('base64')};
    assert.equal((await call(owner,'/relay/blob/chunk',chunk)).offset,half);free-=half;
    assert.equal((await call(owner,'/relay/blob/start',f)).offset,half);
    // Simulate a pre-upgrade server with a partial file and no progress column.
    sql('ALTER TABLE relay_blobs DROP COLUMN received_bytes',[],true);await restart();
    assert.equal(sql('SELECT received_bytes FROM relay_blobs WHERE id=?',[f.id])[0].received_bytes,half);
    assert.equal((await call('c','/relay/blob/start',other)).status,507);
    const fits=start(Math.floor(0.6*io.CHUNK));
    assert.equal((await call('c','/relay/blob/start',fits)).status,200);
    free=RESERVE_BYTES;
    assert.equal((await call(owner,'/relay/blob/chunk',chunk)).offset,half,'already stored chunk is safe to repeat');
    assert.equal((await call(owner,'/relay/blob/chunk',{...chunk,offset:half})).status,507);
    assert.equal((await call(owner,'/relay/blob/start',f)).offset,half);
    await advance(86400001);await call('c','/relay/pull');
    assert.equal(sql('SELECT count(*) n FROM relay_blobs')[0].n,0);
    free=RESERVE_BYTES+1.5*io.CHUNK;
    assert.equal((await call('c','/relay/blob/start',other)).status,200);
  },{attachmentFreeBytes:()=>free});
});

test('a disk-full partial write leaves mail usable; manual retry resumes the same attachment exactly once',async()=>{
  const {RESERVE_BYTES}=require('../server/relay-files.cjs');let free=RESERVE_BYTES+10*io.CHUNK;
  await fixture(async({a,b,users,root,sql,send:plainSend})=>{
    const small=await file(a,125),large=await file(a,2*io.CHUNK);
    await send(a,'accepted-before-shortage',[users.b.id],[small]);await drain(a);
    const original=io.writeChunk,partial=io.CHUNK+17,serverRoot=path.join(root,'server','relay-files')+path.sep;
    io.writeChunk=async(dest,offset,data,total)=>{
      if(dest.startsWith(serverRoot)&&offset===io.CHUNK){
        await original(dest,offset,data.subarray(0,17),total);free=RESERVE_BYTES;
        throw Object.assign(Error('fixture disk full'),{code:'ENOSPC'});
      }
      return original(dest,offset,data,total);
    };
    try{
      await send(a,'resume-after-space',[users.b.id],[large]);
      await plainSend(a,'behind-the-upload',[users.b.id]);await drain(a);
    }finally{io.writeChunk=original;}
    const failed=a.store.get('mail-history','resume-after-space'),cap=failed.files[0].relayFile;
    assert.equal(failed.sendError.status,507);assert.match(failed.sendError.message,/서버 저장 공간이 부족/);
    assert.equal(fs.statSync(path.join(serverRoot,cap.id+'.part')).size,partial);
    assert.equal((await plainSend(a,'text-while-full',[users.b.id])).delivery['text-while-full'],'sent');
    const {data}=await b.request('/bootstrap');
    for(const id of ['behind-the-upload','text-while-full','accepted-before-shortage'])assert.ok(data.mails.some(m=>m.id===id));
    assert.ok(!data.mails.some(m=>m.id==='resume-after-space'));
    assert.equal((await b.request('/attachment',{mail:'accepted-before-shortage',index:0})).file.sha256,small.sha256);
    const inline={name:'작은 그림.png',data:'data:image/png;base64,YQ=='};
    assert.equal((await send(a,'small-file-while-full',[users.b.id],[inline])).delivery['small-file-while-full'],'failed');
    assert.equal(a.store.get('mail-history','small-file-while-full').sendError.status,507);
    free=RESERVE_BYTES+5*io.CHUNK;let resumed;
    const raw=a.raw;a.raw=async(route,p)=>{const r=await raw(route,p);if(route==='/relay/blob/start'&&p.id===cap.id)resumed=r.offset;return r;};
    await a.request('/sync',{operations:[{type:'mail.retry',id:failed.id}]});await drain(a);
    assert.equal(resumed,partial);assert.ok(!a.store.get('mail-history',failed.id).sendError);
    assert.equal((await b.request('/bootstrap')).data.mails.filter(m=>m.id===failed.id).length,1);
    assert.equal((await b.request('/attachment',{mail:failed.id,index:0})).file.sha256,large.sha256);
    assert.equal(sql('SELECT count(*) n FROM relay_blobs WHERE id=?',[cap.id])[0].n,1);
  },{attachmentFreeBytes:()=>free});
});
test('unavailable volume statistics restrict new attachments without blocking reads or text',async()=>{
  const {RESERVE_BYTES}=require('../server/relay-files.cjs'),{randomUUID,randomBytes}=require('node:crypto');let readable=true;
  await fixture(async({a,b,users,call,send:plainSend})=>{
    const cap={id:randomUUID(),secret:randomBytes(32).toString('hex'),data:'data:text/plain;base64,YQ=='};
    assert.equal((await call('a','/relay/upload',cap)).status,200);readable=false;
    assert.equal((await call('a','/relay/upload',cap)).status,200,'exact repeat needs no new disk allocation');
    const blocked=await call('a','/relay/upload',{...cap,id:randomUUID()});
    assert.equal(blocked.status,507);assert.match(blocked.error,/확인하지 못/);
    await plainSend(a,'text-without-volume-stats',[users.b.id]);
    assert.ok((await b.request('/bootstrap')).data.mails.some(m=>m.id==='text-without-volume-stats'));
  },{attachmentFreeBytes:()=>{if(!readable)throw Error('fixture volume unavailable');return RESERVE_BYTES+io.CHUNK;}});
});
module.exports={file,drain,send};
