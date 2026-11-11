// ===== จำหมวดจากที่เลือก/แก้: ร้าน/ผู้รับ → หมวด =====
// ชีต Rules: key (ชื่อที่ตัดคำนำหน้า/ช่องว่างแล้ว), name (ชื่อที่เห็น), cat_id, kind, hits, updated_at
// บันทึกรายการที่มีร้าน/ชื่อ + หมวดเดียว → จำไว้ (เลือกหมวดใหม่ = ทับของเดิม)
// อ่านสลิปบรรทัดเดียว / กรอกมือ → ใช้กฎก่อน ไม่ต้องพึ่ง Gemini เดา

function ruleKey_(s) {
  s = String(s || '').toLowerCase().trim();
  s = s.replace(/^(นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/, '').replace(/^(นาย|นาง|mr|mrs|ms|miss)\.?\s+/, '');
  s = s.replace(/บริษัท|บจก\.?|จำกัด|\(มหาชน\)|มหาชน|co\.?,?\s*ltd\.?/g, '');
  s = s.replace(/x{2,}[\dx\-]*/g, '');           // เลขบัญชีที่ปิดไว้ xxx-x-x1234-x
  return s.replace(/[\s.,\-_/\\()'"*:;#&+]+/g, '');
}

// หากฎ: ตรงทุกตัว ก่อน · ไม่งั้นชื่อหนึ่งอยู่ในอีกชื่อ (ยาว ≥ 4) เลือกอันยาวสุด
function findRule_(rules, text, kind) {
  const k = ruleKey_(text);
  if (!k) return null;
  const list = rules.filter(r => r.key && (!kind || (r.kind === 'income') === (kind === 'income')));
  const exact = list.find(r => String(r.key) === k);
  if (exact) return exact;
  if (k.length < 4) return null;
  return list.filter(r => String(r.key).length >= 4 && (k.indexOf(r.key) >= 0 || String(r.key).indexOf(k) >= 0))
    .sort((a, b) => String(b.key).length - String(a.key).length)[0] || null;
}

// list = รายการ (cleanTx_ แล้ว) จากการบันทึกครั้งเดียว
function learnRule_(list) {
  try {
    const xs = (list || []).filter(t => (t.type === 'expense' || t.type === 'income') && t.cat_id);
    if (!xs.length) return;
    const catIds = xs.map(t => t.cat_id).filter((c, i, a) => a.indexOf(c) === i);
    if (catIds.length !== 1) return;                  // ใบเสร็จหลายหมวด ไม่จำ
    const name = String(xs[0].shop || xs[0].item || '').trim();
    const key = ruleKey_(name);
    if (!key || key.length < 2) return;
    const old = rows_(SH_.RULE).find(r => String(r.key) === key);
    const same = old && String(old.cat_id) === catIds[0];
    upsert_(SH_.RULE, { key: key, name: name, cat_id: catIds[0], kind: xs[0].type,
      hits: same ? (Number(old.hits) || 0) + 1 : 1, updated_at: nowStr_() });
  } catch (e) {}
}

function deleteRule(key) {
  return withLock_(() => { deleteWhere_(SH_.RULE, o => String(o.key) === String(key)); return getAll(); });
}
