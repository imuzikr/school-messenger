/* Shared validation for the school’s single staff workbook. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./announcements.js'):root.DingdongAnnouncements);if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongStaffDirectory=api;})(globalThis,teachers=>{
 'use strict';
 const headers=['이름','보직','학년','반','내선번호','부서','업무','특별실','동아리'];
 const norm=value=>String(value??'').normalize('NFKC').replace(/\s+/g,'');
 const dutyKind=value=>({안전지도:'safety',생활안전지도:'safety',중식지도:'lunch',자율학습지도:'study',자율학습:'study',일과표:'timetable',일과표관리:'timetable',보강:'lessons',시간표:'lessons',보강시간표:'lessons',보강및시간표:'lessons'})[norm(value).replace(/담당(?:자)?$/,'')];
 const duties=value=>String(value||'').split(/[,;\n/·]+/).map(v=>v.trim()).filter(Boolean);
 function normalizeRows(rows){
  const legacy=headers.filter(h=>h!=='보직');if(Array.isArray(rows?.[0])&&legacy.every((h,i)=>norm(rows[0][i])===h)&&!rows[0].slice(8).some(v=>v!=null&&String(v).trim()))return rows.map(row=>Array.isArray(row)?[row[0],row===rows[0]?'보직':'',...row.slice(1)]:row);
  return rows;
 }
 function plan(rows,people,context={},identities=[]){
  rows=normalizeRows(rows);
  const errors=[],entries=[],seen=new Set();
  if(!Array.isArray(rows)||rows.length<2||rows.length>1001)return {errors:['머리글과 최대 1,000명의 교직원을 입력해 주세요.'],entries:[]};
  if(!Array.isArray(rows[0])||(headers.some((h,i)=>norm(rows[0][i])!==h)||rows[0].slice(9).some(v=>v!=null&&String(v).trim())))return {errors:['첫 행은 이름, 보직, 학년, 반, 내선번호, 부서, 업무, 특별실, 동아리 순서여야 합니다.'],entries:[]};
  rows.slice(1).forEach((row,index)=>{try{
   if(!Array.isArray(row))throw Error('행 형식을 확인해 주세요.');if(row.every(v=>v==null||String(v).trim()===''))return;
   if(row.slice(9).some(v=>v!=null&&String(v).trim()))throw Error('A~I열만 사용해 주세요.');
   const values=headers.map((h,i)=>{const v=String(row[i]??'').trim();if(v.length>([40,40,10,10,20,60,300,120,120][i]))throw Error(h+' 값이 너무 깁니다.');return v;});
   const [name,position,gradeValue,classValue,extension,department,work,specialRoom,club]=values;if(!name||!department)throw Error('이름과 부서는 필수입니다.');
   const number=(value,suffix,max)=>{if(!value)return '';const m=value.match(new RegExp('^(\\d+)\\s*(?:'+suffix+')?$'));if(!m||+m[1]<1||+m[1]>max)throw Error(suffix+' 값을 확인해 주세요.');return String(+m[1]);};
   const grade=number(gradeValue,'학년',12),classNumber=number(classValue,'반',99);if(classNumber&&!grade)throw Error('반을 지정하면 학년도 입력해 주세요.');
   const matches=people.filter(p=>norm(p.name)===norm(name));let person;
   const requestedId=identities?.[index];if(requestedId){person=people.find(p=>p.id===requestedId);if(!person)throw Error('수정할 교직원을 찾을 수 없습니다.');}
   else if(matches.length===1)person=matches[0];else if(matches.length>1){const exact=matches.filter(p=>extension&&norm(p.extension)===norm(extension));if(exact.length!==1)throw Error(name+': 동명이인은 기존 내선번호로 구분해 주세요.');person=exact[0];}
   if(person?.disabled)throw Error(name+': 비활성 계정입니다. 관리자에서 먼저 활성화해 주세요.');
   const id=person?.id||'new-staff-row-'+(index+2),identity=person?.id||norm(name)+'|'+norm(extension);if(seen.has(identity))throw Error('같은 교직원이 중복 입력되었습니다.');seen.add(identity);
   if(!person&&matches.length===0&&entries.some(e=>e.isNew&&norm(e.name)===norm(name)&&(!extension||!e.extension)))throw Error('동명이인 신규 교직원은 서로 다른 내선번호가 필요합니다.');
   const role=person?.role||(/행정실|행정직/.test(department)?'행정직원':'교사');
   if(classNumber&&!teachers.isTeacher({role,department}))throw Error('담임은 교사만 지정할 수 있습니다.');
   entries.push({...person,id,name,position,keepClass:!!requestedId&&norm(person.grade)===norm(grade?grade+'학년':'')&&String(person.classNumber||'')===classNumber,keepManagers:!!requestedId&&String(person.work||'')===work,grade:grade?grade+'학년':'',classNumber,extension,department,work,specialRoom,club,role,isNew:!person,row:index+2});
  }catch(error){errors.push(`${index+2}행: ${error.message}`);}});
  const imported=new Set(entries.filter(e=>!e.keepManagers).map(e=>e.id)),classUpdates=new Set(entries.filter(e=>!e.keepClass).map(e=>e.id)),classes=(context.classTeachers||[]).filter(c=>!classUpdates.has(c.teacher)),managers=Object.fromEntries(['safety','lunch','study','timetable','lessons'].map(kind=>[kind,(context.dutySettings?.managers?.[kind]||[]).filter(id=>!imported.has(id))]));
  for(const entry of entries){
   if(entry.classNumber&&!entry.keepClass){const className=entry.grade+' '+entry.classNumber+'반';if(classes.some(c=>norm(c.className)===norm(className)))errors.push(`${entry.row}행: ${className} 담임이 중복됩니다.`);else classes.push({className,teacher:entry.id});}
   for(const word of duties(entry.work)){const kind=dutyKind(word);if(kind&&!managers[kind].includes(entry.id))managers[kind].push(entry.id);}
  }
  if(!entries.length&&!errors.length)errors.push('등록할 교직원이 없습니다.');
  const changed=new Map(entries.map(e=>[e.id,e])),updated=people.map(p=>changed.get(p.id)||p).concat(entries.filter(e=>e.isNew));
  const departments=[...new Set(updated.filter(p=>!p.disabled).map(p=>p.department))],safetyDepartments=departments.filter(d=>/생활안전부|학생생활부|생활교육부|안전생활부/.test(norm(d))),previous=context.dutySettings?.safetyDepartment;
  const importedSafetyDepartments=[...new Set(entries.filter(e=>duties(e.work).some(word=>dutyKind(word)==='safety')&&safetyDepartments.includes(e.department)).map(e=>e.department))];
  const safetyDepartment=importedSafetyDepartments.length===1?importedSafetyDepartments[0]:safetyDepartments.includes(previous)?previous:safetyDepartments[0]|| (departments.includes(previous)?previous:departments[0]||'생활안전부');
  return {errors,entries,classTeachers:classes,dutySettings:{safetyDepartment,managers}};
 }
 function resolve(plan,idMap={}){
  const id=value=>idMap[value]||value;
  return {entries:plan.entries.map(entry=>{const {isNew,row,keepClass,keepManagers,...person}=entry;return {...person,id:id(person.id)};}),classTeachers:plan.classTeachers.map(c=>({...c,teacher:id(c.teacher)})),dutySettings:{...plan.dutySettings,managers:Object.fromEntries(Object.entries(plan.dutySettings.managers).map(([kind,ids])=>[kind,ids.map(id)]))}};
 }
 return {headers,dutyKind,normalizeRows,plan,resolve};
});
