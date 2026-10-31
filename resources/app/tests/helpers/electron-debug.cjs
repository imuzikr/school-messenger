'use strict';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,description,timeout=180000) {
  const limit=Date.now()+timeout;
  do { const value=await fn();if(value)return value;await pause(30); }while(Date.now()<limit);
  throw Error('Timed out: '+description);
}
async function debuggerSession(url,sockets){
  const socket=new WebSocket(url);sockets.push(socket);
  await new Promise((ok,fail)=>{socket.onopen=ok;socket.onerror=fail;});
  const pending=new Map();let id=0;
  socket.onmessage=event=>{
    const result=JSON.parse(event.data),job=pending.get(result.id);
    if(!job)return;pending.delete(result.id);
    if(result.error||result.result?.exceptionDetails)job.reject(Error(JSON.stringify(result.error||result.result.exceptionDetails)));
    else job.resolve(result.result.result.value);
  };
  socket.onclose=()=>{for(const job of pending.values())job.reject(Error('debugger closed'));pending.clear();};
  return expression=>new Promise((resolve,reject)=>{
    pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
  });
}
module.exports={pause,until,debuggerSession};
