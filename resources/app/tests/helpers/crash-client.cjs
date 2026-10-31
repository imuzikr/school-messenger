'use strict';
// Child-process fixture only. Pauses at a durable boundary for parent termination.
const https=require('node:https'),{PrivateClient}=require('../../desktop/private-client.cjs');
process.once('message',async config=>{
  const raw=(route,payload)=>new Promise((resolve,reject)=>{const body=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:config.port,path:route,method:body?'POST':'GET',ca:config.connection.certificate,headers:{authorization:'Bearer '+config.token,...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{})}},res=>{let data='';res.on('data',s=>data+=s);res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(data)}));});req.on('error',reject);if(body)req.write(body);req.end();});
  const request=async(route,payload)=>{
    if(config.mode==='receive'&&route==='/relay/ack'){process.send({checkpoint:'pc-saved-before-ack'});return new Promise(()=>{});}
    const result=await raw(route,payload);
    if(config.mode==='send'&&route==='/relay/send'&&!result.error){process.send({checkpoint:'server-accepted-before-client-commit'});return new Promise(()=>{});}
    return result;
  };
  try{const c=new PrivateClient({root:config.root,server:config.connection.fingerprint,user:config.user,request,protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});await c.request(config.mode==='send'?'/sync':'/bootstrap',config.operation?{operations:[config.operation]}:undefined);throw Error('Did not reach the requested crash boundary');}catch(e){process.send({error:e.message});process.exitCode=1;}
});
