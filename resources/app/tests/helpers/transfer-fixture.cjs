'use strict';
// Isolated regression fixtures; no real school accounts or message history.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const appDir=path.resolve(__dirname,'../..');
const {startServer}=require(path.join(appDir,'server/index.cjs')),{PrivateClient}=require(path.join(appDir,'desktop/private-client.cjs')),crypto=require(path.join(appDir,'privacy/crypto.cjs'));
const {test}=require('node:test');
async function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-development-audit-')),clients=[],tokens={},users={};let server;let testNow=Date.now(); const options={port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(root,'server'),now:()=>testNow,admin:{username:'audit',password:'Synthetic-audit-password-123'}};
  try{
    server=await startServer(options);
    const call=(name,route,payload)=>new Promise((resolve,reject)=>{const body=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:body?'POST':'GET',ca:server.connection.certificate,headers:{...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),...(tokens[name]?{authorization:'Bearer '+tokens[name]}:{})}},res=>{let data='';res.on('data',s=>data+=s);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(data)}));});req.on('error',reject);if(body)req.write(body);req.end();});
    const login=await call(null,'/login',{username:'audit',password:'Synthetic-audit-password-123'});tokens.a=login.token;users.a=login.user;
    const sql=(q,values=[],write=false)=>{const db=new DatabaseSync(path.join(root,'server/dingdong.sqlite'));try{return write?db.prepare(q).run(...values):db.prepare(q).all(...values);}finally{db.close();}};
    const base=sql('SELECT * FROM users WHERE id=?',[users.a.id])[0];for(const name of ['b','c']){users[name]={id:'audit-'+name,name,username:name};tokens[name]=randomBytes(32).toString('hex');sql('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt) VALUES(?,?,?,?,?,?,?,?,?)',[users[name].id,name,name,'시험','교사','','',base.digest,base.salt],true);sql('INSERT INTO sessions VALUES(?,?,?)',[crypto.digest(tokens[name]),users[name].id,Date.now()+86400000],true);}
    const make=name=>{const c=new PrivateClient({root:path.join(root,name),server:server.connection.fingerprint,user:users[name],request:(r,p)=>call(name,r,p),protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});clients.push(c);return c;};
    const a=make('a'),b=make('b'),c=make('c');await Promise.all(clients.map(c=>c.initialize()));for(const cl of clients)await cl.request('/bootstrap');
    const send=(cl,id,to)=>cl.request('/sync',{operations:[{type:'mail.send',value:{id,title:'합성 시험 '+id,body:'개발 점검용 합성 본문 '+id,html:'',to,cc:[],files:[]}}]});
    return await fn({a,b,c,send,users,sql,call,make,root,clients,tokens,connection:()=>server.connection,port:()=>server.port,restart:async()=>{await server.close();server=await startServer(options);},clock:()=>testNow,advance:ms=>{testNow+=ms},backup:destination=>server.backup(destination)});
  }finally{for(const c of clients)if(c.store.db)c.close();if(server)await server.close();const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('dingdong-development-audit-'));fs.rmSync(absolute,{recursive:true,force:true});}
}
module.exports=fixture;

