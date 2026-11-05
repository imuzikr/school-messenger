'use strict';
// Keeps one live /events (server-sent events) connection for the logged-in user.
// - 401 means the login expired: report it once and do not reconnect.
// - Any other status, a network error, or the stream ending is retried.
// - A connection that stays silent past the server heartbeat (20 s) is treated as lost.
const https=require('node:https');
const RETRY_MS=3000,SLOW_RETRY_MS=30000,IDLE_MS=60000,MAX_PENDING=100000;
// Client errors other than these will not fix themselves quickly; retry them slowly.
const quickRetry=status=>!(status>=400&&status<500)||[408,425,429].includes(status);
function createEventStream({emit,current,expired,request=https.get,timers=globalThis,retryMs=RETRY_MS,slowRetryMs=SLOW_RETRY_MS,idleMs=IDLE_MS}){
  let req=null,reconnect=null,idle=null,generation=0;
  function clearIdle(){if(idle){timers.clearTimeout(idle);idle=null;}}
  function drop(){if(req){const old=req;req=null;old.destroy();}}
  function stop(){generation++;if(reconnect){timers.clearTimeout(reconnect);reconnect=null;}clearIdle();drop();}
  function start(){
    stop();
    const {token,connection}=current();if(!token||!connection)return;
    const mine=generation;let finished=false;
    // Every path that ends this connection goes through finish(), at most once.
    const finish=(delay=retryMs)=>{
      if(mine!==generation||finished)return;
      finished=true;clearIdle();drop();
      if(current().token!==token)return;
      emit({kind:'disconnected'});
      if(!reconnect)reconnect=timers.setTimeout(()=>{reconnect=null;start();},delay);
    };
    const watch=()=>{clearIdle();idle=timers.setTimeout(()=>finish(),idleMs);};
    const created=request(new URL('/events',connection.url),{ca:connection.certificate,headers:{authorization:'Bearer '+token},minVersion:'TLSv1.2'},res=>{
      if(mine!==generation||finished){res.resume();return;}
      res.on('error',()=>finish());
      if(res.statusCode===401){
        finished=true;clearIdle();res.resume();req=null;
        if(current().token===token)expired();
        return;
      }
      if(res.statusCode!==200){res.resume();finish(quickRetry(res.statusCode)?retryMs:slowRetryMs);return;}
      emit({kind:'connected'});watch();
      let pending='';res.setEncoding('utf8');
      res.on('data',chunk=>{
        if(mine!==generation||finished)return;
        watch();pending+=chunk;let at;
        while((at=pending.indexOf('\n\n'))>=0){
          const frame=pending.slice(0,at);pending=pending.slice(at+2);
          const data=frame.split('\n').find(line=>line.startsWith('data: '));
          if(data){try{emit(JSON.parse(data.slice(6)));}catch{}}
        }
        // A single frame this large is not a valid event; drop it and resynchronise.
        if(pending.length>MAX_PENDING)pending='';
      });
      res.on('end',()=>finish());res.on('close',()=>finish());
    });
    req=created;
    created.on('error',()=>finish());
    // Also covers a server that accepts the connection but never answers.
    watch();
  }
  return {start,stop};
}
module.exports={createEventStream};
