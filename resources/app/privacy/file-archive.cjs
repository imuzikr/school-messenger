'use strict';
// PC transfer files carry a signed manifest and all keys needed for import.
// Older password-protected files use the same streaming attachment format.
const fs=require('node:fs'),{randomBytes,randomUUID,createCipheriv,createDecipheriv,createHash,createPrivateKey,createPublicKey,sign,verify}=require('node:crypto');
const archive=require('./archive.cjs'),io=require('./file-io.cjs');
const MAGIC=Buffer.from('DINGDONG-PC-ARCHIVE-2\n'),MAX_HEADER=256*1024*1024;
const TRANSFER_MAGIC=Buffer.from('DINGDONG-PC-ARCHIVE-3\n'),SIGNATURE_BYTES=64;
async function write(handle,data){let offset=0;while(offset<data.length){const r=await handle.write(data,offset,data.length-offset);if(!r.bytesWritten)throw Error('보관 파일을 저장할 수 없습니다.');offset+=r.bytesWritten;}}
async function read(handle,size){const data=Buffer.alloc(size);let offset=0;while(offset<size){const r=await handle.read(data,offset,size-offset);if(!r.bytesRead)throw Error('보관 파일이 잘렸거나 손상되었습니다.');offset+=r.bytesRead;}return data;}
const aad=b=>Buffer.from(JSON.stringify({id:b.id,bytes:b.bytes,sha256:b.sha256}));
async function save(c,destination,password){
  await c.initialize();const records=c.store.export(),ids=new Set(records.filter(r=>r.kind==='file'&&r.value.localFile).map(r=>r.value.localFile));
  const blobs=[...ids].map(id=>{const f=c.files.get(id);return {id,bytes:f.bytes,sha256:f.sha256,iv:randomBytes(12).toString('hex')};}),key=randomBytes(32);
  const manifest={version:1,server:c.server,user:c.user.id,records:records.filter(r=>!['file-staging','file-download'].includes(r.kind)&&(r.kind!=='file-blob'||ids.has(r.id)))};
  const portable=password===undefined;
  const value={version:portable?3:2,manifest,blobs,key:key.toString('hex')};
  const header=Buffer.from(portable?JSON.stringify(value):await archive.seal(value,password));
  if(header.length>MAX_HEADER)throw Error('메시지 기록이 보관 파일 한도를 초과했습니다.');
  const temporary=destination+'.'+randomUUID()+'.part';let handle;
  try{
    handle=await fs.promises.open(temporary,'wx',0o600);await write(handle,portable?TRANSFER_MAGIC:MAGIC);const size=Buffer.alloc(4);size.writeUInt32BE(header.length);await write(handle,size);await write(handle,header);
    if(portable)await write(handle,sign(null,header,createPrivateKey({key:c.identity.signing,format:'jwk'})));
    for(const blob of blobs){const cipher=createCipheriv('aes-256-gcm',key,Buffer.from(blob.iv,'hex'));cipher.setAAD(aad(blob));let bytes=0;const hash=createHash('sha256');
      for await(const part of fs.createReadStream(c.files.path(blob.id),{highWaterMark:io.CHUNK})){bytes+=part.length;hash.update(part);await write(handle,cipher.update(part));}
      if(bytes!==blob.bytes||hash.digest('hex')!==blob.sha256)throw Error('PC에 보관된 첨부 파일이 원본과 다릅니다.');await write(handle,cipher.final());await write(handle,cipher.getAuthTag());
    }
    await handle.sync();await handle.close();handle=null;await fs.promises.rename(temporary,destination);return {ok:true,files:blobs.length};
  }finally{if(handle)await handle.close();await fs.promises.rm(temporary,{force:true});key.fill(0);}
}
async function load(c,source,password){
  const handle=await fs.promises.open(source,'r'),staged=[],installed=[];let key;
  try{
    const size=(await handle.stat()).size;
    const magic=await read(handle,Math.min(MAGIC.length,size));
    const portable=magic.equals(TRANSFER_MAGIC);
    if(!portable&&!magic.equals(MAGIC)){
      if(size>MAX_HEADER)throw Error('이전 형식 보관 파일은 256 MB까지 가져올 수 있습니다.');
      const prefix=Buffer.concat([magic,await read(handle,Math.min(2048,size-magic.length))]);
      const dot=prefix.indexOf(46);
      let type;
      try{if(dot>0)type=JSON.parse(Buffer.from(prefix.subarray(0,dot).toString(),'base64url').toString()).typ;}catch{}
      if(!['dingdong-pc-archive-v1','ieum-pc-archive-v1'].includes(type))throw Error('띵동 PC 보관 파일이 아니거나 파일이 손상되었습니다.');
      if(password===undefined)return {needsPassword:true};
      const encrypted=prefix.toString('utf8')+await handle.readFile('utf8');
      return await require('../desktop/restore-history.cjs').restore(c,encrypted,password);
    }
    const length=(await read(handle,4)).readUInt32BE();if(length<1||length>MAX_HEADER||length>size-MAGIC.length-4)throw Error('보관 파일 머리 정보가 올바르지 않습니다.');
    if(!portable&&password===undefined)return {needsPassword:true};
    const header=await read(handle,length);let value;
    if(portable){
      const signature=await read(handle,SIGNATURE_BYTES);
      try{
        value=JSON.parse(header);
        const identities=value.manifest.records.filter(r=>r.kind==='identity'&&r.id==='current');
        if(identities.length!==1)throw Error();
        const identity=require('./crypto.cjs').publicIdentity(identities[0].value);
        if(!verify(null,header,createPublicKey({key:identity.signing,format:'jwk'}),signature))throw Error();
      }catch{throw Error('PC 이전 파일이 손상되었거나 서명이 올바르지 않습니다.');}
    }else value=await archive.open(header.toString('utf8'),password);
    const m=value.manifest;
    if(value.version!==(portable?3:2)||!m||m.server!==c.server||m.user!==c.user.id||!Array.isArray(m.records)||!Array.isArray(value.blobs)||! /^[a-f0-9]{64}$/.test(value.key))throw Error('같은 학교 서버와 계정의 보관 파일만 가져올 수 있습니다.');
    key=Buffer.from(value.key,'hex');let expected=MAGIC.length+4+length+(portable?SIGNATURE_BYTES:0);const ids=new Set();
    for(const blob of value.blobs){c.files.path(blob.id);if(ids.has(blob.id)||!Number.isSafeInteger(blob.bytes)||blob.bytes<0||blob.bytes>io.MAX_FILE||! /^[a-f0-9]{64}$/.test(blob.sha256)||! /^[a-f0-9]{24}$/.test(blob.iv))throw Error('보관 파일의 첨부 정보가 올바르지 않습니다.');ids.add(blob.id);expected+=blob.bytes+16;const meta=m.records.find(r=>r.kind==='file-blob'&&r.id===blob.id)?.value;if(!meta||meta.bytes!==blob.bytes||meta.sha256!==blob.sha256)throw Error('보관 파일의 첨부 목록이 일치하지 않습니다.');}
    if(expected!==size||m.records.some(r=>r.kind==='file'&&r.value?.localFile&&!ids.has(r.value.localFile)))throw Error('보관 파일에 첨부 데이터가 빠져 있거나 길이가 올바르지 않습니다.');
    for(const blob of value.blobs){const temporary=c.files.path(blob.id,'.restore-'+randomUUID()+'.part');staged.push({blob,temporary});const output=await fs.promises.open(temporary,'wx',0o600),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(blob.iv,'hex')),hash=createHash('sha256');decipher.setAAD(aad(blob));
      try{let remaining=blob.bytes;while(remaining){const part=decipher.update(await read(handle,Math.min(io.CHUNK,remaining)));remaining-=part.length;hash.update(part);await write(output,part);}decipher.setAuthTag(await read(handle,16));const last=decipher.final();hash.update(last);await write(output,last);if(hash.digest('hex')!==blob.sha256)throw Error('보관 파일의 첨부 내용이 손상되었습니다.');await output.sync();}finally{await output.close();}
    }
    // Validate every encrypted stream before installing any history or file.
    for(const {blob,temporary} of staged){const target=c.files.path(blob.id);if(fs.existsSync(target)){if((await fs.promises.stat(target)).size!==blob.bytes||await io.hashFile(target)!==blob.sha256)throw Error('현재 PC의 같은 첨부 파일이 다릅니다. 기존 기록을 유지했습니다.');}else{await fs.promises.rename(temporary,target);installed.push(target);}}
    const result=await require('../desktop/restore-history.cjs').restoreValue(c,m);installed.length=0;return {...result,files:value.blobs.length};
  }finally{await handle.close().catch(()=>{});for(const {temporary} of staged)await fs.promises.rm(temporary,{force:true});for(const file of installed)await fs.promises.rm(file,{force:true});key?.fill(0);}
}
module.exports={save,load,MAGIC};
