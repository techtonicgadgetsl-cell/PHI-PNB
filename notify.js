const https = require('https');

// ================= CONFIGURATIONS =================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8853364712:AAEif92LUwmj2N4hdqo1SBKqE3XM0NMNTxI";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "1485164955";
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

async function getDutyForDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = dateObj.getDate();
  const monthKey = `${year}-${month}`;
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = daysOfWeek[dateObj.getDay()];
  const formattedDate = `${year}-${month}-${String(day).padStart(2, '0')}`;

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/phi_advance_schedules/${monthKey}`;

  let fn = "රාජකාරියක් සටහන් කර නැත (No schedule)";
  let an = "රාජකාරියක් සටහන් කර නැත (No schedule)";
  let officerName = "PHI Officer";
  let phiArea = "Range Area";

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
    console.warn(`Firestore read warning: ${e.message}`);
  }

  return { formattedDate, dayName, fn, an, officerName, phiArea };
}

// 1. Daily Duty Reminder (07:00 AM)
async function sendDailyDutyReminder(today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayInfo = await getDutyForDate(today);
  const tomorrowInfo = await getDutyForDate(tomorrow);

  const message = `📋 <b>PHI DUTY REMINDER (Health 510)</b>
👤 <b>Officer:</b> ${todayInfo.officerName} | ${todayInfo.phiArea}
━━━━━━━━━━━━━━━━━━━━

🔴 <b>TODAY'S SCHEDULE</b>
📅 <b>Date:</b> ${todayInfo.formattedDate} (${todayInfo.dayName})
🌅 <b>FN (8:00 AM - 12:00 PM):</b>
• ${todayInfo.fn}
🌇 <b>AN (1:00 PM - 4:00 PM):</b>
• ${todayInfo.an}

━━━━━━━━━━━━━━━━━━━━

🟢 <b>TOMORROW'S SCHEDULE</b>
📅 <b>Date:</b> ${tomorrowInfo.formattedDate} (${tomorrowInfo.dayName})
🌅 <b>FN (8:00 AM - 12:00 PM):</b>
• ${tomorrowInfo.fn}
🌇 <b>AN (1:00 PM - 4:00 PM):</b>
• ${tomorrowInfo.an}

━━━━━━━━━━━━━━━━━━━━
👉 <a href="${APP_URL}"><b>Pocket Note Book (Health 253) එකේ සටහන් කිරීමට App එක විවෘත කරන්න</b></a>`;

  await sendTelegramMessage(message, true);
}

// 2. OT / Claims / Petrol Claim & Request Letters (07:30 AM on 25, 01, 02, 03, 04, 05)
async function checkOtAndClaimsReminder(day) {
  if ([25, 1, 2, 3, 4, 5].includes(day)) {
    const msg = `🔴 <b>CRITICAL REMINDER: OT / CLAIMS SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>කරුණාකර පහත ලේඛන කඩිනමින් සකස් කර MOH කාර්යාලය වෙත ඉදිරිපත් කරන්න:</b>

1. 📝 <b>Monthly OT / Claim / CT / Off Pay Request Form</b>
2. ⛽ <b>Monthly Petrol Claim Form & Log</b>
3. 📄 <b>Next Month OT & Off Pay Advance Request Letters</b>

⚠️ <i>මාසික දීමනා ප්‍රමාදයකින් තොරව ලබාගැනීමට නියමිත දිනට පෙර Submit කරන්න.</i>`;
    await sendTelegramMessage(msg);
  }
}

// 3. Morning 08:00 AM Reports (H 631 Part 02, H 1014, H 1247)
async function checkMorningEightAmReports(day) {
  // Days 1, 2, 3, 4, 5
  if ([1, 2, 3, 4, 5].includes(day)) {
    const msg = `📊 <b>MONTHLY REPORT SUBMISSION REMINDER (Day ${day}/05)</b>
━━━━━━━━━━━━━━━━━━━━
පහත මාසික වාර්තා <b>eRHMIS System</b> එකට Update කර <b>Hard Copy</b> සකස් කර භාරදීමට කටයුතු කරන්න:

📋 <b>01. H 631 Part 02</b> - PHI Monthly Report
🏫 <b>02. H 1014</b> - School Health Monthly Return
━━━━━━━━━━━━━━━━━━━━
⚠️ <i>මාසයේ මුල් දින 05 තුළ submission එක අවසන් කළ යුතුය.</i>`;
    await sendTelegramMessage(msg);
  }

  // Monthly 01st Day SMI Check
  if (day === 1) {
    const smiMsg = `🏫 <b>H 1247: SCHOOL MEDICAL INSPECTION (SMI) CHECK</b>
━━━━━━━━━━━━━━━━━━━━
❓ <b>Are you Updated / Completed the eRHMIS System for SMI?</b>

පසුගිය මස පාසල් වෛද්‍ය පරීක්ෂණ (SMI) දත්ත සහ ප්‍රතිඵල eRHMIS පද්ධතියට නිවැරදිව ඇතුළත් කර අවසන් කර ඇත්දැයි පරීක්ෂා කර තහවුරු කරන්න.`;
    await sendTelegramMessage(smiMsg);
  }
}

// 4. Midday 12:00 PM Reports (H 510 Advance, H 631 Part 01 Annual, H 1015 Survey)
async function checkMiddayTwelvePmReports(today, day, monthIndex, dayOfWeek) {
  // 4.1 H-510 Monthly Advance Programme Reminder (Days 22, 23, 24)
  if ([22, 23, 24].includes(day)) {
    const nextMonthObj = new Date(today);
    nextMonthObj.setMonth(today.getMonth() + 1);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const nextMonthName = monthNames[nextMonthObj.getMonth()];

    const msg = `⚠️ <b>H 510 MONTHLY ADVANCE PROGRAMME SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📅 <b>ඉලක්කගත මාසය:</b> ${nextMonthName} ${nextMonthObj.getFullYear()}

ලබන මස <b>Health 510 Advance Programme</b> එක <b>25 වන දිනට පෙර</b> SPHI / MOH වෙත Approval සඳහා යොමු කළ යුතුය.

👉 <a href="${APP_URL}h510_advance_programme.html"><b>H 510 Schedule එක සකස් කිරීමට මෙතන Click කරන්න</b></a>`;
    await sendTelegramMessage(msg, true);
  }

  // 4.2 Q1 Annual & School Survey Reports (January, February, March)
  // monthIndex: 0 = Jan, 1 = Feb, 2 = Mar
  const isQ1 = [0, 1, 2].includes(monthIndex);
  const isMonday = dayOfWeek === 1; // Monday for weekly

  if (isQ1) {
    let shouldTrigger = false;
    if ((monthIndex === 0 || monthIndex === 1) && isMonday) {
      shouldTrigger = true; // Weekly on Mondays for Jan & Feb
    } else if (monthIndex === 2) {
      shouldTrigger = true; // Daily in March
    }

    if (shouldTrigger) {
      const q1Msg = `📈 <b>Q1 ANNUAL & SURVEY REPORT REMINDER</b>
━━━━━━━━━━━━━━━━━━━━
1. 📊 <b>H 631 Part 01</b> - PHI Annual Report (eRHMIS + Hard Copy)
2. 🏫 <b>H 1015</b> - School Health Sanitary Survey (eRHMIS + Hard Copy)
━━━━━━━━━━━━━━━━━━━━
⚠️ <i>වසරේ පළමු කාර්තුව (Q1) තුළ මෙම වාර්තා සම්පූර්ණ කර අවසන් කළ යුතුය.</i>`;
      await sendTelegramMessage(q1Msg);
    }
  }
}

// ================= MAIN RUNNER =================
async function main() {
  const targetSlot = process.env.TRIGGER_SLOT || "DAILY_DUTY";
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  const day = today.getDate();
  const monthIndex = today.getMonth();
  const dayOfWeek = today.getDay();

  console.log(`Executing Slot: [${targetSlot}] for Date: ${today.toISOString().slice(0, 10)}`);

  try {
    if (targetSlot === "DAILY_DUTY" || targetSlot === "SLOT_0700") {
      await sendDailyDutyReminder(today);
    } 
    else if (targetSlot === "SLOT_0730") {
      await checkOtAndClaimsReminder(day);
    } 
    else if (targetSlot === "SLOT_0800") {
      await checkMorningEightAmReports(day);
    } 
    else if (targetSlot === "SLOT_1200") {
      await checkMiddayTwelvePmReports(today, day, monthIndex, dayOfWeek);
    } 
    else if (targetSlot === "ALL_TEST") {
      await sendDailyDutyReminder(today);
      await checkOtAndClaimsReminder(day);
      await checkMorningEightAmReports(day);
      await checkMiddayTwelvePmReports(today, day, monthIndex, dayOfWeek);
    }
    console.log("Execution finished successfully.");
  } catch (err) {
    console.error("Execution error:", err);
  }
}

main();
