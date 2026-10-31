/* Shared recipient rules for department announcements. */
(function(root){
  const isTeacher=person=>/교사$/.test(person.role||'')||['교장','교감','담임','교원','강사'].includes(person.role)||/부장$/.test(person.role||'')&&!/행정/.test(person.department||'');
  function recipients(people,audience){
    if(!['teachers','staff'].includes(audience))return [];
    return people.filter(p=>!p.disabled&&(audience==='staff'||isTeacher(p))).map(p=>p.id);
  }
  const api={isTeacher,recipients};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongAnnouncements=api;
})(typeof window==='object'?window:globalThis);
