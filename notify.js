const https = require('https');

// ================= TELEGRAM CONFIGURATIONS =================
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
      res.on('end', () => {
        console.log("Telegram API Response Status: OK");
        resolve(responseBody);
      });
    });

    req.on('error', (err) => {
      console.error("Telegram Request Error:", err);
      reject(err);
    });

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
    console.warn(`Firestore read warning for ${formattedDate}:`, e.message);
  }

  return { formattedDate, dayName, fn, an, officerName, phiArea };
}

// 1. Morning 07:00 AM Dual Schedule Reminder
async function sendMorningDualDutyReminder(today) {
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

// 2. Evening 06:00 PM Tomorrow-Only Brief
async function sendEveningTomorrowSchedule(today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const tomorrowInfo = await getDutyForDate(tomorrow);

  const message = `🌇 <b>EVENING BRIEF: TOMORROW'S SCHEDULE (Health 510)</b>
👤 <b>Officer:</b> ${tomorrowInfo.officerName} | ${tomorrowInfo.phiArea}
━━━━━━━━━━━━━━━━━━━━

🟢 <b>TOMORROW'S DUTY PLAN</b>
📅 <b>Date:</b> ${tomorrowInfo.formattedDate} (${tomorrowInfo.dayName})

🌅 <b>Forenoon (8:00 AM - 12:00 PM):</b>
• ${tomorrowInfo.fn}

🌇 <b>Afternoon (1:00 PM - 4:00 PM):</b>
• ${tomorrowInfo.an}

━━━━━━━━━━━━━━━━━━━━
<i>හෙට දින රාජකාරි සඳහා අවශ්‍ය ලිපිලේඛන හා සැලසුම් සූදානම් කරගන්න.</i>`;

  await sendTelegramMessage(message, true);
}

// 3. Morning 07:00 AM Official Reminders Bundle
async function sendMorningOfficialReminders(today, day, monthIndex, dayOfWeek) {
  // A. OT & Claims Reminder
  if ([25, 1, 2, 3, 4, 5].includes(day)) {
    const otMsg = `🔴 <b>CRITICAL REMINDER: OT / CLAIMS SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>කරුණාකර පහත ලේඛන කඩිනමින් සකස් කර MOH කාර්යාලය වෙත ඉදිරිපත් කරන්න:</b>

1. 📝 <b>Monthly OT / Claim / CT / Off Pay Request Form</b>
2. ⛽ <b>Monthly Petrol Claim Form & Log</b>
3. 📄 <b>Next Month OT & Off Pay Advance Request Letters</b>

⚠️ <i>මාසික දීමනා ප්‍රමාදයකින් තොරව ලබාගැනීමට නියමිත දිනට පෙර Submit කරන්න.</i>`;
    await sendTelegramMessage(otMsg);
  }

  // B. Monthly Reports
  if ([1, 2, 3, 4, 5].includes(day)) {
    const repMsg = `📊 <b>MONTHLY REPORT SUBMISSION REMINDER (Day ${day}/05)</b>
━━━━━━━━━━━━━━━━━━━━
පහත මාසික වාර්තා <b>eRHMIS System</b> එකට Update කර <b>Hard Copy</b> සකස් කර භාරදීමට කටයුතු කරන්න:

📋 <b>01. H 631 Part 02</b> - PHI Monthly Report
🏫 <b>02. H 1014</b> - School Health Monthly Return
━━━━━━━━━━━━━━━━━━━━
⚠️ <i>මාසයේ මුල් දින 05 තුළ submission එක අවසන් කළ යුතුය.</i>`;
    await sendTelegramMessage(repMsg);
  }

  // C. SMI Check
  if (day === 1) {
    const smiMsg = `🏫 <b>H 1247: SCHOOL MEDICAL INSPECTION (SMI) CHECK</b>
━━━━━━━━━━━━━━━━━━━━
❓ <b>Are you Updated / Completed the eRHMIS System for SMI?</b>

පසුගිය මස පාසල් වෛද්‍ය පරීක්ෂණ (SMI) දත්ත සහ ප්‍රතිඵල eRHMIS පද්ධතියට නිවැරදිව ඇතුළත් කර අවසන් කර ඇත්දැයි පරීක්ෂා කර තහවුරු කරන්න.`;
    await sendTelegramMessage(smiMsg);
  }

  // D. H 510 Advance Plan Reminder
  if ([22, 23, 24].includes(day)) {
    const nextMonthObj = new Date(today);
    nextMonthObj.setMonth(today.getMonth() + 1);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const nextMonthName = monthNames[nextMonthObj.getMonth()];

    const advMsg = `⚠️ <b>H 510 MONTHLY ADVANCE PROGRAMME SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📅 <b>ඉලක්කගත මාසය:</b> ${nextMonthName} ${nextMonthObj.getFullYear()}

ලබන මස <b>Health 510 Advance Programme</b> එක <b>25 වන දිනට පෙර</b> SPHI / MOH වෙත Approval සඳහා යොමු කළ යුතුය.

👉 <a href="${APP_URL}h510_advance_programme.html"><b>H 510 Schedule එක සකස් කිරීමට මෙතන Click කරන්න</b></a>`;
    await sendTelegramMessage(advMsg, true);
  }

  // E. Q1 Annual & School Survey Reports
  const isQ1 = [0, 1, 2].includes(monthIndex);
  const isMonday = dayOfWeek === 1;
  if (isQ1) {
    let shouldTrigger = false;
    if ((monthIndex === 0 || monthIndex === 1) && isMonday) shouldTrigger = true;
    else if (monthIndex === 2) shouldTrigger = true;

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
        // Evening Trigger (Around 6:00 PM)
        await sendEveningTomorrowSchedule(now);
      } else {
        // Morning Trigger (Around 7:00 AM & Default)
        await sendMorningDualDutyReminder(now);
        await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
      }
    }
    console.log("Process completed successfully!");
  } catch (err) {
    console.error("Execution error:", err);
  }
}

main();
