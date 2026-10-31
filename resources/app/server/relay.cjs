'use strict';
// Transient transport only. Payload type, original message identifiers, filenames,
// read/work state and room descriptors are inside the signed encrypted envelope.
const {randomUUID,randomBytes}=require('node:crypto');
const crypto=require('../privacy/crypto.cjs');
const {RETENTION}=require('./privacy.cjs');
const {MAX_TOTAL}=require('../privacy/file-io.cjs');
const json=JSON.stringify,parse=JSON.parse;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function createRelay(db,privacy,{now=Date.now,dataDir}={}){
  const blobs=require('./relay-files.cjs').createFiles(db,{dataDir,now});
  db.exec(`PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS relay_counters(user_id TEXT PRIMARY KEY,sequence INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS relay_packets(id TEXT PRIMARY KEY,sender TEXT NOT NULL,sequence INTEGER NOT NULL,context TEXT NOT NULL,sealed TEXT NOT NULL,digest TEXT NOT NULL,release_at INTEGER NOT NULL,released INTEGER NOT NULL,files TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS relay_targets(packet_id TEXT NOT NULL REFERENCES relay_packets(id) ON DELETE CASCADE,user_id TEXT NOT NULL,PRIMARY KEY(packet_id,user_id));
    CREATE INDEX IF NOT EXISTS relay_user ON relay_targets(user_id);
    CREATE TABLE IF NOT EXISTS relay_positions(position INTEGER PRIMARY KEY AUTOINCREMENT,packet_id TEXT UNIQUE NOT NULL REFERENCES relay_packets(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS relay_files(id TEXT PRIMARY KEY,secret_hash TEXT NOT NULL,data TEXT NOT NULL,expires_at INTEGER NOT NULL,staged_owner TEXT,staged_until INTEGER);
    CREATE TABLE IF NOT EXISTS relay_legacy_files(mail_id TEXT NOT NULL,idx INTEGER NOT NULL,id TEXT NOT NULL,secret TEXT NOT NULL,PRIMARY KEY(mail_id,idx));
    CREATE TABLE IF NOT EXISTS relay_migrated(kind TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(kind,id,user_id));`);
  // A monotonic page cursor lets a receiver pass quarantined packets without
  // acknowledging them. Only the numeric watermark survives packet deletion.
  db.exec('INSERT INTO relay_positions(packet_id) SELECT p.id FROM relay_packets p WHERE NOT EXISTS(SELECT 1 FROM relay_positions s WHERE s.packet_id=p.id) ORDER BY p.rowid;');
  // V1 kept delivery markers for superseded replies even after deleting their
  // content. These orphan transport markers have no remaining history record.
  db.exec(`DELETE FROM private_deliveries WHERE
    NOT EXISTS(SELECT 1 FROM private_content c WHERE c.kind=private_deliveries.kind AND c.id=private_deliveries.id)
    AND ((kind='response' AND NOT EXISTS(SELECT 1 FROM mail_work_responses w WHERE w.response_id=private_deliveries.id))
      OR (kind='mail' AND NOT EXISTS(SELECT 1 FROM mails m WHERE m.id=private_deliveries.id))
      OR (kind='message' AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.id=private_deliveries.id)));`);
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
  const sequence=user=>db.prepare('SELECT sequence FROM relay_counters WHERE user_id=?').get(user.id)?.sequence||0;
  function cleanup(){
    transaction(()=>{
      for(const packet of db.prepare('SELECT * FROM relay_packets WHERE released=0 AND release_at<=?').all(now())){
        for(const id of parse(packet.files))db.prepare('UPDATE relay_files SET expires_at=? WHERE id=? AND expires_at=0').run(now()+RETENTION,id);
        for(const id of parse(packet.files))db.prepare('UPDATE relay_blobs SET expires_at=? WHERE id=? AND expires_at=0').run(now()+RETENTION,id);
        db.prepare('UPDATE relay_packets SET released=1 WHERE id=?').run(packet.id);
      }
      db.prepare('DELETE FROM relay_packets WHERE released=1 AND NOT EXISTS(SELECT 1 FROM relay_targets WHERE packet_id=relay_packets.id)').run();
      db.prepare('DELETE FROM relay_files WHERE (expires_at>0 AND expires_at<=?) OR (staged_until IS NOT NULL AND staged_until<=?)').run(now(),now());
    });
    blobs.cleanup();
  }
  function upload(user,p){
    if(!/^[a-f0-9-]{36}$/.test(p.id)||! /^[a-f0-9]{64}$/.test(p.secret)||typeof p.data!=='string'||p.data.length>3*1024*1024||!/^data:[a-zA-Z0-9.+\/-]+;base64,[A-Za-z0-9+/=]*$/.test(p.data))fail(400,'첨부 파일 형식이 올바르지 않습니다.');
    if(Buffer.from(p.data.split(',')[1],'base64').length>2*1024*1024)fail(413,'첨부 파일은 한 개당 2MB까지 가능합니다.');
    const old=db.prepare('SELECT * FROM relay_files WHERE id=?').get(p.id);
    if(old){if(old.secret_hash!==crypto.digest(p.secret)||old.data!==p.data)fail(409,'첨부 파일 식별자가 중복되었습니다.');return {ok:true};}
    db.prepare('INSERT INTO relay_files VALUES(?,?,?,?,?,?)').run(p.id,crypto.digest(p.secret),p.data,0,user.id,now()+3600000);return {ok:true};
  }
  function file(user,p){
    cleanup();const row=db.prepare('SELECT * FROM relay_files WHERE id=?').get(String(p.id||''));
    if(!row)fail(410,'보관 기간이 끝났거나 첨부 파일이 삭제되었습니다.');
    if(typeof p.secret!=='string'||crypto.digest(p.secret)!==row.secret_hash)fail(403,'첨부 파일 접근 증표가 올바르지 않습니다.');
    if(row.expires_at===0)fail(403,'예약 메시지가 아직 발송되지 않았습니다.');
    return p.info?{expiresAt:row.expires_at}:{file:{data:row.data,expiresAt:row.expires_at}};
  }
  async function send(user,p){
    const ctx=p.context;
    if(!ctx||ctx.kind!=='relay'||ctx.sender!==user.id||ctx.room!==''||typeof ctx.id!=='string'||ctx.id.length>100||!Number.isSafeInteger(ctx.sequence)||ctx.sequence<1||!Array.isArray(ctx.targets)||ctx.targets.length>201||ctx.targets.some(id=>typeof id!=='string'||id.length>100))fail(400,'전달 요청 형식이 올바르지 않습니다.');
    const expected={...crypto.context('relay',ctx.id,user.id,ctx.targets),sequence:ctx.sequence,releaseAt:ctx.releaseAt,files:ctx.files};
    if(!Number.isSafeInteger(ctx.releaseAt)||ctx.releaseAt<0||!Array.isArray(ctx.files)||ctx.files.length>20||ctx.files.some(id=>typeof id!=='string'||id.length>100))fail(400,'예약 또는 첨부 정보가 올바르지 않습니다.');
    if(!privacy.key(user.id))fail(409,'발신자의 암호화 키가 없습니다.');
    try{await crypto.inspect(p.sealed,privacy.key(user.id),expected);}catch{fail(400,'메시지 서명을 확인할 수 없습니다.');}
    return transaction(()=>{
      // A per-account monotonic watermark survives delivery deletion. It contains
      // no message IDs or recipients and prevents replay after a lost HTTP reply.
      if(ctx.sequence<=sequence(user))return {ok:true,duplicate:true};
      for(const id of ctx.targets)if(!privacy.key(id)||!db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(id))fail(409,'수신 계정 또는 암호화 키를 확인해 주세요.');
      let bytes=0;for(const id of ctx.files){const f=db.prepare('SELECT * FROM relay_files WHERE id=?').get(id),blob=db.prepare('SELECT * FROM relay_blobs WHERE id=?').get(id);if(f){if(f.staged_owner!==user.id)fail(409,'첨부 파일을 다시 올려 주세요.');bytes+=Buffer.from(f.data.split(',')[1],'base64').length;}else{if(!blob?.complete||blob.staged_owner!==user.id)fail(409,'첨부 파일 전송을 마친 뒤 보내 주세요.');bytes+=blob.bytes;}}
      if(bytes>MAX_TOTAL)fail(413,'첨부 파일 총 크기는 2 GB까지 가능합니다.');
      const released=ctx.releaseAt<=now();
      db.prepare('INSERT INTO relay_packets VALUES(?,?,?,?,?,?,?,?,?)').run(ctx.id,user.id,ctx.sequence,json(expected),p.sealed,crypto.digest(p.sealed),ctx.releaseAt,released?1:0,json(ctx.files));
      db.prepare('INSERT INTO relay_positions(packet_id) VALUES(?)').run(ctx.id);
      for(const target of ctx.targets)if(target!==user.id)db.prepare('INSERT INTO relay_targets VALUES(?,?)').run(ctx.id,target);
      for(const id of ctx.files)db.prepare('UPDATE relay_files SET staged_owner=NULL,staged_until=NULL,expires_at=? WHERE id=?').run(released?now()+RETENTION:0,id);
      for(const id of ctx.files)db.prepare('UPDATE relay_blobs SET staged_owner=NULL,staged_until=NULL,expires_at=? WHERE id=?').run(released?now()+RETENTION:0,id);
      db.prepare('INSERT INTO relay_counters VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET sequence=excluded.sequence').run(user.id,ctx.sequence);
      if(released&&!ctx.targets.some(id=>id!==user.id))db.prepare('DELETE FROM relay_packets WHERE id=?').run(ctx.id);
      return {ok:true};
    });
  }
  function pull(user,after=0){
    if(!Number.isSafeInteger(after)||after<0)fail(400,'수신 위치가 올바르지 않습니다.');
    cleanup();const rows=db.prepare('SELECT p.*,s.position FROM relay_packets p JOIN relay_targets t ON t.packet_id=p.id JOIN relay_positions s ON s.packet_id=p.id WHERE t.user_id=? AND p.released=1 AND s.position>? ORDER BY s.position LIMIT 101').all(user.id,after);
    const packets=[];let bytes=0,more=false,cursor=after;
    for(const row of rows){const size=Buffer.byteLength(row.sealed);if(packets.length&&(bytes+size>4*1024*1024||packets.length>=100)){more=true;break;}bytes+=size;cursor=row.position;packets.push({context:parse(row.context),sealed:row.sealed,digest:row.digest,fileExpiry:Object.fromEntries(parse(row.files).map(id=>[id,db.prepare('SELECT expires_at FROM relay_files WHERE id=?').get(id)?.expires_at||db.prepare('SELECT expires_at FROM relay_blobs WHERE id=?').get(id)?.expires_at||null]))});}
    return {packets,more,cursor};
  }
  function ack(user,p){
    if(!Array.isArray(p.entries)||p.entries.length>300)fail(400,'저장 확인은 300개까지 가능합니다.');
    transaction(()=>{for(const e of p.entries){const row=db.prepare('SELECT * FROM relay_packets WHERE id=?').get(String(e.id||''));if(!row)continue;
      if(!row.released||!db.prepare('SELECT 1 FROM relay_targets WHERE packet_id=? AND user_id=?').get(e.id,user.id)){
        // A repeated ACK from an original recipient is safe, even when somebody
        // else still has a pending copy. Outsiders cannot remove a queue entry.
        if(row.released&&parse(row.context).targets.includes(user.id))continue;
        fail(403,'본인에게 전달된 알림만 저장 확인할 수 있습니다.');
      }
      if(row.digest!==e.digest)fail(409,'저장 확인 값이 일치하지 않습니다.');
      db.prepare('DELETE FROM relay_targets WHERE packet_id=? AND user_id=?').run(e.id,user.id);
      if(!db.prepare('SELECT 1 FROM relay_targets WHERE packet_id=?').get(e.id))db.prepare('DELETE FROM relay_packets WHERE id=?').run(e.id);
    }});return {ok:true};
  }
  function cancel(user,p){transaction(()=>{
    if(p.legacyMail){const mail=db.prepare('SELECT * FROM mails WHERE id=?').get(String(p.legacyMail));if(!mail)return;if(mail.sender!==user.id)fail(403,'본인이 보낸 메시지만 취소할 수 있습니다.');
      const targets=db.prepare("SELECT user_id FROM recipients WHERE mail_id=? AND status IN('unread','scheduled')").all(mail.id).map(r=>r.user_id);db.prepare("UPDATE recipients SET status='recalled' WHERE mail_id=? AND status IN('unread','scheduled')").run(mail.id);privacy.revoke('mail',mail.id,targets);privacy.cancelScheduledFiles(mail.id);for(const f of db.prepare('SELECT id FROM relay_legacy_files WHERE mail_id=?').all(mail.id))db.prepare('DELETE FROM relay_files WHERE id=? AND expires_at=0').run(f.id);return;
    }
    const row=db.prepare('SELECT * FROM relay_packets WHERE id=?').get(String(p.id||''));if(!row)return;if(row.sender!==user.id)fail(403,'본인이 보낸 전달 요청만 취소할 수 있습니다.');if(!row.released)for(const id of parse(row.files)){db.prepare('DELETE FROM relay_files WHERE id=? AND expires_at=0').run(id);if(db.prepare('SELECT 1 FROM relay_blobs WHERE id=? AND expires_at=0').get(id))blobs.remove(id);}db.prepare('DELETE FROM relay_packets WHERE id=?').run(row.id);
  });return {ok:true};}
  function legacyFile(mail,index){
    let map=db.prepare('SELECT * FROM relay_legacy_files WHERE mail_id=? AND idx=?').get(mail,index);
    const file=db.prepare('SELECT * FROM retained_files WHERE mail_id=? AND idx=?').get(mail,index);
    if(!map&&file){map={id:randomUUID(),secret:randomBytes(32).toString('hex')};db.prepare('INSERT INTO relay_legacy_files VALUES(?,?,?,?)').run(mail,index,map.id,map.secret);db.prepare('INSERT INTO relay_files VALUES(?,?,?,?,NULL,NULL)').run(map.id,crypto.digest(map.secret),file.data,file.expires_at);}
    if(map&&file?.expires_at)db.prepare('UPDATE relay_files SET expires_at=? WHERE id=? AND expires_at=0').run(file.expires_at,map.id);
    return map?{id:map.id,secret:map.secret}:null;
  }
  function legacyHash(kind,id){
    if(kind==='mail'){const m=db.prepare('SELECT * FROM mails WHERE id=?').get(id);if(!m)return null;return crypto.digest([m,db.prepare('SELECT * FROM recipients WHERE mail_id=? ORDER BY user_id').all(id),db.prepare('SELECT * FROM mail_work_responses WHERE mail_id=? ORDER BY user_id').all(id),db.prepare('SELECT * FROM homeroom_days WHERE mail_id=? ORDER BY user_id,date').all(id)]);}
    const r=db.prepare('SELECT * FROM rooms WHERE id=?').get(id);return r?crypto.digest([r,db.prepare('SELECT * FROM messages WHERE room_id=? ORDER BY seq').all(id),db.prepare('SELECT * FROM room_members WHERE room_id=? ORDER BY user_id').all(id)]):null;
  }
  function decorate(user,result){
    const entries=[];
    for(const m of result.data.mails){m.files=m.files.map(f=>({...f,relayFile:legacyFile(m.id,f.index)}));entries.push({kind:'mail',id:m.id,hash:legacyHash('mail',m.id)});}
    for(const id of result.privacy.recalled||[])entries.push({kind:'mail',id,hash:legacyHash('mail',id),recalled:true});
    for(const r of result.data.rooms){for(const m of r.messages)m.likesBy=db.prepare('SELECT user_id FROM reactions WHERE message_id=?').all(m.id).map(x=>x.user_id);entries.push({kind:'room',id:r.id,hash:legacyHash('room',r.id)});}
    result.privacy.relayVersion=2;result.privacy.fileTransferVersion=1;result.privacy.incomingCursorVersion=1;result.privacy.migration=entries.filter(e=>!db.prepare('SELECT 1 FROM relay_migrated WHERE kind=? AND id=? AND user_id=?').get(e.kind,e.id,user.id));return result;
  }
  function migrate(user,p){
    if(!Array.isArray(p.entries)||p.entries.length>300)fail(400,'이전 확인 형식이 올바르지 않습니다.');
    transaction(()=>{for(const e of p.entries){
      if(!['mail','room'].includes(e.kind)||typeof e.id!=='string')fail(400,'이전 종류가 올바르지 않습니다.');
      const hash=legacyHash(e.kind,e.id);if(!hash)continue;
      const mail=e.kind==='mail'?db.prepare('SELECT * FROM mails WHERE id=?').get(e.id):null;
      const targets=e.kind==='mail'?[mail.sender,...db.prepare('SELECT user_id FROM recipients WHERE mail_id=?').all(e.id).map(x=>x.user_id)]:db.prepare('SELECT user_id FROM room_members WHERE room_id=?').all(e.id).map(x=>x.user_id);
      if(!targets.includes(user.id))fail(403,'본인의 기록만 이전할 수 있습니다.');
      if(e.kind==='mail'&&mail.sender!==user.id&&db.prepare("SELECT 1 FROM recipients WHERE mail_id=? AND user_id=? AND status='scheduled'").get(e.id,user.id))fail(403,'예약 발송 이후 이전할 수 있습니다.');
      if(hash!==e.hash)fail(409,'이전 중 기록이 변경되었습니다. 다시 받아 주세요.');
      db.prepare('INSERT OR IGNORE INTO relay_migrated VALUES(?,?,?)').run(e.kind,e.id,user.id);
      if(targets.some(id=>!db.prepare('SELECT 1 FROM relay_migrated WHERE kind=? AND id=? AND user_id=?').get(e.kind,e.id,id)))continue;
      const sources=new Set([e.id]);
      if(e.kind==='mail'){
        // Files have independent capabilities before deleting mail ACLs.
        for(const f of db.prepare('SELECT idx FROM retained_files WHERE mail_id=?').all(e.id))legacyFile(e.id,f.idx);
        for(const w of db.prepare('SELECT response_id FROM mail_work_responses WHERE mail_id=?').all(e.id))if(w.response_id){db.prepare("DELETE FROM private_content WHERE kind='response' AND id=?").run(w.response_id);db.prepare("DELETE FROM private_deliveries WHERE kind='response' AND id=?").run(w.response_id);}
        db.prepare('DELETE FROM mails WHERE id=?').run(e.id);db.prepare('DELETE FROM retained_files WHERE mail_id=?').run(e.id);db.prepare('DELETE FROM relay_legacy_files WHERE mail_id=?').run(e.id);
        for(const row of db.prepare('SELECT id,payload FROM events').all()){const v=parse(row.payload);if(v.noticeMail===e.id||v.deliveryMail===e.id||parse(mail.payload).calendarEvent===row.id)db.prepare('DELETE FROM events WHERE id=?').run(row.id);}
        db.prepare("DELETE FROM private_content WHERE kind='mail' AND id=?").run(e.id);db.prepare("DELETE FROM private_deliveries WHERE kind='mail' AND id=?").run(e.id);
      }else{
        for(const m of db.prepare('SELECT id FROM messages WHERE room_id=?').all(e.id)){sources.add(m.id);db.prepare("DELETE FROM private_content WHERE kind='message' AND id=?").run(m.id);db.prepare("DELETE FROM private_deliveries WHERE kind='message' AND id=?").run(m.id);}
        db.prepare('DELETE FROM rooms WHERE id=?').run(e.id);
      }
      for(const row of db.prepare('SELECT source_key FROM auto_deadline_sources').all())if(sources.has(parse(row.source_key)[1]))db.prepare('DELETE FROM auto_deadline_sources WHERE source_key=?').run(row.source_key);
      db.prepare('DELETE FROM relay_migrated WHERE kind=? AND id=?').run(e.kind,e.id);
    }});return {ok:true};
  }
  function checkpoint(){db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();}
  return {sequence,upload,file,send,pull,ack,cancel,cleanup,checkpoint,decorate,migrate,blobs};
}
module.exports={createRelay};
