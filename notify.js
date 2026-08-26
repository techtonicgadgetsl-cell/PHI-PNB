const https = require('https');

// ================= CONFIGURATIONS =================
// TELEGRAM CONFIG
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8853364712:AAEif92LUwmj2N4hdqo1SBKqE3XM0NMNTxI";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "1485164955";

// NOTIFY.LK SMS CONFIG
const NOTIFY_USER_ID = process.env.NOTIFY_USER_ID || "32784";
const NOTIFY_API_KEY = process.env.NOTIFY_API_KEY || "hjGLVRyA5TGO1hyiOuRv";
const NOTIFY_PHONE = process.env.NOTIFY_PHONE || "947XXXXXXXX"; // ගිවිසුම්ගත දුරකථන අංකය මෙතන යාවත්කාලීන කරන්න

const FIREBASE_PROJECT_ID = "phi-pnb";
const APP_URL = "https://techtonicgadgetsl-cell.github.io/PHI-PNB/";

function fetchFirestore(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ---------------- TELEGRAM SENDER ----------------
function sendTelegramMessage(text, showAppButton = false) {
  return new Promise((resolve, reject) => {
    const payloadObj = {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    };

    if (showAppButton) {
      payloadObj.reply_markup = {
        inline_keyboard: [
          [{ text: "📱 Open Pocket Log App", url: APP_URL }]
        ]
      };
    }

    const payload = JSON.stringify(payloadObj);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => resolve(responseBody));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ---------------- SMS (NOTIFY.LK) SENDER ----------------
function sendSMSMessage(smsText) {
  return new Promise((resolve, reject) => {
    // Notify.lk URL Encoding
    const encodedText = encodeURIComponent(smsText);
    const sender_id = "NotifyDEMO"; 
    
    const url = `https://app.notify.lk/api/v1/send?user_id=${NOTIFY_USER_ID}&api_key=${NOTIFY_API_KEY}&sender_id=${sender_id}&to=${NOTIFY_PHONE}&message=${encodedText}`;

    https.get(url, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        console.log("SMS API Response:", responseBody);
        resolve(responseBody);
      });
    }).on('error', reject);
  });
}

// ---------------- DUAL PLATFORM SENDER ----------------
async function sendAlert(telegramMsg, smsMsg, showAppButton = false) {
  console.log("-> Sending to Telegram...");
  await sendTelegramMessage(telegramMsg, showAppButton).catch(e => console.error("Telegram Error:", e));
  
  // SMS Phone Number එක හිස් නොමැති නම් පමණක් යවයි
  if (NOTIFY_PHONE && NOTIFY_PHONE !== "947XXXXXXXX") {
      console.log("-> Sending to SMS...");
      await sendSMSMessage(smsMsg).catch(e => console.error("SMS Error:", e));
  } else {
      console.log("-> SMS Skip: Phone number not configured.");
  }
}

// ---------------- DUTY SCHEDULE LOGIC ----------------
async function getDutyForDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = dateObj.getDate();
  const monthKey = `${year}-${month}`;
  
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = daysOfWeek[dateObj.getDay()];
  const formattedDate = `${year}-${month}-${String(day).padStart(2, '0')}`;

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/phi_advance_schedules/${monthKey}`;

  let fn = "No specific duty";
  let an = "No specific duty";
  let officerName = "PHI Officer";
  let phiArea = "Range";

  try {
    const res = await fetchFirestore(url);
    if (res.fields) {
      officerName = res.fields.phiName?.stringValue || officerName;
      phiArea = res.fields.phiArea?.stringValue || phiArea;
      const daysMap = res.fields.days?.mapValue?.fields || {};
      const dayData = daysMap[day]?.mapValue?.fields || {};
      fn = dayData.fn?.stringValue || fn;
      an = dayData.an?.stringValue || an;
    }
  } catch (e) {
    console.warn(`Firestore read warning for ${formattedDate}:`, e.message);
  }

  return { formattedDate, dayName, fn, an, officerName, phiArea, rawDay: day };
}

// 1. Morning 07:00 AM Dual Schedule Reminder
async function sendMorningDualDutyReminder(today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayInfo = await getDutyForDate(today);
  const tomorrowInfo = await getDutyForDate(tomorrow);

  // Telegram Message (Long, HTML)
  const tgMessage = `📋 <b>PHI DUTY REMINDER (Health 510)</b>
👤 <b>Officer:</b> ${todayInfo.officerName} | ${todayInfo.phiArea}
━━━━━━━━━━━━━━━━━━━━

🔴 <b>TODAY'S SCHEDULE</b>
📅 <b>Date:</b> ${todayInfo.formattedDate} (${todayInfo.dayName})
🌅 <b>FN:</b> ${todayInfo.fn}
🌇 <b>AN:</b> ${todayInfo.an}

━━━━━━━━━━━━━━━━━━━━

🟢 <b>TOMORROW'S SCHEDULE</b>
📅 <b>Date:</b> ${tomorrowInfo.formattedDate} (${tomorrowInfo.dayName})
🌅 <b>FN:</b> ${tomorrowInfo.fn}
🌇 <b>AN:</b> ${tomorrowInfo.an}

━━━━━━━━━━━━━━━━━━━━
👉 <a href="${APP_URL}"><b>Pocket Note Book (Health 253) එකේ සටහන් කිරීමට App එක විවෘත කරන්න</b></a>`;

  // SMS Message (Short)
  const smsMessage = `PHI DUTY ALERT
[TODAY] FN:${todayInfo.fn.substring(0,25)} AN:${todayInfo.an.substring(0,25)}
[TOMORROW] FN:${tomorrowInfo.fn.substring(0,25)} AN:${tomorrowInfo.an.substring(0,25)}`;

  await sendAlert(tgMessage, smsMessage, true);
}

// 2. Evening 06:00 PM Tomorrow-Only Brief
async function sendEveningTomorrowSchedule(today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const tomorrowInfo = await getDutyForDate(tomorrow);

  const tgMessage = `🌇 <b>EVENING BRIEF: TOMORROW'S SCHEDULE (Health 510)</b>
👤 <b>Officer:</b> ${tomorrowInfo.officerName} | ${tomorrowInfo.phiArea}
━━━━━━━━━━━━━━━━━━━━

🟢 <b>TOMORROW'S DUTY PLAN</b>
📅 <b>Date:</b> ${tomorrowInfo.formattedDate} (${tomorrowInfo.dayName})

🌅 <b>FN:</b> ${tomorrowInfo.fn}
🌇 <b>AN:</b> ${tomorrowInfo.an}

━━━━━━━━━━━━━━━━━━━━
<i>හෙට දින රාජකාරි සඳහා අවශ්‍ය ලිපිලේඛන හා සැලසුම් සූදානම් කරගන්න.</i>`;

  const smsMessage = `PHI TOMORROW DUTY:
Date: ${tomorrowInfo.formattedDate}
FN: ${tomorrowInfo.fn.substring(0,40)}
AN: ${tomorrowInfo.an.substring(0,40)}`;

  await sendAlert(tgMessage, smsMessage, true);
}

// 3. Morning 07:00 AM Official Reminders Bundle
async function sendMorningOfficialReminders(today, day, monthIndex, dayOfWeek) {
  
  // A. OT & Claims Reminder (Days 25, 1, 2, 3, 4, 5)
  if ([25, 1, 2, 3, 4, 5].includes(day)) {
    const tgMsg = `🔴 <b>CRITICAL REMINDER: OT / CLAIMS SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>කරුණාකර පහත ලේඛන කඩිනමින් සකස් කර MOH කාර්යාලය වෙත ඉදිරිපත් කරන්න:</b>
1. Monthly OT/Claim/Off Pay Form
2. Petrol Claim Form
3. Advance Request Letters`;
    const smsMsg = `URGENT PHI ALERT: Submit your Monthly OT, Petrol Claims & Next Month Advance Letters to MOH office immediately.`;
    await sendAlert(tgMsg, smsMsg);
  }

  // B. Monthly Reports (Days 1, 2, 3, 4, 5)
  if ([1, 2, 3, 4, 5].includes(day)) {
    const tgMsg = `📊 <b>MONTHLY REPORT SUBMISSION REMINDER (Day ${day}/05)</b>
━━━━━━━━━━━━━━━━━━━━
පහත මාසික වාර්තා <b>eRHMIS System</b> එකට Update කර <b>Hard Copy</b> සකස් කර භාරදීමට කටයුතු කරන්න:
📋 01. H 631 Part 02 (Monthly Report)
🏫 02. H 1014 (School Monthly Return)`;
    const smsMsg = `PHI REMINDER: Complete eRHMIS & Hard copy submissions for H 631 Part 02 & H 1014 before the 5th.`;
    await sendAlert(tgMsg, smsMsg);
  }

  // C. SMI Check (Day 01)
  if (day === 1) {
    const tgMsg = `🏫 <b>H 1247: SCHOOL MEDICAL INSPECTION (SMI) CHECK</b>
━━━━━━━━━━━━━━━━━━━━
❓ Are you Updated / Completed the eRHMIS System for SMI?`;
    const smsMsg = `SMI ALERT: Have you updated the eRHMIS system for last month's School Medical Inspections?`;
    await sendAlert(tgMsg, smsMsg);
  }

  // D. H 510 Advance Plan Reminder (Days 22, 23, 24)
  if ([22, 23, 24].includes(day)) {
    const nextMonthObj = new Date(today);
    nextMonthObj.setMonth(today.getMonth() + 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const nextMonthName = monthNames[nextMonthObj.getMonth()];

    const tgMsg = `⚠️ <b>H 510 MONTHLY ADVANCE PROGRAMME SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📅 <b>ඉලක්කගත මාසය:</b> ${nextMonthName} ${nextMonthObj.getFullYear()}
ලබන මස H 510 Advance Programme එක 25 වන දිනට පෙර Approval සඳහා යොමු කළ යුතුය.`;
    const smsMsg = `H 510 ALERT: Submit your ${nextMonthName} Advance Programme before the 25th for SPHI/MOH approval.`;
    await sendAlert(tgMsg, smsMsg, true);
  }

  // E. Q1 Annual & School Survey Reports (Jan/Feb Weekly, March Daily)
  const isQ1 = [0, 1, 2].includes(monthIndex);
  const isMonday = dayOfWeek === 1;
  if (isQ1) {
    let shouldTrigger = false;
    if ((monthIndex === 0 || monthIndex === 1) && isMonday) shouldTrigger = true;
    else if (monthIndex === 2) shouldTrigger = true;

    if (shouldTrigger) {
      const tgMsg = `📈 <b>Q1 ANNUAL & SURVEY REPORT REMINDER</b>
━━━━━━━━━━━━━━━━━━━━
1. 📊 H 631 Part 01 - Annual Report (eRHMIS + Hard Copy)
2. 🏫 H 1015 - Sanitary Survey (eRHMIS + Hard Copy)`;
      const smsMsg = `Q1 REMINDER: Ensure H 631 Part 01 & H 1015 are submitted via eRHMIS & Hard copy within this quarter.`;
      await sendAlert(tgMsg, smsMsg);
    }
  }
}

// ================= MAIN RUNNER =================
async function main() {
  const manualSlot = process.env.TRIGGER_SLOT;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  const hour = now.getHours();
  const day = now.getDate();
  const monthIndex = now.getMonth();
  const dayOfWeek = now.getDay();

  console.log(`[SL Time: ${now.toLocaleTimeString()}] Target Slot: ${manualSlot || 'AUTO'}`);

  try {
    if (manualSlot === "MORNING_0700") {
      await sendMorningDualDutyReminder(now);
      await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
    } else if (manualSlot === "EVENING_1800") {
      await sendEveningTomorrowSchedule(now);
    } else if (manualSlot === "ALL_TEST") {
      await sendMorningDualDutyReminder(now);
      await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
      await sendEveningTomorrowSchedule(now);
    } else {
      // AUTO MODE based on Sri Lanka Hour
      if (hour >= 16 && hour <= 21) {
        await sendEveningTomorrowSchedule(now);
      } else {
        await sendMorningDualDutyReminder(now);
        await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
      }
    }
    console.log("Completed successfully!");
  } catch (err) {
    console.error("Execution error:", err);
  }
}

main();
