'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const brand=require('../desktop/branding.cjs'),{migrate}=require('../js/brand-storage.js');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-brand-test-'));
test('server startup readback matches the enabled Windows entry for the registered executable and arguments',()=>{
 const exe='C:\\School Tools\\Dingdong.exe',target={path:exe,args:['--dingdong-server']};
 const app={getLoginItemSettings(options){assert.deepEqual(options,target);return {openAtLogin:true,launchItems:items};}};
 const items=[{...target,args:['--dingdong-client'],enabled:true},{...target,path:'D:\\Dingdong.exe',enabled:true},{...target,enabled:false}];
 assert.deepEqual(brand.loginSettings(true,'server',exe),{openAtLogin:true,...target});
 assert.equal(brand.loginEnabled(app,'server',exe),false);
 items.push({...target,path:exe.toLowerCase(),enabled:true});assert.equal(brand.loginEnabled(app,'server',exe),true);
 assert.equal(brand.loginEnabled({getLoginItemSettings:()=>({openAtLogin:false,launchItems:items})},'server',exe),false);
});
function cleanup(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('dingdong-brand-test-'));fs.rmSync(root,{recursive:true,force:true});}
test('new names preserve existing client profiles, database paths and legacy launch arguments',()=>{
 const root=temp();try{
  assert.equal(brand.profileDirectory(root,'client'),path.join(root,'DingdongClient'));
  fs.mkdirSync(path.join(root,'IeumClient'));assert.equal(brand.profileDirectory(root,'client'),path.join(root,'IeumClient'));
  assert.equal(brand.databaseFile(root),path.join(root,'dingdong.sqlite'));fs.writeFileSync(path.join(root,'ieum.sqlite'),'fixture');assert.equal(brand.databaseFile(root),path.join(root,'ieum.sqlite'));
  for(const role of ['demo','client','server']){assert.equal(brand.roleFor(['--dingdong-'+role],{dingdongRole:'demo'}),role);assert.equal(brand.roleFor(['--ieum-'+role],{dingdongRole:'demo'}),role);assert.deepEqual(brand.loginSettings(true,role,'Dingdong.exe'),{openAtLogin:true,path:'Dingdong.exe',args:['--dingdong-'+role]});}
 }finally{cleanup(root);}
});
test('browser key migration preserves demo messages, notes and newer preferences and runs once',()=>{
 const map=new Map([['ieum-v1','original messages'],['ieum-sticky-v1:account:123','notes'],['ieum-preferences','old'],['dingdong-preferences','current']]);
 const storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 migrate(storage);assert.equal(map.get('dingdong-v1'),'original messages');assert.equal(map.get('dingdong-sticky-v1:account:123'),'notes');assert.equal(map.get('dingdong-preferences'),'current');assert.equal(map.get('ieum-v1'),'original messages');
 map.delete('dingdong-v1');migrate(storage);assert.equal(map.has('dingdong-v1'),false);
});
test('new archive name still opens archives exported by the previous app',async()=>{
 const archive=require('../privacy/archive.cjs'),jose=await import('jose'),enc=new TextEncoder(),password='Synthetic-backup-password-123',record={version:1,user:'fixture',records:[]};
 const old=await new jose.CompactEncrypt(enc.encode(JSON.stringify(record))).setProtectedHeader({alg:'PBES2-HS512+A256KW',enc:'A256GCM',p2c:210000,typ:'ieum-pc-archive-v1'}).encrypt(enc.encode(password));
 assert.deepEqual(await archive.open(old,password),record);const current=await archive.seal(record,password);assert.equal(jose.decodeProtectedHeader(current).typ,'dingdong-pc-archive-v1');assert.deepEqual(await archive.open(current,password),record);
});
test('existing server database and certificate survive the product rename',async()=>{
 const {startServer}=require('../server/index.cjs'),root=temp();let server;
 try{
  server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:root,admin:{username:'fixture',password:'Synthetic-password-123'}});
  const fingerprint=server.connection.fingerprint;assert.equal(server.stats().users,1);await server.close();server=null;
  fs.renameSync(path.join(root,'dingdong.sqlite'),path.join(root,'ieum.sqlite'));
  server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:root});
  assert.equal(server.connection.fingerprint,fingerprint);assert.equal(server.stats().users,1);assert.equal(fs.existsSync(path.join(root,'dingdong.sqlite')),false);
  server.backup(path.join(root,'account-backup.sqlite'));assert.ok(fs.statSync(path.join(root,'account-backup.sqlite')).size>0);
 }finally{if(server)await server.close();cleanup(root);}
});
test('simultaneous login and security initialization share one identity',async()=>{
 const {PrivateClient}=require('../desktop/private-client.cjs'),crypto=require('../privacy/crypto.cjs'),root=temp();let registered;const attempts=[];
 const client=new PrivateClient({root,server:'fixture',user:{id:'fixture'},protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()},request:async(route,payload)=>{
  if(route==='/privacy/register'){const fingerprint=await crypto.fingerprint(payload);attempts.push(fingerprint);if(registered&&await crypto.fingerprint(registered)!==fingerprint)return {error:'key already registered',status:409};registered=payload;return {ok:true};}
  return {keys:{fixture:registered}};
 }});
 try{const results=await Promise.allSettled([client.initialize(),client.initialize(),client.security()]);assert.ok(results.every(r=>r.status==='fulfilled'),JSON.stringify(results));assert.equal(new Set(attempts).size,1);assert.equal(await crypto.fingerprint(crypto.publicIdentity(client.identity)),await crypto.fingerprint(registered));}finally{client.close();cleanup(root);}
});
