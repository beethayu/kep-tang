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
SLIP_FOLDER_ID (โฟลเดอร์ Drive "สลิป เก็บตังค์" สร้างเอง) · RAI_KEY (รหัส API แอปไร่ สำหรับยอดรอเบิก)
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
readSlip(pages[], mime, {photo_ids}), discardSlip, getPhoto(ids, page), setGeminiKey, slipAiCheck, changeApiKey, setRaiKey, raiPending
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

== วิธีทำงาน (เหมือนแอปไร่) ==
- ต้องการ push: add_repo beethayu/kep-tang access push → clone ที่ /home/claude/kep-tang
- แก้หน้าเว็บ → push → รอ 1–2 นาที → ปัดปิดแอปแล้วเปิดใหม่ · แก้ GAS → push → Action deploy
- ทดสอบหน้าตา: google-chrome + playwright route script.google.com ไปข้อมูลจำลอง
- clasp ในแชตใหม่ต้อง login --no-localhost ใหม่ (ไม่จำเป็นถ้าใช้ Action อย่างเดียว)
