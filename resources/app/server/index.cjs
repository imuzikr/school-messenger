'use strict';
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');
require('reflect-metadata');
const x509 = require('@peculiar/x509');
const bell=require('./schedule.cjs');
const deadlines=require('../js/message-deadlines.js');
const announcements=require('../js/announcements.js');
const duties=require('../js/duties.js');
const exchanges=require('../js/duty-exchanges.js');
const directory=require('../js/staff-directory.js');
const homeroom=require('../js/homeroom.js');
const workTools=require('../js/work-tools.js');
const {createPrivacy}=require('./privacy.cjs');
const {createRelay}=require('./relay.cjs');
const {diskFull,lowSpace}=require('./relay-files.cjs');
x509.cryptoProvider.set(crypto.webcrypto);
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMEMBER_MS = 90 * DAY_MS;
const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_CHECKS_PER_ADDRESS = 2;
// Unknown or disabled accounts are checked against this record so they cost the same as real ones.
const LOGIN_DECOY = {salt: crypto.randomBytes(16).toString('hex'), digest: crypto.randomBytes(64).toString('hex')};
const id = (prefix) => prefix + '-' + crypto.randomUUID();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value);
const parse = (value) => JSON.parse(value);
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function str(value, max = 100, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, '입력 형식 또는 길이를 확인해 주세요.');
  return value.trim();
}
function validDate(value) {
  str(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T12:00:00')) || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) fail(400, '날짜 형식이 올바르지 않습니다.');
  return value;
}
const dateKey = () => new Date().toLocaleDateString('sv-SE', {timeZone:'Asia/Seoul'});
const timeKey = () => new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'});
async function certificate(dataDir, address) {
  const keyPath = path.join(dataDir, 'server-key.pem'), certPath = path.join(dataDir, 'server-cert.pem');
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const alg={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256',publicExponent:new Uint8Array([1,0,1]),modulusLength:3072};
    const keys=await crypto.webcrypto.subtle.generateKey(alg,true,['sign','verify']);
    const hostname=new URL(address).hostname;
    const names=[...new Set([hostname,'localhost','127.0.0.1',os.hostname()])].map(v=>({type:net.isIP(v)?'ip':'dns',value:v}));
    const notAfter=new Date();notAfter.setFullYear(notAfter.getFullYear()+3);
    const cert=await x509.X509CertificateGenerator.createSelfSigned({serialNumber:'01'+crypto.randomBytes(15).toString('hex'),name:'CN=Dingdong School LAN Server',notBefore:new Date(Date.now()-60000),notAfter,signingAlgorithm:alg,keys,extensions:[new x509.BasicConstraintsExtension(true,0,true),new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature|x509.KeyUsageFlags.keyEncipherment|x509.KeyUsageFlags.keyCertSign,true),new x509.ExtendedKeyUsageExtension(['1.3.6.1.5.5.7.3.1']),new x509.SubjectAlternativeNameExtension(names)]});
    const privateKey=crypto.KeyObject.from(keys.privateKey).export({type:'pkcs8',format:'pem'});
    fs.writeFileSync(keyPath,privateKey,{mode:0o600});fs.writeFileSync(certPath,cert.toString('pem'),{mode:0o600});
  }
  const key = fs.readFileSync(keyPath), cert = fs.readFileSync(certPath,'utf8');
  const parsed = new crypto.X509Certificate(cert);
  const hostname=new URL(address).hostname;
  if(!(net.isIP(hostname)?parsed.checkIP(hostname):parsed.checkHost(hostname)))fail(400,'저장된 인증서와 서버 주소가 다릅니다. 기존 주소를 사용하거나 안내에 따라 인증서를 재발급하세요.');
  const fingerprint = parsed.fingerprint256;
  return {key,cert,fingerprint};
}
async function passwordRecord(password) {
  str(password,128); if(password.length<8) fail(400,'비밀번호는 8자 이상 입력해 주세요.');
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = (await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex');
  return {salt,digest};
}
async function passwordMatches(password,user) {
  if(typeof password!=='string'||password.length>128)return false;
  const digest=await scrypt(password,user.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return crypto.timingSafeEqual(Buffer.from(user.digest,'hex'),digest);
}
async function startServer(options = {}) {
  const now=options.now||Date.now,timers=options.timers||require('node:timers');
  const dataDir = path.resolve(options.dataDir || require('../desktop/branding.cjs').serverDirectory(os.homedir()));
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
  const port = options.port === undefined ? 8443 : options.port;
  const address = options.address || `https://localhost:${port || 8443}`;
  const addressURL = new URL(address);
  if(addressURL.protocol!=='https:'||addressURL.username||addressURL.password||addressURL.pathname!=='/'||addressURL.search||addressURL.hash)fail(400,'서버 주소는 https://호스트:포트 형식이어야 합니다.');
  const tls = await certificate(dataDir,address);
  const databasePath=require('../desktop/branding.cjs').databaseFile(dataDir);
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,department TEXT NOT NULL,role TEXT NOT NULL,subject TEXT NOT NULL,extension TEXT NOT NULL,digest TEXT NOT NULL,salt TEXT NOT NULL,admin INTEGER NOT NULL DEFAULT 0,disabled INTEGER NOT NULL DEFAULT 0,must_change INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS remembered_sessions(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,notice TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS room_members(room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,pinned INTEGER NOT NULL DEFAULT 0,muted INTEGER NOT NULL DEFAULT 0,read_seq INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(room_id,user_id));
  CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,sender TEXT REFERENCES users(id),payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reactions(message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(message_id,user_id));
  CREATE TABLE IF NOT EXISTS mails(id TEXT PRIMARY KEY,sender TEXT REFERENCES users(id),payload TEXT NOT NULL,sender_folder TEXT NOT NULL DEFAULT 'sent',sender_important INTEGER NOT NULL DEFAULT 0,event_id TEXT);
  CREATE TABLE IF NOT EXISTS recipients(mail_id TEXT REFERENCES mails(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id),status TEXT NOT NULL DEFAULT 'unread',folder TEXT NOT NULL DEFAULT 'inbox',important INTEGER NOT NULL DEFAULT 0,event_id TEXT,PRIMARY KEY(mail_id,user_id));
  CREATE TABLE IF NOT EXISTS mail_work_responses(mail_id TEXT NOT NULL,user_id TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL,PRIMARY KEY(mail_id,user_id),FOREIGN KEY(mail_id,user_id) REFERENCES recipients(mail_id,user_id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS homeroom_days(mail_id TEXT NOT NULL,user_id TEXT NOT NULL,date TEXT NOT NULL,hidden INTEGER NOT NULL DEFAULT 0,carried_from TEXT NOT NULL DEFAULT '',PRIMARY KEY(mail_id,user_id,date),FOREIGN KEY(mail_id,user_id) REFERENCES recipients(mail_id,user_id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS duty_exchanges(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS duty_exchange_notices(request_id TEXT NOT NULL,user_id TEXT NOT NULL,version TEXT NOT NULL,PRIMARY KEY(request_id,user_id));
  CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,owner TEXT REFERENCES users(id),payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,owner TEXT REFERENCES users(id),kind TEXT NOT NULL,payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS bell_schedules(date TEXT PRIMARY KEY,periods TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS auto_deadline_sources(source_key TEXT PRIMARY KEY,item_id TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id,seq);
  CREATE INDEX IF NOT EXISTS idx_recipient_user ON recipients(user_id);
  CREATE INDEX IF NOT EXISTS idx_pending_mail ON recipients(mail_id) WHERE status='scheduled';
  CREATE INDEX IF NOT EXISTS idx_session_expiry ON sessions(expires);
  CREATE INDEX IF NOT EXISTS idx_members_user ON room_members(user_id);`);
  if(!db.prepare('PRAGMA table_info(bell_schedules)').all().some(c=>c.name==='title'))db.exec("ALTER TABLE bell_schedules ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  const recipientColumns=new Set(db.prepare('PRAGMA table_info(recipients)').all().map(column=>column.name));
  if(!recipientColumns.has('read_at'))db.exec('ALTER TABLE recipients ADD COLUMN read_at INTEGER');
  if(!recipientColumns.has('receipt_notified'))db.exec('ALTER TABLE recipients ADD COLUMN receipt_notified INTEGER NOT NULL DEFAULT 0');
  if(!recipientColumns.has('homeroom_hidden'))db.exec('ALTER TABLE recipients ADD COLUMN homeroom_hidden INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pending_receipts ON recipients(receipt_notified,read_at) WHERE read_at IS NOT NULL');
  const columns=new Set(db.prepare('PRAGMA table_info(users)').all().map(column=>column.name));
  if(!columns.has('grade'))db.exec("ALTER TABLE users ADD COLUMN grade TEXT NOT NULL DEFAULT ''");
  if(!columns.has('other_group'))db.exec("ALTER TABLE users ADD COLUMN other_group TEXT NOT NULL DEFAULT ''");
  for(const column of ['class_number','work','special_room','club','position'])if(!columns.has(column))db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  const privacy=createPrivacy(db,{allowLegacyMessages:options.allowLegacyMessages===true,now});
  const existing=db.prepare('SELECT count(*) n FROM users').get().n;
  if(!existing){
    if(!options.admin?.username||!options.admin?.password){db.close();fail(400,'최초 실행에는 관리자 아이디와 비밀번호를 설정해야 합니다.');}
    const record=await passwordRecord(options.admin.password);
    db.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt,admin,disabled,must_change) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id('staff'),str(options.admin.username,40),str(options.admin.name||'관리자',40),'정보부','관리자','정보','',record.digest,record.salt,1,0,0);
    db.prepare('INSERT OR REPLACE INTO metadata VALUES(?,?)').run('schoolName',str(options.schoolName||'우리 학교',60));
  }
  const defaultPeriods=()=>parse(db.prepare("SELECT value FROM metadata WHERE key='defaultPeriods'").get()?.value||json(bell.defaults()));
  const periodsFor=date=>{const temporary=db.prepare('SELECT periods FROM bell_schedules WHERE date=?').get(date);return temporary?parse(temporary.periods):defaultPeriods();};
  const resolvePeriod=(date,period)=>{if(!Number.isInteger(Number(period)))fail(400,'수업은 정수 교시로 지정하세요.');const slot=periodsFor(date).find(p=>p.period===Number(period));if(!slot)fail(409,'보강에 지정된 교시가 일과표에 없습니다. 보강 교시를 먼저 변경하세요.');return slot;};
  const streams=new Map(), loginAttempts=new Map(), loginChecks=new Map();
  const userPublic=u=>({id:u.id,username:u.username,name:u.name,department:u.department,role:u.role,subject:u.subject,extension:u.extension,grade:u.grade||'',otherGroup:u.other_group||'',position:u.position||'',classNumber:u.class_number||'',work:u.work||'',specialRoom:u.special_room||'',club:u.club||'',admin:!!u.admin,disabled:!!u.disabled,mustChange:!!u.must_change,status:streams.has(u.id)?'online':'offline'});
  const notify=(audience=null,kind='changed')=>{
    for(const [userId,connections] of streams){
      if(audience&&!audience.includes(userId))continue;
      for(const response of connections)if(!response.writableEnded&&!response.destroyed)response.write(`event: update\ndata: ${json({kind})}\n\n`);
    }
    options.onChange?.();
  };
  const relay=options.metadataRelay===false||options.allowLegacyMessages===true?null:createRelay(db,privacy,{now,dataDir,onRelease:notify,freeBytes:options.attachmentFreeBytes});
  const recovery=relay&&require('./key-recovery.cjs').createKeyRecovery(db,{now,relay});
  // Earlier clients kept the ISO timestamp in the mail payload. Only join pending IDs.
  db.exec(`CREATE TEMP VIEW pending_mail_dispatch AS
    SELECT m.id, round(unixepoch(json_extract(m.payload,'$.scheduled'),'subsec')*1000) AS due
    FROM (SELECT DISTINCT mail_id FROM recipients WHERE status='scheduled') r JOIN mails m ON m.id=r.mail_id`);
  const dispatch=require('./dispatch-timer.cjs').createDispatchTimer({now,timers,onError:options.onError,nextDeadline(){
    const legacy=db.prepare('SELECT MIN(due) AS at FROM pending_mail_dispatch').get().at;
    const packet=relay?.nextDeadline()??null;
    return legacy===null?packet:packet===null?legacy:Math.min(legacy,packet);
  },releaseDue(){
    relay?.releaseDue();
    const rows=db.prepare('SELECT m.* FROM pending_mail_dispatch p JOIN mails m ON m.id=p.id WHERE p.due<=?').all(now());
    let changed=false,firstError;
    for(const row of rows){
      const targets=db.prepare("SELECT user_id FROM recipients WHERE mail_id=? AND status='scheduled'").all(row.id).map(r=>r.user_id);
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare("UPDATE recipients SET status='unread' WHERE mail_id=? AND status='scheduled'").run(row.id);
        privacy.releaseFiles(row.id,now());
        registerDeadlines('mail',row.id,row.sender,targets,parse(row.payload));
        db.exec('COMMIT');
        changed=true;
      }catch(error){db.exec('ROLLBACK');firstError??=error;}
    }
    if(changed)notify();
    if(firstError)throw firstError;
  }});
  const roomUsers=room=>db.prepare('SELECT user_id FROM room_members WHERE room_id=?').all(room).map(r=>r.user_id);
  const member=(user,room)=>{const row=db.prepare('SELECT * FROM room_members WHERE room_id=? AND user_id=?').get(room,user.id);if(!row)fail(403,'이 대화방의 참여자만 이용할 수 있습니다.');return row;};
  const knownUsers=(ids)=>{
    if(!Array.isArray(ids)||ids.length<1||ids.length>200)fail(400,'대상자를 한 명 이상 선택해 주세요.');
    const result=[...new Set(ids.map(v=>str(v,100)))];
    for(const userId of result)if(!db.prepare('SELECT id FROM users WHERE id=? AND disabled=0').get(userId))fail(400,'사용할 수 없는 교직원 계정입니다.');
    return result;
  };
  function registerStartEvents(kind,sourceId,sender,recipients,payload){
    if(payload.privateMessage)return;
    if(payload.workReminderOf)return;
    if(payload.notice||payload.calendarEvent||payload.scheduleAnnouncement)return;
    const text=kind==='message'?payload.text:(payload.title||'')+'\n'+payload.body;
    const context={bellSchedules:db.prepare('SELECT * FROM bell_schedules').all().map(r=>({date:r.date,periods:parse(r.periods)})),defaultPeriods:defaultPeriods()};
    const appointments=deadlines.extractStartEvents(text,payload.scheduled||payload.createdAt||payload.date,context);
    for(const owner of new Set([sender,...recipients]))appointments.forEach((entry,index)=>{
      const key=deadlines.sourceKey(kind+'-start-event',sourceId,owner,index),itemId='auto-'+hash(key);
      const inserted=db.prepare('INSERT OR IGNORE INTO auto_deadline_sources VALUES(?,?)').run(key,itemId);
      if(inserted.changes){db.prepare('INSERT INTO events VALUES(?,?,?)').run(itemId,owner,json({...deadlines.withSourceTitle(entry,kind,payload),source:{kind,id:sourceId}}));
        if(kind==='mail'&&owner===sender)db.prepare('UPDATE mails SET event_id=coalesce(event_id,?) WHERE id=?').run(itemId,sourceId);
        if(kind==='mail')db.prepare('UPDATE recipients SET event_id=coalesce(event_id,?) WHERE mail_id=? AND user_id=?').run(itemId,sourceId,owner);}
    });
  }
  function registerRangeEvents(kind,sourceId,sender,recipients,payload){
    if(payload.privateMessage)return;
    if(payload.workReminderOf)return;
    if(payload.notice||payload.calendarEvent||payload.scheduleAnnouncement)return;
    const text=kind==='message'?payload.text:(payload.title||'')+'\n'+payload.body;
    const appointments=deadlines.extractEvents(text,payload.scheduled||payload.createdAt||payload.date);
    for(const owner of new Set([sender,...recipients]))appointments.forEach((entry,index)=>{const key=deadlines.sourceKey(kind+'-event',sourceId,owner,index),itemId='auto-'+hash(key);
        const inserted=db.prepare('INSERT OR IGNORE INTO auto_deadline_sources VALUES(?,?)').run(key,itemId);
        if(inserted.changes){db.prepare('INSERT INTO events VALUES(?,?,?)').run(itemId,owner,json({...deadlines.withSourceTitle(entry,kind,payload),source:{kind,id:sourceId}}));
          if(kind==='mail'&&owner===sender)db.prepare('UPDATE mails SET event_id=coalesce(event_id,?) WHERE id=?').run(itemId,sourceId);
          if(kind==='mail')db.prepare('UPDATE recipients SET event_id=coalesce(event_id,?) WHERE mail_id=? AND user_id=?').run(itemId,sourceId,owner);}
      });
  }
  function registerDeadlines(kind,sourceId,sender,recipients,payload){
    if(payload.privateMessage)return;
    if(payload.workReminderOf)return;
    registerStartEvents(kind,sourceId,sender,recipients,payload);
    registerRangeEvents(kind,sourceId,sender,recipients,payload);
    if(payload.notice||payload.calendarEvent||payload.scheduleAnnouncement)return;
    const context={bellSchedules:db.prepare('SELECT * FROM bell_schedules').all().map(r=>({date:r.date,periods:parse(r.periods)})),
      defaultPeriods:db.prepare("SELECT value FROM metadata WHERE key='defaultPeriods'").get()?defaultPeriods():undefined};
    const text=kind==='message'?payload.text:(payload.title||'')+'\n'+payload.body,at=payload.scheduled||payload.createdAt||payload.date;
    const entries=deadlines.extract(text,at,context);
    for(const owner of new Set([sender,...recipients])){
      entries.forEach((entry,index)=>{const key=deadlines.sourceKey(kind,sourceId,owner,index),itemId='auto-'+hash(key);
        const inserted=db.prepare('INSERT OR IGNORE INTO auto_deadline_sources VALUES(?,?)').run(key,itemId);
        if(inserted.changes){db.prepare('INSERT INTO items VALUES(?,?,?,?)').run(itemId,owner,'deadlines',json({...deadlines.withSourceTitle(entry,kind,payload),done:false,source:{kind,id:sourceId}}));
          if(kind==='mail'&&owner===sender)db.prepare('UPDATE mails SET event_id=coalesce(event_id,?) WHERE id=?').run(itemId,sourceId);
          if(kind==='mail')db.prepare('UPDATE recipients SET event_id=coalesce(event_id,?) WHERE mail_id=? AND user_id=?').run(itemId,sourceId,owner);}
      });
    }
  }
  const dutyPeople=()=>db.prepare('SELECT * FROM users WHERE disabled=0').all().map(userPublic);
  const dutySettings=()=>parse(db.prepare("SELECT value FROM metadata WHERE key='dutySettings'").get()?.value||'null')||duties.defaults(dutyPeople());
  const exchangeRequests=()=>db.prepare('SELECT payload FROM duty_exchanges ORDER BY rowid DESC').all().map(r=>parse(r.payload));
  const exchangeEvents=()=>db.prepare('SELECT * FROM events').all().map(r=>({...parse(r.payload),id:r.id,owner:r.owner}));
  const exchangeContext=()=>({people:dutyPeople(),config:dutySettings(),events:exchangeEvents(),requests:exchangeRequests(),today:dateKey(),now:Date.now()});
  function reconcileExchanges(){const ctx=exchangeContext();for(const [i,r] of exchanges.reconcile(ctx.requests,ctx).entries())if(r!==ctx.requests[i])db.prepare('UPDATE duty_exchanges SET payload=? WHERE id=?').run(json(r),r.id);}
  function workMetadata(mail,user,recipients,payload){
    if(!payload.workRequest)return {};
    const rows=db.prepare('SELECT * FROM mail_work_responses WHERE mail_id=?').all(mail.id).filter(r=>mail.sender===user.id||r.user_id===user.id);
    return {workResponses:Object.fromEntries(rows.map(r=>[r.user_id,{done:!!r.done,note:r.note,updatedAt:r.updated_at,...(r.response_id?{responseId:r.response_id,...privacy.packet('response',r.response_id,user)}:{})}])),workDelivery:Object.fromEntries(recipients.map(r=>[r.user_id,r.status]))};
  }
  function bootstrap(user,searchMode=false){
    privacy.beginSnapshot();
    const me=value=>value===user.id?'me':value;
    const people=db.prepare('SELECT * FROM users WHERE disabled=0 ORDER BY department,name').all().map(userPublic);
    const rooms=db.prepare('SELECT r.*,m.pinned,m.muted,m.read_seq FROM rooms r JOIN room_members m ON m.room_id=r.id WHERE m.user_id=?').all(user.id).map(r=>{
      const raw=db.prepare('SELECT * FROM messages WHERE room_id=? ORDER BY seq DESC'+(searchMode?'':' LIMIT 500')).all(r.id).reverse();
      return {id:r.id,name:r.name,notice:r.notice,pinned:!!r.pinned,muted:!!r.muted,members:roomUsers(r.id).filter(v=>v!==user.id),unread:db.prepare('SELECT count(*) n FROM messages WHERE room_id=? AND seq>? AND sender<>?').get(r.id,r.read_seq,user.id).n,messages:raw.map(m=>{const likes=db.prepare('SELECT user_id FROM reactions WHERE message_id=?').all(m.id);return {...parse(m.payload),...privacy.packet('message',m.id,user),id:m.id,sender:me(m.sender),likes:likes.length,liked:likes.some(l=>l.user_id===user.id)};})};
    });
    const mailRows=db.prepare("SELECT * FROM mails WHERE sender=? OR id IN(SELECT mail_id FROM recipients WHERE user_id=? AND status NOT IN('recalled','scheduled'))").all(user.id,user.id);
    const mails=mailRows.map(m=>{const recipients=db.prepare('SELECT * FROM recipients WHERE mail_id=?').all(m.id),mine=m.sender===user.id,r=recipients.find(r=>r.user_id===user.id);const payload=parse(m.payload);const inlineStored=/data:image\/(?:png|jpeg|webp|gif);base64,/.test(payload.html||'');const html=inlineStored?payload.html.replace(/data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}/g,''):payload.html;return {...payload,...privacy.packet('mail',m.id,user),storedReceipts:privacy.deliveryMap('mail',m.id),...workMetadata(m,user,recipients,payload),html,inlineStored,files:payload.files.map((file,index)=>({...file,expired:!!file.expiresAt&&file.expiresAt<=Date.now(),stored:true,sourceMail:m.id,index})),id:m.id,from:me(m.sender),to:recipients.map(r=>r.user_id),receipts:recipients.map(r=>r.status==='scheduled'?'unread':r.status),folder:mine?m.sender_folder:r.folder,important:!!(mine?m.sender_important:r.important),unread:!mine&&r.status==='unread',eventId:(mine?m.event_id:r.event_id)||null,previousFolder:mine?'sent':'inbox',canRecall:mine,homeroomHidden:!!r?.homeroom_hidden,homeroomDays:db.prepare('SELECT date,hidden,carried_from FROM homeroom_days WHERE mail_id=? AND user_id=? ORDER BY date').all(m.id,user.id).map(d=>({date:d.date,hidden:!!d.hidden,carriedFrom:d.carried_from}))};}).sort((a,b)=>b.createdAt-a.createdAt);
    const events=db.prepare('SELECT * FROM events').all().filter(e=>{const p=parse(e.payload);return p.duty?(e.owner===user.id||p.targets.includes(user.id)):e.owner===user.id||(['group','makeup','lessonChange'].includes(p.type)&&p.targets.includes(user.id)&&(!(p.noticeMail||p.deliveryMail)||db.prepare("SELECT 1 FROM recipients WHERE mail_id=? AND user_id=? AND status NOT IN('recalled','scheduled')").get(p.noticeMail||p.deliveryMail,user.id)));}).map(e=>({...parse(e.payload),id:e.id,owner:e.owner,readonly:!!parse(e.payload).duty||e.owner!==user.id,canReschedule:(!parse(e.payload).duty||user.admin||dutySettings().managers[parse(e.payload).duty.kind]?.includes(user.id))&&!parse(e.payload).noticeMail&&!['makeup','lessonChange'].includes(parse(e.payload).type)}));
    duties.normalizeTitles(events);
    reconcileExchanges();const exchangeCtx=exchangeContext(),actor={id:user.id,admin:!!user.admin};
    const dutyExchanges=exchangeCtx.requests.filter(r=>exchanges.visible(r,actor,exchangeCtx));
    const notifiedExchanges=new Map(db.prepare('SELECT request_id,version FROM duty_exchange_notices WHERE user_id=?').all(user.id).map(r=>[r.request_id,r.version]));
    const exchangeNotifications=dutyExchanges.filter(r=>notifiedExchanges.get(r.id)!==exchanges.version(r)).slice(0,50);
    const ownKinds=new Set(exchangeCtx.events.filter(e=>e.duty?.assigned.includes(user.id)).map(e=>e.duty.kind));
    const dutyRoster=exchangeCtx.events.filter(e=>e.duty&&ownKinds.has(e.duty.kind)&&e.date>=dateKey()).map(e=>({id:e.id,title:e.title,date:e.date,start:e.start,end:e.end,duty:e.duty}));
    // School-wide duty roster contains only assignment metadata, never personal calendar notes or source messages.
    const dutyCalendar=exchangeCtx.events.filter(e=>Object.hasOwn(duties.types,e.duty?.kind)).map(e=>({id:e.id,title:duties.types[e.duty.kind].label,date:e.date,start:e.start,end:e.end,type:'group',owner:e.owner,duty:e.duty,readonly:true,canReschedule:false}));
    const readReceipts=db.prepare("SELECT r.mail_id AS mail,r.user_id AS recipient,r.read_at AS readAt,u.name,m.payload FROM recipients r JOIN mails m ON m.id=r.mail_id JOIN users u ON u.id=r.user_id WHERE m.sender=? AND r.user_id<>m.sender AND r.status='read' AND r.read_at IS NOT NULL AND r.receipt_notified=0 ORDER BY r.read_at,r.mail_id,r.user_id LIMIT 50").all(user.id).map(({payload,...receipt})=>({...receipt,subject:parse(payload).title||'기타'}));
    const items=db.prepare('SELECT * FROM items WHERE owner=?').all(user.id), data={readReceipts,exchangeNotifications,today:dateKey(),schoolName:db.prepare("SELECT value FROM metadata WHERE key='schoolName'").get()?.value||'우리 학교',people,departments:[...new Set(people.map(p=>p.department))],rooms,mails,events,dutyExchanges,dutyRoster,dutyCalendar,dutySettings:dutySettings(),classTeachers:parse(db.prepare("SELECT value FROM metadata WHERE key='classTeachers'").get()?.value||'[]'),defaultPeriods:defaultPeriods(),bellSchedules:db.prepare('SELECT * FROM bell_schedules ORDER BY date').all().map(row=>({date:row.date,title:row.title,periods:parse(row.periods)})),academic:[],deadlines:[],notes:[],tasks:[],shortcuts:[]};
    for(const item of items)data[item.kind].push({...parse(item.payload),id:item.id});
    return {user:userPublic(user),data,privacy:{version:1,more:privacy.more(),keys:privacy.keys(),fileRetentionDays:10,recalled:db.prepare("SELECT mail_id FROM recipients WHERE user_id=? AND status='recalled'").all(user.id).map(r=>r.mail_id),localRecords:privacy.personal(user),localLedger:db.prepare("SELECT a.* FROM auto_deadline_sources a LEFT JOIN items i ON i.id=a.item_id LEFT JOIN events e ON e.id=a.item_id WHERE i.owner=? OR e.owner=?").all(user.id,user.id)}};
  }
  // Owner-specific extracted copies share a ledger identity except for owner.
  // Update existing copies only: deletion tombstones must not be resurrected.
  function linkedIds(itemId){
    const ledger=db.prepare('SELECT source_key FROM auto_deadline_sources WHERE item_id=?').get(itemId);
    if(!ledger)return [itemId];const key=parse(ledger.source_key);
    return db.prepare('SELECT source_key,item_id FROM auto_deadline_sources').all().filter(row=>{const k=parse(row.source_key);return k[0]===key[0]&&k[1]===key[1]&&k[3]===key[3];}).map(row=>row.item_id);
  }
  function operation(user,op){
    if(!op||typeof op.type!=='string')fail(400,'변경 요청이 올바르지 않습니다.');
    let v=op.value||{}, opId=op.id||v.id;
    if(opId!==undefined)str(opId,100);
    switch(op.type){
    case 'room.create':{
      const users=knownUsers([user.id,...(v.members||[])]),existing=db.prepare('SELECT id FROM rooms WHERE id=?').get(opId);
      if(existing){member(user,opId);return;}
      db.prepare('INSERT INTO rooms(id,name,notice) VALUES(?,?,?)').run(opId,str(v.name,150),'');
      for(const userId of users)db.prepare('INSERT INTO room_members(room_id,user_id) VALUES(?,?)').run(opId,userId);
      break;}
    case 'room.update':{
      member(user,opId);const max=db.prepare('SELECT coalesce(max(seq),0) n FROM messages WHERE room_id=?').get(opId).n;
      db.prepare('UPDATE room_members SET pinned=?,muted=?,read_seq=CASE WHEN ? THEN ? ELSE read_seq END WHERE room_id=? AND user_id=?').run(op.pinned?1:0,op.muted?1:0,op.read?1:0,max,opId,user.id);break;}
    case 'room.leave':member(user,opId);db.prepare('DELETE FROM room_members WHERE room_id=? AND user_id=?').run(opId,user.id);break;
    case 'message.send':{
      member(user,op.room);const existing=db.prepare('SELECT sender,room_id,payload FROM messages WHERE id=?').get(opId);
      if(existing){if(existing.sender!==user.id||existing.room_id!==op.room||v.sealed&&parse(existing.payload).contentDigest!==hash(v.sealed))fail(409,'메시지 식별자가 중복되었습니다.');return;}
      const payload={...(v.sealed?{privateMessage:true,contentDigest:hash(v.sealed)}:{text:str(v.text,5000),reply:typeof v.reply==='string'?str(v.reply,5000,false):''}),date:dateKey(),time:timeKey(),createdAt:Date.now()};
      const row=db.prepare('INSERT INTO messages(id,room_id,sender,payload) VALUES(?,?,?,?)').run(opId,op.room,user.id,json(payload));
      privacy.store('message',opId,user.id,roomUsers(op.room),op,op.room);
      registerDeadlines('message',opId,user.id,roomUsers(op.room),payload);
      db.prepare('UPDATE room_members SET read_seq=? WHERE room_id=? AND user_id=?').run(Number(row.lastInsertRowid),op.room,user.id);break;}
    case 'message.like':{
      const m=db.prepare('SELECT * FROM messages WHERE id=?').get(opId);if(!m)fail(404,'메시지를 찾을 수 없습니다.');member(user,m.room_id);
      if(op.liked)db.prepare('INSERT OR IGNORE INTO reactions VALUES(?,?)').run(opId,user.id);else db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=?').run(opId,user.id);break;}
    case 'mail.send':{
      if(v.titleProvided!==undefined&&typeof v.titleProvided!=='boolean')fail(400,'제목 입력 정보가 올바르지 않습니다.');
      if(v.category!==undefined&&!['','homeroom'].includes(v.category))fail(400,'메시지 분류가 올바르지 않습니다.');
      const existing=db.prepare('SELECT sender,payload FROM mails WHERE id=?').get(opId);if(existing){if(existing.sender!==user.id||v.sealed&&parse(existing.payload).contentDigest!==hash(v.sealed))fail(409,'메시지 식별자가 중복되었습니다.');return;}
      let broadcast=null;if(v.scheduleAnnouncement){if(!user.admin&&!dutySettings().managers.timetable?.includes(user.id))fail(403,'일과표 담당자만 전체 안내를 발송할 수 있습니다.');const scope=v.scheduleAnnouncement.scope==='default'?'default':'temporary',date=validDate(v.scheduleAnnouncement.date);broadcast={date,scope,...bell.announcement(date,scope==='default'?defaultPeriods():periodsFor(date),scope,str(v.title||'',150,false).trim(),!!v.scheduleAnnouncement.restored)};v={...v,title:broadcast.title,body:broadcast.body,html:broadcast.html,to:db.prepare('SELECT id FROM users WHERE disabled=0 AND id<>?').all(user.id).map(u=>u.id),cc:[],files:[],scheduled:'',notice:null,calendarEvent:null};}
      let announcement=null;
      if(v.announcement){
        const audience=v.announcement.audience,department=str(v.announcement.department,60);
        const people=db.prepare('SELECT * FROM users WHERE disabled=0').all();
        if(!['teachers','staff'].includes(audience)||!people.some(p=>p.department===department))fail(400,'수신 대상과 등록된 발신 부서를 선택해 주세요.');
        if(v.notice||broadcast)fail(400,'공지 사항과 수업/일과표 안내를 함께 보낼 수 없습니다.');
        announcement={audience,department};
        v={...v,to:announcements.recipients(people,audience),cc:[]};
      }
      let notice=null;
      if(v.notice){const n=v.notice;if(!['makeup','lessonChange'].includes(n.kind)||!Array.isArray(n.rows)||!n.rows.length||n.rows.length>7)fail(400,'보강/수업 변경 안내의 교시 배정이 올바르지 않습니다.');
        const seen=new Set(),date=validDate(n.date);const rows=n.rows.map(row=>{const period=Number(row.period);if(!Number.isInteger(period)||period<1||period>7||seen.has(period))fail(400,'1~7교시를 중복 없이 선택하세요.');seen.add(period);resolvePeriod(date,period);const teacher=knownUsers([row.teacher])[0],className=str(row.className||'',40,n.kind==='lessonChange');let homeroomTeacher;if(n.kind==='makeup'&&className){const classes=parse(db.prepare("SELECT value FROM metadata WHERE key='classTeachers'").get()?.value||'[]');const mapping=classes.find(c=>c.className.replace(/\s+/g,'')===className.replace(/\s+/g,''));if(!mapping)fail(409,'선택한 반의 담임이 등록되지 않았습니다. 관리자에게 교직원 정보의 학년·반 등록을 요청하세요.');homeroomTeacher=knownUsers([mapping.teacher])[0];}let originalTeacher;if(n.kind==='lessonChange'){originalTeacher=knownUsers([row.originalTeacher])[0];if(originalTeacher===teacher)fail(400,'기존 교사와 교체 교사는 달라야 합니다.');}return {period,teacher,className,...(originalTeacher?{originalTeacher}:{}),...(homeroomTeacher?{homeroomTeacher}:{})};});notice={kind:n.kind,date,rows};if(v.scheduled)fail(400,'수업 안내는 예약 발송을 지원하지 않습니다.');}
      let to=broadcast&&!v.to.length?[]:knownUsers([...new Set([...(Array.isArray(v.to)?v.to:[]),...(Array.isArray(v.cc)?v.cc:[]),...(notice?notice.rows.flatMap(r=>[r.teacher,r.originalTeacher,r.homeroomTeacher].filter(Boolean)):[])])]);
      let workRequest=null,workReminderOf='';
      if(v.workRequest){try{workRequest=workTools.request(v.workRequest,to,v.cc||[],user.id);}catch(error){fail(400,error.message);}}
      if(v.workReminderOf){
        workReminderOf=str(v.workReminderOf,100);
        const original=db.prepare('SELECT * FROM mails WHERE id=?').get(workReminderOf),request=original&&parse(original.payload).workRequest;
        if(!request||original.sender!==user.id||original.sender_folder==='trash')fail(403,'본인이 보낸 완료 요청만 재안내할 수 있습니다.');
        if(workRequest||v.cc?.length||notice||announcement||broadcast||v.scheduled)fail(400,'재안내는 별도 요청이나 예약 없이 보낼 수 있습니다.');
        if(to.some(id=>!request.targets.includes(id)))fail(403,'원 요청 대상자에게만 재안내할 수 있습니다.');
        const pending=new Set(db.prepare("SELECT r.user_id FROM recipients r LEFT JOIN mail_work_responses w ON w.mail_id=r.mail_id AND w.user_id=r.user_id WHERE r.mail_id=? AND r.status IN('read','unread') AND coalesce(w.done,0)=0").all(workReminderOf).map(r=>r.user_id));
        to=to.filter(id=>pending.has(id));if(!to.length)fail(409,'선택한 선생님이 모두 완료했거나 요청이 회수되었습니다. 현황을 다시 확인해 주세요.');
      }
      const files=Array.isArray(v.files)?v.files:[];if(files.length>20)fail(400,'첨부 파일은 20개까지 가능합니다.');let bytes=0;
      const cleanFiles=files.map(f=>{const data=str(f.data,3*1024*1024,false);if(!/^data:[a-zA-Z0-9.+\/-]+;base64,[A-Za-z0-9+/=]*$/.test(data))fail(400,'첨부 파일 데이터 형식이 올바르지 않습니다.');const count=Buffer.from(data.split(',')[1],'base64').length;bytes+=count;if(count>2*1024*1024||bytes>3*1024*1024)fail(413,'첨부 파일 크기 제한을 초과했습니다.');return {name:str(f.name,180),size:str(f.size||Math.ceil(count/1024)+' KB',30),bytes:count,data,...(f.inline===true?{inline:true}:{})};});
      for(const match of String(v.html||'').matchAll(/data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})/g)){
        const count=Buffer.from(match[1],'base64').length;bytes+=count;
        if(count>2*1024*1024||bytes>3*1024*1024)fail(413,'본문 이미지와 첨부 파일 크기 제한을 초과했습니다.');
      }
      let scheduled='';if(v.scheduled){scheduled=str(v.scheduled,40);const at=new Date(scheduled).getTime();if(!Number.isFinite(at)||at<=Date.now())fail(400,'예약 발송 시간은 현재 이후여야 합니다.');scheduled=new Date(at).toISOString();}
      let calendarEvent='';if(v.calendarEvent){calendarEvent=str(v.calendarEvent,100);const event=db.prepare('SELECT * FROM events WHERE id=?').get(calendarEvent);if(!event||event.owner!==user.id)fail(403,'본인의 일정만 메시지로 공유할 수 있습니다.');const shared=parse(event.payload);if(announcement)shared.targets=to;if(!shared.targets.length||to.some(id=>!shared.targets.includes(id))||shared.targets.some(id=>!to.includes(id)))fail(400,'메시지 수신자와 일정 수신자가 일치해야 합니다.');if(scheduled)shared.deliveryMail=opId;db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(shared),calendarEvent);}
      const payload={title:str(v.title||(v.category==='homeroom'?'담임':''),150,false),...(v.category==='homeroom'?{category:'homeroom',titleProvided:v.titleProvided===undefined?!!String(v.title||'').trim()&&String(v.title).trim()!=='담임':v.titleProvided}:{}),body:str(v.body,100000),html:typeof v.html==='string'?str(v.html,4400000,false):'',cc:Array.isArray(v.cc)?v.cc.filter(u=>to.includes(u)):[],files:cleanFiles,date:dateKey(),time:timeKey(),scheduled,createdAt:Date.now(),...(notice?{notice}:{}),...(announcement?{announcement}:{}),...(calendarEvent?{calendarEvent}:{}),...(broadcast?{scheduleAnnouncement:{date:broadcast.date,scope:broadcast.scope}}:{})};
      if(v.sealed){delete payload.title;delete payload.body;delete payload.html;payload.privateMessage=true;payload.contentDigest=hash(v.sealed);}
      payload.files=privacy.files(opId,cleanFiles,scheduled,payload.createdAt);
      if(workRequest)payload.workRequest=workRequest;
      if(workReminderOf)payload.workReminderOf=workReminderOf;
      db.prepare('INSERT INTO mails(id,sender,payload,sender_important) VALUES(?,?,?,?)').run(opId,user.id,json(payload),v.important?1:0);
      for(const userId of to)db.prepare('INSERT INTO recipients(mail_id,user_id,status,important) VALUES(?,?,?,?)').run(opId,userId,scheduled?'scheduled':'unread',v.important?1:0);
      privacy.store('mail',opId,user.id,to,op);
      if(!scheduled)registerDeadlines('mail',opId,user.id,to,payload);
      if(calendarEvent){db.prepare('UPDATE mails SET event_id=? WHERE id=?').run(calendarEvent,opId);db.prepare('UPDATE recipients SET event_id=? WHERE mail_id=?').run(calendarEvent,opId);}
      if(notice)for(const row of notice.rows){const slot=resolvePeriod(notice.date,row.period);const event={title:`${notice.kind==='makeup'?'보강 안내':'수업 변경 안내'} · ${row.period}교시${row.className?' · '+row.className:''}`,date:notice.date,start:slot.start,end:slot.end,type:notice.kind,period:row.period,targets:[...new Set([row.teacher,row.originalTeacher,row.homeroomTeacher].filter(Boolean))],note:payload.privateMessage?'':payload.body.slice(0,1000),place:row.className,assignment:row,noticeMail:opId};db.prepare('INSERT INTO events VALUES(?,?,?)').run(opId+'-p'+row.period,user.id,json(event));}break;}
    case 'mail.update':{
      const mail=db.prepare('SELECT * FROM mails WHERE id=?').get(opId);if(!mail)fail(404,'메시지를 찾을 수 없습니다.');const mine=mail.sender===user.id,r=db.prepare('SELECT * FROM recipients WHERE mail_id=? AND user_id=?').get(opId,user.id);
      if(!mine&&(!r||r.status==='recalled'||r.status==='scheduled'))fail(403,'이 메시지에 접근할 수 없습니다.');
      if(op.recall){if(!mine)fail(403,'보낸 사람만 회수할 수 있습니다.');const revoked=db.prepare("SELECT user_id FROM recipients WHERE mail_id=? AND status IN('unread','scheduled')").all(opId).map(r=>r.user_id);db.prepare("UPDATE recipients SET status='recalled' WHERE mail_id=? AND status IN('unread','scheduled')").run(opId);privacy.revoke('mail',opId,revoked);privacy.cancelScheduledFiles(opId);}
      if(op.eventId){const event=db.prepare('SELECT owner FROM events WHERE id=?').get(op.eventId)||db.prepare("SELECT owner FROM items WHERE id=? AND kind IN('deadlines','notes')").get(op.eventId);if(!event||event.owner!==user.id)fail(403,'본인의 일정만 연동할 수 있습니다.');}
      const folder=op.folder||(mine?mail.sender_folder:r.folder);if(!(mine?['sent','trash']:['inbox','trash']).includes(folder))fail(400,'메시지 폴더가 올바르지 않습니다.');
      if(mine)db.prepare('UPDATE mails SET sender_folder=?,sender_important=?,event_id=coalesce(?,event_id) WHERE id=?').run(folder,op.important?1:0,op.eventId||null,opId);
      else db.prepare("UPDATE recipients SET folder=?,important=?,status=CASE WHEN ? AND status='unread' THEN 'read' ELSE status END,read_at=CASE WHEN ? AND status='unread' THEN ? ELSE read_at END,event_id=coalesce(?,event_id) WHERE mail_id=? AND user_id=?").run(folder,op.important?1:0,op.read?1:0,op.read?1:0,Date.now(),op.eventId||null,opId,user.id);break;}
    case 'mail.work.respond':{
      const mail=db.prepare('SELECT * FROM mails WHERE id=?').get(opId),request=mail&&parse(mail.payload).workRequest;
      const recipient=db.prepare("SELECT * FROM recipients WHERE mail_id=? AND user_id=? AND status IN('read','unread') AND folder<>'trash'").get(opId,user.id);
      if(!request||!recipient||mail.sender===user.id||!request.targets.includes(user.id))fail(403,'본인이 받은 완료 요청만 처리할 수 있습니다.');
      if(typeof v.done!=='boolean'||(v.recipient!==undefined&&v.recipient!==user.id))fail(400,'완료 응답이 올바르지 않습니다.');
      const note=str(v.note||'',500,false),now=Date.now();
      if(v.sealed){const previous=db.prepare('SELECT response_id FROM mail_work_responses WHERE mail_id=? AND user_id=?').get(opId,user.id);if(previous?.response_id&&previous.response_id!==v.responseId)privacy.revoke('response',previous.response_id,[user.id,mail.sender]);if(!previous||previous.response_id!==v.responseId)privacy.store('response',v.responseId,user.id,[mail.sender],op,opId);}
      db.prepare('INSERT INTO mail_work_responses(mail_id,user_id,done,note,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(mail_id,user_id) DO UPDATE SET done=excluded.done,note=excluded.note,updated_at=excluded.updated_at').run(opId,user.id,v.done?1:0,note,now);
      if(v.sealed)db.prepare('UPDATE mail_work_responses SET response_id=? WHERE mail_id=? AND user_id=?').run(v.responseId,opId,user.id);
      break;
    }
    case 'mail.receipt.ack':{
      const recipient=str(v.recipient,100),row=db.prepare('SELECT m.sender,r.status,r.read_at FROM recipients r JOIN mails m ON m.id=r.mail_id WHERE r.mail_id=? AND r.user_id=?').get(opId,recipient);
      if(!row||row.sender!==user.id)fail(403,'본인이 보낸 메시지의 수신 알림만 확인할 수 있습니다.');
      if(row.status!=='read'||row.read_at===null)fail(409,'아직 수신 확인된 메시지가 아닙니다.');
      db.prepare('UPDATE recipients SET receipt_notified=1 WHERE mail_id=? AND user_id=?').run(opId,recipient);break;
    }
    case 'event.reschedule':{
      const row=db.prepare('SELECT * FROM events WHERE id=?').get(opId);if(!row)fail(404,'일정을 찾을 수 없습니다.');const existing=parse(row.payload);
      if(existing.duty){
        if(!user.admin&&!dutySettings().managers[existing.duty.kind]?.includes(user.id))fail(403,'관리자 또는 이 업무의 담당자만 일정을 이동할 수 있습니다.');
        if(!v.expected||['date','start','end'].some(key=>v.expected[key]!==existing[key]))fail(409,'다른 사용자가 일정을 변경했습니다. 다시 확인해 주세요.');
      }else if(row.owner!==user.id&&!(existing.type==='group'&&existing.targets?.includes(user.id)))fail(403,'함께 등록된 일정만 이동할 수 있습니다.');
      if(existing.noticeMail||['makeup','lessonChange'].includes(existing.type))fail(409,'교시에 연결된 수업은 일과표에서 변경해 주세요.');
      const date=validDate(v.date),start=str(v.start,5),end=str(v.end,5);
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end)||start>=end)fail(400,'시작·종료 시간이 올바르지 않습니다.');
      if(existing.duty&&db.prepare('SELECT id,payload FROM events WHERE id<>?').all(opId).some(row=>{const other=parse(row.payload);return other.duty?.kind===existing.duty.kind&&other.date===date;}))fail(409,'이미 같은 업무 일정이 있는 날짜입니다.');
      for(const targetId of linkedIds(opId)){const target=db.prepare('SELECT payload FROM events WHERE id=?').get(targetId);if(target)db.prepare('UPDATE events SET payload=? WHERE id=?').run(json({...parse(target.payload),date,start,end}),targetId);}
      break;}
    case 'deadline.reschedule':{
      const row=db.prepare("SELECT * FROM items WHERE id=? AND kind='deadlines'").get(opId);if(!row)fail(404,'마감 일정을 찾을 수 없습니다.');if(row.owner!==user.id)fail(403,'본인의 마감 일정만 이동할 수 있습니다.');
      const date=validDate(v.date),dueTime=str(v.dueTime,5);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))fail(400,'마감 시간이 올바르지 않습니다.');
      for(const targetId of linkedIds(opId)){const target=db.prepare("SELECT payload FROM items WHERE id=? AND kind='deadlines'").get(targetId);if(target)db.prepare('UPDATE items SET payload=? WHERE id=?').run(json({...parse(target.payload),date,dueTime,rule:'explicit'}),targetId);}
      break;}
    case 'event.upsert':{
      if(typeof opId==='string'&&opId.startsWith('duty-'))fail(409,'업무 일정은 기타 업무에서 엑셀로 변경해 주세요.');
      const existing=db.prepare('SELECT owner,payload FROM events WHERE id=?').get(opId);if(existing&&existing.owner!==user.id)fail(403,'다른 선생님의 일정은 수정할 수 없습니다.');
      if(existing&&parse(existing.payload).duty)fail(409,'업무 일정은 기타 업무에서 엑셀로 변경해 주세요.');
      if(existing&&parse(existing.payload).noticeMail){const event=parse(existing.payload),slot=resolvePeriod(event.date,event.period);event.start=slot.start;event.end=slot.end;db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(event),opId);break;}
      if(!['personal','group','repeat','makeup'].includes(v.type))fail(400,'일정 종류가 올바르지 않습니다.');
      const slot=v.type==='makeup'?resolvePeriod(validDate(v.date),v.period):null;
      const start=slot?slot.start:str(v.start,5),end=slot?slot.end:str(v.end,5);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end)||start>=end)fail(400,'시작·종료 시간이 올바르지 않습니다. 종료 시간은 시작 시간보다 늦어야 합니다.');
      const targets=['group','makeup'].includes(v.type)&&v.targets?.length?knownUsers(v.targets):[];
      if(v.type==='makeup'&&(!targets.length||!String(v.note||'').trim()))fail(400,'보강 안내에는 수신자와 안내 내용이 필요합니다.');
      const payload={title:str(v.title,100),date:validDate(v.date),start,end,type:v.type,place:str(v.place||'',100,false),note:str(v.note||'',1000,false),targets,...(slot?{period:slot.period}: {}),...(existing&&parse(existing.payload).deliveryMail?{deliveryMail:parse(existing.payload).deliveryMail}:{}),...(existing&&parse(existing.payload).source?{source:parse(existing.payload).source,rule:parse(existing.payload).rule}: {})};
      db.prepare('INSERT INTO events VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(opId,user.id,json(payload));break;}
    case 'event.delete':{const existing=db.prepare('SELECT owner,payload FROM events WHERE id=?').get(opId);if(!existing)return;if(parse(existing.payload).duty)fail(409,'업무 일정은 기타 업무에서 엑셀로 변경해 주세요.');if(existing.owner!==user.id)fail(403,'다른 선생님의 일정은 삭제할 수 없습니다.');db.prepare('DELETE FROM events WHERE id=?').run(opId);break;}
    case 'duty.exchange.ack':{
      const ctx=exchangeContext(),r=ctx.requests.find(r=>r.id===opId);
      if(!r||!exchanges.visible(r,{id:user.id,admin:!!user.admin},ctx))fail(403,'이 교환 요청의 알림을 확인할 수 없습니다.');
      // A delayed acknowledgement must never suppress a later transition.
      if(v.version===exchanges.version(r))db.prepare('INSERT INTO duty_exchange_notices VALUES(?,?,?) ON CONFLICT(request_id,user_id) DO UPDATE SET version=excluded.version').run(r.id,user.id,v.version);
      break;}
    case 'duty.exchange.create':
    case 'duty.exchange.act':{
      reconcileExchanges();const ctx=exchangeContext(),actor={id:user.id,admin:!!user.admin};
      if(op.type==='duty.exchange.create'){
        const request=exchanges.create(v,actor,ctx);db.prepare('INSERT INTO duty_exchanges VALUES(?,?)').run(request.id,json(request));
      }else{
        const result=exchanges.act(ctx.requests.find(r=>r.id===opId),v.action,v.note,actor,ctx);
        for(const event of result.events)db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(event),event.id);
        db.prepare('UPDATE duty_exchanges SET payload=? WHERE id=?').run(json(result.request),result.request.id);
      }
      break;}
    case 'duty.settings':{
      if(!user.admin)fail(403,'업무 담당자 설정은 관리자만 변경할 수 있습니다.');
      let config;try{config=duties.settings(v,dutyPeople());}catch(error){fail(400,error.message);}
      db.prepare("INSERT INTO metadata(key,value) VALUES('dutySettings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(json(config));
      const active=new Set(dutyPeople().map(p=>p.id));
      for(const row of db.prepare('SELECT * FROM events').all()){const event=parse(row.payload);if(!event.duty)continue;event.targets=[...new Set([...config.managers[event.duty.kind],...event.duty.assigned,row.owner])].filter(id=>active.has(id));db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(event),row.id);}
      break;}
    case 'duty.update':{
      const row=db.prepare('SELECT * FROM events WHERE id=?').get(opId);if(!row)fail(404,'업무 일정을 찾을 수 없습니다.');
      const existing=parse(row.payload),kind=existing.duty?.kind,config=dutySettings();
      if(!Object.hasOwn(duties.types,kind))fail(400,'업무 일정만 배정을 변경할 수 있습니다.');
      if(!user.admin&&!config.managers[kind].includes(user.id))fail(403,'관리자 또는 이 업무의 담당자만 배정을 변경할 수 있습니다.');
      if(!duties.sameAssignment(existing.duty.assigned,v.expectedAssigned))fail(409,'다른 사용자가 배정을 변경했습니다. 상세 화면을 다시 열어 주세요.');
      let updated;try{updated=duties.reassign({...existing,owner:row.owner},v.assigned,config,dutyPeople());}catch(error){fail(400,error.message);}
      db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(updated),opId);break;}
    case 'duty.import':{
      const config=dutySettings();if(!Object.hasOwn(duties.types,v.kind))fail(400,'업무 종류를 확인해 주세요.');
      if(!user.admin&&!config.managers[v.kind].includes(user.id))fail(403,'관리자 또는 이 업무의 담당자만 업로드할 수 있습니다.');
      let result;try{result=duties.plan(v.kind,v.rows,config,dutyPeople());}catch(error){fail(400,error.message);}
      if(result.errors.length)fail(400,result.errors.slice(0,10).join('\n'));
      let imported;try{imported=duties.imports(db.prepare('SELECT id,payload FROM events').all().map(row=>({...parse(row.payload),id:row.id})),result.events);}catch(error){fail(409,error.message);}
      for(const event of imported)db.prepare('INSERT INTO events VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(event.id,user.id,json(event));
      break;}
    case 'classes.upsert':{
      if(!user.admin)fail(403,'반·담임 설정은 관리자만 변경할 수 있습니다.');if(!Array.isArray(v.classes)||v.classes.length>200)fail(400,'반·담임 목록이 올바르지 않습니다.');const seen=new Set();const classes=v.classes.map(c=>{if(!c||typeof c!=='object')fail(400,'반 정보가 올바르지 않습니다.');const className=str(c.className,40),key=className.replace(/\s+/g,'');if(seen.has(key))fail(400,'같은 반은 한 번만 등록하세요.');seen.add(key);const teacher=knownUsers([c.teacher])[0];return {className,teacher};});db.prepare("INSERT OR REPLACE INTO metadata VALUES('classTeachers',?)").run(json(classes));break;
    }
    case 'schedule.upsert':
    case 'schedule.delete':{
      if(!user.admin&&!dutySettings().managers.timetable?.includes(user.id))fail(403,'학교 일과표는 관리자 또는 일과표 담당자만 변경할 수 있습니다.');
      const date=v.date?validDate(v.date):'';
      if(op.type==='schedule.delete'){if(!date)fail(400,'기본 일과표는 삭제할 수 없습니다.');db.prepare('DELETE FROM bell_schedules WHERE date=?').run(date);}
      else {let periods;try{periods=bell.validate(v.periods);}catch(error){fail(400,error.message);}
        if(date)db.prepare('INSERT INTO bell_schedules(date,periods,title) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET periods=excluded.periods,title=excluded.title').run(date,json(periods),str(v.title||'',150,false).trim());
        else db.prepare("INSERT OR REPLACE INTO metadata VALUES('defaultPeriods',?)").run(json(periods));
      }
      for(const item of db.prepare("SELECT * FROM items WHERE kind='deadlines'").all()){const payload=parse(item.payload);if(payload.rule!=='lunch'||date&&payload.date!==date)continue;payload.dueTime=deadlines.lunchTime(payload.date,{bellSchedules:db.prepare('SELECT * FROM bell_schedules').all().map(r=>({date:r.date,periods:parse(r.periods)})),defaultPeriods:db.prepare("SELECT value FROM metadata WHERE key='defaultPeriods'").get()?defaultPeriods():undefined});db.prepare('UPDATE items SET payload=? WHERE id=?').run(json(payload),item.id);}
      for(const event of db.prepare('SELECT * FROM events').all()){const payload=parse(event.payload);if(!['makeup','lessonChange'].includes(payload.type)||date&&payload.date!==date)continue;const slot=resolvePeriod(payload.date,payload.period);payload.start=slot.start;payload.end=slot.end;db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(payload),event.id);}
      break;
    }
    case 'homeroom.defer':
    case 'homeroom.dismiss':{
      const mailId=str(v.mail,100),row=db.prepare('SELECT payload FROM mails WHERE id=?').get(mailId),recipient=db.prepare("SELECT * FROM recipients WHERE mail_id=? AND user_id=? AND status NOT IN('recalled','scheduled') AND folder<>'trash'").get(mailId,user.id);
      if(!row||!recipient||parse(row.payload).category!=='homeroom')fail(403,'수신한 담임 업무만 변경할 수 있습니다.');
      if(op.type==='homeroom.dismiss'&&v.date===undefined){db.prepare('UPDATE recipients SET homeroom_hidden=1 WHERE mail_id=? AND user_id=?').run(mailId,user.id);break;}
      const date=validDate(v.date),mail={...parse(row.payload),homeroomHidden:!!recipient.homeroom_hidden,homeroomDays:db.prepare('SELECT date,hidden,carried_from FROM homeroom_days WHERE mail_id=? AND user_id=?').all(mailId,user.id).map(d=>({date:d.date,hidden:!!d.hidden,carriedFrom:d.carried_from}))};
      if(op.type==='homeroom.dismiss'){
        if(date!==homeroom.receivedDate(mail)&&!mail.homeroomDays.some(d=>d.date===date))fail(403,'이 날짜에 받은 담임 업무가 없습니다.');
        db.prepare('INSERT INTO homeroom_days(mail_id,user_id,date,hidden) VALUES(?,?,?,1) ON CONFLICT(mail_id,user_id,date) DO UPDATE SET hidden=1').run(mailId,user.id,date);
      }else{
        if(!homeroom.onDay(mail,date))fail(403,'이 날짜에 받은 담임 업무가 없습니다.');const target=homeroom.nextDay(date);validDate(target);
        db.prepare('INSERT OR IGNORE INTO homeroom_days(mail_id,user_id,date,hidden,carried_from) VALUES(?,?,?,0,?)').run(mailId,user.id,target,date);
      }break;
    }
    case 'homeroom.pin':{
      const mailId=str(v.mail,100),itemId='user-homeroom-'+hash(json([user.id,mailId]));
      if(typeof v.pinned!=='boolean')fail(400,'고정 여부가 올바르지 않습니다.');
      if(!v.pinned){db.prepare('DELETE FROM items WHERE id=? AND owner=?').run(itemId,user.id);break;}
      const row=db.prepare('SELECT * FROM mails WHERE id=?').get(mailId),recipient=db.prepare("SELECT * FROM recipients WHERE mail_id=? AND user_id=? AND status NOT IN('recalled','scheduled') AND folder<>'trash'").get(mailId,user.id);
      if(!row||!recipient||parse(row.payload).category!=='homeroom')fail(403,'수신한 담임 메시지만 고정할 수 있습니다.');
      const payload=homeroom.pinnedItem({...parse(row.payload),id:mailId},v.date===undefined?dateKey():validDate(v.date));
      db.prepare('INSERT OR IGNORE INTO items VALUES(?,?,?,?)').run(itemId,user.id,'deadlines',json(payload));break;
    }
    case 'item.upsert':{
      if(!['notes','deadlines','tasks','shortcuts'].includes(op.kind))fail(400,'개인 항목 종류가 올바르지 않습니다.');const existing=db.prepare('SELECT owner,kind,payload FROM items WHERE id=?').get(opId);if(existing&&(existing.owner!==user.id||existing.kind!==op.kind))fail(403,'본인의 항목만 수정할 수 있습니다.');
      let payload;
      if(op.kind==='notes')payload={date:validDate(v.date),time:str(v.time,5),text:str(v.text,1200)};
      if(op.kind==='deadlines'){const dueTime=str(v.dueTime||'',5,false);if(dueTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))fail(400,'마감 시간 형식이 올바르지 않습니다.');payload={title:str(v.title,150),date:validDate(v.date),dueTime,note:str(v.note||'',1000,false),done:!!v.done,...(existing&&parse(existing.payload).source?{source:parse(existing.payload).source,rule:parse(existing.payload).rule,titleFromMail:parse(existing.payload).titleFromMail,...(parse(existing.payload).homeroomMail?{homeroomMail:parse(existing.payload).homeroomMail}:{})}: {})};}
      if(op.kind==='tasks')payload={title:str(v.title,150),done:!!v.done};
      if(op.kind==='shortcuts'){const url=new URL(str(v.url,2000));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail(400,'웹 주소 형식이 올바르지 않습니다.');payload={title:str(v.title,100),desc:str(v.desc||'',200,false),url:url.href,icon:'link'};}
      db.prepare('INSERT INTO items VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(opId,user.id,op.kind,json(payload));break;}
    case 'item.delete':{const existing=db.prepare('SELECT owner FROM items WHERE id=?').get(opId);if(existing&&existing.owner!==user.id)fail(403,'본인의 항목만 삭제할 수 있습니다.');db.prepare('DELETE FROM items WHERE id=?').run(opId);break;}
    default:fail(400,'지원하지 않는 변경 요청입니다.');
    }
  }
  function authentication(req){
    const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)fail(401,'로그인이 필요합니다.');
    const tokenHash=hash(token),now=Date.now();
    const row=db.prepare('SELECT u.*,s.expires,r.token_hash IS NOT NULL AS remembered FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN remembered_sessions r ON r.token_hash=s.token_hash WHERE s.token_hash=? AND s.expires>? AND u.disabled=0').get(tokenHash,now);
    if(!row)fail(401,'로그인이 만료되었습니다. 다시 로그인해 주세요.');
    if(row.remembered&&!row.must_change&&row.expires<now+REMEMBER_MS-DAY_MS){
      row.expires=now+REMEMBER_MS;db.prepare('UPDATE sessions SET expires=? WHERE token_hash=?').run(row.expires,tokenHash);
    }
    return {...row,tokenHash};
  }
  async function body(req){
    let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>8*1024*1024)fail(413,'요청 크기가 너무 큽니다.');chunks.push(chunk);}try{return parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'요청 데이터가 올바르지 않습니다.');}
  }
  const send=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(json(value));};
  // Reclassify only existing auto-created items; deleted items stay deleted.
  db.exec('BEGIN IMMEDIATE');
  try{for(const item of db.prepare("SELECT * FROM items WHERE kind='deadlines'").all()){
    const old=parse(item.payload);if(!old.source)continue;
    const source=db.prepare(old.source.kind==='message'?'SELECT payload FROM messages WHERE id=?':'SELECT payload FROM mails WHERE id=?').get(old.source.id);if(!source)continue;
    const original=parse(source.payload),entry=deadlines.extractEvents(old.note||old.title,original.scheduled||original.createdAt||original.date)[0];if(!entry)continue;
    const ledger=db.prepare('SELECT source_key FROM auto_deadline_sources WHERE item_id=?').get(item.id);if(!ledger)continue;
    const text=old.source.kind==='message'?original.text:(original.title||'')+'\n'+original.body;
    const index=deadlines.extractEvents(text,original.scheduled||original.createdAt||original.date).findIndex(e=>e.note===entry.note&&e.date===entry.date&&e.start===entry.start&&e.end===entry.end);if(index<0)continue;
    const key=deadlines.sourceKey(old.source.kind+'-event',old.source.id,item.owner,index),eventId='auto-'+hash(key);
    const added=db.prepare('INSERT OR IGNORE INTO auto_deadline_sources VALUES(?,?)').run(key,eventId);
    if(added.changes)db.prepare('INSERT INTO events VALUES(?,?,?)').run(eventId,item.owner,json({...entry,source:old.source}));
    db.prepare('DELETE FROM items WHERE id=?').run(item.id);
    db.prepare('UPDATE mails SET event_id=? WHERE event_id=?').run(eventId,item.id);db.prepare('UPDATE recipients SET event_id=? WHERE event_id=?').run(eventId,item.id);
  }
  for(const message of db.prepare('SELECT id,room_id,sender,payload FROM messages').all()){const payload=parse(message.payload),recipients=roomUsers(message.room_id);registerStartEvents('message',message.id,message.sender,recipients,payload);registerRangeEvents('message',message.id,message.sender,recipients,payload);}
  for(const mail of db.prepare('SELECT id,sender,payload FROM mails').all()){
    const recipients=db.prepare("SELECT user_id,status FROM recipients WHERE mail_id=?").all(mail.id);if(recipients.some(r=>r.status==='scheduled'))continue;
    const targets=recipients.filter(r=>r.status!=='recalled').map(r=>r.user_id),payload=parse(mail.payload);registerStartEvents('mail',mail.id,mail.sender,targets,payload);registerRangeEvents('mail',mail.id,mail.sender,targets,payload);
  }
  for(const table of ['events','items'])for(const row of db.prepare(table==='events'?'SELECT id,payload FROM events':"SELECT id,payload FROM items WHERE kind='deadlines'").all()){
    const entry=parse(row.payload);if(entry.source?.kind!=='mail'||entry.titleFromMail)continue;
    const mail=db.prepare('SELECT payload FROM mails WHERE id=?').get(entry.source.id);if(!mail)continue;
    const updated=deadlines.withSourceTitle(entry,'mail',parse(mail.payload));
    if(updated!==entry)db.prepare(`UPDATE ${table} SET payload=? WHERE id=?`).run(json(updated),row.id);
  }
  db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');db.close();throw error;}
  const server=https.createServer({key:tls.key,cert:tls.cert,minVersion:'TLSv1.2'},async(req,res)=>{
    try{
      const url=new URL(req.url,'https://localhost');const route=url.pathname;
      if(route==='/health'&&req.method==='GET'){send(res,200,{ok:true,version:require('../package.json').version,messagePrivacy:relay?2:1});return;}
      if(route==='/login'&&req.method==='POST'){
        const payload=await body(req),username=str(payload.username,40),address=req.socket.remoteAddress||'',key=address+':'+username,started=Date.now();
        let attempt=loginAttempts.get(key);
        if(!attempt||attempt.until<=started){attempt={count:0,until:started+LOGIN_WINDOW_MS};loginAttempts.set(key,attempt);}
        if(attempt.count>=LOGIN_LIMIT)fail(429,'로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.');
        const active=loginChecks.get(address)||0;
        if(active>=LOGIN_CHECKS_PER_ADDRESS)fail(429,'로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
        // Reserve the attempt before the slow password check, so parallel requests cannot exceed the limit.
        attempt.count++;loginChecks.set(address,active+1);
        let user,matched=false;
        try{
          user=db.prepare('SELECT * FROM users WHERE username=? AND disabled=0').get(username);
          matched=await passwordMatches(payload.password,user||LOGIN_DECOY);
        }finally{
          const left=(loginChecks.get(address)||1)-1;
          if(left>0)loginChecks.set(address,left);else loginChecks.delete(address);
        }
        if(!user||!matched)fail(401,'아이디 또는 비밀번호를 확인해 주세요.');
        if(!db.prepare('SELECT 1 FROM users WHERE id=? AND digest=? AND disabled=0').get(user.id,user.digest))fail(401,'계정이 변경되었습니다. 다시 로그인해 주세요.');
        loginAttempts.delete(key);const token=crypto.randomBytes(32).toString('hex'),remembered=payload.remember===true;
        const tokenHash=hash(token);
        db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').run(tokenHash,user.id,Date.now()+(remembered&&!user.must_change?REMEMBER_MS:SESSION_MS));
        if(remembered)db.prepare('INSERT INTO remembered_sessions(token_hash) VALUES(?)').run(tokenHash);
        send(res,200,{token,user:userPublic(user),remembered});return;
      }
      const user=authentication(req);
      if(route==='/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(user.tokenHash);for(const response of streams.get(user.id)||[])if(response.dingdongToken===user.tokenHash)response.end();send(res,200,{ok:true});return;}
      if(route==='/password'&&req.method==='POST'){
        const payload=await body(req);if(!(await passwordMatches(payload.current,user)))fail(403,'현재 비밀번호가 올바르지 않습니다.');const record=await passwordRecord(payload.password);
        if(authentication(req).digest!==user.digest)fail(401,'계정이 변경되었습니다. 다시 로그인해 주세요.');
        db.prepare('UPDATE users SET salt=?,digest=?,must_change=0 WHERE id=?').run(record.salt,record.digest,user.id);db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id,user.tokenHash);
        if(user.remembered)db.prepare('UPDATE sessions SET expires=? WHERE token_hash=?').run(Date.now()+REMEMBER_MS,user.tokenHash);
        for(const stream of streams.get(user.id)||[])if(stream.dingdongToken!==user.tokenHash)stream.end();
        notify([user.id]);send(res,200,{ok:true});return;
      }
      if(user.must_change)fail(403,'임시 비밀번호를 먼저 변경해 주세요.');
      if(route==='/session'&&req.method==='GET'){
        if(!user.remembered)fail(403,'자동 로그인이 설정되지 않았습니다.');
        send(res,200,{user:userPublic(user)});return;
      }
      if(route==='/privacy/register'&&req.method==='POST'){send(res,200,await privacy.register(user,await body(req)));return;}
      if(recovery&&route==='/privacy/recovery'&&req.method==='POST'){
        send(res,200,await recovery.request(user,await body(req),()=>authentication(req)));return;
      }
      if(recovery&&route==='/admin/key-recovery'&&req.method==='POST'){
        if(!user.admin||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail(403,'서버 PC에서 관리자 계정으로 승인해 주세요.');
        const p=await body(req);
        if(!await passwordMatches(p.password,user))fail(403,'관리자 비밀번호를 확인해 주세요.');
        if(authentication(req).digest!==user.digest)fail(401,'관리자 계정이 변경되었습니다. 다시 로그인해 주세요.');
        const result=recovery.approve(user,p);
        dispatch.refresh();relay.checkpoint();
        for(const stream of streams.get(p.id)||[])stream.end();
        notify();send(res,200,result);return;
      }
      if(route==='/privacy/keys'&&req.method==='GET'){send(res,200,{keys:privacy.keys()});return;}
      if(route==='/privacy/localize'&&req.method==='POST'){const p=await body(req);db.exec('BEGIN IMMEDIATE');try{privacy.localize(user,p.entries);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}privacy.checkpoint();send(res,200,{ok:true});return;}
      if(route==='/privacy/ack'&&req.method==='POST'){
        const p=await body(req);let audience;db.exec('BEGIN IMMEDIATE');try{audience=privacy.acknowledgements(user,p.entries);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}privacy.checkpoint();if(audience.length)notify(audience);send(res,200,{ok:true});return;
      }
      if(relay&&route.startsWith('/relay/')){
        if(route==='/relay/state'&&req.method==='GET'){send(res,200,{sequence:relay.sequence(user)});return;}
        if(route==='/relay/pull'&&req.method==='GET'){send(res,200,relay.pull(user,Number(url.searchParams.get('after')||0)));return;}
        if(req.method==='POST'){
          const p=await body(req);let result;
          if(route==='/relay/send'){
            result=await relay.send(user,p);
            if(!result.duplicate){
              if(!result.released)dispatch.refresh();
              notify(result.released?p.context.targets:[user.id]);
            }
          }
          else if(route.startsWith('/relay/blob/'))result=await relay.blobs.handle(user,route.slice('/relay/blob/'.length),p);
          else if(route==='/relay/upload')result=relay.upload(user,p);
          else if(route==='/relay/file')result=relay.file(user,p);
          else if(route==='/relay/ack')result=relay.ack(user,p);
          else if(route==='/relay/cancel'){result=relay.cancel(user,p);dispatch.refresh();}
          else if(route==='/relay/migrate')result=relay.migrate(user,p);
          else fail(404,'요청한 전달 기능을 찾을 수 없습니다.');
          if(['/relay/send','/relay/ack','/relay/cancel','/relay/migrate'].includes(route))relay.checkpoint();
          send(res,200,result);return;
        }
      }
      if(route==='/bootstrap'&&req.method==='GET'){const result=bootstrap(user,url.searchParams.has('privacy'));send(res,200,relay?relay.decorate(user,result):result);return;}
      if(route==='/search'&&req.method==='POST'){
        let filters;try{filters=workTools.filters(await body(req));}catch(error){fail(400,error.message);}
        const snapshot=bootstrap(user,true);send(res,200,workTools.search(snapshot.data,filters,snapshot.user));return;
      }
      if(route==='/message-source'&&req.method==='POST'){
        const p=await body(req),m=db.prepare('SELECT * FROM messages WHERE id=?').get(str(p.id,100));
        if(!m)fail(404,'원본 대화를 찾을 수 없습니다.');
        member(user,m.room_id);
        const room=db.prepare('SELECT name FROM rooms WHERE id=?').get(m.room_id);
        send(res,200,{room:m.room_id,roomName:room.name,message:{...parse(m.payload),id:m.id,sender:m.sender===user.id?'me':m.sender}});return;
      }
      if(route==='/events'&&req.method==='GET'){
        res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive','x-content-type-options':'nosniff'});res.dingdongToken=user.tokenHash;
        const connections=streams.get(user.id)||new Set();connections.add(res);streams.set(user.id,connections);res.write('event: ready\ndata: {}\n\n');notify(null,'presence');
        const heartbeat=setInterval(()=>{if(user.expires<=Date.now()){res.end();return;}res.write(': heartbeat\n\n');},20000);
        req.on('close',()=>{clearInterval(heartbeat);connections.delete(res);if(!connections.size)streams.delete(user.id);notify(null,'presence');});return;
      }
      if(route==='/attachment'&&req.method==='POST'){
        const p=await body(req),mail=db.prepare('SELECT * FROM mails WHERE id=?').get(str(p.mail,100));
        if(!mail)fail(404,'첨부 메시지를 찾을 수 없습니다.');
        const recipient=db.prepare("SELECT status FROM recipients WHERE mail_id=? AND user_id=?").get(p.mail,user.id);
        if(mail.sender!==user.id&&(!recipient||['recalled','scheduled'].includes(recipient.status)))fail(403,'이 첨부 파일에 접근할 수 없습니다.');
        if(p.inline===true){send(res,200,{html:parse(mail.payload).html||''});return;}
        if(!Number.isInteger(p.index)||p.index<0)fail(400,'첨부 파일 번호가 올바르지 않습니다.');
        const file=privacy.attachment(mail,p.index);send(res,200,{file});return;
      }
      if(route==='/sync'&&req.method==='POST'){
        const payload=await body(req);if(!Array.isArray(payload.operations)||payload.operations.length>300)fail(400,'변경 요청은 300개까지 가능합니다.');
        if(relay&&payload.operations.some(o=>/^(mail\.|message\.|room\.|homeroom\.|item\.|deadline\.)/.test(o.type)||o.type==='event.upsert'&&(o.value?.noticeMail||o.value?.deliveryMail||o.value?.source||o.value?.type==='personal')))fail(409,'PC 보관 방식으로 업데이트한 띵동 앱에서 이용해 주세요.');
        const operations=await privacy.prepare(user,payload.operations);
        db.exec('BEGIN IMMEDIATE');try{for(const op of operations)operation(user,op);reconcileExchanges();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
        if(operations.some(op=>(op.type==='mail.send'&&op.value?.scheduled)||(op.type==='mail.update'&&op.recall)))dispatch.refresh();
        notify();send(res,200,{ok:true});return;
      }
      if(route==='/admin/staff-import'&&req.method==='POST'){
        if(!user.admin)fail(403,'관리자만 교직원 엑셀을 등록할 수 있습니다.');
        const input=await body(req);
        const snapshot=()=>({people:db.prepare('SELECT * FROM users ORDER BY id').all().map(u=>{const {status,...person}=userPublic(u);return person;}),classTeachers:parse(db.prepare("SELECT value FROM metadata WHERE key='classTeachers'").get()?.value||'[]'),dutySettings:dutySettings()});
        const before=snapshot(),revision=hash(json(before)),plan=directory.plan(input.rows,before.people,before,input.identities);
        if(input.preview){send(res,200,{...plan,revision});return;}
        if(input.revision!==revision)fail(409,'교직원 정보가 변경되었습니다. 파일을 다시 선택해 확인해 주세요.');
        if(plan.errors.length)fail(400,plan.errors.slice(0,10).join('\n'));
        const fresh=plan.entries.filter(e=>e.isNew);if(fresh.length>200)fail(400,'신규 교직원은 한 번에 200명까지 추가할 수 있습니다. 파일을 나누어 주세요.');
        const accounts=[],records=new Map(),idMap={};
        // Bound password hashing concurrency and keep plaintext credentials out of storage.
        for(let offset=0;offset<fresh.length;offset+=2)await Promise.all(fresh.slice(offset,offset+2).map(async entry=>{const password=crypto.randomBytes(6).toString('base64url'),username='staff-'+crypto.randomBytes(8).toString('hex'),userId=id('staff'),record=await passwordRecord(password);idMap[entry.id]=userId;records.set(userId,{...record,username});accounts.push({name:entry.name,username,password});}));
        if(hash(json(snapshot()))!==revision)fail(409,'교직원 정보가 변경되었습니다. 파일을 다시 선택해 확인해 주세요.');
        const resolved=directory.resolve(plan,idMap);
        db.exec('BEGIN IMMEDIATE');try{
          for(const entry of resolved.entries){const record=records.get(entry.id);
            if(record)db.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt,admin,disabled,must_change,grade,other_group,class_number,work,special_room,club,position) VALUES(?,?,?,?,?,?,?,?,?,0,0,1,?,?,?,?,?,?,?)').run(entry.id,record.username,entry.name,entry.department,entry.role,'',entry.extension,record.digest,record.salt,entry.grade,'',entry.classNumber,entry.work,entry.specialRoom,entry.club,entry.position);
            else db.prepare('UPDATE users SET name=?,grade=?,class_number=?,extension=?,department=?,work=?,special_room=?,club=?,position=? WHERE id=?').run(entry.name,entry.grade,entry.classNumber,entry.extension,entry.department,entry.work,entry.specialRoom,entry.club,entry.position,entry.id);
          }
          for(const [key,value] of Object.entries({classTeachers:resolved.classTeachers,dutySettings:resolved.dutySettings}))db.prepare('INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,json(value));
          for(const row of db.prepare('SELECT * FROM events').all()){const event=parse(row.payload);if(!event.duty)continue;event.targets=[...new Set([...resolved.dutySettings.managers[event.duty.kind],...event.duty.assigned,row.owner])];db.prepare('UPDATE events SET payload=? WHERE id=?').run(json(event),row.id);}
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        notify();send(res,200,{ok:true,updated:resolved.entries.length,accounts});return;
      }
      if(route==='/admin/users'&&user.admin){
        if(req.method==='GET'){send(res,200,{users:db.prepare('SELECT * FROM users ORDER BY department,name').all().map(userPublic)});return;}
        if(req.method==='POST'){const p=await body(req),record=await passwordRecord(p.password);const userId=id('staff');db.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt,admin,disabled,must_change,grade,other_group) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(userId,str(p.username,40),str(p.name,40),str(p.department,60),str(p.role||'교사',30),str(p.subject||'',30,false),str(p.extension||'',20,false),record.digest,record.salt,0,0,1,str(p.grade||'',30,false),str(p.otherGroup||'',60,false));notify();send(res,201,{id:userId});return;}
      }
      if(route==='/admin/user'&&req.method==='POST'&&user.admin){
        const p=await body(req);const target=db.prepare('SELECT * FROM users WHERE id=?').get(str(p.id,100));if(!target)fail(404,'계정을 찾을 수 없습니다.');if(target.admin)fail(403,'관리자 계정은 여기서 변경할 수 없습니다.');
        if(Object.hasOwn(p,'grade')||Object.hasOwn(p,'otherGroup')){const target=db.prepare('SELECT * FROM users WHERE id=?').get(p.id);db.prepare('UPDATE users SET grade=?,other_group=? WHERE id=?').run(Object.hasOwn(p,'grade')?str(p.grade,30,false):target.grade,Object.hasOwn(p,'otherGroup')?str(p.otherGroup,60,false):target.other_group,p.id);}
        if(typeof p.disabled==='boolean'){db.prepare('UPDATE users SET disabled=? WHERE id=?').run(p.disabled?1:0,p.id);if(p.disabled){db.prepare('DELETE FROM sessions WHERE user_id=?').run(p.id);for(const stream of streams.get(p.id)||[])stream.end();}}
        if(p.password){const record=await passwordRecord(p.password);db.prepare('UPDATE users SET digest=?,salt=?,must_change=1 WHERE id=?').run(record.digest,record.salt,p.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(p.id);for(const stream of streams.get(p.id)||[])stream.end();}notify();send(res,200,{ok:true});return;
      }
      fail(404,'요청한 기능을 찾을 수 없습니다.');
    }catch(error){
      if(diskFull(error)&&/^\/relay\/(?:upload|blob\/(?:start|chunk|finish))(?:\?|$)/.test(req.url))error=Object.assign(new Error(lowSpace),{status:507});
      if(!res.headersSent)send(res,error.status|| (String(error.message).includes('UNIQUE constraint')?409:500),{...(error.code==='RELAY_SEQUENCE_UNCONFIRMED'?{code:error.code}:{}),error:error.status?error.message:String(error.message).includes('UNIQUE constraint')?'이미 사용 중인 아이디입니다.':'서버에서 요청을 처리하지 못했습니다.'});else res.end();if(!error.status)options.onError?.(error);
    }
  });
  server.requestTimeout=20000;server.headersTimeout=10000;
  async function maintain(){
    recovery?.cleanup();
    privacy.cleanup();privacy.checkpoint();
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    for(const [key,value] of loginAttempts)if(value.until<=Date.now())loginAttempts.delete(key);
    if(relay){await relay.cleanup();relay.checkpoint();}
  }
  let maintaining=null;
  const maintenance=timers.setInterval(()=>{
    maintaining??=maintain().catch(error=>options.onError?.(error)).finally(()=>{maintaining=null;});
    return maintaining;
  },60000);
  function stopTimers(){dispatch.close();timers.clearInterval(maintenance);}
  dispatch.refresh();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,options.host||'0.0.0.0',resolve);}).catch(async error=>{stopTimers();await maintaining;db.close();throw error;});
  const boundPort=server.address().port;
  const connection={version:1,schoolName:db.prepare("SELECT value FROM metadata WHERE key='schoolName'").get()?.value,url:new URL(address).origin.replace(/:0$/,':'+boundPort),certificate:tls.cert,fingerprint:tls.fingerprint};
  // A port selected by the OS must be reflected in the exported connection file.
  if(port===0)connection.url=`https://${addressURL.hostname}:${boundPort}`;
  fs.writeFileSync(path.join(dataDir,'dingdong-server.json'),json(connection),{mode:0o600});
  return {port:boundPort,connection,dataDir,stats:()=>({attachmentSpace:relay?.blobs.space(),users:db.prepare('SELECT count(*) n FROM users WHERE disabled=0').get().n,online:streams.size,rooms:db.prepare('SELECT count(*) n FROM rooms').get().n,messages:db.prepare('SELECT count(*) n FROM private_content').get().n+(relay?db.prepare('SELECT count(*) n FROM relay_packets').get().n:0)}),backup(destination){db.exec('PRAGMA wal_checkpoint(TRUNCATE)');fs.copyFileSync(databasePath,destination);const backup=new DatabaseSync(destination);try{if(relay){backup.exec('PRAGMA secure_delete=ON; DELETE FROM relay_send_proofs; DELETE FROM relay_blobs; DELETE FROM relay_positions; DELETE FROM relay_targets; DELETE FROM relay_packets; DELETE FROM relay_files; DELETE FROM relay_legacy_files; DELETE FROM relay_migrated; DELETE FROM recipients; DELETE FROM mail_work_responses; DELETE FROM homeroom_days; DELETE FROM mails; DELETE FROM reactions; DELETE FROM messages; DELETE FROM room_members; DELETE FROM rooms; DELETE FROM private_deliveries; DELETE FROM auto_deadline_sources;');}backup.exec("PRAGMA secure_delete=ON; DELETE FROM sessions; DELETE FROM private_content; DELETE FROM retained_files; DELETE FROM items; UPDATE mail_work_responses SET note='';");for(const e of backup.prepare('SELECT id,payload FROM events').all()){const value=parse(e.payload);if(value.source||value.type==='personal'||relay&&(value.noticeMail||value.deliveryMail||db.prepare('SELECT payload FROM mails').all().some(m=>parse(m.payload).calendarEvent===e.id)))backup.prepare('DELETE FROM events WHERE id=?').run(e.id);else if(value.noticeMail||value.deliveryMail){value.note='';backup.prepare('UPDATE events SET payload=? WHERE id=?').run(json(value),e.id);}}for(const table of ['mails','messages'])for(const row of backup.prepare('SELECT id,payload FROM '+table).all()){const p=parse(row.payload);for(const k of ['title','body','html','text','reply'])delete p[k];backup.prepare('UPDATE '+table+' SET payload=? WHERE id=?').run(json(p),row.id);}backup.exec('VACUUM;');}finally{backup.close();}},async close(){stopTimers();await maintaining;for(const connections of streams.values())for(const res of connections)res.end();await new Promise(resolve=>server.close(resolve));db.close();}};
}
module.exports={startServer,passwordRecord};


