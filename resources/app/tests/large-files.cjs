'use strict';
// Opt-in actual 500 MiB / aggregate 2 GiB local HTTPS exercise. Synthetic zeros;
// records only timings/memory/digests. Fixture files are removed on completion.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('./helpers/transfer-fixture.cjs'),io=require('../privacy/file-io.cjs');
const run=path.resolve(__dirname,'../../../.artifacts/large-files',String(Date.now()));fs.mkdirSync(run,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
fixture(async({a,b,users,sql,root,advance})=>{
  let peakRss=process.memoryUsage().rss,maxDelay=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxDelay=Math.max(maxDelay,now-last-25);last=now;peakRss=Math.max(peakRss,process.memoryUsage().rss);},25);
  try{
    async function make(name,bytes){const f=await a.stageAttachment('begin',{name,bytes,mime:'application/octet-stream'});fs.truncateSync(a.files.path(f.localFile,'.part'),bytes);return a.stageAttachment('finish',f);}
    const big=await make('500MB-fixture.bin',io.MAX_FILE),tail=await make('48MB-fixture.bin',48*1024*1024),files=[big,big,big,big,tail].map((f,i)=>({...f,name:i+'-'+f.name})),started=performance.now();
    assert.equal(files.reduce((n,f)=>n+f.bytes,0),io.MAX_TOTAL);
    const sent=await a.request('/sync',{operations:[{type:'mail.send',value:{id:'actual-two-gib',title:'합성 대용량 검증',body:'2 GiB 경계값 시험',to:[users.b.id],cc:[],files}}]});assert.equal(sent.queued,true);
    let nextReport=0;
    while(a.store.all('relay-outbox').length){await pause(50);await a.request('/bootstrap');assert.equal(a.store.all('relay-failed').length,0);if(performance.now()>nextReport){console.log(JSON.stringify({phase:'upload',seconds:Math.round((performance.now()-started)/1000),rssMB:Math.round(process.memoryUsage().rss/1024/1024)}));nextReport=performance.now()+15000;}if(performance.now()-started>900000)throw Error('upload exceeded 15 minutes');}
    const uploadMs=performance.now()-started,received=await b.request('/bootstrap'),mail=received.data.mails.find(m=>m.id==='actual-two-gib');assert.equal(mail.files.length,5);assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[mail.relayPacket])[0].n,0);
    const dl=performance.now(),downloaded=await b.request('/attachment',{mail:mail.id,index:0}),downloadMs=performance.now()-dl;assert.equal(fs.statSync(b.files.path(downloaded.file.localFile)).size,io.MAX_FILE);assert.equal(await io.hashFile(b.files.path(downloaded.file.localFile)),big.sha256);
    const archivePath=path.join(root,'large-backup.dingdong'),pass='Synthetic-500MB-backup-password-123',backupAt=performance.now();await b.exportArchiveFile(archivePath,pass);const backupMs=performance.now()-backupAt;assert.ok(fs.statSync(archivePath).size>io.MAX_FILE);
    await advance(10*86400000+1);await a.request('/bootstrap');assert.equal(sql('SELECT COUNT(*) n FROM relay_blobs')[0].n,0);assert.equal(fs.readdirSync(path.join(root,'server/relay-files')).length,0);assert.equal((await b.request('/attachment',{mail:mail.id,index:0})).file.localFile,downloaded.file.localFile);
    const result={ok:true,fileBytes:io.MAX_FILE,messageBytes:io.MAX_TOTAL,uploadMs,downloadMs,backupMs,peakProcessRssMB:Math.round(peakRss/1024/1024),maxEventLoopDelayMs:Math.round(maxDelay),scope:'Server and Node client in one process on this PC; not a school network throughput measurement',serverFilesDeletedAfterTenDays:true,downloadedFilePreserved:true,sourceDigest:big.sha256};fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({run,...result}));
  }finally{clearInterval(timer);}
}).catch(error=>{console.error(error);process.exitCode=1;});
