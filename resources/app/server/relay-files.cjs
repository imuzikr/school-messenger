'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('../privacy/crypto.cjs'),io=require('../privacy/file-io.cjs');
function createFiles(db,{dataDir,now=Date.now}){
  const root=path.join(dataDir,'relay-files'),locked=io.serial();fs.mkdirSync(root,{recursive:true,mode:0o700});
  db.exec('CREATE TABLE IF NOT EXISTS relay_blobs(id TEXT PRIMARY KEY,secret_hash TEXT NOT NULL,bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,mime TEXT NOT NULL,complete INTEGER NOT NULL DEFAULT 0,expires_at INTEGER NOT NULL DEFAULT 0,staged_owner TEXT,staged_until INTEGER);');
  function authorized(user,p,upload=false){const row=db.prepare('SELECT * FROM relay_blobs WHERE id=?').get(String(p.id||''));if(!row)io.fail(410,'보관 기간이 끝났거나 첨부 파일이 삭제되었습니다.');if(typeof p.secret!=='string'||crypto.digest(p.secret)!==row.secret_hash)io.fail(403,'첨부 파일 접근 증표가 올바르지 않습니다.');if(upload){if(row.staged_owner!==user.id&&!row.complete)io.fail(403,'본인의 파일만 올릴 수 있습니다.');}else if(!row.complete||!row.expires_at)io.fail(403,'파일이 아직 발송되지 않았습니다.');if(row.expires_at&&row.expires_at<=now()||row.staged_until&&row.staged_until<=now())io.fail(410,'첨부 파일 보관 기간이 끝났습니다.');return row;}
  const location=(id,suffix)=>io.filePath(root,id,suffix);
  async function handle(user,action,p){return locked(String(p.id),async()=>{
    if(action==='start'){
      location(p.id);if(!/^[a-f0-9]{64}$/.test(p.secret)||!Number.isSafeInteger(p.bytes)||p.bytes<0||p.bytes>io.MAX_FILE||! /^[a-f0-9]{64}$/.test(p.sha256)||typeof p.mime!=='string'||p.mime.length>100)io.fail(413,'파일 정보 또는 500 MB 크기 제한을 확인해 주세요.');
      cleanup();
      let old=db.prepare('SELECT * FROM relay_blobs WHERE id=?').get(p.id);
      if(old){old=authorized(user,p,true);if(old.bytes!==p.bytes||old.sha256!==p.sha256||old.mime!==p.mime)io.fail(409,'첨부 파일 식별자가 중복되었습니다.');}
      else{await fs.promises.writeFile(location(p.id,'.part'),Buffer.alloc(0),{flag:'w',mode:0o600});db.prepare('INSERT INTO relay_blobs(id,secret_hash,bytes,sha256,mime,staged_owner,staged_until) VALUES(?,?,?,?,?,?,?)').run(p.id,crypto.digest(p.secret),p.bytes,p.sha256,p.mime,user.id,now()+86400000);}
      const complete=!!old?.complete,file=location(p.id,complete?'.blob':'.part');
      // Recover a crash between the atomic rename and the metadata commit.
      if(!complete&&!fs.existsSync(file)&&fs.existsSync(location(p.id))){if(await io.hashFile(location(p.id))!==p.sha256)io.fail(409,'올린 파일을 다시 확인해 주세요.');db.prepare('UPDATE relay_blobs SET complete=1 WHERE id=?').run(p.id);return {complete:true,offset:p.bytes};}
      return {complete,offset:(await fs.promises.stat(file)).size};
    }
    const row=authorized(user,p,['chunk','finish'].includes(action));
    if(action==='info')return {bytes:row.bytes,sha256:row.sha256,mime:row.mime,expiresAt:row.expires_at};
    if(action==='read'){const data=await io.readChunk(location(row.id),p.offset,row.bytes);return {data:data.toString('base64'),offset:p.offset+data.length};}
    if(action==='chunk'){
      if(row.complete)return {offset:row.bytes};
      if(typeof p.data!=='string'||p.data.length>Math.ceil(io.CHUNK/3)*4||! /^[A-Za-z0-9+/]*={0,2}$/.test(p.data)||p.data.length%4!==0)io.fail(413,'파일 조각 형식이 올바르지 않습니다.');
      const offset=await io.writeChunk(location(row.id,'.part'),p.offset,Buffer.from(p.data,'base64'),row.bytes);db.prepare('UPDATE relay_blobs SET staged_until=? WHERE id=?').run(now()+86400000,row.id);return {offset};
    }
    if(action==='finish'){
      if(row.complete)return {ok:true};const file=location(row.id,'.part');if((await fs.promises.stat(file)).size!==row.bytes)io.fail(409,'파일 전송이 아직 끝나지 않았습니다.');if(await io.hashFile(file)!==row.sha256)io.fail(409,'첨부 파일이 발신자의 원본과 일치하지 않습니다.');await fs.promises.rename(file,location(row.id));db.prepare('UPDATE relay_blobs SET complete=1,staged_until=? WHERE id=?').run(now()+86400000,row.id);return {ok:true};
    }
    io.fail(404,'파일 전송 기능을 찾을 수 없습니다.');
  });}
  function remove(id){for(const suffix of ['.blob','.part'])fs.rmSync(location(id,suffix),{force:true});db.prepare('DELETE FROM relay_blobs WHERE id=?').run(id);}
  function cleanup(){for(const row of db.prepare('SELECT id FROM relay_blobs WHERE (expires_at>0 AND expires_at<=?) OR (staged_until IS NOT NULL AND staged_until<=?)').all(now(),now()))remove(row.id);}
  return {handle,cleanup,remove};
}
module.exports={createFiles};
