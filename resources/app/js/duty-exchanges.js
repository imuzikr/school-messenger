/* Shared exchange state machine. Callers persist both assignments and the request atomically. */
(function(root){
  'use strict';
  const duties=typeof module==='object'&&module.exports?require('./duties.js'):root.DingdongDuties;
  const teachers=typeof module==='object'&&module.exports?require('./announcements.js'):root.DingdongAnnouncements;
  const labels={pending:'상대 교사 확인 중',approval:'수락 재확인 필요',approved:'교환 완료',declined:'상대 교사 거절',rejected:'담당자 반려',cancelled:'요청 취소',invalidated:'배정 변경으로 종료',expired:'일정 경과로 종료'};
  const active=r=>['pending','approval'].includes(r.status);
  function fail(message,status=400){const e=Error(message);e.status=status;throw e;}
  const manager=(actor,kind,ctx)=>!!actor.admin||!!ctx.config.managers[kind]?.includes(actor.id);
  const snapshot=e=>({id:e.id,kind:e.duty.kind,date:e.date,start:e.start,end:e.end,assigned:[...e.duty.assigned]});
  const current=(s,e)=>e&&e.duty&&e.duty.kind===s.kind&&e.date===s.date&&e.start===s.start&&e.end===s.end&&duties.sameAssignment(e.duty.assigned,s.assigned);
  const person=(id,ctx)=>ctx.people.find(p=>p.id===id&&!p.disabled&&teachers.isTeacher(p));
  function pair(from,to,requester,partner,ctx){
    if(!from?.duty||!to?.duty||from.id===to.id||from.date===to.date||from.duty.kind!==to.duty.kind)fail('같은 종류의 업무 중 서로 다른 날짜를 선택해 주세요.');
    const kind=from.duty.kind;if(!duties.types[kind]||!ctx.config.managers[kind]?.length)fail('이 업무의 담당자가 등록되어 있지 않습니다.');
    if(!person(requester,ctx)||!person(partner,ctx)||requester===partner)fail('교환할 교사를 확인해 주세요.');
    if(!from.duty.assigned.includes(requester)||!to.duty.assigned.includes(partner))fail('본인과 상대 교사의 실제 배정 일정을 선택해 주세요.');
    if(from.duty.assigned.includes(partner)||to.duty.assigned.includes(requester))fail('두 교사 중 한 명이 이미 상대 날짜에 배정되어 있습니다.');
    if(kind==='safety'){
      const group=id=>String(person(id,ctx).department).replace(/\s/g,'')===String(ctx.config.safetyDepartment).replace(/\s/g,'');
      if(group(requester)!==group(partner))fail('안전 지도는 같은 담당 구분의 교사끼리 교환해 주세요.');
    }
    if(from.date<ctx.today||to.date<ctx.today)fail('지난 날짜의 업무는 교환할 수 없습니다.',409);
    return kind;
  }
  function text(v){if(typeof v!=='string'||v.length>500)fail('사유는 500자 이내로 입력해 주세요.');return v.trim();}
  function history(r,status,actor,note,ctx){return {...r,status,updatedAt:ctx.now,history:[...(r.history||[]),{status,actor:actor.id,actorName:actor.id==='system'?'자동 확인':ctx.people.find(p=>p.id===actor.id)?.name||actor.id,at:ctx.now,note}]};}
  const remainingMonth=(date,today)=>typeof date==='string'&&date>=today&&date.slice(0,7)===today.slice(0,7);
  function create(value,actor,ctx){
    if(typeof value.id!=='string'||!/^[-\w]{1,100}$/.test(value.id))fail('요청 번호가 올바르지 않습니다.');
    if(ctx.requests.some(r=>r.id===value.id))fail('이미 등록된 요청입니다.',409);
    const from=ctx.events.find(e=>e.id===value.fromEvent),to=ctx.events.find(e=>e.id===value.toEvent);
    const kind=pair(from,to,actor.id,value.partner,ctx);
    if(!remainingMonth(to.date,ctx.today))fail('교환 대상은 오늘부터 이번 달 말일까지의 배정에서 선택해 주세요.',409);
    if(ctx.requests.some(r=>active(r)&&[r.from.id,r.to.id].some(id=>id===from.id||id===to.id)))fail('이 일정에는 진행 중인 교환 요청이 있습니다. 먼저 완료하거나 취소해 주세요.',409);
    return history({id:value.id,kind,requester:actor.id,requesterName:person(actor.id,ctx).name,partner:value.partner,partnerName:person(value.partner,ctx).name,reason:text(value.reason||''),from:snapshot(from),to:snapshot(to),observers:[...new Set([from.owner,to.owner].filter(Boolean))],createdAt:ctx.now,history:[]},'pending',actor,'교환 요청',ctx);
  }
  function conflict(id,event,ctx,excluded){return ctx.events.some(e=>!excluded.includes(e.id)&&e.date===event.date&&e.start<event.end&&e.end>event.start&&(e.duty?e.duty.assigned.includes(id):e.owner===id||e.targets?.includes(id)));}
  function act(request,action,note,actor,ctx){
    if(!request)fail('교환 요청을 찾을 수 없습니다.',404);
    if(!active(request))fail('이미 종료된 요청입니다. 목록을 새로 확인해 주세요.',409);
    note=text(note||'');let status,events=[];
    if(action==='cancel'){
      if(actor.id!==request.requester)fail('요청한 교사만 취소할 수 있습니다.',403);status='cancelled';
    }else if(action==='accept'||action==='decline'){
      if(actor.id!==request.partner)fail('요청을 받은 교사만 응답할 수 있습니다.',403);
      // Legacy approval requests have not changed either assignment: the recipient can reconfirm.
      if(!['pending','approval'].includes(request.status))fail('이미 응답한 요청입니다.',409);
      status=action==='accept'?'approved':'declined';
    }else fail('상대 교사의 수락 또는 거절로 처리해 주세요.');
    if(status==='approved'){
      const from=ctx.events.find(e=>e.id===request.from.id),to=ctx.events.find(e=>e.id===request.to.id);
      if(!current(request.from,from)||!current(request.to,to))fail('배정이나 시간이 변경되었습니다. 새로 요청해 주세요.',409);
      pair(from,to,request.requester,request.partner,ctx);
      const excluded=[from.id,to.id];
      if(conflict(request.requester,to,ctx,excluded)||conflict(request.partner,from,ctx,excluded))fail('교환 후 시간에 다른 일정이 겹칩니다. 일정을 조정한 후 다시 수락해 주세요.',409);
      events=[duties.reassign(from,from.duty.assigned.map(id=>id===request.requester?request.partner:id),ctx.config,ctx.people),duties.reassign(to,to.duty.assigned.map(id=>id===request.partner?request.requester:id),ctx.config,ctx.people)];
    }
    return {request:history(request,status,actor,note,ctx),events};
  }
  function reconcile(requests,ctx){return requests.map(r=>{
    if(!active(r))return r;
    let status;
    if(r.from.date<ctx.today||r.to.date<ctx.today)status='expired';
    else if(!current(r.from,ctx.events.find(e=>e.id===r.from.id))||!current(r.to,ctx.events.find(e=>e.id===r.to.id)))status='invalidated';
    else {try{pair(ctx.events.find(e=>e.id===r.from.id),ctx.events.find(e=>e.id===r.to.id),r.requester,r.partner,ctx);}catch{status='invalidated';}}
    return status?history(r,status,{id:'system'},status==='expired'?'업무 날짜가 지났습니다.':'배정·시간 또는 담당자 정보가 변경되었습니다.',ctx):r;
  });}
  const visible=(r,actor,ctx)=>r.requester===actor.id||r.partner===actor.id||(r.observers||[]).includes(actor.id)||[r.from.id,r.to.id].some(id=>ctx.events.find(e=>e.id===id)?.owner===actor.id)||manager(actor,r.kind,ctx);
  const version=r=>r.status+':'+r.history.length;
  function notification(r,actor){
    const kind=duties.types[r.kind].label,status=r.status==='pending'&&actor?.id===r.partner?'교환 요청 도착':labels[r.status];
    const update=r.status==='pending'&&actor?.id===r.partner?`${r.requesterName} 선생님의 요청을 수락하거나 거절해 주세요.`:r.status==='approved'?`${r.partnerName} 선생님이 수락하여 요청자·수락자·업무 담당자의 캘린더에 반영되었습니다.`:r.status==='approval'?'이전 버전의 요청입니다. 상대 교사가 수락을 다시 확인하면 교환이 완료됩니다.':'';
    return {title:kind+' · '+status,body:`${r.requesterName} ↔ ${r.partnerName} · ${r.from.date} ↔ ${r.to.date} ${update}`};
  }
  const api={labels,active,manager,snapshot,current,pair,create,act,reconcile,visible,version,notification,remainingMonth};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongDutyExchanges=api;
})(typeof window==='object'?window:globalThis);
