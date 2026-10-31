/* Shared, authoritative duty assignment validation. */
(function(root){
  const teachers=typeof module==='object'&&module.exports?require('./announcements.js'):root.DingdongAnnouncements;
  const types={safety:{label:'안전 지도',tag:'안전 지도',start:'07:00',end:'08:00'},lunch:{label:'중식 지도',tag:'중식 지도',start:'12:00',end:'13:00'},study:{label:'자율학습 지도',tag:'자율학습',start:'18:00',end:'22:00'}};
  const managementTypes={timetable:{label:'일과표'},lessons:{label:'보강/시간표'},safety:types.safety,lunch:types.lunch,study:types.study};
  function departmentKinds(department){const d=String(department||'').replace(/\s+/g,'');if(/교무/.test(d))return ['timetable','lessons'];if(/생활안전|학생생활|생활교육|안전생활|학생안전/.test(d))return ['safety','lunch'];if(/학년/.test(d))return ['study'];return [];}
  const norm=v=>String(v??'').normalize('NFKC').replace(/\s+/g,'');
  function defaults(people=[]){return {safetyDepartment:people.find(p=>/생활안전부|학생생활부|생활교육부/.test(norm(p.department)))?.department||'생활안전부',managers:{safety:[],lunch:[],study:[],timetable:[],lessons:[]}};}
  function settings(value,people){
    if(!value||!value.managers||typeof value.safetyDepartment!=='string'||!people.some(p=>!p.disabled&&p.department===value.safetyDepartment))throw Error('안전 지도 소속 부서를 선택해 주세요.');
    const managers={};for(const kind of Object.keys(managementTypes)){const ids=value.managers[kind]??[];if(!Array.isArray(ids)||ids.length>200||ids.some(id=>!people.some(p=>!p.disabled&&p.id===id)))throw Error('업무 담당자를 확인해 주세요.');managers[kind]=[...new Set(ids)];}
    return {safetyDepartment:value.safetyDepartment,managers};
  }
  function date(value){
    if(value instanceof Date)value=value.toISOString().slice(0,10);
    if(typeof value==='number'){if(!Number.isFinite(value)||value<1||value>2958465||Math.floor(value)===60)throw Error('날짜가 올바르지 않습니다.');value=new Date(Date.UTC(1899,11,31)+(Math.floor(value)-(value>=60?1:0))*86400000).toISOString().slice(0,10);}
    const m=String(value??'').trim().match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?\.?\s*(?:\([월화수목금토일](?:요일)?\))?$/);
    if(!m)throw Error('날짜는 연도를 포함해 입력해 주세요.');const key=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    if(m[1]<'1900'||new Date(key+'T12:00:00Z').toISOString().slice(0,10)!==key)throw Error('존재하지 않는 날짜입니다.');return key;
  }
  function plan(kind,rows,config,people){
    if(!Object.hasOwn(types,kind))throw Error('업무 종류가 올바르지 않습니다.');if(!Array.isArray(rows)||!rows.length||rows.length>1001)throw Error('첫 시트에 최대 1,000행의 배정을 입력해 주세요.');
    config=settings(config,people);const managers=config.managers[kind];if(!managers.length)throw Error('설정에서 이 업무의 담당자를 먼저 등록해 주세요.');
    const eligible=people.filter(p=>!p.disabled&&teachers.isTeacher(p)),errors=[],groups=new Map(),width=kind==='safety'?3:2;
    rows.forEach((row,index)=>{try{
      if(!Array.isArray(row))throw Error('행 형식을 확인해 주세요.');if(row.every(v=>v==null||String(v).trim()===''))return;
      if(index===0&&['날짜','일자'].includes(norm(row[0])))return;
      if(row.slice(width).some(v=>v!=null&&String(v).trim()))throw Error(`${width===3?'A~C':'A~B'}열만 사용해 주세요.`);
      const day=date(row[0]),assigned=[],safety=[],general=[];
      for(let col=1;col<width;col++){
        const names=String(row[col]??'').split(/[,;\n\/·]+/).map(s=>s.trim()).filter(Boolean);
        if(!names.length)throw Error(`${String.fromCharCode(65+col)}열 교사 이름이 비어 있습니다.`);
        for(const name of names){if(name.length>100)throw Error('교사 이름이 너무 깁니다.');const matches=eligible.filter(p=>norm(p.name)===norm(name));if(matches.length!==1)throw Error(`${name}: ${matches.length?'동명이인이 있어 이름을 구분해야 합니다.':'등록된 교사를 찾을 수 없습니다.'}`);const p=matches[0];
          if(kind==='safety'&&((col===1)!==(norm(p.department)===norm(config.safetyDepartment))))throw Error(`${name}: ${col===1?config.safetyDepartment+' 소속 교사':'생활 안전 담당 부서 외 교사'}를 입력해 주세요.`);
          assigned.push(p.id);(col===1?safety:general).push(p.id);
        }
      }
      const old=groups.get(day)||{date:day,assigned:[],safety:[],general:[]};for(const [key,ids] of Object.entries({assigned,safety,general}))old[key]=[...new Set([...old[key],...ids])];groups.set(day,old);
    }catch(error){errors.push(`${index+1}행: ${error.message}`);}});
    const events=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(g=>({id:`duty-${kind}-${g.date}`,title:types[kind].label,date:g.date,start:types[kind].start,end:types[kind].end,type:'group',place:'',note:'배정 교사: '+g.assigned.map(id=>people.find(p=>p.id===id).name).join(', '),targets:[...new Set([...managers,...g.assigned])],duty:{kind,assigned:g.assigned,safety:g.safety,general:g.general},readonly:true,canReschedule:false}));
    if(!events.length&&!errors.length)errors.push('등록할 배정이 없습니다.');return {events,errors};
  }
  function sameAssignment(a,b){return Array.isArray(a)&&Array.isArray(b)&&JSON.stringify([...new Set(a)].sort())===JSON.stringify([...new Set(b)].sort());}
  function reassign(event,assigned,config,people){
    const kind=event?.duty?.kind;if(!Object.hasOwn(types,kind))throw Error('업무 일정을 찾을 수 없습니다.');
    config=settings(config,people);if(!config.managers[kind].length)throw Error('설정에서 업무 담당자를 먼저 등록해 주세요.');
    if(!Array.isArray(assigned)||!assigned.length||assigned.length>200||assigned.some(id=>typeof id!=='string'))throw Error('배정 교사를 한 명 이상 선택해 주세요.');
    assigned=[...new Set(assigned)];const selected=assigned.map(id=>people.find(p=>p.id===id&&!p.disabled&&teachers.isTeacher(p)));
    if(selected.some(p=>!p))throw Error('등록된 교사만 배정할 수 있습니다.');
    const safety=selected.filter(p=>norm(p.department)===norm(config.safetyDepartment)).map(p=>p.id),general=assigned.filter(id=>!safety.includes(id));
    if(kind==='safety'&&(!safety.length||!general.length))throw Error(config.safetyDepartment+' 교사와 그 외 교사를 각각 한 명 이상 선택해 주세요.');
    return {...event,title:types[kind].label,targets:[...new Set([...config.managers[kind],...assigned,...(event.owner?[event.owner]:[])])],note:'배정 교사: '+selected.map(p=>p.name).join(', '),duty:{kind,assigned,safety:kind==='safety'?safety:assigned,general:kind==='safety'?general:[]},readonly:true,canReschedule:false};
  }
  function imports(existing,incoming){
    const all=[...existing],result=[];
    for(const event of incoming){
      const match=all.find(e=>e.duty?.kind===event.duty.kind&&e.date===event.date);
      let id=match?.id||event.id;
      if(!match&&all.some(e=>e.id===id)){
        if(!all.find(e=>e.id===id).duty)throw Error('기존 일정과 충돌합니다.');
        let suffix=1;while(all.some(e=>e.id===`${event.id}-import-${suffix}`))suffix++;
        id=`${event.id}-import-${suffix}`;
      }
      const next={...event,id};result.push(next);const index=all.findIndex(e=>e.id===id);if(index<0)all.push(next);else all[index]=next;
    }
    return result;
  }
  function normalizeTitles(events){
    for(const event of events||[])if(event.duty&&Object.hasOwn(types,event.duty.kind))event.title=types[event.duty.kind].label;
    return events;
  }
  const api={types,managementTypes,departmentKinds,defaults,settings,date,plan,reassign,sameAssignment,imports,normalizeTitles};if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongDuties=api;
})(typeof window==='object'?window:globalThis);
