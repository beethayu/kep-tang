// ===== อ่านสลิป/ใบเสร็จด้วย Gemini (ยกมาจากแอปไร่อ้อย) =====
// รหัสอยู่ใน Script Properties: GEMINI_KEY (ห้ามใส่ในโค้ด/GitHub)  รุ่นเปลี่ยนได้ที่ GEMINI_MODEL
function geminiKey_() {
  const k = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!k) throw new Error('ยังไม่ได้ใส่รหัส Gemini (ตั้งค่า → รหัส Gemini)');
  return k.trim();
}

function slipFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SLIP_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('สลิป เก็บตังค์');
  props.setProperty('SLIP_FOLDER_ID', f.getId());
  return f;
}

// เช็กว่ารหัสใช้ได้ (ไม่คืนรหัส)
function slipAiCheck() {
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=5', {
    headers: { 'x-goog-api-key': geminiKey_() }, muteHttpExceptions: true
  });
  return { ok: res.getResponseCode() === 200, code: res.getResponseCode() };
}

var geminiUsed_ = '';
function geminiCall_(parts) {
  const props = PropertiesService.getScriptProperties();
  // ทดสอบในแอปไร่ 1 พ.ย. 69: 2.5 เลิกให้บัญชีใหม่ใช้, flash-latest ช้ามาก, 3.5-flash + minimal เร็ว
  const models = [props.getProperty('GEMINI_MODEL') || 'gemini-3.5-flash', 'gemini-3.5-flash-lite']
    .filter((m, i, a) => m && a.indexOf(m) === i);
  const think = m => /2\.5/.test(m) ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' };
  let last = '';
  const tries = [];
  models.forEach((m, k) => { tries.push(m); if (k === 0) tries.push(m); });
  for (let i = 0; i < tries.length; i++) {
    if (i === 1) Utilities.sleep(1500);
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + tries[i] + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': geminiKey_() },
      payload: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: think(tries[i]) }
      })
    });
    const code = res.getResponseCode(), txt = res.getContentText();
    if (code === 200) {
      geminiUsed_ = tries[i];
      const j = JSON.parse(txt);
      const out = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      return out.map(p => p.text || '').join('');
    }
    last = code + ' ' + txt.slice(0, 200);
    if (i === 0 && code !== 429 && code < 500) i++; // ผิดแบบถาวร ไม่ต้องลองซ้ำ
  }
  throw new Error('อ่านสลิปไม่ได้ (Gemini ' + last + ')');
}

// อ่านรูป → เก็บรูปใน Drive + ให้ Gemini แยกรายการ (ยังไม่บันทึก รอตรวจก่อน)
// images = b64 เดียว หรือ array (ใบเสร็จยาวหลายรูป) / opts.photo_ids = รูปที่เก็บไปแล้ว
function readSlip(images, mime, opts) {
  const pages = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!pages.length) throw new Error('ไม่มีรูป');
  mime = mime || 'image/jpeg';
  opts = opts || {};
  const today = today_();
  const accs = rows_(SH_.ACC).filter(a => !isTrue_(a.archived) && a.type !== 'farm');
  const cats = rows_(SH_.CAT).filter(c => !isTrue_(c.archived));
  const tx = rows_(SH_.TX);
  // ร้านเดิม → หมวดที่เคยใช้บ่อย (ช่วย AI เดา)
  const shopCat = {};
  tx.forEach(t => { if (t.shop && t.cat_id) { const k = t.shop; (shopCat[k] = shopCat[k] || {})[t.cat_id] = (shopCat[k][t.cat_id] || 0) + 1; } });
  const catName = id => (cats.find(c => c.cat_id === id) || {}).name || '';
  const shopHints = Object.keys(shopCat).slice(-60).map(s => {
    const best = Object.keys(shopCat[s]).sort((a, b) => shopCat[s][b] - shopCat[s][a])[0];
    return `- ${s} → ${catName(best)}`;
  });

  const ids = (opts.photo_ids || []).slice();
  const folder = slipFolder_();
  for (let i = ids.length; i < pages.length; i++) {
    ids.push(folder.createFile(Utilities.newBlob(Utilities.base64Decode(pages[i]), mime,
      'สลิป_' + today + '_' + Date.now() + '_' + (i + 1) + '.jpg')).getId());
  }
  const photoIds = ids.join(',');

  const prompt = `คุณอ่านสลิปโอนเงิน/ใบเสร็จ/สลิปบัตร ของคนไทยคนหนึ่ง เพื่อลงบัญชีรายรับรายจ่ายส่วนตัว ตอบเป็น JSON อย่างเดียว:
{"kind":"slip|receipt|card|other","direction":"out|in","date":"yyyy-mm-dd (ค.ศ.)","time":"HH:MM","shop":"ร้าน/ผู้รับเงิน (หรือผู้โอนถ้าเป็นเงินเข้า)","bank":"ธนาคาร/แอปของบัญชีเรา","acct":"เลขบัญชีเรา 4 ตัวท้ายถ้ามี","account":"ชื่อบัญชีจากรายการด้านล่าง หรือ \"\"","ref":"เลขที่อ้างอิง/เลขที่รายการ","total":ยอดรวม,"farm":true/false,"items":[{"item":"ชื่อรายการ","amount":บาท,"category":"ชื่อหมวด"}]}
${pages.length > 1 ? `- รูปทั้ง ${pages.length} รูปคือใบเดียวกัน (ใบเสร็จยาว) รวมรายการทุกรูปตามลำดับ ไม่นับซ้ำส่วนที่ซ้อนกัน\n` : ''}ชนิด:
- slip = สลิปโอนเงิน/จ่ายบิล/สแกนจ่าย (K PLUS, SCB EASY, Krungthai NEXT, Bualuang, MyMo, ttb, กรุงศรี, TrueMoney, เป๋าตัง/PromptPay) → items 1 บรรทัด item = "โอนให้ <ชื่อผู้รับ>" หรือชื่อร้าน/บิลที่จ่าย
  ถ้าเราเป็นผู้รับเงิน direction = "in" (บรรทัดเดียว category เป็นหมวดรายรับ)
- receipt = ใบเสร็จร้านค้า (7-Eleven, Lotus's, Big C, Makro, ร้านอาหาร, ปั๊มน้ำมัน ฯลฯ) → แยกรายการตามบรรทัดในใบเสร็จ
  ถ้ามีเกิน 12 บรรทัด ให้รวมบรรทัดหมวดเดียวกันเป็นบรรทัดเดียว เช่น "ของใช้ 8 รายการ" (ยอดรวมต้องเท่าเดิม)
  ส่วนลด/คูปอง/แต้ม = บรรทัดแยก amount ติดลบ / VAT ที่รวมในราคาแล้วไม่ต้องแยก / ทอนเงิน รับเงิน ไม่ใช่รายการ
- card = สลิปรูดบัตร → บรรทัดเดียว ชื่อร้าน, bank = ธนาคารเจ้าของบัตร, acct = เลขบัตร 4 ตัวท้าย
- ผลรวม amount ทุกบรรทัดต้องเท่ากับ total ถ้าไม่เท่าให้อ่านตัวเลขใหม่
วันที่: สลิปไทยมักเป็น พ.ศ. (เช่น 2 พ.ย. 69 = 2026-11-02, 2569 = 2026) แปลงเป็น ค.ศ. ไม่มีวันที่ใส่ "${today}"
บัญชีของเรา (account): เลือกจากรายการนี้ให้ตรงทุกตัวอักษร ดูจากชื่อธนาคาร/แอป/เลขท้าย ถ้าไม่แน่ใจใส่ ""
${accs.map(a => `- ${a.name}${a.hint ? ' (' + a.hint + ')' : ''} [${a.type}]`).join('\n')}
- ใบเสร็จร้านค้าที่ไม่บอกวิธีจ่ายมักจ่ายเงินสด ถ้ามีบัญชีประเภท cash ให้เลือกอันนั้น
หมวด (category) เลือกจากรายการนี้ให้ตรงทุกตัวอักษร:
รายจ่าย: ${cats.filter(c => c.kind !== 'income').map(c => c.name).join(', ')}
รายรับ: ${cats.filter(c => c.kind === 'income').map(c => c.name).join(', ')}
ร้านที่เคยลง (ร้าน → หมวดที่ใช้):
${shopHints.join('\n') || '-'}
farm = true ถ้าดูเป็นค่าใช้จ่ายไร่อ้อย (ปุ๋ย ยาฆ่าหญ้า อะไหล่รถไถ/รถแทรกเตอร์ ค่าแรงคนงาน ร้านเกษตร น้ำมันดีเซลจำนวนมาก) ไม่งั้น false
อ่านไม่ออกใส่ amount 0 / ห้ามเดา / ถ้าไม่ใช่สลิปหรือใบเสร็จ items = []`;

  let data, tAi = 0;
  try {
    const parts = [{ text: prompt }].concat(pages.map(p => ({ inline_data: { mime_type: mime, data: p } })));
    const t1 = Date.now();
    const txt = geminiCall_(parts);
    tAi = Date.now() - t1;
    data = JSON.parse(txt.replace(/^```json\s*|```\s*$/g, ''));
    if (Array.isArray(data)) data = data[0] || {};
  } catch (e) {
    return { photo_id: photoIds, pages: pages.length, error: String(e.message || e), date: today, shop: '', total: 0, items: [] };
  }
  const kind = data.direction === 'in' ? 'income' : 'expense';
  const byName = n => cats.find(c => c.name === n && (c.kind === 'income') === (kind === 'income'));
  const fallback = cats.filter(c => (c.kind === 'income') === (kind === 'income')).slice(-1)[0] || {};
  const acc = accs.find(a => a.name === data.account);
  const out = {
    kind: data.kind || 'other',
    type: kind,
    date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : today,
    time: data.time || '',
    shop: String(data.shop || '').trim(),
    bank: data.bank || '', acct: data.acct || '',
    acc_id: acc ? acc.acc_id : '',
    ref: String(data.ref || '').trim(),
    total: num_(data.total),
    farm: data.farm === true,
    items: (data.items || []).map(it => ({
      item: String(it.item || '').trim(),
      amount: num_(it.amount),
      cat_id: (byName(it.category) || fallback).cat_id || ''
    })),
    photo_id: photoIds,
    pages: pages.length,
    ms: { ai: tAi, model: geminiUsed_ }
  };
  // กันลงซ้ำ: เลขอ้างอิงเดิม หรือ วันเดียวกัน ยอดเดียวกัน ร้านเดียวกัน
  const dupe = tx.find(t => out.ref && t.ref && String(t.ref) === out.ref) ||
    tx.find(t => out.total && t.date === out.date && t.shop && t.shop === out.shop &&
      Math.abs(tx.filter(x => x.bill_id && x.bill_id === t.bill_id).reduce((s, x) => s + num_(x.amount), 0) - out.total) < 0.01);
  if (dupe) out.dupe = { date: dupe.date, item: dupe.item || dupe.shop, bill_id: dupe.bill_id, tx_id: dupe.tx_id };
  return out;
}

function discardSlip(photoId) {
  String(photoId || '').split(',').map(x => x.trim()).filter(Boolean).forEach(id => {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
  });
  return true;
}

// รูปสลิป (ดูย้อนหลัง) → base64
function getPhoto(id, page) {
  const f = DriveApp.getFileById(String(id).split(',')[Number(page) || 0].trim());
  const b = f.getBlob();
  return { mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
}
