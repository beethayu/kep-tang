สรุปโปรเจกต์ "เก็บตังค์" — บัญชีรายรับรายจ่ายส่วนตัว (เริ่ม 2 พ.ย. 2569)
ใช้คนเดียว บน iPhone (เพิ่มลงหน้าจอโฮม) · ตอบผู้ใช้เป็นภาษาไทยเสมอ · โครงเดียวกับแอปไร่อ้อย (beethayu/rai-oy อ่าน PROJECT.md ที่นั่นประกอบ)

== โครงสร้าง ==
- Google Sheets "เก็บตังค์" (บัญชี bee.prettyboy) https://docs.google.com/spreadsheets/d/1xM_ZFjzQQpaBy_fjnq4YyIjBE2pxxS4yig6FxXJGAO4/edit
- Apps Script ผูกกับชีต Script ID 1O4HcQOh7Uz_ibt9R32iDoNY1Gk0D-qogbQ8W5MomesSnw1-uLEPHduru
  URL: https://script.google.com/macros/s/AKfycbxMUecwXrdIhbqRj7buAEw8GcHkajsGzAIN2jb3mamkMkS5XSZPzG76qc3uUzPQjj_sDA/exec
  โค้ดอยู่ใน gas/ (Api.gs, Code.gs, Slip.gs, appsscript.json) — ห้ามแก้ในหน้า Apps Script ตรง ๆ
- GitHub Pages: index.html ไฟล์เดียว (ไม่ใช้ bootstrap) https://beethayu.github.io/kep-tang/
- Deploy: push gas/** → Action "Deploy Apps Script" (clasp push + update-deployment URL เดิม) ต้องมี Secret CLASPRC_JSON
  push อื่น → Action Pages

== Script Properties ==
API_KEY (รหัสเข้าแอป ตั้งจากหน้าเว็บครั้งแรกด้วย initSetup — ก่อนตั้งเรียกได้แค่ initSetup/getAll)
GEMINI_KEY (ตัวเดียวกับแอปไร่ ใส่จากหน้าเว็บ ตั้งค่า → รหัส Gemini) · GEMINI_MODEL (ไม่ใส่ = gemini-3.5-flash สำรอง 3.5-flash-lite)
INBOX_FROM (วันเริ่มส่งสลิป K PLUS ย้อนหลัง) · SLIP_FOLDER_ID (โฟลเดอร์ Drive "สลิป เก็บตังค์" สร้างเอง) · RAI_KEY (รหัส API แอปไร่ สำหรับยอดรอเบิก)
สิทธิ์: ผู้ใช้ต้องรัน authorizeAll ในหน้า Apps Script ครั้งแรก (ชีต / Drive / UrlFetch) — เพิ่มสิทธิ์ใหม่ทำแบบแอปไร่ (push ก่อน ให้ผู้ใช้อนุญาต แล้วค่อย deploy)

== ชีต ==
- Accounts: acc_id, name, type (cash/bank/card/ewallet/farm/other), opening, hint (ช่วย AI จับคู่สลิป), order, archived, created_at
- Categories: cat_id, name, kind (expense/income), icon (อีโมจิ), budget (งบ/เดือน ว่าง = ไม่มี), order, archived
- Transactions: tx_id, date (ข้อความ yyyy-mm-dd ค.ศ.), type (expense/income/transfer/adjust), amount (บวกเสมอ ยกเว้น adjust ±),
  acc_id, to_acc_id (โอน), cat_id, item, shop, note, bill_id (ใบเสร็จหลายบรรทัด), photo_id (Drive คั่นจุลภาค), ref (เลขอ้างอิงสลิป กันซ้ำ), recur_id, created_at
- Recurring: rec_id, name, type, amount, acc_id, to_acc_id, cat_id, freq (monthly/weekly/yearly), day, next_date, auto, active, note
- ยอดบัญชี = opening + รายการ (คำนวณในหน้าเว็บ balance()) · ลบบัญชี/หมวดที่มีรายการแล้ว = ซ่อน (archived)

== ฟังก์ชัน GAS ที่หน้าเว็บเรียก (คืน getAll() ทั้งก้อนเกือบทุกตัว) ==
getAll, initSetup(key, gemini), saveTx, deleteTx, saveBill(b), deleteBill(id), saveAccount, deleteAccount, adjustBalance(acc, จริง, ตามแอป, date),
saveCategory, deleteCategory, reorderCategories(ids), saveRecurring, deleteRecurring, postRecurring(id, amount, date, acc), skipRecurring,
readSlip(pages[], mime, {photo_ids}), discardSlip, deleteRule(key), inboxSlip(img, taken), inboxLast, readInbox(id),
confirmInbox(ids), discardInbox(id), setInboxFrom(date), getPhoto(ids, page), setGeminiKey, slipAiCheck, changeApiKey, setRaiKey, raiPending
- รายการประจำ auto = getAll ลงให้เองทุกรอบที่ถึง (สูงสุด 24 รอบ) / ไม่ auto = due ขึ้นหน้าแรก กดบันทึก/แก้ยอด/ข้าม

== สลิป / ใบเสร็จ (ยกมาจาก readBill แอปไร่) ==
- ปุ่ม ＋ บันทึก → ถ่าย/เลือกรูป → shrinkImage 1600px → readSlip → หน้าตรวจ → saveBill / ยกเลิก = discardSlip
- เลือกหลายรูป: ถามว่าใบเดียวกัน (ใบเสร็จยาว) หรือคนละใบ (อ่านทีละใบต่อกัน slipQueue)
- AI คืน kind (slip/receipt/card), direction in/out, date ค.ศ., shop, bank+acct → เลือกบัญชีจาก name/hint, ref, total, farm, items[{item, amount, cat}]
  เดาหมวดจากร้านที่เคยลง (shopHints) · กันซ้ำ: ref เดิม หรือ วัน+ร้าน+ยอดเดียวกัน → เตือน
- ส่วนลด (ติดลบ) ตอนบันทึกหักออกจากบรรทัดหมวดเดียวกันที่ใหญ่สุด · ปุ่ม "รวมเป็นยอดเดียว" = รวมบรรทัดตามหมวด
- 🌾 ค่าไร่ (สำรองจ่าย): บันทึกเป็น transfer → บัญชี type farm ยอดเดียว ไม่นับเป็นรายจ่าย · ได้เงินเบิกคืน = โอน farm → ธนาคาร

== รอเบิกจากไร่ ==
- หน้าแรกโชว์ยอดบัญชี farm (ที่ลงในแอปนี้) + ยอดจากแอปไร่ผ่าน raiPending (เรียก rai-oy fn claimSummary ด้วย RAI_KEY แคช 10 นาที)
- ⚠️ แอปไร่ยังไม่มี claimSummary — ต้องทำในแชตแอปไร่ (งาน "เบิกเงินค่าไร่"): คืน {pending: ยอดค้างเบิก, bills: จำนวนบิล, oldest: 'วันที่'}

== หน้าจอ ==
แถบล่าง: หน้าแรก (เงินรวม, เดือนนี้, ประจำถึงกำหนด, งบใกล้เต็ม ≥80%, บัญชี, รอเบิกไร่, ล่าสุด) | รายการ (เดือน, จ่าย/รับ/โอน, บัญชี, ค้นหา, หมวด)
| ＋ บันทึก | สรุป (กราฟ 6 เดือน รับ/จ่าย SVG, หมวด+งบ, รายรับ, จ่ายจากบัญชีไหน) | ตั้งค่า (บัญชี, หมวด/งบ, ประจำ, CSV, รหัส)
- CSV มี BOM (Excel อ่านไทยได้) แชร์ผ่าน navigator.share บน iPhone
- สีหลัก #0F5257 (theme-color = html = #sbar) · กราฟ รับ #2a78d6 จ่าย #eb6834 (ผ่านเช็กตาบอดสีจาก dataviz skill)
- กฎ iOS 26 เหมือนแอปไร่: status-bar-style default, ห้ามกล่องเลื่อนได้ใต้แถบสถานะ (#app/.sheet เริ่มที่ safe-area-inset-top), ปุ่ม color: inherit
- localStorage: kt_key (รหัส), kt_data (ข้อมูลล่าสุด เปิดแล้วเห็นทันที), kt_ui · ลิงก์ ?k=รหัส จำรหัสให้

== สิ่งที่ผู้ใช้ชอบ / บทเรียน (ใช้กับทุกแอปของผู้ใช้ — อัปเดตเมื่อเจอเพิ่ม) ==
- ปุ่มเมนูล่างหน้าตาเดียวกันทุกปุ่ม (ไม่มีปุ่ม + นูนตรงกลาง) · หน้าบันทึกเป็นแท็บจริง ไม่ใช่หน้าต่างเด้ง (ผู้ใช้งงว่า "เด้ง")
- ห้ามเปิดคีย์บอร์ดเอง (focus อัตโนมัติทำให้จอกระตุก)
- รายการแบบบรรทัดเดียว แตะแล้วค่อยมีปุ่ม · หัวเขียวเข้ม (สีหลัก) ทุกหน้า/หน้าต่าง หน้าตาเดียวกัน
- ฟอร์ม: รายละเอียดเป็นการ์ดแถว "ป้ายซ้าย | ค่าขวา" (แบบหน้าตั้งค่า iPhone) ไม่วาง 2 ช่องข้างกัน — iOS ช่องวันที่ล้นไปทับช่องข้าง
- ตัวเลือกเยอะ (หมวด) เรียงตามที่ใช้บ่อย โชว์ 8 อัน + "ทั้งหมด" · ไม่ให้ฟอร์มยาวจนต้องเลื่อนหาจำนวนเงิน
- ตัวกรอง (ประเภท) อยู่บนหัวเขียวแบบ seg สีเข้ม · เลือกบัญชีเป็นชิปเลื่อนซ้ายขวา ไม่ใช้ดรอปดาวน์
- ชื่อเต็ม ห้ามย่อ · ตอบภาษาไทย · ผู้ใช้ใช้ iPhone ทำทุกอย่างบนมือถือ
- ก่อน push ทดสอบหน้าตาด้วย playwright แล้วดูรูปเอง

== วิธีทำงาน (เหมือนแอปไร่) ==
- ต้องการ push: add_repo beethayu/kep-tang access push → clone ที่ /home/claude/kep-tang
- แก้หน้าเว็บ → push → รอ 1–2 นาที → ปัดปิดแอปแล้วเปิดใหม่ · แก้ GAS → push → Action deploy
- ทดสอบหน้าตา: google-chrome + playwright route script.google.com ไปข้อมูลจำลอง
- clasp ในแชตใหม่ต้อง login --no-localhost ใหม่ (ไม่จำเป็นถ้าใช้ Action อย่างเดียว)

== สถานะล่าสุด (11 พ.ย. 2569 ~13:30) — แชตที่ 2 ==
✅ จำหมวดจากที่เลือก/แก้ (v1.1): ชีต Rules (key, name, cat_id, kind, hits) — gas/Rules.gs
   - saveTx/saveBill มีร้าน/ชื่อ + หมวดเดียว → จำ (เลือกหมวดใหม่ = ทับ) · ใบเสร็จหลายหมวด / ค่าไร่ ไม่จำ
   - อ่านสลิปบรรทัดเดียว → ใช้กฎทับที่ Gemini เดา (📌 "หมวดตามที่เคยลง") · กฎทั้งหมดส่งเป็น hint ให้ Gemini ด้วย
   - กรอกมือ: พิมพ์ช่องรายการ/ร้านเสร็จ → เลือกหมวดให้ (ถ้ายังไม่แตะหมวดเอง) · ตั้งค่า → 📌 หมวดที่จำไว้ (✕ ลืม)
   - ruleKey ตัด นาย/นาง/นางสาว/บริษัท…จำกัด/ช่องว่าง/เลขบัญชี xxx · ตรงทุกตัวก่อน แล้วชื่อหนึ่งอยู่ในอีกชื่อ (≥4 ตัว) · หน้าเว็บมี ruleKey/findRule ซ้ำ แก้ต้องแก้ 2 ที่
✅ ดึงสลิป K PLUS (v1.2) — gas/Inbox.gs ชีต Inbox (in_id, taken, md5, photo_id, status, data JSON, err, bill_id)
   - เปลี่ยนจากแผนเดิม: ไม่ใช้ trigger ของ Apps Script (ต้องขอสิทธิ์ใหม่ ผู้ใช้ต้องกดอนุญาตในหน้า Apps Script บนมือถือ ลำบาก)
     สลิปสด (ถ่าย < 6 ชม.) อ่านทันทีตอนคำสั่งลัดส่ง · ที่เหลือ (ย้อนหลัง/อ่านพลาด) หน้าเว็บทยอยอ่าน readInbox ทีละ 2 ใบตอนเปิดแอป
   - คำสั่งลัด: GET ?fn=inboxLast&k= (ข้อความวันที่ล้วน) → หารูปอัลบั้ม K PLUS 45 วัน เก่าสุดก่อน → ถ้าวันที่ถ่าย "อยู่หลัง" → JPEG → Base64 → POST {fn:'inboxSlip', k, img, taken ISO 8601} (doPost รับช่องแบนได้)
     ยังไม่เคยรับ = inboxLast คืน INBOX_FROM (ไม่ตั้ง = วันที่ 1 ของเดือน) → รอบแรกส่งย้อนหลังเอง ไม่ต้องมีคำสั่งลัดแยก
   - กันซ้ำ: taken หรือ md5 (แถว saved/discarded เก็บไว้) · ref/ร้าน+ยอด (เดิม) · ยอดเท่า วัน ±1 กับรายการกรอกมือ → dupe.near
   - sure = slip/card บรรทัดเดียว ยอดตรง มีหมวด+บัญชี ไม่ซ้ำ ไม่ใช่ค่าไร่ → ปุ่ม "ยืนยันทั้งหมดที่ AI มั่นใจ" (confirmInbox) ที่เหลือป้าย "ตรวจ"
   - หน้าแรก: การ์ด 📥 สลิป K PLUS (โชว์ 8 + ทั้งหมด) แตะ → ตรวจสลิป K PLUS (ปุ่ม ทิ้ง = discardInbox ลบรูป) บันทึกแล้วเปิดใบถัดไปเอง
   - ตั้งค่า → 📲 ส่งสลิป K PLUS อัตโนมัติ = วิธีทำคำสั่งลัดทีละข้อ + ปุ่มคัดลอกลิงก์/รหัส + วันเริ่มย้อนหลัง + อัตโนมัติ (ปิด K PLUS / 21:00)
⚠️ ยังไม่ได้ทดสอบของจริง: คำสั่งลัด (ชื่อการทำงานภาษาไทยในคู่มือเดาจากชื่ออังกฤษ อาจไม่ตรงทุกคำ) · Shortcuts ตาม redirect ของ Apps Script ตอน POST
   · ขนาดรูป K PLUS · อ่านสลิปจริงจาก Inbox · ยืนยันทั้งหมด · จำหมวดกับชีตจริง
⏳ รอผู้ใช้: ทำคำสั่งลัดตามหน้าตั้งค่า แล้วรันเอง 1 ครั้ง → บอกผล/ส่งภาพการ์ดหน้าแรก · ตั้งยอดตั้งต้นกสิกร = ยอดก่อนวันเริ่มย้อนหลัง (สิ้น 31 ต.ค.)
ถัดไป: แก้ตามผลคำสั่งลัดจริง · ข้อ 2 ไอเดียน้องแว่น "ถาม AI เรื่องรายจ่าย" · แอปไร่ทำ claimSummary (แชตไร่)

== รอทำ: ไอเดียจากแอปน้องแว่น (ผู้ใช้ตกลง 11 พ.ย. 2569) ==
1. ✅ (ทำแล้ว v1.1) จำหมวดจากที่แก้: ผู้ใช้เปลี่ยนหมวด → จำ ผู้รับ/ร้าน → หมวด (ชีตกฎ) ครั้งหน้าเลือกให้เอง ก่อนถาม Gemini · ทำก่อนเรื่องสลิปอัตโนมัติ
2. ถาม AI เรื่องรายจ่าย ("เดือนนี้ใช้อะไรเยอะสุด" ฯลฯ): แอป/GAS คำนวณตัวเลขจริงก่อน แล้วให้ Gemini เรียบเรียงจากตัวเลขนั้น ห้ามให้ AI บวกเลขเอง · คำตอบเป็นการ์ด "กำลังทำ…" ในหน้า
- คนละครึ่ง/เป๋าตัง: ตัด — เป๋าตังไม่บันทึกสลิป (ผู้ใช้ไม่เคยเจอสลิป)
- ไม่ทำแบบอ่านในเครื่อง (on-device) ได้ — รูปสลิปส่งไป Gemini (เก็บใน Drive ผู้ใช้)

ไอเดียไว้ทีหลัง: สรุปรายปี / แจ้งเตือนรายการประจำผ่าน LINE
