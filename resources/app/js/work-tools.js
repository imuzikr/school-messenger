/* Shared, side-effect-free rules for completion requests and authorized search. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DingdongWorkTools = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const kinds = ['all', 'mail', 'message', 'event', 'file'];
  const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
  function request(value, to, cc = [], sender = 'me') {
    if (!value) return null;
    if (!['submission', 'reply'].includes(value.kind)) throw new Error('완료 요청 종류를 선택해 주세요.');
    if (value.dueDate && !day(value.dueDate)) throw new Error('요청 마감일을 확인해 주세요.');
    const targets = [...new Set(to)].filter(id => id !== sender && id !== 'me' && !cc.includes(id));
    if (!targets.length) throw new Error('완료 요청을 받을 선생님을 지정해 주세요. 참조와 본인은 대상에서 제외됩니다.');
    return {kind: value.kind, dueDate: value.dueDate || '', targets};
  }
  function deliveryReceipt(mail, id, now = Date.now()) {
    const receipt = mail.receipts?.[mail.to?.indexOf(id)], work = mail.workDelivery?.[id];
    if (receipt === 'recalled' || work === 'recalled') return 'recalled';
    if (Date.parse(mail.scheduled) > now) return 'scheduled';
    if (receipt === 'read' || work === 'read') return 'read';
    return work || receipt || 'unread';
  }
  function summary(mail, now = Date.now()) {
    const targets = mail.workRequest?.targets || [];
    const rows = targets.map(id => {
      const delivery = deliveryReceipt(mail, id, now);
      const response = mail.workResponses?.[id];
      return {id, delivery, active: !['recalled', 'scheduled'].includes(delivery),
        done: response?.done === true, note: String(response?.note || ''), updatedAt: response?.updatedAt || null};
    });
    const active = rows.filter(r => r.active);
    return {rows, total: active.length, done: active.filter(r => r.done).length,
      pending: active.filter(r => !r.done).map(r => r.id), excluded: rows.length - active.length};
  }
  function filters(input = {}) {
    const query = String(input.query || '').trim();
    if (query.length > 150) throw new Error('검색어는 150자 이하로 입력해 주세요.');
    const kind = input.kind || 'all', sender = String(input.sender || ''), from = input.from || '', until = input.until || '';
    if (!kinds.includes(kind)) throw new Error('검색 유형을 확인해 주세요.');
    if (sender.length > 100) throw new Error('발신자를 확인해 주세요.');
    if ((from && !day(from)) || (until && !day(until)) || (from && until && from > until)) throw new Error('검색 시작일과 종료일을 확인해 주세요.');
    const offset = Number(input.offset || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw new Error('검색 페이지를 확인해 주세요.');
    return {query, kind, sender, from, until, offset};
  }
  // Input is an account-scoped snapshot. The server supplies only authorized records.
  function search(data, input = {}, currentUser = {}) {
    const f = filters(input), terms = normalize(f.query).split(/\s+/).filter(Boolean), rows = [];
    const names = new Map((data.people || []).map(p => [p.id, p.name]));
    names.set('me', currentUser.name || '나');
    if (currentUser.id) names.set(currentUser.id, currentUser.name || '나');
    const name = id => names.get(id) || '교직원';
    function add(record) {
      if (f.kind !== 'all' && record.kind !== f.kind) return;
      if (f.sender && record.sender !== f.sender && !(f.sender === 'me' && record.sender === currentUser.id)) return;
      if ((f.from && (!record.date || record.date < f.from)) || (f.until && (!record.date || record.date > f.until))) return;
      const text = [record.title, record.text, record.senderName, record.context].join(' ');
      if (!terms.every(term => normalize(text).includes(term))) return;
      const content = plain(record.text), match = terms.length ? normalize(content).indexOf(terms[0]) : 0;
      const start = Math.max(0, match - 45);
      rows.push({...record, text: (start ? '…' : '') + content.slice(start, start + 180) + (content.length > start + 180 ? '…' : '')});
    }
    for (const mail of data.mails || []) {
      if (mail.folder === 'trash') continue;
      const common = {source: 'mail', id: mail.id, date: mail.date || '', time: mail.time || '',
        sender: mail.from, senderName: name(mail.from), context: mail.folder === 'sent' ? '보낸 메시지' : '받은 메시지'};
      add({...common, kind: 'mail', title: mail.title || '제목 없는 메시지', text: mail.body || plain(mail.html)});
      (mail.files || []).forEach((file, index) => add({...common, kind: 'file', fileIndex: index,
        title: file.name, text: mail.title || '', context: '첨부 · ' + (mail.title || '메시지')}));
    }
    for (const room of data.rooms || []) for (const message of room.messages || []) {
      add({kind: 'message', source: 'message', id: message.id, room: room.id, date: message.date || '', time: message.time || '',
        sender: message.sender, senderName: name(message.sender), title: room.name, context: '대화', text: message.text});
    }
    for (const [key, source] of [['events', 'event'], ['deadlines', 'deadline']]) for (const event of data[key] || []) {
      const sender = event.owner || 'me';
      add({kind: 'event', source, id: event.id, date: event.date || '', time: event.start || event.dueTime || '',
        sender, senderName: name(sender), title: event.title, context: source === 'deadline' ? '마감' : event.place || '일정',
        text: [event.note, event.place, event.done ? '완료' : ''].filter(Boolean).join(' ')});
    }
    rows.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || (a.fileIndex || 0) - (b.fileIndex || 0));
    const counts = Object.fromEntries(kinds.slice(1).map(k => [k, rows.filter(r => r.kind === k).length]));
    return {total: rows.length, counts, results: rows.slice(f.offset, f.offset + 50), hasMore: f.offset + 50 < rows.length};
  }
  return {request, summary, deliveryReceipt, filters, search, day};
});
