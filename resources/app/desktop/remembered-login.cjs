'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

// Deliberately outside private-history so a PC migration never copies a login.
class RememberedLogin {
  constructor(profile,protector){
    this.file=path.join(profile,'remembered-login.bin');
    this.protector=protector;
  }
  save(fingerprint,token){
    const sealed=this.protector.encryptString(JSON.stringify({fingerprint,token}));
    const temporary=this.file+'.'+crypto.randomUUID()+'.tmp';
    try{
      fs.writeFileSync(temporary,sealed,{flag:'wx',mode:0o600,flush:true});
      fs.renameSync(temporary,this.file);
    }finally{fs.rmSync(temporary,{force:true});}
  }
  read(fingerprint){
    let sealed;
    try{sealed=fs.readFileSync(this.file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    try{
      const value=JSON.parse(this.protector.decryptString(sealed));
      if(value.fingerprint===fingerprint&&typeof value.token==='string'&&/^[a-f0-9]{64}$/.test(value.token))return value.token;
    }catch{/* A different Windows user or an unreadable file requires a new login. */}
    this.clear();return null;
  }
  clear(){fs.rmSync(this.file,{force:true});}
}
module.exports={RememberedLogin};
