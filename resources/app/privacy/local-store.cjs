'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {digest}=require('./crypto.cjs');
// A separate durable database for each server certificate + account. The caller
// supplies Windows safeStorage; tests supply an explicitly test-only protector.
class LocalStore{
  constructor(root,server,user,protector){
    this.scope=digest([server,user]);this.protector=protector;
    fs.mkdirSync(root,{recursive:true,mode:0o700});this.path=path.join(root,this.scope+'.sqlite');
    this.db=new DatabaseSync(this.path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,value BLOB NOT NULL,PRIMARY KEY(kind,id));');
  }
  put(kind,id,value){const encrypted=this.protector.encrypt(JSON.stringify(value));this.db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value').run(kind,id,encrypted);}
  get(kind,id){const r=this.db.prepare('SELECT value FROM records WHERE kind=? AND id=?').get(kind,id);return r?JSON.parse(this.protector.decrypt(Buffer.from(r.value))):null;}
  all(kind){return this.db.prepare('SELECT id,value FROM records WHERE kind=? ORDER BY rowid').all(kind).map(r=>({id:r.id,value:JSON.parse(this.protector.decrypt(Buffer.from(r.value)))}));}
  remove(kind,id){this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,id);}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  async transactionAsync(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=await fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  export(){return this.db.prepare('SELECT kind,id,value FROM records').all().map(r=>({kind:r.kind,id:r.id,value:JSON.parse(this.protector.decrypt(Buffer.from(r.value)))}));}
  import(rows){if(!Array.isArray(rows)||rows.some(r=>typeof r.kind!=='string'||typeof r.id!=='string'||!Object.hasOwn(r,'value')))throw new Error('PC 보관 파일 형식이 올바르지 않습니다.');this.transaction(()=>{for(const r of rows)this.put(r.kind,r.id,r.value);});}
  close(){if(this.db){this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.db.close();this.db=null;}}
}
module.exports={LocalStore};
