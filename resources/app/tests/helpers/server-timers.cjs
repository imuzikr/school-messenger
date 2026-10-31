'use strict';
// Only server housekeeping and dispatch use this clock. HTTPS and SSE stay live.
function serverTimers(now){
  const jobs=new Set();
  function add(fn,delay,interval){
    const job={fn,at:now()+delay,interval};
    jobs.add(job);
    return job;
  }
  return {
    setTimeout:(fn,delay)=>add(fn,delay,0),
    setInterval:(fn,delay)=>add(fn,delay,delay),
    clearTimeout:job=>jobs.delete(job),
    clearInterval:job=>jobs.delete(job),
    async runDue(){
      for(const job of [...jobs].sort((a,b)=>a.at-b.at)){
        if(!jobs.has(job)||job.at>now())continue;
        if(job.interval)job.at=now()+job.interval;
        else jobs.delete(job);
        await job.fn();
      }
    }
  };
}
module.exports=serverTimers;
