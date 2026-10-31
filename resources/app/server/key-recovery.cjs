'use strict';
const {randomBytes}=require('node:crypto');
const crypto=require('../privacy/crypto.cjs');
const TTL=15*60*1000;
function fail(status,message){throw Object.assign(new Error(message),{status});}

function createKeyRecovery(db,{now,relay}){
  // Requests expire on restart. Only completed account security changes are durable.
  const pending=new Map();
  const current=id=>db.prepare('SELECT fingerprint FROM privacy_keys WHERE user_id=?').get(id)?.fingerprint;
  const retired=(id,fp)=>db.prepare('SELECT 1 FROM privacy_key_changes WHERE user_id=? AND old_fingerprint=?').get(id,fp);
  async function request(actor,p,authenticate){
    if(p.acceptLoss!==true)fail(400,'기존 기록과 미전달 메시지에 대한 안내를 확인해 주세요.');
    let key,fp;
    try{key=await crypto.validatePublic(p.key);fp=await crypto.fingerprint(key);}catch{fail(400,'새 PC의 공개키를 확인할 수 없습니다.');}
    authenticate();
    const old=current(actor.id);
    if(!old||old===fp)fail(409,'이 PC의 키는 교체할 필요가 없습니다. 먼저 정상 로그인을 시도해 주세요.');
    if(retired(actor.id,fp))fail(409,'이전에 사용을 중지한 키입니다. 새 PC에서 복구를 요청해 주세요.');
    const code=randomBytes(6).toString('hex').toUpperCase(),expires=now()+TTL;
    pending.set(actor.id,{key,fp,old,code,expires,session:actor.tokenHash});
    return {code,expires};
  }
  function approve(admin,p){
    const entry=pending.get(p.id);
    if(p.confirmed!==true||!entry||entry.expires<=now()||String(p.code).replace(/[\s-]/g,'').toUpperCase()!==entry.code)
      fail(409,'요청 코드가 일치하지 않거나 만료됐습니다. 새 PC에서 다시 요청해 주세요.');
    db.exec('BEGIN IMMEDIATE');
    try{
      if(!db.prepare('SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND u.id=? AND s.expires>? AND u.disabled=0 AND u.must_change=0').get(entry.session,p.id,Date.now())||current(p.id)!==entry.old)
        fail(409,'요청한 PC의 로그인 상태가 바뀌었습니다. 다시 로그인한 뒤 요청해 주세요.');
      relay.discardLostKey(p.id);
      // V1 envelopes can still be waiting for migration on an upgraded server.
      const lost=db.prepare("SELECT d.kind,d.id,d.user_id FROM private_content c JOIN private_deliveries d USING(kind,id) WHERE c.sealed<>'' AND d.received_at IS NULL AND (c.sender=? OR d.user_id=?)").all(p.id,p.id);
      for(const row of lost){
        if(row.kind==='mail')db.prepare("UPDATE recipients SET status='recalled' WHERE mail_id=? AND user_id=? AND status IN('unread','scheduled')").run(row.id,row.user_id);
        db.prepare('DELETE FROM private_deliveries WHERE kind=? AND id=? AND user_id=?').run(row.kind,row.id,row.user_id);
        db.prepare('DELETE FROM private_content WHERE kind=? AND id=? AND NOT EXISTS(SELECT 1 FROM private_deliveries WHERE kind=? AND id=? AND received_at IS NULL)').run(row.kind,row.id,row.kind,row.id);
      }
      db.prepare('UPDATE privacy_keys SET public_key=?,fingerprint=? WHERE user_id=?').run(JSON.stringify(entry.key),entry.fp,p.id);
      db.prepare('INSERT INTO privacy_key_changes(user_id,old_fingerprint,new_fingerprint,approved_by,changed_at) VALUES(?,?,?,?,?)').run(p.id,entry.old,entry.fp,admin.id,now());
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(p.id);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    pending.delete(p.id);
    return {ok:true};
  }
  function cleanup(){for(const [id,r] of pending)if(r.expires<=now())pending.delete(id);}
  return {request,approve,cleanup};
}
module.exports={createKeyRecovery};
