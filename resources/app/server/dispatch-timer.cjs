'use strict';

// Queue changes are committed before refresh. Wall time can move during sleep.
function createDispatchTimer({now,nextDeadline,releaseDue,timers,onError}){
  let timer=null,deadline=null,closed=false;
  function arm(delay){
    timers.clearTimeout(timer);
    timer=timers.setTimeout(wake,Math.min(60000,Math.max(0,delay)));
  }
  function refresh(){
    if(closed)return;
    const next=nextDeadline();
    if(next===deadline&&timer!==null)return;
    deadline=next;
    if(next===null){timers.clearTimeout(timer);timer=null;}
    else arm(next-now());
  }
  function wake(){
    timer=null;
    if(closed)return;
    try{
      if(deadline!==null&&deadline>now()){arm(deadline-now());return;}
      releaseDue();
      refresh();
    }catch(error){
      onError?.(error);
      arm(1000);
    }
  }
  function close(){closed=true;timers.clearTimeout(timer);timer=null;}
  return {refresh,close};
}
module.exports={createDispatchTimer};
