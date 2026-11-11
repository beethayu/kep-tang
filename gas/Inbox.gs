// ===== กล่องสลิป K PLUS: คำสั่งลัด iPhone ส่งรูปจากอัลบั้ม "K PLUS" มาเข้าคิว "รอยืนยัน" =====
// คำสั่งลัด POST {fn:'inboxSlip', k:รหัส, img:base64, taken:วันที่ถ่าย ISO 8601}
// กันซ้ำ: เวลาในรูป (taken) หรือ md5 ของรูปเดิม → ตอบ dup ไม่เก็บซ้ำ (คำสั่งลัดส่งซ้ำได้ไม่เบิ้ล)
// สลิปสด (ถ่ายภายใน 6 ชม.) อ่านด้วย Gemini ทันที / สลิปย้อนหลังให้หน้าเว็บทยอยอ่าน (readInbox) ตอนเปิดแอป
// status: new → reading → ready / error → saved / discarded (แถว saved/discarded เก็บไว้กันส่งซ้ำ)

function takenStr_(x) {
  const d = new Date(String(x || '').trim());
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}
function mimeOf_(b64) {
  if (b64.indexOf('/9j/') === 0) return 'image/jpeg';
  if (b64.indexOf('iVBOR') === 0) return 'image/png';
  if (b64.indexOf('UklGR') === 0) return 'image/webp';
  return 'image/heic';
}
function inboxRow_(id) { return rows_(SH_.INBOX).find(r => String(r.in_id) === String(id)); }
function inboxOut_(r) {
  let data = null;
  try { data = r.data ? JSON.parse(r.data) : null; } catch (e) {}
  return { in_id: r.in_id, taken: r.taken, photo_id: r.photo_id, status: r.status, err: r.err, data: data };
}
function markInbox_(id, status, extra) {
  return withLock_(() => {
    const r = inboxRow_(id);
    if (!r) return null;
    upsert_(SH_.INBOX, Object.assign(r, { status: status }, extra || {}));
    return r;
  });
}
function inboxPending_() {
  const old = Utilities.formatDate(new Date(Date.now() - 3 * 60000), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  return rows_(SH_.INBOX).filter(r => ['new', 'reading', 'ready', 'error'].indexOf(String(r.status)) >= 0)
    .map(r => { const o = inboxOut_(r); if (o.status === 'reading' && String(r.err) < old) o.status = 'new'; return o; })
    .sort((a, b) => String(a.taken) < String(b.taken) ? -1 : 1);
}

// เรียกจากคำสั่งลัด
function inboxSlip(img, taken) {
  img = String(img || '').replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  if (img.length < 2000) throw new Error('ไม่มีรูป');
  const t = takenStr_(taken);
  const md5 = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, img));
  const res = withLock_(() => {
    const dup = rows_(SH_.INBOX).find(r => (t && String(r.taken) === t) || String(r.md5) === md5);
    if (dup) return { dup: true, status: dup.status };
    const mime = mimeOf_(img);
    const f = slipFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(img), mime,
      'kplus_' + (t || nowStr_()).replace(/\D/g, '') + '.' + mime.split('/')[1]));
    const o = { in_id: newId_('I'), taken: t || nowStr_(), md5: md5, photo_id: f.getId(), status: 'new', data: '', err: '',
      bill_id: '', created_at: nowStr_() };
    appendMany_(SH_.INBOX, [o]);
    return o;
  });
  if (res.dup) return 'ซ้ำ (มีแล้ว)';
  const fresh = Date.now() - new Date(res.taken.replace(' ', 'T') + '+07:00').getTime() < 6 * 3600000;
  if (fresh) { try { readInbox(res.in_id); } catch (e) {} }
  return 'รับแล้ว';
}

// อ่านสลิปในคิว 1 ใบ (id ว่าง = ใบเก่าสุดที่ยังไม่อ่าน) → คืนแถวนั้น
function readInbox(id) {
  const r = withLock_(() => {
    const p = inboxPending_();
    const x = id ? p.find(o => String(o.in_id) === String(id)) : p.find(o => o.status === 'new');
    if (!x || (x.status !== 'new' && x.status !== 'error')) return null;
    const row = inboxRow_(x.in_id);
    upsert_(SH_.INBOX, Object.assign(row, { status: 'reading', err: nowStr_() }));   // err = เวลาเริ่มอ่าน (กันอ่านซ้อน)
    return row;
  });
  if (!r) return id ? inboxOut_(inboxRow_(id) || {}) : null;
  let out;
  try {
    const blob = DriveApp.getFileById(String(r.photo_id)).getBlob();
    out = readCore_([Utilities.base64Encode(blob.getBytes())], blob.getContentType() || 'image/jpeg', String(r.photo_id));
  } catch (e) {
    out = { error: String(e.message || e) };
  }
  if (out.error) {
    markInbox_(r.in_id, 'error', { err: out.error.slice(0, 300) });
  } else {
    // ยอดเท่ากัน วันใกล้กัน (±1 วัน) กับรายการที่กรอกมือ (ไม่มีรูป) → อาจลงซ้ำ ให้ถาม
    if (!out.dupe && out.total) {
      const day = s => new Date(String(s) + 'T00:00:00').getTime() / 86400000;
      const near = rows_(SH_.TX).find(t => !t.photo_id && !t.bill_id && (t.type === 'expense' || t.type === 'income') &&
        Math.abs(num_(t.amount) - out.total) < 0.01 && Math.abs(day(t.date) - day(out.date)) <= 1);
      if (near) out.dupe = { date: near.date, item: near.item || near.shop || 'รายการกรอกเอง', tx_id: near.tx_id, near: true };
    }
    const it = out.items || [];
    out.sure = !out.dupe && !out.farm && (out.kind === 'slip' || out.kind === 'card') && out.total > 0 && !!out.acc_id &&
      it.length === 1 && Math.abs(it[0].amount - out.total) < 0.01 && !!it[0].cat_id;
    markInbox_(r.in_id, 'ready', { data: JSON.stringify(out), err: '' });
  }
  return inboxOut_(inboxRow_(r.in_id));
}

// ยืนยันทั้งหมดที่ AI มั่นใจ
function confirmInbox(ids) {
  return withLock_(() => {
    let n = 0;
    (ids || []).forEach(id => {
      const r = inboxRow_(id);
      if (!r || r.status !== 'ready') return;
      const d = inboxOut_(r).data;
      if (!d || !d.sure) return;
      const billId = saveBillCore_({ date: d.date, acc_id: d.acc_id, shop: d.shop, ref: d.ref, photo_id: r.photo_id, farm: false,
        items: d.items.map(it => ({ item: it.item, amount: it.amount, cat_id: it.cat_id, type: d.type === 'income' ? 'income' : 'expense' })) });
      upsert_(SH_.INBOX, Object.assign(r, { status: 'saved', bill_id: billId }));
      n++;
    });
    const all = getAll();
    all.confirmed = n;
    return all;
  });
}

// ทิ้งสลิป (ไม่บันทึก) → ลบรูปใน Drive แต่เก็บแถวไว้กันส่งซ้ำ
function discardInbox(id) {
  const r = markInbox_(id, 'discarded', { data: '' });
  if (r) discardSlip(r.photo_id);
  return getAll();
}

// คำสั่งลัดถามก่อนว่ารับสลิปถึงเวลาไหนแล้ว → ส่งเฉพาะรูปที่ใหม่กว่า (ไม่อัปรูปเดิมซ้ำทุกรอบ)
// ยังไม่เคยรับ = วันเริ่มย้อนหลัง (INBOX_FROM ไม่ตั้ง = วันที่ 1 ของเดือนนี้) → รอบแรกส่งย้อนหลังให้เอง
function inboxLast() {
  const t = rows_(SH_.INBOX).map(r => String(r.taken)).filter(Boolean).sort().pop();
  if (t) return t.replace(' ', 'T') + '+07:00';
  return inboxFrom_() + 'T00:00:00+07:00';
}
function inboxFrom_() {
  return PropertiesService.getScriptProperties().getProperty('INBOX_FROM') || today_().slice(0, 8) + '01';
}
function setInboxFrom(d) {
  PropertiesService.getScriptProperties().setProperty('INBOX_FROM', isoDate_(d));
  return getAll();
}
