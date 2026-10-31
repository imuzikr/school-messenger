'use strict';
const crypto=require('../privacy/crypto.cjs');
const DAY=86400000, RETENTION=10*DAY;
const parse=JSON.parse,json=JSON.stringify;
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function createPrivacy(db,{allowLegacyMessages=false,now=Date.now}={}){
  db.exec(`PRAGMA secure_delete=ON; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS privacy_keys(user_id TEXT PRIMARY KEY REFERENCES users(id),public_key TEXT NOT NULL,fingerprint TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS privacy_key_changes(user_id TEXT NOT NULL,old_fingerprint TEXT NOT NULL,new_fingerprint TEXT NOT NULL,approved_by TEXT NOT NULL,changed_at INTEGER NOT NULL,PRIMARY KEY(user_id,old_fingerprint));
    CREATE TABLE IF NOT EXISTS private_content(kind TEXT NOT NULL,id TEXT NOT NULL,sender TEXT NOT NULL,context TEXT NOT NULL,sealed TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS private_deliveries(kind TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,received_at INTEGER,PRIMARY KEY(kind,id,user_id));
    CREATE TABLE IF NOT EXISTS retained_files(mail_id TEXT NOT NULL,idx INTEGER NOT NULL,data TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(mail_id,idx));
    CREATE INDEX IF NOT EXISTS idx_file_expiry ON retained_files(expires_at);
    CREATE INDEX IF NOT EXISTS idx_private_inbox ON private_deliveries(user_id,received_at);`);
  if(!db.prepare('PRAGMA table_info(private_content)').all().some(c=>c.name==='legacy'))db.exec('ALTER TABLE private_content ADD COLUMN legacy TEXT');
  if(!db.prepare('PRAGMA table_info(mail_work_responses)').all().some(c=>c.name==='response_id'))db.exec('ALTER TABLE mail_work_responses ADD COLUMN response_id TEXT');
  let dirty=false;
  let snapshotBytes=0,snapshotMore=false;
  function beginSnapshot(){snapshotBytes=0;snapshotMore=false;}
  const key=id=>{const r=db.prepare('SELECT public_key FROM privacy_keys WHERE user_id=?').get(id);return r&&parse(r.public_key);};
  const context=(kind,id,sender,targets,room='')=>crypto.context(kind,id,sender,targets,room);
  async function register(user,value){
    let publicKey,fingerprint;try{publicKey=await crypto.validatePublic(value);fingerprint=await crypto.fingerprint(publicKey);}catch{fail(400,'암호화 공개키가 올바르지 않습니다.');}
    const old=db.prepare('SELECT fingerprint FROM privacy_keys WHERE user_id=?').get(user.id);
    if(old&&old.fingerprint!==fingerprint)fail(409,'이 계정에 다른 PC의 보안 키가 등록되어 있습니다. 보관 파일이 있으면 가져오세요. 기존 PC와 파일을 모두 잃었다면 새 PC에서 보안 키 복구를 요청하세요.');
    db.prepare('INSERT OR IGNORE INTO privacy_keys VALUES(?,?,?)').run(user.id,json(publicKey),fingerprint);return {ok:true,fingerprint};
  }
  async function prepare(user,operations){
    const prepared=[];
    for(const op of operations){
      if(!['mail.send','message.send','mail.work.respond'].includes(op?.type)){prepared.push(op);continue;}
      const v=op.value||{};
      if(!v.sealed){if(allowLegacyMessages){prepared.push(op);continue;}fail(400,'이 서버는 암호화 메시지만 받습니다. 설치형 앱을 업데이트해 주세요.');}
      if(v.title||v.body||v.html||v.text||v.reply||v.note)fail(400,'메시지 내용은 암호화된 형태로만 보낼 수 있습니다.');
      const senderKey=key(user.id);if(!senderKey)fail(409,'발신자의 암호화 키가 등록되지 않았습니다.');
      if(!Array.isArray(v.privacyTargets)||v.privacyTargets.length>201||v.privacyTargets.some(x=>typeof x!=='string'||x.length>100))fail(400,'암호화 수신 대상이 올바르지 않습니다.');
      const response=op.type==='mail.work.respond';
      if(response&&(typeof v.responseId!=='string'||v.responseId.length>100))fail(400,'응답 식별자가 올바르지 않습니다.');
      const ctx=context(response?'response':op.type==='mail.send'?'mail':'message',response?v.responseId:v.id,user.id,v.privacyTargets,response?op.id:op.room||'');
      for(const target of ctx.targets)if(!key(target))fail(409,'수신자가 아직 암호화 키를 등록하지 않았습니다. 먼저 한 번 로그인해야 합니다.');
      try{await crypto.inspect(v.sealed,senderKey,ctx);}catch{fail(400,'메시지 암호문 또는 발신자 서명을 확인할 수 없습니다.');}
      const safe={...v,title:'',body:'[암호화된 내용]',html:'',text:'[암호화된 내용]',reply:''};
      prepared.push({...op,value:safe,privateContext:ctx});
    }
    return prepared;
  }
  function store(kind,id,sender,targets,op,room=''){
    if(!op.value?.sealed)return;
    const expected=context(kind,id,sender,targets,room);
    if(json(expected)!==json(op.privateContext))fail(409,'수신 대상이 변경되었습니다. 대상자를 확인하고 다시 보내 주세요.');
    db.prepare('INSERT INTO private_content(kind,id,sender,context,sealed,digest) VALUES(?,?,?,?,?,?)').run(kind,id,sender,json(expected),op.value.sealed,crypto.digest(op.value.sealed));
    for(const userId of expected.targets)db.prepare('INSERT INTO private_deliveries VALUES(?,?,?,?)').run(kind,id,userId,userId===sender?now():null);
    purge(kind,id);
  }
  function purge(kind,id){
    if(!db.prepare('SELECT 1 FROM private_deliveries WHERE kind=? AND id=? AND received_at IS NULL').get(kind,id)){
      if(db.prepare('DELETE FROM private_content WHERE kind=? AND id=?').run(kind,id).changes)dirty=true;
    }
  }
  function packet(kind,id,user){
    const row=db.prepare('SELECT c.* FROM private_content c JOIN private_deliveries d ON d.kind=c.kind AND d.id=c.id WHERE c.kind=? AND c.id=? AND d.user_id=?').get(kind,id,user.id);
    const delivery=db.prepare('SELECT received_at FROM private_deliveries WHERE kind=? AND id=? AND user_id=?').get(kind,id,user.id);
    if(row&&delivery.received_at===null){const size=Buffer.byteLength(row.sealed||row.legacy||'');if(snapshotBytes>0&&snapshotBytes+size>4*1024*1024){snapshotMore=true;return {privateMessage:true,contentPending:true};}snapshotBytes+=size;}
    return {privateMessage:!!delivery,...(row&&delivery.received_at===null?{...(row.legacy?{legacyContent:parse(row.legacy)}:{sealed:row.sealed}),privateContext:parse(row.context),contentDigest:row.digest}:{})};
  }
  function acknowledgements(user,entries){
    if(!Array.isArray(entries)||entries.length>300)fail(400,'수신 확인은 300개까지 가능합니다.');
    const senders=new Set();
    for(const ack of entries){
      if(!['mail','message','response'].includes(ack.kind)||typeof ack.id!=='string')fail(400,'수신 확인 형식이 올바르지 않습니다.');
      const d=db.prepare('SELECT received_at FROM private_deliveries WHERE kind=? AND id=? AND user_id=?').get(ack.kind,ack.id,user.id);
      if(!d){if(!db.prepare('SELECT 1 FROM private_content WHERE kind=? AND id=?').get(ack.kind,ack.id))continue;fail(403,'본인이 받은 메시지만 수신 확인할 수 있습니다.');}
      if(ack.kind==='mail'){
        const r=db.prepare('SELECT status FROM recipients WHERE mail_id=? AND user_id=?').get(ack.id,user.id);
        if(r?.status==='scheduled')fail(403,'예약 메시지는 발송 전 수신 확인할 수 없습니다.');
      }
      if(d.received_at!==null)continue;
      const c=db.prepare('SELECT digest,sender FROM private_content WHERE kind=? AND id=?').get(ack.kind,ack.id);
      if(!c||c.digest!==ack.digest)fail(409,'저장한 메시지의 수신 확인 값이 일치하지 않습니다.');
      db.prepare('UPDATE private_deliveries SET received_at=? WHERE kind=? AND id=? AND user_id=?').run(now(),ack.kind,ack.id,user.id);
      senders.add(c.sender);
      purge(ack.kind,ack.id);
    }
    return [...senders];
  }
  function files(mailId,files,scheduled,createdAt=now()){
    // Zero means awaiting actual dispatch. A stopped server must not consume a
    // scheduled attachment's retention period before recipients can receive it.
    const expiresAt=scheduled?0:createdAt+RETENTION;
    return files.map((f,index)=>{
      if(f.data&&(!expiresAt||expiresAt>now()))db.prepare('INSERT OR IGNORE INTO retained_files VALUES(?,?,?,?)').run(mailId,index,f.data,expiresAt);
      const {data,...metadata}=f;return {...metadata,expiresAt:expiresAt||null,sha256:f.data?crypto.digest(Buffer.from(f.data.split(',')[1],'base64')):f.sha256};
    });
  }
  function releaseFiles(mailId,at=now()){
    const expiresAt=at+RETENTION;db.prepare('UPDATE retained_files SET expires_at=? WHERE mail_id=? AND expires_at=0').run(expiresAt,mailId);
    const row=db.prepare('SELECT payload FROM mails WHERE id=?').get(mailId);if(row){const p=parse(row.payload);p.files=(p.files||[]).map(f=>({...f,expiresAt}));db.prepare('UPDATE mails SET payload=? WHERE id=?').run(json(p),mailId);}
  }
  function cancelScheduledFiles(mailId){
    if(db.prepare('DELETE FROM retained_files WHERE mail_id=? AND expires_at=0').run(mailId).changes)dirty=true;
  }
  function attachment(mail,index){
    const row=db.prepare('SELECT data,expires_at FROM retained_files WHERE mail_id=? AND idx=?').get(mail.id,index);
    if(!row||row.expires_at&&row.expires_at<=now())fail(410,'첨부 파일 보관 기간이 끝났습니다.');
    const metadata=parse(mail.payload).files[index];if(!metadata)fail(404,'첨부 파일을 찾을 수 없습니다.');
    return {...metadata,data:row.data};
  }
  function cleanup(){if(db.prepare('DELETE FROM retained_files WHERE expires_at>0 AND expires_at<=?').run(now()).changes)dirty=true;}
  function checkpoint(){if(dirty){const result=db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();if(!result.busy)dirty=false;}}
  function revoke(kind,id,targets){for(const target of targets)db.prepare('UPDATE private_deliveries SET received_at=coalesce(received_at,?) WHERE kind=? AND id=? AND user_id=?').run(now(),kind,id,target);purge(kind,id);}
  function deliveryMap(kind,id){return Object.fromEntries(db.prepare('SELECT user_id,received_at FROM private_deliveries WHERE kind=? AND id=?').all(kind,id).map(r=>[r.user_id,r.received_at]));}
  function personal(user){
    const rows=db.prepare('SELECT id,kind,payload FROM items WHERE owner=?').all(user.id).map(r=>({kind:r.kind,id:r.id,value:parse(r.payload),hash:crypto.digest(r.payload)}));
    for(const r of db.prepare('SELECT id,payload FROM events WHERE owner=?').all(user.id)){const value=parse(r.payload);if(value.source||value.type==='personal')rows.push({kind:'events',id:r.id,value,hash:crypto.digest(r.payload)});}
    return rows;
  }
  function localize(user,entries){
    if(!Array.isArray(entries)||entries.length>300)fail(400,'PC 이전 항목이 올바르지 않습니다.');
    for(const e of entries){if(!['events','notes','deadlines','tasks','shortcuts'].includes(e.kind))fail(400,'PC 이전 종류가 올바르지 않습니다.');const table=e.kind==='events'?'events':'items';
      const row=db.prepare('SELECT * FROM '+table+' WHERE id=? AND owner=?').get(e.id,user.id);if(!row)continue;
      if(table==='events'&&!parse(row.payload).source&&parse(row.payload).type!=='personal')fail(403,'공유 일정을 개인 기록으로 이전할 수 없습니다.');
      if(crypto.digest(row.payload)!==e.hash)fail(409,'이전할 항목이 변경되었습니다. 다시 받아 주세요.');
      db.prepare('DELETE FROM '+table+' WHERE id=? AND owner=?').run(e.id,user.id);dirty=true;
    }
  }
  // Old attachment payloads are moved once; never restart their retention clock.
  db.exec('BEGIN IMMEDIATE');try{
    for(const mail of db.prepare('SELECT id,payload FROM mails').all()){
      const p=parse(mail.payload);if(p.files?.some(f=>f.data)){const pending=db.prepare("SELECT 1 FROM recipients WHERE mail_id=? AND status='scheduled'").get(mail.id);p.files=files(mail.id,p.files,pending?p.scheduled:'',Date.parse(p.scheduled)||p.createdAt||Date.parse(p.date+'T00:00:00+09:00')||now());db.prepare('UPDATE mails SET payload=? WHERE id=?').run(json(p),mail.id);dirty=true;}
    }
    if(!allowLegacyMessages)for(const [kind,table] of [['mail','mails'],['message','messages']])for(const row of db.prepare('SELECT * FROM '+table).all()){
      const p=parse(row.payload);if(p.privateMessage)continue;
      const fields=kind==='mail'?['title','body','html']:['text','reply'],legacy=Object.fromEntries(fields.map(k=>[k,p[k]||'']));
      if(kind==='mail'){
        const attached=[...(p.files||[])];
        legacy.html=legacy.html.replace(/data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}/g,data=>{const index=attached.length;attached.push({name:'본문 이미지 '+(index+1),data,inline:true});return 'ieum-inline:'+index;});
        const pending=db.prepare("SELECT 1 FROM recipients WHERE mail_id=? AND status='scheduled'").get(row.id);p.files=files(row.id,attached,pending?p.scheduled:'',Date.parse(p.scheduled)||p.createdAt||Date.parse(p.date+'T00:00:00+09:00')||now());
        if(p.calendarEvent){const event=db.prepare('SELECT payload FROM events WHERE id=?').get(p.calendarEvent);if(event){const detail=parse(event.payload);legacy.calendarDetails={id:p.calendarEvent,title:detail.title,note:detail.note};detail.title='공유 일정';detail.note='';db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(detail),p.calendarEvent);}}
      }
      const targets=kind==='mail'?db.prepare("SELECT user_id FROM recipients WHERE mail_id=? AND status<>'recalled'").all(row.id).map(r=>r.user_id):db.prepare('SELECT user_id FROM room_members WHERE room_id=?').all(row.room_id).map(r=>r.user_id);
      const ctx=context(kind,row.id,row.sender,targets,row.room_id||'');
      db.prepare('INSERT OR IGNORE INTO private_content(kind,id,sender,context,sealed,digest,legacy) VALUES(?,?,?,?,?,?,?)').run(kind,row.id,row.sender,json(ctx),'',crypto.digest(json(legacy)),json(legacy));
      for(const id of ctx.targets)db.prepare('INSERT OR IGNORE INTO private_deliveries VALUES(?,?,?,NULL)').run(kind,row.id,id);
      for(const k of fields)delete p[k];p.privateMessage=true;p.legacyMigration=true;
      db.prepare('UPDATE '+table+' SET payload=? WHERE id=?').run(json(p),row.id);dirty=true;
    }
    if(!allowLegacyMessages)for(const row of db.prepare('SELECT id,payload FROM events').all()){const p=parse(row.payload);if(p.noticeMail&&p.note){p.note='';db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(p),row.id);dirty=true;}}
    if(!allowLegacyMessages)for(const row of db.prepare("SELECT w.*,m.sender AS mail_sender FROM mail_work_responses w JOIN mails m ON m.id=w.mail_id WHERE w.note<>'' AND w.response_id IS NULL").all()){
      const id='legacy-response-'+crypto.digest([row.mail_id,row.user_id,row.updated_at]).slice(0,40),ctx=context('response',id,row.user_id,[row.mail_sender],row.mail_id),legacy=json({note:row.note});
      db.prepare('INSERT OR IGNORE INTO private_content(kind,id,sender,context,sealed,digest,legacy) VALUES(?,?,?,?,?,?,?)').run('response',id,row.user_id,json(ctx),'',crypto.digest(legacy),legacy);
      for(const target of ctx.targets)db.prepare('INSERT OR IGNORE INTO private_deliveries VALUES(?,?,?,NULL)').run('response',id,target);
      db.prepare("UPDATE mail_work_responses SET note='',response_id=? WHERE mail_id=? AND user_id=?").run(id,row.mail_id,row.user_id);dirty=true;
    }
    cleanup();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  function keys(){return Object.fromEntries(db.prepare('SELECT k.user_id,k.public_key,EXISTS(SELECT 1 FROM privacy_key_changes c WHERE c.user_id=k.user_id) AS recovered FROM privacy_keys k').all().map(r=>[r.user_id,{...parse(r.public_key),...(r.recovered?{recovered:true}:{})}]));}
  return {register,prepare,store,packet,beginSnapshot,more:()=>snapshotMore,acknowledgements,files,releaseFiles,cancelScheduledFiles,attachment,cleanup,checkpoint,revoke,deliveryMap,key,personal,localize,keys};
}
module.exports={createPrivacy,RETENTION};
