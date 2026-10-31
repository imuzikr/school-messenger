'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const CHUNK=1024*1024,MAX_FILE=500*1024*1024,MAX_TOTAL=2*1024*1024*1024;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function filePath(root,id,suffix='.blob'){if(!/^[a-f0-9-]{36}$/.test(id))fail(400,'파일 식별자가 올바르지 않습니다.');return path.join(root,id+suffix);}
async function hashFile(file){const hash=createHash('sha256');for await(const part of fs.createReadStream(file,{highWaterMark:CHUNK}))hash.update(part);return hash.digest('hex');}
async function writeChunk(file,offset,data,total){
  if(!Number.isSafeInteger(offset)||offset<0||!Buffer.isBuffer(data)||data.length>CHUNK||offset+data.length>total)fail(413,'파일 조각 크기 또는 위치가 올바르지 않습니다.');
  const handle=await fs.promises.open(file,'r+');
  try{const size=(await handle.stat()).size;if(offset>size)fail(409,'파일 전송 위치를 다시 확인해 주세요.');
    if(offset<size){if(offset+data.length>size)fail(409,'파일 전송 위치가 겹칩니다.');const old=Buffer.alloc(data.length);await handle.read(old,0,old.length,offset);if(!old.equals(data))fail(409,'이미 받은 파일 조각과 다릅니다.');return size;}
    let written=0;while(written<data.length){const r=await handle.write(data,written,data.length-written,offset+written);if(!r.bytesWritten)throw Error('파일을 저장할 수 없습니다.');written+=r.bytesWritten;}await handle.sync();return offset+written;
  }finally{await handle.close();}
}
async function readChunk(file,offset,total){if(!Number.isSafeInteger(offset)||offset<0||offset>total)fail(400,'파일 읽기 위치가 올바르지 않습니다.');const handle=await fs.promises.open(file,'r');try{const data=Buffer.alloc(Math.min(CHUNK,total-offset)),{bytesRead}=await handle.read(data,0,data.length,offset);if(bytesRead!==data.length)throw Error('보관된 파일 길이가 다릅니다.');return data;}finally{await handle.close();}}
function serial(){const jobs=new Map();return (id,fn)=>{const job=(jobs.get(id)||Promise.resolve()).then(fn);const tail=job.catch(()=>{});jobs.set(id,tail);tail.finally(()=>{if(jobs.get(id)===tail)jobs.delete(id);});return job;};}
module.exports={CHUNK,MAX_FILE,MAX_TOTAL,fail,filePath,hashFile,writeChunk,readChunk,serial};
