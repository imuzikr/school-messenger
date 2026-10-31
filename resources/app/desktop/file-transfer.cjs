'use strict';
const fs=require('node:fs'),io=require('../privacy/file-io.cjs');
async function upload(c,file){
  const info=file.blob,source=c.files.path(info.localFile),auth={id:file.id,secret:file.secret};
  const call=async(route,p)=>{if(c.closing||!c.uploadJobs.has(file.id))throw Error('파일 전송을 중지했습니다.');return c.api('/relay/blob/'+route,{...auth,...p});};
  const start=await call('start',{bytes:info.bytes,sha256:info.sha256,mime:info.mime});
  if(!Number.isSafeInteger(start.offset)||start.offset<0||start.offset>info.bytes)throw Error('서버 파일 전송 위치가 올바르지 않습니다.');
  let offset=start.offset;
  while(!start.complete&&offset<info.bytes){const data=await io.readChunk(source,offset,info.bytes),result=await call('chunk',{offset,data:data.toString('base64')});if(result.offset!==offset+data.length)throw Error('서버 파일 전송 위치가 일치하지 않습니다.');offset=result.offset;if(!c.closing)c.onTransfer({direction:'upload',id:file.id,name:info.name,done:offset,total:info.bytes});}
  if(!start.complete)await call('finish',{});
}
function uploadsReady(c,files){
  c.uploadJobs||=new Map();let pending=false;
  for(const file of files.filter(f=>f.blob)){
    let job=c.uploadJobs.get(file.id);
    if(job?.error){c.uploadJobs.delete(file.id);throw job.error;}
    if(!job){job={done:false};c.uploadJobs.set(file.id,job);job.promise=upload(c,file).then(()=>{job.done=true;},error=>{job.error=error;}).finally(()=>{if(!c.closing)c.onTransfer({direction:'upload',id:file.id,ready:true});});}
    if(!job.done)pending=true;
  }
  return !pending;
}
async function download(c,p){
  const key=p.mail+':'+p.index;
  const initial=await c.queueTask(async()=>{
    const cached=c.store.get('file',key);if(cached?.data)return {cached};
    if(cached?.localFile){try{const local=c.files.get(cached.localFile);if(await io.hashFile(c.files.path(local.localFile))===local.sha256)return {cached};}catch(error){if(error.status!==409&&error.code!=='ENOENT')throw error;}c.store.remove('file',key);}
    const mail=c.store.get('mail-history',p.mail),meta=mail?.files.find(f=>f.index===p.index);if(!meta)throw Error('첨부 파일 정보를 찾을 수 없습니다.');
    const pending=c.store.get('file-download',key);
    if(pending&&fs.existsSync(c.files.path(pending.localFile))){const local=c.store.get('file-staging',pending.localFile)?await c.files.finish(pending.localFile):c.files.get(pending.localFile);if(local.sha256===meta.sha256){const cached={...meta,...local,stored:true};c.store.put('file',key,cached);c.store.remove('file-download',key);return {cached};}}
    return {meta};
  });
  if(initial.cached)return {file:initial.cached};
  const meta=initial.meta;if(!meta.blob)return c.queueTask(()=>c.attachment(p));
  const call=async(action,value={})=>{if(c.closing)throw Error('파일 받기를 중지했습니다.');return c.api('/relay/blob/'+action,{...meta.relayFile,...value});};
  const info=await call('info');if(info.sha256!==meta.sha256||info.bytes!==meta.bytes)throw Error('첨부 파일이 발신자의 원본과 일치하지 않습니다.');
  let local=await c.queueTask(async()=>{
    const old=c.store.get('file-download',key);
    if(old&&c.store.get('file-staging',old.localFile))return old;
    const next=await c.files.begin({name:meta.name,bytes:meta.bytes,mime:info.mime});c.store.put('file-download',key,next);return next;
  });
  let offset=(await fs.promises.stat(c.files.path(local.localFile,'.part'))).size;
  while(offset<meta.bytes){const result=await call('read',{offset}),data=Buffer.from(result.data,'base64');if(!data.length||data.length>io.CHUNK||result.offset!==offset+data.length||result.offset>meta.bytes)throw Error('받은 파일 조각이 올바르지 않습니다.');
    const saved=await c.queueTask(()=>c.files.chunk({localFile:local.localFile,offset,data}));offset=saved.offset;c.onTransfer({direction:'download',id:meta.relayFile.id,name:meta.name,done:offset,total:meta.bytes});
  }
  if(await io.hashFile(c.files.path(local.localFile,'.part'))!==meta.sha256){await c.queueTask(async()=>{await c.files.cancel(local.localFile);c.store.remove('file-download',key);});throw Error('받은 파일이 발신자의 원본과 일치하지 않습니다. 다시 받아 주세요.');}
  const file=await c.queueTask(async()=>{const saved=await c.files.finish(local.localFile),file={...meta,...saved,expiresAt:info.expiresAt,stored:true};c.store.put('file',key,file);c.store.remove('file-download',key);return file;});return {file};
}
module.exports={uploadsReady,download};
