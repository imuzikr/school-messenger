'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('../privacy/crypto.cjs'),io=require('../privacy/file-io.cjs');
const RESERVE_BYTES=2*1024**3,ENTRY_MARGIN=64*1024;
const lowSpace='서버 저장 공간이 부족해 첨부파일 전송을 중단했습니다. 관리자에게 공간 확보를 요청한 뒤 보낸 메시지함에서 다시 보내 주세요.';
function volumeFreeBytes(root){
  const volume=fs.statfsSync(root);return volume.bavail*(volume.frsize||volume.bsize);
}
function diskFull(error){return ['ENOSPC','EDQUOT','SQLITE_FULL'].includes(error.code)||(error.errcode&255)===13;}
function createFiles(db,{dataDir,now=Date.now,freeBytes=volumeFreeBytes}){
  const root=path.join(dataDir,'relay-files'),locked=io.serial();fs.mkdirSync(root,{recursive:true,mode:0o700});
  db.exec('CREATE TABLE IF NOT EXISTS relay_blobs(id TEXT PRIMARY KEY,secret_hash TEXT NOT NULL,bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,mime TEXT NOT NULL,complete INTEGER NOT NULL DEFAULT 0,expires_at INTEGER NOT NULL DEFAULT 0,staged_owner TEXT,staged_until INTEGER);');
  if(!db.prepare('PRAGMA table_info(relay_blobs)').all().some(c=>c.name==='received_bytes'))db.exec('ALTER TABLE relay_blobs ADD COLUMN received_bytes INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS relay_blobs_unfinished ON relay_blobs(complete) WHERE complete=0');
  db.exec('CREATE INDEX IF NOT EXISTS relay_blobs_expiry ON relay_blobs(expires_at) WHERE expires_at>0; CREATE INDEX IF NOT EXISTS relay_blobs_staged ON relay_blobs(staged_until) WHERE staged_until IS NOT NULL');
  const pending=db.prepare('SELECT coalesce(sum(bytes-received_bytes),0) AS bytes FROM relay_blobs WHERE complete=0');
  const location=(id,suffix)=>io.filePath(root,id,suffix);
  // A crash can leave durable bytes ahead of the SQLite progress record, including after rename.
  for(const row of db.prepare('SELECT id,bytes,received_bytes FROM relay_blobs WHERE complete=0').all()){
    const stat=fs.statSync(location(row.id,'.part'),{throwIfNoEntry:false})||fs.statSync(location(row.id),{throwIfNoEntry:false});
    const size=Math.min(stat?.size||0,row.bytes);
    if(size!==row.received_bytes)db.prepare('UPDATE relay_blobs SET received_bytes=? WHERE id=?').run(size,row.id);
  }
  let writing=0;
  function headroom(){
    let free;try{free=freeBytes(root);}catch{}
    if(!Number.isFinite(free)||free<0)io.fail(507,'서버의 남은 저장 공간을 확인하지 못했습니다. 관리자 확인 후 보낸 메시지함에서 다시 보내 주세요.');
    return free-RESERVE_BYTES;
  }
  function requireSpace(bytes){if(headroom()<pending.get().bytes+bytes+ENTRY_MARGIN)io.fail(507,lowSpace);}
  function space(){
    const reserved=pending.get().bytes;
    try{return {reserve:RESERVE_BYTES,reserved,available:Math.max(0,headroom()-reserved-ENTRY_MARGIN)};}
    catch{return {reserve:RESERVE_BYTES,reserved,available:null};}
  }
  function authorized(user,p,upload=false){const row=db.prepare('SELECT * FROM relay_blobs WHERE id=?').get(String(p.id||''));if(!row)io.fail(410,'보관 기간이 끝났거나 첨부 파일이 삭제되었습니다.');if(typeof p.secret!=='string'||crypto.digest(p.secret)!==row.secret_hash)io.fail(403,'첨부 파일 접근 증표가 올바르지 않습니다.');if(upload){if(row.staged_owner!==user.id&&!row.complete)io.fail(403,'본인의 파일만 올릴 수 있습니다.');}else if(!row.complete||!row.expires_at)io.fail(403,'파일이 아직 발송되지 않았습니다.');if(row.expires_at&&row.expires_at<=now()||row.staged_until&&row.staged_until<=now())io.fail(410,'첨부 파일 보관 기간이 끝났습니다.');return row;}
  async function handle(user,action,p){return locked(String(p.id),async()=>{
    if(action==='start'){
      location(p.id);if(!/^[a-f0-9]{64}$/.test(p.secret)||!Number.isSafeInteger(p.bytes)||p.bytes<0||p.bytes>io.MAX_FILE||! /^[a-f0-9]{64}$/.test(p.sha256)||typeof p.mime!=='string'||p.mime.length>100)io.fail(413,'파일 정보 또는 500 MB 크기 제한을 확인해 주세요.');
      let old=db.prepare('SELECT * FROM relay_blobs WHERE id=?').get(p.id);
      if(old&&((old.staged_until&&old.staged_until<=now())||(old.expires_at&&old.expires_at<=now()))){remove(p.id);old=null;}
      if(old){old=authorized(user,p,true);if(old.bytes!==p.bytes||old.sha256!==p.sha256||old.mime!==p.mime)io.fail(409,'첨부 파일 식별자가 중복되었습니다.');}
      else{
        // No await between checking other reservations and recording this one.
        db.exec('BEGIN IMMEDIATE');
        try{
          requireSpace(p.bytes);
          db.prepare('INSERT INTO relay_blobs(id,secret_hash,bytes,sha256,mime,staged_owner,staged_until) VALUES(?,?,?,?,?,?,?)').run(p.id,crypto.digest(p.secret),p.bytes,p.sha256,p.mime,user.id,now()+86400000);
          db.exec('COMMIT');
        }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
        try{fs.writeFileSync(location(p.id,'.part'),Buffer.alloc(0),{mode:0o600});}
        catch(error){db.prepare('DELETE FROM relay_blobs WHERE id=?').run(p.id);throw error;}
      }
      const complete=!!old?.complete,file=location(p.id,complete?'.blob':'.part');
      // Recover a crash between the atomic rename and the metadata commit.
      if(!complete&&!fs.existsSync(file)){
        if(fs.existsSync(location(p.id))){if(await io.hashFile(location(p.id))!==p.sha256)io.fail(409,'올린 파일을 다시 확인해 주세요.');db.prepare('UPDATE relay_blobs SET complete=1,received_bytes=bytes WHERE id=?').run(p.id);return {complete:true,offset:p.bytes};}
        // The reservation was committed but the process stopped before creating the part file.
        fs.writeFileSync(file,Buffer.alloc(0),{flag:'wx',mode:0o600});
      }
      const offset=(await fs.promises.stat(file)).size;
      if(old&&!complete&&offset!==old.received_bytes)db.prepare('UPDATE relay_blobs SET received_bytes=? WHERE id=?').run(offset,p.id);
      return {complete,offset};
    }
    const row=authorized(user,p,['chunk','finish'].includes(action));
    if(action==='info')return {bytes:row.bytes,sha256:row.sha256,mime:row.mime,expiresAt:row.expires_at};
    if(action==='read'){const data=await io.readChunk(location(row.id),p.offset,row.bytes);return {data:data.toString('base64'),offset:p.offset+data.length};}
    if(action==='chunk'){
      if(row.complete)return {offset:row.bytes};
      if(typeof p.data!=='string'||p.data.length>Math.ceil(io.CHUNK/3)*4||! /^[A-Za-z0-9+/]*={0,2}$/.test(p.data)||p.data.length%4!==0)io.fail(413,'파일 조각 형식이 올바르지 않습니다.');
      const data=Buffer.from(p.data,'base64');
      if(!Number.isSafeInteger(p.offset)||p.offset<0||p.offset+data.length>row.bytes)io.fail(413,'파일 조각 크기 또는 위치가 올바르지 않습니다.');
      const growth=Math.min(data.length,Math.max(0,p.offset+data.length-row.received_bytes));
      // External programs can consume a reservation. Count concurrent writes before yielding to disk I/O.
      if(growth&&headroom()<writing+growth)io.fail(507,lowSpace);
      writing+=growth;
      try{
        const offset=await io.writeChunk(location(row.id,'.part'),p.offset,data,row.bytes);
        db.prepare('UPDATE relay_blobs SET received_bytes=?,staged_until=? WHERE id=?').run(offset,now()+86400000,row.id);return {offset};
      }finally{writing-=growth;}
    }
    if(action==='finish'){
      if(row.complete)return {ok:true};const file=location(row.id,'.part');if((await fs.promises.stat(file)).size!==row.bytes)io.fail(409,'파일 전송이 아직 끝나지 않았습니다.');if(await io.hashFile(file)!==row.sha256)io.fail(409,'첨부 파일이 발신자의 원본과 일치하지 않습니다.');await fs.promises.rename(file,location(row.id));db.prepare('UPDATE relay_blobs SET complete=1,staged_until=? WHERE id=?').run(now()+86400000,row.id);return {ok:true};
    }
    io.fail(404,'파일 전송 기능을 찾을 수 없습니다.');
  });}
  function remove(id){for(const suffix of ['.blob','.part'])fs.rmSync(location(id,suffix),{force:true});db.prepare('DELETE FROM relay_blobs WHERE id=?').run(id);}
  async function cleanup(){
    const expired='(expires_at>0 AND expires_at<=?) OR (staged_until IS NOT NULL AND staged_until<=?)';
    const rows=db.prepare('SELECT id FROM relay_blobs WHERE '+expired).all(now(),now());
    const stillExpired=db.prepare('SELECT 1 FROM relay_blobs WHERE id=? AND ('+expired+')');
    let firstError;
    for(const {id} of rows){
      try{
        await locked(id,async()=>{
          if(!stillExpired.get(id,now(),now()))return;
          for(const suffix of ['.blob','.part'])await fs.promises.rm(location(id,suffix),{force:true});
          db.prepare('DELETE FROM relay_blobs WHERE id=?').run(id);
        });
      }catch(error){firstError??=error;}
    }
    if(firstError)throw firstError;
  }
  return {handle,cleanup,remove,requireSpace,space};
}
module.exports={createFiles,RESERVE_BYTES,diskFull,lowSpace};
