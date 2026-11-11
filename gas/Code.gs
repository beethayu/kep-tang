// ===== เก็บตังค์: บัญชีรายรับรายจ่ายส่วนตัว =====
// วันที่เก็บเป็นข้อความ yyyy-mm-dd (ค.ศ.) — หน้าเว็บแสดงเป็น พ.ศ.
// จำนวนเงินเก็บเป็นตัวเลขบวกเสมอ ยกเว้น type = adjust (ปรับยอด) ที่เป็น + / −

const SH_ = {
  ACC: { name: 'Accounts', head: ['acc_id', 'name', 'type', 'opening', 'hint', 'order', 'archived', 'created_at'] },
  CAT: { name: 'Categories', head: ['cat_id', 'name', 'kind', 'icon', 'budget', 'order', 'archived'] },
  TX: { name: 'Transactions', head: ['tx_id', 'date', 'type', 'amount', 'acc_id', 'to_acc_id', 'cat_id', 'item', 'shop', 'note',
    'bill_id', 'photo_id', 'ref', 'recur_id', 'created_at'] },
  REC: { name: 'Recurring', head: ['rec_id', 'name', 'type', 'amount', 'acc_id', 'to_acc_id', 'cat_id', 'freq', 'day', 'next_date',
    'auto', 'active', 'note'] },
  RULE: { name: 'Rules', head: ['key', 'name', 'cat_id', 'kind', 'hits', 'updated_at'] }  // จำหมวด (Rules.gs)
};
const TXT_COLS_ = ['date', 'next_date', 'ref', 'hint', 'key', 'name'];

const ACC_TYPES_ = ['cash', 'bank', 'card', 'ewallet', 'farm', 'other'];
const DEFAULT_ACCS_ = [
  ['เงินสด', 'cash'], ['ธนาคาร', 'bank'], ['บัตรเครดิต', 'card'], ['สำรองจ่ายไร่ (รอเบิก)', 'farm']
];
const DEFAULT_CATS_ = [
  ['อาหาร', 'expense', '🍚'], ['กาแฟ/ขนม', 'expense', '☕'], ['ของใช้ในบ้าน', 'expense', '🧴'],
  ['เดินทาง/น้ำมันรถ', 'expense', '⛽'], ['ค่าน้ำ ค่าไฟ', 'expense', '💡'], ['โทรศัพท์/เน็ต', 'expense', '📱'],
  ['สุขภาพ/ยา', 'expense', '💊'], ['เสื้อผ้า/ช้อปปิ้ง', 'expense', '🛍️'], ['บันเทิง/ท่องเที่ยว', 'expense', '🎬'],
  ['ครอบครัว/ให้คนอื่น', 'expense', '👪'], ['ทำบุญ', 'expense', '🙏'], ['ประกัน/ภาษี', 'expense', '🧾'],
  ['ซ่อมบำรุง', 'expense', '🔧'], ['อื่น ๆ', 'expense', '📦'],
  ['เงินเดือน/รายได้', 'income', '💼'], ['ขายของ', 'income', '🏷️'], ['ดอกเบี้ย/ปันผล', 'income', '📈'],
  ['ได้คืน', 'income', '↩️'], ['รายรับอื่น ๆ', 'income', '💰']
];

// ---------- ชีต ----------
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(def) {
  const ss = ss_();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    def.head.forEach((h, i) => { if (TXT_COLS_.indexOf(h) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@'); });
    return sh;
  }
  // เพิ่มคอลัมน์ใหม่ต่อท้ายถ้ายังไม่มี
  const cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  def.head.forEach(h => {
    if (cur.indexOf(h) < 0) {
      const c = sh.getLastColumn() + 1;
      sh.getRange(1, c).setValue(h).setFontWeight('bold');
      if (TXT_COLS_.indexOf(h) >= 0) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
      cur.push(h);
    }
  });
  return sh;
}

function rows_(def) {
  const sh = sheet_(def);
  const v = sh.getDataRange().getValues();
  const head = v[0];
  return v.slice(1).filter(r => r[0] !== '').map(r => {
    const o = {};
    head.forEach((h, i) => {
      let x = r[i];
      if (x instanceof Date) x = Utilities.formatDate(x, 'Asia/Bangkok', 'yyyy-MM-dd');
      o[h] = x;
    });
    return o;
  });
}

function toRow_(sh, o) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return head.map(h => (o[h] === undefined || o[h] === null) ? '' : o[h]);
}

function findRow_(sh, id) {
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1;
  return -1;
}

function upsert_(def, o) {
  const sh = sheet_(def);
  const r = findRow_(sh, o[def.head[0]]);
  const row = toRow_(sh, o);
  if (r > 0) sh.getRange(r, 1, 1, row.length).setValues([row]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function appendMany_(def, list) {
  if (!list.length) return;
  const sh = sheet_(def);
  const rows = list.map(o => toRow_(sh, o));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function deleteWhere_(def, pred) {
  const sh = sheet_(def);
  const v = sh.getDataRange().getValues();
  const head = v[0];
  let n = 0;
  for (let i = v.length - 1; i >= 1; i--) {
    const o = {}; head.forEach((h, k) => o[h] = v[i][k]);
    if (v[i][0] !== '' && pred(o)) { sh.deleteRow(i + 1); n++; }
  }
  return n;
}

function newId_(p) { return p + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(); }
function today_() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'); }
function nowStr_() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'); }
function num_(x) { const n = Number(String(x).replace(/,/g, '')); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
function isoDate_(s) {
  s = String(s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error('วันที่ไม่ถูกต้อง: ' + s);
}
var inLock_ = false;
function withLock_(f) {
  if (inLock_) return f();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  inLock_ = true;
  try { return f(); } finally { inLock_ = false; lock.releaseLock(); }
}

function setupSheets_() {
  Object.keys(SH_).forEach(k => sheet_(SH_[k]));
  const ss = ss_();
  const s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) ss.deleteSheet(s1);
  if (!rows_(SH_.ACC).length) {
    appendMany_(SH_.ACC, DEFAULT_ACCS_.map((a, i) => ({ acc_id: 'A' + (i + 1), name: a[0], type: a[1], opening: 0, hint: '',
      order: i + 1, archived: '', created_at: nowStr_() })));
  }
  if (!rows_(SH_.CAT).length) {
    appendMany_(SH_.CAT, DEFAULT_CATS_.map((c, i) => ({ cat_id: 'C' + (i + 1), name: c[0], kind: c[1], icon: c[2], budget: '',
      order: i + 1, archived: '' })));
  }
}

// ---------- อ่านทั้งหมด ----------
function getAll() {
  if (!PropertiesService.getScriptProperties().getProperty('API_KEY')) {
    return { needsSetup: true, today: today_() };
  }
  if (!ss_().getSheetByName(SH_.TX.name)) setupSheets_();
  let posted = 0;
  try { posted = runAutoRecurring_(); } catch (e) {}
  const props = PropertiesService.getScriptProperties();
  const rec = rows_(SH_.REC);
  const t = today_();
  return {
    today: t,
    version: APP_VERSION,
    accounts: rows_(SH_.ACC),
    categories: rows_(SH_.CAT),
    tx: rows_(SH_.TX),
    recurring: rec,
    rules: rows_(SH_.RULE),
    due: rec.filter(r => r.active !== false && String(r.active) !== 'FALSE' && !isTrue_(r.auto) && r.next_date && r.next_date <= t),
    autoPosted: posted,
    settings: { gemini: !!props.getProperty('GEMINI_KEY'), raiKey: !!props.getProperty('RAI_KEY') }
  };
}
function isTrue_(x) { return x === true || String(x).toUpperCase() === 'TRUE' || x === 1 || x === '1'; }

// ---------- รายการ ----------
function cleanTx_(t) {
  const type = ['expense', 'income', 'transfer', 'adjust'].indexOf(t.type) >= 0 ? t.type : 'expense';
  const o = {
    tx_id: t.tx_id || newId_('T'),
    date: isoDate_(t.date),
    type: type,
    amount: type === 'adjust' ? num_(t.amount) : Math.abs(num_(t.amount)),
    acc_id: String(t.acc_id || ''),
    to_acc_id: type === 'transfer' ? String(t.to_acc_id || '') : '',
    cat_id: (type === 'expense' || type === 'income') ? String(t.cat_id || '') : '',
    item: String(t.item || '').trim(),
    shop: String(t.shop || '').trim(),
    note: String(t.note || '').trim(),
    bill_id: String(t.bill_id || ''),
    photo_id: String(t.photo_id || ''),
    ref: String(t.ref || ''),
    recur_id: String(t.recur_id || ''),
    created_at: t.created_at || nowStr_()
  };
  if (!o.acc_id) throw new Error('ยังไม่ได้เลือกบัญชี');
  if (type === 'transfer' && (!o.to_acc_id || o.to_acc_id === o.acc_id)) throw new Error('เลือกบัญชีปลายทางให้ถูก');
  if (!o.amount && type !== 'adjust') throw new Error('ยังไม่ได้ใส่จำนวนเงิน');
  return o;
}

function saveTx(t) {
  return withLock_(() => { const o = cleanTx_(t); upsert_(SH_.TX, o); learnRule_([o]); return getAll(); });
}

function deleteTx(id) {
  return withLock_(() => { deleteWhere_(SH_.TX, o => String(o.tx_id) === String(id)); return getAll(); });
}

// บิล/สลิปหลายบรรทัด: b = {bill_id?, date, acc_id, shop, ref, photo_id, note, farm, items:[{item, amount, cat_id, type}]}
// farm = ค่าไร่ (สำรองจ่าย) → บันทึกเป็นโอนไปบัญชี "สำรองจ่ายไร่" ยอดเดียว ไม่นับเป็นรายจ่าย
function saveBill(b) {
  return withLock_(() => {
    const billId = b.bill_id || newId_('B');
    let created = nowStr_();
    if (b.bill_id) {
      const old = rows_(SH_.TX).filter(x => x.bill_id === billId);
      if (old.length) created = old[0].created_at || created;
      deleteWhere_(SH_.TX, o => String(o.bill_id) === billId);
    }
    const base = { date: b.date, acc_id: b.acc_id, shop: b.shop, bill_id: billId, photo_id: b.photo_id || '',
      ref: b.ref || '', note: b.note || '', created_at: created };
    let list;
    if (b.farm) {
      const farm = rows_(SH_.ACC).find(a => a.type === 'farm' && !isTrue_(a.archived));
      if (!farm) throw new Error('ไม่มีบัญชีประเภท "สำรองจ่ายไร่" — เพิ่มในหน้า บัญชี ก่อน');
      const total = (b.items || []).reduce((s, it) => s + num_(it.amount), 0);
      const names = (b.items || []).map(it => it.item).filter(Boolean).slice(0, 6).join(', ');
      list = [cleanTx_(Object.assign({}, base, { type: 'transfer', to_acc_id: farm.acc_id, amount: total,
        item: 'ค่าไร่' + (names ? ': ' + names : '') }))];
    } else {
      list = (b.items || []).filter(it => num_(it.amount) > 0).map(it => cleanTx_(Object.assign({}, base, {
        type: it.type === 'income' ? 'income' : 'expense', amount: num_(it.amount), item: it.item, cat_id: it.cat_id })));
      // ส่วนลด (ยอดติดลบ) → หักออกจากบรรทัดหมวดเดียวกันที่ใหญ่สุด
      const neg = (b.items || []).filter(it => num_(it.amount) < 0);
      if (neg.length) {
        neg.forEach(it => {
          const same = list.filter(x => x.cat_id === it.cat_id).sort((a, c) => c.amount - a.amount)[0] ||
            list.slice().sort((a, c) => c.amount - a.amount)[0];
          if (same) { same.amount = Math.round((same.amount + num_(it.amount)) * 100) / 100; same.note = (same.note ? same.note + ' · ' : '') + (it.item || 'ส่วนลด') + ' ' + num_(it.amount); }
        });
        list = list.filter(x => x.amount > 0);
      }
    }
    if (!list.length) throw new Error('ไม่มีรายการที่มีจำนวนเงิน');
    appendMany_(SH_.TX, list);
    if (!b.farm) learnRule_(list);
    return getAll();
  });
}

function deleteBill(billId, keepPhoto) {
  return withLock_(() => {
    const old = rows_(SH_.TX).filter(x => x.bill_id === billId);
    deleteWhere_(SH_.TX, o => String(o.bill_id) === String(billId));
    if (!keepPhoto && old.length && old[0].photo_id) discardSlip(old[0].photo_id);
    return getAll();
  });
}

// ---------- บัญชี ----------
function saveAccount(a) {
  return withLock_(() => {
    const list = rows_(SH_.ACC);
    const old = list.find(x => x.acc_id === a.acc_id) || {};
    const o = Object.assign({}, old, {
      acc_id: a.acc_id || newId_('A'),
      name: String(a.name || '').trim(),
      type: ACC_TYPES_.indexOf(a.type) >= 0 ? a.type : 'other',
      opening: num_(a.opening),
      hint: String(a.hint || '').trim(),
      order: a.order !== undefined ? a.order : (old.order || list.length + 1),
      archived: a.archived ? true : '',
      created_at: old.created_at || nowStr_()
    });
    if (!o.name) throw new Error('ใส่ชื่อบัญชี');
    upsert_(SH_.ACC, o);
    return getAll();
  });
}

// ปรับยอดให้ตรงกับยอดจริง (เช่น เปิดแอปธนาคารดู) → สร้างรายการ adjust ส่วนต่าง
function adjustBalance(accId, actual, current, date) {
  const diff = Math.round((num_(actual) - num_(current)) * 100) / 100;
  if (!diff) return getAll();
  return saveTx({ type: 'adjust', date: date || today_(), acc_id: accId, amount: diff, item: 'ปรับยอดให้ตรงยอดจริง' });
}

function deleteAccount(accId) {
  return withLock_(() => {
    const used = rows_(SH_.TX).some(t => t.acc_id === accId || t.to_acc_id === accId);
    if (used) {
      const a = rows_(SH_.ACC).find(x => x.acc_id === accId);
      if (a) { a.archived = true; upsert_(SH_.ACC, a); }
    } else deleteWhere_(SH_.ACC, o => o.acc_id === accId);
    return getAll();
  });
}

// ---------- หมวดหมู่ / งบ ----------
function saveCategory(c) {
  return withLock_(() => {
    const list = rows_(SH_.CAT);
    const old = list.find(x => x.cat_id === c.cat_id) || {};
    const o = Object.assign({}, old, {
      cat_id: c.cat_id || newId_('C'),
      name: String(c.name || '').trim(),
      kind: c.kind === 'income' ? 'income' : 'expense',
      icon: String(c.icon || '').trim(),
      budget: c.budget === '' || c.budget === null || c.budget === undefined ? '' : num_(c.budget),
      order: c.order !== undefined ? c.order : (old.order || list.length + 1),
      archived: c.archived ? true : ''
    });
    if (!o.name) throw new Error('ใส่ชื่อหมวด');
    upsert_(SH_.CAT, o);
    return getAll();
  });
}

function deleteCategory(catId) {
  return withLock_(() => {
    const used = rows_(SH_.TX).some(t => t.cat_id === catId) || rows_(SH_.REC).some(r => r.cat_id === catId);
    if (used) {
      const c = rows_(SH_.CAT).find(x => x.cat_id === catId);
      if (c) { c.archived = true; upsert_(SH_.CAT, c); }
    } else deleteWhere_(SH_.CAT, o => o.cat_id === catId);
    return getAll();
  });
}

// เรียงลำดับ: ids = [cat_id ตามลำดับใหม่]
function reorderCategories(ids) {
  return withLock_(() => {
    const sh = sheet_(SH_.CAT);
    const v = sh.getDataRange().getValues();
    const oc = v[0].indexOf('order');
    for (let i = 1; i < v.length; i++) {
      const k = ids.indexOf(String(v[i][0]));
      if (k >= 0) sh.getRange(i + 1, oc + 1).setValue(k + 1);
    }
    return getAll();
  });
}

// ---------- รายการประจำ ----------
// freq: monthly (day = วันที่ 1–31) / weekly (day = 0–6 อา.–ส.) / yearly (day = "mm-dd")
function nextDate_(r, fromIso) {
  const d = new Date(fromIso + 'T12:00:00');
  if (r.freq === 'weekly') { d.setDate(d.getDate() + 7); }
  else if (r.freq === 'yearly') { d.setFullYear(d.getFullYear() + 1); }
  else {
    const want = Math.min(31, Math.max(1, Number(r.day) || d.getDate()));
    d.setDate(1); d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(want, last));
  }
  return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
}

function saveRecurring(r) {
  return withLock_(() => {
    const old = rows_(SH_.REC).find(x => x.rec_id === r.rec_id) || {};
    const type = ['expense', 'income', 'transfer'].indexOf(r.type) >= 0 ? r.type : 'expense';
    const o = Object.assign({}, old, {
      rec_id: r.rec_id || newId_('R'),
      name: String(r.name || '').trim(),
      type: type, amount: Math.abs(num_(r.amount)),
      acc_id: String(r.acc_id || ''), to_acc_id: type === 'transfer' ? String(r.to_acc_id || '') : '',
      cat_id: type === 'transfer' ? '' : String(r.cat_id || ''),
      freq: ['monthly', 'weekly', 'yearly'].indexOf(r.freq) >= 0 ? r.freq : 'monthly',
      day: r.day, next_date: isoDate_(r.next_date), auto: !!r.auto, active: r.active === false ? false : true,
      note: String(r.note || '')
    });
    if (!o.name) throw new Error('ใส่ชื่อรายการ');
    if (!o.acc_id) throw new Error('เลือกบัญชี');
    upsert_(SH_.REC, o);
    return getAll();
  });
}

function deleteRecurring(recId) {
  return withLock_(() => { deleteWhere_(SH_.REC, o => o.rec_id === recId); return getAll(); });
}

// บันทึกรอบที่ถึงกำหนด (ผู้ใช้กดยืนยัน แก้ยอด/วันที่ได้)
function postRecurring(recId, amount, date, accId) {
  return withLock_(() => {
    const r = rows_(SH_.REC).find(x => x.rec_id === recId);
    if (!r) throw new Error('ไม่พบรายการประจำ');
    const due = r.next_date;
    upsert_(SH_.TX, cleanTx_({ type: r.type, date: date || due, amount: amount || r.amount, acc_id: accId || r.acc_id,
      to_acc_id: r.to_acc_id, cat_id: r.cat_id, item: r.name, note: r.note, recur_id: r.rec_id }));
    r.next_date = nextDate_(r, due);
    upsert_(SH_.REC, r);
    return getAll();
  });
}

function skipRecurring(recId) {
  return withLock_(() => {
    const r = rows_(SH_.REC).find(x => x.rec_id === recId);
    if (!r) throw new Error('ไม่พบรายการประจำ');
    r.next_date = nextDate_(r, r.next_date);
    upsert_(SH_.REC, r);
    return getAll();
  });
}

// อัตโนมัติ: บันทึกให้เองทุกรอบที่เลยกำหนด (ไม่เกิน 24 รอบต่อรายการ กันวนไม่จบ)
function runAutoRecurring_() {
  const t = today_();
  const recs = rows_(SH_.REC).filter(r => isTrue_(r.auto) && r.active !== false && String(r.active) !== 'FALSE' && r.next_date && r.next_date <= t);
  if (!recs.length) return 0;
  return withLock_(() => {
    let n = 0;
    const add = [];
    recs.forEach(r => {
      let k = 0;
      while (r.next_date <= t && k < 24) {
        add.push(cleanTx_({ type: r.type, date: r.next_date, amount: r.amount, acc_id: r.acc_id, to_acc_id: r.to_acc_id,
          cat_id: r.cat_id, item: r.name, note: r.note, recur_id: r.rec_id }));
        r.next_date = nextDate_(r, r.next_date); k++; n++;
      }
      upsert_(SH_.REC, r);
    });
    appendMany_(SH_.TX, add);
    return n;
  });
}

// ---------- ตั้งค่า ----------
function setGeminiKey(k) {
  k = String(k || '').trim();
  if (k.length < 20) throw new Error('รหัส Gemini ดูไม่ถูกต้อง');
  PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', k);
  return slipAiCheck();
}

function changeApiKey(newKey) {
  newKey = String(newKey || '').trim();
  if (newKey.length < 4) throw new Error('รหัสสั้นเกินไป');
  PropertiesService.getScriptProperties().setProperty('API_KEY', newKey);
  return true;
}

// ยอด "รอเบิกจากไร่" — อ่านจาก API แอปไร่อ้อย (ฟังก์ชัน claimSummary ฝั่งไร่ยังไม่ได้ทำ → คืน null)
const RAI_URL_ = 'https://script.google.com/macros/s/AKfycbzWvJ2M0C7ZHQTVTWVCFCh7ugALw9dWws9A52iYEYvpxivqWzRCN22qWa4R6mE5XcZBuA/exec';
function setRaiKey(k) {
  PropertiesService.getScriptProperties().setProperty('RAI_KEY', String(k || '').trim());
  return raiPending();
}
function raiPending() {
  const k = PropertiesService.getScriptProperties().getProperty('RAI_KEY');
  if (!k) return { ok: false, reason: 'nokey' };
  const cache = CacheService.getScriptCache();
  const c = cache.get('rai_pending');
  if (c) return JSON.parse(c);
  let out;
  try {
    const res = UrlFetchApp.fetch(RAI_URL_, { method: 'post', contentType: 'text/plain', muteHttpExceptions: true,
      payload: JSON.stringify({ fn: 'claimSummary', args: [], k: k }) });
    const j = JSON.parse(res.getContentText());
    if (j.ok && j.result) out = { ok: true, pending: num_(j.result.pending), bills: j.result.bills || 0, oldest: j.result.oldest || '' };
    else out = { ok: false, reason: /AUTH/.test(j.error || '') ? 'auth' : 'notready', error: j.error || '' };
  } catch (e) { out = { ok: false, reason: 'error', error: String(e.message || e) }; }
  cache.put('rai_pending', JSON.stringify(out), out.ok ? 600 : 120);
  return out;
}
